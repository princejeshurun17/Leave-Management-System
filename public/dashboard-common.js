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

// Set active nav item based on current page
function setActiveNavItem() {
    const currentPage = window.location.pathname.split('/').pop();
    document.querySelectorAll('.nav-item').forEach(item => {
        if (item.getAttribute('href') === currentPage) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

// Fetch user info and display greeting
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

// Logout functionality
document.getElementById('logoutButton').addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    window.location.href = 'index.html';
});

// Initialize common features
fetchUserInfo();
setActiveNavItem();