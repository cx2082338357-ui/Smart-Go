const app = getApp();

Page({
  data: {
    order: null,
    loading: true,
    statusMap: {
      'pending': { text: '待支付', class: 'pending' },
      'paid': { text: '已支付', class: 'paid' },
      'delivering': { text: '配送中', class: 'delivering' },
      'delivered': { text: '待收货', class: 'delivered' },
      'completed': { text: '已完成', class: 'completed' },
      'cancelled': { text: '已取消', class: 'cancelled' }
    }
  },

  onLoad(options) {
    const orderId = options.id;
    this.loadOrderDetail(orderId);
  },

  async loadOrderDetail(orderId) {
    this.setData({ loading: true });
    try {
      const res = await app.request({
        url: '/api/order/list',
        data: { status: 'all', page: 1, limit: 50 }
      });

      if (res.code === 0) {
        const localOrders = wx.getStorageSync('localOrders') || [];
        const merged = [...localOrders, ...(res.data.list || [])];
        const seen = new Set();
        const unique = merged.filter(o => {
          if (!o || !o.id || seen.has(o.id)) return false;
          seen.add(o.id);
          return true;
        });
        const order = unique.find(o => o.id === orderId);
        if (order) {
          const sm = this.data.statusMap;
          this.setData({
            order: {
              ...order,
              statusText: sm[order.status]?.text || order.status,
              statusClass: sm[order.status]?.class || ''
            },
            loading: false
          });
        } else {
          this.setData({ loading: false, order: null });
        }
      }
    } catch (err) {
      console.error('加载订单详情失败:', err);
      this.setData({ loading: false, order: null });
    }
  },

  copyOrderNo() {
    const order = this.data.order;
    if (!order) return;
    wx.setClipboardData({
      data: order.orderNo,
      success: () => app.toast('订单号已复制')
    });
  },

  payOrder() {
    const order = this.data.order;
    if (!order) return;
    wx.showModal({
      title: '扫码支付',
      content: `订单金额：¥${order.totalPrice}\n（请使用微信扫码支付）`,
      showCancel: false
    });
  },

  confirmReceive() {
    const order = this.data.order;
    if (!order) return;
    wx.showModal({
      title: '确认收货',
      content: '确认已收到商品？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await app.request({
              url: '/api/order/confirm',
              method: 'POST',
              data: { orderId: order.id }
            });
            app.toast('确认收货成功');
            setTimeout(() => wx.navigateBack(), 1500);
          } catch (err) {
            app.handleError(err);
          }
        }
      }
    });
  },

  reOrder() {
    const order = this.data.order;
    if (!order) return;
    wx.showModal({
      title: '再来一单',
      content: '确定要重新购买该订单？',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '正在下单...' });
          try {
            const r = await app.request({
              url: '/api/order/reorder',
              method: 'POST',
              data: { orderId: order.id }
            });
            wx.hideLoading();
            if (r.code === 0) {
              app.toast('订单已创建');
            } else {
              app.toast(r.message || '下单失败');
            }
          } catch (err) {
            wx.hideLoading();
            app.toast('下单失败');
          }
        }
      }
    });
  }
});
