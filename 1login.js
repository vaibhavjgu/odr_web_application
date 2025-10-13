const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('./db.js');
require('dotenv').config();
const cookieParser = require('cookie-parser');
const { GetObjectCommand } = require("@aws-sdk/client-s3");

// NEW: Import required modules for OTP and security
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

// --- CONFIGURATION ---
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'YOUR_VERY_STRONG_JWT_SECRET_KEY_HERE';
const TOKEN_EXPIRY = '8h';
const COOKIE_MAX_AGE = 8 * 60 * 60 * 1000; // 8 hours in milliseconds

// --- ROUTERS ---
const externalGrantRoutes = require('./routes/externalGrantRoutes.js');
const internalGrantRoutes = require('./routes/internalGrantRoutes.js');
const inventoryRoutes = require('./routes/inventoryRoutes.js');
const sopTemplateRoutes = require('./routes/sopsAndTemplatesRoute.js');

// --- INITIALIZE APP ---
const app = express();

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// --- SERVE STATIC FILES ---
app.use(express.static(__dirname));

// --- NEW: SECURITY - RATE LIMITING ---
// Apply a general rate limit to all API requests to prevent abuse
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // Limit each IP to 200 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// Apply a stricter rate limit to authentication endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 authentication attempts per windowMs
    message: 'Too many login attempts from this IP, please try again after 15 minutes',
    standardHeaders: true,
    legacyHeaders: false,
});


// --- NEW: EMAIL SERVICE SETUP ---
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: (process.env.EMAIL_PORT === '465'), // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// --- SECURITY MIDDLEWARE (No changes needed) ---
function authenticateToken(req, res, next) {
    // ... your existing authenticateToken function is perfect, no changes needed here.
    let token;
    const authHeader = req.headers['authorization'];
    if (authHeader) token = authHeader.split(' ')[1];
    if (!token && req.cookies && req.cookies.accessToken) token = req.cookies.accessToken;
    if (token == null) {
        if (req.headers.accept && req.headers.accept.includes('application/json')) {
            return res.status(401).json({ message: "Access denied. No token provided." });
        } else {
            return res.redirect('/');
        }
    }
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: "Access denied. Invalid or expired token." });
        req.user = user;
        next();
    });
}

// --- API ROUTES ---

// --- AUTHENTICATION ROUTES ---

// UPDATED: Original Password Login Route (now with rate limiting)
app.post('/api/login', authLimiter, async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
    }
    try {
        const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
        if (rows.length === 0) {
            return res.status(401).json({ message: "Invalid credentials" });
        }
        const user = rows[0];

        // Ensure user has a password set to use this route
        if (!user.password_hash) {
             return res.status(401).json({ message: "This account uses OTP login. Please request an OTP." });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid credentials" });
        }
        
        // --- Login Success Logic (Shared by both login methods) ---
        const accessToken = jwt.sign({ username: user.username, id: user.id, role: user.role }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
        res.cookie('accessToken', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: COOKIE_MAX_AGE,
            sameSite: 'strict'
        });
        res.json({ accessToken: accessToken, username: user.username });

    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: "Server error during login." });
    }
});

// NEW: Generate and Send OTP Route
app.post('/api/auth/generate-otp', authLimiter, async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: "Email is required" });
    }
    try {
        const [rows] = await pool.query('SELECT id FROM users WHERE username = ?', [email]);
        if (rows.length === 0) {
            // Security: Don't reveal if the user exists.
            return res.status(200).json({ message: "If an account with this email exists, an OTP has been sent." });
        }
        
        const otp = crypto.randomInt(100000, 999999).toString();
        const hashedOtp = await bcrypt.hash(otp, 10);
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minute expiry

        await pool.query(
            'UPDATE users SET otp_code = ?, otp_expires = ? WHERE username = ?',
            [hashedOtp, otpExpires, email]
        );

        await transporter.sendMail({
            from: `"Your Application" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Your Application Login Code',
            text: `Your one-time login code is: ${otp}`,
            html: `<p>Your one-time login code is: <strong>${otp}</strong></p><p>This code will expire in 10 minutes.</p>`,
        });

        res.status(200).json({ message: "If an account with this email exists, an OTP has been sent." });
    } catch (error) {
        console.error("OTP Generation error:", error);
        res.status(500).json({ message: "Server error during OTP generation." });
    }
});

// NEW: Verify OTP and Login Route
app.post('/api/auth/verify-otp', authLimiter, async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) {
        return res.status(400).json({ message: "Email and OTP are required" });
    }
    try {
        const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [email]);
        if (rows.length === 0) {
            return res.status(401).json({ message: "Invalid credentials." });
        }
        const user = rows[0];

        if (!user.otp_code || new Date() > new Date(user.otp_expires)) {
            return res.status(401).json({ message: "OTP is invalid or has expired. Please request a new one." });
        }

        const isMatch = await bcrypt.compare(otp, user.otp_code);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid credentials." });
        }

        // Success! Clear the OTP to make it single-use.
        await pool.query('UPDATE users SET otp_code = NULL, otp_expires = NULL WHERE id = ?', [user.id]);
        
        // --- Login Success Logic (Shared by both login methods) ---
        const accessToken = jwt.sign({ username: user.username, id: user.id, role: user.role }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
        res.cookie('accessToken', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: COOKIE_MAX_AGE,
            sameSite: 'strict'
        });
        res.json({ accessToken: accessToken, username: user.username });

    } catch (error) {
        console.error("OTP Verification error:", error);
        res.status(500).json({ message: "Server error during login." });
    }
});


// Logout Route (No changes needed)
app.post('/api/logout', (req, res) => {
    res.cookie('accessToken', '', { httpOnly: true, expires: new Date(0) });
    res.status(200).json({ message: "Logged out successfully." });
});

// Protected API Routes (No changes needed)
app.use('/api/external-grants', authenticateToken, externalGrantRoutes);
app.use('/api/internal-grants', authenticateToken, internalGrantRoutes);
app.use('/api/inventory', authenticateToken, inventoryRoutes);
app.use('/api/sops-templates', authenticateToken, sopTemplateRoutes);

// Protected S3 Route (No changes needed)
app.get('/api/s3/view/:key(*)', authenticateToken, async (req, res) => {
    // ... your existing S3 code is fine
});

// --- CATCH-ALL ROUTE ---
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// --- START SERVER ---
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});


/// this is first version of otp based login
