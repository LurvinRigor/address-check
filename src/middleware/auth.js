const jwt = require('jsonwebtoken');
const db = require('../models/database');

function authenticateAdmin(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Fetch admin user details from database
        db.get('SELECT id, username, email FROM admin_users WHERE id = ?', [decoded.id], (err, admin) => {
            if (err) {
                console.error('Error fetching admin user:', err);
                return res.status(500).json({ message: 'Internal server error' });
            }
            
            if (!admin) {
                return res.status(401).json({ message: 'Admin user not found' });
            }

            // Set admin user details in request
            req.admin = admin;
            next();
        });
    } catch (error) {
        return res.status(401).json({ message: 'Invalid token' });
    }
}

module.exports = {
    authenticateAdmin
}; 