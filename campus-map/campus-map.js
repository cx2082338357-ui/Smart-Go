const app = getApp();
const DEFAULT_POI_IMAGE = '/images/campus-place.svg';
const { BUILDING_COORDS } = require('../../config/buildings');

Page({
  data: {
    markers: [],
    latitude: 40.6205,
    longitude: 109.8309,
    scale: 16,
    pois: [
      { id: 1, name: "内蒙古科技大学（主校区）", desc: "内蒙古自治区包头市昆都仑区阿尔丁大街7号", latitude: 40.6205, longitude: 109.8309, photo: "/images/imust-main-campus.jpg" },
      { id: 2, name: "小足球场", desc: "校园运动场地", latitude: 40.6215, longitude: 109.8324, photo: "/images/small-football-field.jpg" },
      { id: 3, name: "文馨书院（二教）", desc: "第二教学楼（文馨书院）", latitude: BUILDING_COORDS['文馨书院（二教）'].latitude, longitude: BUILDING_COORDS['文馨书院（二教）'].longitude, photo: "/images/wenxin-shuyuan-erjiao.jpg" },
      { id: 4, name: "秋实楼", desc: "教学与活动综合楼", latitude: BUILDING_COORDS['秋实楼'].latitude, longitude: BUILDING_COORDS['秋实楼'].longitude, photo: "/images/qiushi-building.jpg" },
      { id: 5, name: "体育馆", desc: "体育课及健身", latitude: 40.6214, longitude: 109.8264, photo: "/images/gymnasium.jpg" },
      { id: 6, name: "工程训练中心（创新创业中心）", desc: "工程训练与创新创业实践场地", latitude: 40.6216, longitude: 109.8296, photo: "/images/engineering-training-center.jpg" },
      { id: 7, name: "校医院", desc: "校内医疗服务", latitude: 40.6207, longitude: 109.8359, photo: "/images/campus-hospital.jpg" },
      { id: 8, name: "图书馆", desc: "学习阅览中心", latitude: BUILDING_COORDS['图书馆'].latitude, longitude: BUILDING_COORDS['图书馆'].longitude, photo: "/images/library.jpg" },
      { id: 9, name: "快递服务点", desc: "校内快递取件", latitude: 40.6224, longitude: 109.8310, photo: "/images/express-station.jpg" },
      { id: 10, name: "大操场", desc: "校园运动场地", latitude: 40.6218, longitude: 109.8276, photo: "/images/main-playground.jpg" },
      { id: 11, name: "春晖学堂（主教）", desc: "主教学楼（春晖学堂）", latitude: BUILDING_COORDS['春晖学堂（主教）'].latitude, longitude: BUILDING_COORDS['春晖学堂（主教）'].longitude, photo: "/images/chunhui-academy-main-teaching.jpg" },
      { id: 12, name: "活动中心", desc: "校园活动中心", latitude: 40.6212, longitude: 109.8347, photo: "/images/activity-center.jpg" },
      { id: 13, name: "喣园", desc: "食堂", latitude: 40.6226, longitude: 109.8345, photo: "/images/xuyuan-canteen.jpg" },
      { id: 14, name: "明德楼", desc: "教学楼", latitude: BUILDING_COORDS['明德楼'].latitude, longitude: BUILDING_COORDS['明德楼'].longitude, photo: "/images/mingde-building.jpg" },
      { id: 15, name: "逸夫楼", desc: "教学楼", latitude: BUILDING_COORDS['逸夫楼'].latitude, longitude: BUILDING_COORDS['逸夫楼'].longitude, photo: "/images/yifu-building.jpg" },
      { id: 16, name: "颐园", desc: "食堂", latitude: 40.6226, longitude: 109.8293, photo: "/images/yiyuan-canteen.jpg" },
      { id: 20, name: "和园", desc: "食堂", latitude: 40.62198, longitude: 109.83438, photo: "/images/campus-place.svg" },
      { id: 17, name: "内蒙古科技大学东校区", desc: "内蒙古科技大学东校区", latitude: 40.6194, longitude: 109.8395, photo: "/images/imust-east-campus.jpg" },
      { id: 18, name: "东区操场", desc: "东区运动场地", latitude: 40.6194, longitude: 109.8407, photo: "/images/east-campus-playground.jpg" },
      { id: 19, name: "梅园", desc: "食堂", latitude: 40.6186, longitude: 109.8400, photo: "/images/meiyuan-canteen.jpg" },
    ]
  },

  onLoad() {
    this.applyCampusLocation();
    this.initMarkers();
  },

  enrichPois(pois) {
    return (pois || []).map((poi) => ({
      ...poi,
      photo: poi.photo || DEFAULT_POI_IMAGE,
      iconPath: poi.iconPath || '/assets/icons/location.png'
    }));
  },

  applyCampusLocation() {
    const campus = app.getCampusLocation();
    const pois = this.enrichPois(this.data.pois.slice());
    if (pois.length > 0) {
      pois[0] = {
        ...pois[0],
        latitude: campus.latitude,
        longitude: campus.longitude,
        name: campus.name,
        desc: campus.address
      };
    }
    this.setData({
      latitude: campus.latitude,
      longitude: campus.longitude,
      pois
    });
  },

  initMarkers() {
    const markers = this.data.pois.map((poi) => ({
      id: poi.id,
      latitude: poi.latitude,
      longitude: poi.longitude,
      title: poi.name,
      width: 30,
      height: 30,
      iconPath: poi.iconPath || '/assets/icons/location.png',
      callout: {
        content: poi.name,
        color: '#333',
        fontSize: 12,
        borderRadius: 4,
        padding: 6,
        display: 'ALWAYS',
        bgColor: '#fff'
      }
    }));
    this.setData({ markers });
  },

  onMarkerTap(e) {
    const markerId = e.detail.markerId;
    const poi = this.data.pois.find(p => p.id === markerId);
    if (poi) {
      wx.showModal({
        title: poi.name,
        content: poi.desc,
        confirmText: '导航',
        cancelText: '关闭',
        success: (res) => {
          if (res.confirm) {
            this.navigateTo(poi);
          }
        }
      });
    }
  },

  navigateTo(poi) {
    // 直接打开地图定位（不依赖 getLocation 权限）
    wx.openLocation({
      latitude: poi.latitude,
      longitude: poi.longitude,
      name: poi.name,
      address: poi.desc,
      scale: 18,
      fail: () => {
        wx.showModal({
          title: '提示',
          content: '请在微信中开启位置服务：\n我 > 设置 > 通用 > 功能 > 位置服务 > 开启',
          confirmText: '去设置',
          success: (res) => {
            if (res.confirm) wx.openSetting();
          }
        });
      }
    });
  },

  goToPoi(e) {
    const index = e.currentTarget.dataset.index;
    const poi = this.data.pois[index];
    if (poi) this.navigateTo(poi);
  },

  navigateToPoiByName(name) {
    const poi = (this.data.pois || []).find(item => item.name === name);
    if (!poi) {
      wx.showToast({ title: '未找到该地点', icon: 'none' });
      return;
    }
    this.navigateTo(poi);
  },

  showTeachingBuildingOptions() {
    const options = ['秋实楼', '逸夫楼', '明德楼', '春晖学堂（主教）', '文馨书院（二教）'];

    wx.showActionSheet({
      itemList: options,
      success: (res) => {
        const targetName = options[res.tapIndex];
        if (targetName) this.navigateToPoiByName(targetName);
      }
    });
  },

  showCanteenOptions() {
    const options = ['颐园', '喣园', '和园', '梅园'];
    wx.showActionSheet({
      itemList: options,
      success: (res) => {
        const targetName = options[res.tapIndex];
        if (targetName) this.navigateToPoiByName(targetName);
      }
    });
  },

  goToLibrary() {
    this.navigateToPoiByName('图书馆');
  },

  goToGym() {
    this.navigateToPoiByName('体育馆');
  }
});
