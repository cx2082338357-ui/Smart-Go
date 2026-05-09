const app = getApp();
const { normalizeBuildingName } = require('../../config/buildings');

Page({
  data: {
    examList: [],
    loading: false,
    selectedMonth: '',
    monthList: [],
    stats: {
      total: 0,
      completed: 0,
      upcoming: 0
    }
  },

  onLoad() {
    this.loadExamList();
  },

  onPullDownRefresh() {
    this.loadExamList().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  async loadExamList() {
    this.setData({ loading: true });

    try {
      const res = await app.request({
        url: '/api/exam/list'
      });

      if (res.code === 0) {
        this.processExamData(res.data);
      }
    } catch (err) {
      console.error('加载考试安排失败:', err);
      this.useMockData();
    } finally {
      this.setData({ loading: false });
    }
  },

  processExamData(data) {
    const examList = (data.exams || []).map(exam => {
      const now = new Date();
      const examDate = new Date(exam.examDate);
      let status = 'upcoming';
      let statusText = '未开始';
      let statusColor = '#1890ff';

      if (exam.status === 'completed') {
        status = 'completed';
        statusText = '已结束';
        statusColor = '#999';
      } else if (examDate < now) {
        status = 'completed';
        statusText = '已结束';
        statusColor = '#999';
      } else {
        const diffDays = Math.ceil((examDate - now) / (1000 * 60 * 60 * 24));
        if (diffDays <= 3) {
          statusText = `还有${diffDays}天`;
          statusColor = '#f5222d';
        } else if (diffDays <= 7) {
          statusText = `还有${diffDays}天`;
          statusColor = '#faad14';
        } else {
          statusText = '即将开始';
          statusColor = '#52c41a';
        }
      }

      return {
        ...exam,
        location: normalizeBuildingName(exam.location || ''),
        status,
        statusText,
        statusColor,
        examDateStr: this.formatDate(exam.examDate)
      };
    });

    // 按日期排序
    examList.sort((a, b) => new Date(a.examDate) - new Date(b.examDate));

    const completed = examList.filter(e => e.status === 'completed').length;
    this.setData({
      examList,
      stats: {
        total: examList.length,
        completed,
        upcoming: examList.length - completed
      }
    });
  },

  useMockData() {
    const mockExams = [
      { id: '1', courseName: '高等数学A', examDate: '2026-04-15', examTime: '09:00-11:00', location: '春晖学堂（主教）301', examType: '闭卷', credits: 5, status: 'upcoming' },
      { id: '2', courseName: '大学英语IV', examDate: '2026-04-18', examTime: '14:00-16:00', location: '文馨书院（二教）205', examType: '闭卷', credits: 3, status: 'upcoming' },
      { id: '3', courseName: '数据结构', examDate: '2026-04-20', examTime: '09:00-11:00', location: '逸夫楼302', examType: '闭卷+上机', credits: 4, status: 'upcoming' },
      { id: '4', courseName: '计算机网络', examDate: '2026-04-25', examTime: '14:00-16:00', location: '春晖学堂（主教）502', examType: '闭卷', credits: 3, status: 'upcoming' },
      { id: '5', courseName: '操作系统', examDate: '2026-05-10', examTime: '09:00-11:00', location: '逸夫楼301', examType: '闭卷+上机', credits: 4, status: 'upcoming' },
      { id: '6', courseName: '数据库原理', examDate: '2026-05-15', examTime: '14:00-16:00', location: '春晖学堂（主教）402', examType: '闭卷', credits: 3, status: 'upcoming' },
      { id: '7', courseName: '人工智能导论', examDate: '2026-05-20', examTime: '09:00-11:00', location: '文馨书院（二教）401', examType: '开卷', credits: 2, status: 'upcoming' },
      { id: '8', courseName: '马克思主义基本原理', examDate: '2026-03-15', examTime: '09:00-11:00', location: '明德楼101', examType: '闭卷', credits: 3, status: 'completed' },
      { id: '9', courseName: '体育', examDate: '2026-03-20', examTime: '14:00-16:00', location: '体育馆', examType: '实践', credits: 1, status: 'completed' },
    ];

    this.processExamData({ exams: mockExams });
  },

  formatDate(dateStr) {
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekDay = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()];
    return `${month}月${day}日 ${weekDay}`;
  },

  showExamDetail(e) {
    const exam = e.currentTarget.dataset.exam;
    wx.showModal({
      title: exam.courseName,
      content: `考试时间：${exam.examDateStr} ${exam.examTime}\n考试地点：${exam.location}\n考试类型：${exam.examType}\n学分：${exam.credits}`,
      confirmText: '知道了',
      showCancel: false
    });
  },

  addToCalendar(e) {
    const exam = e.currentTarget.dataset.exam;
    const examDate = exam.examDate.replace(/-/g, '');
    const startTime = exam.examTime.split('-')[0].replace(':', '') + '00';
    const endTime = exam.examTime.split('-')[1].replace(':', '') + '00';

    wx.addPhoneContact({
      fail: () => {
        app.toast('请手动添加到日历');
      }
    });
  },

  goToSchedule() {
    wx.navigateBack();
  }
});
