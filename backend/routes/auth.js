const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

// Register new user
router.post('/register', async (req, res) => {
    try {
        const { email, password, role, full_name, student_id, department } = req.body;

        // Validation
        if (!email || !password || !role || !full_name) {
            return res.status(400).json({ 
                success: false, 
                message: 'All fields are required' 
            });
        }

        if (role !== 'teacher' && role !== 'student') {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid role' 
            });
        }

        if (role === 'student' && !student_id) {
            return res.status(400).json({ 
                success: false, 
                message: 'Student ID required for students' 
            });
        }

        // Check if user already exists
        const userExists = await db.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (userExists.rows.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'User already exists' 
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Insert user
        const result = await db.query(
            `INSERT INTO users (email, password, role, full_name, student_id, department) 
             VALUES ($1, $2, $3, $4, $5, $6) 
             RETURNING id, email, role, full_name, student_id, department`,
            [email, hashedPassword, role, full_name, student_id || null, department || null]
        );

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            user: result.rows[0]
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error during registration' 
        });
    }
});

// Login user
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email and password required' 
            });
        }

        // Find user
        const result = await db.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid credentials' 
            });
        }

        const user = result.rows[0];

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid credentials' 
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            { 
                id: user.id, 
                email: user.email, 
                role: user.role 
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                full_name: user.full_name,
                student_id: user.student_id,
                department: user.department
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error during login' 
        });
    }
});

// Verify token (check if user is still logged in)
router.get('/verify', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: 'No token provided' 
            });
        }

        jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
            if (err) {
                return res.status(403).json({ 
                    success: false, 
                    message: 'Invalid token' 
                });
            }

            const result = await db.query(
                'SELECT id, email, role, full_name, student_id, department FROM users WHERE id = $1',
                [decoded.id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'User not found' 
                });
            }

            res.json({
                success: true,
                user: result.rows[0]
            });
        });

    } catch (error) {
        console.error('Token verification error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
});

module.exports = router;
