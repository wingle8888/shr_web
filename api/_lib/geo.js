const COUNTRY_ZH = {
  CN: "中国",
  HK: "中国香港",
  MO: "中国澳门",
  TW: "中国台湾",
  US: "美国",
  JP: "日本",
  KR: "韩国",
  SG: "新加坡",
  MY: "马来西亚",
  TH: "泰国",
  VN: "越南",
  PH: "菲律宾",
  ID: "印度尼西亚",
  IN: "印度",
  AU: "澳大利亚",
  NZ: "新西兰",
  GB: "英国",
  DE: "德国",
  FR: "法国",
  IT: "意大利",
  ES: "西班牙",
  NL: "荷兰",
  BE: "比利时",
  CH: "瑞士",
  SE: "瑞典",
  NO: "挪威",
  DK: "丹麦",
  FI: "芬兰",
  RU: "俄罗斯",
  UA: "乌克兰",
  PL: "波兰",
  CZ: "捷克",
  AT: "奥地利",
  IE: "爱尔兰",
  PT: "葡萄牙",
  GR: "希腊",
  TR: "土耳其",
  SA: "沙特阿拉伯",
  AE: "阿联酋",
  IL: "以色列",
  EG: "埃及",
  ZA: "南非",
  NG: "尼日利亚",
  BR: "巴西",
  MX: "墨西哥",
  AR: "阿根廷",
  CL: "智利",
  CO: "哥伦比亚",
  CA: "加拿大",
  KH: "柬埔寨",
  LA: "老挝",
  MM: "缅甸",
  BD: "孟加拉国",
  PK: "巴基斯坦",
  NP: "尼泊尔",
  LK: "斯里兰卡",
  KZ: "哈萨克斯坦",
  UZ: "乌兹别克斯坦",
  MN: "蒙古",
  KP: "朝鲜",
};

const CN_REGION_ZH = {
  AH: "安徽",
  BJ: "北京",
  CQ: "重庆",
  FJ: "福建",
  GD: "广东",
  GS: "甘肃",
  GX: "广西",
  GZ: "贵州",
  HA: "河南",
  HB: "湖北",
  HE: "河北",
  HI: "海南",
  HL: "黑龙江",
  HN: "湖南",
  JL: "吉林",
  JS: "江苏",
  JX: "江西",
  LN: "辽宁",
  NM: "内蒙古",
  NX: "宁夏",
  QH: "青海",
  SC: "四川",
  SD: "山东",
  SH: "上海",
  SN: "陕西",
  SX: "山西",
  TJ: "天津",
  XJ: "新疆",
  XZ: "西藏",
  YN: "云南",
  ZJ: "浙江",
  TW: "台湾",
  HK: "香港",
  MO: "澳门",
};

const CN_CITY_ZH = {
  beijing: "北京",
  shanghai: "上海",
  tianjin: "天津",
  chongqing: "重庆",
  shenzhen: "深圳",
  guangzhou: "广州",
  dongguan: "东莞",
  foshan: "佛山",
  zhuhai: "珠海",
  zhongshan: "中山",
  huizhou: "惠州",
  hangzhou: "杭州",
  ningbo: "宁波",
  wenzhou: "温州",
  nanjing: "南京",
  suzhou: "苏州",
  wuxi: "无锡",
  hefei: "合肥",
  fuzhou: "福州",
  xiamen: "厦门",
  nanchang: "南昌",
  jinan: "济南",
  qingdao: "青岛",
  zhengzhou: "郑州",
  wuhan: "武汉",
  changsha: "长沙",
  chengdu: "成都",
  chongqing: "重庆",
  kunming: "昆明",
  guiyang: "贵阳",
  nanning: "南宁",
  haikou: "海口",
  sanya: "三亚",
  xian: "西安",
  "xi'an": "西安",
  lanzhou: "兰州",
  yinchuan: "银川",
  xining: "西宁",
  urumqi: "乌鲁木齐",
  lhasa: "拉萨",
  shenyang: "沈阳",
  dalian: "大连",
  changchun: "长春",
  harbin: "哈尔滨",
  taiyuan: "太原",
  shijiazhuang: "石家庄",
  baoding: "保定",
  tangshan: "唐山",
};

function clean(value) {
  return String(value || "").trim();
}

const COUNTRY_EN = {
  china: "CN",
  "hong kong": "HK",
  macau: "MO",
  macao: "MO",
  taiwan: "TW",
  "united states": "US",
  usa: "US",
  america: "US",
  "united kingdom": "GB",
  england: "GB",
  britain: "GB",
  japan: "JP",
  korea: "KR",
  "south korea": "KR",
  singapore: "SG",
  malaysia: "MY",
  thailand: "TH",
  vietnam: "VN",
  philippines: "PH",
  indonesia: "ID",
  india: "IN",
  australia: "AU",
  "new zealand": "NZ",
  germany: "DE",
  france: "FR",
  italy: "IT",
  spain: "ES",
  netherlands: "NL",
  holland: "NL",
  belgium: "BE",
  switzerland: "CH",
  sweden: "SE",
  norway: "NO",
  denmark: "DK",
  finland: "FI",
  russia: "RU",
  ukraine: "UA",
  poland: "PL",
  canada: "CA",
  brazil: "BR",
  mexico: "MX",
  argentina: "AR",
  chile: "CL",
  turkey: "TR",
  israel: "IL",
  egypt: "EG",
  "south africa": "ZA",
  "saudi arabia": "SA",
  uae: "AE",
  "united arab emirates": "AE",
  portugal: "PT",
  greece: "GR",
  ireland: "IE",
  austria: "AT",
  "czech republic": "CZ",
  czechia: "CZ",
  mongolia: "MN",
  pakistan: "PK",
  bangladesh: "BD",
  cambodia: "KH",
  myanmar: "MM",
  laos: "LA",
  nepal: "NP",
};

function normalizeCountryCode(code) {
  let key = clean(code).toUpperCase();
  if (key === "UK") key = "GB";
  if (!/^[A-Z]{2}$/.test(key) || key === "XX" || key === "T1" || key === "ZZ") return "";
  return key;
}

function countryName(code) {
  const key = normalizeCountryCode(code) || clean(code).toUpperCase();
  if (!key || key === "UN" || key === "XX" || key === "T1" || key === "ZZ") return "";
  if (COUNTRY_ZH[key]) return COUNTRY_ZH[key];
  try {
    const label = new Intl.DisplayNames(["zh-CN"], { type: "region" }).of(key);
    if (label) return label;
  } catch (_) {}
  return key;
}

function inferCountryFromText(text) {
  const raw = clean(text);
  if (!raw) return "";
  const upper = raw.toUpperCase();
  if (/^[A-Z]{2}$/.test(upper)) return normalizeCountryCode(upper);
  if (/香港|hong\s*kong/i.test(raw)) return "HK";
  if (/澳门|macau|macao/i.test(raw)) return "MO";
  if (/台湾|taiwan/i.test(raw)) return "TW";
  for (const [code, name] of Object.entries(COUNTRY_ZH)) {
    if (name && raw.includes(name)) return code;
  }
  const lower = raw.toLowerCase();
  const aliases = Object.keys(COUNTRY_EN).sort((a, b) => b.length - a.length);
  for (let i = 0; i < aliases.length; i++) {
    const name = aliases[i];
    if (lower.includes(name)) return COUNTRY_EN[name];
  }
  if (/[省市自治区特别行政区]|北京|上海|天津|重庆|深圳|广州|杭州|成都|武汉|南京|苏州|西安|东莞|佛山/.test(raw)) {
    return "CN";
  }
  return "";
}

function resolveOrderCountry(order) {
  const shipping = (order && order.shipping) || {};
  return (
    normalizeCountryCode(order && order.countryCode) ||
    normalizeCountryCode(order && order.place && order.place.countryCode) ||
    inferCountryFromText(
      [shipping.country, shipping.region, shipping.city, shipping.address, shipping.zip].filter(Boolean).join(" ")
    )
  );
}

function buildGeoStats(visitCountries, orders) {
  const map = new Map();
  function ensure(code) {
    const cc = normalizeCountryCode(code) || "UN";
    if (!map.has(cc)) {
      map.set(cc, {
        code: cc,
        name: cc === "UN" ? "未知地区" : countryName(cc) || cc,
        visits: 0,
        visitors: 0,
        orders: 0,
      });
    }
    return map.get(cc);
  }
  (Array.isArray(visitCountries) ? visitCountries : []).forEach((row) => {
    const item = ensure(row && row.code);
    item.visits += Number(row && (row.pv != null ? row.pv : row.visits)) || 0;
    item.visitors += Number(row && (row.uv != null ? row.uv : row.visitors)) || 0;
    if (row && row.name && item.code !== "UN" && item.name === item.code) item.name = row.name;
  });
  (Array.isArray(orders) ? orders : []).forEach((order) => {
    ensure(resolveOrderCountry(order) || "UN").orders += 1;
  });
  return Array.from(map.values())
    .map((row) => ({ ...row, total: row.visits + row.orders }))
    .sort((a, b) => b.total - a.total || b.visits - a.visits || b.orders - a.orders);
}

function regionName(country, region, regionCode) {
  const cc = clean(country).toUpperCase();
  const code = clean(regionCode).toUpperCase();
  if ((cc === "CN" || cc === "HK" || cc === "MO" || cc === "TW") && CN_REGION_ZH[code]) {
    return CN_REGION_ZH[code];
  }
  return clean(region);
}

function cityName(country, city) {
  const raw = clean(city);
  if (!raw) return "";
  const cc = clean(country).toUpperCase();
  if (cc === "CN" || cc === "HK" || cc === "MO" || cc === "TW") {
    const mapped = CN_CITY_ZH[raw.toLowerCase()];
    if (mapped) return mapped;
  }
  return raw;
}

function fromCf(cf, headers) {
  const country =
    clean(cf && cf.country) ||
    clean(headers && (headers["cf-ipcountry"] || headers["CF-IPCountry"]));
  return {
    countryCode: normalizeCountryCode(country),
    country: countryName(country),
    region: regionName(country, cf && cf.region, cf && cf.regionCode),
    regionCode: clean(cf && cf.regionCode).toUpperCase(),
    city: cityName(country, cf && cf.city),
    timezone: clean(cf && cf.timezone),
    continent: clean(cf && cf.continent).toUpperCase(),
  };
}

function formatRegisterPlace(place) {
  if (!place || typeof place !== "object") return "";
  const parts = [place.country, place.region, place.city].map(clean).filter(Boolean);
  const unique = [];
  parts.forEach((part) => {
    if (!unique.includes(part)) unique.push(part);
  });
  if (unique.length) return unique.join(" · ");
  if (place.timezone) return String(place.timezone);
  return "";
}

function normalizePlace(raw) {
  if (!raw || typeof raw !== "object") return null;
  const place = {
    countryCode: clean(raw.countryCode || raw.country).toUpperCase().slice(0, 8),
    country: clean(raw.countryName || raw.country),
    region: clean(raw.region),
    regionCode: clean(raw.regionCode).toUpperCase().slice(0, 8),
    city: clean(raw.city).slice(0, 80),
    timezone: clean(raw.timezone).slice(0, 80),
    continent: clean(raw.continent).toUpperCase().slice(0, 8),
  };
  if (place.countryCode && !place.country) place.country = countryName(place.countryCode);
  place.label = formatRegisterPlace(place);
  if (!place.label && !place.timezone && !place.countryCode) return null;
  return place;
}

function readRegisterPlace(req, body) {
  const headers = (req && req.headers) || {};
  const fromReq = fromCf((req && req.cf) || null, headers);
  const client = body && typeof body === "object" ? body : {};
  if (!fromReq.timezone) fromReq.timezone = clean(client.timezone);
  if (!fromReq.countryCode && fromReq.timezone === "Asia/Shanghai") {
    fromReq.countryCode = "CN";
    fromReq.country = "中国";
  }
  return normalizePlace(fromReq);
}

module.exports = {
  readRegisterPlace,
  formatRegisterPlace,
  normalizePlace,
  countryName,
  normalizeCountryCode,
  inferCountryFromText,
  resolveOrderCountry,
  buildGeoStats,
};
