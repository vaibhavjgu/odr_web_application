const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('./db.js');
require('dotenv').config();
const cookieParser = require('cookie-parser');
const { GetObjectCommand } = require("@aws-sdk/client-s3");

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

// --- SECURITY MIDDLEWARE ---
function authenticateToken(req, res, next) {
    let token;

    const authHeader = req.headers['authorization'];
    if (authHeader) {
        token = authHeader.split(' ')[1];
    }

    if (!token && req.cookies && req.cookies.accessToken) {
        token = req.cookies.accessToken;
    }

    if (token == null) {
        if (req.headers.accept && req.headers.accept.includes('application/json')) {
            return res.status(401).json({ message: "Access denied. No token provided." });
        } else {
            return res.redirect('/');
        }
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: "Access denied. Invalid or expired token." });
        }
        req.user = user;
        next();
    });
}

// --- API ROUTES ---

// Login Route
app.post('/api/login', async (req, res) => {
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
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid credentials" });
        }
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

// Logout Route
app.post('/api/logout', (req, res) => {
    res.cookie('accessToken', '', {
        httpOnly: true,
        expires: new Date(0)
    });
    res.status(200).json({ message: "Logged out successfully." });
});

// Protected API Routes
app.use('/api/external-grants', authenticateToken, externalGrantRoutes);
app.use('/api/internal-grants', authenticateToken, internalGrantRoutes);
app.use('/api/inventory', authenticateToken, inventoryRoutes);
app.use('/api/sops-templates', authenticateToken, sopTemplateRoutes);

// Protected S3 View/Download Route
app.get('/api/s3/view/:key(*)', authenticateToken, async (req, res) => {
    const { s3, AWS_S3_BUCKET_NAME } = require('./services/s3Service.js');
    const key = req.params.key;

    if (!s3 || !AWS_S3_BUCKET_NAME) {
        return res.status(500).send("File service is not configured.");
    }

    try {
        const command = new GetObjectCommand({
            Bucket: AWS_S3_BUCKET_NAME,
            Key: key,
        });

        const data = await s3.send(command);

        // Set headers for inline viewing (in the browser) instead of forcing download
        res.setHeader('Content-Type', data.ContentType || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${path.basename(key)}"`);
        
        // `data.Body` is a readable stream in AWS SDK v3.
        // We pipe it directly to the response object.
        data.Body.pipe(res);

    } catch (err) {
        console.error("S3 stream error for key:", key, err);
        // Provide a more user-friendly error
        if (err.name === 'NoSuchKey') {
            return res.status(404).send('File not found in storage.');
        }
        res.status(err.$metadata?.httpStatusCode || 500).send('Error retrieving file from storage.');
    }
});


// --- CATCH-ALL ROUTE ---
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// --- START SERVER ---
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});