const app = getApp();

Page({
  data: {
    content: '',
    images: [],
    selectedTags: [],
    availableTags: ['学习', '生活', '美食', '运动', '活动', '互助', '兼职', '情感', '吐槽', '求助'],
    loading: false
  },

  onLoad() {},

  onContentInput(e) {
    this.setData({ content: e.detail.value });
  },

  toggleTag(e) {
    const tag = e.currentTarget.dataset.tag;
    const tags = this.data.selectedTags;
    const index = tags.indexOf(tag);
    if (index > -1) {
      tags.splice(index, 1);
    } else if (tags.length < 3) {
      tags.push(tag);
    }
    this.setData({ selectedTags: tags });
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

  async submit() {
    const { content, selectedTags } = this.data;

    if (!content || content.length < 10) {
      app.toast('请输入内容，至少10个字符');
      return;
    }

    this.setData({ loading: true });

    try {
      const res = await app.request({
        url: '/api/community/posts',
        method: 'POST',
        data: {
          content,
          images: this.data.images,
          tags: selectedTags
        }
      });

      if (res.code === 0) {
        wx.showModal({
          title: '发布成功',
          content: '您的帖子已发布成功',
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
