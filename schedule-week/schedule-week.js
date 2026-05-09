const app = getApp();

Page({
  data: {
    currentWeek: 1,
    totalWeeks: 20,
    weekDays: [],
    weekDateRange: '',
    semesterStartDate: '',
    weekSchedule: [],
    weekCourseCount: 0,
    courseColors: [
      '#1890ff', '#52c41a', '#faad14', '#722ed1',
      '#f5222d', '#fa8c16', '#13c2c2', '#eb2f96'
    ],
    timeSlots: [
      { time: '08:00-09:40', label: '1-2节' },
      { time: '10:00-11:40', label: '3-4节' },
      { time: '14:00-15:40', label: '5-6节' },
      { time: '16:00-17:40', label: '7-8节' },
      { time: '19:00-20:40', label: '9-10节' }
    ],
    loading: false,
    timeSlotMap: {
      '08:00': 0, '10:00': 1, '14:00': 2, '16:00': 3, '19:00': 4
    }
  },

  onLoad(options) {
    this.calculateCurrentWeek(() => {
      // 接收日视图传递的周次参数（优先）
      if (options.week) {
        const week = parseInt(options.week, 10);
        if (Number.isFinite(week)) {
          this.setData({ currentWeek: week });
        }
      }
      this.syncWeekDates();
      this.loadWeekSchedule();
    });
  },

  calculateCurrentWeek(onDone) {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    let semesterStart;

    if (month >= 2 && month <= 7) {
      semesterStart = new Date(year, 1, 24);
    } else {
      const semesterYear = month >= 8 ? year : year - 1;
      semesterStart = new Date(semesterYear, 8, 1);
    }

    const diffTime = today - semesterStart;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const currentWeek = Math.max(1, Math.min(20, Math.ceil((diffDays + 1) / 7)));

    this.setData(
      {
        currentWeek,
        semesterStartDate: semesterStart.toISOString().split('T')[0]
      },
      () => {
        if (typeof onDone === 'function') onDone();
      }
    );
  },

  syncWeekDates() {
    const semesterStartDate = this.data.semesterStartDate;
    if (!semesterStartDate) return;

    const semesterStart = new Date(semesterStartDate);
    const monday = new Date(semesterStart);
    monday.setDate(semesterStart.getDate() + (this.data.currentWeek - 1) * 7);
    const weekDays = [];
    const dayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      weekDays.push({
        name: dayNames[i],
        date: `${date.getMonth() + 1}/${date.getDate()}`,
        fullDate: date.toISOString().split('T')[0],
        dayIndex: i + 1  // 1-7 for dayOfWeek
      });
    }

    const startDate = weekDays[0].fullDate;
    const endDate = weekDays[6].fullDate;

    this.setData({
      weekDays,
      weekDateRange: `${startDate} ~ ${endDate}`
    });
  },

  async loadWeekSchedule() {
    this.setData({ loading: true });

    try {
      const res = await app.request({
        url: '/api/schedule/week',
        data: { week: this.data.currentWeek }
      });

      if (res.code === 0) {
        this.processWeekData(res.data);
      }
    } catch (err) {
      console.error('加载周课表失败:', err);
      this.useMockData();
    } finally {
      this.setData({ loading: false });
    }
  },

  processWeekData(data) {
    const courses = data.courses || [];
    const weekSchedule = this.buildWeekGrid(courses);
    this.setData({ 
      weekSchedule,
      weekCourseCount: courses.length,
      totalWeeks: data.totalWeeks || 20
    });
  },

  useMockData() {
    // 根据当前周获取模拟课程数据
    const week = this.data.currentWeek;
    
    // 全部模拟课程
    const allMockCourses = [
      { id: '1', courseName: '高等数学A', dayOfWeek: 1, startTime: '08:00', endTime: '09:40', location: 'A301', teacher: '张教授', startWeek: 1, endWeek: 16 },
      { id: '2', courseName: '大学英语', dayOfWeek: 1, startTime: '10:00', endTime: '11:40', location: 'B205', teacher: '李老师', startWeek: 1, endWeek: 16 },
      { id: '3', courseName: '数据结构', dayOfWeek: 1, startTime: '14:00', endTime: '15:40', location: '实验302', teacher: '王老师', startWeek: 1, endWeek: 12 },
      { id: '4', courseName: '计算机网络', dayOfWeek: 2, startTime: '16:00', endTime: '17:40', location: 'A502', teacher: '刘老师', startWeek: 1, endWeek: 16 },
      { id: '5', courseName: '操作系统', dayOfWeek: 2, startTime: '14:00', endTime: '15:40', location: '实验301', teacher: '吴老师', startWeek: 5, endWeek: 16 },
      { id: '6', courseName: '人工智能导论', dayOfWeek: 3, startTime: '10:00', endTime: '11:40', location: 'B401', teacher: '陈教授', startWeek: 9, endWeek: 16 },
      { id: '7', courseName: '体育', dayOfWeek: 4, startTime: '15:00', endTime: '16:00', location: '体育馆', teacher: '赵老师', startWeek: 1, endWeek: 16 },
      { id: '8', courseName: '数据库原理', dayOfWeek: 4, startTime: '10:00', endTime: '11:40', location: 'A402', teacher: '郑老师', startWeek: 1, endWeek: 12 },
      { id: '9', courseName: '离散数学', dayOfWeek: 5, startTime: '08:00', endTime: '09:40', location: 'C201', teacher: '周老师', startWeek: 1, endWeek: 10 },
      { id: '10', courseName: '软件工程', dayOfWeek: 5, startTime: '16:00', endTime: '17:40', location: 'B305', teacher: '冯老师', startWeek: 11, endWeek: 16 },
    ];

    // 筛选当前周有课的课程
    const mockCourses = allMockCourses.filter(c => c.startWeek <= week && c.endWeek >= week);
    
    const weekSchedule = this.buildWeekGrid(mockCourses);
    this.setData({ 
      weekSchedule,
      weekCourseCount: mockCourses.length
    });
  },

  buildWeekGrid(courses) {
    // 构建周课表网格：7天 x 5个时间段
    const grid = [];
    const timeSlotMap = this.data.timeSlotMap;
    
    for (let day = 1; day <= 7; day++) {
      const dayCourses = courses.filter(c => c.dayOfWeek === day);
      const slots = [];

      for (let slot = 0; slot < 5; slot++) {
        const slotCourses = dayCourses.filter(c => {
          const slotIndex = timeSlotMap[c.startTime];
          return slotIndex === slot;
        }).map((c, i) => ({
          ...c,
          colorIndex: slot
        }));
        
        slots.push({
          courses: slotCourses
        });
      }
      
      grid.push(slots);
    }
    return grid;
  },

  prevWeek() {
    const currentWeek = this.data.currentWeek;
    if (currentWeek > 1) {
      this.setData({ currentWeek: currentWeek - 1 });
      this.syncWeekDates();
      this.loadWeekSchedule();
    }
  },

  nextWeek() {
    const currentWeek = this.data.currentWeek;
    if (currentWeek < this.data.totalWeeks) {
      this.setData({ currentWeek: currentWeek + 1 });
      this.syncWeekDates();
      this.loadWeekSchedule();
    }
  },

  goToSchedule() {
    wx.navigateBack();
  },

  showCourseDetail(e) {
    const course = e.currentTarget.dataset.course;
    if (!course) return;
    
    wx.showModal({
      title: course.courseName,
      content: `时间：${course.startTime}-${course.endTime}\n地点：${course.location}\n${course.teacher ? '教师：' + course.teacher : ''}`,
      showCancel: false
    });
  }
});
