// Alert system for the admin dashboard
class AlertSystem {
    constructor() {
        this.alerts = [];
        this.alertPanel = document.getElementById('alertPanel');
        this.alertBadge = document.getElementById('alertBadge');
        this.alertList = document.getElementById('alertList');
        this.alertButton = document.getElementById('alertButton');
        this.clearAllButton = document.getElementById('clearAllAlerts');

        // Check if all required elements exist
        if (!this.alertPanel || !this.alertBadge || !this.alertList || !this.alertButton || !this.clearAllButton) {
            console.warn('Some alert system elements are missing. Alert system will not be initialized.');
            return;
        }

        this.initializeEventListeners();
        this.loadAlerts();
    }

    initializeEventListeners() {
        if (!this.alertButton || !this.alertPanel || !this.clearAllButton) return;

        // Toggle alert panel
        this.alertButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.alertPanel.classList.toggle('hidden');
        });

        // Close panel when clicking outside
        document.addEventListener('click', (e) => {
            if (this.alertPanel && !this.alertPanel.contains(e.target) && !this.alertButton.contains(e.target)) {
                this.alertPanel.classList.add('hidden');
            }
        });

        // Clear all alerts
        this.clearAllButton.addEventListener('click', () => this.clearAllAlerts());
    }

    async loadAlerts() {
        try {
            const response = await fetch('/api/admin/alerts', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                }
            });
            if (!response.ok) throw new Error('Failed to load alerts');
            
            const alerts = await response.json();
            this.alerts = alerts;
            this.renderAlerts();
            this.updateAlertBadge();
        } catch (error) {
            console.error('Error loading alerts:', error);
        }
    }

    async markAsRead(alertId) {
        try {
            const response = await fetch(`/api/admin/alerts/${alertId}/read`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                }
            });
            if (!response.ok) throw new Error('Failed to mark alert as read');
            
            const alert = this.alerts.find(a => a.id === alertId);
            if (alert) {
                alert.is_read = true;
                this.renderAlerts();
                this.updateAlertBadge();
            }
        } catch (error) {
            console.error('Error marking alert as read:', error);
        }
    }

    async markAllAsRead() {
        try {
            const response = await fetch('/api/admin/alerts/read-all', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                }
            });
            if (!response.ok) throw new Error('Failed to mark all alerts as read');
            
            this.alerts.forEach(alert => alert.is_read = true);
            this.renderAlerts();
            this.updateAlertBadge();
        } catch (error) {
            console.error('Error marking all alerts as read:', error);
        }
    }

    async removeAlert(alertId) {
        try {
            const response = await fetch(`/api/admin/alerts/${alertId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                }
            });
            if (!response.ok) throw new Error('Failed to delete alert');
            
            this.alerts = this.alerts.filter(alert => alert.id !== alertId);
            this.renderAlerts();
            this.updateAlertBadge();
        } catch (error) {
            console.error('Error removing alert:', error);
        }
    }

    async clearAllAlerts() {
        try {
            const response = await fetch('/api/admin/alerts', {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                }
            });
            if (!response.ok) throw new Error('Failed to clear all alerts');
            
            this.alerts = [];
            this.renderAlerts();
            this.updateAlertBadge();
        } catch (error) {
            console.error('Error clearing all alerts:', error);
        }
    }

    getAlertIcon(type) {
        switch (type) {
            case 'upload':
                return '<i class="fas fa-file-upload text-blue-500"></i>';
            case 'delete':
                return '<i class="fas fa-user-minus text-red-500"></i>';
            case 'verify':
                return '<i class="fas fa-check-circle text-green-500"></i>';
            case 'error':
                return '<i class="fas fa-exclamation-circle text-red-500"></i>';
            case 'info':
                return '<i class="fas fa-info-circle text-blue-500"></i>';
            case 'warning':
                return '<i class="fas fa-exclamation-triangle text-yellow-500"></i>';
            default:
                return '<i class="fas fa-bell text-gray-500"></i>';
        }
    }

    formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        // Less than 1 minute
        if (diff < 60000) {
            return 'Just now';
        }
        // Less than 1 hour
        if (diff < 3600000) {
            const minutes = Math.floor(diff / 60000);
            return `${minutes}m ago`;
        }
        // Less than 24 hours
        if (diff < 86400000) {
            const hours = Math.floor(diff / 3600000);
            return `${hours}h ago`;
        }
        // Less than 7 days
        if (diff < 604800000) {
            const days = Math.floor(diff / 86400000);
            return `${days}d ago`;
        }
        // Otherwise show date
        return date.toLocaleDateString();
    }

    renderAlerts() {
        if (!this.alertList) return;

        this.alertList.innerHTML = '';
        
        if (this.alerts.length === 0) {
            this.alertList.innerHTML = `
                <div class="p-4 text-center text-gray-500">
                    No notifications
                </div>
            `;
            return;
        }

        this.alerts.forEach(alert => {
            const alertElement = document.createElement('div');
            alertElement.className = `p-4 border-b border-gray-200 hover:bg-gray-50 transition-colors duration-150 ${alert.is_read ? 'bg-white' : 'bg-blue-50'}`;
            
            alertElement.innerHTML = `
                <div class="flex items-start">
                    <div class="flex-shrink-0 mt-1">
                        ${this.getAlertIcon(alert.type)}
                    </div>
                    <div class="ml-3 flex-1">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm font-medium text-gray-900">${alert.message}</p>
                                <p class="text-xs text-gray-500 mt-1">${alert.creator.email}</p>
                            </div>
                            <button class="text-gray-400 hover:text-gray-500" onclick="alertSystem.removeAlert(${alert.id})">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        
                        <div class="mt-2 flex items-center justify-between">
                            <span class="text-xs text-gray-400">${this.formatTimestamp(alert.created_at)}</span>
                            ${!alert.is_read ? `
                                <button class="text-xs text-blue-600 hover:text-blue-800" onclick="alertSystem.markAsRead(${alert.id})">
                                    Mark as read
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
            
            this.alertList.appendChild(alertElement);
        });
    }

    updateAlertBadge() {
        if (!this.alertBadge) return;
        
        const unreadCount = this.alerts.filter(alert => !alert.is_read).length;
        
        if (unreadCount > 0) {
            this.alertBadge.textContent = unreadCount;
            this.alertBadge.classList.remove('hidden');
        } else {
            this.alertBadge.classList.add('hidden');
        }
    }
}

// Initialize alert system when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.alertSystem = new AlertSystem();
}); 