const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken, isTeacher } = require('../middleware/auth');

// Get all courses (for browse/enroll)
router.get('/', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                c.id, c.course_code, c.course_name, c.subject_description, 
                c.credits, c.semester,
                u.full_name as teacher_name,
                COUNT(DISTINCT cls.id) as num_sections,
                COUNT(DISTINCT ce.id) as total_enrolled
            FROM courses c
            LEFT JOIN users u ON c.teacher_id = u.id
            LEFT JOIN classes cls ON c.id = cls.course_id
            LEFT JOIN class_enrollments ce ON cls.id = ce.class_id
            GROUP BY c.id, u.full_name
            ORDER BY c.course_code
        `);
        res.json({ success: true, courses: result.rows });
    } catch (err) {
        console.error('Error fetching courses:', err);
        res.status(500).json({ success: false, message: 'Error fetching courses', error: err.message });
    }
});

// Get teacher's courses
router.get('/my-courses', authenticateToken, isTeacher, async (req, res) => {
    try {
        const teacherId = req.user.id;
        const result = await db.query(`
            SELECT 
                c.id, c.course_code, c.course_name, c.subject_description, 
                c.credits, c.semester, c.created_at,
                COUNT(DISTINCT cls.id) as num_sections,
                COUNT(DISTINCT ce.id) as total_enrolled
            FROM courses c
            LEFT JOIN classes cls ON c.id = cls.course_id
            LEFT JOIN class_enrollments ce ON cls.id = ce.class_id
            WHERE c.teacher_id = $1
            GROUP BY c.id
            ORDER BY c.created_at DESC
        `, [teacherId]);
        res.json({ success: true, courses: result.rows });
    } catch (err) {
        console.error('Error fetching teacher courses:', err);
        res.status(500).json({ success: false, message: 'Error fetching courses', error: err.message });
    }
});

// Get student's enrolled courses
router.get('/my-enrollment', authenticateToken, async (req, res) => {
    try {
        const studentId = req.user.id;
        const result = await db.query(`
            SELECT DISTINCT
                c.id, c.course_code, c.course_name, c.subject_description, 
                c.credits, c.semester,
                u.full_name as teacher_name,
                cls.id as class_id,
                cls.class_code, cls.schedule, cls.room_number, cls.section,
                COUNT(DISTINCT a.id) as attendance_count
            FROM courses c
            JOIN classes cls ON c.id = cls.course_id
            JOIN class_enrollments ce ON cls.id = ce.class_id
            JOIN users u ON c.teacher_id = u.id
            LEFT JOIN attendance a ON ce.class_id = a.class_id AND ce.student_id = a.student_id
            WHERE ce.student_id = $1
            GROUP BY c.id, cls.id, u.full_name
            ORDER BY c.course_code
        `, [studentId]);
        res.json({ success: true, courses: result.rows });
    } catch (err) {
        console.error('Error fetching student courses:', err);
        res.status(500).json({ success: false, message: 'Error fetching courses', error: err.message });
    }
});

// Create new course (teacher only)
router.post('/', authenticateToken, isTeacher, async (req, res) => {
    try {
        const { course_code, course_name, subject_description, credits, semester } = req.body;
        const teacherId = req.user.id;

        if (!course_code || !course_name) {
            return res.status(400).json({ success: false, message: 'Course code and name are required' });
        }

        const result = await db.query(`
            INSERT INTO courses (course_code, course_name, subject_description, teacher_id, credits, semester)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, course_code, course_name, subject_description, credits, semester
        `, [course_code, course_name, subject_description || '', teacherId, credits || 3, semester || 'Spring 2026']);

        res.json({ 
            success: true, 
            message: 'Course created successfully', 
            course: result.rows[0] 
        });
    } catch (err) {
        if (err.code === '23505') { // Unique constraint violation
            return res.status(400).json({ success: false, message: 'Course code already exists' });
        }
        console.error('Error creating course:', err);
        res.status(500).json({ success: false, message: 'Error creating course', error: err.message });
    }
});

// Update course
router.put('/:courseId', authenticateToken, isTeacher, async (req, res) => {
    try {
        const { courseId } = req.params;
        const { course_name, subject_description, credits, semester } = req.body;
        const teacherId = req.user.id;

        // Verify course ownership
        const verify = await db.query('SELECT teacher_id FROM courses WHERE id = $1', [courseId]);
        if (verify.rows.length === 0 || verify.rows[0].teacher_id !== teacherId) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        const result = await db.query(`
            UPDATE courses 
            SET course_name = $1, subject_description = $2, credits = $3, semester = $4, updated_at = CURRENT_TIMESTAMP
            WHERE id = $5
            RETURNING id, course_code, course_name, subject_description, credits, semester
        `, [course_name, subject_description, credits, semester, courseId]);

        res.json({ 
            success: true, 
            message: 'Course updated successfully', 
            course: result.rows[0] 
        });
    } catch (err) {
        console.error('Error updating course:', err);
        res.status(500).json({ success: false, message: 'Error updating course', error: err.message });
    }
});

// Delete course
router.delete('/:courseId', authenticateToken, isTeacher, async (req, res) => {
    try {
        const { courseId } = req.params;
        const teacherId = req.user.id;

        // Verify course ownership
        const verify = await db.query('SELECT teacher_id FROM courses WHERE id = $1', [courseId]);
        if (verify.rows.length === 0 || verify.rows[0].teacher_id !== teacherId) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        await db.query('DELETE FROM courses WHERE id = $1', [courseId]);

        res.json({ success: true, message: 'Course deleted successfully' });
    } catch (err) {
        console.error('Error deleting course:', err);
        res.status(500).json({ success: false, message: 'Error deleting course', error: err.message });
    }
});

module.exports = router;
