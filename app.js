// ============================================
// LEAVE MANAGEMENT SYSTEM - MATCHED TO BACKEND
// ============================================

const API_BASE = 'http://127.0.0.1:8001';

// Global state
let currentUser = null;
let authToken = null;
let calendarInstance = null;
let availabilityCalendar = null;
let availabilityData = {};

// ============================================
// INITIALIZE ON PAGE LOAD
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 App initializing...');
    
    // Load user and token from localStorage
    const storedUser = localStorage.getItem('currentUser');
    const storedToken = localStorage.getItem('authToken');
    
    if (storedUser && storedToken) {
        try {
            currentUser = JSON.parse(storedUser);
            authToken = storedToken;
            console.log('✅ User loaded from localStorage:', currentUser);
        } catch (e) {
            console.error('Error parsing stored user:', e);
            localStorage.removeItem('currentUser');
            localStorage.removeItem('authToken');
        }
    }
    
    // Detect which page we're on
    const path = window.location.pathname;
    
    if (path.includes('user-dashboard.html')) {
        console.log('📱 User Dashboard detected');
        initializeUserDashboard();
    } else if (path.includes('admin-dashboard.html')) {
        console.log('⚙️ Admin Dashboard detected');
        initializeAdminDashboard();
    }
});

// ============================================
// USER DASHBOARD INITIALIZATION
// ============================================
function initializeUserDashboard() {
    console.log('🔧 Initializing User Dashboard...');
    
    // Check authentication
    if (!authToken || !currentUser || currentUser.user_type !== 'user') {
        console.log('❌ Not authenticated as user, redirecting...');
        window.location.href = 'user-login.html';
        return;
    }
    
    // Show welcome message
    updateWelcomeMessage();
    
    // Initialize calendar immediately
    setTimeout(() => initializeLeaveCalendar(), 100);
    
    // Set up navigation and event listeners
    setupUserNavigation();
    setupUserEventListeners();
}

function setupUserNavigation() {
    // Apply Leave navigation
    const navApply = document.getElementById('nav-apply');
    if (navApply) {
        navApply.addEventListener('click', () => {
            console.log('🔄 Switching to Apply Leave view');
            showView('apply');
            setTimeout(() => initializeLeaveCalendar(), 100);
        });
    }
    
    // My Leaves navigation
    const navHistory = document.getElementById('nav-history');
    if (navHistory) {
        navHistory.addEventListener('click', () => {
            console.log('🔄 Switching to My Leaves view');
            showView('history');
            loadLeaveHistory();
            setTimeout(() => {
                initializeUpdateLeaveCalendars();
                setupUpdateLeaveForm();
            }, 100);
        });
    }
    
    // Check Availability navigation
    const navAvailable = document.getElementById('nav-available');
    if (navAvailable) {
        navAvailable.addEventListener('click', () => {
            console.log('🔄 Switching to Check Availability view');
            showView('available');
            setTimeout(() => initializeAvailabilityCalendar(), 100);
        });
    }
    
    // Profile navigation
    const navProfile = document.getElementById('nav-profile');
    if (navProfile) {
        navProfile.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('🔄 Switching to Profile view');
            showView('profile');
            loadProfile();
        });
    }
    
    // Logout navigation
    const navLogout = document.getElementById('nav-logout');
    if (navLogout) {
        navLogout.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }
    
    // Home navigation
    const navHome = document.getElementById('nav-home');
    if (navHome) {
        navHome.addEventListener('click', () => {
            showView('apply');
            setTimeout(() => initializeLeaveCalendar(), 100);
        });
    }
}

function setupUserEventListeners() {
    // Leave form submission
    const leaveForm = document.getElementById('leave-form');
    if (leaveForm) {
        leaveForm.addEventListener('submit', handleLeaveSubmission);
    }
    
    // Update profile form submission
    const updateProfileForm = document.getElementById('update-profile-form');
    if (updateProfileForm) {
        updateProfileForm.addEventListener('submit', updateProfile);
    }
}

function updateWelcomeMessage() {
    const welcomeMsg = document.getElementById('apply-message');
    if (welcomeMsg && currentUser && currentUser.name) {
        welcomeMsg.innerHTML = `<strong>Welcome, ${currentUser.name}!</strong><br>Select dates from the calendar below to apply for leave. Green dates are available, yellow dates have limited slots, and red dates are fully booked or already applied.`;
    }
}

function showView(viewName) {
    console.log(`🔄 Showing view: ${viewName}`);
    document.querySelectorAll('.view').forEach(view => {
        view.style.display = 'none';
    });
    
    const viewElement = document.getElementById(`${viewName}-view`);
    if (viewElement) {
        viewElement.style.display = 'block';
    }
}

// ============================================
// LEAVE CALENDAR INITIALIZATION
// Endpoint: GET /leave/available_dates
// Returns: {"availability": {"DD-MM-YYYY": {"available_slots": X, "total_allowed": Y, "total_booked": Z}}}
// Also uses: GET /leave/me for already applied dates
// ============================================
async function initializeLeaveCalendar() {
    console.log('📅 Initializing leave application calendar...');
    
    const calendarInput = document.getElementById('leave-calendar');
    if (!calendarInput) {
        console.log('❌ Calendar input not found');
        return;
    }
    
    try {
        // Clear any previous selection
        if (calendarInput) {
            calendarInput.value = '';
        }
        
        // Fetch available dates - Backend: GET /leave/available_dates
        const availResponse = await fetch(`${API_BASE}/leave/available_dates`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const availData = await availResponse.json();
        console.log('✅ Available dates response:', availData);
        
        // Fetch user's existing leaves
        const userLeavesResponse = await fetch(`${API_BASE}/leave/me`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        let userAppliedDates = [];
        if (userLeavesResponse.ok) {
            const userData = await userLeavesResponse.json();
            console.log('🔍 RAW API Response from /leave/me:', userData);
            
            // Try different possible structures
            let leaves = userData.leaves || userData.approved_leave_dates || userData.data || [];
            console.log('🔍 Extracted leaves:', leaves);
            
            // Get dates and normalize to DD-MM-YYYY format
            userAppliedDates = leaves.map(leave => {
                // Handle both object {date: "..."} and string formats
                let dateStr = typeof leave === 'string' ? leave : (leave.date || leave.applied_date);
                
                // Convert YYYY-MM-DD to DD-MM-YYYY if needed
                if (dateStr && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    // Format: YYYY-MM-DD → DD-MM-YYYY
                    const [year, month, day] = dateStr.split('-');
                    dateStr = `${day}-${month}-${year}`;
                    console.log('🔄 Converted date format:', `${year}-${month}-${day} → ${dateStr}`);
                }
                
                return dateStr;
            }).filter(d => d); // Remove undefined
            
            console.log('📋 User already applied for (normalized):', userAppliedDates);
        } else {
            console.error('❌ Failed to fetch user leaves:', userLeavesResponse.status);
        }
        
        if (availResponse.ok) {
            const availability = availData.availability || {};
            
            // Get current month boundaries
            const now = new Date();
            const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            
            // Destroy existing instance if any
            if (calendarInstance) {
                calendarInstance.destroy();
            }
            
            // Initialize Flatpickr
            calendarInstance = flatpickr(calendarInput, {
                mode: 'multiple',
                dateFormat: 'd-m-Y',
                minDate: firstDayOfMonth,  // Start from 1st of current month
                maxDate: lastDayOfMonth,   // End at last day of current month
                clickOpens: true,          // ← Enable click to open
                allowInput: false,         // ← Prevent manual typing
                onChange: function(selectedDates) {
                    updateSelectedDatesDisplay(selectedDates);
                },
                onDayCreate: function(dObj, dStr, fp, dayElem) {
                    const date = dayElem.dateObj;
                    const dateStr = formatDateForBackend(date); // DD-MM-YYYY format
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    
                    // Disable past dates (before today)
                    if (date < today) {
                        dayElem.classList.add('flatpickr-disabled');
                        dayElem.title = 'Past date - cannot select';
                        return;
                    }
                    
                    // Check if user already applied for this date
                    if (userAppliedDates.includes(dateStr)) {
                        const dateNum = date.getDate();
                        dayElem.classList.add('flatpickr-disabled', 'fully-booked');
                        dayElem.title = 'Already applied - Update via My Leaves';
                        
                        // Clear and create proper HTML structure
                        dayElem.innerHTML = '';
                        const dateSpan = document.createElement('span');
                        dateSpan.className = 'date-num';
                        dateSpan.textContent = dateNum;
                        dayElem.appendChild(dateSpan);
                        
                        const slotSpan = document.createElement('span');
                        slotSpan.className = 'slot-count';
                        slotSpan.textContent = '0/8';
                        dayElem.appendChild(slotSpan);
                        
                        return;
                    }
                    
                    // Check availability
                    if (availability[dateStr]) {
                        const slots = availability[dateStr];
                        const available = slots.available_slots;
                        const total = slots.total_allowed || 8;
                        const dateNum = date.getDate();
                        
                        // Clear existing content
                        dayElem.innerHTML = '';
                        
                        // Create date number span
                        const dateSpan = document.createElement('span');
                        dateSpan.className = 'date-num';
                        dateSpan.textContent = dateNum;
                        dayElem.appendChild(dateSpan);
                        
                        // Create slot count span
                        const slotSpan = document.createElement('span');
                        slotSpan.className = 'slot-count';
                        slotSpan.textContent = `${available}/${total}`;
                        dayElem.appendChild(slotSpan);
                        
                        // Apply color classes
                        if (available === 0) {
                            dayElem.classList.add('flatpickr-disabled', 'fully-booked');
                            dayElem.title = 'Fully booked';
                        } else if (available <= 2) {
                            dayElem.classList.add('limited');
                            dayElem.title = `${available} slots remaining`;
                        } else {
                            dayElem.classList.add('available');
                            dayElem.title = `${available} slots available`;
                        }
                    } else {
                        // No availability data - show just date number
                        dayElem.innerHTML = `<span class="date-num">${date.getDate()}</span>`;
                    }
                }
            });
            
            console.log('✅ Calendar initialized (Current month only, past dates disabled)');
        }
    } catch (error) {
        console.error('❌ Error initializing calendar:', error);
    }
}

// ============================================
// AVAILABILITY CALENDAR
// Same endpoint: GET /leave/available_dates
// ============================================
async function initializeAvailabilityCalendar() {
    console.log('📅 Initializing availability calendar...');
    
    const calendarInput = document.getElementById('availability-calendar');
    if (!calendarInput) return;
    
    try {
        const availResponse = await fetch(`${API_BASE}/leave/available_dates`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const availData = await availResponse.json();
        
        if (availResponse.ok) {
            const availability = availData.availability || {};
            
            // Get current month boundaries
            const now = new Date();
            const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            
            if (availabilityCalendar) {
                availabilityCalendar.destroy();
            }
            
            availabilityCalendar = flatpickr(calendarInput, {
                inline: true,
                mode: 'single',
                dateFormat: 'd-m-Y',
                minDate: firstDayOfMonth,
                maxDate: lastDayOfMonth,
                onDayCreate: function(dObj, dStr, fp, dayElem) {
                    const date = dayElem.dateObj;
                    const dateStr = formatDateForBackend(date);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    
                    // Disable past dates
                    if (date < today) {
                        dayElem.classList.add('flatpickr-disabled', 'day-past');
                        dayElem.style.color = '#ccc';
                        return;
                    }
                    
                    if (availability[dateStr]) {
                        const slots = availability[dateStr];
                        const available = slots.available_slots;
                        const total = slots.total_allowed || 8;
                        const dateNum = date.getDate();
                        
                        // Clear and create proper HTML structure
                        dayElem.innerHTML = '';
                        
                        const dateSpan = document.createElement('span');
                        dateSpan.className = 'date-num';
                        dateSpan.textContent = dateNum;
                        dayElem.appendChild(dateSpan);
                        
                        const slotSpan = document.createElement('span');
                        slotSpan.className = 'slot-count';
                        slotSpan.textContent = `${available}/${total}`;
                        dayElem.appendChild(slotSpan);
                        
                        // Apply color classes
                        if (available === 0) {
                            dayElem.classList.add('flatpickr-disabled', 'fully-booked');
                            dayElem.title = 'Fully booked';
                        } else if (available <= 2) {
                            dayElem.classList.add('limited');
                            dayElem.title = `${available} slots remaining`;
                        } else {
                            dayElem.classList.add('available');
                            dayElem.title = `${available} slots available`;
                        }
                    } else {
                        dayElem.innerHTML = `<span class="date-num">${date.getDate()}</span>`;
                    }
                }
            });
        }
    } catch (error) {
        console.error('❌ Error initializing availability calendar:', error);
    }
}

// ============================================
// LEAVE SUBMISSION
// Endpoint: POST /leave/apply
// Body: {"applied_date": ["DD-MM-YYYY", "DD-MM-YYYY"]}
// NOTE: No "reason" field required by backend!
// ============================================
async function handleLeaveSubmission(e) {
    e.preventDefault();
    
    const selectedDates = calendarInstance ? calendarInstance.selectedDates : [];
    
    if (!selectedDates || selectedDates.length === 0) {
        showMessage('leave-message', 'Please select at least one date', 'error');
        return;
    }
    
    // Format dates as DD-MM-YYYY (backend accepts both formats but DD-MM-YYYY is native)
    const dates = selectedDates.map(date => formatDateForBackend(date));
    
    console.log('📤 Submitting leave application:', dates);
    
    try {
        // Backend: POST /leave/apply
        const response = await fetch(`${API_BASE}/leave/apply`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                applied_date: dates  // Backend expects "applied_date" array, NO "reason" field
            })
        });
        
        const data = await response.json();
        console.log('📥 Response:', data);
        
        if (response.ok) {
            showMessage('leave-message', data.message || 'Leave application submitted successfully!', 'success');
            document.getElementById('leave-form').reset();
            if (calendarInstance) calendarInstance.clear();
            setTimeout(() => initializeLeaveCalendar(), 1000);
        } else {
            showMessage('leave-message', data.detail || 'Failed to submit leave application', 'error');
        }
    } catch (error) {
        console.error('Error submitting leave:', error);
        showMessage('leave-message', 'An error occurred. Please try again.', 'error');
    }
}

// ============================================
// UPDATE LEAVE
// Endpoint: PUT /leave/update
// Body: {"cancel_dates": ["DD-MM-YYYY"], "new_dates": ["DD-MM-YYYY"]}
// ============================================
async function handleLeaveUpdate(cancelDates, newDates) {
    try {
        const response = await fetch(`${API_BASE}/leave/update`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                cancel_dates: cancelDates,
                new_dates: newDates
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert(data.message || 'Leave updated successfully!');
            loadLeaveHistory();
        } else {
            alert(data.detail || 'Failed to update leave');
        }
    } catch (error) {
        console.error('Error updating leave:', error);
        alert('An error occurred while updating leave');
    }
}

// ============================================
// LOAD LEAVE HISTORY
// Uses: GET /leave/me to get approved dates
// ============================================
async function loadLeaveHistory() {
    console.log('📋 Loading leave history...');
    
    const historyList = document.getElementById('leave-history-list');
    if (!historyList) return;
    
    if (!authToken) {
        historyList.innerHTML = '<p class="no-data">Please login to view leave history.</p>';
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/leave/me`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const data = await response.json();
        console.log('✅ Leave history:', data);
        
        if (response.ok && data.approved_leave_dates && data.approved_leave_dates.length > 0) {
            // Convert YYYY-MM-DD to DD-MM-YYYY for display
            const formattedDates = data.approved_leave_dates.map(dateStr => {
                const [year, month, day] = dateStr.split('-');
                return `${day}-${month}-${year}`;
            });
            
            historyList.innerHTML = `
                <table class="leave-history-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${formattedDates.map(date => `
                            <tr>
                                <td>${date}</td>
                                <td><span class="status-approved">Approved</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } else {
            historyList.innerHTML = '<p class="no-data">No leave applications found for this month.</p>';
        }
    } catch (error) {
        console.error('❌ Error loading leave history:', error);
        historyList.innerHTML = '<p class="no-data">Error loading leave history. Please check your connection.</p>';
    }
}

// ============================================
// LOAD PROFILE
// Endpoint: GET /user/me or GET /admin/me
// ============================================
async function loadProfile() {
    console.log('👤 Loading profile...');
    
    if (!currentUser) {
        console.log('❌ No current user in state');
        return;
    }
    
    const profileInfo = document.getElementById('profile-info');
    if (!profileInfo) {
        console.log('❌ profile-info element not found');
        return;
    }
    
    try {
        const endpoint = currentUser.user_type === 'admin' ? '/admin/me' : '/user/me';
        console.log(`📤 Fetching profile from: ${API_BASE}${endpoint}`);
        
        const response = await fetch(`${API_BASE}${endpoint}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        console.log(`📥 Response status: ${response.status}`);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Profile fetch failed:', errorText);
            profileInfo.innerHTML = '<p class="no-data">Failed to load profile. Please try again.</p>';
            return;
        }
        
        const data = await response.json();
        console.log('✅ Profile data received:', data);
        
        // Display fresh data from database (not from token)
        profileInfo.innerHTML = `
            <div class="settings-info">
                <p><strong>ID:</strong> ${data.id || 'N/A'}</p>
                <p><strong>Name:</strong> ${data.name || 'N/A'}</p>
                <p><strong>Email:</strong> ${data.email || 'N/A'}</p>
                <p><strong>Mobile:</strong> ${data.mobile || 'N/A'}</p>
                <p><strong>Department:</strong> ${data.department || 'N/A'}</p>
                <p><strong>School ID:</strong> ${data.school_id || 'N/A'}</p>
                <p><strong>School Name:</strong> ${data.school_name || 'N/A'}</p>
                <p><strong>User Type:</strong> ${currentUser.user_type === 'admin' ? 'Administrator' : 'Teacher'}</p>
            </div>
        `;
        
        console.log('✅ Profile displayed successfully');
        
        // Update form placeholders with FRESH data from database
        if (currentUser.user_type !== 'admin') {
            document.getElementById('update-mobile').value = '';
            document.getElementById('update-email').value = '';
            document.getElementById('update-mobile').placeholder = `Current: ${data.mobile || 'N/A'}`;
            document.getElementById('update-email').placeholder = `Current: ${data.email || 'N/A'}`;
        }
        
    } catch (error) {
        console.error('❌ Error loading profile:', error);
        profileInfo.innerHTML = '<p class="no-data">Error loading profile. Please check your connection.</p>';
    }
}

// Update Profile Function
async function updateProfile(event) {
    event.preventDefault();
    
    const updateMessage = document.getElementById('update-message');
    const mobile = document.getElementById('update-mobile').value.trim();
    const email = document.getElementById('update-email').value.trim();
    
    // Check if at least one field is provided
    if (!mobile && !email) {
        updateMessage.className = 'message error';
        updateMessage.textContent = 'Please provide at least one field to update';
        updateMessage.style.display = 'block';
        return;
    }
    
    // Validate mobile if provided
    if (mobile && !/^[6-9][0-9]{9}$/.test(mobile)) {
        updateMessage.className = 'message error';
        updateMessage.textContent = 'Invalid mobile number. Must be 10 digits starting with 6-9';
        updateMessage.style.display = 'block';
        return;
    }
    
    // Validate email if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        updateMessage.className = 'message error';
        updateMessage.textContent = 'Invalid email format';
        updateMessage.style.display = 'block';
        return;
    }
    
    try {
        const requestBody = {};
        if (mobile) requestBody.mobile = mobile;
        if (email) requestBody.email = email;
        
        const response = await fetch(`${API_BASE}/user/update`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(requestBody)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            updateMessage.className = 'message success';
            updateMessage.textContent = data.message || 'Profile updated successfully! Please logout and login again for changes to take effect.';
            updateMessage.style.display = 'block';
            
            // Clear form
            document.getElementById('update-mobile').value = '';
            document.getElementById('update-email').value = '';
            
            // Reload profile after 2 seconds
            setTimeout(() => {
                loadProfile();
                updateMessage.style.display = 'none';
            }, 3000);
            
        } else {
            updateMessage.className = 'message error';
            updateMessage.textContent = data.detail || 'Failed to update profile';
            updateMessage.style.display = 'block';
        }
        
    } catch (error) {
        console.error('Error updating profile:', error);
        updateMessage.className = 'message error';
        updateMessage.textContent = 'Error updating profile. Please try again.';
        updateMessage.style.display = 'block';
    }
}

// ============================================
// ADMIN DASHBOARD INITIALIZATION
// ============================================
function initializeAdminDashboard() {
    console.log('🔧 Initializing Admin Dashboard...');
    
    if (!authToken || !currentUser || currentUser.user_type !== 'admin') {
        console.log('❌ Not authenticated as admin, redirecting...');
        window.location.href = 'admin-login.html';
        return;
    }
    
    loadDashboard();
    setupAdminNavigation();
    setupAdminEventListeners();
}

function setupAdminNavigation() {
    const navDashboard = document.getElementById('nav-dashboard');
    if (navDashboard) {
        navDashboard.addEventListener('click', () => {
            showView('dashboard');
            loadDashboard();
        });
    }
    
    // Teachers card click handler
    const teachersCard = document.getElementById('teachers-card');
    if (teachersCard) {
        teachersCard.addEventListener('click', () => {
            showView('teachers-list');
            loadTeachersList();
        });
    }
    
    // Back to dashboard button
    const backToDashboard = document.getElementById('back-to-dashboard');
    if (backToDashboard) {
        backToDashboard.addEventListener('click', () => {
            showView('dashboard');
            loadDashboard();
        });
    }
    
    const navSettings = document.getElementById('nav-settings');
    if (navSettings) {
        navSettings.addEventListener('click', () => {
            showView('settings');
            clearSettingsForm(); // Clear form to start blank
            loadCurrentSettings();
            loadAllSettings();
        });
    }
    
    const navManageUsers = document.getElementById('nav-manage-users');
    if (navManageUsers) {
        navManageUsers.addEventListener('click', () => {
            showView('manage-users');
            if (typeof initializeDeleteUserView === 'function') {
                initializeDeleteUserView();
            }
        });
    }
    
    const navTeachers = document.getElementById('nav-teachers');
    if (navTeachers) {
        navTeachers.addEventListener('click', () => {
            showView('teachers-on-leave');
        });
    }
    
    const navProfile = document.getElementById('nav-profile');
    if (navProfile) {
        navProfile.addEventListener('click', (e) => {
            e.preventDefault();
            showView('profile');
            loadProfile();
        });
    }
    
    const navLogout = document.getElementById('nav-logout');
    if (navLogout) {
        navLogout.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }
    
    const navHome = document.getElementById('nav-home');
    if (navHome) {
        navHome.addEventListener('click', () => {
            showView('dashboard');
            loadDashboard();
        });
    }
}

function setupAdminEventListeners() {
    const settingsForm = document.getElementById('configure-settings-form');
    if (settingsForm) {
        settingsForm.addEventListener('submit', handleSettingsSubmission);
    }
    
    const addDateBtn = document.getElementById('add-special-date');
    if (addDateBtn) {
        addDateBtn.addEventListener('click', () => addSpecialDateRow());
    }
    
    const teachersForm = document.getElementById('teachers-on-leave-form');
    if (teachersForm) {
        flatpickr('#leave-date-picker', {
            dateFormat: 'd-m-Y',
            minDate: 'today'
        });
        
        teachersForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const date = document.getElementById('leave-date-picker').value;
            if (date) await getTeachersOnLeave(date);
        });
    }
}

async function loadDashboard() {
    console.log('📊 Loading dashboard data...');
    await loadDashboardStats();
    await loadCurrentSettings();
    await loadAllSettings();
}

async function loadDashboardStats() {
    try {
        const response = await fetch(`${API_BASE}/dashboard/dashboard-stats`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            console.log('✅ Dashboard stats loaded:', data);
            
            const totalUsersEl = document.getElementById('total-users');
            const approvedLeavesEl = document.getElementById('approved-leaves');
            const schoolIdEl = document.getElementById('dashboard-school-id');
            
            if (totalUsersEl) totalUsersEl.textContent = data.total_users || 0;
            if (approvedLeavesEl) approvedLeavesEl.textContent = data.approved_leaves || 0;
            if (schoolIdEl) schoolIdEl.textContent = data.school_id || 'N/A';
        }
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
    }
}

async function loadTeachersList(selectedMonth = null, selectedYear = null) {
    console.log('👥 Loading teachers list...');
    
    const container = document.getElementById('teachers-list-container');
    if (!container) return;
    
    // Populate month selector on first load
    const monthSelector = document.getElementById('month-selector');
    if (monthSelector && monthSelector.options.length === 0) {
        populateMonthSelector(monthSelector);
    }
    
    container.innerHTML = '<p>Loading teachers...</p>';
    
    // Use selected month/year or current
    const now = new Date();
    const targetYear = selectedYear || now.getFullYear();
    const targetMonth = selectedMonth || (now.getMonth() + 1);
    
    try {
        const response = await fetch(`${API_BASE}/dashboard/teachers-with-leaves?month=${targetMonth}&year=${targetYear}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const data = await response.json();
        
        if (response.ok && data.teachers) {
            console.log('✅ Teachers list loaded:', data);
            
            if (data.teachers.length === 0) {
                container.innerHTML = '<p class="no-data">No teachers found in your school.</p>';
                return;
            }
            
            container.innerHTML = `
                <div class="teachers-summary" style="margin-bottom: 1rem; padding: 1rem; background: #f5f5f5; border-radius: 8px;">
                    <p><strong>Total Teachers:</strong> ${data.total_teachers}</p>
                    <p><strong>School ID:</strong> ${data.school_id}</p>
                    <p><strong>Viewing Period:</strong> ${data.current_month || `${getMonthName(targetMonth)} ${targetYear}`}</p>
                </div>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Mobile</th>
                            <th>Department</th>
                            <th>Month Leaves</th>
                            <th>Leave Dates</th>
                            <th>Year Leaves</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.teachers.map(teacher => `
                            <tr>
                                <td>${teacher.id}</td>
                                <td><strong>${teacher.name}</strong></td>
                                <td>${teacher.email}</td>
                                <td>${teacher.mobile}</td>
                                <td>${teacher.department}</td>
                                <td><span class="badge ${teacher.month_leaves > 0 ? 'badge-warning' : 'badge-info'}">${teacher.month_leaves}</span></td>
                                <td style="font-size: 0.9rem; color: #555;">${teacher.month_dates || 'No leaves'}</td>
                                <td><span class="badge ${teacher.year_leaves > 0 ? 'badge-success' : 'badge-info'}">${teacher.year_leaves}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div style="margin-top: 1rem; padding: 0.75rem; background: #e3f2fd; border-left: 4px solid #2196F3; border-radius: 4px;">
                    <small><strong>Note:</strong> Month Leaves = ${getMonthName(targetMonth)} ${targetYear} only | Year Leaves = Total ${targetYear}</small>
                </div>
            `;
        } else {
            container.innerHTML = '<p class="no-data">Failed to load teachers list.</p>';
        }
    } catch (error) {
        console.error('❌ Error loading teachers list:', error);
        container.innerHTML = '<p class="no-data">Error loading teachers. Please try again.</p>';
    }
}

function populateMonthSelector(selector) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    // Generate options for last 12 months
    const options = [];
    for (let i = 0; i < 12; i++) {
        const date = new Date(currentYear, currentMonth - 1 - i, 1);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const monthName = date.toLocaleString('default', { month: 'long' });
        
        options.push({
            value: `${year}-${month}`,
            text: `${monthName} ${year}`,
            selected: i === 0  // Current month selected by default
        });
    }
    
    // Add options to selector
    options.forEach(option => {
        const opt = document.createElement('option');
        opt.value = option.value;
        opt.textContent = option.text;
        if (option.selected) opt.selected = true;
        selector.appendChild(opt);
    });
    
    // Add change event listener
    selector.addEventListener('change', (e) => {
        const [year, month] = e.target.value.split('-');
        loadTeachersList(parseInt(month), parseInt(year));
    });
}

function getMonthName(monthNumber) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                    'July', 'August', 'September', 'October', 'November', 'December'];
    return months[monthNumber - 1];
}

async function loadPendingLeaves() {
    try {
        const response = await fetch(`${API_BASE}/dashboard/pending`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const data = await response.json();
        
        const pendingList = document.getElementById('pending-leaves-list');
        if (!pendingList) return;
        
        if (response.ok && data.pending_leaves && data.pending_leaves.length > 0) {
            pendingList.innerHTML = data.pending_leaves.map(leave => `
                <div class="leave-card">
                    <h4>${leave.user_name}</h4>
                    <p><strong>Date:</strong> ${leave.date_of_leave}</p>
                    <div class="action-buttons">
                        <button class="btn-approve" onclick="handleLeaveAction(${leave.id}, 'approved')">Approve</button>
                        <button class="btn-reject" onclick="handleLeaveAction(${leave.id}, 'rejected')">Reject</button>
                    </div>
                </div>
            `).join('');
        } else {
            pendingList.innerHTML = '<p class="no-data">No pending leaves.</p>';
        }
    } catch (error) {
        console.error('Error loading pending leaves:', error);
    }
}

async function handleLeaveAction(leaveId, action) {
    try {
        const response = await fetch(`${API_BASE}/dashboard/${action}/${leaveId}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.ok) {
            alert(`Leave ${action} successfully!`);
            loadPendingLeaves();
        } else {
            const data = await response.json();
            alert(data.detail || `Failed to ${action} leave.`);
        }
    } catch (error) {
        console.error(`Error ${action} leave:`, error);
        alert('An error occurred.');
    }
}

function clearSettingsForm() {
    // Clear the main form fields
    const maxTeachersEl = document.getElementById('max-teachers-per-day');
    const maxLeaveEl = document.getElementById('max-leave-per-month');
    
    if (maxTeachersEl) maxTeachersEl.value = '';
    if (maxLeaveEl) maxLeaveEl.value = '';
    
    // Clear any special date rows
    const container = document.getElementById('special-dates-container');
    if (container) container.innerHTML = '';
    
    // Clear any messages
    const messageEl = document.getElementById('configure-message');
    if (messageEl) messageEl.style.display = 'none';
    
    console.log('✅ Settings form cleared - ready for new input');
}

async function loadCurrentSettings() {
    try {
        const response = await fetch(`${API_BASE}/dashboard/getsetting`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.ok) {
            const setting = await response.json();
            console.log('✅ Current settings loaded:', setting);
            
            // Don't pre-fill the form - let it start blank
            // Form fields will be empty for admins to enter new settings
            
            // Only display special dates in history, not in the form
            // if (setting.noleave && setting.noleave.length > 0) {
            //     displaySpecialDates(setting.noleave);
            // }
        }
    } catch (error) {
        console.error('Error loading current settings:', error);
    }
}

function displaySpecialDates(specialDates) {
    const container = document.getElementById('special-dates-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    specialDates.forEach(specialDate => {
        addSpecialDateRow(specialDate.date_of_leave, specialDate.allow_numberof_teachers);
    });
}

function addSpecialDateRow(dateValue = '', teachersValue = '') {
    const container = document.getElementById('special-dates-container');
    if (!container) return;
    
    const row = document.createElement('div');
    row.className = 'special-date-row';
    row.innerHTML = `
        <div class="special-date-fields">
            <div>
                <label>Date:</label>
                <input type="text" class="special-date-input" value="${dateValue}" placeholder="DD-MM-YYYY">
            </div>
            <div>
                <label>Allowed Teachers:</label>
                <input type="number" class="special-teachers-input" value="${teachersValue}" placeholder="Number" min="0">
            </div>
            <button type="button" class="remove-special-date">Remove</button>
        </div>
    `;
    container.appendChild(row);
    
    flatpickr(row.querySelector('.special-date-input'), {
        dateFormat: 'd-m-Y',
        minDate: 'today'
    });
    
    row.querySelector('.remove-special-date').addEventListener('click', () => row.remove());
}

async function handleSettingsSubmission(e) {
    e.preventDefault();
    
    const maxTeachers = document.getElementById('max-teachers-per-day').value;
    const maxLeave = document.getElementById('max-leave-per-month').value;
    
    const specialDates = [];
    document.querySelectorAll('.special-date-row').forEach(row => {
        const date = row.querySelector('.special-date-input').value;
        const teachers = row.querySelector('.special-teachers-input').value;
        
        if (date && teachers) {
            specialDates.push({
                date_of_leave: date,
                allow_numberof_teachers: parseInt(teachers)
            });
        }
    });
    
    // Debug: Log current user info
    console.log('🔍 Current User:', currentUser);
    console.log('🔍 School ID:', currentUser?.school_id);
    
    // Get school_id with multiple fallback strategies
    let schoolId = null;
    
    // Strategy 1: From currentUser object
    if (currentUser && currentUser.school_id) {
        schoolId = currentUser.school_id;
        console.log('✅ Using school_id from currentUser:', schoolId);
    }
    // Strategy 2: From localStorage
    else {
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
            try {
                const userData = JSON.parse(storedUser);
                schoolId = userData.school_id;
                console.log('✅ Using school_id from localStorage:', schoolId);
            } catch (e) {
                console.error('❌ Error parsing stored user:', e);
            }
        }
    }
    
    // Strategy 3: Decode from JWT token
    if (!schoolId && authToken) {
        try {
            const tokenParts = authToken.split('.');
            if (tokenParts.length === 3) {
                const payload = JSON.parse(atob(tokenParts[1]));
                schoolId = payload.school_id;
                console.log('✅ Using school_id from JWT token:', schoolId);
            }
        } catch (e) {
            console.error('❌ Error decoding token:', e);
        }
    }
    
    // Final check
    if (!schoolId) {
        showMessage('configure-message', 'Error: School ID not found. Please log in again.', 'error');
        console.error('❌ Could not determine school_id from any source');
        return;
    }
    
    try {
        const payload = {
            maximum_teacher_onleave_perday: parseInt(maxTeachers),
            maximum_leave_permonth: parseInt(maxLeave),
            noleave: specialDates,
            school_id: schoolId
        };
        
        console.log('📤 Sending settings payload:', JSON.stringify(payload, null, 2));
        
        const response = await fetch(`${API_BASE}/dashboard/configuresetting`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showMessage('configure-message', 'Settings saved successfully!', 'success');
            loadAllSettings();
        } else {
            // Handle validation errors properly
            let errorMessage = 'Failed to save settings';
            
            if (data.detail) {
                // Check if detail is an array (FastAPI validation errors)
                if (Array.isArray(data.detail)) {
                    errorMessage = data.detail.map(err => {
                        const field = err.loc ? err.loc.join(' -> ') : 'field';
                        return `${field}: ${err.msg}`;
                    }).join('; ');
                } 
                // Check if detail is a string
                else if (typeof data.detail === 'string') {
                    errorMessage = data.detail;
                }
                // Check if detail is an object with message
                else if (typeof data.detail === 'object' && data.detail.message) {
                    errorMessage = data.detail.message;
                }
                // Otherwise convert object to readable string
                else {
                    errorMessage = JSON.stringify(data.detail);
                }
            }
            
            console.error('Settings save error:', data);
            showMessage('configure-message', errorMessage, 'error');
        }
    } catch (error) {
        console.error('Error saving settings:', error);
        showMessage('configure-message', `Error: ${error.message || 'An error occurred'}`, 'error');
    }
}

async function loadAllSettings(limit = 10) {
    try {
        const response = await fetch(`${API_BASE}/dashboard/getsetting/all?limit=${limit}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            const historyEl = document.getElementById('settings-history');
            if (!historyEl) return;
            
            if (data.settings && data.settings.length > 0) {
                historyEl.innerHTML = `
                    <h3>Settings History (${data.total} entries)</h3>
                    <table class="settings-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Max Teachers/Day</th>
                                <th>Max Leave/Month</th>
                                <th>Special Dates</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.settings.map(setting => `
                                <tr>
                                    <td>${setting.setting_id}</td>
                                    <td>${setting.maximum_teacher_onleave_perday}</td>
                                    <td>${setting.maximum_leave_permonth}</td>
                                    <td>${setting.noleave ? setting.noleave.length : 0} dates</td>
                                    <td><button class="btn-delete" onclick="deleteSetting(${setting.setting_id})">Delete</button></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
            } else {
                historyEl.innerHTML = '<p class="no-data">No settings history.</p>';
            }
        }
    } catch (error) {
        console.error('Error loading settings history:', error);
    }
}

async function deleteSetting(settingId) {
    if (!confirm('Delete this setting?')) return;
    
    try {
        const response = await fetch(`${API_BASE}/dashboard/deletesetting/${settingId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.ok) {
            alert('Setting deleted!');
            loadAllSettings();
        } else {
            alert('Failed to delete setting');
        }
    } catch (error) {
        console.error('Error deleting setting:', error);
    }
}

async function getTeachersOnLeave(date) {
    try {
        const response = await fetch(`${API_BASE}/dashboard/teachersonleave/${date}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            document.getElementById('selected-date-display').textContent = data.date;
            const listDiv = document.getElementById('teachers-list');
            
            if (data.teachers_on_leave && data.teachers_on_leave.length > 0) {
                listDiv.innerHTML = `
                    <p><strong>Total: ${data.total_count} teachers</strong></p>
                    <div class="teachers-grid">
                        ${data.teachers_on_leave.map(name => `
                            <div class="teacher-card"><p><strong>${name}</strong></p></div>
                        `).join('')}
                    </div>
                `;
            } else {
                listDiv.innerHTML = '<p class="no-data">No teachers on leave on this date.</p>';
            }
            
            document.getElementById('teachers-on-leave-result').style.display = 'block';
        }
    } catch (error) {
        console.error('Error fetching teachers on leave:', error);
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function formatDateForBackend(date) {
    // Returns DD-MM-YYYY format (backend native format)
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}

function updateSelectedDatesDisplay(dates) {
    const display = document.getElementById('selected-dates-display');
    if (!display) return;
    
    if (dates.length > 0) {
        const formattedDates = dates.map(d => formatDateForBackend(d)).join(', ');
        display.innerHTML = `<strong>Selected Dates (${dates.length}):</strong> ${formattedDates}`;
    } else {
        display.innerHTML = '';
    }
}

function showMessage(elementId, message, type) {
    const messageEl = document.getElementById(elementId);
    if (!messageEl) return;
    
    messageEl.textContent = message;
    messageEl.className = `message ${type}`;
    messageEl.style.display = 'block';
    
    if (type === 'success') {
        setTimeout(() => {
            messageEl.style.display = 'none';
        }, 3000);
    }
}

function logout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    window.location.href = 'index.html';
}

// Make functions globally available
window.handleLeaveAction = handleLeaveAction;
window.deleteSetting = deleteSetting;
window.loadProfile = loadProfile;
window.loadLeaveHistory = loadLeaveHistory;
window.handleLeaveUpdate = handleLeaveUpdate;
window.logout = logout;

// ============================================
// UPDATE LEAVE FUNCTIONALITY
// ============================================

let cancelDatesCalendar = null;
let newDatesCalendar = null;

async function initializeUpdateLeaveCalendars() {
    console.log('📅 Initializing update leave calendars...');
    
    // Initialize Cancel Dates Calendar (from user's existing leaves)
    const cancelInput = document.getElementById('cancel-dates');
    if (cancelInput) {
        try {
            // Fetch user's leaves
            const response = await fetch(`${API_BASE}/leave/me`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('🔍 RAW API Response from /leave/me (cancel dates):', data);
                
                const userLeaves = data.leaves || data.approved_leave_dates || data.data || [];
                
                console.log('📋 User leaves fetched:', userLeaves);
                console.log('📋 User leaves count:', userLeaves.length);
                
                // Get current month boundaries
                const now = new Date();
                now.setHours(0, 0, 0, 0);
                const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                
                console.log('📅 Date filters:', {
                    now: now.toDateString(),
                    firstDay: firstDayOfMonth.toDateString(),
                    lastDay: lastDayOfMonth.toDateString()
                });
                
                // Convert user leaves to Date objects
                const userLeaveDates = userLeaves
                    .map(leave => {
                        // Get date string - handle both formats
                        let dateStr = typeof leave === 'string' ? leave : (leave.date || leave.applied_date);
                        
                        console.log('📋 Processing leave:', leave, '→ dateStr:', dateStr);
                        
                        // Parse date - handle both DD-MM-YYYY and YYYY-MM-DD
                        let leaveDate;
                        if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                            // YYYY-MM-DD format (from database)
                            const [year, month, day] = dateStr.split('-');
                            leaveDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                        } else {
                            // DD-MM-YYYY format
                            const [day, month, year] = dateStr.split('-');
                            leaveDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                        }
                        
                        console.log(`📋 Parsed: ${dateStr} → ${leaveDate.toDateString()}, isFuture: ${leaveDate > now}`);
                        return leaveDate;
                    })
                    .filter(date => {
                        // Only FUTURE dates in current month (after today)
                        const isInMonth = date >= firstDayOfMonth && date <= lastDayOfMonth;
                        const isFuture = date > now;
                        console.log(`📋 Filter: ${date.toDateString()} - inMonth: ${isInMonth}, isFuture: ${isFuture}`);
                        return isInMonth && isFuture;
                    });
                
                console.log('📅 Filtered user leave dates:', userLeaveDates);
                
                if (cancelDatesCalendar) {
                    cancelDatesCalendar.destroy();
                }
                
                // If user has no leaves, show message
                if (userLeaveDates.length === 0) {
                    cancelInput.placeholder = 'No leaves to cancel in current month';
                    cancelInput.disabled = true;
                    return;
                }
                
                cancelInput.disabled = false;
                cancelInput.placeholder = 'Click to select dates to cancel';
                cancelInput.value = ''; // Clear any previous value
                
                cancelDatesCalendar = flatpickr(cancelInput, {
                    mode: 'multiple',
                    dateFormat: 'd-m-Y',
                    minDate: firstDayOfMonth,
                    maxDate: lastDayOfMonth,
                    enable: userLeaveDates, // Only enable user's leave dates
                    defaultDate: null, // ← Explicitly prevent default selection
                    onReady: function(selectedDates, dateStr, instance) {
                        // Ensure input is cleared when calendar is ready
                        instance.clear();
                    },
                    onDayCreate: function(dObj, dStr, fp, dayElem) {
                        const date = dayElem.dateObj;
                        
                        // Check if this is user's leave date
                        const isUserLeave = userLeaveDates.some(d => 
                            d.getDate() === date.getDate() && 
                            d.getMonth() === date.getMonth() && 
                            d.getFullYear() === date.getFullYear()
                        );
                        
                        if (isUserLeave) {
                            // Highlight user's leaves
                            dayElem.style.background = '#ffcdd2';
                            dayElem.style.color = '#c62828';
                            dayElem.style.fontWeight = 'bold';
                            dayElem.style.border = '2px solid #c62828';
                            dayElem.title = 'Your existing leave - click to cancel';
                        } else {
                            // Grey out other dates
                            dayElem.style.color = '#e0e0e0';
                            dayElem.style.cursor = 'not-allowed';
                            dayElem.title = 'Not your leave date';
                        }
                    }
                });
                
                console.log('✅ Cancel dates calendar initialized with', userLeaveDates.length, 'leaves');
            }
        } catch (error) {
            console.error('❌ Error initializing cancel dates calendar:', error);
        }
    }
    
    // Initialize New Dates Calendar (available dates)
    const newDatesInput = document.getElementById('new-dates');
    if (newDatesInput) {
        try {
            const availResponse = await fetch(`${API_BASE}/leave/available_dates`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            
            if (availResponse.ok) {
                const availData = await availResponse.json();
                const availability = availData.availability || {};
                
                const now = new Date();
                const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                
                if (newDatesCalendar) {
                    newDatesCalendar.destroy();
                }
                
                newDatesInput.value = ''; // Clear any previous value
                
                newDatesCalendar = flatpickr(newDatesInput, {
                    mode: 'multiple',
                    dateFormat: 'd-m-Y',
                    minDate: firstDayOfMonth,
                    maxDate: lastDayOfMonth,
                    defaultDate: null, // ← Explicitly prevent default selection
                    onReady: function(selectedDates, dateStr, instance) {
                        // Ensure input is cleared when calendar is ready
                        instance.clear();
                    },
                    onDayCreate: function(dObj, dStr, fp, dayElem) {
                        const date = dayElem.dateObj;
                        const dateStr = formatDateForBackend(date);
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        
                        // Disable past dates
                        if (date < today) {
                            dayElem.classList.add('flatpickr-disabled', 'day-past');
                            dayElem.style.color = '#ccc';
                            dayElem.title = 'Past date';
                            return;
                        }
                        
                        // Check availability
                        if (availability[dateStr]) {
                            const slots = availability[dateStr];
                            const available = slots.available_slots;
                            const total = slots.total_allowed || 8;
                            const dateNum = date.getDate();
                            
                            // Clear and create proper HTML structure
                            dayElem.innerHTML = '';
                            
                            const dateSpan = document.createElement('span');
                            dateSpan.className = 'date-num';
                            dateSpan.textContent = dateNum;
                            dayElem.appendChild(dateSpan);
                            
                            const slotSpan = document.createElement('span');
                            slotSpan.className = 'slot-count';
                            slotSpan.textContent = `${available}/${total}`;
                            dayElem.appendChild(slotSpan);
                            
                            if (available === 0) {
                                dayElem.classList.add('flatpickr-disabled', 'fully-booked');
                                dayElem.title = 'Fully booked';
                            } else if (available <= 2) {
                                dayElem.classList.add('limited');
                                dayElem.title = `${available} slots remaining`;
                            } else {
                                dayElem.classList.add('available');
                                dayElem.title = `${available} slots available`;
                            }
                        } else {
                            dayElem.innerHTML = `<span class="date-num">${date.getDate()}</span>`;
                        }
                    }
                });
                
                console.log('✅ New dates calendar initialized');
            }
        } catch (error) {
            console.error('❌ Error initializing new dates calendar:', error);
        }
    }
}

function setupUpdateLeaveForm() {
    const form = document.getElementById('update-leave-form');
    if (!form) return;
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log('📝 Submitting update leave request...');
        
        const cancelDatesInput = document.getElementById('cancel-dates');
        const newDatesInput = document.getElementById('new-dates');
        const messageEl = document.getElementById('update-leave-message');
        
        const cancelDates = cancelDatesInput.value.split(',').map(d => d.trim()).filter(d => d);
        const newDates = newDatesInput.value.split(',').map(d => d.trim()).filter(d => d);
        
        if (cancelDates.length === 0) {
            showMessage('update-leave-message', 'Please select dates to cancel', 'error');
            return;
        }
        
        if (newDates.length === 0) {
            showMessage('update-leave-message', 'Please select new dates to apply', 'error');
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE}/leave/update`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    cancel_dates: cancelDates,
                    new_dates: newDates
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showMessage('update-leave-message', `Success! Cancelled ${data.total_cancelled} dates, Applied for ${data.total_added} new dates`, 'success');
                form.reset();
                
                // Reload leave history and calendars
                setTimeout(() => {
                    loadLeaveHistory();
                    initializeUpdateLeaveCalendars();
                }, 1500);
            } else {
                showMessage('update-leave-message', data.detail || 'Failed to update leave', 'error');
            }
        } catch (error) {
            console.error('❌ Error updating leave:', error);
            showMessage('update-leave-message', 'Error updating leave. Please try again.', 'error');
        }
    });
}

