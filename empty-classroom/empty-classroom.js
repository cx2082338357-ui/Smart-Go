const app = getApp();
const {
  BUILDING_FILTER_LIST,
  normalizeBuildingName,
  getBuildingOldAlias,
  findBuildingCoordByName,
} = require('../../config/buildings');

const BUILDING_ROOM_TEMPLATES = {
  '春晖学堂（主教）': [
    { room: '101', total: 8, available: 7 }, { room: '102', total: 10, available: 6 },
    { room: '103', total: 12, available: 9 }, { room: '104', total: 10, available: 6 },
    { room: '201', total: 10, available: 3 }, { room: '202', total: 12, available: 7 },
    { room: '203', total: 10, available: 5 }, { room: '301', total: 14, available: 9 },
    { room: '302', total: 12, available: 7 }, { room: '305', total: 11, available: 7 },
  ],
  '文馨书院（二教）': [
    { room: '101', total: 10, available: 7 }, { room: '102', total: 12, available: 8 },
    { room: '103', total: 10, available: 6 }, { room: '201', total: 14, available: 8 },
    { room: '202', total: 12, available: 7 }, { room: '203', total: 10, available: 5 },
    { room: '301', total: 14, available: 9 }, { room: '302', total: 14, available: 3 },
    { room: '303', total: 10, available: 5 }, { room: '405', total: 9, available: 7 },
  ],
  '明德楼': [
    { room: '101', total: 12, available: 9 }, { room: '102', total: 10, available: 7 },
    { room: '103', total: 13, available: 9 }, { room: '201', total: 12, available: 8 },
    { room: '202', total: 10, available: 6 }, { room: '205', total: 10, available: 6 },
    { room: '301', total: 14, available: 9 }, { room: '302', total: 12, available: 7 },
    { room: '305', total: 12, available: 7 }, { room: '306', total: 12, available: 6 },
  ],
  '逸夫楼': [
    { room: '101', total: 12, available: 7 }, { room: '102', total: 10, available: 6 },
    { room: '201', total: 12, available: 7 }, { room: '202', total: 13, available: 8 },
    { room: '203', total: 10, available: 5 }, { room: '301', total: 14, available: 8 },
    { room: '302', total: 12, available: 6 }, { room: '305', total: 15, available: 7 },
    { room: '401', total: 10, available: 4 }, { room: '402', total: 12, available: 6 },
  ],
  '秋实楼': [
    { room: '101', total: 10, available: 6 }, { room: '102', total: 10, available: 5 },
    { room: '103', total: 10, available: 7 }, { room: '104', total: 10, available: 5 },
    { room: '201', total: 12, available: 6 }, { room: '202', total: 10, available: 5 },
    { room: '203', total: 10, available: 4 }, { room: '204', total: 12, available: 6 },
    { room: '305', total: 10, available: 4 }, { room: '306', total: 8, available: 3 },
  ],
  '图书馆': [
    { room: '101', total: 24, available: 15 }, { room: '102', total: 24, available: 14 },
    { room: '201', total: 30, available: 20 }, { room: '202', total: 24, available: 15 },
    { room: '203', total: 24, available: 13 }, { room: '301', total: 28, available: 16 },
    { room: '302', total: 24, available: 10 }, { room: '303', total: 24, available: 12 },
    { room: '401', total: 28, available: 17 }, { room: '405', total: 28, available: 22 },
  ],
};

Page({
  data: {
    classrooms: [],
    filteredClassrooms: {
      available: [],
      limited: [],
      busy: []
    },
    selectedBuilding: '',
    loading: false,
    buildings: BUILDING_FILTER_LIST,
    stats: {
      total: 0,
      available: 0,
      busy: 0
    },
    focusOnly: false,
    sortMode: 'rate',
    lastUpdatedAt: ''
  },

  onLoad(options) {
    const focusOnly = String(options && options.focus || '') === '1';
    const building = decodeURIComponent(String(options && options.building || '').trim());
    if (focusOnly && building) {
      this.setData({ focusOnly: true, selectedBuilding: building });
      wx.setNavigationBarTitle({ title: `${building} · 教室使用情况` });
    }
    this.loadClassrooms();
  },

  onPullDownRefresh() {
    this.loadClassrooms().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  async loadClassrooms() {
    this.setData({ loading: true });

    try {
      const res = await app.request({
        url: '/api/classroom/available'
      });

      if (res.code === 0) {
        this.setData({ lastUpdatedAt: this._fmtTime() });
        this.processClassrooms(this._ensureBuildingRooms(res.data));
      }
    } catch (err) {
      console.error('加载空教室失败:', err);
      this.useMockData();
    } finally {
      this.setData({ loading: false });
    }
  },

  processClassrooms(data) {
    const selected = this.data.selectedBuilding;
    const available = [];
    const limited = [];
    const busy = [];
    const displayList = [];

    const sorted = (data || []).slice().sort((a, b) => {
      if (this.data.sortMode === 'count') {
        return (b.available || 0) - (a.available || 0);
      }
      return (b.availableRate || 0) - (a.availableRate || 0);
    });

    sorted.forEach(item => {
      const displayName = normalizeBuildingName(item.name);
      const displayBuilding = normalizeBuildingName(item.building || item.name);
      const processed = {
        ...item,
        name: displayName,
        building: displayBuilding,
        status: this.getStatus(item.availableRate),
        statusText: this.getStatusText(item.availableRate),
        statusIcon: this.getStatusIcon(item.availableRate),
        statusColor: this.getStatusColor(item.availableRate)
      };

      if (selected) {
        const oldAlias = getBuildingOldAlias(selected);
        const hit =
          processed.name.includes(selected) ||
          processed.building.includes(selected) ||
          String(item.name || '').includes(oldAlias) ||
          String(item.building || '').includes(oldAlias);
        if (!hit) return;
      }

      displayList.push(processed);
      if (item.availableRate >= 70) {
        available.push(processed);
      } else if (item.availableRate >= 40) {
        limited.push(processed);
      } else {
        busy.push(processed);
      }
    });

    this.setData({
      classrooms: displayList,
      filteredClassrooms: { available, limited, busy },
      stats: {
        total: displayList.length,
        available: available.length + limited.length,
        limited: limited.length,
        busy: busy.length
      }
    });
  },

  _ensureBuildingRooms(data) {
    const base = (data || []).map(item => ({
      ...item,
      name: normalizeBuildingName(item.name),
      building: normalizeBuildingName(item.building || item.name)
    }));

    const byName = new Map();
    base.forEach(item => byName.set(String(item.name || '').trim(), item));

    Object.keys(BUILDING_ROOM_TEMPLATES).forEach(building => {
      BUILDING_ROOM_TEMPLATES[building].forEach(t => {
        const roomName = `${building} ${t.room}`;
        if (byName.has(roomName)) return;
        byName.set(roomName, {
          name: roomName,
          building,
          total: t.total,
          available: t.available,
          availableRate: Math.round((t.available / t.total) * 100)
        });
      });
    });

    const merged = Array.from(byName.values());
    const rows = merged.filter(item => !Object.prototype.hasOwnProperty.call(BUILDING_ROOM_TEMPLATES, item.name));

    Object.keys(BUILDING_ROOM_TEMPLATES).forEach(building => {
      const rooms = rows.filter(item => String(item.name || '').startsWith(`${building} `));
      const total = rooms.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
      const available = rooms.reduce((sum, item) => sum + (Number(item.available) || 0), 0);
      rows.push({
        name: building,
        building,
        total,
        available,
        availableRate: total > 0 ? Math.round((available / total) * 100) : 0
      });
    });

    return rows;
  },

  useMockData() {
    this.processClassrooms(this._buildTemplateClassrooms());
  },

  _buildTemplateClassrooms() {
    const rows = [];
    Object.keys(BUILDING_ROOM_TEMPLATES).forEach(building => {
      let total = 0;
      let available = 0;
      BUILDING_ROOM_TEMPLATES[building].forEach(t => {
        rows.push({
          name: `${building} ${t.room}`,
          building,
          total: t.total,
          available: t.available,
          availableRate: Math.round((t.available / t.total) * 100)
        });
        total += t.total;
        available += t.available;
      });
      rows.push({
        name: building,
        building,
        total,
        available,
        availableRate: total > 0 ? Math.round((available / total) * 100) : 0
      });
    });
    return rows;
  },

  getStatus(rate) {
    if (rate >= 70) return 'available';
    if (rate >= 40) return 'limited';
    return 'busy';
  },

  getStatusText(rate) {
    if (rate >= 70) return '空余充足';
    if (rate >= 40) return '空余一般';
    return '暂无空余';
  },

  getStatusIcon(rate) {
    if (rate >= 70) return '✓';
    if (rate >= 40) return '~';
    return '×';
  },

  getStatusColor(rate) {
    if (rate >= 70) return '#52c41a';
    if (rate >= 40) return '#faad14';
    return '#f5222d';
  },

  selectBuilding(e) {
    const building = e.currentTarget.dataset.name;
    this.setData({ selectedBuilding: building === this.data.selectedBuilding ? '' : building });
    this.loadClassrooms();
  },

  toggleSort(e) {
    const mode = e.currentTarget.dataset.mode;
    if (!mode) return;
    this.setData({ sortMode: mode });
    // 重排现有数据即可
    this.processClassrooms(this.data.classrooms);
  },

  _fmtTime() {
    const d = new Date();
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  },

  navigateToBuilding(e) {
    const name = String(e.currentTarget.dataset.name || '').trim();
    const campus = app.getCampusLocation();
    let target = {
      latitude: campus.latitude,
      longitude: campus.longitude,
      name: campus.name,
      address: campus.address
    };

    const hit = findBuildingCoordByName(name);
    if (hit) {
      target = {
        latitude: hit.latitude,
        longitude: hit.longitude,
        name: hit.key,
        address: hit.address,
      };
    }

    wx.openLocation({
      latitude: target.latitude,
      longitude: target.longitude,
      name: target.name,
      address: target.address,
      scale: 18,
      fail: () => {
        wx.showModal({
          title: '提示',
          content: '请在微信中开启位置服务以使用导航功能',
          showCancel: false
        });
      }
    });
  }
});
