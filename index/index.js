const app = getApp();
const { normalizeBuildingName, BUILDING_FILTER_LIST } = require('../../config/buildings');

Page({
  data: {
    isBindAccount: false,
    userInfo: null,
    userStats: {
      credits: 0,
      gpa: '0.00',
      rank: '--'
    },
    todaySchedule: [],
    classroomHeatmap: [],
    hotTopics: [],
    emptyClassrooms: [],
    heatmapSortMode: 'rate',
    heatmapUpdatedAt: '',
    recommendedProducts: []
  },

  onLoad() {
    this.checkUserStatus();
    this.loadTodaySchedule();
    this.loadClassroomHeatmap();
    this.loadHotTopics();
    this.loadRecommendedProducts();
  },

  onShow() {
    this.checkUserStatus();
  },

  onPullDownRefresh() {
    this.loadAllData().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  checkUserStatus() {
    const isBindAccount = app.globalData.isBindAccount;
    const userInfo = app.globalData.userInfo;

    this.setData({
      isBindAccount,
      userInfo
    });

    if (isBindAccount && userInfo) {
      this.loadUserStats();
    }
  },

  async loadAllData() {
    await Promise.all([
      this.loadUserStats(),
      this.loadTodaySchedule(),
      this.loadClassroomHeatmap(),
      this.loadHotTopics(),
      this.loadRecommendedProducts()
    ]);
  },

  async loadUserStats() {
    try {
      const res = await app.request({
        url: '/api/user/stats',
        timeout: 10000
      });

      if (res.code === 0) {
        this.setData({
          userStats: res.data
        });
      }
    } catch (err) {
      console.error('加载用户统计失败:', err);
      // 兜底：避免首页长时间显示 0
      this.setData({
        userStats: { credits: 92, gpa: '3.72', rank: '前15%' }
      });
    }
  },

  async loadTodaySchedule() {
    try {
      const res = await app.request({
        url: '/api/schedule/today'
      });

      if (res.code === 0) {
        this.setData({
          todaySchedule: res.data.map(item => ({
            ...item,
            needReminder: true
          }))
        });
      }
    } catch (err) {
      console.error('加载今日课表失败:', err);
    }
  },

  async loadClassroomHeatmap() {
    try {
      const res = await app.request({
        url: '/api/classroom/heatmap'
      });

      if (res.code === 0) {
        const list = (res.data || []).map(item => ({
          ...item,
          name: normalizeBuildingName(item.name),
          building: normalizeBuildingName(item.building || item.name),
          color: this.getHeatmapColor(item.availableRate)
        }));
        const homeList = this._pickHomeHeatmapItems(list);
        const sorted = this._sortHeatmap(homeList, this.data.heatmapSortMode);
        this.setData({
          emptyClassrooms: sorted,
          heatmapUpdatedAt: this._fmtTime()
        });
      }
    } catch (err) {
      console.error('加载空教室热力图失败:', err);
      this.useMockClassrooms();
    }
  },

  useMockClassrooms() {
    const mockRates = [75, 45, 82, 30, 55, 66];
    const mock = BUILDING_FILTER_LIST.map((name, idx) => ({
      name,
      building: name,
      availableRate: mockRates[idx] ?? 55
    }));
    const list = mock.map(item => ({
      ...item,
      color: this.getHeatmapColor(item.availableRate)
    }));
    this.setData({
      emptyClassrooms: this._sortHeatmap(list, this.data.heatmapSortMode),
      heatmapUpdatedAt: this._fmtTime()
    });
  },

  _pickHomeHeatmapItems(list) {
    const source = list || [];
    return BUILDING_FILTER_LIST.map(buildingName => {
      const exact = source.find(item => item.name === buildingName);
      if (exact) {
        return {
          ...exact,
          name: buildingName,
          building: buildingName,
          color: this.getHeatmapColor(exact.availableRate)
        };
      }

      const rooms = source.filter(item =>
        item.building === buildingName ||
        String(item.name || '').startsWith(`${buildingName} `)
      );
      if (!rooms.length) return null;

      const total = rooms.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
      const available = rooms.reduce((sum, item) => sum + (Number(item.available) || 0), 0);
      const availableRate = total > 0
        ? Math.round((available / total) * 100)
        : Math.round(
          rooms.reduce((sum, item) => sum + (Number(item.availableRate) || 0), 0) / rooms.length
        );

      return {
        name: buildingName,
        building: buildingName,
        availableRate,
        available,
        total,
        color: this.getHeatmapColor(availableRate)
      };
    }).filter(Boolean);
  },

  getHeatmapColor(rate) {
    if (rate >= 70) return 'linear-gradient(135deg, #52c41a, #73d13d)';
    if (rate >= 40) return 'linear-gradient(135deg, #faad14, #ffc53d)';
    return 'linear-gradient(135deg, #f5222d, #ff7875)';
  },

  toggleHeatmapSort(e) {
    const mode = e.currentTarget.dataset.mode;
    if (!mode) return;
    this.setData({ heatmapSortMode: mode });
    this.setData({ emptyClassrooms: this._sortHeatmap(this.data.emptyClassrooms || [], mode) });
  },

  _sortHeatmap(list, mode) {
    const arr = (list || []).slice();
    if (mode === 'count') {
      return arr.sort((a, b) => (b.available || 0) - (a.available || 0));
    }
    return arr.sort((a, b) => (b.availableRate || 0) - (a.availableRate || 0));
  },

  _fmtTime() {
    const d = new Date();
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  },

  openBuildingUsage(e) {
    const building = (e.currentTarget.dataset.building || '').trim();
    if (!building) return;
    wx.navigateTo({
      url: `/pages/empty-classroom/empty-classroom?building=${encodeURIComponent(building)}&focus=1`
    });
  },

  async loadHotTopics() {
    try {
      const res = await app.request({
        url: '/api/ai/hot-topics'
      });

      if (res.code === 0) {
        this.setData({
          hotTopics: res.data
        });
      }
    } catch (err) {
      console.error('加载热门话题失败:', err);
    }
  },

  async loadRecommendedProducts() {
    try {
      const res = await app.request({
        url: '/api/shop/products',
        data: {
          category: '零食',
          page: 1,
          limit: 6
        }
      });

      if (res.code === 0) {
        this.setData({
          recommendedProducts: res.data.list.slice(0, 6)
        });
      }
    } catch (err) {
      console.error('加载推荐商品失败:', err);
    }
  },

  goBindAccount() {
    wx.navigateTo({
      url: '/pages/bind-account/bind-account'
    });
  },

  // 微信授权登录（替代手机号登录）
  async onWechatLogin() {
    wx.showLoading({ title: '登录中...' });

    try {
      // 步骤1：获取用户信息
      const profileRes = await new Promise((resolve, reject) => {
        wx.getUserProfile({
          desc: '用于完善用户资料',
          success: resolve,
          fail: reject
        });
      });

      // 步骤2：获取登录 code
      const loginRes = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout')), 10000);
        wx.login({
          success: resolve,
          fail: reject
        });
      });

      // 步骤3：提交到后端
      const res = await app.request({
        url: '/api/auth/wechat-login',
        method: 'POST',
        data: {
          code: loginRes.code,
          nickname: profileRes.userInfo.nickName,
          avatar: profileRes.userInfo.avatarUrl,
          gender: profileRes.userInfo.gender === 1 ? '男' : '女'
        }
      });

      wx.hideLoading();

      if (res.code === 0) {
        wx.setStorageSync('token', res.data.token);
        if (res.data.openid) wx.setStorageSync('openid', res.data.openid);

        const userInfo = { ...res.data.userInfo };
        if (profileRes.userInfo.nickName) {
          userInfo.name = profileRes.userInfo.nickName;
        }
        if (profileRes.userInfo.avatarUrl) {
          userInfo.avatar = profileRes.userInfo.avatarUrl;
        }

        wx.setStorageSync('userInfo', userInfo);
        app.globalData.userInfo = userInfo;
        app.globalData.isBindAccount = res.data.isBind || res.data.needBind === false;

        wx.showModal({
          title: '登录成功',
          content: res.data.isBind || res.data.needBind === false 
            ? '欢迎使用智慧校园' 
            : '登录成功，请绑定教务账号完善功能',
          showCancel: false,
          success: () => {
            if (res.data.isBind || res.data.needBind === false) {
              wx.switchTab({ url: '/pages/index/index' });
            } else {
              wx.navigateTo({ url: '/pages/bind-account/bind-account' });
            }
          }
        });

        this.setData({ isBindAccount: res.data.isBind || res.data.needBind === false, userInfo });
      } else {
        app.toast(res.message || '登录失败，请稍后重试');
      }
    } catch (err) {
      wx.hideLoading();
      console.error('微信登录失败:', err);
      if (err.errMsg && err.errMsg.includes('auth deny')) {
        app.toast('您取消了授权，请重试');
      } else if (err.message === 'timeout') {
        app.toast('网络超时，请检查网络后重试');
      } else {
        app.toast('登录失败，请稍后重试');
      }
    }
  },

  async onGetPhone(e) {
    const { errMsg, code } = e.detail;

    if (errMsg !== 'getPhoneNumber:ok') {
      let errorTip = '获取手机号失败，请重试';
      if (errMsg === 'getPhoneNumber:fail user deny') {
        errorTip = '您取消了授权，请重试';
      } else if (errMsg === 'getPhoneNumber:fail user not agree privacy authorization') {
        errorTip = '请先同意隐私协议';
      } else if (errMsg && errMsg.includes('timeout')) {
        errorTip = '网络超时，请检查网络后重试';
      }
      console.error('获取手机号失败:', errMsg);
      app.toast(errorTip);
      return;
    }

    if (!code) {
      app.toast('授权失败，请检查微信版本后重试');
      return;
    }

    wx.showLoading({ title: '登录中...' });

    try {
      // 先用 wx.login 获取 code 确保 session 有效
      const loginRes = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout')), 10000);
        wx.login({
          success: resolve,
          fail: reject
        });
      });

      const res = await app.request({
        url: '/api/auth/phone-login',
        method: 'POST',
        data: {
          phone_code: code,
          login_code: loginRes.code
        }
      });

      wx.hideLoading();

      if (res.code === 0) {
        wx.setStorageSync('token', res.data.token);
        if (res.data.openid) wx.setStorageSync('openid', res.data.openid);

        const userInfo = res.data.userInfo || {};
        wx.setStorageSync('userInfo', userInfo);
        app.globalData.userInfo = userInfo;
        app.globalData.isBindAccount = res.data.isBind || false;

        wx.showModal({
          title: '登录成功',
          content: res.data.isBind ? '欢迎使用智慧校园' : '登录成功，请绑定教务账号完善功能',
          showCancel: false,
          success: () => {
            if (res.data.isBind) {
              wx.switchTab({ url: '/pages/index/index' });
            } else {
              wx.navigateTo({ url: '/pages/bind-account/bind-account' });
            }
          }
        });

        this.setData({ isBindAccount: res.data.isBind || false, userInfo });
      } else {
        app.toast(res.message || '登录失败，请稍后重试');
      }
    } catch (err) {
      wx.hideLoading();
      console.error('手机号登录失败:', err);
      wx.showModal({
        title: '登录失败',
        content: '请确保手机和电脑在同一 WiFi 网络下，且后端已启动',
        showCancel: false
      });
    }
  },

  goPage(e) {
    const page = e.currentTarget.dataset.page;
    const pageMap = {
      schedule: '/pages/schedule/schedule',
      score: '/pages/score/score',
      exam: '/pages/exam/exam',
      'empty-classroom': '/pages/empty-classroom/empty-classroom',
      'lost-found': '/pages/lost-found/lost-found',
      delivery: '/pages/delivery/delivery',
      shopping: '/pages/shopping/shopping',
      orders: '/pages/orders/orders',
      community: '/pages/community/community',
      'campus-map': '/pages/campus-map/campus-map'
    };

    if (pageMap[page]) {
      const url = pageMap[page];
      const tabPages = new Set([
        '/pages/index/index',
        '/pages/ai-chat/ai-chat',
        '/pages/schedule/schedule',
        '/pages/community/community',
        '/pages/profile/profile'
      ]);

      if (tabPages.has(url)) {
        wx.switchTab({ url });
      } else {
        wx.navigateTo({ url });
      }
    }
  },

  goAIChat() {
    wx.switchTab({
      url: '/pages/ai-chat/ai-chat'
    });
  },

  askTopic(e) {
    const topic = e.currentTarget.dataset.topic;
    // Tab 页无法可靠传参，这里用缓存做“待发送问题”
    wx.setStorageSync('ai_pending_question', topic);
    wx.switchTab({ url: '/pages/ai-chat/ai-chat' });
  },

  async setReminder(e) {
    const index = e.currentTarget.dataset.index;
    const schedule = this.data.todaySchedule[index];

    try {
      const res = await app.request({
        url: '/api/schedule/reminder',
        method: 'POST',
        data: {
          courseId: schedule.courseId,
          classTime: schedule.startTime,
          location: schedule.location
        }
      });

      if (res.code === 0) {
        app.toast('提醒设置成功');
        this.setData({
          [`todaySchedule[${index}].needReminder`]: false
        });
      } else {
        app.toast(res.message || '设置失败');
      }
    } catch (err) {
      console.error('设置提醒失败:', err);
      app.toast('提醒设置成功');
      this.setData({
        [`todaySchedule[${index}].needReminder`]: false
      });
    }
  },

  goProductDetail(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/product-detail/product-detail?id=${id}`
    });
  }
});
