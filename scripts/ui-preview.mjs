// Local-only UI preview server for School Air-Day Guard.
// Serves src/index.html and routes forecast requests to the existing Open-Meteo fetcher.
// Email subscriptions stay disabled here because they require AWS SNS.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { CITIES, fetchForecast } from '../src/shared.mjs';

const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT || 4173);
const htmlUrl = new URL('../src/index.html', import.meta.url);

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(type.startsWith('application/json') ? JSON.stringify(body) : body);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${HOST}:${PORT}`);
  try {
    if (req.method === 'GET' && url.pathname === '/favicon.ico') {
      res.writeHead(204);
      return res.end();
    }    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      let html = await readFile(htmlUrl, 'utf8');
      const localPreviewNotice = `<script>
(() => {
  const email = document.getElementById("email");
  const button = document.getElementById("sub");
  const status = document.getElementById("smsg");
  if (email) {
    email.disabled = true;
    email.placeholder = "Available after AWS deployment";
  }
  if (button) {
    button.disabled = true;
    button.textContent = "Available after deployment";
    button.setAttribute("aria-describedby", "smsg");
  }
  if (status) {
    status.textContent = "Email subscriptions are disabled in the local preview; AWS SNS is required to test this feature.";
  }
})();
</script>`;
      html = html.replace('</body>', `${localPreviewNotice}</body>`);
      return send(res, 200, html, 'text/html; charset=utf-8');
    }
    if (req.method === 'GET' && url.pathname === '/api/cities') {
      const cities = Object.fromEntries(Object.entries(CITIES).map(([key, city]) => [key, city.name]));
      return send(res, 200, { cities });
    }
    if (req.method === 'GET' && url.pathname.startsWith('/api/advisory/')) {
      const key = decodeURIComponent(url.pathname.slice('/api/advisory/'.length));
      if (!Object.hasOwn(CITIES, key)) return send(res, 404, { error: 'Unknown city' });
      const forecast = await fetchForecast(key);
      return send(res, 200, forecast);
    }
    if (req.method === 'POST' && url.pathname === '/api/subscribe') {
      return send(res, 501, {
        error: 'Email subscriptions are disabled in the local preview. Deploy to AWS to test this feature.',
      });
    }
    return send(res, 404, { error: 'Not found' });
  } catch (error) {
    console.error('Local preview request failed:', error?.message || error);
    return send(res, 502, { error: 'Forecast data is unavailable right now. Please try again shortly.' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`School Air-Day Guard UI preview: http://${HOST}:${PORT}`);
  console.log('Uses live Open-Meteo forecasts. Email subscription is disabled in local preview.');
  console.log('Press Ctrl+C to stop.');
});
