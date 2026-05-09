const app = getApp();

Page({
  data: {
    currentType: 'lost',
    items: [],
    lostCount: 0,
    foundCount: 0,
    hasMatch: false,
    matchCount: 0,
    page: 1,
    hasMore: true,
    loading: false
  },

  onLoad() {
    this.loadItems();
    this.checkAIMatches();
  },

  onPullDownRefresh() {
    this.setData({ page: 1 });
    Promise.all([
      this.loadItems(),
      this.checkAIMatches()
    ]).finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadMore();
    }
  },

  switchType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      currentType: type,
      page: 1,
      items: []
    });
    this.loadItems();
  },

  async loadItems() {
    this.setData({ loading: true });

    try {
      const res = await app.request({
        url: '/api/lost-found/list',
        data: {
          type: this.data.currentType,
          page: this.data.page,
          limit: 10
        }
      });

      if (res.code === 0) {
        this.setData({
          items: res.data.list,
          hasMore: res.data.hasMore,
          lostCount: res.data.lostCount || 0,
          foundCount: res.data.foundCount || 0
        });
      }
    } catch (err) {
      console.error('加载列表失败:', err);
      this.useMockData();
    } finally {
      this.setData({ loading: false });
    }
  },

  useMockData() {
    const lostItems = [
      {
        id: '1',
        type: 'lost',
        title: '丢失黑色小米手机一台',
        description: '昨天下午在图书馆三楼自习室丢失，屏幕有裂纹，壳是透明的，有一只小熊挂件',
        location: '图书馆三楼',
        lostTime: '昨天 14:00',
        timeAgo: '2小时前',
        images: [],
        views: 156,
        comments: 12,
        nickname: '陈子涵',
        avatar: '',
        isMatch: false
      },
      {
        id: '2',
        type: 'lost',
        title: '校园卡丢失',
        description: '一食堂到图书馆的路上丢失，卡套是蓝色的，上面写着"努力"两个字',
        location: '一食堂附近',
        lostTime: '今天 09:30',
        timeAgo: '5小时前',
        images: [],
        views: 89,
        comments: 5,
        nickname: '刘宇航',
        avatar: '',
        isMatch: true
      }
    ];

    const foundItems = [
      {
        id: '3',
        type: 'found',
        title: '捡到一串钥匙（4把）',
        description: '教学楼A座门口捡到，有一把是防盗门钥匙，钥匙扣是蓝色的',
        location: '教学楼A座',
        lostTime: '今天 11:00',
        timeAgo: '1小时前',
        images: [],
        views: 67,
        comments: 8,
        nickname: '好心人',
        avatar: '',
        isMatch: true
      }
    ];

    const items = this.data.currentType === 'lost' ? lostItems : foundItems;
    this.setData({
      items,
      hasMore: false,
      lostCount: lostItems.length,
      foundCount: foundItems.length
    });
  },

  async checkAIMatches() {
    try {
      const res = await app.request({
        url: '/api/lost-found/matches',
        data: { type: this.data.currentType }
      });

      if (res.code === 0) {
        this.setData({
          hasMatch: !!res.data.hasMatch,
          matchCount: Number(res.data.count || 0)
        });
      }
    } catch (err) {
      // 静默处理
    }
  },

  async loadMore() {
    if (this.data.loading || !this.data.hasMore) return;

    this.setData({ loading: true, page: this.data.page + 1 });

    try {
      const res = await app.request({
        url: '/api/lost-found/list',
        data: {
          type: this.data.currentType,
          page: this.data.page,
          limit: 10
        }
      });

      if (res.code === 0) {
        this.setData({
          items: [...this.data.items, ...res.data.list],
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
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/lost-found-detail/lost-found-detail?id=${id}`
    });
  },

  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    wx.previewImage({
      urls: [url],
      current: url
    });
  },

  publish() {
    wx.navigateTo({
      url: `/pages/lost-found-publish/lost-found-publish?type=${this.data.currentType}`
    });
  },

  viewMatches() {
    // 跳转到匹配列表
    wx.navigateTo({
      url: `/pages/lost-found-matches/lost-found-matches?type=${this.data.currentType}`
    });
  }
});
