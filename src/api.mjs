import { readFileSync } from 'node:fs';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { SNSClient, SubscribeCommand } from '@aws-sdk/client-sns';
import { CITIES, fetchForecast } from './shared.mjs';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const sns = new SNSClient({});
const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');

const SEC = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'",
};
const send = (status, body, type, extra = {}) =>
  ({ statusCode: status, headers: { 'Content-Type': type, ...SEC, ...extra }, body });
const json = (status, obj, extra) => send(status, JSON.stringify(obj), 'application/json; charset=utf-8', extra);

async function getAdvisory(key) {
  const got = await db.send(new GetCommand({ TableName: process.env.TABLE, Key: { city: key } }));
  const fresh = got.Item && Date.now() - Date.parse(got.Item.data.updated) < 12 * 3600 * 1000;
  if (fresh) return got.Item.data;
  try {                                   // stale or missing: refresh on demand
    const data = await fetchForecast(key);
    await db.send(new PutCommand({ TableName: process.env.TABLE,
      Item: { city: key, data, ttl: Math.floor(Date.now() / 1000) + 2 * 86400 } }));
    return data;
  } catch (e) {
    if (got.Item) return { ...got.Item.data, stale: true };  // serve last known data, flagged
    throw e;
  }
}

export const handler = async (event) => {
  const { method } = event.requestContext.http;
  const path = event.rawPath;
  try {
    if (method === 'GET' && path === '/') return send(200, html, 'text/html; charset=utf-8');
    if (method === 'GET' && path === '/api/cities') {
      return json(200, { cities: Object.fromEntries(Object.entries(CITIES).map(([k, v]) => [k, v.name])) },
        { 'Cache-Control': 'public, max-age=86400' });
    }
    if (method === 'GET' && path.startsWith('/api/advisory/')) {
      const key = decodeURIComponent(path.slice('/api/advisory/'.length));
      if (!Object.hasOwn(CITIES, key)) return json(404, { error: 'Unknown city' });
      return json(200, await getAdvisory(key), { 'Cache-Control': 'public, max-age=300' });
    }
    if (method === 'POST' && path === '/api/subscribe') {
      let b; try { b = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid request' }); }
      const email = String(b.email || '').trim();
      if (email.length > 254 || !/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(email)) return json(400, { error: 'Enter a valid email address' });
      if (!Object.hasOwn(CITIES, b.city)) return json(400, { error: 'Choose a city' });
      await sns.send(new SubscribeCommand({
        TopicArn: process.env.TOPIC_ARN, Protocol: 'email', Endpoint: email,
        Attributes: { FilterPolicy: JSON.stringify({ city: [b.city] }) },
      }));
      return json(200, { message: 'Check your inbox and confirm to start receiving alerts.' });
    }
    return json(404, { error: 'Not found' });
  } catch (e) {
    console.error(e);
    return json(502, { error: 'Air data is unavailable right now. Please try again shortly.' });
  }
};
