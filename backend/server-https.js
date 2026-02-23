const fs = require('fs');
const path = require('path');
const https = require('https');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const PORT = process.env.HTTPS_PORT || 5443;

const certDir = path.join(__dirname, 'certs');
const keyPath = path.join(certDir, 'server.key');
const certPath = path.join(certDir, 'server.cert');

if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    console.error('HTTPS certificate files are missing.');
    console.error('Run: node generate-cert.js');
    process.exit(1);
}

const key = fs.readFileSync(keyPath);
const cert = fs.readFileSync(certPath);

// Create the HTTPS Server instance early so Socket.io can attach to it
const server = https.createServer({ key, cert }, app);

const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || `https://localhost:${PORT}`,
        methods: ["GET", "POST"],
        credentials: true
    }
});

app.use(cors({
    origin: process.env.FRONTEND_URL || `https://localhost:${PORT}`,
    credentials: true
}));

// Real-time signaling logic
io.on('connection', (socket) => {
    console.log('User connected for secure real-time signaling:', socket.id);

    // Register user socket mapping
    socket.on('register', (userId) => {
        socket.join(userId);
        console.log(`User ${userId} registered to socket ${socket.id}`);
    });

    // 1-to-1 Call Signaling
    socket.on('callUser', (data) => {
        io.to(data.userToCall).emit('incomingCall', {
            signal: data.signalData,
            from: data.from,
            name: data.callerName
        });
    });

    socket.on('answerCall', (data) => {
        io.to(data.to).emit('callAccepted', data.signal);
    });

    // Class Group Call Signaling
    socket.on('startClassCall', (data) => {
        socket.broadcast.emit('classCallStarted', {
            classId: data.classId,
            teacherId: data.teacherId,
            roomId: data.roomId,
            teacherName: data.teacherName
        });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected from secure signaling:', socket.id);
    });
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../frontend')));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later.'
});

app.use('/api/', limiter);

const authRoutes = require('./routes/auth');
const teacherRoutes = require('./routes/teacher');
const studentRoutes = require('./routes/student');

app.use('/api/auth', authRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/student', studentRoutes);

app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'HTTPS server is running',
        timestamp: new Date().toISOString()
    });
});

app.get('/', (req, res) => {
    res.json({
        message: 'Attendance Management System API (HTTPS)',
        version: '1.0.0',
        endpoints: {
            auth: '/api/auth',
            teacher: '/api/teacher',
            student: '/api/student'
        }
    });
});

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found'
    });
});

app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

server.listen(PORT, () => {
    console.log(`HTTPS server running on https://localhost:${PORT}`);
});

module.exports = { app, server, io };
