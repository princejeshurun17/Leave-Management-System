let leaveRequests = [];

async function fetchLeaveRequests() {
    try {
        const response = await fetch('/api/leave-requests', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            leaveRequests = await response.json();
            displayLeaveRequests();
        }
    } catch (error) {
        console.error('Error fetching leave requests:', error);
    }
}

function displayLeaveRequests() {
    const leaveRequestsList = document.getElementById('leaveRequestsList');
    leaveRequestsList.innerHTML = '';
    
    leaveRequests.forEach(request => {
        const startDate = new Date(request.start_date);
        const endDate = new Date(request.end_date);
        const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDate(startDate)}</td>
            <td>${formatDate(endDate)}</td>
            <td>${days}</td>
            <td>${request.leave_type}</td>
            <td>${request.reason}</td>
            <td><span class="status ${request.status.toLowerCase()}">${request.status}</span></td>
            <td>
                ${request.status === 'Pending' ? 
                    `<button class="btn btn-small btn-cancel" onclick="cancelRequest(${request.id})">Cancel</button>` 
                    : ''}
            </td>
        `;
        leaveRequestsList.appendChild(row);
    });
}

async function submitLeaveRequest(e) {
    e.preventDefault();
    
    const formData = {
        leaveType: document.getElementById('leaveType').value,
        startDate: document.getElementById('startDate').value,
        endDate: document.getElementById('endDate').value,
        reason: document.getElementById('reason').value
    };

    try {
        const response = await fetch('/api/leave-requests', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            alert('Leave request submitted successfully');
            e.target.reset();
            fetchLeaveRequests();
        } else {
            const error = await response.json();
            alert(error.message || 'Failed to submit leave request');
        }
    } catch (error) {
        console.error('Error submitting leave request:', error);
        alert('Error submitting leave request');
    }
}

async function cancelRequest(id) {
    if (!confirm('Are you sure you want to cancel this leave request?')) return;

    try {
        const response = await fetch(`/api/leave-requests/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            alert('Leave request cancelled successfully');
            fetchLeaveRequests();
        } else {
            alert('Failed to cancel leave request');
        }
    } catch (error) {
        console.error('Error cancelling leave request:', error);
        alert('Error cancelling leave request');
    }
}

function formatDate(date) {
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

// Initialize
document.getElementById('leaveRequestForm').addEventListener('submit', submitLeaveRequest);
fetchLeaveRequests(); 