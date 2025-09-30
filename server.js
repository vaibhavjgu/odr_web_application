const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('./db.js'); // Require the centralized db pool
require('dotenv').config();

// --- CONFIGURATION ---
const PORT = 3000;
const JWT_SECRET = 'YOUR_VERY_STRONG_JWT_SECRET_KEY_HERE';

// --- ROUTERS ---
// Import the new router file for external grants
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

app.use(express.static(path.join(__dirname, 'public')));

// --- SECURITY MIDDLEWARE ("The Bouncer") ---
// This function checks for a valid JWT before allowing access to a route.


function authenticateToken(req, res, next) {
    // Tokens are usually sent in the "Authorization" header like "Bearer TOKEN_STRING"
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Extract the token part

    if (token == null) {
        // No token was provided. Access denied.
        console.log("Access denied: No token provided.");
        return res.status(401).json({ message: "Access denied. No token provided." });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            // The token is invalid (e.g., expired or malformed). Access denied.
            console.log("Access denied: Invalid token.", err.message);
            return res.status(403).json({ message: "Access denied. Invalid or expired token." });
        }
        // The token is valid! Save the user info from the token to the request object.
        req.user = user;
        // The user is authenticated. Allow them to proceed to the next function (the actual route handler).
        next();
    });
}


// --- Add this new "No Cache" middleware function ---
function setNoCacheHeaders(req, res, next) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate'); // HTTP 1.1.
    res.setHeader('Pragma', 'no-cache'); // HTTP 1.0.
    res.setHeader('Expires', '0'); // Proxies.
    next();
}


// --- API ROUTES ---

// Login Route (Stays in the main server file for now)
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

// Any request starting with /api/external-grants will be handled by the externalGrantRoutes.js file
// app.use('/api/external-grants', externalGrantRoutes);

// app.use('/api/internal-grants', internalGrantRoutes);

app.use('/api/external-grants', authenticateToken, externalGrantRoutes);

app.use('/api/internal-grants', authenticateToken, internalGrantRoutes);

app.use('/api/inventory', authenticateToken, inventoryRoutes);

app.use('/api/sops-templates', authenticateToken, sopTemplateRoutes);



// Download Route
app.get('/api/download/:key(*)', authenticateToken, (req, res) => {
    // We need s3 and the bucket name, which we can now import from s3Service
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
// This serves the main login page
// --- NEW SECURED HTML SERVING ---


// The login page is PUBLIC and can be cached.
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// The welcome page is PROTECTED and should NOT be cached.
app.get('/welcome.html', setNoCacheHeaders, (req, res) => {
    res.sendFile(path.join(__dirname, 'welcome.html'));
});

// The external grant page is PROTECTED and should NOT be cached.
app.get('/externalGrant.html', setNoCacheHeaders, (req, res) => {
    res.sendFile(path.join(__dirname,  'externalGrant.html'));
});

// The internal grant page is PROTECTED and should NOT be cached.
app.get('/internalGrant.html',  setNoCacheHeaders, (req, res) => {
    res.sendFile(path.join(__dirname, 'internalGrant.html'));
});
// Add any other protected HTML pages here in the same way.
app.get('/inventory.html', setNoCacheHeaders, (req, res) => {
    res.sendFile(path.join(__dirname, 'inventory.html'));
});


app.get('/sopsAndTemplates.html', setNoCacheHeaders, (req, res) => {
    res.sendFile(path.join(__dirname, 'sopsAndTemplates.html'));
});

// --- START SERVER ---
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Project structure refactored. External grant routes are now in a separate file.');
});