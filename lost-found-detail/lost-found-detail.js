const app = getApp();

Page({
  data: {
    item: null,
    loading: true
  },

  onLoad(options) {
    const id = options.id;
    if (!id) {
      this.setData({ loading: false, item: null });
      app.toast('缺少条目 id');
      return;
    }
    this.loadDetail(id);
  },

  async loadDetail(id) {
    this.setData({ loading: true });
    try {
      const res = await app.request({
        url: '/api/lost-found/list',
        data: { type: 'all', page: 1, limit: 100 }
      });
      if (res.code === 0) {
        const sid = String(id);
        const item = (res.data.list || []).find(i => String(i.id) === sid);
        this.setData({ item });
        if (!item) {
          app.toast('未找到该启事');
        }
      }
    } catch (err) {
      console.error('加载详情失败:', err);
    } finally {
      this.setData({ loading: false });
    }
  },

  callContact() {
    if (this.data.item && this.data.item.contact) {
      wx.makePhoneCall({
        phoneNumber: this.data.item.contact,
        fail: () => {
          app.toast('拨打电话失败');
        }
      });
    } else {
      app.toast('暂无联系方式');
    }
  },

  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    wx.previewImage({
      urls: this.data.item.images || [],
      current: url
    });
  }
});
