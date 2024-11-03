// Simple, direct implementation
document.addEventListener('DOMContentLoaded', function() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // Immediately fetch data
    fetch('/api/leave_requests', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(data => {
        const tableBody = document.getElementById('leaveTableBody');
        
        if (!data || data.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center;">No leave requests found</td>
                </tr>
            `;
            return;
        }

        const rows = data.map(request => {
            const start = new Date(request.start_date);
            const end = new Date(request.end_date);
            const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

            return `
                <tr>
                    <td>${start.toLocaleDateString()}</td>
                    <td>${end.toLocaleDateString()}</td>
                    <td>${days}</td>
                    <td>${request.leave_type || 'N/A'}</td>
                    <td>${request.reason || 'N/A'}</td>
                    <td>${request.status}</td>
                    <td>
                        ${request.status === 'Pending' ? 
                            `<button onclick="cancelRequest(${request.id})" class="btn-cancel">Cancel</button>` 
                            : '-'}
                    </td>
                </tr>
            `;
        }).join('');

        tableBody.innerHTML = rows;
    })
    .catch(error => {
        console.error('Error:', error);
        document.getElementById('leaveTableBody').innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; color: red;">
                    Error loading leave requests. Please refresh the page.
                </td>
            </tr>
        `;
    });

    // Add form submission handler
    const leaveForm = document.getElementById('newLeaveForm');
    leaveForm.addEventListener('submit', submitLeaveRequest);

    // Add date input restrictions
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    
    // Set minimum date to today
    const today = new Date().toISOString().split('T')[0];
    startDateInput.min = today;
    endDateInput.min = today;

    // Update end date minimum when start date changes
    startDateInput.addEventListener('change', () => {
        endDateInput.min = startDateInput.value;
        if (endDateInput.value < startDateInput.value) {
            endDateInput.value = startDateInput.value;
        }
    });
});

// Simple cancel function
function cancelRequest(id) {
    const token = localStorage.getItem('token');
    if (!confirm('Are you sure you want to cancel this request?')) return;

    fetch(`/api/leave_request/${id}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (response.ok) {
            alert('Request cancelled successfully');
            location.reload(); // Simple reload to refresh the data
        } else {
            throw new Error('Failed to cancel request');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Failed to cancel request. Please try again.');
    });
}

async function submitLeaveRequest(event) {
    event.preventDefault();
    
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const leaveType = document.getElementById('leaveType').value;
    const reason = document.getElementById('reason').value;

    try {
        const response = await fetch('/api/leave_requests', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                start_date: startDate,
                end_date: endDate,
                leave_type: leaveType,
                reason: reason
            })
        });

        if (!response.ok) {
            throw new Error('Failed to submit leave request');
        }

        alert('Leave request submitted successfully!');
        document.getElementById('newLeaveForm').reset();
        // Refresh the leave requests table
        location.reload();
    } catch (error) {
        console.error('Error submitting leave request:', error);
        alert('Failed to submit leave request. Please try again.');
    }
}

// Add some basic styles
const styles = `
    #simpleLeaveTable {
        width: 100%;
        border-collapse: collapse;
        margin-top: 20px;
    }

    #simpleLeaveTable th,
    #simpleLeaveTable td {
        padding: 12px;
        text-align: left;
        border-bottom: 1px solid #ddd;
    }

    #simpleLeaveTable th {
        background-color: #f5f5f5;
        font-weight: bold;
    }

    .btn-cancel {
        padding: 5px 10px;
        background-color: #ff4444;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    }

    .btn-cancel:hover {
        background-color: #cc0000;
    }
`;

// Add additional styles
const additionalStyles = `
    .leave-request-form {
        margin-bottom: 2rem;
        padding: 1.5rem;
    }

    .form-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 1rem;
        margin-bottom: 1rem;
    }

    .form-group {
        display: flex;
        flex-direction: column;
    }

    .form-group label {
        margin-bottom: 0.5rem;
        color: #333;
        font-weight: 500;
    }

    .form-group input,
    .form-group select,
    .form-group textarea {
        padding: 0.5rem;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 1rem;
    }

    .form-group textarea {
        height: 100px;
        resize: vertical;
    }

    .btn-submit {
        background-color: #4CAF50;
        color: white;
        padding: 0.75rem 1.5rem;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 1rem;
        font-weight: 500;
    }

    .btn-submit:hover {
        background-color: #45a049;
    }

    /* Make reason textarea span full width */
    .form-group:last-child {
        grid-column: 1 / -1;
    }

    @media (max-width: 768px) {
        .form-grid {
            grid-template-columns: 1fr;
        }
    }
`;

// Add styles to document
const styleSheet = document.createElement('style');
styleSheet.textContent = styles + additionalStyles;
document.head.appendChild(styleSheet);