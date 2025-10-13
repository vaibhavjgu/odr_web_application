require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('./db.js');
const cookieParser = require('cookie-parser');
const { GetObjectCommand } = require("@aws-sdk/client-s3");
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

// --- CONFIGURATION ---
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'YOUR_VERY_STRONG_JWT_SECRET_KEY_HERE';
const TOKEN_EXPIRY = '8h';
const COOKIE_MAX_AGE = 8 * 60 * 60 * 1000;

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

// --- SECURITY - RATE LIMITING ---
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: 'Too many requests from this IP, please try again after 15 minutes',
    standardHeaders: true,
    legacyHeaders: false,
});

// --- EMAIL SERVICE SETUP ---
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: (process.env.EMAIL_PORT === '465'),
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// --- SECURITY MIDDLEWARE (No changes needed) ---
function authenticateToken(req, res, next) {
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

// This route checks if a user is already logged in when they visit the root URL.
app.get('/', (req, res, next) => {
    // Check if the accessToken cookie exists
    const token = req.cookies.accessToken;

    if (token) {
        // If a token exists, try to verify it.
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (err) {
                // If token is invalid (e.g., expired), clear the bad cookie and show login page.
                res.clearCookie('accessToken');
                return res.sendFile(path.join(__dirname, 'index.html'));
            } else {
                // If token is valid, the user is already logged in. Redirect them to the welcome page.
                return res.redirect('/welcome.html');
            }
        });
    } else {
        // If no token exists, just show the login page.
        res.sendFile(path.join(__dirname, 'index.html'));
    }
});
// --- END OF NEW ROUTE HANDLER ---


// --- API ROUTES ---

// --- AUTHENTICATION ROUTES ---

// REMOVED: The old password-based login route '/api/login' is now gone.

// MODIFIED: Generate and Send OTP Route with Authorization Check
app.post('/api/auth/generate-otp', authLimiter, async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: "Email is required" });
    }
    try {
        // First, check if the user is authorized (exists in the database)
        const [rows] = await pool.query('SELECT id FROM users WHERE username = ?', [email]);
        if (rows.length === 0) {
            // As requested, explicitly deny unauthorized users
            return res.status(403).json({ message: "Not an authorised user." });
        }
        
        // If user is authorized, proceed to generate and send OTP
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
            subject: 'ODR Research Management Software Code',
            text: `Your one-time login code is: ${otp}`,
            html: `<p>Hi, <br>Your one-time login code for JGU ODR Research Management Software is: <strong>${otp}</strong></p><p>This code will expire in 10 minutes.</p>`,
        });

        res.status(200).json({ message: "An OTP has been sent to the authorised email." });
    } catch (error) {
        console.error("OTP Generation error:", error);
        res.status(500).json({ message: "Server error during OTP generation." });
    }
});

// Verify OTP and Login Route (Logic remains the same)
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

        // Success! Clear the OTP.
        await pool.query('UPDATE users SET otp_code = NULL, otp_expires = NULL WHERE id = ?', [user.id]);
        
        // Generate JWT and Cookie
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

// // Protected S3 Route (No changes needed)
// app.get('/api/s3/view/:key(*)', authenticateToken, /* ... your s3 code ... */);


// In login.js

// Protected S3 View/Download Route
app.get('/api/s3/view/:key(*)', authenticateToken, async (req, res) => {
    // Import the s3 client and bucket name from your service file
    const { s3, AWS_S3_BUCKET_NAME } = require('./services/s3Service.js');
    const key = req.params.key;

    // Check if the S3 service was configured correctly on startup
    if (!s3 || !AWS_S3_BUCKET_NAME) {
        return res.status(500).send("File service is not configured.");
    }

    try {
        // Create the command to get the object from S3
        const command = new GetObjectCommand({
            Bucket: AWS_S3_BUCKET_NAME,
            Key: key,
        });

        // Send the command and wait for the response from S3
        const data = await s3.send(command);

        // Set the appropriate headers for the browser to display the file inline
        res.setHeader('Content-Type', data.ContentType || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${path.basename(key)}"`);
        
        // `data.Body` is a readable stream. Pipe it directly to the response.
        // This efficiently streams the file from S3 to the user without loading it into server memory.
        data.Body.pipe(res);

    } catch (err) {
        console.error("S3 stream error for key:", key, err);
        if (err.name === 'NoSuchKey') {
            return res.status(404).send('File not found in storage.');
        }
        res.status(err.$metadata?.httpStatusCode || 500).send('Error retrieving file from storage.');
    }
});

// --- CATCH-ALL ROUTE ---
// app.get('*', (req, res) => {
//   res.sendFile(path.join(__dirname, 'index.html'));
// });

// --- START SERVER ---
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});