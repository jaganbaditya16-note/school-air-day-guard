# School Air-Day Guard

A responsive dashboard for school-day planning using model-based air-quality forecasts for 12 Indian cities.

## Features
- Select a city and view today's or tomorrow's school-hours advisory.
- View forecast-derived index, pollutant summaries and hourly charts.
- Review suggested precautions and copy a message for parent groups.
- Use the responsive dashboard on desktop or mobile.

## How it works
The browser calls the application API. When deployed, AWS Lambda serves the dashboard and API, while DynamoDB caches forecast data.
Open-Meteo provides hourly PM2.5 and PM10 model forecasts. Deterministic JavaScript logic generates the planning advisory.
The current template contains API Gateway HTTP API, one API Lambda function and a DynamoDB table.
Email subscriptions and scheduled alerts are disabled in this version.

## Technology
- JavaScript and Node.js
- AWS SAM CLI, AWS Lambda, API Gateway HTTP API and DynamoDB
- Open-Meteo Air Quality API
- Node.js built-in test runner

## Run locally
Install Node.js, then run: npm test
Run the local browser preview with: node scripts/ui-preview.mjs
Open http://127.0.0.1:4173. Live forecasts require internet access.

## Build and validate
Run: sam build --template-file .\template.yaml
Run: sam validate --lint --template-file .\.aws-sam\build\template.yaml
AWS deployment is optional for a local portfolio demo. Review account plan, credit eligibility, permissions and potential charges before creating resources.

## Forecast limitations
Forecasts are model-based, not local sensor measurements.
The calculated planning index is not an official CPCB AQI measurement, medical advice or an official school-closure instruction.
Check observed conditions and applicable local-authority guidance before making decisions.

## Security
The current API has no authentication. Anyone with its URL can request forecasts.
Throttling helps manage traffic but does not prevent all abuse or charges.
Never commit AWS keys, passwords, session tokens or local AWS credentials.
Keep samconfig.toml, build artifacts, node_modules and local backup files out of Git.
Use a restricted AWS identity rather than root credentials for routine deployments.

## Tests
Unit tests cover calculation logic, advisory levels, missing data and school-hours requirements.
