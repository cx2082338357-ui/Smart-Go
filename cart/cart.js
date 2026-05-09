const app = getApp();

Page({
  data: {
    cartItems: [],
    totalPrice: '0.00',
    selectedAll: false
  },

  onShow() {
    this.loadCart();
  },

  loadCart() {
    const cart = wx.getStorageSync('cart') || [];
    const totalPrice = cart.reduce((sum, item) => {
      return sum + (parseFloat(item.price) * item.count);
    }, 0).toFixed(2);
    this.setData({
      cartItems: cart,
      totalPrice
    });
  },

  increaseItem(e) {
    const index = e.currentTarget.dataset.index;
    const cart = this.data.cartItems;
    cart[index].count++;
    wx.setStorageSync('cart', cart);
    this.loadCart();
    this.updateCartCount();
  },

  decreaseItem(e) {
    const index = e.currentTarget.dataset.index;
    const cart = this.data.cartItems;
    if (cart[index].count > 1) {
      cart[index].count--;
    } else {
      cart.splice(index, 1);
    }
    wx.setStorageSync('cart', cart);
    this.loadCart();
    this.updateCartCount();
  },

  removeItem(e) {
    const index = e.currentTarget.dataset.index;
    const cart = this.data.cartItems;
    cart.splice(index, 1);
    wx.setStorageSync('cart', cart);
    this.loadCart();
    this.updateCartCount();
  },

  updateCartCount() {
    const cart = wx.getStorageSync('cart') || [];
    const count = cart.reduce((sum, item) => sum + item.count, 0);
    const pages = getCurrentPages();
    const shoppingPage = pages.find(p => p.route === 'pages/shopping/shopping');
    if (shoppingPage) {
      shoppingPage.setData({ cartCount: count });
    }
  },

  selectAll() {
    this.setData({ selectedAll: !this.data.selectedAll });
  },

  async checkout() {
    if (this.data.cartItems.length === 0) {
      app.toast('购物车是空的');
      return;
    }

    wx.showLoading({ title: '正在创建订单...' });

    try {
      const res = await app.request({
        url: '/api/shop/create-order',
        method: 'POST',
        data: {
          address: wx.getStorageSync('deliveryAddress') || {
            contact: '当前用户',
            phone: '138****0000',
            detail: '学生宿舍'
          },
          goods: this.data.cartItems.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            count: item.count
          }))
        }
      });

      wx.hideLoading();

      if (res.code === 0) {
        const orderId = (res.data && res.data.orderId) || `local_${Date.now()}`;
        const orderNo = (res.data && res.data.orderNo) || `DD${new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)}`;
        this.persistLocalOrder(orderId, orderNo);
        // 清空购物车后直接进入支付流程
        wx.setStorageSync('cart', []);
        this.loadCart();
        wx.navigateTo({
          url: '/pages/orders/orders?type=pending'
        });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('创建订单失败:', err);
      // 后端异常时前端兜底生成本地订单，保障可支付
      const orderId = `local_${Date.now()}`;
      const orderNo = `DD${new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)}`;
      this.persistLocalOrder(orderId, orderNo);
      wx.setStorageSync('cart', []);
      this.loadCart();
      wx.navigateTo({
        url: '/pages/orders/orders?type=pending'
      });
    }
  },

  persistLocalOrder(orderId, orderNo) {
    const localOrders = wx.getStorageSync('localOrders') || [];
    const order = {
      id: orderId,
      orderNo,
      shopName: '天猫超市',
      shopIcon: '',
      status: 'pending',
      createTime: new Date().toLocaleString('zh-CN', { hour12: false }),
      totalPrice: this.data.totalPrice,
      products: this.data.cartItems.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        count: item.count,
        image: item.image || '',
        spec: item.spec || '默认'
      }))
    };
    const merged = [order, ...localOrders.filter(o => o.id !== orderId)];
    wx.setStorageSync('localOrders', merged);
  }
});
