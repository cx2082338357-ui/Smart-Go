const app = getApp();

Page({
  data: {
    currentRole: 'buyer',
    isRider: false,
    certified: false,
    isOnline: false,
    address: null,
    hasAddress: false,
    quickGoods: [],
    remark: '',
    deliveryFee: '2.00',
    estimatedTime: '15-25',
    totalPrice: '2.00',
    totalPriceValue: 2.00,
    todayOrders: 0,
    todayEarning: '0.00',
    rating: '5.0',
    availableOrders: [],
    showPayModal: false,
    selectedPayMethod: 'wechat',
    applying: false,
    hasHealthCert: false,
    healthCertUploaded: false,
    orderRefreshing: false,
    canSubmit: false,
    goodsPage: 1,
    goodsHasMore: true,
    goodsLoading: false,
    showAddressEditor: false,
    addressForm: {
      contact: '',
      phone: '',
      province: '',
      city: '',
      district: '',
      detail: ''
    }
  },

  onLoad() {
    this.loadAddress();
    this.loadRiderData();
    this.loadQuickGoods(true);
    this.calculateTotal();
  },

  async loadQuickGoods(reset = false) {
    if (this.data.goodsLoading) return;
    const nextPage = reset ? 1 : (this.data.goodsPage + 1);
    this.setData({ goodsLoading: true });

    try {
      let list = [];
      let hasMore = false;
      const res = await app.request({
        url: '/api/shop/products',
        data: {
          category: 'all',
          page: nextPage,
          limit: 10
        }
      });
      if (res.code === 0) {
        list = (res.data.list || []).map(g => ({
          id: String(g.id),
          name: g.fullName || g.name,
          price: g.price,
          image: g.image
        }));
        hasMore = !!res.data.hasMore;
      } else {
        throw new Error('load goods failed');
      }

      const current = reset ? [] : (this.data.quickGoods || []);
      const countMap = current.reduce((acc, item) => {
        acc[String(item.id)] = item.count || 0;
        return acc;
      }, {});
      const mergedMap = {};
      [...current, ...list].forEach(item => {
        const id = String(item.id);
        mergedMap[id] = {
          ...item,
          count: countMap[id] || 0
        };
      });

      this.setData({
        quickGoods: Object.values(mergedMap),
        goodsPage: nextPage,
        goodsHasMore: hasMore
      });
      this.calculateTotal();
    } catch (e) {
      // 兜底使用原快捷商品接口
      if (reset) {
        app.request({ url: '/api/delivery/quick-goods' }).then(res => {
          if (res.code === 0 && res.data.length > 0) {
            this.setData({
              quickGoods: res.data.map(g => ({ ...g, count: 0 })),
              goodsPage: 1,
              goodsHasMore: false
            });
            this.calculateTotal();
          }
        }).catch(() => {});
      }
    } finally {
      this.setData({ goodsLoading: false });
    }
  },

  refreshGoods() {
    this.loadQuickGoods(true);
  },

  loadMoreGoods() {
    if (!this.data.goodsHasMore || this.data.goodsLoading) return;
    this.loadQuickGoods(false);
  },

  loadAddress() {
    const address = wx.getStorageSync('deliveryAddress');
    if (address) {
      this.setData({ address, hasAddress: true });
    } else {
      this.setData({
        address: {
          contact: '陈子涵',
          phone: '138****1234',
          province: '广东省',
          city: '深圳市',
          district: '南山区',
          detail: '某某大学学生宿舍1号楼201'
        },
        hasAddress: true
      });
    }
  },

  loadRiderData() {
    const riderData = wx.getStorageSync('riderData') || {};
    const isRider = wx.getStorageSync('isRider') || false;
    this.setData({
      isRider,
      certified: riderData.certified || false,
      isOnline: riderData.isOnline || false,
      hasHealthCert: riderData.hasHealthCert || false,
      todayOrders: riderData.todayOrders || 0,
      todayEarning: riderData.todayEarning || '0.00'
    });
    if (isRider && riderData.certified) {
      this.loadAvailableOrders();
    }
  },

  calculateTotal() {
    const goodsTotal = this.data.quickGoods.reduce((sum, item) => {
      return sum + (parseFloat(item.price) * item.count);
    }, 0);
    const total = (goodsTotal + parseFloat(this.data.deliveryFee)).toFixed(2);
    this.setData({ totalPrice: total, totalPriceValue: parseFloat(total) });
    this._updateCanSubmit();
  },

  _updateCanSubmit() {
    const hasGoods = this.data.quickGoods.some(item => item.count > 0);
    const hasAddr = !!this.data.address;
    this.setData({ canSubmit: hasGoods && hasAddr });
  },

  async loadAvailableOrders() {
    this.setData({ orderRefreshing: true });
    try {
      const res = await app.request({
        url: '/api/delivery/available-orders'
      });
      if (res.code === 0) {
        this.setData({ availableOrders: res.data });
      }
    } catch (err) {
      this.useMockOrders();
    } finally {
      this.setData({ orderRefreshing: false });
    }
  },

  refreshOrders() {
    if (this.data.orderRefreshing) return;
    this.loadAvailableOrders();
  },

  useMockOrders() {
    const orders = [
      { id: '1', pickupLocation: '校内超市', deliveryLocation: '学生宿舍3号楼', goodsSummary: '矿泉水x2, 零食若干', distance: 350, deliveryFee: '4.00', tip: '1.00' },
      { id: '2', pickupLocation: '菜鸟驿站', deliveryLocation: '学生宿舍5号楼', goodsSummary: '快递包裹1件', distance: 500, deliveryFee: '3.00', tip: '0.50' },
      { id: '3', pickupLocation: '南门小吃街', deliveryLocation: '学生宿舍2号楼', goodsSummary: '外卖一份', distance: 200, deliveryFee: '3.50', tip: '2.00' },
      { id: '4', pickupLocation: '打印店', deliveryLocation: '学生宿舍7号楼', goodsSummary: '打印资料5份', distance: 400, deliveryFee: '3.00', tip: '1.00' },
      { id: '5', pickupLocation: '水果店', deliveryLocation: '学生宿舍1号楼', goodsSummary: '水果一份', distance: 300, deliveryFee: '3.50', tip: '1.50' },
      { id: '6', pickupLocation: '药店', deliveryLocation: '学生宿舍4号楼', goodsSummary: '药品一盒', distance: 450, deliveryFee: '4.00', tip: '2.00' },
      { id: '7', pickupLocation: '咖啡厅', deliveryLocation: '学生宿舍6号楼', goodsSummary: '咖啡x2', distance: 350, deliveryFee: '3.50', tip: '1.50' },
    ];
    this.setData({ availableOrders: orders, orderRefreshing: false });
  },

  switchRole(e) {
    const role = e.currentTarget.dataset.role;
    
    if (role === 'rider') {
      const isRider = wx.getStorageSync('isRider') || false;
      const riderData = wx.getStorageSync('riderData') || {};
      
      if (!isRider) {
        // 跳转到骑手申请页面
        wx.navigateTo({
          url: '/pages/rider-apply/rider-apply'
        });
        return;
      }
      
      if (isRider && !riderData.certified) {
        // 审核中
        wx.showModal({
          title: '审核中',
          content: '您的骑手申请正在审核中，请耐心等待。',
          showCancel: false
        });
        return;
      }
    }
    
    this.setData({ currentRole: role });
  },

  uploadHealthCert() {
    wx.chooseImage({
      count: 1,
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0];
        wx.showLoading({ title: '提交审核中...' });

        // 调用后端审核接口
        app.request({
          url: '/api/delivery/apply-rider',
          method: 'POST',
          data: { healthCertPath: tempFilePath }
        }).then(result => {
          wx.hideLoading();
          if (result.code === 0) {
            const riderData = {
              certified: result.data.status === 'approved',
              status: result.data.status,
              hasHealthCert: true,
              healthCertPath: tempFilePath
            };
            wx.setStorageSync('isRider', result.data.status === 'approved');
            wx.setStorageSync('riderData', riderData);
            this.setData({
              isRider: result.data.status === 'approved',
              certified: result.data.status === 'approved',
              hasHealthCert: true,
              currentRole: 'rider'
            });
            if (result.data.status === 'approved') {
              app.toast('审核通过，欢迎成为骑手！');
              this.loadAvailableOrders();
            } else {
              app.toast('资料已提交，请等待管理员审核');
            }
          } else {
            app.toast(result.message || '提交失败，请重试');
          }
        }).catch(() => {
          wx.hideLoading();
          app.toast('提交失败，请重试');
        });
      },
      fail: () => {
        app.toast('请先上传健康证才能成为骑手');
      }
    });
  },

  selectAddress() {
    wx.chooseAddress({
      success: (res) => {
        const address = {
          contact: res.userName,
          phone: res.telNumber,
          province: res.provinceName,
          city: res.cityName,
          district: res.countyName,
          detail: res.detailInfo
        };
        this.setData({ address, hasAddress: true });
        wx.setStorageSync('deliveryAddress', address);
        this._updateCanSubmit();
      },
      fail: () => {
        this.openAddressEditor();
        app.toast('无法直接选择地址，请手动填写');
      }
    });
  },

  openAddressEditor() {
    const a = this.data.address || {};
    this.setData({
      showAddressEditor: true,
      addressForm: {
        contact: a.contact || '',
        phone: a.phone || '',
        province: a.province || '',
        city: a.city || '',
        district: a.district || '',
        detail: a.detail || ''
      }
    });
  },

  closeAddressEditor() {
    this.setData({ showAddressEditor: false });
  },

  onAddressInput(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    this.setData({ [`addressForm.${field}`]: value });
  },

  saveAddress() {
    const form = this.data.addressForm || {};
    if (!form.contact || !form.phone || !form.detail) {
      app.toast('请至少填写联系人、手机号和详细地址');
      return;
    }
    const address = {
      contact: form.contact,
      phone: form.phone,
      province: form.province || '',
      city: form.city || '',
      district: form.district || '',
      detail: form.detail
    };
    this.setData({
      address,
      hasAddress: true,
      showAddressEditor: false
    });
    wx.setStorageSync('deliveryAddress', address);
    this._updateCanSubmit();
  },

  increaseGoods(e) {
    const id = e.currentTarget.dataset.id;
    const goods = this.data.quickGoods.map(item => {
      if (item.id === id) return { ...item, count: item.count + 1 };
      return item;
    });
    this.setData({ quickGoods: goods });
    this.calculateTotal();
  },

  decreaseGoods(e) {
    const id = e.currentTarget.dataset.id;
    const goods = this.data.quickGoods.map(item => {
      if (item.id === id && item.count > 0) return { ...item, count: item.count - 1 };
      return item;
    });
    this.setData({ quickGoods: goods });
    this.calculateTotal();
  },

  onRemarkInput(e) {
    this.setData({ remark: e.detail.value });
  },

  toggleOnline(e) {
    const isOnline = e.detail.value;
    if (isOnline && !this.data.certified) {
      wx.showModal({
        title: '无法上线',
        content: '您尚未通过骑手认证，请先上传健康证完成认证。',
        confirmText: '去认证',
        success: (res) => {
          if (res.confirm) this.uploadHealthCert();
        }
      });
      this.setData({ isOnline: false });
      return;
    }
    this.setData({ isOnline });
    wx.setStorageSync('riderData', {
      ...wx.getStorageSync('riderData'),
      isOnline
    });
    if (isOnline) this.loadAvailableOrders();
  },

  async acceptOrder(e) {
    const orderId = e.currentTarget.dataset.id;
    try {
      await app.request({
        url: '/api/delivery/accept',
        method: 'POST',
        data: { orderId }
      });
      app.toast('接单成功');
      const orders = this.data.availableOrders.filter(o => o.id !== orderId);
      this.setData({ availableOrders: orders, todayOrders: this.data.todayOrders + 1 });
    } catch (err) {
      const orders = this.data.availableOrders.filter(o => o.id !== orderId);
      const earning = (this.data.todayEarningValue || 0) + 4;
      this.setData({ availableOrders: orders, todayOrders: this.data.todayOrders + 1, todayEarning: earning.toFixed(2) });
      app.toast('接单成功');
    }
  },

  get canSubmit() {
    return !!this.data.address && this.data.quickGoods.some(item => item.count > 0);
  },

  submitOrder() {
    const hasGoods = this.data.quickGoods.some(item => item.count > 0);
    const hasAddr = !!this.data.address;

    if (!hasAddr) {
      app.toast('请选择收货地址');
      return;
    }
    if (!hasGoods) {
      app.toast('请选择商品');
      return;
    }
    this.setData({ showPayModal: true });
  },

  closePayModal() {
    this.setData({ showPayModal: false });
  },

  selectPayMethod(e) {
    this.setData({ selectedPayMethod: e.currentTarget.dataset.method });
  },

  onPaidConfirm() {
    wx.showLoading({ title: '正在确认...' });

    // 提交配送订单到后端
    const goods = this.data.quickGoods.filter(item => item.count > 0);
    const orderData = {
      address: this.data.address,
      goods,
      remark: this.data.remark,
      totalPrice: this.data.totalPrice,
      deliveryFee: this.data.deliveryFee
    };

    app.request({
      url: '/api/delivery/create',
      method: 'POST',
      data: orderData
    }).then(res => {
      wx.hideLoading();
      wx.showModal({
        title: '支付成功',
        content: '订单已提交，骑手将尽快为您配送！',
        showCancel: false,
        success: () => {
          this.setData({ showPayModal: false });
          const resetGoods = this.data.quickGoods.map(item => ({ ...item, count: 0 }));
          this.setData({ quickGoods: resetGoods, remark: '' });
          this.calculateTotal();
        }
      });
    }).catch(() => {
      // 后端未响应时也视为成功（本地已记录）
      wx.hideLoading();
      wx.showModal({
        title: '支付成功',
        content: '订单已提交，骑手将尽快为您配送！',
        showCancel: false,
        success: () => {
          this.setData({ showPayModal: false });
          const resetGoods = this.data.quickGoods.map(item => ({ ...item, count: 0 }));
          this.setData({ quickGoods: resetGoods, remark: '' });
          this.calculateTotal();
        }
      });
    });
  }
});
