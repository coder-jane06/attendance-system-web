const express = require('express');
const router = express.Router();
const db = require('../config/database');
const path = require('path');
const fs = require('fs');

// Mark attendance via QR redirect
router.get('/mark-attendance', async (req, res) => {
    try {
        const { token, classId } = req.query;
        const authHeader = req.headers['authorization'];
        const authToken = authHeader && authHeader.split(' ')[1];

        // Get student ID from JWT token
        const jwt = require('jsonwebtoken');
        
        if (!authToken) {
            // Not logged in - redirect to login
            return res.redirect(`/login.html?redirect=${encodeURIComponent('/mark-attendance.html?token=' + token + '&classId=' + classId)}`);
        }

        let studentId;
        try {
            const decoded = jwt.verify(authToken, process.env.JWT_SECRET);
            studentId = decoded.id;
        } catch (err) {
            return res.redirect('/login.html');
        }

        if (!token || !classId) {
            // Serve the mark-attendance page which will show the error
            return res.sendFile(path.join(__dirname, '../frontend/mark-attendance.html'));
        }

        // Check if student is enrolled in the class
        const enrollmentCheck = await db.query(
            'SELECT * FROM class_enrollments WHERE class_id = $1 AND student_id = $2',
            [classId, studentId]
        );

        if (enrollmentCheck.rows.length === 0) {
            return res.json({ 
                success: false, 
                message: 'You are not enrolled in this class' 
            });
        }

        // Verify QR session
        const sessionCheck = await db.query(
            `SELECT * FROM qr_sessions 
             WHERE session_token = $1 
             AND class_id = $2 
             AND is_active = true 
             AND expires_at > NOW()`,
            [token, classId]
        );

        if (sessionCheck.rows.length === 0) {
            return res.json({ 
                success: false, 
                message: 'Invalid or expired QR code' 
            });
        }

        // Check if already marked present today
        const attendanceCheck = await db.query(
            `SELECT * FROM attendance 
             WHERE class_id = $1 
             AND student_id = $2 
             AND session_date = CURRENT_DATE`,
            [classId, studentId]
        );

        if (attendanceCheck.rows.length > 0) {
            return res.json({ 
                success: false, 
                message: 'Attendance already marked for today' 
            });
        }

        // Mark attendance
        await db.query(
            `INSERT INTO attendance (class_id, student_id, session_date, status, marked_by)
             VALUES ($1, $2, CURRENT_DATE, 'present', 'qr')`,
            [classId, studentId]
        );

        // Get class info
        const classInfo = await db.query(
            'SELECT class_name, subject FROM classes WHERE id = $1',
            [classId]
        );

        res.json({
            success: true,
            message: 'Attendance marked successfully!',
            class: classInfo.rows[0],
            markedAt: new Date()
        });

    } catch (error) {
        console.error('Mark attendance error:', error);
        
        if (error.code === '23505') {
            return res.status(400).json({ 
                success: false, 
                message: 'Attendance already marked for today' 
            });
        }

        res.status(500).json({ 
            success: false, 
            message: 'Error marking attendance' 
        });
    }
});

module.exports = router;
