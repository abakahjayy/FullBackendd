# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single monolithic Node.js/Express backend ("openlabs-project") that serves a large number of unrelated
feature domains behind one Express app: e-commerce (products/cart/orders/delivery), a mobile-data/airtime
reseller (MTN bundles, AFA, Reloadly, USSD, Paystack), a food-ordering service (meals/foodorders/feedback),
a chatbot/AI layer (OpenAI + a separate Python FastAPI service), social features (posts/comments/messages via
Socket.IO), a portfolio-site contact/order form, and several static HTML "mini apps" served straight out of
`static/`/`public/`. There is no monorepo tooling — it's one Express app with many route groups mounted under
`/api/v1/*`.

## Commands

- Install: `npm install --legacy-peer-deps` (required — dependency tree has peer conflicts, notably
  `mongoose@5.x` alongside `mongodb@5.x` via `resolutions`).
- Run the server: `npm start` (nodemon with `--env-file .env`) or `node app.js`. Default port `7004`
  (`PORT` env var). If the port is stuck: `npx kill-port 7004`.
- Run the AI FastAPI microservice (separate from the Node server, used by `chatbot/aiModel.js`):
  `cd chatbot && uvicorn serveai_fastapi:app --host 0.0.0.0 --port 5001 --reload`.
- Generate the Markdown API reference from the OpenAPI spec: `npm run docs` (runs widdershins against
  `oas-docs/openapi.json`, writes `API.md`).
- There is no working automated test suite — `npm test` is a stub (`package.json` scripts.test just exits 1).
  `jest` and `cypress` are listed as dependencies but there is no jest/cypress config or spec files; `test/`
  contains standalone Python scripts (`main.py`, `myphone.py`), not an integration test harness. Don't assume
  `npm test` verifies anything — validate changes by exercising the relevant route(s) directly (e.g. via the
  Swagger UI at `/api-docs` or a REST client) instead.

## Architecture

**Layering**: `app.js` → `routes/*.js` → `controllers/*.js` → `models/*.js` (Mongoose schemas). Routes only
wire HTTP verbs/paths to controller functions and middleware; business logic and DB access live in
controllers. Shared logic (JWT, email, hashing, permission checks) lives in `utils/`, reusable across
controllers via `utils/index.js`.

**Route mounting** (`app.js`): every feature area is mounted at its own `/api/v1/<name>` prefix (see the long
list of `app.use('/api/v1/...', ...)` calls). When adding a new feature, follow the same pattern: a router in
`routes/`, a controller in `controllers/`, a model in `models/` if it needs persistence, then mount it in
`app.js`. A few routers (`uploadRoutes`, `testing1Router`, `userProfilePic`, `postRoutes`, AI image/model
routes, meals) are deliberately mounted *before* `bodyParser`/`express.json()` because they need raw/multipart
bodies for file uploads — be careful about where new upload-handling routes are mounted relative to the body
parsers around app.js:110-140.

**Auth**: JWT-based (`middleware/auth.js`), checking `Authorization: Bearer <token>` header, then a `token`
cookie, then a `?oven=` query param, in that priority order. Verified against `JWT_SECRET`; attaches
`req.user = { userId, username, token }`. Google OAuth via Passport (`utils/passport.js`, `routes/googleAuth.js`)
and Clerk (`@clerk/clerk-sdk-node`) are also wired in for specific flows. `middleware/adminOnly.js` gates
admin-only routes; `middleware/htmlAuth.js` gates the server-rendered static dashboard pages
(`/afrodatadashboard`, `/api/v1/bundle/`, `/api/v1/buydata/`).

**Errors**: custom error classes in `errors/` (`BadRequestError`, `NotFoundError`, `UnauthenticatedError`,
`UnauthorizedError`, all extending `CustomAPIError`) are thrown from controllers/middleware — routes rely on
`express-async-errors` so async controllers don't need manual try/catch/next. Everything funnels into
`middleware/error-handler.js`, which also special-cases Mongoose `ValidationError`, duplicate-key errors
(code `11000`), and `CastError` into consistent `{ msg, error }` JSON responses. `middleware/not-found.js`
handles unmatched routes. Both are registered last in `app.js`.

**Database**: MongoDB via Mongoose (`db/connect.js`, connects using `MONGO_URI`). Mongoose is pinned to v5,
so newer Mongoose 6+/7+ query/connection APIs are not available — check existing model/controller code for
the supported syntax (e.g. `useFindAndModify`, `useCreateIndex` are still set explicitly in `connect.js`).

**Real-time**: Socket.IO is initialized on top of the same HTTP server (`http.createServer(app)` in `app.js`)
and configured in `utils/socket.js`; used for the messaging feature (`routes/messageRoutes.js`,
`models/Message.js`).

**AI/chatbot**: Two separate integrations exist side by side — (1) `utils/openaiService.js` /
`utils/askAi.js` call OpenAI/OpenRouter directly from Node for `routes/chatAi.js` and `routes/aiModel.js`; (2)
`chatbot/` is an independent Python project (FastAPI + a from-scratch intents/finetune pipeline) that must be
run as its own process (see Commands above) and is called out to from `chatbot/aiModel.js`. Also note `app.js`
has a legacy `/api/chat` route that `spawn()`s a hardcoded local Python interpreter path to run
`chatbot/respond.py` — this is environment-specific and likely broken outside the original dev machine.

**API docs**: Two independent Swagger/OpenAPI setups run at once — `express-oas-generator` auto-captures live
request/response traffic into `oas-docs/openapi.json` and serves it at `/api-docs` (the `expressOasGenerator.init`
call is currently commented out in `app.js`, but `expressOasGenerator.handleResponses(...)` still runs at
startup and regenerates the spec file); and a hand-written `swagger.yaml` is served separately at
`/api-docs/portfolio` for the portfolio contact/order endpoints. `API.md`/`README.md` are generated output
from widdershins (`npm run docs`) — don't hand-edit the generated API-reference sections in those files;
edit `oas-docs/openapi.json` / `swagger.yaml` (or the routes themselves) and regenerate instead.

**Static/legacy front-ends**: `static/` and `public/` contain several plain HTML/CSS/JS mini-apps (MTN data
bundle dashboard/login/buydata pages, success/reset-password pages) served directly by Express routes in
`app.js`, gated by `htmlAuth` where noted above. `navbar-app/` is a small standalone JS widget. These are not
part of the JSON API and don't go through the `routes/`→`controllers/` layering.

**Environment variables** (see `.env`, not committed with real secrets in prod): `MONGO_URI`, `PORT`,
`JWT_SECRET`, `JWT_LIFETIME`, `SESSION_KEY`, `NODE_ENV`, `ORIGIN`, `CLIENT_URL`, `CLIENT_URL_AI`,
`CALLBACK_URL`, `REDIRECT_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `EMAIL_USER`, `EMAIL_PASS`,
`IMAGE_KIT_PUBLIC_KEY`, `IMAGE_KIT_PRIVATE_KEY`, `IMAGE_KIT_ENDPOINT`, `OPENAI_API_KEYS`,
`OPENROUTER_API_KEY`, `PAYSTACK_SECRET_KEY`, `TEST_PAYSTACK_SECRET_KEY`, `PAYSTACK_CALLBACK_URL`,
`RELOADLY_CLIENT_ID`, `RELOADLY_CLIENT_SECRET`.
