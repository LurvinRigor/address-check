const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const xlsx = require('xlsx');
const csv = require('csv-parse');
const fs = require('fs');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../models/database');
const { authenticateAdmin } = require('../middleware/auth');
const { sendVerificationEmail, sendImportCompletionNotification } = require('../utils/email');
const crypto = require('crypto');
const { createAlert, getUserAlerts, markAlertAsRead, markAllAlertsAsRead, deleteAlert, deleteAllAlerts } = require('../utils/alerts');

// Define required fields
const requiredFields = [
    'client_number', 'name', 'first_name', 'last_name',
    'phone_number', 'alt_number', 'address', 'email', 'alt_email'
];

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

// Add file size limits and file filter
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['.csv', '.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only CSV, XLSX, and XLS files are allowed.'));
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: fileFilter
});

// Error handling middleware for multer
const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ message: 'File size too large. Maximum size is 5MB.' });
        }
        return res.status(400).json({ message: err.message });
    }
    next(err);
};

// Check if admin account exists
router.get('/check-setup', async (req, res) => {
    db.get('SELECT COUNT(*) as count FROM admin_users', [], (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'Database error' });
        }
        res.json({ exists: result.count > 0 });
    });
});

// Admin login or create first admin
router.post('/login', [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    body('username').optional().isLength({ min: 3 }).withMessage('Username must be at least 3 characters long'),
    body('mode').isIn(['login', 'register']).withMessage('Invalid mode')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { username, email, password, mode } = req.body;

        // Check if any admin exists
        db.get('SELECT COUNT(*) as count FROM admin_users', [], async (err, result) => {
            if (err) {
                return res.status(500).json({ message: 'Database error' });
            }

            const isFirstAdmin = result.count === 0;

            if (mode === 'register') {
                // Validate username for registration
                if (!username) {
                    return res.status(400).json({ message: 'Username is required for registration' });
                }

                // Check if user already exists
                db.get('SELECT * FROM admin_users WHERE email = ? OR username = ?', [email, username], async (err, existingUser) => {
                    if (err) {
                        return res.status(500).json({ message: 'Database error' });
                    }

                    if (existingUser) {
                        return res.status(400).json({ 
                            code: 'USER_EXISTS',
                            message: 'A user with this email or username already exists' 
                        });
                    }

                    // Create new admin account
                    const hashedPassword = await bcrypt.hash(password, 10);
                    db.run(
                        'INSERT INTO admin_users (username, email, password) VALUES (?, ?, ?)',
                        [username, email, hashedPassword],
                        function(err) {
                            if (err) {
                                return res.status(500).json({ message: 'Failed to create admin account' });
                            }

                            const token = jwt.sign(
                                { id: this.lastID, email, username },
                                process.env.JWT_SECRET,
                                { expiresIn: '24h' }
                            );

                            res.json({ token, message: 'Admin account created successfully' });
                        }
                    );
                });
            } else {
                // Login mode
                if (isFirstAdmin) {
                    return res.status(400).json({ message: 'No admin accounts exist. Please register first.' });
                }

                // Normal login - try both username and email
                db.get(
                    'SELECT * FROM admin_users WHERE email = ? OR username = ?',
                    [email, email],
                    async (err, admin) => {
                        if (err) {
                            return res.status(500).json({ message: 'Database error' });
                        }

                        if (!admin) {
                            return res.status(401).json({ message: 'Invalid credentials' });
                        }

                        const validPassword = await bcrypt.compare(password, admin.password);
                        if (!validPassword) {
                            return res.status(401).json({ message: 'Invalid credentials' });
                        }

                        const token = jwt.sign(
                            { id: admin.id, email: admin.email, username: admin.username },
                            process.env.JWT_SECRET,
                            { expiresIn: '24h' }
                        );

                        res.json({ token });
                    }
                );
            }
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Check authentication
router.get('/check-auth', authenticateAdmin, (req, res) => {
    res.json({ authenticated: true });
});

// Read file headers
router.post('/read-headers', authenticateAdmin, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const filePath = req.file.path;
        const fileExt = path.extname(req.file.originalname).toLowerCase();

        let headers = [];
        if (fileExt === '.csv') {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            const parser = csv.parse({ columns: true });
            
            // Create a promise to handle the parsing
            headers = await new Promise((resolve, reject) => {
                const records = [];
                parser.on('readable', function() {
                    let record;
                    while (record = parser.read()) {
                        records.push(record);
                    }
                });
                
                parser.on('end', function() {
                    if (records.length > 0) {
                        resolve(Object.keys(records[0]));
                    } else {
                        resolve([]);
                    }
                });
                
                parser.on('error', function(err) {
                    reject(err);
                });
                
                parser.write(fileContent);
                parser.end();
            });
        } else if (['.xlsx', '.xls'].includes(fileExt)) {
            const workbook = xlsx.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
            if (data.length > 0) {
                headers = data[0];
            }
        } else {
            return res.status(400).json({ message: 'Unsupported file format' });
        }

        // Clean up the uploaded file
        fs.unlinkSync(filePath);

        res.json({ headers });
    } catch (error) {
        console.error('Error reading headers:', error);
        res.status(500).json({ message: 'Failed to read file headers' });
    }
});

// Helper functions for file parsing
async function parseCSV(filePath) {
    return new Promise((resolve, reject) => {
        const users = [];
        try {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            const parser = csv.parse({ 
                columns: true, 
                skip_empty_lines: true,
                trim: true
            });
            
            parser.on('readable', function() {
                let record;
                while (record = parser.read()) {
                    users.push(record);
                }
            });
            
            parser.on('end', function() {
                resolve(users);
            });
            
            parser.on('error', function(err) {
                console.error('CSV parsing error:', err);
                reject(err);
            });
            
            parser.write(fileContent);
            parser.end();
        } catch (error) {
            console.error('Error reading CSV file:', error);
            reject(error);
        }
    });
}

async function parseExcel(filePath) {
    try {
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(worksheet, { 
            raw: false,
            defval: '',
            blankrows: false
        });
        return data;
    } catch (error) {
        console.error('Error reading Excel file:', error);
        throw error;
    }
}

// Upload users file
router.post('/upload', authenticateAdmin, upload.single('file'), handleMulterError, async (req, res) => {
    let filePath;
    try {
        if (!req.file) {
            // Create alert for missing file
            await createAlert({
                userId: req.admin.id,
                type: 'error',
                message: 'File upload failed: No file provided',
                details: { error: 'No file uploaded' }
            });
            return res.status(400).json({ message: 'No file uploaded' });
        }

        filePath = req.file.path;
        console.log('Processing file:', filePath);

        const fileExt = path.extname(req.file.originalname).toLowerCase();
        let fieldMapping;
        
        try {
            fieldMapping = JSON.parse(req.body.fieldMapping || '{}');
        } catch (error) {
            // Create alert for invalid field mapping
            await createAlert({
                userId: req.admin.id,
                type: 'error',
                message: 'File upload failed: Invalid field mapping',
                details: { error: error.message }
            });
            console.error('Error parsing field mapping:', error);
            return res.status(400).json({ message: 'Invalid field mapping format' });
        }

        let users = [];
        try {
            if (fileExt === '.csv') {
                users = await parseCSV(filePath);
            } else if (['.xlsx', '.xls'].includes(fileExt)) {
                users = await parseExcel(filePath);
            } else {
                // Create alert for unsupported file type
                await createAlert({
                    userId: req.admin.id,
                    type: 'error',
                    message: 'File upload failed: Unsupported file format',
                    details: { fileType: fileExt }
                });
                return res.status(400).json({ message: 'Unsupported file format' });
            }
        } catch (error) {
            // Create alert for file parsing error
            await createAlert({
                userId: req.admin.id,
                type: 'error',
                message: 'File upload failed: Error parsing file',
                details: { error: error.message }
            });
            console.error('Error parsing file:', error);
            return res.status(400).json({ message: 'Error parsing file. Please check the file format.' });
        }

        if (!users || users.length === 0) {
            // Create alert for empty file
            await createAlert({
                userId: req.admin.id,
                type: 'error',
                message: 'File upload failed: No data found in file',
                details: { fileName: req.file.originalname }
            });
            return res.status(400).json({ message: 'No data found in file' });
        }

        // Create alert for upload start
        await createAlert({
            userId: req.admin.id,
            type: 'info',
            message: 'File upload started',
            details: {
                fileName: req.file.originalname,
                totalRecords: users.length
            }
        });

        // Apply field mapping
        users = users.map(row => {
            const mappedRow = {};
            Object.entries(fieldMapping).forEach(([csvColumn, fieldName]) => {
                mappedRow[fieldName] = row[csvColumn] || '';
            });
            return mappedRow;
        });

        // Prepare statements
        const insertStmt = db.prepare(`
            INSERT INTO users (
                client_number, name, first_name, last_name,
                phone_number, alt_number, address, email, alt_email,
                verification_token, is_verified
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        `);

        const updateStmt = db.prepare(`
            UPDATE users SET
                client_number = ?,
                name = ?,
                first_name = ?,
                last_name = ?,
                phone_number = ?,
                alt_number = ?,
                address = ?,
                alt_email = ?,
                verification_token = ?,
                is_verified = 0,
                updated_at = CURRENT_TIMESTAMP
            WHERE email = ? OR client_number = ?
        `);

        // Insert users
        let insertedCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;

        for (const user of users) {
            const verificationToken = crypto.randomBytes(32).toString('hex');
            try {
                // Check if user with this email or client number already exists
                const existingUser = await new Promise((resolve, reject) => {
                    db.get(
                        'SELECT * FROM users WHERE email = ? OR client_number = ?',
                        [user.email, user.client_number],
                        (err, row) => {
                            if (err) reject(err);
                            else resolve(row);
                        }
                    );
                });

                if (existingUser) {
                    // Compare fields to check if there are any changes
                    const hasChanges = 
                        existingUser.client_number !== user.client_number ||
                        existingUser.name !== user.name ||
                        existingUser.first_name !== user.first_name ||
                        existingUser.last_name !== user.last_name ||
                        existingUser.phone_number !== user.phone_number ||
                        existingUser.alt_number !== user.alt_number ||
                        existingUser.address !== user.address ||
                        existingUser.alt_email !== user.alt_email ||
                        existingUser.email !== user.email;

                    if (hasChanges) {
                        // Update existing user
                        updateStmt.run(
                            user.client_number || '',
                            user.name || '',
                            user.first_name || '',
                            user.last_name || '',
                            user.phone_number || '',
                            user.alt_number || '',
                            user.address || '',
                            user.alt_email || '',
                            verificationToken,
                            user.email,
                            user.client_number
                        );
                        updatedCount++;

                        // Create alert for user update
                        await createAlert({
                            userId: req.admin.id,
                            type: 'update',
                            message: `User updated: ${user.email || user.client_number}`,
                            details: {
                                userId: existingUser.id,
                                email: user.email,
                                clientNumber: user.client_number,
                                changes: {
                                    clientNumber: user.client_number !== existingUser.client_number,
                                    name: user.name !== existingUser.name,
                                    firstName: user.first_name !== existingUser.first_name,
                                    lastName: user.last_name !== existingUser.last_name,
                                    phone: user.phone_number !== existingUser.phone_number,
                                    altPhone: user.alt_number !== existingUser.alt_number,
                                    address: user.address !== existingUser.address,
                                    altEmail: user.alt_email !== existingUser.alt_email
                                }
                            }
                        });

                        // Send verification email for updates
                        if (user.email) {
                            await sendVerificationEmail(user.email, verificationToken);
                        }
                    } else {
                        skippedCount++;
                        // Create alert for skipped user
                        await createAlert({
                            userId: req.admin.id,
                            type: 'skip',
                            message: `User skipped (no changes): ${user.email || user.client_number}`,
                            details: {
                                userId: existingUser.id,
                                email: user.email,
                                clientNumber: user.client_number
                            }
                        });
                    }
                } else {
                    // Insert new user
                    insertStmt.run(
                        user.client_number || '',
                        user.name || '',
                        user.first_name || '',
                        user.last_name || '',
                        user.phone_number || '',
                        user.alt_number || '',
                        user.address || '',
                        user.email || '',
                        user.alt_email || '',
                        verificationToken
                    );
                    insertedCount++;

                    // Create alert for new user
                    await createAlert({
                        userId: req.admin.id,
                        type: 'insert',
                        message: `New user added: ${user.email || user.client_number}`,
                        details: {
                            email: user.email,
                            clientNumber: user.client_number,
                            name: user.name,
                            firstName: user.first_name,
                            lastName: user.last_name
                        }
                    });

                    // Send verification email for new user
                    if (user.email) {
                        await sendVerificationEmail(user.email, verificationToken);
                    }
                }
            } catch (error) {
                console.error('Error processing user:', error);
                skippedCount++;
                // Create alert for processing error
                await createAlert({
                    userId: req.admin.id,
                    type: 'error',
                    message: `Error processing user: ${user.email || user.client_number}`,
                    details: {
                        error: error.message,
                        email: user.email,
                        clientNumber: user.client_number
                    }
                });
            }
        }

        // Finalize statements
        insertStmt.finalize();
        updateStmt.finalize();

        // Send import completion notification to admin
        try {
            await sendImportCompletionNotification({
                insertedCount,
                updatedCount,
                skippedCount
            });
        } catch (error) {
            console.error('Failed to send import completion notification:', error);
        }

        // Create summary alert
        await createAlert({
            userId: req.admin.id,
            type: 'summary',
            message: `Import summary: ${insertedCount} new, ${updatedCount} updated, ${skippedCount} skipped`,
            details: {
                fileName: req.file.originalname,
                insertedCount,
                updatedCount,
                skippedCount,
                totalProcessed: users.length
            }
        });
        // Create alert for upload start
        await createAlert({
            userId: req.admin.id,
            type: 'info',
            message: 'File upload finished',
            details: {
                fileName: req.file.originalname,
                totalRecords: users.length
            }
        });
        res.json({ 
            message: `Import completed: ${insertedCount} new users added, ${updatedCount} users updated, ${skippedCount} users skipped (no changes)`
        });
    } catch (error) {
        // Create alert for general error
        await createAlert({
            userId: req.admin.id,
            type: 'error',
            message: 'File upload failed: Unexpected error',
            details: { error: error.message }
        });
        console.error('Error in upload process:', error);
        res.status(500).json({ message: 'Failed to import users: ' + error.message });
    } finally {
        // Clean up the uploaded file
        if (filePath && fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
            } catch (error) {
                console.error('Error cleaning up file:', error);
            }
        }
    }
});

// Get users with pagination
router.get('/users', authenticateAdmin, (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;

    db.get('SELECT COUNT(*) as total FROM users', [], (err, countResult) => {
        if (err) {
            return res.status(500).json({ message: 'Database error' });
        }

        const totalPages = Math.ceil(countResult.total / limit);

        db.all(
            'SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?',
            [limit, offset],
            (err, users) => {
                if (err) {
                    return res.status(500).json({ message: 'Database error' });
                }

                res.json({
                    users,
                    currentPage: page,
                    totalPages,
                    totalUsers: countResult.total
                });
            }
        );
    });
});

// Search users
router.get('/users/search', authenticateAdmin, (req, res) => {
    const searchTerm = `%${req.query.q}%`;

    db.all(
        `SELECT * FROM users 
        WHERE client_number LIKE ? 
        OR name LIKE ? 
        OR email LIKE ? 
        OR phone_number LIKE ?
        LIMIT 10`,
        [searchTerm, searchTerm, searchTerm, searchTerm],
        (err, users) => {
            if (err) {
                return res.status(500).json({ message: 'Database error' });
            }

            res.json({ users });
        }
    );
});

// Get user details
router.get('/users/:id', authenticateAdmin, (req, res) => {
    db.get('SELECT * FROM users WHERE id = ?', [req.params.id], (err, user) => {
        if (err) {
            return res.status(500).json({ message: 'Database error' });
        }

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(user);
    });
});

// Delete user
router.delete('/users/:id', authenticateAdmin, async (req, res) => {
    try {
        // First get the user to be deleted
        const user = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM users WHERE id = ?', [req.params.id], (err, user) => {
                if (err) reject(err);
                else resolve(user);
            });
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Delete the user
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM users WHERE id = ?', [req.params.id], function(err) {
                if (err) reject(err);
                else resolve();
            });
        });

        // Create alert for user deletion
        await createAlert({
            userId: req.admin.id,
            type: 'delete',
            message: `User ${user.email || user.client_number} has been deleted`,
            details: {
                deletedUserId: req.params.id,
                deletedUserEmail: user.email,
                deletedUserClientNumber: user.client_number
            }
        });

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ message: 'Failed to delete user' });
    }
});

// Get dashboard stats
router.get('/stats', authenticateAdmin, (req, res) => {
    db.get(
        `SELECT 
            COUNT(*) as totalUsers,
            SUM(CASE WHEN is_verified = 0 THEN 1 ELSE 0 END) as pendingVerifications,
            COUNT(*) as recentChanges
        FROM users`,
        [],
        (err, stats) => {
            if (err) {
                return res.status(500).json({ message: 'Database error' });
            }

            res.json(stats);
        }
    );
});

// Get address change history
router.get('/address-changes', authenticateAdmin, (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;

    db.get('SELECT COUNT(*) as total FROM address_changes', [], (err, countResult) => {
        if (err) {
            return res.status(500).json({ message: 'Database error' });
        }

        const totalPages = Math.ceil(countResult.total / limit);

        db.all(
            `SELECT ac.*, u.email, u.client_number, u.name 
             FROM address_changes ac
             JOIN users u ON ac.user_id = u.id
             ORDER BY ac.changed_at DESC
             LIMIT ? OFFSET ?`,
            [limit, offset],
            (err, changes) => {
                if (err) {
                    return res.status(500).json({ message: 'Database error' });
                }

                res.json({
                    changes,
                    currentPage: page,
                    totalPages,
                    totalChanges: countResult.total
                });
            }
        );
    });
});

// Middleware to validate user data
const validateUserData = [
    body('clientNumber').notEmpty().withMessage('Client number is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('address').notEmpty().withMessage('Address is required'),
    body('phone').notEmpty().withMessage('Phone number is required')
];

// Submit verification
router.post('/verify', validateUserData, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { clientNumber, email, address, phone, altPhone, altEmail } = req.body;

        // Check if user exists
        db.get('SELECT * FROM users WHERE client_number = ?', [clientNumber], async (err, user) => {
            if (err) {
                return res.status(500).json({ message: 'Database error' });
            }

            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            // Generate verification token
            const verificationToken = require('crypto').randomBytes(32).toString('hex');

            // Update user information
            db.run(
                `UPDATE users SET 
                email = ?, 
                address = ?, 
                phone_number = ?, 
                alt_number = ?, 
                alt_email = ?,
                verification_token = ?,
                updated_at = CURRENT_TIMESTAMP
                WHERE client_number = ?`,
                [email, address, phone, altPhone, altEmail, verificationToken, clientNumber],
                async (err) => {
                    if (err) {
                        return res.status(500).json({ message: 'Failed to update user' });
                    }

                    // Send verification email
                    try {
                        await sendVerificationEmail(email, verificationToken);
                        res.json({ message: 'Verification email sent successfully' });
                    } catch (error) {
                        console.error('Email error:', error);
                        res.status(500).json({ message: 'Failed to send verification email' });
                    }
                }
            );
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Verify email token
router.get('/verify/:token', async (req, res) => {
    const { token } = req.params;

    db.get('SELECT * FROM users WHERE verification_token = ?', [token], async (err, user) => {
        if (err) {
            return res.status(500).json({ message: 'Database error' });
        }

        if (!user) {
            return res.status(404).json({ message: 'Invalid verification token' });
        }

        // Update user verification status
        db.run(
            'UPDATE users SET is_verified = 1, verification_token = NULL WHERE id = ?',
            [user.id],
            async (err) => {
                if (err) {
                    return res.status(500).json({ message: 'Failed to verify user' });
                }

                // Create alert for successful verification
                try {
                    await createAlert({
                        userId: 1, // Send to first admin
                        type: 'success',
                        message: `User ${user.email || user.client_number} verified`,
                        details: {
                            userId: user.id,
                            email: user.email,
                            clientNumber: user.client_number,
                            name: user.name,
                            verifiedAt: new Date().toISOString()
                        }
                    });
                } catch (alertError) {
                    console.error('Error creating verification alert:', alertError);
                }

                res.json({ message: 'Email verified successfully' });
            }
        );
    });
});

// Public verification endpoint
router.get('/api/verify/:token', async (req, res) => {
    const { token } = req.params;

    db.get('SELECT * FROM users WHERE verification_token = ?', [token], async (err, user) => {
        if (err) {
            return res.status(500).json({ message: 'Database error' });
        }

        if (!user) {
            return res.status(404).json({ message: 'Invalid verification token' });
        }

        // Update user verification status
        db.run(
            'UPDATE users SET is_verified = 1, verification_token = NULL WHERE id = ?',
            [user.id],
            async (err) => {
                if (err) {
                    return res.status(500).json({ message: 'Failed to verify user' });
                }

                // Create alert for successful verification
                try {
                    await createAlert({
                        userId: 1, // Send to first admin
                        type: 'success',
                        message: `User ${user.email || user.client_number} has verified their address`,
                        details: {
                            userId: user.id,
                            email: user.email,
                            clientNumber: user.client_number,
                            name: user.name,
                            verifiedAt: new Date().toISOString()
                        }
                    });
                } catch (alertError) {
                    console.error('Error creating verification alert:', alertError);
                }

                res.json({ message: 'Email verified successfully' });
            }
        );
    });
});

// Manually verify a user
router.post('/users/:id/verify', authenticateAdmin, (req, res) => {
    const userId = req.params.id;
    db.run('UPDATE users SET is_verified = 1, verification_token = NULL WHERE id = ?', [userId], function(err) {
        if (err) {
            return res.status(500).json({ message: 'Database error' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json({ message: 'User verified successfully' });
    });
});

// Get alerts for admin
router.get('/alerts', authenticateAdmin, async (req, res) => {
    try {
        const alerts = await getUserAlerts(req.admin.id);
        res.json(alerts);
    } catch (error) {
        console.error('Error getting alerts:', error);
        res.status(500).json({ message: 'Failed to get alerts' });
    }
});

// Mark alert as read
router.post('/alerts/:id/read', authenticateAdmin, async (req, res) => {
    try {
        await markAlertAsRead(req.params.id);
        res.json({ message: 'Alert marked as read' });
    } catch (error) {
        console.error('Error marking alert as read:', error);
        res.status(500).json({ message: 'Failed to mark alert as read' });
    }
});

// Mark all alerts as read
router.post('/alerts/read-all', authenticateAdmin, async (req, res) => {
    try {
        await markAllAlertsAsRead(req.admin.id);
        res.json({ message: 'All alerts marked as read' });
    } catch (error) {
        console.error('Error marking all alerts as read:', error);
        res.status(500).json({ message: 'Failed to mark all alerts as read' });
    }
});

// Delete alert
router.delete('/alerts/:id', authenticateAdmin, async (req, res) => {
    try {
        await deleteAlert(req.params.id);
        res.json({ message: 'Alert deleted successfully' });
    } catch (error) {
        console.error('Error deleting alert:', error);
        res.status(500).json({ message: 'Failed to delete alert' });
    }
});

// Delete all alerts
router.delete('/alerts', authenticateAdmin, async (req, res) => {
    try {
        await deleteAllAlerts(req.admin.id);
        res.json({ message: 'All alerts deleted successfully' });
    } catch (error) {
        console.error('Error deleting all alerts:', error);
        res.status(500).json({ message: 'Failed to delete all alerts' });
    }
});

module.exports = router; 