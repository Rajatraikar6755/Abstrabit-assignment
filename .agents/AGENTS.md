# Project Rules and Conventions

## Security Guidelines
*   Never commit real secrets or credentials to the repository.
*   All webhooks and private links must be encrypted at rest using `AES-256-GCM` before database persistence.
*   The interactions endpoint must verify `Ed25519` signatures for every single request using `tweetnacl`. No bypasses.

## Code Style
*   TypeScript is mandatory. All API payload shapes must be validated using `Zod` schemas.
*   Next.js App Router route handlers must be forced to dynamic where request headers are checked.
*   Mongoose connection pools must be cached as singletons to prevent socket leakage in Vercel serverless functions.
