const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken, isTeacher } = require('../middleware/auth');

// Get all classes for a course (teacher can see their classes)
router.get('/course/:courseId', authenticateToken, async (req, res) => {
    try {
        const { courseId } = req.params;
        const result = await db.query(`
            SELECT 
                cls.id, cls.class_code, cls.class_name, cls.section,
                cls.schedule, cls.room_number, cls.max_strength,
                COUNT(DISTINCT ce.id) as enrolled_count
            FROM classes cls
            LEFT JOIN class_enrollments ce ON cls.id = ce.class_id
            WHERE cls.course_id = $1
            GROUP BY cls.id
            ORDER BY cls.section
        `, [courseId]);
        res.json({ success: true, classes: result.rows });
    } catch (err) {
        console.error('Error fetching classes:', err);
        res.status(500).json({ success: false, message: 'Error fetching classes', error: err.message });
    }
});

// Get class details with enrolled students
router.get('/:classId/students', authenticateToken, async (req, res) => {
    try {
        const { classId } = req.params;
        const result = await db.query(`
            SELECT 
                u.id, u.full_name, u.email, u.student_id,
                COUNT(DISTINCT a.id) as attendance_count
            FROM class_enrollments ce
            JOIN users u ON ce.student_id = u.id
            LEFT JOIN attendance a ON ce.class_id = a.class_id AND ce.student_id = a.student_id
            WHERE ce.class_id = $1
            GROUP BY u.id
            ORDER BY u.full_name
        `, [classId]);
        res.json({ success: true, students: result.rows });
    } catch (err) {
        console.error('Error fetching class students:', err);
        res.status(500).json({ success: false, message: 'Error fetching students', error: err.message });
    }
});

// Create new class (section of course)
router.post('/', authenticateToken, isTeacher, async (req, res) => {
    try {
        const { course_id, class_code, class_name, section, schedule, room_number, max_strength } = req.body;
        const teacherId = req.user.id;

        if (!course_id || !class_code || !class_name) {
            return res.status(400).json({ success: false, message: 'Course ID, class code and name are required' });
        }

        // Verify course ownership
        const verify = await db.query('SELECT teacher_id FROM courses WHERE id = $1', [course_id]);
        if (verify.rows.length === 0 || verify.rows[0].teacher_id !== teacherId) {
            return res.status(403).json({ success: false, message: 'Unauthorized - not your course' });
        }

        const result = await db.query(`
            INSERT INTO classes (class_code, class_name, course_id, teacher_id, section, schedule, room_number, max_strength)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id, class_code, class_name, section, schedule, room_number, max_strength
        `, [class_code, class_name, course_id, teacherId, section || 'A', schedule || '', room_number || '', max_strength || 50]);

        res.json({ 
            success: true, 
            message: 'Class created successfully', 
            class: result.rows[0] 
        });
    } catch (err) {
        if (err.code === '23505') { // Unique constraint violation
            return res.status(400).json({ success: false, message: 'Class code already exists' });
        }
        console.error('Error creating class:', err);
        res.status(500).json({ success: false, message: 'Error creating class', error: err.message });
    }
});

// Update class details
router.put('/:classId', authenticateToken, isTeacher, async (req, res) => {
    try {
        const { classId } = req.params;
        const { class_name, section, schedule, room_number, max_strength } = req.body;
        const teacherId = req.user.id;

        // Verify class ownership
        const verify = await db.query('SELECT teacher_id FROM classes WHERE id = $1', [classId]);
        if (verify.rows.length === 0 || verify.rows[0].teacher_id !== teacherId) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        const result = await db.query(`
            UPDATE classes 
            SET class_name = $1, section = $2, schedule = $3, room_number = $4, max_strength = $5
            WHERE id = $6
            RETURNING id, class_code, class_name, section, schedule, room_number, max_strength
        `, [class_name, section, schedule, room_number, max_strength, classId]);

        res.json({ 
            success: true, 
            message: 'Class updated successfully', 
            class: result.rows[0] 
        });
    } catch (err) {
        console.error('Error updating class:', err);
        res.status(500).json({ success: false, message: 'Error updating class', error: err.message });
    }
});

// Delete class
router.delete('/:classId', authenticateToken, isTeacher, async (req, res) => {
    try {
        const { classId } = req.params;
        const teacherId = req.user.id;

        // Verify class ownership
        const verify = await db.query('SELECT teacher_id FROM classes WHERE id = $1', [classId]);
        if (verify.rows.length === 0 || verify.rows[0].teacher_id !== teacherId) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        await db.query('DELETE FROM classes WHERE id = $1', [classId]);

        res.json({ success: true, message: 'Class deleted successfully' });
    } catch (err) {
        console.error('Error deleting class:', err);
        res.status(500).json({ success: false, message: 'Error deleting class', error: err.message });
    }
});

module.exports = router;
