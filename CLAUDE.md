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
- Regenerate the Markdown API reference: `npm run docs` while the server runs (saves `/api-docs.json` to
  `oas-docs/openapi.json`, then widdershins writes `API.md`).
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
`req.user = { userId, username, token }`. Clerk (`@clerk/clerk-sdk-node`) is also wired in for specific flows.
`middleware/adminOnly.js` gates admin-only routes; `middleware/htmlAuth.js` gates the server-rendered static
dashboard pages (`/afrodatadashboard`, `/api/v1/bundle/`, `/api/v1/buydata/`).

**Google OAuth is multi-app by design** (`utils/passport.js`, `routes/googleAuth.js`, `utils/oauthRedirect.js`):
there is one shared Google Cloud OAuth client for the whole backend, with one callback URL registered in
Google Cloud Console (`CALLBACK_URL`, resolved to an absolute URL against the incoming request by
passport-oauth2). Any frontend can start a login by hitting `GET /api/v1/auth/google?redirect_uri=<its own
callback URL>` — no per-app registration step and no `.env` edit is needed. The `redirect_uri` travels through
Google's `state` param (`encodeOAuthState`/`decodeOAuthState`) and, after the callback issues a JWT, the user
is redirected back to that exact `redirect_uri` with `?token=<jwt>` appended. If a caller omits `redirect_uri`,
it falls back to `${REDIRECT_URL}/auth/callback` for backwards compatibility with the original single-app
integration.

Validation is `isWellFormedHttpUrl()` (`utils/oauthRedirect.js`), which only checks the value is a well-formed
http(s) URL — **not** which host it points at. This is a deliberate, explicit tradeoff (any site works
automatically, no `ALLOWED_REDIRECT_DOMAINS` entry needed) that accepts a real open-redirect risk: a crafted
`/auth/google?redirect_uri=https://attacker.example` link will send a genuine login token to attacker.example
after a real Google login. `ALLOWED_REDIRECT_DOMAINS` and the stricter `isAllowedRedirectUri()` still exist but
no longer gate Google auth — they now only protect `controllers/seedbridgePayment.js`'s payment callback
redirect, which is unrelated and was deliberately left unchanged.

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
`models/Message.js`). Every connection is authenticated via `io.use()` middleware that verifies the same JWT
issued by `POST /api/v1/auth/login` (passed as `io(url, { auth: { token } })` on the client) — `socket.userId`
comes only from the verified token, never from a client-supplied field, so a socket can't send or read
messages as a different user. `utils/socket.js` tracks `userId -> Set<socketId>` (not a single id) so a user
with multiple tabs/devices gets delivery to all of them, and disconnecting one tab can't clobber another
still-live tab's registration. `typing` events are emitted only to the named recipient's sockets, not
broadcast to everyone connected. The REST endpoints in `routes/messageRoutes.js` require the same
`authMiddleware` as everything else and independently enforce the same rule — `getMessages`/`markAsRead` 401
for anyone who isn't a participant in that conversation. The socket's `sendMessage` accepts an optional
ack callback, which receives `{ message }` (the saved doc) or `{ error }`. `GET /api/v1/messages/conversations`
returns the caller's inbox: one row per other user with their public fields, the last message and an unread
count. `PATCH /api/v1/messages/conversations/:otherUserId/read` marks that conversation as read.
`React-products-master/Instagram` is the frontend that uses all of this (`useChat`/`useConversations`).
`ChatAppDemo.jsx` in `GHGPT-main` is still an old, unauthenticated mock.

**Post media (GridFS)**: posts store an image or video in the `uploads` GridFS bucket. `Posts.mediaType` is
`'image'` or `'video'` and is set from the upload's mimetype. `POST /api/v1/posts` goes through
`postUpload('file')` (`utils/storageMulter.js`), which only accepts image or video files, caps them at 50 MB,
and turns multer errors into 400s. `GET /api/v1/posts/media/:id` streams files inline with HTTP Range / 206
support, which `<video>` needs for seeking; the older `/posts/image/:id` has no Range support.
`storageMulter.js` overrides `storage._removeFile`, because multer-gridfs-storage calls
`bucket.delete(id, cb)` and the mongodb v5 driver pinned in `resolutions` ignores callbacks. Without the
override, any aborted upload hangs the request forever and leaves the partial file behind. Keep the override
if you touch that file.

**Instagram social features**: `utils/socialNotify.js` `notify()`/`unnotify()` write `models/SocialNotification.js`
(like/comment/follow, no self-notifications, one row per actor for like/follow) and push a `notification` socket
event through `utils/socket.js` `emitToUserId`. They are called from `likePosts`/`unlikePosts`, `addComment` and
`followUser`/`unfollowUser`, and never throw. `GET /api/v1/notifications` and `PATCH /api/v1/notifications/read`
need auth. Other routes: `GET /users/search?q=` (regex-escaped, must stay above `/users/:id`), `GET /posts/liked/:id`,
and `GET /posts/saved` plus `PATCH /posts/:postId/save` (auth; `User.saved` holds Posts ids, whereas `User.posts`
holds GridFS file ids). `getUser`, `getUserByName` and `getAllUsers` strip password, tokens and reset fields,
including on populated followers and following. `scripts/backfillPostMediaType.js` repairs `Posts.mediaType` for
posts uploaded before it was recorded.

**Instagram stories** (`/api/v1/stories`, all auth, mounted next to posts because uploads are multipart): stories go into the
same `uploads` GridFS bucket through `postUpload` and are served by `/posts/media/:fileId`. They expire after 24h.
`purgeExpired()` runs on every feed read and deletes the Story doc and its file. A TTL index was deliberately not used,
because it would orphan the GridFS file. The feed groups stories by author (you first, then unseen, then most recent).
Views are `$addToSet` and exclude the owner, and only the owner can list viewers or delete. `GET /posts/:postId` must stay
the last route in `postRoute.js`.

**Mongoose defaults**: write `default: Date.now` (the function), never `Date.now()`, which is evaluated once
at startup. `models/Message.js` had that bug, which gave every message the server's start time.

**AI/chatbot**: Two separate integrations exist side by side — (1) `utils/openaiService.js` /
`utils/askAi.js` call OpenAI/OpenRouter directly from Node for `routes/chatAi.js` and `routes/aiModel.js`; (2)
`chatbot/` is an independent Python project (FastAPI + a from-scratch intents/finetune pipeline) that must be
run as its own process (see Commands above) and is called out to from `chatbot/aiModel.js`. Also note `app.js`
has a legacy `/api/chat` route that `spawn()`s a hardcoded local Python interpreter path to run
`chatbot/respond.py` — this is environment-specific and likely broken outside the original dev machine.

**API docs**: `/api-docs` (Swagger UI) and `/api-docs.json` list EVERY route, built live from the Express router
on first request by `utils/apiDocs.js` - nothing to regenerate when routes change. It reads each route's auth
middleware (`requireRole` guards carry `.roles`) and the controller's source for body/query fields.
`utils/keepOriginalHandlers.js` (required right after `express-async-errors`) keeps the original handler on
`handler.original`, because express-async-errors wraps every handler in an anonymous `newFn`. Labels,
descriptions and examples go in `docs/apiAnnotations.js` (key `"METHOD /full/path"`); real CleanBridge
examples are recorded into `docs/apiExamples.json` by `scripts/captureApiExamples.js`, which must run against a
throwaway `*_docs_tmp` database (see the file header) so no real user data reaches the public docs. The
hand-written `swagger.yaml` is still served at `/api-docs/portfolio`.

**Static/legacy front-ends**: `static/` and `public/` contain several plain HTML/CSS/JS mini-apps (MTN data
bundle dashboard/login/buydata pages, success/reset-password pages) served directly by Express routes in
`app.js`, gated by `htmlAuth` where noted above. `navbar-app/` is a small standalone JS widget. These are not
part of the JSON API and don't go through the `routes/`→`controllers/` layering.

**Environment variables**: `.env.example` is the source of truth for which keys every environment must define
(local/staging/prod) — copy it to `.env` and fill in real values; add new keys to both files together so
environments stay in sync. Vars actually read via `process.env.*` in code: `MONGO_URI`, `PORT`, `JWT_SECRET`,
`JWT_LIFETIME`, `SESSION_KEY`, `NODE_ENV`, `ORIGIN`, `CLIENT_URL_AI`, `CALLBACK_URL`, `REDIRECT_URL`,
`ALLOWED_REDIRECT_DOMAINS`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `EMAIL_USER`, `EMAIL_PASS`,
`IMAGE_KIT_PUBLIC_KEY`, `IMAGE_KIT_PRIVATE_KEY`, `IMAGE_KIT_ENDPOINT`, `OPENAI_API_KEYS`,
`OPENROUTER_API_KEY`, `PAYSTACK_SECRET_KEY`, `TEST_PAYSTACK_SECRET_KEY`, `PAYSTACK_CALLBACK_URL`,
`RELOADLY_CLIENT_ID`, `RELOADLY_CLIENT_SECRET`, `SEEDBRIDGE_CLIENT_URL`.

> ⚠️ `.env` was committed to this repo until this was caught and fixed (untracked with `git rm --cached`,
> `.gitignore` corrected from the no-op `.env/` to `.env`). It holds live secrets (Paystack live secret key,
> OpenAI key, Reloadly, Clerk, email app password, etc) that are still in git history from before the fix —
> treat those as already exposed if this repo/remote has ever been public or shared, and get the user's
> explicit go-ahead before rotating keys or rewriting history — don't do it unilaterally.

## Email delivery (every app)

All mail goes through `utils/mailTransport.js` `deliver()` (used by `utils/sendEmail.js` and `utils/cleanbridgeMail.js`).
Render's free plan blocks outbound SMTP (Gmail SMTP fails with "Connection timeout"), so the provider is picked by env:
`MAIL_RELAY_URL` + `MAIL_RELAY_SECRET` (Google Apps Script relay in `scripts/gmailRelay.gs`, sends from your Gmail over HTTPS),
then `BREVO_API_KEY` (+ `BREVO_SENDER_EMAIL`), then `EMAIL_USER`/`EMAIL_PASS` SMTP (fine locally).
CleanBridge email links use `emailUrl()` (`utils/cleanbridgeMail.js`): when `CLEANBRIDGE_CLIENT_URL` is a localhost
address they point at the live site instead (override with `CLEANBRIDGE_PUBLIC_URL`); unsubscribe links always hit the
server that sent the email.

## CleanBridge place search

`/geo/search` merges Photon/OpenStreetMap (streets, areas) with ~28k Ghanaian businesses and landmarks from the
Overture Maps places dataset, kept in memory by `utils/ghanaPlaces.js` from `data/ghana-places.json.gz` (rebuild
with `scripts/buildGhanaPlaces.js`). Without a user position it biases to Accra. `/geo/photos` gives an Esri
satellite snapshot plus nearby Wikimedia Commons photos. Google Maps isn't used because it needs a billing account.
Keep the "© Overture Maps Foundation" / OpenStreetMap / Esri credits visible in the UI (PlacePreview).

## Forgot / reset password (every app)

`utils/passwordReset.js` `createPasswordReset({ Model, appKey, appName, send, ... })` gives any user collection the
same automatic flow. It is mounted for the shared `User` (`/api/v1/auth`), SeedBridge (`/api/v1/seedbridge/auth`) and
CleanBridge (`/api/v1/cleanbridge/auth`):
- `POST <base>/forgot-password { email, redirect_uri? }` emails a link immediately. With `redirect_uri` the link opens the
  calling app's own reset page (`?token=&email=` appended). Without it, the link opens this backend's hosted page
  `/resetPassword?app=<appKey>` (`static/resetPassword.html`, which picks the right API from `app`). `redirect_uri` must pass
  `isAllowedRedirectUri` (ALLOWED_REDIRECT_DOMAINS). This is unlike Google login, because the reset link carries a secret.
  CleanBridge defaults to its own `/reset-password` page and also trusts CLEANBRIDGE_CLIENT_URL.
- `POST <base>/reset-password/:token?email= { newPassword }`. The token and email may also be sent in the body.
- Tokens are 32 random bytes, stored only as SHA-256 hashes, and expire after 30 minutes; each can be used once.
  The forgot endpoint gives the same answer for unknown emails, so it can't be used to find accounts. Errors are 400, never 401.
- Rate limited per IP per app (`middleware/passwordResetLimiter.js`): 5 forgot and 20 reset attempts per 15 minutes.
- To add another app: add `resetPasswordToken`/`resetPasswordExpires` to its model, create the handlers with its model
  and mailer, and mount both routes with the limiters.

## SeedBridge (`/api/v1/seedbridge/*`)

A farm-to-market app (farmers list produce, buyers order it, drivers deliver it) living inside this same
backend but **fully namespaced and isolated** from everything else here — it was originally built by mistake
inside an old, no-longer-running copy of this repo (`openlabs-project-main`) before being ported in. Its own
`models/SeedBridgeUser.js` (phone-first signup: `name`, `phone`, `password`, `role` of
`farmer`/`buyer`/`driver`/`agent`, `region`, `momoBalance`) is a **separate collection** from the shared
`User` model every other app on this backend uses — no shared schema, no shared auth. `middleware/seedbridgeAuth.js`
verifies its own JWTs (still signed with the same `JWT_SECRET`, but a token minted for `User` won't resolve
against `SeedBridgeUser` or vice versa). Sign up/log in at `POST /api/v1/seedbridge/auth/signup` /
`/login` (phone + password, not email).

Feature routes: `seedbridgeProduce.js` (public browsing + farmer-owned CRUD on listings, ownership enforced
via `req.user.userId === produce.farmerId`), `seedbridgeOrder.js` (buyer creates an order against a listing,
decrements `availableKg`, both sides can update status), `seedbridgeDashboard.js` (role-specific
farmer/buyer/driver stats + a public market overview), `seedbridgeUssd.js` (a *different* USSD menu than the
MTN-bundle one at `/api/v1/ussd/start` — looks users up by phone against `SeedBridgeUser`, no JWT involved,
meant for Africa's Talking).

**Payment is dynamic by design, unlike the legacy `/api/v1/paystack` flow**: `seedbridgePayment.js`'s
`initializeCheckout` takes the caller's own `callbackUrl` per request (same `isAllowedRedirectUri()` /
`ALLOWED_REDIRECT_DOMAINS` gate as Google login), falling back to `SEEDBRIDGE_CLIENT_URL` only when no
`callbackUrl` was given — an explicitly-passed but disallowed URL is rejected with a 400, never silently
swapped for the fallback. Also has real webhook support (`POST /api/v1/seedbridge/payments/webhook`,
HMAC-SHA512 signature verification against `x-paystack-signature`), which the legacy Paystack integration
lacks. This requires the **raw** request body to verify the signature, so `app.js` special-cases
`SEEDBRIDGE_WEBHOOK_PATH` around every body-parsing/sanitizing middleware it registers (`bodyParser.json()`,
`xss()`, `mongoSanitize()`, `express.json()`) — if you add another raw-body webhook anywhere in this app,
follow that same exact-path-skip pattern or the signature check will always fail.

`models/SeedBridgeLogisticsRequest.js` (driver pickup/delivery scheduling) exists as a model only — no
controller/route was ever built for it in the source this was ported from.

## CleanBridge GH (`/api/v1/cleanbridge/*`)

Backend for the CleanBridge GH waste-collection frontend (separate repo: `Desktop/VS Projects/CleanBridge-GH`).
It follows the same isolation pattern as SeedBridge. It has its own `models/CleanBridgeUser.js` collection (roles
`customer`/`collector`/`admin`) and its own `middleware/cleanbridgeAuth.js`. Tokens carry an `app: "cleanbridge"` claim
and the middleware rejects any token without it. `requireRole(...roles)` (exported from the same middleware)
throws 403. Mounted groups are `auth`, `pickups`, `routes`, `vehicles`, `notifications`, `settings`, `dashboard`,
`admin`, `geo`, `payments` and `payouts`, each with one `routes/cleanbridge<X>.js` and one `controllers/cleanbridge<X>.js`.
Shared helpers are in `utils/cleanbridge.js` (DTO mappers that return `id`, never `_id`; `quotePickup`, `estimateFuel`,
`collectorBalance`, and the atomic `nextSequence` behind `CB-1001`/`RT-0001` codes). Ghana reference data is in
`utils/ghana.js` (service hubs, regions, phone/MoMo network detection, GhanaPost GPS and DVLA plate regexes,
`serviceInfo(lat, lng)`). The frontend mirrors that file in `src/lib/ghana.js`, so keep the two in sync.

Rules worth knowing before changing things:
- **Return 400, not 401, for validation failures on signed-in requests.** The frontend treats any 401 as an
  expired session and logs the user out. `UnauthenticatedError` is only for bad or missing credentials.
- **Phones are Ghana mobiles**, normalised to `+233XXXXXXXXX` in CleanBridgeUser's `pre("validate")`. `phone` is
  optional and sparse (Google sign-ups add it later), and `password` is optional when `googleId` is set.
- **The price is always computed on the server.** `serviceInfo()` picks the nearest hub. The pickup is rejected if it
  is outside every hub's `radiusKm` or outside Ghana. Road km = straight-line km × `ROAD_FACTOR`. The rules come from
  `CleanBridgeSettings` (a singleton; `Settings.getGlobal()` creates it with defaults). `minimumFee` tops up
  small jobs.
- **Pickup status machine** (`TRANSITIONS` in `controllers/cleanbridgePickup.js`):
  `requested → assigned → on_the_way → completed`, with `cancelled` allowed from any non-final state. Assignment
  only happens via `/accept` (an atomic claim by a collector) or `/assign` (admin), and both require a **verified**
  vehicle. On completion the earnings are snapshotted: `collectorEarning = price × payouts.collectorSharePct` and
  `platformFee` is the rest. Cash jobs set `cashCollected` because the collector holds the money.
- **Collector balance** (`collectorBalance()`) = earnings − cash collected − paid or requested payouts. It can go
  negative, which means the collector owes the platform fee on cash jobs. `CleanBridgePayout` has a partial unique
  index that allows one open request per collector. Admins record MoMo payouts manually with the transaction
  ID; nothing is sent automatically.
- **Customer payments** (`controllers/cleanbridgePayment.js`) use Paystack hosted checkout (MoMo + card, GHS).
  The payment is only marked paid after `/transaction/verify` confirms the amount, currency and `metadata.pickupId`.
  There is no webhook yet. `callbackUrl` must pass `isAllowedRedirectUri`.
- **Google sign-in** reuses the shared `routes/googleAuth.js` callback. `/api/v1/auth/google?app=cleanbridge&role=&redirect_uri=`
  puts `app: "cleanbridge"` in the OAuth state, and the callback hands off to `cleanbridgeAuth.googleCallback`, which upserts
  a CleanBridgeUser (linked by `googleId`, or by email) and redirects with `?token=`. Unlike the open shared flow, the
  CleanBridge branch **does** enforce an allowlist: `ALLOWED_REDIRECT_DOMAINS` plus the host of `CLEANBRIDGE_CLIENT_URL` (`isAllowedCleanbridgeRedirect`).
  The Google photo is saved as `googleAvatarUrl`. Uploaded avatars go to ImageKit (`PUT /auth/me/avatar`, multipart
  field `avatar`, via express-fileupload's `req.files`) and take precedence over the Google photo.
- **Geocoding** (`controllers/cleanbridgeGeo.js`) proxies Photon (OSM, built for autocomplete), falling back to
  Nominatim. Both are limited to Ghana, cached in memory for 10 minutes and rate limited per IP.
- Routes snapshot the fuel price and the vehicle's L/100km when created. Collectors' live GPS
  (`PUT /auth/me/live-location`) counts as live for 10 minutes on the pickup page and 30 minutes on the admin map.
- Aggregation pipelines need explicit `mongoose.Types.ObjectId(...)` casts (`find()` casts automatically,
  `aggregate()` does not).
