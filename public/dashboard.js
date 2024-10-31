let leaveBalance = 0;
let leaveRequests = [];
const token = localStorage.getItem('token');
const userRole = localStorage.getItem('userRole');

if (!token) {
    window.location.href = 'login.html';
}

// Sidebar Toggle
const sidebar = document.querySelector('.sidebar');
const mainContent = document.querySelector('.main-content');
const toggleButton = document.getElementById('toggleSidebar');

toggleButton.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    mainContent.classList.toggle('expanded');
});

// Navigation
document.querySelectorAll('.nav-item').forEach(navItem => {
    navItem.addEventListener('click', (e) => {
        if (!navItem.id || navItem.id !== 'logoutButton') {
            e.preventDefault();
            document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
            navItem.classList.add('active');
            
            // Scroll to section if hash is present
            const hash = navItem.getAttribute('href');
            if (hash && hash !== '#') {
                const section = document.querySelector(hash);
                if (section) {
                    section.scrollIntoView({ behavior: 'smooth' });
                }
            }
        }
    });
});

// Fetch user info and display greeting
async function fetchUserInfo() {
    try {
        const response = await fetch('/api/user/info', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const data = await response.json();
            document.getElementById('userGreeting').textContent = `Welcome, ${data.username}!`;
        } else {
            throw new Error('Failed to fetch user info');
        }
    } catch (error) {
        console.error('Error fetching user info:', error);
    }
}

// Logout functionality
document.getElementById('logoutButton').addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    window.location.href = 'index.html';
});

async function fetchLeaveBalance() {
    try {
        const response = await fetch('/api/leave_balance', {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (response.ok) {
            const data = await response.json();
            leaveBalance = data.balance;
            document.getElementById('leaveBalance').textContent = leaveBalance;
        } else {
            throw new Error('Failed to fetch leave balance');
        }
    } catch (error) {
        console.error('Error fetching leave balance:', error);
        alert('Error fetching leave balance');
    }
}

async function fetchLeaveRequests() {
    try {
        const response = await fetch('/api/leave_requests', {
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

function displayLeaveRequests() {
    const leaveRequestsList = document.getElementById('leaveRequestsList');
    leaveRequestsList.innerHTML = '';
    leaveRequests.forEach((request) => {
        const startDate = new Date(request.start_date);
        const endDate = new Date(request.end_date);
        const days = (endDate - startDate) / (1000 * 60 * 60 * 24) + 1;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDate(startDate)}</td>
            <td>${formatDate(endDate)}</td>
            <td>${days}</td>
            <td>${request.leave_type}</td>
            <td>${request.reason}</td>
            <td><span class="status ${request.status.toLowerCase()}">${request.status}</span></td>
            <td>
                ${request.status === 'Pending' ? `
                    <button class="btn btn-small btn-cancel" data-id="${request.id}">Cancel</button>
                ` : ''}
            </td>
        `;
        leaveRequestsList.appendChild(row);
    });

    // Add event listeners for cancel buttons
    document.querySelectorAll('.btn-cancel').forEach(button => {
        button.addEventListener('click', cancelLeaveRequest);
    });
}

function formatDate(date) {
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

async function cancelLeaveRequest(event) {
    const requestId = event.target.dataset.id;
    if (confirm('Are you sure you want to cancel this leave request?')) {
        try {
            const response = await fetch(`/api/leave_request/${requestId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (response.ok) {
                alert('Leave request cancelled successfully');
                fetchLeaveRequests();
                fetchLeaveBalance();
            } else {
                throw new Error('Failed to cancel leave request');
            }
        } catch (error) {
            console.error('Error cancelling leave request:', error);
            alert('Error cancelling leave request: ' + error.message);
        }
    }
}

document.getElementById('leaveRequestForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const reason = document.getElementById('reason').value;
    const leaveType = document.getElementById('leaveType').value;

    if (!leaveType) {
        alert('Please select a leave type');
        return;
    }

    try {
        const response = await fetch('/api/leave_request', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ startDate, endDate, reason, leaveType }),
        });
        if (response.ok) {
            const data = await response.json();
            alert(`${leaveType} request submitted successfully. ${data.daysRequested} days requested.`);
            fetchLeaveRequests();
            e.target.reset(); // Reset the form
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to submit leave request');
        }
    } catch (error) {
        console.error('Error submitting leave request:', error);
        alert('Error submitting leave request: ' + error.message);
    }
});

async function fetchAnnouncements() {
    try {
        const response = await fetch('/api/announcements', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const announcements = await response.json();
            displayUserAnnouncements(announcements);
        }
    } catch (error) {
        console.error('Error fetching announcements:', error);
    }
}

function displayUserAnnouncements(announcements) {
    const container = document.getElementById('userAnnouncementsList');
    container.innerHTML = announcements.map(announcement => `
        <div class="announcement-item">
            <div class="announcement-header">
                <span class="announcement-title">${announcement.title}</span>
                <span class="announcement-priority priority-${announcement.priority}">${announcement.priority}</span>
            </div>
            <div class="announcement-date">${new Date(announcement.created_at).toLocaleDateString()}</div>
            <div class="announcement-content">${announcement.content}</div>
        </div>
    `).join('');
}

async function fetchDashboardData() {
    try {
        const [balanceResponse, statsResponse] = await Promise.all([
            fetch('/api/leave-balance', {
                headers: { 'Authorization': `Bearer ${token}` }
            }),
            fetch('/api/dashboard-stats', {
                headers: { 'Authorization': `Bearer ${token}` }
            })
        ]);

        if (balanceResponse.ok) {
            const balanceData = await balanceResponse.json();
            document.getElementById('leaveBalance').textContent = balanceData.balance;
        }

        if (statsResponse.ok) {
            const statsData = await statsResponse.json();
            document.getElementById('pendingRequests').textContent = statsData.pendingRequests;
            document.getElementById('recentAnnouncements').textContent = statsData.recentAnnouncements;
        }
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
    }
}

fetchDashboardData();
