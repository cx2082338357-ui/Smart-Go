const app = getApp();

Page({
  data: {
    product: null,
    similarProducts: [],
    loading: true,
    selectedSpec: null,
    quantity: 1,
    addedToCart: false
  },

  onLoad(options) {
    const { id } = options;
    if (id) {
      this.loadProductDetail(id);
    }
  },

  async loadProductDetail(productId) {
    this.setData({ loading: true });

    try {
      const res = await app.request({
        url: `/api/shop/product/${productId}`
      });

      if (res.code === 0) {
        const product = res.data;
        // 格式化销量显示
        product.salesText = product.sales > 10000 
          ? (product.sales / 10000).toFixed(1) + '万' 
          : product.sales;
        
        this.setData({
          product,
          loading: false
        });
        
        // 加载相似商品
        if (res.data.similarProducts) {
          this.setData({ similarProducts: res.data.similarProducts });
        }
      } else {
        this.setData({ loading: false });
        app.toast('商品不存在');
        setTimeout(() => wx.navigateBack(), 1500);
      }
    } catch (err) {
      console.error('加载商品详情失败:', err);
      this.setData({ loading: false });
      app.toast('加载失败');
    }
  },

  // 图片预览
  previewImage(e) {
    const { url } = e.currentTarget.dataset;
    const images = this.data.product.images || [this.data.product.image];
    wx.previewImage({
      current: url,
      urls: images
    });
  },

  // 数量增减
  decreaseQty() {
    if (this.data.quantity > 1) {
      this.setData({ quantity: this.data.quantity - 1 });
    }
  },

  increaseQty() {
    const maxStock = this.data.product?.stock || 99;
    if (this.data.quantity < maxStock) {
      this.setData({ quantity: this.data.quantity + 1 });
    } else {
      app.toast('已达最大购买数量');
    }
  },

  // 加入购物车
  addToCart() {
    const { product, quantity } = this.data;
    if (!product) return;

    const cart = wx.getStorageSync('cart') || [];
    const existingItem = cart.find(item => item.id === product.id);
    
    if (existingItem) {
      existingItem.count += quantity;
    } else {
      cart.push({
        id: product.id,
        name: product.name,
        fullName: product.fullName,
        price: product.price,
        image: product.image,
        count: quantity
      });
    }
    
    wx.setStorageSync('cart', cart);
    
    this.setData({ addedToCart: true });
    app.toast('已加入购物车');
    
    setTimeout(() => {
      this.setData({ addedToCart: false });
    }, 2000);
  },

  // 立即购买
  buyNow() {
    const { product, quantity } = this.data;
    if (!product) return;

    // 直接跳转到结算（这里简化处理）
    wx.navigateTo({
      url: '/pages/cart/cart'
    });
  },

  // 跳转相似商品
  goToProduct(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/product-detail/product-detail?id=${id}`
    });
  },

  // 返回
  goBack() {
    wx.navigateBack();
  }
});
