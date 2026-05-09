const app = getApp();

Page({
  data: {
    // 登录方式: 'wechat' | 'phone' | 'account'
    loginType: 'wechat',
    
    // 微信授权登录
    studentId: '',
    password: '',
    showPassword: false,
    
    // 手机号登录
    phone: '',
    verifyCode: '',
    verifyCodeBtnText: '获取验证码',
    verifyCodeDisabled: false,
    countdown: 60,
    
    loading: false,
    services: [
      { icon: '/assets/icons/schedule.png', title: '课表查询', desc: '实时课表查看与上课提醒' },
      { icon: '/assets/icons/score.png', title: '成绩查询', desc: '成绩单、GPA与学分进度' },
      { icon: '/assets/icons/ai.png', title: 'AI 智能咨询', desc: '基于您的学业数据提供个性化建议' },
      { icon: '/assets/icons/library.png', title: '图书馆服务', desc: '借阅查询与座位预约' }
    ]
  },

  onLoad(options) {
    // 如果是首页直接跳转，显示登录页面
    if (options.from === 'index') {
      this.setData({ loginType: 'wechat' });
    }
    this.checkBindStatus();
  },

  checkBindStatus() {
    if (app.globalData.isBindAccount) {
      wx.showModal({
        title: '提示',
        content: '您已绑定教务账号，是否解绑后重新绑定？',
        confirmText: '重新绑定',
        cancelText: '取消',
        success: (res) => {
          if (!res.confirm) {
            wx.navigateBack();
          }
        }
      });
    }
  },

  // ========== 切换登录方式 ==========
  switchLoginType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ loginType: type });
  },

  // ========== 微信授权登录 ==========
  async onWechatLogin() {
    wx.showLoading({ title: '正在获取授权...' });

    try {
      // 步骤1：获取用户基本信息（昵称、头像）
      let userInfo = {};
      try {
        const profileRes = await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('timeout')), 10000);
          wx.getUserProfile({
            desc: '用于完善个人资料和登录智慧校园',
            success: resolve,
            fail: reject
          });
        });
        if (profileRes && profileRes.userInfo) {
          userInfo = {
            nickname: profileRes.userInfo.nickName,
            avatar: profileRes.userInfo.avatarUrl,
            gender: profileRes.userInfo.gender === 1 ? '男' : '女'
          };
        }
      } catch (profileErr) {
        console.log('获取用户信息失败，继续登录:', profileErr);
        // 用户拒绝授权，继续用微信登录
      }

      // 步骤2：获取登录 code
      const loginRes = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout')), 10000);
        wx.login({
          success: resolve,
          fail: reject
        });
      });

      if (!loginRes || !loginRes.code) {
        wx.hideLoading();
        app.toast('获取登录凭证失败，请检查网络后重试');
        return;
      }

      // 步骤3：提交到后端
      const res = await app.request({
        url: '/api/auth/wechat-login',
        method: 'POST',
        data: {
          code: loginRes.code,
          ...userInfo
        }
      });

      wx.hideLoading();

      if (res.code === 0) {
        // 保存登录信息
        wx.setStorageSync('token', res.data.token);
        if (res.data.openid) {
          wx.setStorageSync('openid', res.data.openid);
        }

        const mergedUserInfo = { ...res.data.userInfo, ...userInfo };
        wx.setStorageSync('userInfo', mergedUserInfo);
        app.globalData.userInfo = mergedUserInfo;
        app.globalData.openid = res.data.openid || '';

        if (res.data.needBind || res.data.isBind === false) {
          // 需要绑定教务账号
          app.globalData.isBindAccount = false;
          wx.showModal({
            title: '登录成功',
            content: '请绑定教务账号以解锁完整功能',
            showCancel: false,
            success: () => {
              // 保持当前页面，让用户选择绑定方式
              this.setData({ 
                isBindAccount: false, 
                userInfo: mergedUserInfo 
              });
            }
          });
        } else {
          // 已绑定，直接进入主页
          app.globalData.isBindAccount = true;
          wx.showModal({
            title: '登录成功',
            content: '欢迎使用智慧校园',
            showCancel: false,
            success: () => {
              wx.switchTab({ url: '/pages/index/index' });
            }
          });
        }
      } else {
        app.toast(res.message || '登录失败，请稍后重试');
      }
    } catch (err) {
      wx.hideLoading();
      console.error('微信登录失败:', err);
      if (err.errMsg && err.errMsg.includes('auth deny')) {
        app.toast('您取消了授权，请重试');
      } else if (err.message === 'timeout') {
        app.toast('网络超时，请检查网络后重试');
      } else {
        app.toast('登录失败，请稍后重试');
      }
    }
  },

  // ========== 手机号登录 ==========
  onPhoneInput(e) {
    this.setData({ phone: e.detail.value });
  },

  onVerifyCodeInput(e) {
    this.setData({ verifyCode: e.detail.value });
  },

  async sendVerifyCode() {
    const { phone, verifyCodeDisabled } = this.data;
    
    if (verifyCodeDisabled) return;
    
    if (!phone || phone.length !== 11) {
      app.toast('请输入正确的手机号');
      return;
    }

    this.setData({ verifyCodeDisabled: true, countdown: 60 });
    
    try {
      const res = await app.request({
        url: '/api/auth/send-verify-code',
        method: 'POST',
        data: { phone }
      });

      if (res.code === 0) {
        app.toast('验证码已发送');
        this.startCountdown();
      } else {
        app.toast(res.message || '发送失败');
        this.setData({ verifyCodeDisabled: false });
      }
    } catch (err) {
      app.toast('网络请求失败');
      this.setData({ verifyCodeDisabled: false });
    }
  },

  startCountdown() {
    const { countdown } = this.data;
    if (countdown <= 0) {
      this.setData({ 
        verifyCodeBtnText: '获取验证码', 
        verifyCodeDisabled: false,
        countdown: 60
      });
      return;
    }

    this.setData({ 
      verifyCodeBtnText: `${countdown}秒后重试`,
      countdown: countdown - 1
    });

    setTimeout(() => {
      this.startCountdown();
    }, 1000);
  },

  async handlePhoneLogin() {
    const { phone, verifyCode } = this.data;

    if (!phone || phone.length !== 11) {
      app.toast('请输入正确的手机号');
      return;
    }

    if (!verifyCode || verifyCode.length !== 4) {
      app.toast('请输入4位验证码');
      return;
    }

    this.setData({ loading: true });

    try {
      const res = await app.request({
        url: '/api/auth/phone-login-simple',
        method: 'POST',
        data: { phone, verifyCode }
      });

      if (res.code === 0) {
        wx.setStorageSync('token', res.data.token);
        wx.setStorageSync('userInfo', res.data.userInfo);
        app.globalData.userInfo = res.data.userInfo;
        app.globalData.isBindAccount = res.data.isBind || false;

        wx.showModal({
          title: '登录成功',
          content: res.data.isBind ? '欢迎使用智慧校园' : '登录成功，请绑定教务账号',
          showCancel: false,
          success: () => {
            if (res.data.isBind) {
              wx.switchTab({ url: '/pages/index/index' });
            }
          }
        });
      } else {
        app.toast(res.message || '登录失败');
      }
    } catch (err) {
      app.toast('网络请求失败');
    } finally {
      this.setData({ loading: false });
    }
  },

  // ========== 学号密码登录 ==========
  onStudentIdInput(e) {
    this.setData({ studentId: e.detail.value });
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value });
  },

  togglePassword() {
    this.setData({ showPassword: !this.data.showPassword });
  },

  async handleBind() {
    const { studentId, password } = this.data;

    if (!studentId || studentId.length < 4) {
      app.toast('请输入正确的学号');
      return;
    }

    if (!password || password.length < 4) {
      app.toast('密码长度不能少于4位');
      return;
    }

    this.setData({ loading: true });

    try {
      const res = await app.request({
        url: '/api/auth/bind',
        method: 'POST',
        data: { studentId, password }
      });

      if (res.code === 0) {
        wx.setStorageSync('token', res.data.token);
        wx.setStorageSync('userInfo', res.data.userInfo);
        app.globalData.isBindAccount = true;
        app.globalData.userInfo = res.data.userInfo;

        wx.showModal({
          title: '绑定成功',
          content: '恭喜您已成功绑定教务账号',
          showCancel: false,
          success: () => {
            wx.switchTab({ url: '/pages/index/index' });
          }
        });
      } else {
        app.toast(res.message || '绑定失败');
      }
    } catch (err) {
      console.error('绑定失败:', err);
      app.toast('网络请求失败，请检查网络后重试');
    } finally {
      this.setData({ loading: false });
    }
  },

  // ========== 页面跳转 ==========
  goHelp() {
    wx.showModal({
      title: '帮助',
      content: '1. 微信登录：授权获取微信信息快速登录\n2. 手机号登录：输入手机号和验证码登录\n3. 账号登录：使用学号和教务密码登录\n\n如有疑问，请联系管理员',
      showCancel: false
    });
  },

  goPrivacy() {
    wx.showModal({
      title: '隐私政策',
      content: '我们非常重视您的隐私保护。所有登录信息仅用于验证身份，不会被泄露或用于其他目的。',
      showCancel: false
    });
  }
});
