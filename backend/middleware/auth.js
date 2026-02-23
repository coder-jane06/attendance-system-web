const jwt = require('jsonwebtoken');

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
    if (req.user.role !== 'teacher') {
        return res.status(403).json({ 
            success: false, 
            message: 'Access denied. Teachers only.' 
        });
    }
    next();
};

// Middleware to check if user is a student
const isStudent = (req, res, next) => {
    if (req.user.role !== 'student') {
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
