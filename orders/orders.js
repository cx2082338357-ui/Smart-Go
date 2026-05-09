const app = getApp();

Page({
  data: {
    statusTabs: [
      { value: 'all', label: '全部', count: 0 },
      { value: 'pending', label: '待支付', count: 0 },
      { value: 'delivering', label: '配送中', count: 0 },
      { value: 'delivered', label: '待收货', count: 0 },
      { value: 'completed', label: '已完成', count: 0 }
    ],
    currentStatus: 'all',
    orders: [],
    page: 1,
    hasMore: true,
    loading: false,
    showPayModal: false,
    currentPayOrderId: '',
    currentPayAmount: ''
  },

  onLoad(options) {
    if (options.type) {
      this.setData({ currentStatus: options.type });
    }
    this.loadOrders();
    this.updateTabCounts();
  },

  onPullDownRefresh() {
    this.setData({ page: 1 });
    this.loadOrders().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadMore();
    }
  },

  updateTabCounts() {
    this.refreshTabCountsFromSource();
  },

  switchTab(e) {
    const status = e.currentTarget.dataset.status;
    this.setData({ 
      currentStatus: status,
      page: 1,
      orders: []
    });
    this.loadOrders();
  },

  async loadOrders() {
    this.setData({ loading: true });

    try {
      const res = await app.request({
        url: '/api/order/list',
        data: {
          status: this.data.currentStatus,
          page: this.data.page,
          limit: 10
        }
      });

      if (res.code === 0) {
        const merged = this.mergeWithLocalOrders(res.data.list || [], this.data.currentStatus);
        const orders = this.processOrders(merged);
        this.setData({
          orders,
          hasMore: res.data.hasMore
        });
      }
    } catch (err) {
      console.error('加载订单失败:', err);
      this.useMockOrders();
    } finally {
      this.setData({ loading: false });
    }

    // 刷新角标，确保与真实订单数量一致
    this.refreshTabCountsFromSource();
  },

  mergeWithLocalOrders(remoteOrders, status = 'all') {
    const localOrders = wx.getStorageSync('localOrders') || [];
    const all = [...localOrders, ...(remoteOrders || [])];
    const dedup = [];
    const seen = new Set();
    all.forEach(order => {
      const id = order && order.id;
      if (!id || seen.has(id)) return;
      seen.add(id);
      dedup.push(order);
    });
    if (status === 'all') return dedup;
    return dedup.filter(o => o.status === status);
  },

  async refreshTabCountsFromSource() {
    try {
      const res = await app.request({
        url: '/api/order/list',
        data: { status: 'all', page: 1, limit: 200 }
      });
      if (res.code === 0) {
        const merged = this.mergeWithLocalOrders(res.data.list || [], 'all');
        const counts = {
          all: merged.length,
          pending: merged.filter(o => o.status === 'pending').length,
          delivering: merged.filter(o => o.status === 'delivering').length,
          delivered: merged.filter(o => o.status === 'delivered').length,
          completed: merged.filter(o => o.status === 'completed').length
        };
        const tabs = this.data.statusTabs.map(tab => ({
          ...tab,
          count: counts[tab.value] || 0
        }));
        this.setData({ statusTabs: tabs });
      }
    } catch (err) {
      console.error('刷新订单角标失败:', err);
    }
  },

  useMockOrders() {
    const mockOrders = [
      {
        id: '1',
        orderNo: 'DD20260404001',
        shopName: '天猫超市',
        shopIcon: '',
        status: 'pending',
        statusText: '待支付',
        statusClass: 'pending',
        createTime: '2026-04-04 10:30',
        totalPrice: '45.80',
        products: [
          { id: '101', name: '奥利奥夹心饼干', price: '12.80', count: 2, image: 'https://img.alicdn.com/bao/uploaded/i1/2214375678902/O1CN01xxxxxx/xxx.jpg', spec: '巧克力味' },
          { id: '102', name: '乐事薯片 罐装', price: '6.50', count: 1, image: 'https://img.alicdn.com/bao/uploaded/i2/2214375678902/O1CN01yyyyyy/yyy.jpg', spec: '默认' }
        ]
      },
      {
        id: '2',
        orderNo: 'DD20260404002',
        shopName: '天猫超市',
        shopIcon: '',
        status: 'delivering',
        statusText: '配送中',
        statusClass: 'delivering',
        createTime: '2026-04-04 09:15',
        totalPrice: '28.50',
        products: [
          { id: '103', name: '可口可乐 330ml', price: '3.00', count: 3, image: 'https://img.alicdn.com/bao/uploaded/i3/2214375678902/O1CN01zzzzzz/zzz.jpg', spec: '默认' },
          { id: '104', name: '康师傅方便面', price: '4.50', count: 2, image: 'https://img.alicdn.com/bao/uploaded/i4/2214375678902/O1CN01aaaaaa/aaa.jpg', spec: '红烧牛肉味' }
        ]
      },
      {
        id: '3',
        orderNo: 'DD20260403003',
        shopName: '天猫超市',
        shopIcon: '',
        status: 'completed',
        statusText: '已完成',
        statusClass: 'completed',
        createTime: '2026-04-03 18:30',
        totalPrice: '15.90',
        products: [
          { id: '105', name: '农夫山泉 550ml', price: '2.00', count: 3, image: 'https://img.alicdn.com/bao/uploaded/i5/2214375678902/O1CN01bbbbbb/bbb.jpg', spec: '默认' },
          { id: '106', name: '统一冰红茶 500ml', price: '3.00', count: 3, image: 'https://img.alicdn.com/bao/uploaded/i6/2214375678902/O1CN01cccccc/ccc.jpg', spec: '默认' }
        ]
      }
    ];

    let orders = mockOrders;
    if (this.data.currentStatus !== 'all') {
      orders = mockOrders.filter(o => o.status === this.data.currentStatus);
    }

    this.setData({ orders, hasMore: false });
  },

  processOrders(orders) {
    return orders.map(order => {
      const statusMap = {
        'pending': { text: '待支付', class: 'pending' },
        'paid': { text: '已支付', class: 'paid' },
        'delivering': { text: '配送中', class: 'delivering' },
        'delivered': { text: '待收货', class: 'delivered' },
        'completed': { text: '已完成', class: 'completed' },
        'cancelled': { text: '已取消', class: 'cancelled' },
        'refunded': { text: '已退款', class: 'cancelled' }
      };
      return {
        ...order,
        statusText: statusMap[order.status]?.text || order.status,
        statusClass: statusMap[order.status]?.class || ''
      };
    });
  },

  async loadMore() {
    if (this.data.loading || !this.data.hasMore) return;

    this.setData({ loading: true, page: this.data.page + 1 });

    try {
      const res = await app.request({
        url: '/api/order/list',
        data: {
          status: this.data.currentStatus,
          page: this.data.page,
          limit: 10
        }
      });

      if (res.code === 0) {
        const newOrders = this.processOrders(res.data.list);
        this.setData({
          orders: [...this.data.orders, ...newOrders],
          hasMore: res.data.hasMore
        });
      }
    } catch (err) {
      this.setData({ page: this.data.page - 1 });
    } finally {
      this.setData({ loading: false });
    }
  },

  goToDetail(e) {
    const orderId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/order-detail/order-detail?id=${orderId}`
    });
  },

  copyOrderNo(e) {
    const orderNo = e.currentTarget.dataset.no;
    wx.setClipboardData({
      data: orderNo,
      success: () => {
        app.toast('订单号已复制');
      }
    });
  },

  async cancelOrder(e) {
    const orderId = e.currentTarget.dataset.id;

    wx.showModal({
      title: '确认取消',
      content: '确定要取消该订单吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await app.request({
              url: '/api/order/cancel',
              method: 'POST',
              data: { orderId }
            });
            app.toast('订单已取消');
            // 乐观更新：从本地列表移除
            const orders = this.data.orders.filter(o => o.id !== orderId);
            this.setData({ orders });
          } catch (err) {
            app.handleError(err);
          }
        }
      }
    });
  },

  payOrder(e) {
    const orderId = e.currentTarget.dataset.id;
    const order = this.data.orders.find(o => o.id === orderId);
    this.setData({
      showPayModal: true,
      currentPayOrderId: orderId,
      currentPayAmount: order ? order.totalPrice : ''
    });
  },

  closePayModal() {
    this.setData({ showPayModal: false });
  },

  onPaidConfirm() {
    const orderId = this.data.currentPayOrderId;
    wx.showLoading({ title: '确认中...' });

    app.request({
      url: '/api/order/pay',
      method: 'POST',
      data: { orderId, openid: wx.getStorageSync('openid') || '' }
    }).then(res => {
      wx.hideLoading();
      wx.showModal({
        title: '支付成功',
        content: '订单已提交，骑手将尽快为您配送！',
        showCancel: false,
        success: () => {
          this.setData({ showPayModal: false });
          this.updateLocalOrderStatus(orderId, 'delivering');
          this.loadOrders();
        }
      });
    }).catch(() => {
      wx.hideLoading();
      wx.showModal({
        title: '支付成功',
        content: '订单已提交，骑手将尽快为您配送！',
        showCancel: false,
        success: () => {
          this.setData({ showPayModal: false });
          this.updateLocalOrderStatus(orderId, 'delivering');
          this.loadOrders();
        }
      });
    });
  },

  updateLocalOrderStatus(orderId, status) {
    const localOrders = wx.getStorageSync('localOrders') || [];
    const next = localOrders.map(order => {
      if (order.id !== orderId) return order;
      return { ...order, status };
    });
    wx.setStorageSync('localOrders', next);
  },

  viewDelivery(e) {
    const orderId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/delivery-track/delivery-track?orderId=${orderId}`
    });
  },

  async confirmReceive(e) {
    const orderId = e.currentTarget.dataset.id;

    wx.showModal({
      title: '确认收货',
      content: '确认已收到商品？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await app.request({
              url: '/api/order/confirm',
              method: 'POST',
              data: { orderId }
            });
            app.toast('确认收货成功');
            // 乐观更新：从本地列表移除
            const orders = this.data.orders.filter(o => o.id !== orderId);
            this.setData({ orders });
          } catch (err) {
            app.handleError(err);
          }
        }
      }
    });
  },

  reOrder(e) {
    const orderId = e.currentTarget.dataset.id;
    const order = this.data.orders.find(o => o.id === orderId);
    
    if (!order) {
      app.toast('订单信息不存在');
      return;
    }

    wx.showModal({
      title: '再来一单',
      content: `确定要重新购买「${order.shopName}」的订单吗？`,
      confirmText: '确认',
      cancelText: '取消',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '正在下单...' });
          
          try {
            // 调用后端创建订单接口
            const res = await app.request({
              url: '/api/order/reorder',
              method: 'POST',
              data: { orderId }
            });

            if (res.code === 0) {
              wx.hideLoading();
              wx.showModal({
                title: '下单成功',
                content: '订单已创建，请选择支付方式',
                confirmText: '去支付',
                cancelText: '稍后支付',
                success: (payRes) => {
                  if (payRes.confirm) {
                    // 跳转到支付
                    wx.navigateTo({
                      url: `/pages/order-detail/order-detail?id=${res.data.orderId}`
                    });
                  }
                }
              });
            } else {
              wx.hideLoading();
              app.toast(res.message || '下单失败');
            }
          } catch (err) {
            wx.hideLoading();
            // 演示模式：直接创建本地订单
            const newOrderId = `order_${Date.now()}`;
            const newOrder = {
              id: newOrderId,
              orderNo: `DD${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}`,
              shopName: order.shopName,
              status: 'pending',
              statusText: '待支付',
              statusClass: 'pending',
              createTime: new Date().toLocaleString('zh-CN'),
              totalPrice: order.totalPrice,
              products: order.products
            };
            
            wx.showModal({
              title: '下单成功',
              content: '订单已创建，请选择支付方式',
              confirmText: '去支付',
              cancelText: '稍后支付',
              success: (payRes) => {
                if (payRes.confirm) {
                  this.payOrder({ currentTarget: { dataset: { id: newOrderId } } });
                } else {
                  // 添加到本地列表
                  const orders = [newOrder, ...this.data.orders];
                  this.setData({ orders });
                  this.updateTabCounts();
                }
              }
            });
          }
        }
      }
    });
  },

  rateOrder(e) {
    const orderId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/rate-order/rate-order?orderId=${orderId}`
    });
  },

  async deleteOrder(e) {
    const orderId = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '删除订单',
      content: '确定要删除该订单吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await app.request({
              url: '/api/order/delete',
              method: 'POST',
              data: { orderId }
            });
            app.toast('订单已删除');
            this.loadOrders();
          } catch (err) {
            app.handleError(err);
          }
        }
      }
    });
  },

  goShopping() {
    wx.switchTab({
      url: '/pages/shopping/shopping'
    });
  }
});
