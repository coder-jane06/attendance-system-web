const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken, isStudent } = require('../middleware/auth');

// Enroll in a class section (capacity checked)
router.post('/enroll', authenticateToken, isStudent, async (req, res) => {
    try {
        const { classId } = req.body;

        if (!classId) {
            return res.status(400).json({ success: false, message: 'classId is required' });
        }

        const cls = await db.query(
            `SELECT c.id, c.max_strength,
                (SELECT COUNT(*)::int FROM class_enrollments ce WHERE ce.class_id = c.id) AS enrolled_count
             FROM classes c
             WHERE c.id = $1`,
            [classId]
        );

        if (cls.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Class section not found' });
        }

        const row = cls.rows[0];
        const maxStrength = row.max_strength != null ? Number(row.max_strength) : 50;
        if (Number(row.enrolled_count) >= maxStrength) {
            return res.status(400).json({ success: false, message: 'This section is full' });
        }

        await db.query(
            'INSERT INTO class_enrollments (class_id, student_id) VALUES ($1, $2)',
            [classId, req.user.id]
        );

        res.status(201).json({
            success: true,
            message: 'You are now enrolled in this section'
        });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({
                success: false,
                message: 'You are already enrolled in this section'
            });
        }
        console.error('Enroll error:', error);
        res.status(500).json({ success: false, message: 'Could not complete enrollment' });
    }
});

// Drop a section enrollment
router.post('/unenroll', authenticateToken, isStudent, async (req, res) => {
    try {
        const { classId } = req.body;

        if (!classId) {
            return res.status(400).json({ success: false, message: 'classId is required' });
        }

        const result = await db.query(
            'DELETE FROM class_enrollments WHERE class_id = $1 AND student_id = $2 RETURNING id',
            [classId, req.user.id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'You are not enrolled in this section' });
        }

        res.json({ success: true, message: 'Enrollment removed' });
    } catch (error) {
        console.error('Unenroll error:', error);
        res.status(500).json({ success: false, message: 'Could not remove enrollment' });
    }
});

// Get all enrolled classes for a student
router.get('/classes', authenticateToken, isStudent, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT c.*, u.full_name as teacher_name
             FROM classes c
             INNER JOIN class_enrollments ce ON c.id = ce.class_id
             INNER JOIN users u ON c.teacher_id = u.id
             WHERE ce.student_id = $1
             ORDER BY c.class_name`,
            [req.user.id]
        );

        res.json({
            success: true,
            classes: result.rows
        });

    } catch (error) {
        console.error('Get student classes error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching classes' 
        });
    }
});

// Scan QR code and mark attendance
router.post('/scan-qr', authenticateToken, isStudent, async (req, res) => {
    try {
        const { token, classId } = req.body;

        if (!token || !classId) {
            return res.status(400).json({ 
                success: false, 
                message: 'Token and classId required' 
            });
        }

        // Check if student is enrolled in the class
        const enrollmentCheck = await db.query(
            'SELECT * FROM class_enrollments WHERE class_id = $1 AND student_id = $2',
            [classId, req.user.id]
        );

        if (enrollmentCheck.rows.length === 0) {
            return res.status(403).json({ 
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
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid or expired QR code' 
            });
        }

        const session = sessionCheck.rows[0];

        // Check if already marked present today
        const attendanceCheck = await db.query(
            `SELECT * FROM attendance 
             WHERE class_id = $1 
             AND student_id = $2 
             AND session_date = CURRENT_DATE`,
            [classId, req.user.id]
        );

        if (attendanceCheck.rows.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Attendance already marked for today' 
            });
        }

        // Rate limiting check - prevent too many simultaneous scans
        const recentScans = await db.query(
            `SELECT COUNT(*) as scan_count
             FROM attendance
             WHERE class_id = $1 
             AND session_date = CURRENT_DATE
             AND marked_at > NOW() - INTERVAL '2 seconds'`,
            [classId]
        );

        const maxScansPerSecond = parseInt(process.env.MAX_SCANS_PER_SECOND) || 3;
        
        if (parseInt(recentScans.rows[0].scan_count) >= maxScansPerSecond) {
            // Still mark attendance but flag for teacher review
            console.warn(`High scan rate detected for class ${classId}`);
        }

        // Mark attendance
        await db.query(
            `INSERT INTO attendance (class_id, student_id, session_date, status, marked_by)
             VALUES ($1, $2, CURRENT_DATE, 'present', 'qr')`,
            [classId, req.user.id]
        );

        // Get class info
        const classInfo = await db.query(
            `SELECT c.class_name, COALESCE(co.course_name, c.class_name) as subject
             FROM classes c
             LEFT JOIN courses co ON c.course_id = co.id
             WHERE c.id = $1`,
            [classId]
        );

        res.json({
            success: true,
            message: 'Attendance marked successfully',
            class: classInfo.rows[0],
            markedAt: new Date()
        });

    } catch (error) {
        console.error('QR scan error:', error);
        
        if (error.code === '23505') { // Unique constraint violation
            return res.status(400).json({ 
                success: false, 
                message: 'Attendance already marked for today' 
            });
        }

        res.status(500).json({ 
            success: false, 
            message: 'Error scanning QR code' 
        });
    }
});

// Get student's attendance history
router.get('/attendance', authenticateToken, isStudent, async (req, res) => {
    try {
        const { classId, startDate, endDate } = req.query;

        let query = `
            SELECT a.*, c.class_name, COALESCE(co.course_name, c.class_name) AS subject, c.class_code
            FROM attendance a
            INNER JOIN classes c ON a.class_id = c.id
            LEFT JOIN courses co ON c.course_id = co.id
            WHERE a.student_id = $1
        `;
        
        const params = [req.user.id];
        let paramCount = 1;

        if (classId) {
            paramCount++;
            query += ` AND a.class_id = $${paramCount}`;
            params.push(classId);
        }

        if (startDate && endDate) {
            paramCount++;
            query += ` AND a.session_date BETWEEN $${paramCount}`;
            params.push(startDate);
            paramCount++;
            query += ` AND $${paramCount}`;
            params.push(endDate);
        }

        query += ' ORDER BY a.session_date DESC, c.class_name';

        const result = await db.query(query, params);

        res.json({
            success: true,
            attendance: result.rows
        });

    } catch (error) {
        console.error('Get student attendance error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching attendance',
            error: error.message
        });
    }
});

// Get attendance statistics for a student
router.get('/statistics', authenticateToken, isStudent, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT 
                c.id as class_id,
                c.class_name,
                COALESCE(co.course_name, c.class_name) as subject,
                c.class_code,
                COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_count,
                COUNT(a.id) as total_sessions,
                CASE 
                    WHEN COUNT(a.id) > 0 THEN 
                        ROUND((COUNT(CASE WHEN a.status = 'present' THEN 1 END)::numeric / COUNT(a.id) * 100), 2)
                    ELSE 0 
                END as attendance_percentage
             FROM classes c
             LEFT JOIN courses co ON c.course_id = co.id
             INNER JOIN class_enrollments ce ON c.id = ce.class_id
             LEFT JOIN attendance a ON a.class_id = c.id AND a.student_id = $1
             WHERE ce.student_id = $1
             GROUP BY c.id, c.class_name, co.course_name, c.class_code
             ORDER BY c.class_name`,
            [req.user.id]
        );

        res.json({
            success: true,
            statistics: result.rows
        });

    } catch (error) {
        console.error('Get statistics error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching statistics',
            error: error.message
        });
    }
});

module.exports = router;
