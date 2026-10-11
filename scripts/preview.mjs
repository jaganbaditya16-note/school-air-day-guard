// Run the logic with no AWS account: node scripts/preview.mjs delhi
import { fetchForecast, CITIES } from '../src/shared.mjs';
const key = process.argv[2] || 'delhi';
if (!CITIES[key]) { console.error('Cities:', Object.keys(CITIES).join(', ')); process.exit(1); }
const data = await fetchForecast(key);
for (const d of data.dates) console.log(`\n${data.days[d].message}`);
