# CommandPulse — Discord Slash-Command Bot Dashboard

CommandPulse is a production-grade, AI-powered Discord slash command bot integration and dashboard. It handles incoming Discord interactions securely, triages reports with Gemini AI, mirrors notifications to Slack/Discord webhooks, and provides a real-time dashboard with customizable rules for server admins.

## 🚀 Key Features

*   **Security First**: Ed25519 signature verification on every Discord payload with timestamp freshness validation.
*   **Idempotency & Rate Limiting**: Redis deduplication ensures no double-processing; sliding-window rate limiting prevents abuse.
*   **AI Triage**: Report submissions processed with Gemini 2.0 Flash for summary, tags, priority classification, and recommended next steps.
*   **Rule Engine**: Configure match conditions (contains, regex, length constraints) and action effects (custom tags, custom priorities, auto-replies) inside the dashboard.
*   **Reliable Delivery**: Episodic downstream failures (webhook errors, DB down) trigger automatic QStash queues with exponential retry/backoff.
*   **Modern Dashboard**: Built using Next.js 15, TanStack Query (short-polling for serverless real-time feel), TailwindCSS, and framer-motion.
*   **Secrets Safe**: No tokens/keys exposed to clients. Mirror webhook URLs are encrypted at rest with AES-256-GCM.

---

## 🛠️ Stack

*   **Framework**: Next.js 15 (App Router, TS, TailwindCSS)
*   **Database**: MongoDB Atlas + Mongoose
*   **Queue & Deduplication**: Upstash Redis + Upstash QStash
*   **AI Engine**: Google Gemini API
*   **Authentication**: NextAuth.js (Credentials provider)

---

## ⚙️ Local Development Setup

### 1. Prerequisites
You will need accounts (all free tiers) with:
*   [Discord Developer Portal](https://discord.com/developers/applications)
*   [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
*   [Upstash Console](https://console.upstash.com) (Redis & QStash)
*   [Google AI Studio](https://aistudio.google.com) (Gemini API key)

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
*   `NEXTAUTH_SECRET`: Random 32-character string.
*   `ENCRYPTION_KEY`: A 64-character hex string (32 bytes) for encrypting webhooks at rest. You can generate one via `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
*   `GEMINI_API_KEY`: Google AI Studio API key.
*   `APP_URL`: Set to your local tunnel address (e.g. ngrok/Localtunnel address) when testing Discord webhooks locally, or your production URL. Defaults to `http://localhost:3000`.

### 3. Run Command Registration & Seeding
```bash
# Register slash commands (/report, /status) globally with Discord
npx tsx scripts/register-commands.ts

# Seed the admin credentials and default command configs
npx tsx scripts/seed-admin.ts
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
6.  Set the `APP_URL` environment variable in your Vercel settings to your custom domain or Vercel URL, and redeploy or restart to apply.

---

## 🧪 Admin Dashboard Account

To log in, use the throwaway admin account seeded with `seed-admin.ts`:
*   **Email**: `admin@example.com`
*   **Password**: `admin123`
