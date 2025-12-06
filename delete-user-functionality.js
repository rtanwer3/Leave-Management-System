// ============================================
// DELETE USER FUNCTIONALITY
// Admin can delete users from their school
// ============================================

// Note: API_BASE is already defined in app.js, no need to redeclare

/**
 * Delete user with confirmation
 * @param {number} userId - ID of user to delete
 * @param {string} userName - Name of user (for confirmation)
 */
async function deleteUser(userId, userName) {
    console.log('🗑️ Delete user requested:', {userId, userName});
    
    // Confirmation dialog
    const confirmMessage = `Are you sure you want to delete this user?\n\nUser: ${userName}\nID: ${userId}\n\nThis action cannot be undone!`;
    
    if (!confirm(confirmMessage)) {
        console.log('❌ User deletion cancelled');
        return;
    }
    
    try {
        // Show loading state
        showLoadingState(`Deleting ${userName}...`);
        
        // Get auth token
        const authToken = localStorage.getItem('authToken');
        
        if (!authToken) {
            throw new Error('Not authenticated');
        }
        
        // Call delete endpoint
        const response = await fetch(`${API_BASE}/admin/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.status === 204) {
            // Success - No content returned
            console.log('✅ User deleted successfully');
            showSuccessMessage(`User "${userName}" has been deleted successfully`);
            
            // Refresh the users list
            if (typeof loadUsersForDeletion === 'function') {
                setTimeout(() => loadUsersForDeletion(), 500);
            }
            
        } else if (response.status === 404) {
            throw new Error('User not found');
            
        } else if (response.status === 403) {
            throw new Error('Access denied: User belongs to different school');
            
        } else {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to delete user');
        }
        
    } catch (error) {
        console.error('❌ Error deleting user:', error);
        showErrorMessage('Error: ' + error.message);
    }
}

/**
 * Load users for deletion management
 */
async function loadUsersForDeletion() {
    console.log('📋 Loading users for deletion management...');
    
    const usersList = document.getElementById('users-list');
    if (!usersList) {
        console.error('❌ Users list element not found');
        return;
    }
    
    try {
        // Show loading
        usersList.innerHTML = '<p class="loading">Loading users...</p>';
        
        const authToken = localStorage.getItem('authToken');
        
        // Fetch users from your school
        // Note: Update this endpoint to match your actual users endpoint
        const response = await fetch(`${API_BASE}/admin/users`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load users');
        }
        
        const users = await response.json();
        console.log('✅ Users loaded:', users);
        
        displayUsersForDeletion(users);
        
    } catch (error) {
        console.error('❌ Error loading users:', error);
        usersList.innerHTML = `<p class="error">Error loading users: ${error.message}</p>`;
    }
}

/**
 * Display users in deletion management interface
 */
function displayUsersForDeletion(users) {
    const usersList = document.getElementById('users-list');
    
    if (!users || users.length === 0) {
        usersList.innerHTML = `
            <div class="no-data">
                <p>No users found in your school</p>
            </div>
        `;
        return;
    }
    
    let html = `
        <div class="users-table">
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Mobile</th>
                        <th>User Type</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    users.forEach(user => {
        // Don't allow deleting the current user
        const isCurrentUser = parseInt(localStorage.getItem('userId')) === user.id;
        
        html += `
            <tr>
                <td>${user.id}</td>
                <td>${user.name}</td>
                <td>${user.email || '-'}</td>
                <td>${user.mobile || '-'}</td>
                <td>
                    <span class="badge ${user.user_type === 'admin' ? 'badge-admin' : 'badge-user'}">
                        ${user.user_type}
                    </span>
                </td>
                <td>
                    ${isCurrentUser ? 
                        '<span class="text-muted">Current User</span>' :
                        `<button 
                            class="btn-delete" 
                            onclick="deleteUser(${user.id}, '${user.name.replace(/'/g, "\\'")}')"
                        >
                            🗑️ Delete
                        </button>`
                    }
                </td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    usersList.innerHTML = html;
}

/**
 * Show loading state
 */
function showLoadingState(message) {
    const statusDiv = document.getElementById('delete-status');
    if (statusDiv) {
        statusDiv.innerHTML = `<p class="loading">${message}</p>`;
        statusDiv.style.display = 'block';
    }
}

/**
 * Show success message
 */
function showSuccessMessage(message) {
    const statusDiv = document.getElementById('delete-status');
    if (statusDiv) {
        statusDiv.innerHTML = `<p class="success">${message}</p>`;
        statusDiv.style.display = 'block';
        
        // Hide after 3 seconds
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 3000);
    }
    
    // Also show alert
    alert(message);
}

/**
 * Show error message
 */
function showErrorMessage(message) {
    const statusDiv = document.getElementById('delete-status');
    if (statusDiv) {
        statusDiv.innerHTML = `<p class="error">${message}</p>`;
        statusDiv.style.display = 'block';
        
        // Hide after 5 seconds
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 5000);
    }
    
    // Also show alert
    alert(message);
}

/**
 * Initialize delete user view
 */
function initializeDeleteUserView() {
    console.log('🗑️ Initializing Delete User view...');
    loadUsersForDeletion();
}

// Export functions
window.deleteUser = deleteUser;
window.loadUsersForDeletion = loadUsersForDeletion;
window.initializeDeleteUserView = initializeDeleteUserView;

// ============================================
// CSS STYLES
// ============================================

const deleteUserStyles = `
<style>
.users-table {
    margin-top: 1.5rem;
    overflow-x: auto;
}

.users-table table {
    width: 100%;
    border-collapse: collapse;
    background: white;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    border-radius: 8px;
    overflow: hidden;
}

.users-table thead {
    background: #2196f3;
    color: white;
}

.users-table th,
.users-table td {
    padding: 12px;
    text-align: left;
    border-bottom: 1px solid #e0e0e0;
}

.users-table th {
    font-weight: 600;
    text-transform: uppercase;
    font-size: 0.875rem;
    letter-spacing: 0.5px;
}

.users-table tbody tr:hover {
    background: #f5f5f5;
}

.users-table tbody tr:last-child td {
    border-bottom: none;
}

.badge {
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
}

.badge-admin {
    background: #4caf50;
    color: white;
}

.badge-user {
    background: #2196f3;
    color: white;
}

.btn-delete {
    padding: 6px 16px;
    background: #f44336;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    transition: background 0.2s;
}

.btn-delete:hover {
    background: #d32f2f;
}

.btn-delete:active {
    background: #c62828;
}

.text-muted {
    color: #999;
    font-style: italic;
}

.no-data {
    text-align: center;
    padding: 3rem;
    color: #666;
}

.loading {
    text-align: center;
    color: #2196f3;
    padding: 2rem;
    font-style: italic;
}

.success {
    background: #e8f5e9;
    color: #2e7d32;
    padding: 12px;
    border-radius: 4px;
    border-left: 4px solid #4caf50;
    margin-bottom: 1rem;
}

.error {
    background: #ffebee;
    color: #c62828;
    padding: 12px;
    border-radius: 4px;
    border-left: 4px solid #f44336;
    margin-bottom: 1rem;
}

/* Responsive */
@media (max-width: 768px) {
    .users-table {
        font-size: 0.875rem;
    }
    
    .users-table th,
    .users-table td {
        padding: 8px;
    }
}
</style>
`;
