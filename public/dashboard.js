document.addEventListener('DOMContentLoaded', function() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // Fetch all dashboard data at once
    Promise.all([
        // Fetch leave balance
        fetch('/api/leave-balance', {
            headers: { 'Authorization': `Bearer ${token}` }
        }),
        // Fetch dashboard stats
        fetch('/api/dashboard-stats', {
            headers: { 'Authorization': `Bearer ${token}` }
        })
    ])
    .then(responses => Promise.all(responses.map(r => r.json())))
    .then(([balanceData, statsData]) => {
        // Update leave balance
        const balanceElement = document.getElementById('leaveBalance');
        if (balanceElement) {
            balanceElement.textContent = balanceData.balance || '0';
        }

        // Update pending requests
        const pendingElement = document.getElementById('pendingRequests');
        if (pendingElement) {
            pendingElement.textContent = statsData.pendingRequests || '0';
        }

        // Update recent announcements
        const announcementsElement = document.getElementById('recentAnnouncements');
        if (announcementsElement) {
            announcementsElement.textContent = statsData.recentAnnouncements || '0';
        }
    })
    .catch(error => {
        console.error('Error loading dashboard data:', error);
        // Show error state
        document.querySelectorAll('.value').forEach(el => {
            el.textContent = 'Error';
            el.style.color = 'red';
        });
    });
});

// Add some basic styles
const styles = `
    .leave-balance {
        background: white;
        padding: 20px;
        border-radius: 8px;
        text-align: center;
        margin-bottom: 20px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .leave-balance h2 {
        margin: 0;
        color: #333;
        font-size: 1.2rem;
    }

    .balance {
        font-size: 3rem;
        font-weight: bold;
        color: #2c3e50;
        margin: 10px 0;
    }

    .quick-stats {
        background: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 20px;
        margin-top: 15px;
    }

    .stat-item {
        text-align: center;
        padding: 15px;
        background: #f8f9fa;
        border-radius: 8px;
    }

    .stat-item h3 {
        margin: 0;
        color: #666;
        font-size: 0.9rem;
    }

    .stat-item p {
        font-size: 1.8rem;
        font-weight: bold;
        color: #2c3e50;
        margin: 10px 0 0 0;
    }

    .error {
        color: #dc3545;
    }
`;

// Add styles to document
const styleSheet = document.createElement('style');
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);
