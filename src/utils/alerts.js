const db = require('../models/database');

/**
 * Create a new alert in the database for all users except the sender
 * @param {Object} alertData - The alert data
 * @param {number} alertData.userId - The ID of the user who triggered the alert
 * @param {string} alertData.type - The type of alert (info, success, warning, error, etc.)
 * @param {string} alertData.message - The alert message
 * @param {Object} [alertData.details] - Additional details about the alert
 * @returns {Promise<Array>} Array of created alerts
 */
async function createAlert({ userId, type, message, details = {} }) {
    return new Promise((resolve, reject) => {
        const timestamp = new Date().toISOString();
        const detailsJson = JSON.stringify(details);

        // First get all admin users except the sender
        db.all('SELECT id FROM admin_users WHERE id != ?', [userId], (err, users) => {
            if (err) {
                console.error('Error getting users:', err);
                reject(err);
                return;
            }

            // Create alerts for each user
            const alertPromises = users.map(user => {
                return new Promise((resolveAlert, rejectAlert) => {
                    db.run(
                        `INSERT INTO alerts (user_id, created_by, type, message, details, created_at, is_read, deleted_at)
                         VALUES (?, ?, ?, ?, ?, ?, 0, NULL)`,
                        [user.id, userId, type, message, detailsJson, timestamp],
                        function(err) {
                            if (err) {
                                console.error('Error creating alert:', err);
                                rejectAlert(err);
                                return;
                            }
                            resolveAlert({
                                id: this.lastID,
                                userId: user.id,
                                createdBy: userId,
                                type,
                                message,
                                details,
                                createdAt: timestamp,
                                isRead: false,
                                deletedAt: null
                            });
                        }
                    );
                });
            });

            Promise.all(alertPromises)
                .then(resolve)
                .catch(reject);
        });
    });
}

/**
 * Get all alerts for a user
 * @param {number} userId - The ID of the user
 * @param {Object} [options] - Query options
 * @param {number} [options.limit=50] - Maximum number of alerts to return
 * @param {number} [options.offset=0] - Number of alerts to skip
 * @param {boolean} [options.unreadOnly=false] - Whether to return only unread alerts
 * @returns {Promise<Array>} Array of alerts
 */
async function getUserAlerts(userId, { limit = 50, offset = 0, unreadOnly = false } = {}) {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT a.*, 
                   creator.email as creator_email,
                   creator.username as creator_username
            FROM alerts a
            LEFT JOIN admin_users creator ON a.created_by = creator.id
            WHERE a.user_id = ? 
            AND a.deleted_at IS NULL
            ${unreadOnly ? 'AND a.is_read = 0' : ''}
            ORDER BY a.created_at DESC 
            LIMIT ? OFFSET ?
        `;

        db.all(query, [userId, limit, offset], (err, alerts) => {
            if (err) {
                console.error('Error getting user alerts:', err);
                reject(err);
                return;
            }

            // Parse the details JSON string back to an object
            alerts = alerts.map(alert => ({
                ...alert,
                details: JSON.parse(alert.details),
                creator: {
                    email: alert.creator_email,
                    username: alert.creator_username
                }
            }));

            resolve(alerts);
        });
    });
}

/**
 * Mark an alert as read
 * @param {number} alertId - The ID of the alert to mark as read
 * @returns {Promise<void>}
 */
async function markAlertAsRead(alertId) {
    return new Promise((resolve, reject) => {
        db.run(
            'UPDATE alerts SET is_read = 1 WHERE id = ? AND deleted_at IS NULL',
            [alertId],
            function(err) {
                if (err) {
                    console.error('Error marking alert as read:', err);
                    reject(err);
                    return;
                }
                resolve();
            }
        );
    });
}

/**
 * Mark all alerts for a user as read
 * @param {number} userId - The ID of the user
 * @returns {Promise<void>}
 */
async function markAllAlertsAsRead(userId) {
    return new Promise((resolve, reject) => {
        db.run(
            'UPDATE alerts SET is_read = 1 WHERE user_id = ? AND is_read = 0 AND deleted_at IS NULL',
            [userId],
            function(err) {
                if (err) {
                    console.error('Error marking all alerts as read:', err);
                    reject(err);
                    return;
                }
                resolve();
            }
        );
    });
}

/**
 * Get the count of unread alerts for a user
 * @param {number} userId - The ID of the user
 * @returns {Promise<number>} The count of unread alerts
 */
async function getUnreadAlertCount(userId) {
    return new Promise((resolve, reject) => {
        db.get(
            'SELECT COUNT(*) as count FROM alerts WHERE user_id = ? AND is_read = 0 AND deleted_at IS NULL',
            [userId],
            (err, result) => {
                if (err) {
                    console.error('Error getting unread alert count:', err);
                    reject(err);
                    return;
                }
                resolve(result.count);
            }
        );
    });
}

/**
 * Soft delete an alert
 * @param {number} alertId - The ID of the alert to delete
 * @returns {Promise<void>}
 */
async function deleteAlert(alertId) {
    return new Promise((resolve, reject) => {
        const timestamp = new Date().toISOString();
        db.run(
            'UPDATE alerts SET deleted_at = ? WHERE id = ?',
            [timestamp, alertId],
            function(err) {
                if (err) {
                    console.error('Error deleting alert:', err);
                    reject(err);
                    return;
                }
                resolve();
            }
        );
    });
}

/**
 * Soft delete all alerts for a user
 * @param {number} userId - The ID of the user
 * @returns {Promise<void>}
 */
async function deleteAllAlerts(userId) {
    return new Promise((resolve, reject) => {
        const timestamp = new Date().toISOString();
        db.run(
            'UPDATE alerts SET deleted_at = ? WHERE user_id = ? AND deleted_at IS NULL',
            [timestamp, userId],
            function(err) {
                if (err) {
                    console.error('Error deleting all alerts:', err);
                    reject(err);
                    return;
                }
                resolve();
            }
        );
    });
}

module.exports = {
    createAlert,
    getUserAlerts,
    markAlertAsRead,
    markAllAlertsAsRead,
    getUnreadAlertCount,
    deleteAlert,
    deleteAllAlerts
}; 