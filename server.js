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

            // Add status column to leave_requests if it doesn't exist
            db.run(`
                ALTER TABLE leave_requests 
                ADD COLUMN status TEXT DEFAULT 'Pending'
            `, (err) => {
                if (err) {
                    // Column might already exist, which is fine
                    console.log('Status column might already exist:', err.message);
                }
            });

            // Add leave_type column to leave_requests if it doesn't exist
            db.run(`
                ALTER TABLE leave_requests 
                ADD COLUMN leave_type TEXT
            `, (err) => {
                if (err) {
                    // Column might already exist, which is fine
                    console.log('leave_type column might already exist:', err.message);
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
    const userId = req.user.id;
    
    db.all(`
        SELECT 
            id,
            start_date,
            end_date,
            leave_type,
            reason,
            status
        FROM leave_requests 
        WHERE user_id = ?
        ORDER BY start_date DESC
    `, [userId], (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to fetch leave requests' });
        }
        
        res.json(rows || []);
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

app.get('/api/admin/analytics', authenticateToken, async (req, res) => {
    // Verify admin role
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    try {
        // Get total users and average leave balance
        const userStats = await new Promise((resolve, reject) => {
            db.get(`
                SELECT 
                    COUNT(*) as totalUsers,
                    AVG(leave_balance) as averageLeaveBalance
                FROM users
                WHERE role != 'admin'
            `, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        // Get leave request statistics
        const leaveStats = await new Promise((resolve, reject) => {
            db.get(`
                SELECT 
                    COUNT(CASE WHEN status = 'Pending' THEN 1 END) as totalPending,
                    COUNT(CASE WHEN status = 'Approved' THEN 1 END) as totalApproved
                FROM leave_requests
            `, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        // Get leave types distribution
        const leaveTypes = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    leave_type,
                    COUNT(*) as count
                FROM leave_requests
                GROUP BY leave_type
            `, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // Get monthly patterns
        const monthlyPatterns = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    strftime('%m', start_date) as month,
                    status,
                    COUNT(*) as count
                FROM leave_requests
                WHERE start_date >= date('now', '-1 year')
                GROUP BY month, status
            `, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // Get top users by leave usage
        const topUsers = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    u.username,
                    u.leave_balance,
                    COUNT(lr.id) as total_leaves,
                    ROUND(COUNT(lr.id) * 100.0 / (COUNT(lr.id) + u.leave_balance), 2) as usage_rate
                FROM users u
                LEFT JOIN leave_requests lr ON u.id = lr.user_id
                WHERE u.role != 'admin'
                GROUP BY u.id
                ORDER BY total_leaves DESC
                LIMIT 5
            `, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // Process and format the data
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthlyData = {
            months: months,
            approved: new Array(12).fill(0),
            rejected: new Array(12).fill(0),
            pending: new Array(12).fill(0)
        };

        monthlyPatterns.forEach(pattern => {
            const monthIndex = parseInt(pattern.month) - 1;
            switch (pattern.status) {
                case 'Approved':
                    monthlyData.approved[monthIndex] = pattern.count;
                    break;
                case 'Rejected':
                    monthlyData.rejected[monthIndex] = pattern.count;
                    break;
                case 'Pending':
                    monthlyData.pending[monthIndex] = pattern.count;
                    break;
            }
        });

        // Calculate peak month
        const totalsByMonth = monthlyData.approved.map((val, idx) => ({
            month: months[idx],
            total: val + monthlyData.rejected[idx] + monthlyData.pending[idx]
        }));
        const peakMonth = totalsByMonth.reduce((max, curr) => 
            curr.total > max.total ? curr : max
        , totalsByMonth[0]).month;

        // Format leave types for chart
        const leaveTypesFormatted = {
            labels: leaveTypes.map(lt => lt.leave_type),
            data: leaveTypes.map(lt => lt.count)
        };

        // Calculate most common leave type
        const commonLeaveType = leaveTypes.reduce((max, curr) => 
            curr.count > max.count ? curr : max
        , leaveTypes[0])?.leave_type;

        // Get leave requests trend
        const leaveRequestsTrend = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    strftime('%m', start_date) as month,
                    COUNT(*) as count
                FROM leave_requests
                WHERE start_date >= date('now', '-1 year')
                GROUP BY month
                ORDER BY month
            `, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // Get leave balance distribution
        const leaveBalanceDistribution = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    CASE 
                        WHEN leave_balance BETWEEN 0 AND 5 THEN '0-5 days'
                        WHEN leave_balance BETWEEN 6 AND 10 THEN '6-10 days'
                        WHEN leave_balance BETWEEN 11 AND 15 THEN '11-15 days'
                        WHEN leave_balance BETWEEN 16 AND 20 THEN '16-20 days'
                        WHEN leave_balance BETWEEN 21 AND 25 THEN '21-25 days'
                        ELSE '26-30 days'
                    END as range,
                    COUNT(*) as count
                FROM users
                WHERE role != 'admin'
                GROUP BY range
                ORDER BY range
            `, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        const analyticsData = {
            summary: {
                totalUsers: userStats.totalUsers,
                averageLeaveBalance: Math.round(userStats.averageLeaveBalance * 10) / 10,
                totalPendingRequests: leaveStats.totalPending,
                totalApprovedRequests: leaveStats.totalApproved
            },
            leaveTypes: leaveTypesFormatted,
            monthlyPatterns: monthlyData,
            topUsers: topUsers.map(user => ({
                username: user.username,
                totalLeaves: user.total_leaves,
                leaveBalance: user.leave_balance,
                usageRate: user.usage_rate
            })),
            keyMetrics: {
                avgProcessingTime: 24, // Placeholder - implement actual calculation
                approvalRate: Math.round(leaveStats.totalApproved * 100 / 
                    (leaveStats.totalApproved + leaveStats.totalPending) * 10) / 10,
                peakMonth: peakMonth,
                commonLeaveType: commonLeaveType
            },
            leaveRequestsTrend: {
                labels: months,
                data: months.map((_,i) => {
                    const monthData = leaveRequestsTrend.find(r => parseInt(r.month) === i + 1);
                    return monthData ? monthData.count : 0;
                })
            },
            leaveBalanceDistribution: {
                labels: ['0-5 days', '6-10 days', '11-15 days', '16-20 days', '21-25 days', '26-30 days'],
                data: leaveBalanceDistribution.map(d => d.count)
            }
        };

        res.json(analyticsData);
    } catch (error) {
        console.error('Error generating analytics:', error);
        res.status(500).json({ error: 'Error generating analytics data' });
    }
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

app.get('/api/leave-balance', authenticateToken, (req, res) => {
    const userId = req.user.id;
    
    db.get(
        'SELECT leave_balance FROM users WHERE id = ?',
        [userId],
        (err, row) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Failed to fetch leave balance' });
            }
            
            res.json({ balance: row ? row.leave_balance : 0 });
        }
    );
});

app.get('/api/dashboard-stats', authenticateToken, (req, res) => {
    const userId = req.user.id;
    
    db.get(`
        SELECT 
            (SELECT COUNT(*) FROM leave_requests 
             WHERE user_id = ? AND status = 'Pending') as pendingRequests,
            (SELECT COUNT(*) FROM announcements 
             WHERE created_at >= datetime('now', '-7 days')) as recentAnnouncements
    `, [userId], (err, row) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to fetch dashboard stats' });
        }
        
        res.json({
            pendingRequests: row ? row.pendingRequests : 0,
            recentAnnouncements: row ? row.recentAnnouncements : 0
        });
    });
});

// Add this to your server.js
app.post('/api/leave_requests', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const { start_date, end_date, leave_type, reason } = req.body;

    // Basic validation
    if (!start_date || !end_date || !leave_type || !reason) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    // Insert the new leave request
    db.run(`
        INSERT INTO leave_requests (
            user_id, 
            start_date, 
            end_date, 
            leave_type, 
            reason, 
            status
        ) VALUES (?, ?, ?, ?, ?, 'Pending')
    `, [userId, start_date, end_date, leave_type, reason], function(err) {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to submit leave request' });
        }
        
        res.json({ 
            message: 'Leave request submitted successfully', 
            id: this.lastID 
        });
    });
});

// Add this new endpoint to check for existing usernames
app.get('/api/check-username', (req, res) => {
    const username = req.query.username;
    
    db.get('SELECT id FROM users WHERE username = ?', [username], (err, row) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Server error' });
        }
        
        res.json({ exists: !!row });
    });
});

