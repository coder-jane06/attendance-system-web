const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { authenticateToken, isTeacher } = require('../middleware/auth');
const ExcelJS = require('exceljs');

// Get all classes for a teacher
router.get('/classes', authenticateToken, isTeacher, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT c.*, 
                    COUNT(DISTINCT ce.student_id) as enrolled_students
             FROM classes c
             LEFT JOIN class_enrollments ce ON c.id = ce.class_id
             WHERE c.teacher_id = $1
             GROUP BY c.id
             ORDER BY c.created_at DESC`,
            [req.user.id]
        );

        res.json({
            success: true,
            classes: result.rows
        });

    } catch (error) {
        console.error('Get classes error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching classes' 
        });
    }
});

// Get specific class details
router.get('/classes/:classId', authenticateToken, isTeacher, async (req, res) => {
    try {
        const { classId } = req.params;

        // Get class info
        const classResult = await db.query(
            'SELECT * FROM classes WHERE id = $1 AND teacher_id = $2',
            [classId, req.user.id]
        );

        if (classResult.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Class not found' 
            });
        }

        // Get enrolled students
        const studentsResult = await db.query(
            `SELECT u.id, u.full_name, u.student_id, u.email, u.department
             FROM users u
             INNER JOIN class_enrollments ce ON u.id = ce.student_id
             WHERE ce.class_id = $1
             ORDER BY u.full_name`,
            [classId]
        );

        res.json({
            success: true,
            class: classResult.rows[0],
            students: studentsResult.rows
        });

    } catch (error) {
        console.error('Get class details error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching class details' 
        });
    }
});

// Generate QR Code for attendance
router.post('/generate-qr', authenticateToken, isTeacher, async (req, res) => {
    try {
        const { classId } = req.body;

        // Verify class belongs to teacher
        const classCheck = await db.query(
            'SELECT * FROM classes WHERE id = $1 AND teacher_id = $2',
            [classId, req.user.id]
        );

        if (classCheck.rows.length === 0) {
            return res.status(403).json({ 
                success: false, 
                message: 'Unauthorized access to class' 
            });
        }

        // Deactivate previous QR codes for this class today
        await db.query(
            `UPDATE qr_sessions 
             SET is_active = false 
             WHERE class_id = $1 AND session_date = CURRENT_DATE`,
            [classId]
        );

        // Generate unique token
        const sessionToken = uuidv4();
        const validitySeconds = parseInt(process.env.QR_VALIDITY_SECONDS) || 5;
        const expiresAt = new Date(Date.now() + validitySeconds * 1000);

        // Store QR session in database
        await db.query(
            `INSERT INTO qr_sessions (class_id, session_token, expires_at, is_active) 
             VALUES ($1, $2, $3, true)`,
            [classId, sessionToken, expiresAt]
        );

        // Generate QR Code with redirect URL
        // QR will contain a link that students can scan with their phone camera
        const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
        const qrUrl = `${baseUrl}/mark-attendance.html?token=${sessionToken}&classId=${classId}`;

        const qrCodeDataURL = await QRCode.toDataURL(qrUrl, {
            width: 300,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        });

        res.json({
            success: true,
            qrCode: qrCodeDataURL,
            token: sessionToken,
            expiresAt: expiresAt,
            validitySeconds: validitySeconds,
            qrUrl: qrUrl
        });

    } catch (error) {
        console.error('QR generation error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error generating QR code' 
        });
    }
});

// Get attendance for a class on a specific date
router.get('/attendance/:classId', authenticateToken, isTeacher, async (req, res) => {
    try {
        const { classId } = req.params;
        const { date } = req.query; // Format: YYYY-MM-DD

        // Verify class belongs to teacher
        const classCheck = await db.query(
            'SELECT * FROM classes WHERE id = $1 AND teacher_id = $2',
            [classId, req.user.id]
        );

        if (classCheck.rows.length === 0) {
            return res.status(403).json({ 
                success: false, 
                message: 'Unauthorized access to class' 
            });
        }

        const targetDate = date || new Date().toISOString().split('T')[0];

        // Get all enrolled students
        const enrolledStudents = await db.query(
            `SELECT u.id, u.full_name, u.student_id, u.email
             FROM users u
             INNER JOIN class_enrollments ce ON u.id = ce.student_id
             WHERE ce.class_id = $1
             ORDER BY u.full_name`,
            [classId]
        );

        // Get attendance records for the date
        const attendanceRecords = await db.query(
            `SELECT student_id, status, marked_at, marked_by
             FROM attendance
             WHERE class_id = $1 AND session_date = $2`,
            [classId, targetDate]
        );

        // Merge data
        const attendanceMap = {};
        attendanceRecords.rows.forEach(record => {
            attendanceMap[record.student_id] = record;
        });

        const attendanceList = enrolledStudents.rows.map(student => ({
            ...student,
            status: attendanceMap[student.id]?.status || 'absent',
            marked_at: attendanceMap[student.id]?.marked_at || null,
            marked_by: attendanceMap[student.id]?.marked_by || null
        }));

        res.json({
            success: true,
            date: targetDate,
            class: classCheck.rows[0],
            attendance: attendanceList
        });

    } catch (error) {
        console.error('Get attendance error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching attendance' 
        });
    }
});

// Export attendance to Excel
router.get('/export/:classId', authenticateToken, isTeacher, async (req, res) => {
    try {
        const { classId } = req.params;
        const { startDate, endDate } = req.query;

        // Verify class belongs to teacher
        const classResult = await db.query(
            'SELECT * FROM classes WHERE id = $1 AND teacher_id = $2',
            [classId, req.user.id]
        );

        if (classResult.rows.length === 0) {
            return res.status(403).json({ 
                success: false, 
                message: 'Unauthorized access to class' 
            });
        }

        const classInfo = classResult.rows[0];

        // Get attendance records
        const query = startDate && endDate
            ? `SELECT a.*, u.full_name, u.student_id, u.email
               FROM attendance a
               INNER JOIN users u ON a.student_id = u.id
               WHERE a.class_id = $1 AND a.session_date BETWEEN $2 AND $3
               ORDER BY a.session_date, u.full_name`
            : `SELECT a.*, u.full_name, u.student_id, u.email
               FROM attendance a
               INNER JOIN users u ON a.student_id = u.id
               WHERE a.class_id = $1
               ORDER BY a.session_date, u.full_name`;

        const params = startDate && endDate 
            ? [classId, startDate, endDate]
            : [classId];

        const result = await db.query(query, params);

        // Create Excel workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Attendance');

        // Add headers
        worksheet.columns = [
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Student ID', key: 'student_id', width: 15 },
            { header: 'Student Name', key: 'full_name', width: 25 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'Status', key: 'status', width: 12 },
            { header: 'Marked At', key: 'marked_at', width: 20 },
            { header: 'Method', key: 'marked_by', width: 12 }
        ];

        // Style header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' }
        };

        // Add data
        result.rows.forEach(record => {
            worksheet.addRow({
                date: new Date(record.session_date).toLocaleDateString(),
                student_id: record.student_id,
                full_name: record.full_name,
                email: record.email,
                status: record.status.toUpperCase(),
                marked_at: new Date(record.marked_at).toLocaleString(),
                marked_by: record.marked_by.toUpperCase()
            });
        });

        // Set response headers
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            `attachment; filename=attendance_${classInfo.class_code}_${Date.now()}.xlsx`
        );

        // Write to response
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Export attendance error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error exporting attendance' 
        });
    }
});

// Manually mark attendance
router.post('/mark-manual', authenticateToken, isTeacher, async (req, res) => {
    try {
        const { classId, studentId, status, date } = req.body;

        // Verify class belongs to teacher
        const classCheck = await db.query(
            'SELECT * FROM classes WHERE id = $1 AND teacher_id = $2',
            [classId, req.user.id]
        );

        if (classCheck.rows.length === 0) {
            return res.status(403).json({ 
                success: false, 
                message: 'Unauthorized access to class' 
            });
        }

        // Verify student is enrolled
        const enrollmentCheck = await db.query(
            'SELECT * FROM class_enrollments WHERE class_id = $1 AND student_id = $2',
            [classId, studentId]
        );

        if (enrollmentCheck.rows.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Student not enrolled in this class' 
            });
        }

        const targetDate = date || new Date().toISOString().split('T')[0];

        // Insert or update attendance
        await db.query(
            `INSERT INTO attendance (class_id, student_id, session_date, status, marked_by)
             VALUES ($1, $2, $3, $4, 'manual')
             ON CONFLICT (class_id, student_id, session_date)
             DO UPDATE SET status = $4, marked_by = 'manual', marked_at = CURRENT_TIMESTAMP`,
            [classId, studentId, targetDate, status]
        );

        res.json({
            success: true,
            message: 'Attendance marked successfully'
        });

    } catch (error) {
        console.error('Manual attendance error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error marking attendance' 
        });
    }
});

module.exports = router;



