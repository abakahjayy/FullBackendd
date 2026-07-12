const Message = require('../models/Message');
// Regular Colors
// console.log('\x1b[31m%s\x1b[0m', 'This is red');       // Red text
// console.log('\x1b[32m%s\x1b[0m', 'This is green');     // Green text
// console.log('\x1b[33m%s\x1b[0m', 'This is yellow');    // Yellow text
// console.log('\x1b[34m%s\x1b[0m', 'This is blue');      // Blue text
// console.log('\x1b[35m%s\x1b[0m', 'This is magenta');   // Magenta text
// console.log('\x1b[36m%s\x1b[0m', 'This is cyan');      // Cyan text
// console.log('\x1b[37m%s\x1b[0m', 'This is white');     // White text

// // Background Colors
// console.log('\x1b[41m%s\x1b[0m', 'This has red background'); // Red background
// console.log('\x1b[42m%s\x1b[0m', 'This has green background'); // Green background

// // Bold and Underline
// console.log('\x1b[1m%s\x1b[0m', 'This is bold');        // Bold text
// console.log('\x1b[4m%s\x1b[0m', 'This is underlined');  // Underlined text

// // Reset Style
// console.log('\x1b[0m%s\x1b[0m', 'This is normal again'); // Reset style

const users = new Map(); // Track connected users and their sockets

const setupSocket = (io) => {
    io.on('connection', (socket) => {
        console.log('\x1b[32m%s\x1b[0m\x1b[4m%s\x1b[0m','A user connected:', socket.id);

        // Store user's ID and socket
        const userId = socket.handshake.query.userId;
        if (userId) users.set(userId, socket.id);

        // Handle direct messaging
        socket.on('sendMessage', async ({ sender, recipient, message }) => {
            try {


                const newMessage = await Message.create({ sender, recipient, message });

                const recipientSocketId = users.get(recipient);
                if (recipientSocketId) {
                    io.to(recipientSocketId).emit('receiveMessage', newMessage);
                }
            } catch (error) {
                console.warn('Error sending message:', error.message);
            }
        });


        // Listen for typing event
        socket.on('typing', (data) => {
            const { sender, receiver } = data;
            console.log('A user is typing')
            socket.broadcast.emit('typing', { sender, receiver });
        });

        // Handle disconnection
        socket.on('disconnect', () => {
            console.log('\x1b[31m%s\x1b[0m\x1b[4m%s\x1b[0m','User disconnected:', socket.id);
            users.delete(userId);
        });

        //Handle Error
        socket.on('connect_error', (err) => {
            console.error('Connection Error:', err);
        });
    });
};

module.exports = setupSocket;
