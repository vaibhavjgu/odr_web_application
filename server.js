const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('./db.js'); // Require the centralized db pool
require('dotenv').config();

// --- CONFIGURATION ---
const PORT = process.env.PORT || 3000; // Use environment variable for port
const JWT_SECRET = process.env.JWT_SECRET || 'YOUR_VERY_STRONG_JWT_SECRET_KEY_HERE';

// --- ROUTERS ---
const externalGrantRoutes = require('./routes/externalGrantRoutes'); 
const internalGrantRoutes = require('./routes/internalGrantRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes'); 
const sopTemplateRoutes = require('./routes/sopsAndTemplatesRoute');

// --- INITIALIZE APP ---
const app = express();

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- SERVE STATIC FILES ---
// This ONE line is now responsible for serving ALL your public assets:
// HTML, CSS, JavaScript, and images.
// It tells Express to treat the 'public' directory as the root of your website.
app.use(express.static(path.join(__dirname, 'public')));


// --- SECURITY MIDDLEWARE ("The Bouncer") ---
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) {
        return res.status(401).json({ message: "Access denied. No token provided." });
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
        const accessToken = jwt.sign({ username: user.username, id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '6h' });
        res.json({ accessToken: accessToken, username: user.username });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: "Server error during login." });
    }
});

// Protected API Routes
app.use('/api/external-grants', authenticateToken, externalGrantRoutes);
app.use('/api/internal-grants', authenticateToken, internalGrantRoutes);
app.use('/api/inventory', authenticateToken, inventoryRoutes);
app.use('/api/sops-templates', authenticateToken, sopTemplateRoutes);

// Protected Download Route
app.get('/api/download/:key(*)', authenticateToken, (req, res) => {
    const { s3, AWS_S3_BUCKET_NAME } = require('./services/s3Service.js');
    const key = req.params.key;

    if (!s3 || !AWS_S3_BUCKET_NAME) {
        return res.status(500).send("File service is not configured.");
    }
    
    const params = { Bucket: AWS_S3_BUCKET_NAME, Key: key };
    const s3Stream = s3.getObject(params).createReadStream();

    s3Stream.on('error', function(err) {
        console.error("S3 stream error:", err);
        res.status(err.statusCode || 500).send('Error retrieving file from storage.');
    });

    s3Stream.pipe(res);
});

// --- HTML FILE SERVING ---
// This section is now EMPTY because express.static handles everything.
// The no-cache headers for HTML are not strictly necessary with this setup,
// but if you needed them, you would apply them as middleware before express.static.


// --- CATCH-ALL FOR SPA (Single Page Application) - Optional but good practice ---
// If a request doesn't match an API route or a static file,
// you might want to send back the main index.html file.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// --- START SERVER ---
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});