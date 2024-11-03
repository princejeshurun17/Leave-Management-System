const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const db = new sqlite3.Database('leave_management.db');

async function insertSampleData() {
    try {
        // Sample users
        const users = [
            { username: 'john.doe', password: 'password123', leave_balance: 25, role: 'user' },
            { username: 'jane.smith', password: 'password123', leave_balance: 28, role: 'user' },
            { username: 'bob.wilson', password: 'password123', leave_balance: 30, role: 'user' },
            { username: 'alice.johnson', password: 'password123', leave_balance: 22, role: 'user' },
            { username: 'mike.brown', password: 'password123', leave_balance: 15, role: 'user' },
            { username: 'sarah.davis', password: 'password123', leave_balance: 20, role: 'user' },
            { username: 'tom.miller', password: 'password123', leave_balance: 18, role: 'user' },
            { username: 'emma.wilson', password: 'password123', leave_balance: 27, role: 'user' },
            { username: 'david.clark', password: 'password123', leave_balance: 24, role: 'user' },
            { username: 'lisa.anderson', password: 'password123', leave_balance: 30, role: 'user' }
        ];

        // Insert users
        for (const user of users) {
            const hashedPassword = await bcrypt.hash(user.password, 10);
            await new Promise((resolve, reject) => {
                db.run('INSERT OR IGNORE INTO users (username, password, leave_balance, role) VALUES (?, ?, ?, ?)',
                    [user.username, hashedPassword, user.leave_balance, user.role],
                    (err) => err ? reject(err) : resolve()
                );
            });
        }

        // Get user IDs for leave requests
        const userIds = await new Promise((resolve, reject) => {
            db.all('SELECT id FROM users WHERE role = "user"', (err, rows) => {
                err ? reject(err) : resolve(rows.map(row => row.id));
            });
        });

        // Sample leave requests
        const leaveTypes = ['Annual Leave', 'Sick Leave', 'Emergency Leave', 'Maternity Leave', 'Paternity Leave'];
        const statuses = ['Pending', 'Approved', 'Rejected'];
        
        for (const userId of userIds) {
            const numRequests = Math.floor(Math.random() * 4) + 1; // 1-4 requests per user
            
            for (let i = 0; i < numRequests; i++) {
                const startDate = new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1);
                const endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + Math.floor(Math.random() * 5) + 1);

                await new Promise((resolve, reject) => {
                    db.run(`
                        INSERT INTO leave_requests 
                        (user_id, start_date, end_date, reason, status, leave_type) 
                        VALUES (?, ?, ?, ?, ?, ?)`,
                        [
                            userId,
                            startDate.toISOString().split('T')[0],
                            endDate.toISOString().split('T')[0],
                            `Sample leave request reason ${i + 1}`,
                            statuses[Math.floor(Math.random() * statuses.length)],
                            leaveTypes[Math.floor(Math.random() * leaveTypes.length)]
                        ],
                        (err) => err ? reject(err) : resolve()
                    );
                });
            }
        }

        // Sample announcements
        const announcements = [
            {
                title: 'New Leave Policy Update',
                content: 'Please be informed that the annual leave policy has been updated for the new year.',
                priority: 'High'
            },
            {
                title: 'System Maintenance',
                content: 'The leave management system will undergo maintenance this weekend.',
                priority: 'Medium'
            },
            {
                title: 'Holiday Schedule',
                content: 'The official holiday schedule for 2024 has been published.',
                priority: 'High'
            },
            {
                title: 'Leave Application Deadline',
                content: 'Please submit your leave applications for the upcoming holiday season by next week.',
                priority: 'Medium'
            },
            {
                title: 'Welcome to New HR Manager',
                content: 'Please join us in welcoming our new HR Manager, starting next month.',
                priority: 'Low'
            }
        ];

        for (const announcement of announcements) {
            await new Promise((resolve, reject) => {
                db.run('INSERT INTO announcements (title, content, priority) VALUES (?, ?, ?)',
                    [announcement.title, announcement.content, announcement.priority],
                    (err) => err ? reject(err) : resolve()
                );
            });
        }

        console.log('Sample data inserted successfully');
    } catch (error) {
        console.error('Error inserting sample data:', error);
    } finally {
        db.close();
    }
}

insertSampleData(); 