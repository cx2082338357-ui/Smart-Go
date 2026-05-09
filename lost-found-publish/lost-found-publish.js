const app = getApp();

Page({
  data: {
    type: 'lost',
    title: '',
    description: '',
    location: '',
    contact: '',
    images: [],
    loading: false
  },

  onLoad(options) {
    this.setData({ type: options.type || 'lost' });
    wx.setNavigationBarTitle({
      title: this.data.type === 'lost' ? '发布寻物启事' : '发布失物招领'
    });
  },

  onTitleInput(e) {
    this.setData({ title: e.detail.value });
  },

  onDescriptionInput(e) {
    this.setData({ description: e.detail.value });
  },

  onLocationInput(e) {
    this.setData({ location: e.detail.value });
  },

  onContactInput(e) {
    this.setData({ contact: e.detail.value });
  },

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
        this.setData({
          images: [...this.data.images, ...res.tempFilePaths]
        });
      }
    });
  },

  removeImage(e) {
    const index = e.currentTarget.dataset.index;
    const images = this.data.images;
    images.splice(index, 1);
    this.setData({ images });
  },

  previewImage(e) {
    wx.previewImage({
      urls: this.data.images,
      current: e.currentTarget.dataset.url
    });
  },

  async submit() {
    const { title, description, location, contact } = this.data;

    if (!title || title.length < 5) {
      app.toast('请输入标题，至少5个字符');
      return;
    }

    if (!description || description.length < 10) {
      app.toast('请输入详细描述，至少10个字符');
      return;
    }

    if (!location) {
      app.toast('请输入丢失/捡到地点');
      return;
    }

    this.setData({ loading: true });

    try {
      const res = await app.request({
        url: '/api/lost-found/publish',
        method: 'POST',
        data: {
          type: this.data.type,
          title,
          description,
          location,
          contact,
          images: this.data.images
        }
      });

      if (res.code === 0) {
        wx.showModal({
          title: '发布成功',
          content: '您的信息已发布成功',
          showCancel: false,
          success: () => {
            wx.navigateBack();
          }
        });
      } else {
        app.toast(res.message || '发布失败');
      }
    } catch (err) {
      console.error('发布失败:', err);
      app.toast('发布失败，请重试');
    } finally {
      this.setData({ loading: false });
    }
  }
});
