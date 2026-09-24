const jwt = require("jsonwebtoken");

// Live updates for CleanBridge GH over Server-Sent Events (SSE).
// Every open app keeps one GET /api/v1/cleanbridge/events connection; notify()
// pushes each new notification down it instantly (new pickup requests for
// collectors, status changes for customers, payouts...). EventSource
// reconnects on its own if the connection drops.
//
// Connections live in this process's memory, which is fine for a single
// instance. With several instances you'd fan out through Redis pub/sub.
const clients = new Map(); // userId -> Set<res>

const HEARTBEAT_MS = 25000; // keeps proxies (e.g. Render) from closing idle streams

const subscribe = (req, res, userId) => {
    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
    });
    res.write(`retry: 5000\n\n`);
    res.write(`event: ready\ndata: {}\n\n`);

    const key = String(userId);
    if (!clients.has(key)) clients.set(key, new Set());
    clients.get(key).add(res);

    const heartbeat = setInterval(() => res.write(`: ping\n\n`), HEARTBEAT_MS);
    req.on("close", () => {
        clearInterval(heartbeat);
        const set = clients.get(key);
        if (set) {
            set.delete(res);
            if (!set.size) clients.delete(key);
        }
    });
};

const publish = (userId, event, data) => {
    const set = clients.get(String(userId));
    if (!set) return 0;
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    set.forEach((res) => res.write(payload));
    return set.size;
};

const isOnline = (userId) => clients.has(String(userId));

// EventSource can't send an Authorization header, so the app passes its JWT
// as ?token=. Same checks as middleware/cleanbridgeAuth.js.
const userIdFromToken = (token) => {
    const decoded = jwt.verify(String(token || ""), process.env.JWT_SECRET);
    if (decoded.app !== "cleanbridge") throw new Error("Not a CleanBridge token");
    return decoded.userId;
};

module.exports = { subscribe, publish, isOnline, userIdFromToken };
