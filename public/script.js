// Initialize leave balance and requests
let leaveBalance = 0;
let leaveRequests = [];
let token = localStorage.getItem('token');
let userRole = '';

// DOM elements
const leaveBalanceElement = document.getElementById('leaveBalance');
const leaveRequestForm = document.getElementById('leaveRequestForm');
const leaveRequestsList = document.getElementById('leaveRequestsList');
const authFormsDiv = document.getElementById('authForms');
const appContentDiv = document.getElementById('appContent');
const registerForm = document.getElementById('registerForm');
const loginForm = document.getElementById('loginForm');
const logoutButton = document.getElementById('logoutButton');

function showApp() {
    authFormsDiv.style.display = 'none';
    appContentDiv.style.display = 'block';
}

function showAuth() {
    authFormsDiv.style.display = 'flex';
    appContentDiv.style.display = 'none';
}

if (token) {
    showApp();
    fetchLeaveBalance();
    fetchLeaveRequests();
} else {
    showAuth();
}

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('registerUsername').value;
    const password = document.getElementById('registerPassword').value;

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        const data = await response.json();
        if (response.ok) {
            alert('Registration successful. Please login.');
        } else {
            console.error('Registration failed:', data);
            alert(`Registration failed: ${data.error}\n${data.details || ''}`);
        }
    } catch (error) {
        console.error('Registration error:', error);
        alert('An error occurred during registration. Please check the console for more details.');
    }
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;

    console.log('Attempting login for user:', username);

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        console.log('Response status:', response.status);
        
        // Log the raw response text
        const responseText = await response.text();
        console.log('Raw response:', responseText);

        // Try to parse JSON only if it's not HTML
        let data;
        if (!responseText.startsWith('<!DOCTYPE html>')) {
            data = JSON.parse(responseText);
            console.log('Response data:', data);
        } else {
            console.error('Received HTML instead of JSON');
        }

        if (response.ok) {
            token = data.token;
            userRole = data.role;
            localStorage.setItem('token', token);
            localStorage.setItem('userRole', userRole);
            console.log('Stored token:', token);
            showApp();
            fetchLeaveBalance();
            fetchLeaveRequests();
        } else {
            console.error('Login failed:', data);
            alert(`Login failed: ${data.error}\n${data.details || ''}`);
        }
    } catch (error) {
        console.error('Error during login:', error);
        alert('An error occurred during login. Please check the console for more details.');
    }
});

logoutButton.addEventListener('click', () => {
    localStorage.removeItem('token');
    token = null;
    showAuth();
});

// Fetch leave balance from the server
async function fetchLeaveBalance() {
    try {
        const response = await fetch('/api/leave_balance', {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (response.ok) {
            const data = await response.json();
            leaveBalance = data.balance;
            updateLeaveBalance();
        } else {
            throw new Error('Failed to fetch leave balance');
        }
    } catch (error) {
        alert('Error fetching leave balance');
    }
}

// Update leave balance display
function updateLeaveBalance() {
    leaveBalanceElement.textContent = leaveBalance;
}

// Add a new leave request
async function addLeaveRequest(startDate, endDate, reason) {
    try {
        const response = await fetch('/api/leave_request', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ startDate, endDate, reason }),
        });
        if (response.ok) {
            await fetchLeaveRequests();
        } else {
            const data = await response.json();
            throw new Error(data.error || 'Failed to submit leave request');
        }
    } catch (error) {
        alert(error.message);
    }
}

// Fetch all leave requests from the server
async function fetchLeaveRequests() {
    try {
        console.log('Fetching leave requests...');
        const response = await fetch('/api/leave_requests', {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        console.log('Response status:', response.status);
        if (response.ok) {
            const data = await response.json();
            console.log('Fetched leave requests:', data);
            leaveRequests = data;
            displayLeaveRequests();
        } else {
            const errorData = await response.json();
            console.error('Error response:', errorData);
            throw new Error(`Failed to fetch leave requests: ${errorData.error}`);
        }
    } catch (error) {
        console.error('Error fetching leave requests:', error);
        alert('Error fetching leave requests: ' + error.message);
    }
}

// Display all leave requests
function displayLeaveRequests() {
    leaveRequestsList.innerHTML = '';
    leaveRequests.forEach((request) => {
        const li = document.createElement('li');
        if (userRole === 'admin') {
            li.textContent = `${request.username}: ${request.start_date} to ${request.end_date} - ${request.reason}`;
        } else {
            li.textContent = `${request.start_date} to ${request.end_date} - ${request.reason}`;
        }
        leaveRequestsList.appendChild(li);
    });
}

// Handle form submission
leaveRequestForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const reason = document.getElementById('reason').value;
    
    // Calculate number of days
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = (end - start) / (1000 * 60 * 60 * 24) + 1;
    
    if (days > leaveBalance) {
        alert('Not enough leave balance!');
        return;
    }
    
    await addLeaveRequest(startDate, endDate, reason);
    leaveBalance -= days;
    updateLeaveBalance();
    
    // Reset form
    leaveRequestForm.reset();
});
