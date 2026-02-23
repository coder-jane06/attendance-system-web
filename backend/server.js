const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ["GET", "POST"],
        credentials: true
    }
});

app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));

// Real-time signaling logic
io.on('connection', (socket) => {
    console.log('User connected for real-time signaling:', socket.id);

    // Register user socket mapping
    socket.on('register', (userId) => {
        socket.join(userId.toString());
        console.log(`User ${userId} registered to socket ${socket.id}`);
    });

    // 1-to-1 Call Signaling
    socket.on('callUser', (data) => {
        console.log(`Routing call from ${data.from} to ${data.userToCall}`);
        io.to(data.userToCall.toString()).emit('incomingCall', {
            signal: data.signalData,
            from: data.from,
            name: data.callerName
        });
    });

    socket.on('answerCall', (data) => {
        io.to(data.to.toString()).emit('callAccepted', data.signal);
    });

    // Class Group Call Signaling
    socket.on('startClassCall', (data) => {
        console.log(`Broadcasting class call ${data.roomId} from ${data.teacherName}`);
        // For a real app, emit to a specific class room. 
        // For this demo, we broadcast to all connected sockets except the sender.
        socket.broadcast.emit('classCallStarted', {
            classId: data.classId,
            teacherId: data.teacherId,
            roomId: data.roomId,
            teacherName: data.teacherName
        });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected from signaling:', socket.id);
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
const coursesRoutes = require('./routes/courses');
const classesRoutes = require('./routes/classes');

app.use('/api/auth', authRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/courses', coursesRoutes);
app.use('/api/classes', classesRoutes);

app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

app.get('/api/setupdb', async (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const db = require('./config/database');

        const schemaPath = path.join(__dirname, '../database/schema.sql');
        let schema = fs.readFileSync(schemaPath, 'utf8');
        schema = schema.split('\n').filter(line => !line.trim().startsWith('--')).join('\n');
        const statements = schema.split(';').map(stmt => stmt.trim()).filter(stmt => stmt.length > 0);

        for (let i = 0; i < statements.length; i++) {
            try {
                await db.query(statements[i]);
            } catch (e) { /* ignore drops */ }
        }
        res.send('✅ Cloud Database successfully initialized with tables and sample users!');
    } catch (e) {
        res.status(500).send('Error: ' + e.message);
    }
});

app.get('/', (req, res) => {
    res.redirect('/login.html');
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
    console.log(`Attendance Management API running on port ${PORT}`);
});

module.exports = { app, server, io };
