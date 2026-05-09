const app = getApp();

Page({
  data: {
    // 步骤
    currentStep: 1,
    totalSteps: 4,
    
    // Step 1: 实名认证
    realName: '',
    idCard: '',
    
    // Step 2: 健康证
    healthCertImage: '',
    healthCertPreview: '',
    
    // Step 3: 健康证有效期
    healthCertExpireDate: '',
    healthCertExpireText: '',
    minDate: '',
    
    // Step 4: 人脸核身
    faceVerified: false,
    
    // 提交状态
    loading: false,
    applyResult: null,
    
    // 错误提示
    errors: {}
  },

  onLoad() {
    // 设置最小日期（明天）
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    this.setData({ minDate: tomorrow.toISOString().split('T')[0] });
    
    // 检查是否已有申请记录
    const applyData = wx.getStorageSync('riderApplyData');
    if (applyData) {
      this.setData({ ...applyData });
    }
  },

  // ========== Step 1: 实名认证 ==========
  onRealNameInput(e) {
    this.setData({ realName: e.detail.value, errors: { ...this.data.errors, realName: '' } });
  },

  onIdCardInput(e) {
    let value = e.detail.value.toUpperCase();
    this.setData({ idCard: value, errors: { ...this.data.errors, idCard: '' } });
  },

  validateStep1() {
    const { realName, idCard } = this.data;
    const errors = {};
    
    if (!realName || realName.length < 2) {
      errors.realName = '请输入真实姓名';
    }
    
    if (!idCard || !/^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/.test(idCard)) {
      errors.idCard = '请输入正确的身份证号';
    }
    
    if (Object.keys(errors).length > 0) {
      this.setData({ errors });
      return false;
    }
    return true;
  },

  // 微信一键获取实名（通过 wx.getUserInfo 获取昵称，身份证需手动填写）
  async useWechatProfile() {
    try {
      const res = await new Promise((resolve, reject) => {
        wx.getUserProfile({
          desc: '用于骑手实名认证',
          success: resolve,
          fail: reject
        });
      });
      
      if (res && res.userInfo) {
        this.setData({ 
          realName: res.userInfo.nickName,
          errors: { ...this.data.errors, realName: '' }
        });
        app.toast('已获取微信昵称，请确认是否为真实姓名');
      }
    } catch (err) {
      app.toast('获取失败，请手动输入');
    }
  },

  // ========== Step 2: 健康证 ==========
  chooseHealthCert() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      camera: 'back',
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        const fileSize = res.tempFiles[0].size;
        
        // 检查文件大小 (5MB)
        if (fileSize > 5 * 1024 * 1024) {
          app.toast('图片大小不能超过5MB');
          return;
        }
        
        this.setData({
          healthCertImage: tempFilePath,
          healthCertPreview: tempFilePath,
          errors: { ...this.data.errors, healthCert: '' }
        });
      },
      fail: () => {
        app.toast('请上传健康证照片');
      }
    });
  },

  previewHealthCert() {
    if (!this.data.healthCertPreview) return;
    wx.previewImage({
      urls: [this.data.healthCertPreview],
      current: this.data.healthCertPreview
    });
  },

  removeHealthCert() {
    wx.showModal({
      title: '提示',
      content: '确定要删除健康证照片吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({ healthCertImage: '', healthCertPreview: '' });
        }
      }
    });
  },

  validateStep2() {
    const errors = {};
    if (!this.data.healthCertImage) {
      errors.healthCert = '请上传健康证照片';
    }
    if (Object.keys(errors).length > 0) {
      this.setData({ errors });
      return false;
    }
    return true;
  },

  // ========== Step 3: 有效期 ==========
  onDateChange(e) {
    const dateStr = e.detail.value;
    const date = new Date(dateStr);
    const expireText = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
    this.setData({ 
      healthCertExpireDate: dateStr, 
      healthCertExpireText: expireText,
      errors: { ...this.data.errors, expireDate: '' }
    });
  },

  validateStep3() {
    const errors = {};
    if (!this.data.healthCertExpireDate) {
      errors.expireDate = '请选择健康证有效期';
      this.setData({ errors });
      return false;
    }
    
    // 检查是否已过期
    const now = new Date();
    const expireDate = new Date(this.data.healthCertExpireDate);
    if (expireDate <= now) {
      errors.expireDate = '健康证已过期，请重新办理后再申请';
      this.setData({ errors });
      return false;
    }
    
    return true;
  },

  // ========== Step 4: 人脸核身 ==========
  async startFaceVerify() {
    wx.showLoading({ title: '正在初始化...' });
    
    try {
      // 调用微信人脸核身接口
      const verifyRes = await new Promise((resolve, reject) => {
        wx.checkIsSupportFacialRecognition({
          success: (res) => {
            if (res.result && res.result.supportArrears) {
              // 微信支持人脸核身
              resolve({ support: true });
            } else {
              reject(new Error('不支持'));
            }
          },
          fail: reject
        });
      });
      
      wx.hideLoading();
      
      // 小程序人脸核身需要调用微信的人脸核身组件
      // 这里演示：直接通过（实际需要接入微信人脸核身服务）
      wx.showModal({
        title: '人脸核身',
        content: '请在真实环境中接入微信人脸核身接口。当前为演示模式，是否跳过？',
        confirmText: '演示通过',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            this.setData({ faceVerified: true });
            app.toast('人脸核身通过（演示模式）');
          }
        }
      });
      
    } catch (err) {
      wx.hideLoading();
      console.error('人脸核身失败:', err);
      
      wx.showModal({
        title: '提示',
        content: '人脸核身功能需要在真实环境中使用。当前是否以演示模式继续？',
        confirmText: '演示通过',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            this.setData({ faceVerified: true });
            app.toast('人脸核身通过（演示模式）');
          }
        }
      });
    }
  },

  // ========== 步骤切换 ==========
  nextStep() {
    let valid = false;
    
    switch (this.data.currentStep) {
      case 1:
        valid = this.validateStep1();
        break;
      case 2:
        valid = this.validateStep2();
        break;
      case 3:
        valid = this.validateStep3();
        break;
    }
    
    if (valid) {
      this.setData({ currentStep: this.data.currentStep + 1 });
    }
  },

  prevStep() {
    if (this.data.currentStep > 1) {
      this.setData({ currentStep: this.data.currentStep - 1 });
    } else {
      wx.navigateBack();
    }
  },

  // ========== 提交申请 ==========
  async submitApplication() {
    if (!this.data.faceVerified) {
      app.toast('请完成人脸核身');
      return;
    }

    this.setData({ loading: true });

    try {
      const applyData = {
        realName: this.data.realName,
        idCard: this.data.idCard,
        healthCertImage: this.data.healthCertImage,
        healthCertExpireDate: this.data.healthCertExpireDate,
        faceVerified: this.data.faceVerified,
        applyTime: new Date().toISOString()
      };

      // 保存本地
      wx.setStorageSync('riderApplyData', applyData);

      // 模拟上传到后端
      await new Promise(resolve => setTimeout(resolve, 1500));

      // 演示模式：直接通过
      this.setData({
        loading: false,
        applyResult: {
          success: true,
          status: 'approved',
          message: '恭喜您已通过审核，欢迎成为骑手！',
          riderId: `R${Date.now().toString().slice(-8)}`
        }
      });

      // 同时设置骑手状态
      wx.setStorageSync('isRider', true);
      wx.setStorageSync('riderData', {
        certified: true,
        hasHealthCert: true,
        riderId: this.data.applyResult.riderId,
        realName: this.data.realName
      });

    } catch (err) {
      this.setData({ loading: false });
      app.toast('提交失败，请重试');
    }
  },

  // ========== 完成 ==========
  goDelivery() {
    wx.navigateBack();
  },

  goHome() {
    wx.switchTab({ url: '/pages/index/index' });
  }
});
