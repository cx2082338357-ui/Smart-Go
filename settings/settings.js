const app = getApp();

Page({
  data: {
    version: '1.0.0',
    cacheSize: '0 KB',
    apiBaseUrl: '',
    localLanApiBaseUrl: '',
    defaultApiBaseUrl: '',
    campusName: '',
    campusAddress: '',
    campusCoordText: '',
    settings: {
      classReminder: true,
      scoreNotice: true,
      communityNotice: true,
      orderNotice: true
    }
  },

  onLoad() {
    this.loadSettings();
    this.loadApiConfig();
    this.loadCampusLocation();
    this.calculateCacheSize();
    this.autoDetectLanApiBaseUrl();
  },

  onShow() {
    this.loadApiConfig();
  },

  loadApiConfig() {
    const savedLan = app.globalData.localLanApiBaseUrl ||
      wx.getStorageSync('localLanApiBaseUrl') ||
      app.globalData.builtinLanApiBaseUrl ||
      'http://127.0.0.1:8080';
    app.setLocalLanApiBaseUrl(savedLan);
    app.loadApiBaseUrl();
    const apiBaseUrl = app.getApiBaseUrl();
    this.setData({
      apiBaseUrl,
      localLanApiBaseUrl: app.globalData.localLanApiBaseUrl || savedLan,
      defaultApiBaseUrl: app.globalData.defaultApiBaseUrl
    });
  },

  async autoDetectLanApiBaseUrl() {
    wx.getNetworkType({
      success: async (nt) => {
        if (nt.networkType !== 'wifi') {
          console.warn('[Settings] 当前非 Wi‑Fi，跳过自动检测局域网（手机流量无法访问电脑内网 IP）');
          return;
        }
        try {
          const res = await app.request({
            url: '/api/system/local-ip',
            timeout: 5000
          });
          const baseUrl = res && res.code === 0 && res.data && res.data.baseUrl ? res.data.baseUrl : '';
          if (baseUrl) {
            this.setData({ localLanApiBaseUrl: baseUrl });
            app.setLocalLanApiBaseUrl(baseUrl);
            app.loadApiBaseUrl();
            this.setData({ apiBaseUrl: app.getApiBaseUrl() });
          }
        } catch (err) {
          console.warn('自动检测局域网地址失败:', err);
        }
      }
    });
  },

  _isPrivateLanHttpUrl(url) {
    const u = String(url || '').trim();
    return /^http:\/\/(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(u);
  },

  _httpIpv4MissingPort(url) {
    const u = String(url || '').trim().replace(/\/+$/, '');
    return /^http:\/\/(\d{1,3}\.){3}\d{1,3}$/i.test(u);
  },

  loadCampusLocation() {
    const campus = app.getCampusLocation();
    this.setData({
      campusName: campus.name,
      campusAddress: campus.address,
      campusCoordText: `${campus.latitude.toFixed(6)}, ${campus.longitude.toFixed(6)}`
    });
  },

  loadSettings() {
    const settings = wx.getStorageSync('appSettings') || {
      classReminder: true,
      scoreNotice: true,
      communityNotice: true,
      orderNotice: true
    };
    this.setData({ settings });
  },

  async calculateCacheSize() {
    try {
      const { size } = await wx.getStorageInfo();
      let cacheSize = '';
      if (size < 1024) {
        cacheSize = `${size} B`;
      } else if (size < 1024 * 1024) {
        cacheSize = `${(size / 1024).toFixed(1)} KB`;
      } else {
        cacheSize = `${(size / (1024 * 1024)).toFixed(1)} MB`;
      }
      this.setData({ cacheSize });
    } catch (err) {
      this.setData({ cacheSize: '0 KB' });
    }
  },

  toggleSetting(e) {
    const key = e.currentTarget.dataset.key;
    const value = e.detail.value;
    
    this.setData({
      [`settings.${key}`]: value
    });

    wx.setStorageSync('appSettings', this.data.settings);
    app.toast('设置已保存');
  },

  onApiInput(e) {
    this.setData({ apiBaseUrl: e.detail.value });
  },

  onLanApiInput(e) {
    this.setData({ localLanApiBaseUrl: e.detail.value });
  },

  saveApiConfig() {
    const apiBaseUrl = (this.data.apiBaseUrl || '').trim();
    if (!/^https?:\/\//i.test(apiBaseUrl)) {
      app.toast('API 地址需以 http:// 或 https:// 开头');
      return;
    }
    if (this._httpIpv4MissingPort(apiBaseUrl)) {
      app.toast('请写上端口，例如 http://10.186.142.184:8080');
      return;
    }
    const savedUrl = app.setApiBaseUrl(apiBaseUrl);
    this.setData({ apiBaseUrl: savedUrl });
    app.toast('API 地址已保存');
  },

  saveLanApiConfig() {
    const localLanApiBaseUrl = (this.data.localLanApiBaseUrl || '').trim();
    if (localLanApiBaseUrl && !/^https?:\/\//i.test(localLanApiBaseUrl)) {
      app.toast('局域网地址需以 http:// 或 https:// 开头');
      return;
    }
    if (localLanApiBaseUrl && this._httpIpv4MissingPort(localLanApiBaseUrl)) {
      app.toast('请写上端口，例如 http://192.168.1.5:8080');
      return;
    }
    const savedUrl = app.setLocalLanApiBaseUrl(localLanApiBaseUrl);
    app.loadApiBaseUrl();
    const apiBaseUrl = app.getApiBaseUrl();
    this.setData({ localLanApiBaseUrl: savedUrl, apiBaseUrl });
    app.toast('局域网地址已保存');
  },

  resetApiConfig() {
    const defaultApiBaseUrl = app.globalData.defaultApiBaseUrl;
    const savedUrl = app.setApiBaseUrl(defaultApiBaseUrl);
    app.setLocalLanApiBaseUrl('');
    this.setData({ apiBaseUrl: savedUrl, localLanApiBaseUrl: '' });
    app.toast('已恢复默认地址');
  },

  pickCampusLocation() {
    wx.chooseLocation({
      success: (res) => {
        const saved = app.setCampusLocation({
          latitude: res.latitude,
          longitude: res.longitude,
          name: res.name || '内蒙古科技大学（主校区）',
          address: res.address || '内蒙古自治区包头市昆都仑区阿尔丁大街7号'
        });
        this.setData({
          campusName: saved.name,
          campusAddress: saved.address,
          campusCoordText: `${saved.latitude.toFixed(6)}, ${saved.longitude.toFixed(6)}`
        });
        app.toast('校区定位已校准');
      },
      fail: () => {
        app.toast('未完成选点');
      }
    });
  },

  resetCampusLocation() {
    const campus = app.resetCampusLocation();
    this.setData({
      campusName: campus.name,
      campusAddress: campus.address,
      campusCoordText: `${campus.latitude.toFixed(6)}, ${campus.longitude.toFixed(6)}`
    });
    app.toast('已恢复默认校区点位');
  },

  testApiConfig() {
    const apiBaseUrl = (this.data.apiBaseUrl || '').trim();
    if (!/^https?:\/\//i.test(apiBaseUrl)) {
      app.toast('请先输入正确的 API 地址');
      return;
    }
    if (this._httpIpv4MissingPort(apiBaseUrl)) {
      app.toast('请写上端口，例如 http://10.186.142.184:8080');
      return;
    }

    const savedUrl = app.setApiBaseUrl(apiBaseUrl);
    this.setData({ apiBaseUrl: savedUrl });
    wx.showLoading({ title: '测试中...', mask: true });

    app.request({
      url: '/api/ai/hot-topics',
      timeout: 10000
    }).then(() => {
      wx.hideLoading();
      app.toast('连接成功', 'success');
    }).catch((err) => {
      wx.hideLoading();
      const errText = err.message || err.errMsg || '未知错误';
      wx.getNetworkType({
        success: (nt) => {
          let tail = '';
          const lan = this._isPrivateLanHttpUrl(savedUrl);
          const unreachable = /ADDRESS_UNREACHABLE|-109|不可达/i.test(errText);
          if (lan && unreachable) {
            tail = '\n\n——\n错误 -109「地址不可达」：手机当前网络到不了这个 IP。\n常见情况：手机与电脑不在同一网段（电脑 ipconfig 里 WLAN 的 IPv4 与手机 Wi‑Fi 详情里的 IP 网段不一致）、连了访客 Wi‑Fi/AP 隔离、或电脑 IP 已变化。\n处理：① 让手机与电脑连同一路由器/同一校园网；② 用 ipconfig 更新这里的 IP；③ 或电脑运行 cloudflared，把 https 地址填到「后端 API 地址」。';
          } else if (lan && nt.networkType !== 'wifi') {
            tail = '\n\n——\n当前手机网络不是 Wi‑Fi（如 4G/5G）。访问电脑局域网 IP 会超时。\n请：① 手机与电脑连同一 Wi‑Fi 后再试；或 ② 电脑运行 cloudflared 转发 8080，把 https 地址填到这里再保存。';
          } else if (lan) {
            tail = '\n\n——\n若仍失败：确认后端已启动、Windows 防火墙放行 8080；手机与电脑须在同一可互通的局域网（非访客隔离网）。';
          }
          wx.showModal({
            title: '连接失败',
            content: `当前地址：${savedUrl}\n\n请确认后端服务、端口、隧道或合法域名配置是否正确。\n\n错误：${errText}${tail}`,
            showCancel: false
          });
        },
        fail: () => {
          wx.showModal({
            title: '连接失败',
            content: `当前地址：${savedUrl}\n\n错误：${errText}`,
            showCancel: false
          });
        }
      });
    });
  },

  goPage(e) {
    const page = e.currentTarget.dataset.page;
    const urlMap = {
      privacy: '/pages/privacy/privacy',
      agreement: '/pages/agreement/agreement',
      feedback: '/pages/feedback/feedback',
      about: '/pages/about/about'
    };

    if (urlMap[page]) {
      wx.navigateTo({ url: urlMap[page] });
    }
  },

  clearCache() {
    wx.showModal({
      title: '清除缓存',
      content: '确定要清除缓存吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await wx.clearStorage();
            this.calculateCacheSize();
            app.toast('缓存已清除');
          } catch (err) {
            app.toast('清除失败');
          }
        }
      }
    });
  },

  checkUpdate() {
    const updateManager = wx.getUpdateManager();

    updateManager.onCheckForUpdate((res) => {
      if (res.hasUpdate) {
        wx.showLoading({ title: '正在下载...' });
      } else {
        app.toast('已是最新版本');
      }
    });

    updateManager.onUpdateReady(() => {
      wx.hideLoading();
      wx.showModal({
        title: '更新提示',
        content: '新版本已准备好，是否重启应用？',
        success: (res) => {
          if (res.confirm) {
            updateManager.applyUpdate();
          }
        }
      });
    });

    updateManager.onUpdateFailed(() => {
      wx.hideLoading();
      app.toast('更新失败，请稍后重试');
    });
  },

  logout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('token');
          wx.removeStorageSync('userInfo');
          wx.removeStorageSync('isRider');
          app.globalData.isBindAccount = false;
          app.globalData.userInfo = null;
          app.toast('已退出登录');
          setTimeout(() => {
            wx.redirectTo({ url: '/pages/index/index' });
          }, 1000);
        }
      }
    });
  }
});
