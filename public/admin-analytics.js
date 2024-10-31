const token = localStorage.getItem('token');

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

async function fetchAnalyticsData() {
    try {
        const response = await fetch('/api/admin/analytics', {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (response.ok) {
            const data = await response.json();
            console.log('Received analytics data:', data);
            if (data && data.summary) {
                displaySummaryStats(data.summary);
                displayLeaveRequestsTrend(data.leaveRequestsTrend);
                displayLeaveBalanceDistribution(data.leaveBalanceDistribution);
            } else {
                console.error('Received data is not in the expected format:', data);
                alert('Error: Received data is not in the expected format');
            }
        } else {
            const errorText = await response.text();
            throw new Error(`Failed to fetch analytics data: ${response.status} ${errorText}`);
        }
    } catch (error) {
        console.error('Error fetching analytics data:', error);
        alert('Error fetching analytics data: ' + error.message);
    }
}

function displaySummaryStats(summary) {
    if (!summary) {
        console.error('Summary data is missing');
        return;
    }
    const summaryStats = document.getElementById('summaryStats');
    summaryStats.innerHTML = `
        <div class="summary-stat">
            <h3>Total Users</h3>
            <div class="value">${summary.totalUsers || 'N/A'}</div>
        </div>
        <div class="summary-stat">
            <h3>Average Leave Balance</h3>
            <div class="value">${summary.averageLeaveBalance ? summary.averageLeaveBalance.toFixed(1) : 'N/A'}</div>
        </div>
        <div class="summary-stat">
            <h3>Pending Requests</h3>
            <div class="value">${summary.totalPendingRequests || 'N/A'}</div>
        </div>
        <div class="summary-stat">
            <h3>Approved Requests</h3>
            <div class="value">${summary.totalApprovedRequests || 'N/A'}</div>
        </div>
    `;
}

function displayLeaveRequestsTrend(trendData) {
    if (!trendData || !trendData.labels || !trendData.data) {
        console.error('Trend data is missing or incomplete');
        return;
    }
    const ctx = document.getElementById('leaveRequestsTrend').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: trendData.labels,
            datasets: [{
                label: 'Number of Leave Requests',
                data: trendData.data,
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function displayLeaveBalanceDistribution(distributionData) {
    if (!distributionData || !distributionData.labels || !distributionData.data) {
        console.error('Distribution data is missing or incomplete');
        return;
    }
    const ctx = document.getElementById('leaveBalanceDistribution').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: distributionData.labels,
            datasets: [{
                label: 'Number of Users',
                data: distributionData.data,
                backgroundColor: 'rgba(75, 192, 192, 0.6)'
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Logout functionality
document.getElementById('logoutButton').addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    window.location.href = 'index.html';
});

// Initialize
fetchUserInfo();
fetchAnalyticsData();
