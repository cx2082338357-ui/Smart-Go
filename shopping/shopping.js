const app = getApp();

Page({
  data: {
    categories: [],
    selectedCategory: '零食',
    products: [],
    hasMore: true,
    page: 1,
    loading: false,
    cartCount: 0,
    searchKeyword: '',
    total: 0,
    networkError: false
  },

  onLoad() {
    this.loadCategories();
    this.loadProducts();
    this.updateCartCount();
  },

  onPullDownRefresh() {
    this.setData({ page: 1 });
    Promise.all([
      this.loadCategories(),
      this.loadProducts()
    ]).finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  onShow() {
    this.updateCartCount();
  },

  updateCartCount() {
    const cart = wx.getStorageSync('cart') || [];
    const count = cart.reduce((sum, item) => sum + item.count, 0);
    this.setData({ cartCount: count });
  },

  async loadCategories() {
    try {
      const res = await app.request({
        url: '/api/shop/categories'
      });

      if (res.code === 0 && res.data.length > 0) {
        const catEmojiMap = {
          'all': '📦', '全部': '📦',
          '零食': '🍪', 'snacks': '🍪',
          '杯壶': '🥤', 'cups': '🥤',
          '饮料': '🧃', 'drinks': '🧃',
          '糕点': '🍰', '面包': '🍞', 'cake': '🍰',
          '坚果': '🌰', 'nuts': '🌰',
        };
        const categories = res.data.map(cat => ({
          ...cat,
          emoji: catEmojiMap[cat.id] || catEmojiMap[cat.name] || '📁'
        }));
        this.setData({ categories });
      }
    } catch (err) {
      console.error('加载分类失败:', err);
      // 使用零食相关默认分类
      this.setData({
        categories: [
          { id: 'all', name: '全部', count: 1131 },
          { id: '零食', name: '零食', count: 300 },
          { id: '饮料', name: '饮料', count: 200 },
          { id: '糕点', name: '糕点', count: 150 },
          { id: '坚果', name: '坚果', count: 120 },
          { id: '糖果', name: '糖果', count: 100 },
          { id: '肉脯', name: '肉脯', count: 80 }
        ]
      });
    }
  },

  async loadProducts() {
    this.setData({ loading: true });

    try {
      const res = await app.request({
        url: '/api/shop/products',
        data: {
          category: this.data.selectedCategory,
          keyword: this.data.searchKeyword,
          page: this.data.page,
          limit: 20
        }
      });

      if (res.code === 0) {
        // 格式化销量显示
        const products = res.data.list.map(p => ({
          ...p,
          salesText: p.sales > 10000 
            ? (p.sales / 10000).toFixed(1) + '万' 
            : p.sales
        }));
        
        this.setData({
          products,
          hasMore: res.data.hasMore,
          total: res.data.total,
          networkError: false
        });
      } else {
        this.setData({ products: [], networkError: true, hasMore: false });
        app.toast(res.message || '商品加载失败');
      }
    } catch (err) {
      console.error('加载商品失败:', err);
      const hint = err.errMsg || err.message || '网络异常';
      this.setData({ products: [], networkError: true, hasMore: false, total: 0 });
      if (this.data.page === 1) {
        wx.showModal({
          title: '无法加载商品',
          content: `1. 开发者工具：详情 → 本地设置 → 勾选「不校验合法域名、web-view、TLS 及 HTTPS 证书」\n2. 使用 cloudflare tunnel 时：电脑需运行 python main.py 与 cloudflared tunnel，且 app.js 中 apiBaseUrl 与 tunnel 地址一致\n3. 真机预览：须在微信公众平台配置 request 合法域名（cloudflare 子域名）\n\n错误：${hint}`,
          showCancel: false
        });
      } else {
        app.toast(hint);
      }
    } finally {
      this.setData({ loading: false });
    }
  },

  selectCategory(e) {
    const categoryId = e.currentTarget.dataset.id;
    this.setData({
      selectedCategory: categoryId,
      page: 1
    });
    this.loadProducts();
  },

  onSearch(e) {
    const keyword = e.detail.value;
    this.setData({
      searchKeyword: keyword,
      page: 1
    });
    this.loadProducts();
  },

  async loadMore() {
    if (this.data.loading || !this.data.hasMore) return;

    this.setData({ loading: true, page: this.data.page + 1 });

    try {
      const res = await app.request({
        url: '/api/shop/products',
        data: {
          category: this.data.selectedCategory,
          keyword: this.data.searchKeyword,
          page: this.data.page,
          limit: 20
        }
      });

      if (res.code === 0) {
        // 格式化销量显示
        const newProducts = res.data.list.map(p => ({
          ...p,
          salesText: p.sales > 10000 
            ? (p.sales / 10000).toFixed(1) + '万' 
            : p.sales
        }));
        
        this.setData({
          products: [...this.data.products, ...newProducts],
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
    const productId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/product-detail/product-detail?id=${productId}`
    });
  },

  addToCart(e) {
    const product = e.currentTarget.dataset.product;
    const cart = wx.getStorageSync('cart') || [];
    const existingItem = cart.find(item => item.id === product.id);
    
    if (existingItem) {
      existingItem.count++;
    } else {
      cart.push({ 
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        count: 1
      });
    }
    
    wx.setStorageSync('cart', cart);
    this.updateCartCount();
    app.toast('已加入购物车');
  },

  goToCart() {
    wx.navigateTo({
      url: '/pages/cart/cart'
    });
  }
});
