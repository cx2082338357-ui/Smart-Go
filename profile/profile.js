const app = getApp();

Page({
  data: {
    isBindAccount: false,
    isRider: false,
    userInfo: null,
    stats: {
      credits: 0,
      gpa: '0.00',
      rank: '--'
    },
    orderTabs: [
      { type: 'pending', name: '待支付', icon: '/assets/icons/pending.png', count: 0 },
      { type: 'delivering', name: '配送中', icon: '/assets/icons/delivering.png', count: 0 },
      { type: 'completed', name: '已完成', icon: '/assets/icons/completed.png', count: 0 },
      { type: 'refund', name: '退款/售后', icon: '/assets/icons/refund.png', count: 0 }
    ]
  },

  onLoad() {
    this.checkUserStatus();
  },

  onShow() {
    this.checkUserStatus();
    this.loadOrderCounts();
  },

  checkUserStatus() {
    const isBindAccount = app.globalData.isBindAccount;
    const userInfo = app.globalData.userInfo;
    const isRider = wx.getStorageSync('isRider') || false;

    this.setData({
      isBindAccount,
      userInfo,
      isRider
    });

    if (isBindAccount) {
      this.loadUserStats();
    }
  },

  async loadUserStats() {
    try {
      const res = await app.request({
        url: '/api/user/stats'
      });

      if (res.code === 0) {
        this.setData({ stats: res.data });
      }
    } catch (err) {
      console.error('加载用户统计失败:', err);
      this.useMockStats();
    }
  },

  useMockStats() {
    this.setData({
      stats: {
        credits: 92,
        gpa: '3.72',
        rank: '前15%'
      }
    });
  },

  async loadOrderCounts() {
    try {
      const res = await app.request({
        url: '/api/order/counts'
      });

      if (res.code === 0) {
        const orderTabs = this.data.orderTabs.map(tab => ({
          ...tab,
          count: res.data[tab.type] || 0
        }));
        this.setData({ orderTabs });
      }
    } catch (err) {
      console.error('加载订单数量失败:', err);
      this.useMockOrderCounts();
    }
  },

  useMockOrderCounts() {
    const orderTabs = this.data.orderTabs.map((tab, index) => ({
      ...tab,
      count: index === 0 ? 2 : 0
    }));
    this.setData({ orderTabs });
  },

  goBindAccount() {
    wx.navigateTo({
      url: '/pages/bind-account/bind-account'
    });
  },

  goToOrders(e) {
    const type = e.currentTarget.dataset.type || '';
    wx.navigateTo({
      url: `/pages/orders/orders?type=${type}`
    });
  },

  goToPage(e) {
    const page = e.currentTarget.dataset.page;
    const pageMap = {
      'bind-account': '/pages/bind-account/bind-account',
      'schedule-reminder': '/pages/schedule-reminder/schedule-reminder',
      'lost-found': '/pages/lost-found/lost-found',
      'delivery': '/pages/delivery/delivery',
      'delivery-apply': '/pages/delivery-apply/delivery-apply',
      'settings': '/pages/settings/settings',
      'feedback': '/pages/feedback/feedback',
      'about': '/pages/about/about'
    };

    if (pageMap[page]) {
      wx.navigateTo({ url: pageMap[page] });
    }
  },

  callService() {
    wx.makePhoneCall({
      phoneNumber: '400-xxx-xxxx',
      fail: () => {
        app.toast('客服电话：400-xxx-xxxx');
      }
    });
  },

  logout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('token');
          wx.removeStorageSync('userInfo');
          app.globalData.isBindAccount = false;
          app.globalData.userInfo = null;
          this.setData({
            isBindAccount: false,
            userInfo: null,
            stats: { credits: 0, gpa: '0.00', rank: '--' }
          });
          app.toast('已退出登录');
        }
      }
    });
  }
});
