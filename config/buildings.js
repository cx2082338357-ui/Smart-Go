const BUILDING_ALIAS_MAP = {
  '教学楼A': '春晖学堂（主教）',
  '教学楼B': '文馨书院（二教）',
  '教学楼C': '明德楼',
  '实验楼': '逸夫楼',
  '综合楼': '秋实楼',
};

const BUILDING_FILTER_LIST = [
  '春晖学堂（主教）',
  '文馨书院（二教）',
  '明德楼',
  '逸夫楼',
  '秋实楼',
  '图书馆',
];

const BUILDING_COORDS = {
  '内蒙古科技大学（主校区）': { latitude: 40.6205, longitude: 109.8309, address: '内蒙古自治区包头市昆都仑区阿尔丁大街7号' },
  '春晖学堂（主教）': { latitude: 40.6198, longitude: 109.8347, address: '春晖学堂（主教）' },
  '文馨书院（二教）': { latitude: 40.6199, longitude: 109.8301, address: '文馨书院（二教）' },
  '明德楼': { latitude: 40.6200, longitude: 109.8269, address: '明德楼' },
  '逸夫楼': { latitude: 40.6200, longitude: 109.8260, address: '逸夫楼' },
  '秋实楼': { latitude: 40.6197, longitude: 109.8281, address: '秋实楼' },
  '图书馆': { latitude: 40.6197, longitude: 109.8317, address: '图书馆' }
};

const BUILDING_REVERSE_ALIAS_MAP = Object.keys(BUILDING_ALIAS_MAP).reduce((acc, oldName) => {
  acc[BUILDING_ALIAS_MAP[oldName]] = oldName;
  return acc;
}, {});

function normalizeBuildingName(name) {
  const raw = String(name || '');
  for (const oldName of Object.keys(BUILDING_ALIAS_MAP)) {
    const newName = BUILDING_ALIAS_MAP[oldName];
    if (raw === oldName) return newName;
    if (raw.startsWith(oldName + ' ')) return raw.replace(oldName + ' ', newName + ' ');
    if (raw.startsWith(oldName)) return raw.replace(oldName, newName);
  }
  return raw;
}

function getBuildingOldAlias(name) {
  return BUILDING_REVERSE_ALIAS_MAP[name] || name;
}

function findBuildingCoordByName(name) {
  const text = String(name || '');
  for (const key of Object.keys(BUILDING_COORDS)) {
    if (text.includes(key)) return { key, ...BUILDING_COORDS[key] };
  }
  for (const oldName of Object.keys(BUILDING_ALIAS_MAP)) {
    if (!text.includes(oldName)) continue;
    const mapped = BUILDING_ALIAS_MAP[oldName];
    if (BUILDING_COORDS[mapped]) return { key: mapped, ...BUILDING_COORDS[mapped] };
  }
  return null;
}

module.exports = {
  BUILDING_ALIAS_MAP,
  BUILDING_FILTER_LIST,
  BUILDING_COORDS,
  normalizeBuildingName,
  getBuildingOldAlias,
  findBuildingCoordByName,
};
