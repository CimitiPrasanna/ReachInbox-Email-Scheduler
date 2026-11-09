# ReachInbox — Email Scheduler (MySQL)

A full-stack starter implementation based on the supplied assignment. It uses MySQL for durable email records, Redis + BullMQ for delayed jobs, Ethereal SMTP for test delivery, Elasticsearch for search, Google OAuth for login, Slack OAuth for notifications, and Bull Board for queue monitoring.

## Requirements
- Node.js 20+
- Docker Desktop (recommended) OR local MySQL, Redis and Elasticsearch
- VS Code
- Google OAuth credentials (optional until Google login is tested)
- Slack app credentials (optional until Slack integration is tested)

## 1. Start infrastructure
From the project root:
```bash
docker compose up -d
```
Services:
- MySQL: `localhost:3306`, database `reachinbox`
- Redis: `localhost:6379`
- Elasticsearch: `http://localhost:9200`

## 2. Configure backend
```bash
cd backend
cp .env.example .env
npm install
```
Edit `.env`. MySQL defaults match docker-compose. Set a long random `SESSION_SECRET`.
For Google login, create OAuth credentials in Google Cloud Console. Add this redirect URI:
`http://localhost:4000/auth/google/callback`
For Slack, create a Slack app, enable the `chat:write` bot scope, install it to your workspace, set `SLACK_CHANNEL_ID` to a channel ID where the bot is a member, and set this redirect URI:
`http://localhost:4000/auth/slack/callback`.
Ethereal credentials are generated automatically if ETHEREAL_USER and ETHEREAL_PASS are blank.

Run the API and worker in separate terminals:
```bash
npm run dev
npm run worker
```
Open Bull Board at `http://localhost:4000/admin/queues`.

## 3. Configure frontend
```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```
Open `http://localhost:5173`.

## 4. Database
The backend creates its tables automatically on startup. To inspect:
```sql
USE reachinbox;
SHOW TABLES;
SELECT * FROM emails;
```

## 5. Test the flow
1. Start Docker services, backend API, worker, and frontend.
2. Use the dashboard. In local development, the API has a development identity when Google OAuth is not configured.
3. Compose an email and enter comma-separated recipient addresses, or upload a CSV with an `email` column (a plain list of email addresses is also accepted).
4. Set a future start time, delay, and hourly limit, then schedule.
5. Check Scheduled and Sent tabs.
6. Open Bull Board to inspect jobs.
7. Stop and restart the worker/API. Pending delayed jobs remain in Redis and email records remain in MySQL.

## API
- `GET /health`
- `GET /auth/me`
- `GET /auth/google`
- `GET /auth/slack`
- `POST /api/emails/schedule`
- `GET /api/emails?status=scheduled|sent|failed`
- `GET /api/emails/search?q=term`

Schedule request:
```json
{
  "recipients": ["person@example.com"],
  "subject": "Hello",
  "body": "Test message",
  "startAt": "2026-12-01T10:00:00.000Z",
  "delaySeconds": 30,
  "hourlyLimit": 100
}
```

## Design notes and limitations
- Each recipient is stored as a separate email row and queued as a separate BullMQ job.
- `jobId` is the database email ID, providing a stable queue identity. The database status transition prevents a completed job from being sent again after a worker retry.
- Redis-backed BullMQ delayed jobs are persistent when Redis persistence is enabled (the supplied Docker configuration enables AOF).
- A Redis fixed-window counter is used for the global hourly limit. A job that reaches the limit is rescheduled rather than discarded.
- `MIN_SEND_INTERVAL_MS` controls minimum spacing; BullMQ's queue limiter is also configured.
- Search indexing is best-effort: MySQL remains the source of truth if Elasticsearch is temporarily unavailable.
- Slack notifications are sent only when a connected Slack token and `SLACK_CHANNEL_ID` are configured. Invite the Slack app/bot to that channel. OAuth secrets must be configured for the real flow.
- SMTP cannot provide mathematically guaranteed exactly-once delivery: if the SMTP server accepts a message but the process crashes before MySQL records `sent`, a retry could resend it. The database claim prevents normal concurrent duplicate processing, but this crash window must be documented as a delivery-system limitation.
- This is a learning/assignment implementation. Before production deployment, add tenant-level authorization, CSRF protection, secure secret management, migrations, observability, bounce handling, and load testing. Review the code and be prepared to explain it; do not submit work you cannot explain.
