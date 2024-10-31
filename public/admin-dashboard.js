let leaveRequests = [];
let users = [];
const token = localStorage.getItem('token');

if (!token) {
    window.location.href = 'login.html';
}

// Tab Functionality
document.querySelectorAll('.tab-btn').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        button.classList.add('active');
        document.getElementById(button.dataset.tab).classList.add('active');
    });
});

// Fetch Data
async function fetchData() {
    await Promise.all([
        fetchLeaveRequests(),
        fetchUsers()
    ]);
}

async function fetchLeaveRequests() {
    try {
        const response = await fetch('/api/admin/leave_requests', {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (response.ok) {
            leaveRequests = await response.json();
            displayLeaveRequests();
        } else {
            throw new Error('Failed to fetch leave requests');
        }
    } catch (error) {
        console.error('Error fetching leave requests:', error);
        alert('Error fetching leave requests');
    }
}

async function fetchUsers() {
    try {
        const response = await fetch('/api/admin/users', {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (response.ok) {
            users = await response.json();
            displayUsers();
        } else {
            throw new Error('Failed to fetch users');
        }
    } catch (error) {
        console.error('Error fetching users:', error);
        alert('Error fetching users');
    }
}

function displayLeaveRequests() {
    const leaveRequestsList = document.getElementById('leaveRequestsList');
    const searchInput = document.getElementById('requestSearchInput').value.toLowerCase();
    const leaveTypeFilter = document.getElementById('leaveTypeFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;

    leaveRequestsList.innerHTML = '';
    
    const filteredRequests = leaveRequests.filter(request => {
        const matchesSearch = request.username.toLowerCase().includes(searchInput) || 
                              request.reason.toLowerCase().includes(searchInput);
        const matchesLeaveType = leaveTypeFilter === '' || request.leave_type === leaveTypeFilter;
        const matchesStatus = statusFilter === '' || request.status === statusFilter;
        
        return matchesSearch && matchesLeaveType && matchesStatus;
    });

    filteredRequests.forEach((request) => {
        const startDate = new Date(request.start_date);
        const endDate = new Date(request.end_date);
        const days = (endDate - startDate) / (1000 * 60 * 60 * 24) + 1;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${request.username}</td>
            <td>${formatDate(startDate)}</td>
            <td>${formatDate(endDate)}</td>
            <td>${days}</td>
            <td>${request.leave_type}</td>
            <td>${request.reason}</td>
            <td><span class="status ${request.status.toLowerCase()}">${request.status}</span></td>
            <td>
                ${request.status === 'Pending' ? `
                    <button class="btn btn-small btn-approve" data-id="${request.id}">Approve</button>
                    <button class="btn btn-small btn-reject" data-id="${request.id}">Reject</button>
                ` : ''}
            </td>
        `;
        leaveRequestsList.appendChild(row);
    });

    // Add event listeners for approve and reject buttons
    document.querySelectorAll('.btn-approve').forEach(button => {
        button.addEventListener('click', () => updateLeaveRequest(button.dataset.id, 'Approved'));
    });
    document.querySelectorAll('.btn-reject').forEach(button => {
        button.addEventListener('click', () => updateLeaveRequest(button.dataset.id, 'Rejected'));
    });
}

function displayUsers() {
    const usersList = document.getElementById('userManagementList');
    const searchInput = document.getElementById('userSearchInput').value.toLowerCase();
    
    usersList.innerHTML = '';
    
    const filteredUsers = users.filter(user => 
        user.username.toLowerCase().includes(searchInput)
    );

    filteredUsers.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${user.username}</td>
            <td>${user.role}</td>
            <td>${user.leave_balance} days</td>
            <td>${user.leaves_taken || 0} days</td>
            <td>${user.pending_requests || 0}</td>
            <td>
                <button class="btn btn-small btn-primary" onclick="adjustLeaveBalance(${user.id})">
                    Adjust Balance
                </button>
            </td>
        `;
        usersList.appendChild(row);
    });
}

async function adjustLeaveBalance(userId) {
    const newBalance = prompt('Enter new leave balance:');
    if (newBalance === null || newBalance === '') return;

    try {
        const response = await fetch(`/api/admin/user/${userId}/leave-balance`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ leaveBalance: parseInt(newBalance) })
        });

        if (response.ok) {
            alert('Leave balance updated successfully');
            fetchUsers();
        } else {
            throw new Error('Failed to update leave balance');
        }
    } catch (error) {
        console.error('Error updating leave balance:', error);
        alert('Error updating leave balance');
    }
}

function formatDate(date) {
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

async function updateLeaveRequest(id, status) {
    try {
        const response = await fetch(`/api/admin/leave_request/${id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });
        if (response.ok) {
            alert(`Leave request ${status.toLowerCase()} successfully`);
            fetchLeaveRequests();
        } else {
            throw new Error(`Failed to ${status.toLowerCase()} leave request`);
        }
    } catch (error) {
        console.error(`Error ${status.toLowerCase()}ing leave request:`, error);
        alert(`Error ${status.toLowerCase()}ing leave request: ` + error.message);
    }
}

document.getElementById('logoutButton').addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    window.location.href = 'index.html';
});

// Event Listeners
document.getElementById('userSearchInput')?.addEventListener('input', displayUsers);
document.getElementById('requestSearchInput')?.addEventListener('input', displayLeaveRequests);
document.getElementById('leaveTypeFilter')?.addEventListener('change', displayLeaveRequests);
document.getElementById('statusFilter')?.addEventListener('change', displayLeaveRequests);

// Sidebar Toggle
const sidebar = document.querySelector('.sidebar');
const mainContent = document.querySelector('.main-content');
const toggleButton = document.getElementById('toggleSidebar');

toggleButton.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    mainContent.classList.toggle('expanded');
});

// Navigation
document.querySelectorAll('.nav-item[data-tab]').forEach(navItem => {
    navItem.addEventListener('click', (e) => {
        e.preventDefault();
        // Remove active class from all nav items
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        // Add active class to clicked nav item
        navItem.classList.add('active');
        
        // Show corresponding tab
        const tabId = navItem.dataset.tab;
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(tabId).classList.add('active');
    });
});

// Get and display username
async function fetchUserInfo() {
    try {
        const response = await fetch('/api/user/info', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const data = await response.json();
            document.getElementById('userGreeting').textContent = `Welcome, ${data.username}!`;
        }
    } catch (error) {
        console.error('Error fetching user info:', error);
    }
}

// Initialize
fetchUserInfo();
fetchData();

// Modal handling
const modal = document.getElementById('announcementModal');
const newAnnouncementBtn = document.getElementById('newAnnouncementBtn');
const closeBtn = document.querySelector('.close');

newAnnouncementBtn.onclick = () => modal.style.display = "block";
closeBtn.onclick = () => modal.style.display = "none";
window.onclick = (event) => {
    if (event.target == modal) modal.style.display = "none";
}

// Fetch and display announcements
async function fetchAnnouncements() {
    try {
        const response = await fetch('/api/announcements', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const announcements = await response.json();
            displayAdminAnnouncements(announcements);
        }
    } catch (error) {
        console.error('Error fetching announcements:', error);
    }
}

function displayAdminAnnouncements(announcements) {
    const container = document.getElementById('adminAnnouncementsList');
    container.innerHTML = announcements.map(announcement => `
        <div class="announcement-item">
            <div class="announcement-header">
                <span class="announcement-title">${announcement.title}</span>
                <span class="announcement-priority priority-${announcement.priority}">${announcement.priority}</span>
            </div>
            <div class="announcement-date">${new Date(announcement.created_at).toLocaleDateString()}</div>
            <div class="announcement-content">${announcement.content}</div>
            <div class="announcement-actions">
                <button class="btn btn-small btn-danger" onclick="deleteAnnouncement(${announcement.id})">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `).join('');
}

// Handle new announcement submission
document.getElementById('announcementForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = {
        title: document.getElementById('announcementTitle').value,
        content: document.getElementById('announcementContent').value,
        priority: document.getElementById('announcementPriority').value
    };

    try {
        const response = await fetch('/api/announcements', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            modal.style.display = "none";
            e.target.reset();
            fetchAnnouncements();
            alert('Announcement posted successfully');
        } else {
            alert('Failed to post announcement');
        }
    } catch (error) {
        console.error('Error creating announcement:', error);
        alert('Error creating announcement');
    }
});

async function deleteAnnouncement(id) {
    if (!confirm('Are you sure you want to delete this announcement?')) return;

    try {
        const response = await fetch(`/api/announcements/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            fetchAnnouncements();
            alert('Announcement deleted successfully');
        } else {
            alert('Failed to delete announcement');
        }
    } catch (error) {
        console.error('Error deleting announcement:', error);
        alert('Error deleting announcement');
    }
}

// Add to your initialization
fetchAnnouncements();
