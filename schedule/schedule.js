const app = getApp();
const { normalizeBuildingName } = require('../../config/buildings');

Page({
  data: {
    currentWeek: 1,
    selectedDay: 0,
    weekDays: [],
    weekDateRange: '',
    dayCourses: [],
    loading: false,
    semesterStartDate: '',
    courseColors: [
      'linear-gradient(135deg, #1890ff, #69c0ff)',
      'linear-gradient(135deg, #52c41a, #95de64)',
      'linear-gradient(135deg, #faad14, #ffd666)',
      'linear-gradient(135deg, #722ed1, #b37feb)',
      'linear-gradient(135deg, #f5222d, #ff7875)',
      'linear-gradient(135deg, #fa8c16, #ffc53d)',
      'linear-gradient(135deg, #13c2c2, #5cdbd3)',
    ]
  },

  onLoad() {
    this.calculateCurrentWeek(() => {
      // 依赖 semesterStartDate，需等 setData 完成后再生成日期
      this.syncWeekDates(false);
      this.loadSchedule();
    });
  },

  onPullDownRefresh() {
    this.loadSchedule().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  syncWeekDates(keepSelectedDay = true) {
    const semesterStartDate = this.data.semesterStartDate;
    if (!semesterStartDate) return;

    const semesterStart = new Date(semesterStartDate);
    const monday = new Date(semesterStart);
    monday.setDate(semesterStart.getDate() + (this.data.currentWeek - 1) * 7);

    const dayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    const weekDays = dayNames.map((name, i) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      return {
        name,
        date: `${date.getMonth() + 1}/${date.getDate()}`,
        fullDate: date.toISOString().split('T')[0],
        hasClass: false
      };
    });

    const startDate = weekDays[0].fullDate;
    const endDate = weekDays[6].fullDate;

    let selectedDay = this.data.selectedDay;
    if (!keepSelectedDay) {
      selectedDay = 0;
      const todayStr = new Date().toISOString().split('T')[0];
      const idx = weekDays.findIndex(d => d.fullDate === todayStr);
      if (idx >= 0) selectedDay = idx;
    }

    this.setData({
      weekDays,
      weekDateRange: `${startDate} ~ ${endDate}`,
      selectedDay
    });
  },

  calculateCurrentWeek(onDone) {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    let semesterStart, semesterYear, semesterNum;

    if (month >= 2 && month <= 7) {
      semesterYear = year;
      semesterNum = 1;
      semesterStart = new Date(year, 1, 24);
    } else {
      semesterYear = month >= 8 ? year : year - 1;
      semesterNum = 2;
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

  async loadSchedule() {
    this.setData({ loading: true });

    try {
      const res = await app.request({
        url: '/api/schedule/week',
        timeout: 10000,
        data: {
          week: this.data.currentWeek
        }
      });

      if (res.code === 0) {
        this.processScheduleData(res.data);
      }
    } catch (err) {
      console.error('加载课表失败:', err);
      this.useMockData();
    } finally {
      this.setData({ loading: false });
    }
  },

  processScheduleData(data) {
    const courses = data.courses || [];
    
    const weekDays = this.data.weekDays.map(day => {
      const hasClass = courses.some(c => c.dayOfWeek === this.getDayIndex(day.name));
      return { ...day, hasClass };
    });

    const selectedDayInfo = weekDays[this.data.selectedDay];
    const dayOfWeek = this.getDayIndex(selectedDayInfo.name);
    const dayCourses = courses
      .filter(c => c.dayOfWeek === dayOfWeek)
      .map((c, index) => ({
        ...c,
        location: normalizeBuildingName(c.location || ''),
        color: this.data.courseColors[index % this.data.courseColors.length],
        hasReminder: c.hasReminder || false
      }));

    this.setData({
      weekDays,
      dayCourses
    });
  },

  useMockData() {
    const mockCourses = [
      { id: '1', courseName: '高等数学A', type: '必修', location: '春晖学堂（主教）301', startTime: '08:00', endTime: '09:40', teacher: '张教授', dayOfWeek: 1 },
      { id: '2', courseName: '大学英语', type: '必修', location: '文馨书院（二教）205', startTime: '10:00', endTime: '11:40', teacher: '李老师', dayOfWeek: 1 },
      { id: '3', courseName: '数据结构', type: '必修', location: '逸夫楼302', startTime: '14:00', endTime: '15:40', teacher: '王老师', dayOfWeek: 1 },
      { id: '4', courseName: '计算机网络', type: '必修', location: '春晖学堂（主教）502', startTime: '16:00', endTime: '17:40', teacher: '刘老师', dayOfWeek: 2 },
      { id: '5', courseName: '操作系统', type: '必修', location: '逸夫楼301', startTime: '14:00', endTime: '15:40', teacher: '吴老师', dayOfWeek: 2 },
      { id: '6', courseName: '人工智能导论', type: '选修', location: '文馨书院（二教）401', startTime: '10:00', endTime: '11:40', teacher: '陈教授', dayOfWeek: 3 },
      { id: '7', courseName: '体育', type: '必修', location: '体育馆', startTime: '15:00', endTime: '16:00', teacher: '赵老师', dayOfWeek: 4 },
      { id: '8', courseName: '数据库原理', type: '必修', location: '春晖学堂（主教）402', startTime: '10:00', endTime: '11:40', teacher: '郑老师', dayOfWeek: 4 },
      { id: '9', courseName: '离散数学', type: '必修', location: '明德楼201', startTime: '08:00', endTime: '09:40', teacher: '周老师', dayOfWeek: 5 },
      { id: '10', courseName: '软件工程', type: '选修', location: '文馨书院（二教）305', startTime: '16:00', endTime: '17:40', teacher: '冯老师', dayOfWeek: 5 },
    ];

    const weekDays = this.data.weekDays.map(day => {
      const dayIndex = this.getDayIndex(day.name);
      const hasClass = mockCourses.some(c => c.dayOfWeek === dayIndex);
      return { ...day, hasClass };
    });

    const dayOfWeek = this.getDayIndex(this.data.weekDays[this.data.selectedDay].name);
    const dayCourses = mockCourses
      .filter(c => c.dayOfWeek === dayOfWeek)
      .map((c, index) => ({
        ...c,
        location: normalizeBuildingName(c.location || ''),
        color: this.data.courseColors[index % this.data.courseColors.length],
        hasReminder: false
      }));

    this.setData({
      weekDays,
      dayCourses
    });
  },

  getDayIndex(dayName) {
    const map = { '周一': 1, '周二': 2, '周三': 3, '周四': 4, '周五': 5, '周六': 6, '周日': 0 };
    return map[dayName];
  },

  selectDay(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({ selectedDay: index });
    this.loadDayCourses();
  },

  loadDayCourses() {
    const dayOfWeek = this.getDayIndex(this.data.weekDays[this.data.selectedDay].name);
    
    app.request({
      url: '/api/schedule/week',
      timeout: 10000,
      data: { week: this.data.currentWeek }
    }).then(res => {
      if (res.code === 0) {
        const courses = res.data.courses || [];
        const dayCourses = courses
          .filter(c => c.dayOfWeek === dayOfWeek)
          .map((c, index) => ({
            ...c,
            location: normalizeBuildingName(c.location || ''),
            color: this.data.courseColors[index % this.data.courseColors.length],
            hasReminder: c.hasReminder || false
          }));
        this.setData({ dayCourses });
      }
    }).catch(() => {
      this.useMockData();
    });
  },

  prevWeek() {
    const currentWeek = this.data.currentWeek;
    if (currentWeek > 1) {
      this.setData({ currentWeek: currentWeek - 1 });
      this.syncWeekDates();
      this.loadSchedule();
    }
  },

  nextWeek() {
    const currentWeek = this.data.currentWeek;
    if (currentWeek < 20) {
      this.setData({ currentWeek: currentWeek + 1 });
      this.syncWeekDates();
      this.loadSchedule();
    }
  },

  async toggleReminder(e) {
    const index = e.currentTarget.dataset.index;
    const course = this.data.dayCourses[index];

    try {
      if (course.hasReminder) {
        await app.request({
          url: '/api/schedule/reminder/cancel',
          method: 'POST',
          data: { courseId: course.id }
        });
        this.setData({
          [`dayCourses[${index}].hasReminder`]: false
        });
        app.toast('已取消提醒');
      } else {
        await app.request({
          url: '/api/schedule/reminder',
          method: 'POST',
          data: {
            courseId: course.id,
            courseName: course.courseName,
            courseTime: course.startTime,
            location: course.location || '',
            remindBefore: 15
          }
        });
        this.setData({
          [`dayCourses[${index}].hasReminder`]: true
        });
        app.toast('提醒设置成功，上课前15分钟提醒');
      }
    } catch (err) {
      console.error('设置提醒失败:', err);
      // 演示模式：本地更新
      const key = `reminder_${course.id}`;
      if (course.hasReminder) {
        wx.removeStorageSync(key);
        this.setData({
          [`dayCourses[${index}].hasReminder`]: false
        });
        app.toast('已取消提醒');
      } else {
        wx.setStorageSync(key, {
          courseId: course.id,
          courseName: course.courseName,
          courseTime: course.startTime,
          location: course.location
        });
        this.setData({
          [`dayCourses[${index}].hasReminder`]: true
        });
        app.toast('提醒设置成功（演示模式）');
      }
    }
  },

  navigateToClass(e) {
    const campus = app.getCampusLocation();
    
    wx.getLocation({
      type: 'gcj02',
      success: () => {
        wx.openLocation({
          latitude: campus.latitude,
          longitude: campus.longitude,
          name: campus.name,
          address: campus.address,
          scale: 18
        });
      },
      fail: () => {
        app.toast('请开启位置权限');
      }
    });
  },

  goToWeekView() {
    wx.navigateTo({
      url: `/pages/schedule-week/schedule-week?week=${this.data.currentWeek}`
    });
  },

  goToExamSchedule() {
    wx.navigateTo({
      url: '/pages/exam/exam'
    });
  }
});
