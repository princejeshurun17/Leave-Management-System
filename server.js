const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const util = require('util');
const jwt = require('jsonwebtoken');

const app = express();
const port = 3000;

// Add this line to define JWT_SECRET
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'; // In a real app, use an environment variable

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Add this near the top of your server.js file
const log_file = fs.createWriteStream(__dirname + '/debug.log', {flags : 'w'});
const log_stdout = process.stdout;

console.log = function(d) {
  log_file.write(util.format(d) + '\n');
  log_stdout.write(util.format(d) + '\n');
};

// Initialize the database
const db = new sqlite3.Database('leave_management.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the leave_management database.');
        
        // Create tables
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE,
                password TEXT,
                leave_balance INTEGER,
                role TEXT
            )`, (err) => {
                if (err) {
                    console.error('Error creating users table:', err.message);
                } else {
                    console.log('Users table created or already exists.');
                }
            });

            db.run(`CREATE TABLE IF NOT EXISTS leave_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                start_date TEXT,
                end_date TEXT,
                reason TEXT,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )`, (err) => {
                if (err) {
                    console.error('Error creating leave_requests table:', err.message);
                } else {
                    console.log('Leave_requests table created or already exists.');
                }
            });
        });

        // Check if user_id column exists in leave_requests table
        db.all("PRAGMA table_info(leave_requests)", (err, rows) => {
            if (err) {
                console.error('Error checking leave_requests table structure:', err);
            } else {
                const userIdColumnExists = rows.some(row => row.name === 'user_id');
                if (!userIdColumnExists) {
                    // Add user_id column if it doesn't exist
                    db.run("ALTER TABLE leave_requests ADD COLUMN user_id INTEGER REFERENCES users(id)", (err) => {
                        if (err) {
                            console.error('Error adding user_id column to leave_requests:', err);
                        } else {
                            console.log('Added user_id column to leave_requests table');
                        }
                    });
                } else {
                    console.log('user_id column already exists in leave_requests table');
                }
            }
        });

        // Add status column to leave_requests table if it doesn't exist
        db.run(`
            ALTER TABLE leave_requests 
            ADD COLUMN status TEXT DEFAULT 'Pending'
        `, (err) => {
            if (err) {
                // Column might already exist, which is fine
                console.log('Status column might already exist:', err.message);
            } else {
                console.log('Added status column to leave_requests table');
            }
        });

        // Modify the leave_requests table to include the leave_type column
        db.run(`ALTER TABLE leave_requests ADD COLUMN leave_type TEXT`, (err) => {
            if (err) {
                // Column might already exist, which is fine
                console.log('leave_type column might already exist:', err.message);
            } else {
                console.log('Added leave_type column to leave_requests table');
            }
        });

        // Create announcements table
        db.run(`CREATE TABLE IF NOT EXISTS announcements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            priority TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
    }
});

// Get leave balance (for simplicity, we'll keep it as a fixed value)
app.get('/api/leave_balance', authenticateToken, (req, res) => {
    db.get('SELECT leave_balance FROM users WHERE id = ?', [req.user.id], (err, row) => {
        if (err) {
            console.error('Error fetching leave balance:', err);
            return res.status(500).json({ error: 'Error fetching leave balance' });
        }
        if (!row) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ balance: row.leave_balance });
    });
});

// Submit a leave request
app.post('/api/leave_request', authenticateToken, validateLeaveRequest, (req, res) => {
    const { startDate, endDate, reason, leaveType } = req.body;
    const userId = req.user.id;

    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    db.get('SELECT leave_balance FROM users WHERE id = ?', [userId], (err, row) => {
        if (err) {
            console.error('Error checking leave balance:', err);
            return res.status(500).json({ error: 'Error checking leave balance' });
        }

        if (row.leave_balance < days) {
            return res.status(400).json({ error: 'Insufficient leave balance' });
        }

        db.run('INSERT INTO leave_requests (user_id, start_date, end_date, reason, status, leave_type) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, startDate, endDate, reason, 'Pending', leaveType],
            function(err) {
                if (err) {
                    console.error('Error submitting leave request:', err);
                    return res.status(500).json({ error: 'Error submitting leave request' });
                }
                res.status(201).json({ 
                    message: 'Leave request submitted successfully', 
                    id: this.lastID,
                    daysRequested: days
                });
            }
        );
    });
});

// Get all leave requests
app.get('/api/leave_requests', authenticateToken, (req, res) => {
    const query = req.user.role === 'admin' 
        ? `SELECT lr.*, u.username 
           FROM leave_requests lr 
           JOIN users u ON lr.user_id = u.id`
        : 'SELECT * FROM leave_requests WHERE user_id = ?';
    
    const params = req.user.role === 'admin' ? [] : [req.user.id];

    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Error fetching leave requests:', err);
            return res.status(500).json({ error: 'Error fetching leave requests' });
        }
        res.json(rows);
    });
});

// Register a new user
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run('INSERT INTO users (username, password, leave_balance, role) VALUES (?, ?, 30, ?)', 
            [username, hashedPassword, 'user'], 
            function(err) {
                if (err) {
                    console.error('Registration error:', err);
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(400).json({ error: 'Username already exists' });
                    }
                    return res.status(500).json({ error: 'Error creating user', details: err.message });
                }
                res.status(201).json({ message: 'User created successfully' });
            }
        );
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Error creating user', details: error.message });
    }
});

// Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        if (err) {
            console.error('Database error during login:', err);
            return res.status(500).json({ error: 'Error during login', details: err.message });
        }
        
        if (!user) {
            console.log('Login failed: User not found');
            return res.status(400).json({ error: 'User not found' });
        }

        try {
            const match = await bcrypt.compare(password, user.password);
            if (match) {
                const token = jwt.sign(
                    { id: user.id, username: user.username, role: user.role },
                    JWT_SECRET,
                    { expiresIn: '1h' }
                );
                console.log('Login successful for user:', username);
                res.json({ token, role: user.role });
            } else {
                console.log('Login failed: Invalid password');
                res.status(400).json({ error: 'Invalid password' });
            }
        } catch (error) {
            console.error('Error during password comparison:', error);
            res.status(500).json({ error: 'Error during login', details: error.message });
        }
    });
});

app.get('/api/users', (req, res) => {
    db.all('SELECT id, username, leave_balance FROM users', [], (err, rows) => {
        if (err) {
            console.error('Error fetching users:', err);
            return res.status(500).json({ error: 'Error fetching users' });
        }
        res.json(rows);
    });
});

app.delete('/api/leave_request/:id', authenticateToken, (req, res) => {
    const requestId = req.params.id;
    const userId = req.user.id;

    db.run('DELETE FROM leave_requests WHERE id = ? AND user_id = ? AND status = "Pending"', [requestId, userId], function(err) {
        if (err) {
            console.error('Error cancelling leave request:', err);
            return res.status(500).json({ error: 'Error cancelling leave request' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Leave request not found or not cancellable' });
        }
        res.json({ message: 'Leave request cancelled successfully' });
    });
});

// Middleware to check if user is admin
function isAdmin(req, res, next) {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied. Admin only.' });
    }
    next();
}

// Admin route to get all leave requests
app.get('/api/admin/leave_requests', authenticateToken, isAdmin, (req, res) => {
    db.all(`SELECT lr.*, u.username 
            FROM leave_requests lr 
            JOIN users u ON lr.user_id = u.id`, [], (err, rows) => {
        if (err) {
            console.error('Error fetching leave requests:', err);
            return res.status(500).json({ error: 'Error fetching leave requests' });
        }
        res.json(rows);
    });
});

// Admin route to update leave request status
app.put('/api/admin/leave_request/:id', authenticateToken, isAdmin, (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!['Approved', 'Rejected'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        db.get('SELECT * FROM leave_requests WHERE id = ?', [id], (err, leaveRequest) => {
            if (err) {
                console.error('Error fetching leave request:', err);
                db.run('ROLLBACK');
                return res.status(500).json({ error: 'Error updating leave request' });
            }

            if (!leaveRequest) {
                db.run('ROLLBACK');
                return res.status(404).json({ error: 'Leave request not found' });
            }

            const startDate = new Date(leaveRequest.start_date);
            const endDate = new Date(leaveRequest.end_date);
            const leaveDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

            db.run('UPDATE leave_requests SET status = ? WHERE id = ?', [status, id], function(err) {
                if (err) {
                    console.error('Error updating leave request:', err);
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: 'Error updating leave request' });
                }

                if (status === 'Approved') {
                    db.run('UPDATE users SET leave_balance = leave_balance - ? WHERE id = ?', 
                        [leaveDays, leaveRequest.user_id], 
                        function(err) {
                            if (err) {
                                console.error('Error updating leave balance:', err);
                                db.run('ROLLBACK');
                                return res.status(500).json({ error: 'Error updating leave balance' });
                            }

                            db.run('COMMIT');
                            res.json({ message: 'Leave request approved and balance updated successfully' });
                        }
                    );
                } else {
                    db.run('COMMIT');
                    res.json({ message: 'Leave request rejected successfully' });
                }
            });
        });
    });
});

app.get('/api/admin/analytics', authenticateToken, isAdmin, (req, res) => {
    const analyticsData = {
        summary: {
            totalUsers: 0,
            averageLeaveBalance: 0,
            totalPendingRequests: 0,
            totalApprovedRequests: 0
        },
        leaveRequestsTrend: {
            labels: [],
            data: []
        },
        leaveBalanceDistribution: {
            labels: ['0-5', '6-10', '11-15', '16-20', '21-25', '26-30'],
            data: [0, 0, 0, 0, 0, 0]
        }
    };

    db.serialize(() => {
        // Get total users and average leave balance
        db.get('SELECT COUNT(*) as totalUsers, AVG(leave_balance) as avgBalance FROM users', (err, row) => {
            if (err) {
                console.error('Error fetching user stats:', err);
                return res.status(500).json({ error: 'Error fetching analytics data' });
            }
            analyticsData.summary.totalUsers = row.totalUsers;
            analyticsData.summary.averageLeaveBalance = row.avgBalance;
        });

        // Get total pending and approved requests
        db.get('SELECT COUNT(*) as pendingCount FROM leave_requests WHERE status = "Pending"', (err, row) => {
            if (err) {
                console.error('Error fetching pending requests count:', err);
                return res.status(500).json({ error: 'Error fetching analytics data' });
            }
            analyticsData.summary.totalPendingRequests = row.pendingCount;
        });

        db.get('SELECT COUNT(*) as approvedCount FROM leave_requests WHERE status = "Approved"', (err, row) => {
            if (err) {
                console.error('Error fetching approved requests count:', err);
                return res.status(500).json({ error: 'Error fetching analytics data' });
            }
            analyticsData.summary.totalApprovedRequests = row.approvedCount;
        });

        // Get leave requests trend (last 6 months)
        db.all(`
            SELECT strftime('%Y-%m', start_date) as month, COUNT(*) as count
            FROM leave_requests
            WHERE start_date >= date('now', '-6 months')
            GROUP BY month
            ORDER BY month
        `, (err, rows) => {
            if (err) {
                console.error('Error fetching leave requests trend:', err);
                return res.status(500).json({ error: 'Error fetching analytics data' });
            }
            analyticsData.leaveRequestsTrend.labels = rows.map(row => row.month);
            analyticsData.leaveRequestsTrend.data = rows.map(row => row.count);
        });

        // Get leave balance distribution
        db.all(`
            SELECT 
                CASE 
                    WHEN leave_balance BETWEEN 0 AND 5 THEN '0-5'
                    WHEN leave_balance BETWEEN 6 AND 10 THEN '6-10'
                    WHEN leave_balance BETWEEN 11 AND 15 THEN '11-15'
                    WHEN leave_balance BETWEEN 16 AND 20 THEN '16-20'
                    WHEN leave_balance BETWEEN 21 AND 25 THEN '21-25'
                    ELSE '26-30'
                END as balance_range,
                COUNT(*) as count
            FROM users
            GROUP BY balance_range
        `, (err, rows) => {
            if (err) {
                console.error('Error fetching leave balance distribution:', err);
                return res.status(500).json({ error: 'Error fetching analytics data' });
            }
            rows.forEach(row => {
                const index = analyticsData.leaveBalanceDistribution.labels.indexOf(row.balance_range);
                if (index !== -1) {
                    analyticsData.leaveBalanceDistribution.data[index] = row.count;
                }
            });
        });

        // After all queries, add this:
        db.all(`SELECT * FROM users`, (err, rows) => {
            if (err) {
                console.error('Error fetching users:', err);
                return res.status(500).json({ error: 'Error fetching analytics data' });
            }
            console.log('Analytics data:', analyticsData);
            console.log('Number of users:', rows.length);
            res.json(analyticsData);
        });
    });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        console.log('No token provided');
        return res.sendStatus(401);
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error('Token verification failed:', err);
            return res.sendStatus(403);
        }
        console.log('Authenticated user:', user);
        req.user = user;
        next();
    });
}

function validateLeaveRequest(req, res, next) {
    const { startDate, endDate, reason } = req.body;
    
    if (!startDate || !endDate || !reason) {
        return res.status(400).json({ error: 'Start date, end date, and reason are required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ error: 'Invalid date format' });
    }

    if (start > end) {
        return res.status(400).json({ error: 'Start date must be before end date' });
    }

    if (reason.trim().length === 0) {
        return res.status(400).json({ error: 'Reason cannot be empty' });
    }

    next();
}

// Function to reset leave balances
function resetLeaveBalances() {
    db.run('UPDATE users SET leave_balance = 30', (err) => {
        if (err) {
            console.error('Error resetting leave balances:', err);
        } else {
            console.log('Leave balances reset successfully');
        }
    });
}

// Schedule the reset to run on January 1st of each year
const schedule = require('node-schedule');
schedule.scheduleJob('0 0 1 1 *', resetLeaveBalances);

// Get all users with leave information
app.get('/api/admin/users', authenticateToken, isAdmin, (req, res) => {
    db.all(`
        SELECT 
            u.id, 
            u.username, 
            u.role, 
            u.leave_balance,
            (SELECT COUNT(*) FROM leave_requests 
             WHERE user_id = u.id AND status = 'Approved') as leaves_taken,
            (SELECT COUNT(*) FROM leave_requests 
             WHERE user_id = u.id AND status = 'Pending') as pending_requests
        FROM users u
    `, [], (err, rows) => {
        if (err) {
            console.error('Error fetching users:', err);
            return res.status(500).json({ error: 'Error fetching users' });
        }
        res.json(rows);
    });
});

// Update user's leave balance
app.put('/api/admin/user/:id/leave-balance', authenticateToken, isAdmin, (req, res) => {
    const { id } = req.params;
    const { leaveBalance } = req.body;

    if (typeof leaveBalance !== 'number' || leaveBalance < 0) {
        return res.status(400).json({ error: 'Invalid leave balance' });
    }

    db.run('UPDATE users SET leave_balance = ? WHERE id = ?', [leaveBalance, id], function(err) {
        if (err) {
            console.error('Error updating leave balance:', err);
            return res.status(500).json({ error: 'Error updating leave balance' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ message: 'Leave balance updated successfully' });
    });
});

app.get('/api/user/info', authenticateToken, (req, res) => {
    db.get('SELECT username, role FROM users WHERE id = ?', [req.user.id], (err, row) => {
        if (err) {
            console.error('Error fetching user info:', err);
            return res.status(500).json({ error: 'Error fetching user info' });
        }
        if (!row) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(row);
    });
});

// Get all announcements
app.get('/api/announcements', authenticateToken, (req, res) => {
    db.all('SELECT * FROM announcements ORDER BY created_at DESC', [], (err, rows) => {
        if (err) {
            console.error('Error fetching announcements:', err);
            return res.status(500).json({ error: 'Error fetching announcements' });
        }
        res.json(rows);
    });
});

// Create new announcement (admin only)
app.post('/api/announcements', authenticateToken, isAdmin, (req, res) => {
    const { title, content, priority } = req.body;
    
    if (!title || !content || !priority) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    db.run('INSERT INTO announcements (title, content, priority) VALUES (?, ?, ?)',
        [title, content, priority],
        function(err) {
            if (err) {
                console.error('Error creating announcement:', err);
                return res.status(500).json({ error: 'Error creating announcement' });
            }
            res.status(201).json({ id: this.lastID });
        }
    );
});

// Delete announcement (admin only)
app.delete('/api/announcements/:id', authenticateToken, isAdmin, (req, res) => {
    db.run('DELETE FROM announcements WHERE id = ?', [req.params.id], function(err) {
        if (err) {
            console.error('Error deleting announcement:', err);
            return res.status(500).json({ error: 'Error deleting announcement' });
        }
        res.json({ message: 'Announcement deleted successfully' });
    });
});

app.get('/api/dashboard-stats', authenticateToken, (req, res) => {
    db.get(`
        SELECT 
            (SELECT COUNT(*) FROM leave_requests 
             WHERE user_id = ? AND status = 'Pending') as pendingRequests,
            (SELECT COUNT(*) FROM announcements 
             WHERE created_at >= datetime('now', '-7 days')) as recentAnnouncements
    `, [req.user.id], (err, row) => {
        if (err) {
            console.error('Error fetching dashboard stats:', err);
            return res.status(500).json({ error: 'Error fetching dashboard stats' });
        }
        res.json(row);
    });
});

