const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../../database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to SQLite database');
        createTables();
    }
});

function createTables() {
    db.serialize(() => {
        // Users table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_number TEXT UNIQUE,
            name TEXT,
            first_name TEXT,
            last_name TEXT,
            phone_number TEXT,
            alt_number TEXT,
            address TEXT,
            email TEXT UNIQUE,
            alt_email TEXT,
            verification_token TEXT,
            is_verified BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Admin users table
        db.run(`CREATE TABLE IF NOT EXISTS admin_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            email TEXT UNIQUE,
            password TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Address changes history
        db.run(`CREATE TABLE IF NOT EXISTS address_changes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            old_address TEXT,
            new_address TEXT,
            changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`);
        
        // Create new alerts table with updated schema
        db.run(`CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            created_by INTEGER NOT NULL,
            type TEXT NOT NULL,
            message TEXT NOT NULL,
            details TEXT,
            is_read BOOLEAN DEFAULT 0,
            deleted_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES admin_users(id),
            FOREIGN KEY (created_by) REFERENCES admin_users(id)
        )`);
    });
}

module.exports = db; 