# CommandPulse — Discord Slash-Command Bot Dashboard

CommandPulse is a production-grade, AI-powered Discord slash command bot integration and dashboard. It handles incoming Discord interactions securely, triages reports with Groq AI (Llama 3.3 70b), mirrors notifications to Slack/Discord webhooks, and provides a real-time dashboard with customizable rules for server admins.

## 🚀 Key Features

*   **Security First**: Ed25519 signature verification on every Discord payload with timestamp freshness validation.
*   **Idempotency & Rate Limiting**: Redis deduplication ensures no double-processing; sliding-window rate limiting prevents abuse.
*   **AI Triage**: Report and suggestion submissions processed via Groq API (Llama 3.3 70b) for summary, tags, priority classification, and recommended next steps.
*   **Interactive Commands**: Support for `/report` (optional text param or interactive modal form), `/suggest` (submit ideas/feedback), `/check-report` (live status lookups), `/status` (bot diagnostic check), and `/help` (rich formatting instructions guide).
*   **Rule Engine**: Configure match conditions (contains, regex, length constraints) and action effects (custom tags, custom priorities, auto-replies) inside the dashboard.
*   **Reliable Delivery**: Episodic downstream failures (webhook errors, DB down) trigger automatic QStash queues with exponential retry/backoff.
*   **Modern Dashboard**: Built using Next.js 15, TanStack Query (short-polling for serverless real-time feel), TailwindCSS, and framer-motion.
*   **Firebase Authentication**: Native, secure client-side email/password and Google login integrations.
*   **Secrets Safe**: No tokens/keys exposed to clients. Mirror webhook URLs are encrypted at rest with AES-256-GCM.

---

## 🛠️ Stack

*   **Framework**: Next.js 15 (App Router, TS, TailwindCSS)
*   **Database**: MongoDB Atlas + Mongoose
*   **Queue & Deduplication**: Upstash Redis + Upstash QStash
*   **AI Engine**: Groq API
*   **Authentication**: Firebase Authentication (Client SDK)

---

## ⚙️ Local Development Setup

### 1. Prerequisites
You will need accounts (all free tiers) with:
*   [Discord Developer Portal](https://discord.com/developers/applications)
*   [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
*   [Upstash Console](https://console.upstash.com) (Redis & QStash)
*   [Groq Console](https://console.groq.com) (Groq API key)
*   [Firebase Console](https://console.firebase.google.com) (Authentication setup)

### 2. Configure Environment Variables
Create a `.env` file in the root directory by copying `.env.example`:
```bash
cp .env.example .env
```
Fill in the configuration fields:
*   `DISCORD_APPLICATION_ID`, `DISCORD_PUBLIC_KEY`, `DISCORD_BOT_TOKEN`: From your Discord Developer Portal.
*   `MONGODB_URI`: Your MongoDB connection string.
*   `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`: From Upstash Redis.
*   `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`: From Upstash QStash tab.
*   `ENCRYPTION_KEY`: A 64-character hex string (32 bytes) for encrypting webhooks at rest. You can generate one via `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
*   `GROQ_API_KEY`: Groq API Console key.
*   `APP_URL`: Your Vercel domain or localtunnel address (for local testing).
*   **Firebase Keys**: Prefixed with `NEXT_PUBLIC_FIREBASE_` (API Key, Auth Domain, Project ID, Storage Bucket, Messaging Sender ID, App ID).

### 3. Run Command Registration
```bash
# Register slash commands (/report, /status, /suggest, /check-report, /help) globally with Discord
npx tsx scripts/register-commands.ts
```

### 4. Running the Development Server
Install dependencies and launch Next.js:
```bash
npm install
npm run dev
```

### 5. Exposing Localhost to Discord
Because Discord requires a public endpoint with valid SSL, you need to tunnel your local port (default 3000):
```bash
npx localtunnel --port 3000
```
Update your Discord application's **Interactions Endpoint URL** to:
`https://<your-subdomain>.localtunnel.me/api/discord/interactions`

---

## 📦 Deployment (Vercel)

1.  Create a new project on Vercel and import your repository.
2.  Add all environment variables from `.env` in Vercel's Project Settings.
3.  Deploy the project.
4.  Copy your Vercel deployment URL (e.g. `https://your-app.vercel.app`).
5.  In the Discord Developer Portal, paste `https://your-app.vercel.app/api/discord/interactions` into the **Interactions Endpoint URL** field and save.
6.  Set the `APP_URL` environment variable in your Vercel settings to your Vercel URL, and redeploy or restart to apply.
7.  In the **Firebase Console**, go to **Authentication** -> **Settings** -> **Authorized domains** -> click **Add Domain** -> paste your Vercel domain name, and click save.
