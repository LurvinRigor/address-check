document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    checkAuth();

    // Initialize components
    initializeFileUpload();
    initializeUserTable();
    initializeSearch();
    initializeStats();

    // Event listeners
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
});

async function checkAuth() {
    const token = localStorage.getItem('adminToken');
    if (!token) {
        window.location.href = '/';
        return;
    }

    try {
        const response = await fetch('/api/admin/check-auth', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            localStorage.removeItem('adminToken');
            window.location.href = '/';
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('adminToken');
        window.location.href = '/';
    }
}

function getAuthHeaders() {
    const token = localStorage.getItem('adminToken');
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
}

let currentMapping = {};
const requiredFields = [
    'client_number', 'name', 'first_name', 'last_name',
    'phone_number', 'alt_number', 'address', 'email', 'alt_email'
];

function initializeFileUpload() {
    const uploadForm = document.getElementById('uploadForm');
    const fileInput = document.getElementById('fileUpload');
    const dropZone = document.getElementById('dropZone');
    const dropZoneText = document.getElementById('dropZoneText');
    const dropZoneIcon = document.getElementById('dropZoneIcon');
    const fieldSettingsModal = document.getElementById('fieldSettingsModal');
    const closeFieldSettings = document.getElementById('closeFieldSettings');
    const mappingRows = document.getElementById('mappingRows');
    
    let availableColumns = [];
    let mappingList = [];
    
    const availableFields = [
        { value: 'client_number', label: 'Client Number' },
        { value: 'name', label: 'Name' },
        { value: 'first_name', label: 'First Name' },
        { value: 'last_name', label: 'Last Name' },
        { value: 'phone_number', label: 'Phone Number' },
        { value: 'alt_number', label: 'Alternative Phone' },
        { value: 'address', label: 'Address' },
        { value: 'email', label: 'Email' },
        { value: 'alt_email', label: 'Alternative Email' }
    ];
    
    // Field settings modal handlers
    function showFieldSettings() {
        fieldSettingsModal.classList.remove('hidden');
        fieldSettingsModal.classList.add('flex');
    }

    function hideFieldSettings() {
        fieldSettingsModal.classList.add('hidden');
        fieldSettingsModal.classList.remove('flex');
    }

    closeFieldSettings.addEventListener('click', hideFieldSettings);

    // Render mapping rows
    function renderMappingRows() {
        mappingRows.innerHTML = '';
        mappingList.forEach((mapping, idx) => {
            const row = document.createElement('div');
            row.className = 'flex flex-row gap-4 justify-between items-end w-full';
            row.innerHTML = `
                <div class="w-1/2">
                    ${idx === 0 ? '<label class="block text-sm font-medium text-gray-700 mb-2">Map To Field</label>' : ''}
                    <select class="fieldMapping w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 outline-none p-2 border">
                        <option value="">Select field...</option>
                        ${availableFields.map(f => `<option value="${f.value}" ${mapping.field === f.value ? 'selected' : ''}>${f.label}</option>`).join('')}
                    </select>
                </div>
                <div class="w-1/2">
                    ${idx === 0 ? '<label class="block text-sm font-medium text-gray-700 mb-2">CSV/Excel Column</label>' : ''}
                    <select class="csvColumn w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 outline-none p-2 border">
                        <option value="">Select column...</option>
                        ${availableColumns.map(col => `<option value="${col}" ${mapping.csv === col ? 'selected' : ''}>${col}</option>`).join('')}
                    </select>
                </div>
            `;
            mappingRows.appendChild(row);
        });

        // Add event listeners for select changes
        mappingRows.querySelectorAll('.csvColumn').forEach((sel, idx) => {
            sel.onchange = function() {
                mappingList[idx].csv = this.value;
            };
        });

        mappingRows.querySelectorAll('.fieldMapping').forEach((sel, idx) => {
            sel.onchange = function() {
                mappingList[idx].field = this.value;
            };
        });
    }

    // Drag and drop events
    if (dropZone) {
        dropZone.addEventListener('click', function(e) {
            if (e.target !== fileInput) fileInput.click();
        });
        dropZone.addEventListener('dragover', function(e) {
            e.preventDefault();
            dropZone.classList.add('border-blue-500');
            dropZone.classList.add('bg-white');
            dropZone.style.borderColor = '#3b82f6';
        });
        dropZone.addEventListener('dragleave', function(e) {
            e.preventDefault();
            dropZone.classList.remove('bg-white');
            dropZone.style.borderColor = '';
        });
        dropZone.addEventListener('drop', function(e) {
            e.preventDefault();
            dropZone.classList.remove('bg-white');
            dropZone.style.borderColor = '';
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                fileInput.files = e.dataTransfer.files;
                fileInput.dispatchEvent(new Event('change'));
            }
        });
    }

    // Only update dropZone UI on file change
    fileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (dropZoneText) {
            dropZoneText.innerHTML = file 
                ? file.name + '<br><span class="text-sm">Drag & drop or click to select</span>'
                : 'No file chosen<br><span class="text-sm">Drag & drop or click to select</span>';
        }
        if (dropZoneIcon) {
            dropZoneIcon.className = file ? 'fas fa-file-alt text-2xl text-green-500 mb-2' : 'fas fa-file-upload text-2xl text-blue-500 mb-2';
        }
    });

    // Fetch headers and show field settings modal only on upload button click
    uploadForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        if (!fileInput.files[0]) {
            showAlert('danger', 'Please select a file to upload.');
            return;
        }

        const formData = new FormData();
        formData.append('file', fileInput.files[0]);
        try {
            const response = await fetch('/api/admin/read-headers', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                },
                body: formData
            });
            const data = await response.json();
            if (response.ok) {
                if (!data.headers || !Array.isArray(data.headers) || data.headers.length === 0) {
                    showAlert('danger', 'No headers found in the file. Please check your file format.');
                    return;
                }
                availableColumns = data.headers;
                
                // Initialize mappingList with all available fields and try to match CSV columns
                mappingList = availableFields.map(field => {
                    // Try to find a matching column name (case-insensitive)
                    const matchingColumn = availableColumns.find(col => 
                        col.toLowerCase().replace(/[^a-z0-9]/g, '') === field.value.toLowerCase()
                    );
                    return {
                        field: field.value,
                        csv: matchingColumn || ''
                    };
                });
                renderMappingRows();
                showFieldSettings();
            } else {
                showAlert('danger', data.message || 'Failed to read file headers');
            }
        } catch (error) {
            showAlert('danger', 'Failed to read file headers');
            console.error('Error:', error);
        }
    });

    // Add upload button to field settings modal
    const fieldSettingsContent = fieldSettingsModal.querySelector('.space-y-4');
    const uploadButton = document.createElement('button');
    uploadButton.className = 'w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center group';
    uploadButton.innerHTML = `
        <i class="fas fa-upload mr-2 group-hover:translate-y-[-2px] transition-transform duration-300"></i>
        <span class="group-hover:translate-y-[-1px] transition-transform duration-300">Upload File</span>
    `;
    uploadButton.onclick = async function(e) {
        e.preventDefault();
        
        // Validate mappings
        const mappedFields = mappingList.map(m => m.field).filter(Boolean);
        const missingFields = requiredFields.filter(field => !mappedFields.includes(field));
        if (missingFields.length > 0) {
            showAlert('danger', `Please map all required fields: ${missingFields.join(', ')}`);
            return;
        }

        // Create field mapping object
        const fieldMapping = {};
        mappingList.forEach(mapping => {
            if (mapping.csv && mapping.field) {
                fieldMapping[mapping.csv] = mapping.field;
            }
        });

        // Upload file
        const formData = new FormData();
        formData.append('file', fileInput.files[0]);
        formData.append('fieldMapping', JSON.stringify(fieldMapping));

        // Show loading state
        uploadButton.disabled = true;
        uploadButton.innerHTML = `
            <i class="fas fa-spinner fa-spin mr-2"></i>
            <span>Uploading...</span>
        `;

        let retryCount = 0;
        const maxRetries = 3;
        const retryDelay = 1000; // 1 second

        async function attemptUpload() {
            try {
                const response = await fetch('/api/admin/upload', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                    },
                    body: formData
                });

                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.message || 'Upload failed');
                }

                const data = await response.json();
                showAlert('success', data.message);
                hideFieldSettings();
                initializeUserTable();
                initializeStats();
                // Reset form
                fileInput.value = '';
                if (dropZoneText) {
                    dropZoneText.innerHTML = 'No file chosen<br><span class="text-sm">Drag & drop or click to select</span>';
                }
                if (dropZoneIcon) {
                    dropZoneIcon.className = 'fas fa-file-upload text-2xl text-blue-500 mb-2';
                }
            } catch (error) {
                console.error('Upload error:', error);
                
                if (retryCount < maxRetries) {
                    retryCount++;
                    console.log(`Retrying upload (${retryCount}/${maxRetries})...`);
                    uploadButton.innerHTML = `
                        <i class="fas fa-spinner fa-spin mr-2"></i>
                        <span>Retrying... (${retryCount}/${maxRetries})</span>
                    `;
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                    return attemptUpload();
                }

                showAlert('danger', error.message || 'Upload failed. Please try again.');
            } finally {
                // Reset button state
                uploadButton.disabled = false;
                uploadButton.innerHTML = `
                    <i class="fas fa-upload mr-2 group-hover:translate-y-[-2px] transition-transform duration-300"></i>
                    <span class="group-hover:translate-y-[-1px] transition-transform duration-300">Upload File</span>
                `;
            }
        }

        await attemptUpload();
    };
    fieldSettingsContent.appendChild(uploadButton);
}

async function initializeUserTable(page = 1) {
    try {
        const response = await fetch(`/api/admin/users?page=${page}`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();

        const tbody = document.getElementById('userTableBody');
        tbody.innerHTML = '';

        data.users.forEach(user => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">${user.client_number}</td>
                <td class="px-6 py-4 whitespace-nowrap">${user.name}</td>
                <td class="px-6 py-4 whitespace-nowrap">${user.first_name}</td>
                <td class="px-6 py-4 whitespace-nowrap">${user.last_name}</td>
                <td class="px-6 py-4 whitespace-nowrap">${user.phone_number}</td>
                <td class="px-6 py-4 whitespace-nowrap">${user.alt_number}</td>
                <td class="px-6 py-4 whitespace-nowrap">${user.address}</td>
                <td class="px-6 py-4 whitespace-nowrap">${user.email}</td>
                <td class="px-6 py-4 whitespace-nowrap">${user.alt_email}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 py-1 text-xs font-semibold rounded-full ${user.is_verified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">
                        ${user.is_verified ? 'Verified' : 'Pending'}
                    </span>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Update pagination
        updatePagination(data.totalPages, page);
    } catch (error) {
        console.error('Error loading users:', error);
        showAlert('danger', 'Failed to load users');
    }
}

function updatePagination(totalPages, currentPage) {
    const pagination = document.getElementById('pagination');
    pagination.innerHTML = '';

    for (let i = 1; i <= totalPages; i++) {
        const li = document.createElement('li');
        li.className = `inline-block ${i === currentPage ? 'bg-blue-500 text-white' : 'bg-white text-gray-700'} px-4 py-2 mx-1 rounded hover:bg-blue-100 cursor-pointer`;
        li.innerHTML = `
            <a href="#" onclick="initializeUserTable(${i})">${i}</a>
        `;
        pagination.appendChild(li);
    }
}

function initializeSearch() {
    const searchInput = document.getElementById('searchInput');
    let timeout = null;

    searchInput.addEventListener('input', function(e) {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            const searchTerm = e.target.value;
            if (searchTerm.length >= 2) {
                searchUsers(searchTerm);
            } else if (searchTerm.length === 0) {
                initializeUserTable();
            }
        }, 300);
    });
}

async function searchUsers(term) {
    try {
        const response = await fetch(`/api/admin/users/search?q=${encodeURIComponent(term)}`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();

        const tbody = document.getElementById('userTableBody');
        tbody.innerHTML = '';

        data.users.forEach(user => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">${user.client_number}</td>
                <td class="px-6 py-4 whitespace-nowrap">${user.name}</td>
                <td class="px-6 py-4 whitespace-nowrap">${user.email}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 py-1 text-xs font-semibold rounded-full ${user.is_verified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">
                        ${user.is_verified ? 'Verified' : 'Pending'}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <button class="text-blue-600 hover:text-blue-900 mr-2" onclick="viewUser(${user.id})">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="text-red-600 hover:text-red-900" onclick="deleteUser(${user.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Error searching users:', error);
        showAlert('danger', 'Search failed');
    }
}

async function initializeStats() {
    try {
        const response = await fetch('/api/admin/stats', {
            headers: getAuthHeaders()
        });
        const data = await response.json();

        document.getElementById('totalUsers').textContent = data.totalUsers;
        document.getElementById('pendingVerifications').textContent = data.pendingVerifications;
        document.getElementById('recentChanges').textContent = data.recentChanges;
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function viewUser(userId) {
    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            headers: getAuthHeaders()
        });
        const user = await response.json();

        // Update modal content
        document.getElementById('modalClientNumber').textContent = user.client_number;
        document.getElementById('modalName').textContent = user.name;
        document.getElementById('modalFirstName').textContent = user.first_name;
        document.getElementById('modalLastName').textContent = user.last_name;
        document.getElementById('modalEmail').textContent = user.email;
        document.getElementById('modalAltEmail').textContent = user.alt_email || 'N/A';
        document.getElementById('modalPhone').textContent = user.phone_number;
        document.getElementById('modalAltPhone').textContent = user.alt_number || 'N/A';
        document.getElementById('modalAddress').textContent = user.address;
        
        const statusSpan = document.getElementById('modalStatus');
        statusSpan.innerHTML = `
            <span class="px-2 py-1 text-xs font-semibold rounded-full ${user.is_verified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">
                ${user.is_verified ? 'Verified' : 'Pending'}
            </span>
        `;

        // Show modal
        const modal = document.getElementById('userModal');
        modal.classList.remove('hidden');
        modal.classList.add('flex');

        // Add click event to close button
        const closeButton = modal.querySelector('button[data-bs-dismiss="modal"]');
        closeButton.onclick = () => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        };

        // Close modal when clicking outside
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }
        };
    } catch (error) {
        console.error('Error loading user details:', error);
        showAlert('danger', 'Failed to load user details');
    }
}

async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user?')) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        if (response.ok) {
            showAlert('success', 'User deleted successfully');
            initializeUserTable();
            initializeStats();
        } else {
            const data = await response.json();
            showAlert('danger', data.message || 'Failed to delete user');
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        showAlert('danger', 'Failed to delete user');
    }
}

async function verifyUser(userId) {
    if (!confirm('Are you sure you want to manually verify this user?')) {
        return;
    }
    try {
        const response = await fetch(`/api/admin/users/${userId}/verify`, {
            method: 'POST',
            headers: getAuthHeaders()
        });
        const data = await response.json();
        if (response.ok) {
            showAlert('success', data.message || 'User verified successfully');
            initializeUserTable();
            initializeStats();
        } else {
            showAlert('danger', data.message || 'Failed to verify user');
        }
    } catch (error) {
        console.error('Error verifying user:', error);
        showAlert('danger', 'Failed to verify user');
    }
}

async function handleLogout(e) {
    e.preventDefault();
    localStorage.removeItem('adminToken');
    window.location.href = '/';
}

function showAlert(type, message) {
    const alertDiv = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
    alertDiv.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg ${bgColor} z-50`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="ml-4 text-gray-500 hover:text-gray-700" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;

    document.body.appendChild(alertDiv);

    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
} 