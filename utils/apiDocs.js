// Live API documentation for every route on this server.
//
// The OpenAPI spec is built from Express's own router the first time
// /api-docs.json is requested, so every mounted route is listed automatically -
// nothing to regenerate when routes change. For each route it works out:
//   - the tag (from the mount path, e.g. "CleanBridge · Pickups"),
//   - which login it needs (from the auth middleware in front of it) and roles
//     (requireRole(...) guards carry .roles),
//   - body / query / path fields read by the controller (from its source),
//     with example values guessed from the field names.
// Hand-written labels, descriptions and real examples in docs/apiAnnotations.js
// override the guesses: key "METHOD /full/path" (Express-style :params).

const annotations = require("../docs/apiAnnotations.js");

// ---------- router walking ----------

// Express 4 keeps a mount path only as a RegExp; turn it back into "/a/:b".
const mountPath = (layer) => {
    if (layer.regexp.fast_slash) return "";
    let i = 0;
    const src = layer.regexp.source
        .replace(/^\^/, "")
        .replace(/\\\/\?\(\?=\\\/\|\$\)$/i, "")
        .replace(/\(\?:\(\[\^\\\/\]\+\?\)\)/g, () => `:${layer.keys[i++]?.name || "param"}`)
        .replace(/\\\//g, "/")
        .replace(/\\\./g, ".")
        .replace(/\\-/g, "-");
    return /[()[\]?*+$^\\]/.test(src) ? null : src;
};

const joinPath = (...parts) => {
    const p = parts.join("/").replace(/\/+/g, "/");
    return p.length > 1 ? p.replace(/\/$/, "") : p;
};

const collectRoutes = (stack, prefix = "", inherited = [], out = []) => {
    const routerMiddleware = [...inherited];
    for (const layer of stack) {
        if (layer.route) {
            const paths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
            // express-async-errors wraps handlers; utils/keepOriginalHandlers.js keeps the original.
            // router.route(p).get(a).post(b) shares one route - split handlers by method.
            const handlersFor = (method) => layer.route.stack
                .filter((l) => !l.method || l.method === method)
                .map((l) => l.handle?.original || l.handle);
            const methods = Object.keys(layer.route.methods).filter((m) => m !== "_all");
            if (layer.route.methods._all) methods.push("get", "post");
            for (const p of paths) {
                if (typeof p !== "string") continue;
                for (const method of new Set(methods)) {
                    out.push({ method, path: joinPath(prefix, p), handlers: [...routerMiddleware, ...handlersFor(method)] });
                }
            }
        } else if (layer.handle?.stack && layer.name === "router") {
            const mount = mountPath(layer);
            if (mount === null) continue;
            collectRoutes(layer.handle.stack, joinPath(prefix, mount), routerMiddleware, out);
        } else if (prefix && typeof layer.handle === "function") {
            // router.use(auth) inside a mounted router applies to what follows.
            routerMiddleware.push(layer.handle.original || layer.handle);
        }
    }
    return out;
};

// ---------- what a route needs ----------

const AUTH = [
    { test: (n) => n === "cleanbridgeAuthMiddleware", scheme: "cleanbridgeBearer", label: "CleanBridge login (Bearer token from /api/v1/cleanbridge/auth/login)" },
    { test: (n) => n === "seedbridgeAuthMiddleware", scheme: "seedbridgeBearer", label: "SeedBridge login (Bearer token from /api/v1/seedbridge/auth/login)" },
    { test: (n) => n === "authenticationMiddleware", scheme: "bearerAuth", label: "Shared login (Bearer token from /api/v1/auth/login)" },
    { test: (n) => n === "adminOnly", scheme: "bearerAuth", label: "Shared login, admin only" },
    { test: (n) => n === "htmlAuth", scheme: "cookieAuth", label: "Browser session cookie" },
];

const authFor = (handlers) => {
    const found = [];
    let roles = null;
    for (const h of handlers) {
        const a = AUTH.find((x) => x.test(h.name));
        if (a) {
            const same = found.findIndex((f) => f.scheme === a.scheme);
            if (same === -1) found.push(a);
            else if (h.name === "adminOnly") found[same] = a; // keep the stricter label
        }
        if (Array.isArray(h.roles)) roles = h.roles;
    }
    return { found, roles };
};

// Fields the controller reads from req.body / req.query / req.params.
const fieldsFrom = (src, part) => {
    const fields = new Set();
    const add = (name) => { if (/^[A-Za-z_$][\w$]*$/.test(name)) fields.add(name); };
    // const { a, b = 1, c: d, ...rest } = req.body
    for (const m of src.matchAll(new RegExp(`(?:const|let|var)\\s*\\{([^}]*)\\}\\s*=\\s*req\\.${part}\\b`, "g"))) {
        m[1].split(",").map((s) => s.trim().replace(/^\.\.\..*/, "").split(/[:=]/)[0].trim()).filter(Boolean).forEach(add);
    }
    // req.body.x, req.body?.x, req.body["x"]
    for (const m of src.matchAll(new RegExp(`req\\.${part}\\??\\.([A-Za-z_$][\\w$]*)`, "g"))) add(m[1]);
    for (const m of src.matchAll(new RegExp(`req\\.${part}\\[["'\`]([\\w$]+)["'\`]\\]`, "g"))) add(m[1]);
    // const body = req.body; body.x
    for (const m of src.matchAll(new RegExp(`(?:const|let|var)\\s+(\\w+)\\s*=\\s*req\\.${part}(?:\\s*(?:\\?\\?|\\|\\|)\\s*\\{\\s*\\})?\\s*[;\\n]`, "g"))) {
        for (const f of src.matchAll(new RegExp(`\\b${m[1]}\\??\\.([A-Za-z_$][\\w$]*)`, "g"))) add(f[1]);
    }
    ["toString", "length", "trim", "map", "forEach"].forEach((x) => fields.delete(x));
    return [...fields];
};

// ---------- example values ----------

const EXAMPLES = [
    [/^email$|email$/i, "kofi.mensah@example.com"],
    [/password/i, "Secret123!"],
    [/momo|phone|msisdn|mobile|number$/i, "0241234567"],
    [/^(identifier)$/i, "kofi.mensah@example.com"],
    [/token/i, "eyJhbGciOiJIUzI1NiIs..."],
    [/^(id|_id)$|Id$|_id$/, "66f2a1c9e4b0a1b2c3d4e5f6"],
    [/^(firstName)$/i, "Kofi"],
    [/^(lastName)$/i, "Mensah"],
    [/name$/i, "Kofi Mensah"],
    [/username/i, "kofimensah"],
    [/^(lat|latitude)$/i, 5.6037],
    [/^(lng|lon|long|longitude)$/i, -0.187],
    [/amount|price|cost|total|fee|quantity|qty|capacity|count|limit|page|rating|weight|kg|bags|size/i, 1],
    [/date|time|at$|from|to$|since|until/i, "2026-09-24T09:00:00.000Z"],
    [/region/i, "Greater Accra"],
    [/address|location|area|city|town/i, "East Legon, Accra"],
    [/ghanaPostGps|gps/i, "GA-183-8164"],
    [/status/i, "pending"],
    [/role/i, "customer"],
    [/url|uri|link|redirect/i, "https://example.com/callback"],
    [/image|photo|avatar|pic/i, "https://example.com/photo.jpg"],
    [/message|text|content|body|comment|description|note|title|subject|bio/i, "Hello from the API docs"],
    [/type|kind|category|method|network|plan|bundle/i, "standard"],
    [/^(is|has|enable|allow)|active|verified|confirm/i, true],
    [/reference|ref|code/i, "CB-1001"],
];
const exampleFor = (name) => {
    for (const [re, value] of EXAMPLES) if (re.test(name)) return value;
    return "string";
};
const typeOf = (v) => (typeof v === "number" ? "number" : typeof v === "boolean" ? "boolean" : Array.isArray(v) ? "array" : v && typeof v === "object" ? "object" : "string");

// ---------- labels ----------

const words = (s) => String(s)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();

const summaryFor = (method, path, handler) => {
    const n = handler?.name;
    if (n && !/^(bound |anonymous|<anonymous>)/.test(n) && n.length > 2) {
        const s = words(n.replace(/^bound /, ""));
        return s.charAt(0).toUpperCase() + s.slice(1);
    }
    const verb = { get: "Get", post: "Create / submit", put: "Replace", patch: "Update", delete: "Delete" }[method] || method.toUpperCase();
    const last = path.split("/").filter((p) => p && !p.startsWith(":")).pop() || "root";
    return `${verb} ${words(last)}`;
};

const TAGS = [
    [/^\/api\/v1\/cleanbridge\/([^/]+)/, (m) => `CleanBridge · ${cap(m[1])}`],
    [/^\/api\/v1\/seedbridge\/([^/]+)/, (m) => `SeedBridge · ${cap(m[1])}`],
    [/^\/api\/v1\/auth\/google/, () => "Auth · Google sign-in"],
    [/^\/api\/v1\/auth/, () => "Auth (shared users)"],
    [/^\/api\/(contact|order)/, () => "Portfolio"],
    [/^\/api\/v1\/([^/]+)/, (m) => cap(m[1])],
    [/^\/api\/([^/]+)/, (m) => cap(m[1])],
    [/./, () => "Pages & misc"],
];
const cap = (s) => words(s).replace(/\b\w/g, (c) => c.toUpperCase());
const tagFor = (path) => {
    for (const [re, fn] of TAGS) { const m = path.match(re); if (m) return fn(m); }
    return "Other";
};

// ---------- spec ----------

const toOpenApiPath = (p) => p.replace(/:(\w+)\??/g, "{$1}");

const buildSpec = (app, { serverUrl } = {}) => {
    const routes = collectRoutes(app._router.stack);
    const paths = {};
    const tags = new Set();

    const seen = new Set();
    for (const r of routes) {
        const key = `${r.method.toUpperCase()} ${r.path}`;
        if (seen.has(key)) continue; // first match wins, like Express
        seen.add(key);

        const handler = r.handlers[r.handlers.length - 1];
        const source = (h) => { try { return Function.prototype.toString.call(h); } catch { return ""; } };
        // Fields come from the controller only - auth middleware reads its own req.* bits.
        const src = source(handler);
        const allSrc = r.handlers.map(source).join("\n") + r.handlers.map((h) => h.name).join(" ");
        const note = annotations[key] || {};
        const { found, roles } = authFor(r.handlers);
        const tag = note.tag || tagFor(r.path);
        tags.add(tag);

        const pathParams = [...r.path.matchAll(/:(\w+)(\?)?/g)].map((m) => ({
            name: m[1], in: "path", required: !m[2],
            schema: { type: "string" }, example: note.params?.[m[1]] ?? exampleFor(m[1]),
        }));
        const queryNames = note.query ? Object.keys(note.query) : fieldsFrom(src, "query");
        const queryParams = queryNames.map((name) => ({
            name, in: "query", required: false, schema: { type: "string" },
            example: note.query?.[name] ?? exampleFor(name),
        }));

        let requestBody;
        const hasBody = ["post", "put", "patch", "delete"].includes(r.method);
        const bodyExample = note.body !== undefined
            ? note.body
            : hasBody ? Object.fromEntries(fieldsFrom(src, "body").map((f) => [f, exampleFor(f)])) : undefined;
        const upload = note.upload ?? /req\.files?\b|multer|upload\.(single|array|fields)/.test(allSrc);
        if (hasBody && bodyExample && (upload || typeof bodyExample !== "object" || Object.keys(bodyExample).length)) {
            const properties = typeof bodyExample === "object" && !Array.isArray(bodyExample)
                ? Object.fromEntries(Object.entries(bodyExample).map(([k, v]) => [k, { type: typeOf(v), example: v }]))
                : undefined;
            requestBody = {
                required: true,
                content: upload
                    ? { "multipart/form-data": { schema: { type: "object", properties: { ...(properties || {}), [note.fileField || "file"]: { type: "string", format: "binary" } } } } }
                    : { "application/json": { schema: { type: typeOf(bodyExample), ...(properties ? { properties } : {}) }, example: bodyExample } },
            };
        }

        const lines = [];
        if (note.description) lines.push(note.description);
        if (found.length) lines.push(`**Login:** ${found.map((a) => a.label).join(" + ")}${roles ? ` · **Roles:** ${roles.join(", ")}` : ""}`);
        else lines.push("**Login:** none (public)");
        if (handler?.name && !/^(anonymous)?$/.test(handler.name)) lines.push(`**Handler:** \`${handler.name}\``);

        const ok = note.response !== undefined ? note.response : { message: "Success" };
        const responses = {
            [note.status || (r.method === "post" && /create|signup|register/i.test(handler?.name || "") ? 201 : 200)]: {
                description: note.responseLabel || "Success",
                content: typeof ok === "string"
                    ? { "text/html": { example: ok } }
                    : { "application/json": { example: ok } },
            },
        };
        if (hasBody || queryParams.length) responses[400] = { description: "Bad request - missing or invalid input", content: { "application/json": { example: { msg: "Please provide all required fields", error: "Please provide all required fields" } } } };
        if (found.length) responses[401] = { description: "Not logged in, token expired, or wrong role", content: { "application/json": { example: { msg: "Authentication invalid", error: "Authentication invalid" } } } };
        if (pathParams.length) responses[404] = { description: "Not found", content: { "application/json": { example: { msg: "No item found with id : 66f2a1c9e4b0a1b2c3d4e5f6", error: "No item found with id : 66f2a1c9e4b0a1b2c3d4e5f6" } } } };

        const op = {
            tags: [tag],
            summary: note.summary || summaryFor(r.method, r.path, handler),
            description: lines.join("\n\n"),
            operationId: `${r.method}_${r.path.replace(/[^\w]+/g, "_")}`,
            parameters: [...pathParams, ...queryParams],
            ...(requestBody ? { requestBody } : {}),
            responses,
            ...(found.length ? { security: found.map((a) => ({ [a.scheme]: [] })) } : {}),
        };
        const oaPath = toOpenApiPath(r.path);
        paths[oaPath] = paths[oaPath] || {};
        paths[oaPath][r.method] = op;
    }

    const sortedTags = [...tags].sort((a, b) => a.localeCompare(b));
    return {
        openapi: "3.0.3",
        info: {
            title: "FullBackendd API",
            version: new Date().toISOString().slice(0, 10),
            description: [
                "Every route on this server, generated live from the Express router - so it is always up to date.",
                "",
                "**Apps:** CleanBridge GH (`/api/v1/cleanbridge/*`), SeedBridge (`/api/v1/seedbridge/*`), the shared user API (`/api/v1/auth`, products, cart, orders, …) and the portfolio (`/api/contact`, `/api/order`).",
                "",
                "**Logging in:** call the app's `/auth/login`, copy `token` from the response, click **Authorize** and paste it into the matching scheme. Each app has its own users and tokens.",
                "",
                "**Errors:** `{ \"msg\": \"...\" }` with 400 (bad input), 401 (not logged in / wrong role), 404 (not found) or 500.",
                "",
                "Examples marked from field names are guesses; routes with hand-written examples are in `docs/apiAnnotations.js`.",
            ].join("\n"),
        },
        servers: [{ url: serverUrl || "/" }],
        tags: sortedTags.map((name) => ({ name })),
        paths,
        components: {
            securitySchemes: {
                bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT", description: "Shared users: token from POST /api/v1/auth/login" },
                cleanbridgeBearer: { type: "http", scheme: "bearer", bearerFormat: "JWT", description: "CleanBridge: token from POST /api/v1/cleanbridge/auth/login" },
                seedbridgeBearer: { type: "http", scheme: "bearer", bearerFormat: "JWT", description: "SeedBridge: token from POST /api/v1/seedbridge/auth/login" },
                cookieAuth: { type: "apiKey", in: "cookie", name: "token" },
            },
        },
    };
};

let cached = null;
const getSpec = (app) => (cached ||= buildSpec(app));

module.exports = { buildSpec, getSpec, collectRoutes };
