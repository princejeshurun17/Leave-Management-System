const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const db = new sqlite3.Database('leave_management.db');

async function createAdminUser(username, password) {
    const hashedPassword = await bcrypt.hash(password, 10);
    return new Promise((resolve, reject) => {
        db.run('INSERT OR REPLACE INTO users (username, password, leave_balance, role) VALUES (?, ?, ?, ?)', 
            [username, hashedPassword, 30, 'admin'], 
            function(err) {
                if (err) {
                    console.error('Error creating admin user:', err);
                    reject(err);
                } else {
                    console.log('Admin user created successfully');
                    resolve();
                }
            }
        );
    });
}

createAdminUser('admin', 'adminpassword')
    .then(() => {
        console.log('Admin user creation complete');
        db.close();
    })
    .catch(err => {
        console.error('Error during admin user creation:', err);
        db.close();
    });
