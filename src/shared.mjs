// Core logic: no dependencies, pure functions where possible (easy to test).

export const CITIES = {
  delhi: { name: 'Delhi', lat: 28.61, lon: 77.21 },
  mumbai: { name: 'Mumbai', lat: 19.08, lon: 72.88 },
  kolkata: { name: 'Kolkata', lat: 22.57, lon: 88.36 },
  chennai: { name: 'Chennai', lat: 13.08, lon: 80.27 },
  bengaluru: { name: 'Bengaluru', lat: 12.97, lon: 77.59 },
  hyderabad: { name: 'Hyderabad', lat: 17.39, lon: 78.49 },
  pune: { name: 'Pune', lat: 18.52, lon: 73.86 },
  lucknow: { name: 'Lucknow', lat: 26.85, lon: 80.95 },
  patna: { name: 'Patna', lat: 25.59, lon: 85.14 },
  jaipur: { name: 'Jaipur', lat: 26.91, lon: 75.79 },
  ahmedabad: { name: 'Ahmedabad', lat: 23.02, lon: 72.57 },
  chandigarh: { name: 'Chandigarh', lat: 30.73, lon: 76.78 },
};

// CPCB-style breakpoints: [conc low, conc high, index low, index high] (ug/m3)
const PM25 = [[0,30,0,50],[30,60,50,100],[60,90,100,200],[90,120,200,300],[120,250,300,400],[250,380,400,500]];
const PM10 = [[0,50,0,50],[50,100,50,100],[100,250,100,200],[250,350,200,300],[350,430,300,400],[430,700,400,500]];

export function subIndex(c, table) {
  if (!Number.isFinite(c) || c < 0) return NaN;
  for (const [lo, hi, ilo, ihi] of table) {
    if (c <= hi) return ilo + ((ihi - ilo) / (hi - lo)) * (c - lo);
  }
  return 500;
}

export const aqiFrom = (pm25, pm10) => {
  const values = [subIndex(pm25, PM25), subIndex(pm10, PM10)]
    .filter(Number.isFinite);
  return values.length
    ? Math.round(Math.min(500, Math.max(...values)))
    : NaN;
};

export function bandOf(aqi) {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Satisfactory';
  if (aqi <= 200) return 'Moderate';
  if (aqi <= 300) return 'Poor';
  if (aqi <= 400) return 'Very Poor';
  return 'Severe';
}

export function levelOf(aqi) {
  if (aqi <= 100) return 'GO';
  if (aqi <= 200) return 'CAUTION';
  if (aqi <= 300) return 'LIMIT';
  return 'INDOOR';
}

export const LEVELS = {
  GO: {
    headline: 'Lower forecast risk: review the usual outdoor schedule',
    actions: [
      'Consider the usual school outdoor schedule, subject to local guidance.',
      'Check current conditions and official air-quality alerts before activities.',
    ],
  },
  CAUTION: {
    headline: 'Caution: consider reducing strenuous outdoor activity',
    actions: [
      'Consider shortening strenuous outdoor sessions.',
      'Check official air-quality updates and observed conditions during the school day.',
    ],
  },
  LIMIT: {
    headline: 'Higher forecast risk: consider moving strenuous activities indoors',
    actions: [
      'Consider moving strenuous PE, sports and assembly indoors.',
      'Notify staff of the forecast and follow the school air-quality plan.',
      'Check local authority guidance before making schedule decisions.',
    ],
  },
  INDOOR: {
    headline: 'Very high forecast risk: review outdoor activities urgently',
    actions: [
      'Consider postponing outdoor activities while checking current conditions.',
      'Follow applicable local authority instructions and the school air-quality plan.',
      'Communicate the forecast and planned precautions to school staff.',
    ],
  },
};

const inWindow = (t) => { const h = +t.slice(11, 13); return h >= 8 && h <= 15; };

export function buildDay(hourly, date, cityName) {
  const idx = hourly.time.map((_, i) => i).filter((i) =>
    hourly.time[i].startsWith(date) && inWindow(hourly.time[i]) &&
    Number.isFinite(hourly.pm2_5[i]) && Number.isFinite(hourly.pm10[i]) &&
    hourly.pm2_5[i] >= 0 && hourly.pm10[i] >= 0);

  if (idx.length < 4) return null;

  const avg = (a) => idx.reduce((s, i) => s + a[i], 0) / idx.length;
  const pm25 = avg(hourly.pm2_5);
  const pm10 = avg(hourly.pm10);
  const hourlyIndexes = idx.map((i) => aqiFrom(hourly.pm2_5[i], hourly.pm10[i]))
    .filter(Number.isFinite);

  if (hourlyIndexes.length < 4) return null;

  const peak = Math.max(...hourlyIndexes);
  const aqi = peak;
  const level = levelOf(aqi);
  const L = LEVELS[level];
  const band = bandOf(aqi);
  const message = [
    `School air advisory: ${cityName}, ${date}`,
    `School-hours planning index: ${aqi} (${band}); highest hourly value`,
    L.headline,
    ...L.actions.map((a) => `- ${a}`),
    'Forecast-based planning index, not an official CPCB AQI measurement; not medical advice.',
    'Check current conditions and applicable local authority guidance.',
  ].join('\n');

  return {
    date, aqi, peak, band, level,
    headline: L.headline,
    actions: L.actions,
    pm25: Math.round(pm25),
    pm10: Math.round(pm10),
    window: '08:00-16:00',
    hours: idx.map((i) => ({
      time: hourly.time[i].slice(11, 16),
      value: aqiFrom(hourly.pm2_5[i], hourly.pm10[i]),
    })),
    message,
  };
}
export async function fetchForecast(key) {
  const c = CITIES[key];
  if (!c) throw new Error('unknown city');
  const u = new URL('https://air-quality-api.open-meteo.com/v1/air-quality');
  u.search = new URLSearchParams({
    latitude: c.lat, longitude: c.lon, hourly: 'pm2_5,pm10', forecast_days: '2', timezone: 'Asia/Kolkata',
  }).toString();
  const r = await fetch(u, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`forecast upstream ${r.status}`);
  const { hourly } = await r.json();
  const dates = [...new Set(hourly.time.map((t) => t.slice(0, 10)))].slice(0, 2);
  const days = {};
  for (const d of dates) { const x = buildDay(hourly, d, c.name); if (x) days[d] = x; }
  if (!Object.keys(days).length) throw new Error('no usable forecast data');
  return {
    city: key, name: c.name, updated: new Date().toISOString(), dates: Object.keys(days), days,
    source: 'Open-Meteo air-quality forecast (model-based, not a ground sensor)',
  };
}
