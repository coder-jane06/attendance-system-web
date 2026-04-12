const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const path = require('path');
const http = require('http');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

if (!process.env.JWT_SECRET) {
    console.error('CRITICAL ERROR: JWT_SECRET is not defined in environment variables!');
    process.exit(1);
}

app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5000',
    credentials: true
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

// Periodic cleanup of expired QR sessions (Runs every 30 minutes)
const cleanupExpiredQRSessions = async () => {
    try {
        const db = require('./config/database');
        const result = await db.query('DELETE FROM qr_sessions WHERE expires_at < NOW() OR is_active = false');
        if (result.rowCount > 0) {
            console.log(`[Cleanup] Removed ${result.rowCount} expired QR sessions.`);
        }
    } catch (err) {
        console.error('[Cleanup Error] Failed to clear expired QR sessions:', err);
    }
};
setInterval(cleanupExpiredQRSessions, 30 * 60 * 1000);

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_AUTH_MAX) || 30, // Tighter limits for auth
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many authentication attempts. Please try again in 15 minutes.' }
});

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_API_MAX) || 1000, // Generous but protective
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'API rate limit exceeded. Please slow down.' }
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/google', authLimiter);

app.use('/api', (req, res, next) => {
    // Exempt basic auth routes from API limiter since they have their own tighter limiter
    const exempt = ['/auth/login', '/auth/register', '/auth/google'];
    if (exempt.some(path => req.path.startsWith(path))) {
        return next();
    }
    apiLimiter(req, res, next);
});

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
        message: 'EduPro Secure API is operational',
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV
    });
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
    // Run initial cleanup on startup
    cleanupExpiredQRSessions();
});

module.exports = { app, server };
