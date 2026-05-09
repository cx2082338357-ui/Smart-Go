const app = getApp();

Page({
  data: {
    postId: '',
    post: null,
    comments: [],
    commentText: '',
    loading: false
  },

  onLoad(options) {
    const { id } = options;
    if (!id) {
      app.toast('帖子信息不存在');
      wx.navigateBack();
      return;
    }
    this.setData({ postId: id });
    this.loadPost();
    this.loadComments();
  },

  onShareAppMessage() {
    const { post } = this.data;
    return {
      title: post ? post.content.slice(0, 30) : '智慧校园社区',
      path: '/pages/community/community'
    };
  },

  onShareTimeline() {
    return { title: '智慧校园 - 校园社区' };
  },

  async loadPost() {
    try {
      const res = await app.request({
        url: '/api/community/posts',
        data: { postId: this.data.postId }
      });
      if (res.code === 0 && res.data.list && res.data.list.length > 0) {
        this.setData({ post: res.data.list[0] });
      }
    } catch (err) {
      const posts = wx.getStorageSync('communityPosts') || [];
      const post = posts.find(p => p.id === this.data.postId);
      if (post) this.setData({ post });
    }
  },

  async loadComments() {
    const mockComments = [
      { id: 'c1', nickname: '小明同学', avatar: '', content: '这个位置我知道！三楼东侧人很少', time: '2小时前' },
      { id: 'c2', nickname: '校园通', avatar: '', content: '谢谢分享！', time: '1小时前' }
    ];
    this.setData({ comments: mockComments });
  },

  onCommentInput(e) {
    this.setData({ commentText: e.detail.value });
  },

  async submitComment() {
    const text = this.data.commentText.trim();
    if (!text) {
      app.toast('请输入评论内容');
      return;
    }
    const newComment = {
      id: `c${Date.now()}`,
      nickname: app.globalData.userInfo?.nickname || '我',
      avatar: '',
      content: text,
      time: '刚刚'
    };
    this.setData({
      comments: [...this.data.comments, newComment],
      commentText: ''
    });
    app.toast('评论成功');
  },

  async toggleLike() {
    const post = this.data.post;
    if (!post) return;
    const isLike = !post.liked;
    try {
      await app.request({
        url: '/api/community/like',
        method: 'POST',
        data: { postId: post.id, action: isLike ? 'like' : 'unlike' }
      });
      this.setData({
        'post.liked': isLike,
        'post.likes': isLike ? post.likes + 1 : post.likes - 1
      });
    } catch (err) {
      this.setData({
        'post.liked': isLike,
        'post.likes': isLike ? post.likes + 1 : post.likes - 1
      });
    }
  }
});
