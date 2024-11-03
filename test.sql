SELECT username, leave_balance FROM users;

INSERT INTO leave_requests (user_id, start_date, end_date, reason, status, leave_type)
VALUES 
(1, '2024-03-01', '2024-03-03', 'Vacation', 'Pending', 'Annual Leave'),
(1, '2024-02-15', '2024-02-16', 'Medical appointment', 'Approved', 'Sick Leave');

select * from leave_requests;