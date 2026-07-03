# AI Collaboration Notes

This document describes the collaboration between the engineer and the AI coding assistant (Gemini/Claude) in building **CommandPulse**.

## 🛠️ Tools & Models Used

*   **Claude 3.5 Sonnet / Claude 3.5 Opus**: Used for planning, architecting the directory layout, and generating the core Next.js Route Handlers and Services.
*   **Gemini 3.5 Flash / Gemini 2.0 Flash**: Used for rapid code additions, UI polish, writing components, and executing specific parts of the implementation workflow.
*   **Work Split**: 
    *   **Engineer**: Directed the architecture, selected the database and queues (MongoDB + Upstash Redis/QStash), configured the security logic (Ed25519 tweetnacl verification), and manually verified live integration payloads.
    *   **AI**: Drafted boilerplate handlers, generated frontend styling, built shadcn-inspired CSS parameters, and designed the UI layout.

---

## 💡 Key Design & Architectural Decisions

1.  **Serverless-Native Async Architecture (Upstash QStash)**:
    Rather than hosting an active WebSocket client or running a long-running Node background worker (which would exceed Vercel's Serverless execution limits and budget), we leveraged Upstash QStash. Discord expects a response in 3 seconds. By receiving the request, verifying the signature, immediately returning a deferred response code (type 5), and firing a signature-verified webhook trigger to QStash to process the heavy lifting (database updates, Gemini triage, mirror notifications) asynchronously, we built a highly-available bot that runs cleanly on standard serverless endpoints.

2.  **Stateful Polling instead of WebSockets**:
    For the dashboard's "live update" capability, we opted for short-polling (every 10 seconds) using TanStack Query rather than spinning up a Socket.io server. This keeps the application fully serverless, avoids maintaining persistent WebSocket connections, and keeps within Vercel's execution limits.

3.  **AES-256-GCM Webhook Encryption at Rest**:
    To prevent data leakage of confidential third-party Slack/Discord webhook URLs stored in MongoDB, we encrypted the webhooks using Node's native `crypto` (AES-256-GCM). The key is loaded via a secret environment variable and is never exposed in responses sent to the client dashboard.

---

## 🐛 The Hardest AI Bug / Wrong Turn

*   **The Bug**: During the draft of the `/api/discord/interactions` route, the AI generated a standard Next.js request body parser using `await req.json()`.
*   **How it was caught**: Discord signature verification relies on checking the *raw unmodified request body* combined with the timestamp. Calling `req.json()` formats the JSON spacing slightly differently depending on Next.js runtime transformations, which consistently failed Ed25519 signature checks.
*   **How it was fixed**: We changed the parser to retrieve the body as a raw string using `await req.text()`, verified the signature directly against this raw string, and only *then* parsed the text to JSON for internal validation. We also added a timestamp freshness check to reject replayed request signatures.

---

## 🔮 Future Improvements & Scaling

1.  **Multi-Guild Isolated Rule Engine**: Allow configuring entirely separate rule databases per Discord Guild ID, enabling multi-tenant SaaS capabilities.
2.  **Upstash Vector RAG**: Fully implement the RAG pipeline by embedding new report texts and matching them against past database interactions to surface similar bugs or duplicate alerts instantly to the dashboard and Slack/Discord mirrors.
