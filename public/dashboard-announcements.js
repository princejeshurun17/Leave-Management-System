async function fetchAnnouncements() {
    try {
        const response = await fetch('/api/announcements', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const announcements = await response.json();
            displayUserAnnouncements(announcements);
        } else {
            throw new Error('Failed to fetch announcements');
        }
    } catch (error) {
        console.error('Error fetching announcements:', error);
        document.getElementById('userAnnouncementsList').innerHTML = 
            '<p class="error-message">Failed to load announcements. Please try again later.</p>';
    }
}

function displayUserAnnouncements(announcements) {
    const container = document.getElementById('userAnnouncementsList');
    if (!announcements.length) {
        container.innerHTML = '<p class="no-data">No announcements available.</p>';
        return;
    }
    
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

// Initialize
fetchAnnouncements(); 