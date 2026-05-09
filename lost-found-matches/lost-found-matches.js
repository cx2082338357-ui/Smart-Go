const app = getApp();

Page({
  data: {
    items: [],
    loading: false,
    matchType: 'all'
  },

  onLoad(options) {
    const matchType = String(options && options.type || 'all');
    this.setData({ matchType });
    this.loadMatches();
  },

  onPullDownRefresh() {
    this.loadMatches().finally(() => wx.stopPullDownRefresh());
  },

  async loadMatches() {
    this.setData({ loading: true });
    try {
      const type = this.data.matchType === 'all' ? 'lost' : this.data.matchType;
      const res = await app.request({
        url: '/api/lost-found/matches',
        data: { type }
      });
      if (res && res.code === 0) {
        const list = (res.data && Array.isArray(res.data.list)) ? res.data.list : null;
        if (list && list.length > 0) {
          this.setData({ items: list });
        } else {
          // 兼容旧后端：/matches 仅返回 count，不返回 list
          const fallback = await this.loadMatchesFromList(type);
          this.setData({ items: fallback });
        }
      } else {
        this.setData({ items: [] });
      }
    } catch (err) {
      console.error('加载 AI 匹配结果失败:', err);
      const type = this.data.matchType === 'all' ? 'lost' : this.data.matchType;
      const fallback = await this.loadMatchesFromList(type);
      this.setData({ items: fallback });
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadMatchesFromList(type) {
    try {
      const res = await app.request({
        url: '/api/lost-found/list',
        data: { type, page: 1, limit: 50 }
      });
      if (res && res.code === 0) {
        const raw = (res.data.list || []).filter(item => !!item.isMatch);
        return raw.map(item => {
          const estimated = this.estimateScore(item);
          return {
            ...item,
            aiScore: estimated.score,
            matchReasons: [estimated.reason]
          };
        });
      }
      return [];
    } catch (e) {
      return [];
    }
  },

  estimateScore(item) {
    const text = `${item.title || ''} ${item.description || ''} ${item.location || ''}`;
    let score = 35;
    const reasons = [];

    const keywordGroups = [
      ['校园卡', '一卡通', '学生证', '证件', '卡'],
      ['钥匙', '钥匙串'],
      ['手机', 'iphone', '小米', '华为', 'oppo', 'vivo'],
      ['耳机', 'airpods'],
      ['背包', '书包', '双肩包'],
      ['眼镜']
    ];
    keywordGroups.forEach(group => {
      if (group.some(k => text.toLowerCase().includes(k.toLowerCase()))) {
        score += 8;
        if (!reasons.length) reasons.push(`物品关键词：${group[0]}`);
      }
    });

    const locationTags = ['图书馆', '食堂', '教学楼', '操场', '宿舍', '实验楼'];
    const hitLoc = locationTags.find(loc => text.includes(loc));
    if (hitLoc) {
      score += 8;
      reasons.push(`地点特征：${hitLoc}`);
    }

    const colors = ['黑', '白', '蓝', '红', '绿', '黄'];
    const hitColor = colors.find(c => text.includes(c));
    if (hitColor) {
      score += 6;
      reasons.push(`颜色特征：${hitColor}色`);
    }

    if (String(item.lostTime || '').includes('今天')) {
      score += 6;
      reasons.push('时间较近');
    } else if (String(item.lostTime || '').includes('昨天')) {
      score += 3;
      reasons.push('时间可关联');
    }

    score = Math.max(35, Math.min(92, score));
    return {
      score,
      reason: reasons[0] || '综合特征匹配'
    };
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({
      url: `/pages/lost-found-detail/lost-found-detail?id=${id}`
    });
  }
});
