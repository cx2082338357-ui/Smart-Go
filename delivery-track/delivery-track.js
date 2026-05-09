const app = getApp();

Page({
  data: {
    orderId: '',
    order: null,
    deliveryStatus: 'pending',
    riderName: '',
    riderPhone: '',
    eta: '',
    steps: []
  },

  onLoad(options) {
    const { orderId } = options;
    if (!orderId) {
      app.toast('订单信息不存在');
      wx.navigateBack();
      return;
    }
    this.setData({ orderId });
    this.loadDeliveryInfo();
  },

  async loadDeliveryInfo() {
    try {
      // 尝试从本地缓存获取订单信息
      const orders = wx.getStorageSync('deliveryOrders') || [];
      const order = orders.find(o => o.id === this.data.orderId);
      if (order) {
        this.setData({ order });
        this.buildSteps(order.status);
        return;
      }
      // 使用 mock 数据
      this.setData({
        order: {
          id: this.data.orderId,
          shopName: '校内超市',
          pickupLocation: '校内超市（主楼店）',
          deliveryLocation: '学生宿舍3号楼205',
          goodsSummary: '矿泉水 x2、零食若干',
          riderName: '张师傅',
          riderPhone: '13800138000',
          deliveryFee: '4.00'
        },
        deliveryStatus: 'delivering',
        riderName: '张师傅',
        riderPhone: '13800138000',
        eta: '约15分钟',
        steps: [
          { status: 'paid', text: '订单已支付', time: '10:30', done: true },
          { status: 'accepted', text: '骑手已接单', time: '10:32', done: true },
          { status: 'picked', text: '骑手已取货', time: '10:40', done: true },
          { status: 'delivering', text: '配送中，预计15分钟', time: '10:40', done: true, current: true },
          { status: 'completed', text: '已送达', time: '--:--', done: false }
        ]
      });
    } catch (err) {
      app.toast('加载配送信息失败');
    }
  },

  buildSteps(status) {
    const statusOrder = ['paid', 'accepted', 'picked', 'delivering', 'completed'];
    const currentIndex = statusOrder.indexOf(status);
    const now = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    this.setData({
      steps: statusOrder.map((s, i) => ({
        status: s,
        text: this.stepText(s),
        time: i <= currentIndex ? now : '--:--',
        done: i <= currentIndex,
        current: i === currentIndex && status !== 'completed'
      }))
    });
  },

  stepText(status) {
    const map = {
      paid: '订单已支付',
      accepted: '骑手已接单',
      picked: '骑手已取货',
      delivering: '配送中',
      completed: '已送达'
    };
    return map[status] || status;
  },

  callRider() {
    wx.makePhoneCall({
      phoneNumber: this.data.riderPhone,
      fail: () => {
        app.toast('拨打失败');
      }
    });
  }
});
