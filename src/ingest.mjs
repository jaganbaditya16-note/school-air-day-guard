import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { CITIES, fetchForecast } from './shared.mjs';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const sns = new SNSClient({});

export const handler = async (event = {}) => {
  const keys = Object.keys(CITIES);
  const results = await Promise.allSettled(keys.map(async (key) => {
    const data = await fetchForecast(key);
    await db.send(new PutCommand({
      TableName: process.env.TABLE,
      Item: { city: key, data, ttl: Math.floor(Date.now() / 1000) + 2 * 86400 },
    }));
    const tomorrow = data.days[data.dates[data.dates.length - 1]];
    if (event.alert && data.dates.length === 2 && ['LIMIT', 'INDOOR'].includes(tomorrow.level)) {
      await sns.send(new PublishCommand({
        TopicArn: process.env.TOPIC_ARN,
        Subject: `Air alert: ${data.name} - ${tomorrow.level}`.slice(0, 99),
        Message: tomorrow.message,
        MessageAttributes: { city: { DataType: 'String', StringValue: key } },
      }));
    }
  }));
  const failed = results
    .map((r, i) => (r.status === 'rejected' ? `${keys[i]}: ${r.reason?.message}` : null))
    .filter(Boolean);
  console.log(JSON.stringify({ ok: keys.length - failed.length, failed }));
  return { ok: keys.length - failed.length, failed };
};
