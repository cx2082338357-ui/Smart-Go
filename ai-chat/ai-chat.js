const app = getApp();

Page({
  data: {
    messages: [],
    inputText: '',
    scrollIntoView: '',
    showTools: false,
    userInfo: null,
    conversationId: '',
    isStreaming: false,
    showTyping: false,      // AI 正在思考中
    hasError: false,
    errorMsg: '',
    quickTopics: [
      { text: '我的学分够毕业吗？', icon: 'credit' },
      { text: '今天有哪些课程？', icon: 'schedule' },
      { text: '如何申请奖学金？', icon: 'score' },
      { text: '近期考试安排？', icon: 'exam' },
      { text: '图书馆几点开门？', icon: 'library' },
      { text: '空教室查询', icon: 'room' },
    ],
  },

  onLoad(options) {
    const userInfo = app.globalData.userInfo;
    this.setData({ userInfo });

    if (options.question) {
      this.setData({ inputText: decodeURIComponent(options.question) });
    }

    this._initConvId();
    this._loadWelcome();
    this.recordAction('ai_chat_open');
  },

  onShow() {
    // 从“热门咨询”等入口带过来的待发送问题
    const pending = wx.getStorageSync('ai_pending_question');
    if (pending) {
      wx.removeStorageSync('ai_pending_question');
      this.sendMessage(pending);
    }
  },

  // 供外部页面触发发送（例如热门咨询）
  sendMessage(text) {
    const content = String(text || '').trim();
    if (!content) return;
    this.setData({ inputText: content });
    this._send();
  },

  onUnload() {
    app.abortStream(this._streamTask);
    this._clearTypewriter();
    this._stopAutoScroll();
  },

  _initConvId() {
    const convId = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.setData({ conversationId: convId });
  },

  _loadWelcome() {
    if (this.data.messages.length === 0) {
      this.setData({ messages: [] });
    }
  },

  // ── 底部固定输入 ─────────────────────────────────────
  onInput(e) {
    const value = e.detail.value || '';

    if (/\r?\n$/.test(value)) {
      const text = value.replace(/\r?\n+$/, '');
      this.setData({ inputText: text });
      if (text.trim()) this._send();
      return;
    }

    this.setData({ inputText: value });
  },

  onConfirm(e) {
    const text = e.detail.value.trim();
    if (text) this.setData({ inputText: text }), this._send();
  },

  toggleTools() {
    this.setData({ showTools: !this.data.showTools });
  },

  selectTopic(e) {
    const topic = e.currentTarget.dataset.text;
    this.setData({ inputText: topic, showTools: false });
    this._send();
  },

  // ── 发送消息 ────────────────────────────────────────
  _send() {
    const text = this.data.inputText.trim();
    if (!text || this.data.isStreaming) return;
    this._stopRequested = false;
    this.setData({ inputText: '', showTools: false, hasError: false, errorMsg: '' });
    this._appendUser(text);
    this._startAI(text);
  },

  onTapSend() {
    this._send();
  },

  // ── 追加用户消息 ────────────────────────────────────
  _appendUser(content) {
    const msg = {
      id: `u_${Date.now()}`,
      role: 'user',
      content,
      time: this._fmtTime(),
    };
    this.setData({ messages: [...this.data.messages, msg] });
    this._scrollBottom();
  },

  // ── 追加 AI 占位消息 ────────────────────────────────
  _appendAILoading() {
    const msg = {
      id: `a_${Date.now()}`,
      role: 'assistant',
      content: '',
      isLoading: true,
      time: this._fmtTime(),
    };
    this.setData({ messages: [...this.data.messages, msg], isStreaming: true, showTyping: false });
    this._scrollBottom();
  },

  // ── 更新 AI 消息（流式增量） ───────────────────────
  _updateAIMessage(id, content) {
    const messages = this.data.messages.map(m => m.id === id ? { ...m, content, isLoading: false } : m);
    this.setData({ messages });
    this._scrollBottom();
  },

  // ── 完成 AI 消息 ────────────────────────────────────
  _finishAIMessage(id, content, actions) {
    const messages = this.data.messages.map(m => m.id === id
      ? { ...m, content, isLoading: false, quickActions: actions || [] }
      : m);
    this.setData({ messages, isStreaming: false, showTyping: false });
    this._stopAutoScroll();
    this._scrollBottom();
  },

  // ── AI HTTP 非流式请求 ──────────────────────────────
  _startAI(userContent) {
    this._stopRequested = false;
    this._startAutoScroll();
    const msgs = this.data.messages.filter(m => m.role === 'user' || m.role === 'assistant');
    const history = msgs.slice(-12).map(m => ({ role: m.role, content: m.content }));

    // 追加 AI 加载占位
    const aiId = `a_${Date.now()}`;
    this._activeAiId = aiId;
    const aiMsg = { id: aiId, role: 'assistant', content: '', isLoading: true, time: this._fmtTime() };
    this.setData({ messages: [...this.data.messages, aiMsg], isStreaming: true, showTyping: true });
    this._scrollBottom();

    app.httpAIChat({
      conversationId: this.data.conversationId,
      message: userContent,
      role: (app.globalData.userInfo && app.globalData.userInfo.role) || 'student',
      history,
    }).then(data => {
      if (this._stopRequested) return;
      // 打字机效果：逐字显示，让响应看起来更自然
      const fullContent = data.content || '';
      this._typewriterEffect(aiId, fullContent, data.quickActions || []);
    }).catch(err => {
      if (this._stopRequested) return;
      console.error('[AI] 请求失败:', err);
      const msg = err.message || '网络异常';
      this._showAIError(aiId, msg);
    });
  },

  // ── 打字机效果 ────────────────────────────────────
  _typewriterEffect(aiId, fullContent, quickActions) {
    this._clearTypewriter();
    let i = 0;
    const CHUNK = 5; // 每帧显示字数
    const INTERVAL = 60; // ms
    const showChunk = () => {
      if (this._stopRequested) {
        this._finishAIMessage(aiId, fullContent.slice(0, i), quickActions);
        return;
      }
      if (i >= fullContent.length) {
        this._finishAIMessage(aiId, fullContent, quickActions);
        return;
      }
      i = Math.min(i + CHUNK, fullContent.length);
      this._updateAIMessage(aiId, fullContent.slice(0, i));
      this._twTimer = setTimeout(showChunk, INTERVAL);
    };
    this._twTimer = setTimeout(showChunk, 50);
  },

  _clearTypewriter() {
    if (this._twTimer) {
      clearTimeout(this._twTimer);
      this._twTimer = null;
    }
  },

  _startAutoScroll() {
    this._stopAutoScroll();
    this._autoScrollTimer = setInterval(() => {
      this._scrollBottom();
    }, 220);
  },

  _stopAutoScroll() {
    if (this._autoScrollTimer) {
      clearInterval(this._autoScrollTimer);
      this._autoScrollTimer = null;
    }
  },

  onNewChat() {
    this._stopRequested = true;
    this._clearTypewriter();
    this._stopAutoScroll();
    const convId = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.setData({
      messages: [],
      inputText: '',
      conversationId: convId,
      isStreaming: false,
      showTyping: false,
      hasError: false,
      errorMsg: '',
    });
    app.toast('已开启新对话');
  },

  onStopThinking() {
    if (!this.data.isStreaming) return;
    this._stopRequested = true;
    this._clearTypewriter();
    this._stopAutoScroll();

    const activeId = this._activeAiId;
    if (activeId) {
      const messages = this.data.messages.map(m => {
        if (m.id !== activeId) return m;
        const content = (m.content || '').trim();
        return {
          ...m,
          isLoading: false,
          content: content ? content + '\n\n（已终止输出）' : '（已终止输出）'
        };
      });
      this.setData({ messages });
    }

    this.setData({ isStreaming: false, showTyping: false });
    app.toast('已终止');
  },

  _showAIError(aiId, errMsg) {
    let tip = 'AI 响应较慢，请稍后再试';
    if (/ADDRESS_UNREACHABLE|-109|不可达/i.test(errMsg)) {
      tip = '无法路由到该服务器地址（网络不可达）';
    } else if (/timeout|超时/i.test(errMsg)) {
      tip = '请求超时，请确认电脑已启动后端与 AI 服务后再试';
    } else if (/fail|网络|连接|域名|502|503|504/i.test(errMsg)) {
      tip = '无法连接服务器，请检查 api 地址与隧道是否可用';
    }

    const unreachableExtra =
      '常见原因：① 手机和电脑不在同一网段（例如电脑是 10.18.x.x，而手机 Wi‑Fi 拿到 192.168.x.x）；② 校园网/访客 Wi‑Fi 开启 AP 隔离；③ 电脑 IP 已变。\n\n请在电脑 cmd 执行 ipconfig，看「无线局域网适配器 WLAN」的 IPv4，与手机 Wi‑Fi 详情里的 IP 前两段是否同类；或改用 cloudflared 的 https 地址填到「设置」。';

    const applyTip = (extra) => {
      const content = extra ? `${tip}\n\n${extra}` : tip;
      const messages = this.data.messages.map(m => m.id === aiId
        ? { ...m, content, isLoading: false, hasError: true }
        : m);
      this.setData({ messages, isStreaming: false, showTyping: false, hasError: true, errorMsg: errMsg });
      this._stopAutoScroll();
    };

    const base = app.getApiBaseUrl() || '';
    const looksLikeLan = /^http:\/\/(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(base);
    const lanFail = /fail|超时|网络|连接|TIMED_OUT|ADDRESS_UNREACHABLE|-109|UNREACHABLE/i.test(errMsg);
    if (looksLikeLan && lanFail) {
      wx.getNetworkType({
        success: (nt) => {
          if (/ADDRESS_UNREACHABLE|-109|不可达/i.test(errMsg)) {
            applyTip(unreachableExtra);
            return;
          }
          if (nt.networkType !== 'wifi') {
            applyTip('当前为手机流量（非 Wi‑Fi）：无法访问电脑的局域网 IP。\n请连接与电脑同一 Wi‑Fi，或在「设置」里改为 cloudflared 的 https 地址。');
          } else {
            applyTip('已连接 Wi‑Fi 仍失败时：核对电脑 ipconfig 的 IPv4 是否与设置里一致；排除访客网络/AP 隔离；或改用 https 隧道。');
          }
        },
        fail: () => applyTip(/ADDRESS_UNREACHABLE|-109/i.test(errMsg) ? unreachableExtra : ''),
      });
      return;
    }
    applyTip('');
  },

  // ── 快捷操作 ────────────────────────────────────────
  onQuickAction(e) {
    const action = e.currentTarget.dataset.action;
    if (action.type === 'link') {
      if (action.url) wx.navigateTo({ url: action.url });
    } else if (action.type === 'search') {
      this.setData({ inputText: action.query });
      this._send();
    }
  },

  // ── 操作按钮 ────────────────────────────────────────
  onCopyMessage(e) {
    wx.setClipboardData({ data: e.currentTarget.dataset.content, success: () => app.toast('已复制') });
  },

  onLikeMessage(e) {
    const id = e.currentTarget.dataset.id;
    const messages = this.data.messages.map(m => m.id === id ? { ...m, liked: true, likes: (m.likes || 0) + 1 } : m);
    this.setData({ messages });
    app.request({ url: '/api/ai/feedback', method: 'POST', data: { messageId: id, feedback: 'like' } }).catch(() => {});
    app.toast('感谢反馈');
  },

  // ── 页面滚动 ────────────────────────────────────────
  _scrollBottom() {
    this.setData({ scrollIntoView: 'msgBottom' });
    setTimeout(() => this.setData({ scrollIntoView: '' }), 10);
  },

  // ── 工具函数 ────────────────────────────────────────
  _fmtTime() {
    const d = new Date();
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  },

  recordAction(action) {
    app.request({ url: '/api/analytics/track', method: 'POST', data: { action, page: 'ai_chat' } }).catch(() => {});
  },
});
