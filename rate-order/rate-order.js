const app = getApp();

Page({
  data: {
    orderId: '',
    orderInfo: null,
    rating: 5,
    tags: [],
    selectedTags: [],
    content: '',
    anonymous: false,
    images: [],
    deliveryRating: 5,
    serviceRating: 5,
    submitLoading: false
  },

  // 可选的评价标签
  tagOptions: [
    '配送快速', '态度友好', '商品完好', '包装严实', 
    '准时送达', '服务热情', '货品齐全', '新鲜度好',
    '沟通顺畅', '值得推荐'
  ],

  onLoad(options) {
    const { orderId } = options;
    if (orderId) {
      this.setData({ orderId });
      this.loadOrderInfo();
    }
  },

  async loadOrderInfo() {
    try {
      const res = await app.request({
        url: '/api/order/list',
        data: { status: 'all', page: 1, limit: 50 }
      });
      if (res.code === 0) {
        const order = res.data.list.find(o => o.id === this.data.orderId);
        if (order) {
          this.setData({ orderInfo: order });
          return;
        }
      }
    } catch (err) {
      console.error('加载订单信息失败:', err);
    }
    // 兜底
    this.setData({
      orderInfo: {
        id: this.data.orderId,
        shopName: '天猫超市',
        orderNo: `DD${Date.now().toString().slice(0, 12)}`,
        totalPrice: '0.00',
        products: []
      }
    });
  },

  // 选择评分
  setRating(e) {
    const { rating } = e.currentTarget.dataset;
    this.setData({ rating });
  },

  // 配送评分
  setDeliveryRating(e) {
    const { rating } = e.currentTarget.dataset;
    this.setData({ deliveryRating: rating });
  },

  // 服务评分
  setServiceRating(e) {
    const { rating } = e.currentTarget.dataset;
    this.setData({ serviceRating: rating });
  },

  // 选择标签
  toggleTag(e) {
    const { tag } = e.currentTarget.dataset;
    const { selectedTags } = this.data;
    
    const index = selectedTags.indexOf(tag);
    if (index > -1) {
      selectedTags.splice(index, 1);
    } else {
      if (selectedTags.length < 5) {
        selectedTags.push(tag);
      } else {
        app.toast('最多选择5个标签');
        return;
      }
    }
    
    this.setData({ selectedTags });
  },

  // 输入评价内容
  onContentInput(e) {
    this.setData({ content: e.detail.value });
  },

  // 匿名评价
  toggleAnonymous() {
    this.setData({ anonymous: !this.data.anonymous });
  },

  // 添加图片
  chooseImage() {
    if (this.data.images.length >= 9) {
      app.toast('最多上传9张图片');
      return;
    }

    wx.chooseImage({
      count: 9 - this.data.images.length,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const newImages = [...this.data.images, ...res.tempFilePaths];
        this.setData({ images: newImages });
      }
    });
  },

  // 删除图片
  removeImage(e) {
    const { index } = e.currentTarget.dataset;
    const images = [...this.data.images];
    images.splice(index, 1);
    this.setData({ images });
  },

  // 预览图片
  previewImage(e) {
    const { index } = e.currentTarget.dataset;
    wx.previewImage({
      urls: this.data.images,
      current: this.data.images[index]
    });
  },

  // 提交评价
  async submitReview() {
    const { rating, content, orderId, selectedTags, anonymous, images, deliveryRating, serviceRating } = this.data;

    if (!content || content.trim().length < 5) {
      app.toast('请输入至少5个字的评价内容');
      return;
    }

    this.setData({ submitLoading: true });

    try {
      const reviewData = {
        orderId,
        rating,
        content: content.trim(),
        tags: selectedTags,
        anonymous,
        images: images.length > 0 ? images : [],
        deliveryRating,
        serviceRating
      };

      // 调用后端评价接口
      const res = await app.request({
        url: '/api/order/review',
        method: 'POST',
        data: reviewData
      });

      this.setData({ submitLoading: false });

      if (res.code === 0) {
        // 保存到本地
        wx.setStorageSync(`review_${orderId}`, reviewData);
        
        wx.showModal({
          title: '评价成功',
          content: '感谢您的评价，期待下次为您服务！',
          showCancel: false,
          success: () => {
            // 更新订单状态
            const orders = wx.getStorageSync('localOrders') || [];
            const orderIndex = orders.findIndex(o => o.id === orderId);
            if (orderIndex > -1) {
              orders[orderIndex].rated = true;
              orders[orderIndex].rating = rating;
              wx.setStorageSync('localOrders', orders);
            }
            
            wx.navigateBack();
          }
        });
      } else {
        app.toast(res.message || '评价失败，请重试');
      }
    } catch (err) {
      this.setData({ submitLoading: false });
      
      // 演示模式：本地保存评价
      wx.setStorageSync(`review_${orderId}`, {
        orderId,
        rating,
        content: content.trim(),
        tags: selectedTags,
        anonymous,
        images,
        deliveryRating,
        serviceRating,
        createTime: new Date().toISOString()
      });

      wx.showModal({
        title: '评价成功',
        content: '感谢您的评价，期待下次为您服务！',
        showCancel: false,
        success: () => {
          wx.navigateBack();
        }
      });
    }
  },

  // 快速评价模板
  useQuickTemplate(e) {
    const { template } = e.currentTarget.dataset;
    this.setData({ content: template });
  }
});
