const app = getApp();

Page({
  data: {
    categories: [
      { id: 'all', name: '全部', icon: '/assets/icons/all.png' },
      { id: 'study', name: '学习', icon: '/assets/icons/study.png' },
      { id: 'life', name: '生活', icon: '/assets/icons/life.png' },
      { id: 'food', name: '美食', icon: '/assets/icons/food.png' },
      { id: 'sports', name: '运动', icon: '/assets/icons/sports.png' },
      { id: 'activity', name: '活动', icon: '/assets/icons/activity.png' },
      { id: 'help', name: '互助', icon: '/assets/icons/help.png' },
      { id: 'jobs', name: '兼职', icon: '/assets/icons/jobs.png' }
    ],
    selectedCategory: 'all',
    posts: [],
    hasMore: true,
    page: 1,
    loading: false
  },

  onLoad() {
    this.loadPosts();
  },

  onPullDownRefresh() {
    this.setData({ page: 1 });
    this.loadPosts().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadMore();
    }
  },

  async loadPosts() {
    this.setData({ loading: true });

    try {
      const res = await app.request({
        url: '/api/community/posts',
        data: {
          category: this.data.selectedCategory,
          page: this.data.page,
          limit: 10
        }
      });

      if (res.code === 0) {
        const filtered = this.filterPostsByCategory(res.data.list || [], this.data.selectedCategory);
        this.setData({
          posts: filtered,
          hasMore: res.data.hasMore
        });
        // AI 标签识别
        this.recognizeAITags();
      }
    } catch (err) {
      console.error('加载帖子失败:', err);
      this.useMockPosts();
    } finally {
      this.setData({ loading: false });
    }
  },

  useMockPosts() {
    const mockPosts = [
      {
        id: '1',
        nickname: '小明同学',
        avatar: '',
        timeAgo: '10分钟前',
        content: '今天图书馆好多人啊，自习室都满了，有没有人知道哪个教学楼还有空位置？',
        images: [],
        tags: ['图书馆', '自习'],
        likes: 42,
        comments: 15,
        liked: false,
        aiTags: []
      },
      {
        id: '2',
        nickname: '校园达人',
        avatar: '',
        timeAgo: '1小时前',
        content: '强烈推荐学校北门的螺蛳粉！味道正宗，老板超热情～',
        images: ['https://example.com/food1.jpg'],
        tags: ['美食', '推荐'],
        likes: 128,
        comments: 32,
        liked: true,
        aiTags: ['#美食推荐', '#北门小吃']
      },
      {
        id: '3',
        nickname: '健身爱好者',
        avatar: '',
        timeAgo: '2小时前',
        content: '有没有人想一起夜跑？每晚8点在操场集合，5公里起步，欢迎加入！',
        images: [],
        tags: ['运动', '夜跑'],
        likes: 56,
        comments: 18,
        liked: false,
        aiTags: ['#运动约伴']
      }
    ];
    const posts = this.filterPostsByCategory(mockPosts, this.data.selectedCategory);
    this.setData({ posts, hasMore: false });
    this.recognizeAITags();
  },

  filterPostsByCategory(posts, categoryId) {
    if (categoryId === 'all') return posts;
    const map = {
      study: ['学习', '自习', '图书馆', '考试', '课程', '复习'],
      life: ['生活', '日常', '宿舍', '分享', '吐槽'],
      food: ['美食', '吃', '餐', '食堂', '小吃', '螺蛳粉', '烤肉', '奶茶'],
      sports: ['运动', '跑', '健身', '篮球', '足球', '夜跑'],
      activity: ['活动', '电影', '讲座', '社团', '比赛'],
      help: ['互助', '求助', '帮忙', '失物', '寻物', '招领'],
      jobs: ['兼职', '求职', '实习', '招聘', '工作']
    };
    const rules = map[categoryId] || [];
    if (!rules.length) return posts;
    return posts.filter(p => {
      const tags = (p.tags || []).join(' ');
      const ai = (p.aiTags || []).join(' ');
      const text = `${p.content || ''} ${tags} ${ai}`;
      return rules.some(k => text.includes(k));
    });
  },

  async recognizeAITags() {
    const posts = this.data.posts.map(post => {
      if (!post.aiTags || post.aiTags.length === 0) {
        // 模拟 AI 标签识别
        const tags = this.mockAITagRecognition(post.content);
        return { ...post, aiTags: tags };
      }
      return post;
    });
    this.setData({ posts });
  },

  mockAITagRecognition(content) {
    const tagMap = {
      '丢失': '#寻物启事',
      '捡到': '#失物招领',
      '美食': '#美食推荐',
      '图书馆': '#学习相关',
      '跑': '#运动约伴',
      '兼职': '#校园兼职',
      '考试': '#学习相关',
      '求助': '#求助互助'
    };

    const tags = [];
    for (const [keyword, tag] of Object.entries(tagMap)) {
      if (content.includes(keyword)) {
        tags.push(tag);
      }
    }
    return tags.slice(0, 2);
  },

  async loadMore() {
    if (this.data.loading || !this.data.hasMore) return;

    this.setData({ loading: true, page: this.data.page + 1 });

    try {
      const res = await app.request({
        url: '/api/community/posts',
        data: {
          category: this.data.selectedCategory,
          page: this.data.page,
          limit: 10
        }
      });

      if (res.code === 0) {
        const incoming = this.filterPostsByCategory(res.data.list || [], this.data.selectedCategory);
        this.setData({
          posts: [...this.data.posts, ...incoming],
          hasMore: res.data.hasMore
        });
      }
    } catch (err) {
      this.setData({ page: this.data.page - 1 });
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
    this.loadPosts();
  },

  goToPostDetail(e) {
    const postId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/post-detail/post-detail?id=${postId}`
    });
  },

  async toggleLike(e) {
    const index = e.currentTarget.dataset.index;
    const post = this.data.posts[index];
    const isLike = !post.liked;

    try {
      await app.request({
        url: '/api/community/like',
        method: 'POST',
        data: {
          postId: post.id,
          action: isLike ? 'like' : 'unlike'
        }
      });

      this.setData({
        [`posts[${index}].liked`]: isLike,
        [`posts[${index}].likes`]: isLike ? (post.likes + 1) : (post.likes - 1)
      });
    } catch (err) {
      app.handleError(err);
    }
  },

  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    wx.previewImage({
      urls: [url],
      current: url
    });
  },

  sharePost(e) {
    const postId = e.currentTarget.dataset.id;
    // 触发微信分享菜单
    this.setData({ sharePostId: postId });
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });
  },

  onShareAppMessage(res) {
    const postId = this.data.sharePostId;
    const post = this.data.posts.find(p => p.id === postId);
    return {
      title: post ? post.content.slice(0, 30) : '校园社区',
      path: `/pages/community/community`,
      imageUrl: ''
    };
  },

  onShareTimeline(res) {
    return {
      title: '智慧校园 - 校园社区'
    };
  },

  goToPublish() {
    wx.navigateTo({
      url: '/pages/publish/publish'
    });
  },

  goToLostFound() {
    wx.navigateTo({
      url: '/pages/lost-found/lost-found'
    });
  },

  goToShopping() {
    wx.navigateTo({
      url: '/pages/shopping/shopping'
    });
  },

  goToProfile() {
    wx.switchTab({
      url: '/pages/profile/profile'
    });
  }
});
