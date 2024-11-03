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

function getDefaultData() {
    return {
        summary: {
            totalUsers: 0,
            averageLeaveBalance: 0,
            totalPendingRequests: 0,
            totalApprovedRequests: 0
        },
        leaveRequestsTrend: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        },
        leaveBalanceDistribution: {
            labels: ['0-5 days', '6-10 days', '11-15 days', '16-20 days', '21-25 days', '26-30 days'],
            data: [0, 0, 0, 0, 0, 0]
        },
        leaveTypes: {
            labels: ['Annual Leave', 'Sick Leave', 'Emergency Leave', 'Other'],
            data: [0, 0, 0, 0]
        },
        monthlyPatterns: {
            months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            approved: Array(12).fill(0),
            rejected: Array(12).fill(0),
            pending: Array(12).fill(0)
        },
        topUsers: [],
        keyMetrics: {
            avgProcessingTime: 0,
            approvalRate: 0,
            peakMonth: 'N/A',
            commonLeaveType: 'N/A'
        }
    };
}

async function fetchAnalyticsData() {
    try {
        const response = await fetch('/api/admin/analytics', {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        
        if (response.ok) {
            const rawData = await response.json();
            console.log('Received analytics data:', rawData);
            
            // Merge received data with default data
            const data = { ...getDefaultData(), ...rawData };
            
            // Display all charts with the merged data
            displaySummaryStats(data.summary);
            displayLeaveRequestsTrend(data.leaveRequestsTrend);
            displayLeaveBalanceDistribution(data.leaveBalanceDistribution);
            displayLeaveTypesDistribution(data.leaveTypes);
            displayMonthlyPatterns(data.monthlyPatterns);
            displayTopUsers(data.topUsers);
            displayKeyMetrics(data.keyMetrics);
        } else {
            throw new Error(`Failed to fetch analytics data: ${response.status}`);
        }
    } catch (error) {
        console.error('Error fetching analytics data:', error);
        // Use default data if there's an error
        const defaultData = getDefaultData();
        displaySummaryStats(defaultData.summary);
        displayLeaveRequestsTrend(defaultData.leaveRequestsTrend);
        displayLeaveBalanceDistribution(defaultData.leaveBalanceDistribution);
        displayLeaveTypesDistribution(defaultData.leaveTypes);
        displayMonthlyPatterns(defaultData.monthlyPatterns);
        displayTopUsers(defaultData.topUsers);
        displayKeyMetrics(defaultData.keyMetrics);
        
        alert('Error fetching analytics data. Displaying default values.');
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

const commonChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            position: 'top',
            labels: {
                boxWidth: 12,
                padding: 10
            }
        }
    }
};

function displayLeaveRequestsTrend(trendData = getDefaultData().leaveRequestsTrend) {
    if (!trendData || !trendData.labels || !trendData.data) {
        console.error('Trend data is missing or incomplete');
        trendData = getDefaultData().leaveRequestsTrend;
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
                backgroundColor: 'rgba(75, 192, 192, 0.1)',
                tension: 0.1,
                fill: true
            }]
        },
        options: {
            ...commonChartOptions,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Number of Requests'
                    }
                }
            }
        }
    });
}

function displayLeaveBalanceDistribution(distribution = getDefaultData().leaveBalanceDistribution) {
    if (!distribution || !distribution.labels || !distribution.data) {
        console.error('Distribution data is missing or incomplete');
        distribution = getDefaultData().leaveBalanceDistribution;
    }

    const ctx = document.getElementById('leaveBalanceDistribution').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: distribution.labels,
            datasets: [{
                label: 'Number of Employees',
                data: distribution.data,
                backgroundColor: 'rgba(54, 162, 235, 0.8)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            ...commonChartOptions,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Number of Employees'
                    }
                }
            }
        }
    });
}

function displayLeaveTypesDistribution(data = getDefaultData().leaveTypes) {
    if (!data || !data.labels || !data.data) {
        console.error('Leave types data is missing or incomplete');
        data = getDefaultData().leaveTypes;
    }
    
    const ctx = document.getElementById('leaveTypesChart').getContext('2d');
    new Chart(ctx, {
        type: 'pie',
        data: {
            labels: data.labels,
            datasets: [{
                data: data.data,
                backgroundColor: [
                    'rgba(255, 99, 132, 0.8)',
                    'rgba(54, 162, 235, 0.8)',
                    'rgba(255, 206, 86, 0.8)',
                    'rgba(75, 192, 192, 0.8)',
                    'rgba(153, 102, 255, 0.8)'
                ]
            }]
        },
        options: {
            ...commonChartOptions,
            plugins: {
                legend: {
                    position: 'right'
                }
            }
        }
    });
}

function displayMonthlyPatterns(data = getDefaultData().monthlyPatterns) {
    if (!data || !data.months || !data.approved || !data.rejected || !data.pending) {
        console.error('Monthly patterns data is missing or incomplete');
        data = getDefaultData().monthlyPatterns;
    }

    const ctx = document.getElementById('monthlyPatternsChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.months,
            datasets: [
                {
                    label: 'Approved Leaves',
                    data: data.approved,
                    backgroundColor: 'rgba(75, 192, 192, 0.6)'
                },
                {
                    label: 'Rejected Leaves',
                    data: data.rejected,
                    backgroundColor: 'rgba(255, 99, 132, 0.6)'
                },
                {
                    label: 'Pending Leaves',
                    data: data.pending,
                    backgroundColor: 'rgba(255, 206, 86, 0.6)'
                }
            ]
        },
        options: {
            ...commonChartOptions,
            scales: {
                x: {
                    stacked: true,
                },
                y: {
                    stacked: true,
                    beginAtZero: true
                }
            }
        }
    });
}

function displayTopUsers(data = []) {
    const tbody = document.querySelector('#topUsersTable tbody');
    if (!data || !data.length) {
        tbody.innerHTML = '<tr><td colspan="4">No data available</td></tr>';
        return;
    }

    tbody.innerHTML = data.map(user => `
        <tr>
            <td>${user.username || 'N/A'}</td>
            <td>${user.totalLeaves || 0}</td>
            <td>${user.leaveBalance || 0}</td>
            <td>${user.usageRate || 0}%</td>
        </tr>
    `).join('');
}

function displayKeyMetrics(metrics = getDefaultData().keyMetrics) {
    if (!metrics) {
        metrics = getDefaultData().keyMetrics;
    }

    const metricsContainer = document.getElementById('keyMetrics');
    metricsContainer.innerHTML = `
        <div class="metric-card">
            <h3>Average Processing Time</h3>
            <div class="value">${metrics.avgProcessingTime || 0} hours</div>
        </div>
        <div class="metric-card">
            <h3>Approval Rate</h3>
            <div class="value">${metrics.approvalRate || 0}%</div>
        </div>
        <div class="metric-card">
            <h3>Peak Leave Month</h3>
            <div class="value">${metrics.peakMonth || 'N/A'}</div>
        </div>
        <div class="metric-card">
            <h3>Most Common Leave Type</h3>
            <div class="value">${metrics.commonLeaveType || 'N/A'}</div>
        </div>
    `;
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

// Add some CSS styles for the new components
const styles = `
    .metrics-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
        padding: 1rem;
    }

    .metric-card {
        background: #f8f9fa;
        padding: 1rem;
        border-radius: 8px;
        text-align: center;
    }

    .metric-card h3 {
        margin: 0;
        font-size: 0.9rem;
        color: #666;
    }

    .metric-card .value {
        font-size: 1.5rem;
        font-weight: bold;
        color: #333;
        margin-top: 0.5rem;
    }

    .table-responsive {
        overflow-x: auto;
    }

    #topUsersTable {
        width: 100%;
        border-collapse: collapse;
    }

    #topUsersTable th,
    #topUsersTable td {
        padding: 0.75rem;
        text-align: left;
        border-bottom: 1px solid #dee2e6;
    }

    #topUsersTable th {
        background-color: #f8f9fa;
        font-weight: 600;
    }
`;

// Add the styles to the document
const styleSheet = document.createElement('style');
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);
