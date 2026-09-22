const jwt = require('jsonwebtoken');
const Message = require('../models/Message');

// userId -> Set of connected socket ids. A Set (not a single id) so a user
// with multiple tabs/devices open gets messages delivered to all of them,
// and so disconnecting one tab can't accidentally clobber another tab's
// still-live entry.
const userSockets = new Map();

const addUserSocket = (userId, socketId) => {
    if (!userSockets.has(userId)) userSockets.set(userId, new Set());
    userSockets.get(userId).add(socketId);
};

const removeUserSocket = (userId, socketId) => {
    const sockets = userSockets.get(userId);
    if (!sockets) return;
    sockets.delete(socketId);
    if (sockets.size === 0) userSockets.delete(userId);
};

const emitToUser = (io, userId, event, payload) => {
    const sockets = userSockets.get(userId);
    if (!sockets) return;
    sockets.forEach((socketId) => io.to(socketId).emit(event, payload));
};

const setupSocket = (io) => {
    // Every connection must carry a valid JWT (the same one issued by
    // POST /api/v1/auth/login) - without this, any client could claim to be
    // any userId via socket.handshake.query and read or send messages as
    // someone else. socket.io-client sends this via `io(url, { auth: {
    // token } })`.
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token || socket.handshake.query?.token;
        if (!token) {
            return next(new Error('Authentication required'));
        }
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.userId = decoded.userId;
            next();
        } catch (error) {
            next(new Error('Invalid or expired token'));
        }
    });

    io.on('connection', (socket) => {
        const userId = socket.userId;
        console.log('\x1b[32m%s\x1b[0m', `User connected: ${userId} (${socket.id})`);
        addUserSocket(userId, socket.id);

        // Kept for backwards compatibility with older clients that still
        // call this on connect - the server already knows who you are from
        // the JWT verified above, so this is just an acknowledgement rather
        // than a second identity claim we'd have to trust.
        socket.on('registerUser', () => {
            socket.emit('registered', { userId });
        });

        // sender is always the authenticated socket's own userId - never
        // taken from the client payload, or any connected client could
        // send messages that appear to be from someone else.
        socket.on('sendMessage', async ({ recipient, message }) => {
            if (!recipient || !message) {
                return socket.emit('messageError', { error: 'recipient and message are required.' });
            }
            try {
                const newMessage = await Message.create({ sender: userId, recipient, message });

                // Deliver to every tab/device the recipient has open, and
                // sync the sender's OTHER sessions too (not this socket -
                // the sending tab already has its own local copy of what
                // it just sent).
                emitToUser(io, recipient, 'receiveMessage', newMessage);
                const senderSockets = userSockets.get(userId);
                if (senderSockets) {
                    senderSockets.forEach((socketId) => {
                        if (socketId !== socket.id) io.to(socketId).emit('receiveMessage', newMessage);
                    });
                }
            } catch (error) {
                console.warn('Error sending message:', error.message);
                socket.emit('messageError', { error: 'Failed to send message.' });
            }
        });

        // Scoped to the actual recipient only - the previous implementation
        // used socket.broadcast.emit(), which sent every typing event to
        // every connected user regardless of who was actually chatting with
        // whom.
        socket.on('typing', ({ recipient }) => {
            if (!recipient) return;
            emitToUser(io, recipient, 'typing', { sender: userId });
        });

        socket.on('disconnect', () => {
            console.log('\x1b[31m%s\x1b[0m', `User disconnected: ${userId} (${socket.id})`);
            removeUserSocket(userId, socket.id);
        });

        socket.on('connect_error', (err) => {
            console.error('Connection Error:', err);
        });
    });
};

module.exports = setupSocket;
