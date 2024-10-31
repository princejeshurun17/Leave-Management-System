document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('registerUsername').value;
    const password = document.getElementById('registerPassword').value;

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        const data = await response.json();
        if (response.ok) {
            alert('Registration successful. Please login.');
            window.location.href = 'login.html';
        } else {
            alert(`Registration failed: ${data.error}`);
        }
    } catch (error) {
        console.error('Error during registration:', error);
        alert('An error occurred during registration.');
    }
});
