const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ 
            success: false, 
            message: 'Access token required' 
        });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            console.error('JWT verification failed:', err.message);
            return res.status(403).json({ 
                success: false, 
                message: 'Invalid or expired token' 
            });
        }
        req.user = user;
        next();
    });
};

// Middleware to check if user is a teacher
const isTeacher = (req, res, next) => {
    if (!req.user || req.user.role.toLowerCase() !== 'teacher') {
        console.warn(`Auth Denied: User role ${req.user ? req.user.role : 'NULL'} is not teacher`);
        return res.status(403).json({ 
            success: false, 
            message: 'Access denied. Teachers only.' 
        });
    }
    next();
};

// Middleware to check if user is a student
const isStudent = (req, res, next) => {
    if (!req.user || req.user.role.toLowerCase() !== 'student') {
        console.warn(`Auth Denied: User role ${req.user ? req.user.role : 'NULL'} is not student`);
        return res.status(403).json({ 
            success: false, 
            message: 'Access denied. Students only.' 
        });
    }
    next();
};

module.exports = {
    authenticateToken,
    isTeacher,
    isStudent
};
