const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const db = require('../config/database');

const googleClientId = process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID || '';
const googleOAuthClient = googleClientId ? new OAuth2Client(googleClientId) : null;

function roleForNewGoogleUser(email) {
    const raw = process.env.GOOGLE_TEACHER_EMAIL_DOMAINS || '';
    const domains = raw.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);
    if (!domains.length) {
        return 'student';
    }
    const host = (email.split('@')[1] || '').toLowerCase();
    const match = domains.some((d) => host === d || host.endsWith(`.${d}`));
    return match ? 'teacher' : 'student';
}

// Public: tells the login page whether to show Google Sign-In
router.get('/config', (req, res) => {
    res.json({
        success: true,
        googleClientId: googleClientId || null,
        googleEnabled: Boolean(googleClientId && googleOAuthClient)
    });
});

// Register new user (disabled in production unless ALLOW_PUBLIC_REGISTRATION=true)
router.post('/register', async (req, res) => {
    try {
        if (process.env.ALLOW_PUBLIC_REGISTRATION !== 'true') {
            return res.status(403).json({
                success: false,
                message: 'Public registration is disabled. Contact an administrator.'
            });
        }

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

        // Find user (case-insensitive email)
        const result = await db.query(
            'SELECT * FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid credentials' 
            });
        }

        const user = result.rows[0];

        if (!user.password) {
            return res.status(401).json({
                success: false,
                message: 'This account uses Google Sign-In. Use the Google button below.'
            });
        }

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

// Sign in / sign up with Google ID token (GIS credential)
router.post('/google', async (req, res) => {
    try {
        if (!googleOAuthClient || !googleClientId) {
            return res.status(503).json({
                success: false,
                message: 'Google Sign-In is not configured on this server'
            });
        }

        const { credential } = req.body;
        if (!credential || typeof credential !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'Google credential is required'
            });
        }

        let payload;
        try {
            const ticket = await googleOAuthClient.verifyIdToken({
                idToken: credential,
                audience: googleClientId
            });
            payload = ticket.getPayload();
        } catch (err) {
            console.error('Google token verify failed:', err.message);
            return res.status(401).json({
                success: false,
                message: 'Invalid Google sign-in. Try again.'
            });
        }

        const email = (payload.email || '').toLowerCase().trim();
        const sub = payload.sub;
        const fullName = (payload.name && String(payload.name).trim()) || email.split('@')[0] || 'User';

        if (!email || !sub) {
            return res.status(400).json({
                success: false,
                message: 'Google account did not return a valid email'
            });
        }

        if (payload.email_verified === false) {
            return res.status(400).json({
                success: false,
                message: 'Verify your email with Google before signing in'
            });
        }

        let userRow = (await db.query('SELECT * FROM users WHERE google_sub = $1', [sub])).rows[0];

        if (userRow) {
            // Already linked
        } else {
            const byEmail = await db.query('SELECT * FROM users WHERE LOWER(email) = $1', [email]);
            if (byEmail.rows.length > 0) {
                userRow = byEmail.rows[0];
                if (userRow.google_sub && userRow.google_sub !== sub) {
                    return res.status(409).json({
                        success: false,
                        message: 'This email is linked to a different Google account'
                    });
                }
                await db.query(
                    `UPDATE users SET google_sub = $1, full_name = COALESCE(NULLIF(TRIM($2), ''), full_name), updated_at = CURRENT_TIMESTAMP
                     WHERE id = $3`,
                    [sub, fullName, userRow.id]
                );
                userRow = (await db.query('SELECT * FROM users WHERE id = $1', [userRow.id])).rows[0];
            } else {
                if (process.env.ALLOW_GOOGLE_SIGNUP === 'false') {
                    return res.status(403).json({
                        success: false,
                        message: 'No account for this email. Ask an administrator to invite you, or enable signup.'
                    });
                }

                const role = roleForNewGoogleUser(email);
                const studentId =
                    role === 'student'
                        ? `G${sub.replace(/[^a-zA-Z0-9]/g, '').slice(0, 44)}`
                        : null;

                try {
                    const inserted = await db.query(
                        `INSERT INTO users (email, password, role, full_name, student_id, google_sub)
                         VALUES ($1, NULL, $2, $3, $4, $5)
                         RETURNING id, email, role, full_name, student_id, department, google_sub`,
                        [email, role, fullName, studentId, sub]
                    );
                    userRow = inserted.rows[0];
                } catch (insertErr) {
                    if (insertErr.code === '23505') {
                        return res.status(409).json({
                            success: false,
                            message: 'Could not create account (duplicate). Try signing in again.'
                        });
                    }
                    console.error('Google user insert error:', insertErr);
                    return res.status(500).json({
                        success: false,
                        message: 'Could not create your account. Ensure the database migration for Google auth has been applied.'
                    });
                }
            }
        }

        const token = jwt.sign(
            {
                id: userRow.id,
                email: userRow.email,
                role: userRow.role
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            message: 'Google sign-in successful',
            token,
            user: {
                id: userRow.id,
                email: userRow.email,
                role: userRow.role,
                full_name: userRow.full_name,
                student_id: userRow.student_id,
                department: userRow.department
            }
        });
    } catch (error) {
        console.error('Google auth error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during Google sign-in'
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
