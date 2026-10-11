# School Air-Day Guard

Environmental Hacks (WeMakeDevs x AWS), **Air track**. Tells a school in one of 12 Indian cities whether
tomorrow's school hours (8am-4pm) are safe for outdoor activity, gives concrete actions, a paste-ready WhatsApp
message, and an optional email alert the evening before a bad air day.

## Architecture (all serverless, free tier)
```
EventBridge (06:00 + 18:00 IST) -> Lambda "ingest" -> Open-Meteo air-quality forecast
                                        |-> DynamoDB (cache, TTL 2 days)
                                        '-> SNS topic (evening run, LIMIT/INDOOR days only)
Browser -> API Gateway (HTTP API, throttled) -> Lambda "api" -> serves page + /api/* (DynamoDB, on-demand refresh)
Email subscribers -> SNS email subscription filtered by city
```
Rule-based engine: PM2.5/PM10 -> CPCB-style AQI -> GO / CAUTION / LIMIT / INDOOR. No LLM, so no model cost and no
invented health advice.

## Deploy (about 15 minutes)
1. Create an AWS account (free tier), install AWS CLI and SAM CLI, run `aws configure`.
   Use a temporary IAM user or Identity Center; delete access keys after the hackathon.
2. `sam build && sam deploy --guided` (stack `air-day-guard`, region `ap-south-1`).
   Answer **y** to "ApiFunction has no authorization": the site is public on purpose.
3. Seed data: `aws lambda invoke --function-name <IngestFunctionName output> out.json`
   (the API also fetches on demand, so this is optional).
4. Open the `SiteUrl` output. Test it signed out and on your phone.
5. Cost guard: create an AWS Budgets alert (for example $1) and watch the free-tier page.

No AWS account? Run `npm test` and `node scripts/preview.mjs delhi` locally. SAM CLI + LocalStack is the
"Build It" route (needs Docker), but a deployed URL scores better.

## Cost: Rs 0
Lambda, DynamoDB, EventBridge, API Gateway and SNS (email) are covered by always-free or free-tier allowances at
hackathon traffic. Open-Meteo needs no key. Throttling (10 req/s, burst 20) caps abuse. Check the free-plan terms
for your new account before relying on this.

## Pros / cons / limits
- Pros: real daily decision, zero cost, deterministic and testable, tiny attack surface, no personal data stored.
- Cons: Air is a crowded track; your edge is the school decision plus the shareable message.
- Limits: forecasts are model-based (not sensors); AQI is computed from hourly PM averages over school hours, not
  CPCB's official 24h method; 12 cities; email only. Verify the breakpoints in `src/shared.mjs` against CPCB
  and Open-Meteo's terms before you claim accuracy in the video.
- Security: no secrets, least-privilege IAM, input validation, strict CSP, `textContent` only in the UI.
  Known gap: anyone can request a confirmation email for an address (SNS limits this, throttling slows it).
  Roadmap: CAPTCHA or Cognito.
- Scalability: cities are a config object; the scheduled job caches forecasts, so cost does not grow with visitors.
  Roadmap: school-level pin codes, heat and flood advisories on the same engine, Hindi UI, ground-sensor data.

## What-if plans
- Open-Meteo down: API serves the last saved forecast and flags it as stale. Keep a recorded take for the video.
- AWS signup or verification blocked: run locally (see above), show `sam local`/tests in the video.
- Deploy fails late: submit repo + local demo; a working small thing beats a perfect broken one.
- Student verification pending: submit anyway; clear it for rewards and the interview.

## Submission checklist (read the rules page)
- [ ] `git init` today and commit often. History must match the event dates. Do not backdate or reuse old code.
- [ ] Public repo, README, this architecture note.
- [ ] YouTube video under 3 minutes, public/unlisted, opens signed out. **Show the AWS console** (Lambda, DynamoDB,
      EventBridge rule, SNS) and the live URL.
- [ ] Writeup: problem, build, where AWS fits, AI tools used (list them).
- [ ] Submit on the event form before the deadline (hour not yet published; submit Sunday morning).
- [ ] Optional: Builder Center blog post (top 5 blogs win AirPods).

## 3-minute video script
0:00 Problem: a principal deciding at 6pm if kids can play outside tomorrow. 0:25 Pick a city, show the board,
actions, copy the WhatsApp message. 1:15 Subscribe, show the alert email. 1:40 AWS console: EventBridge, Lambda,
DynamoDB, SNS, API Gateway. 2:25 Limits, honest: forecast-based, 12 cities. 2:45 Roadmap and close.
