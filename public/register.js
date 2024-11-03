document.addEventListener('DOMContentLoaded', function() {
    const registerForm = document.getElementById('registerForm');
    
    // First check if form exists
    if (!registerForm) {
        console.error('Register form not found');
        return;
    }

    // Get form elements
    const username = document.getElementById('username');
    const password = document.getElementById('password');
    const confirmPassword = document.getElementById('confirmPassword');

    // Check if all required elements exist
    if (!username || !password || !confirmPassword) {
        console.error('One or more form elements are missing');
        return;
    }

    async function validateForm() {
        let isValid = true;
        clearAllErrors();

        // Username validation
        if (username.value.length < 3) {
            showInputError(username, 'Username must be at least 3 characters');
            isValid = false;
        }

        // Check if username exists
        try {
            const response = await fetch(`/api/check-username?username=${username.value}`);
            const data = await response.json();
            
            if (data.exists) {
                showInputError(username, 'Username already exists');
                isValid = false;
            }
        } catch (error) {
            console.error('Error checking username:', error);
        }

        // Password validation
        if (password.value.length < 6) {
            showInputError(password, 'Password must be at least 6 characters');
            isValid = false;
        }

        // Confirm password validation
        if (password.value !== confirmPassword.value) {
            showInputError(confirmPassword, 'Passwords do not match');
            isValid = false;
        }

        return isValid;
    }

    function showInputError(input, message) {
        const formGroup = input.parentElement;
        formGroup.classList.add('error');
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        formGroup.appendChild(errorDiv);
    }

    function clearAllErrors() {
        document.querySelectorAll('.form-group').forEach(group => {
            group.classList.remove('error');
            const errorMessage = group.querySelector('.error-message');
            if (errorMessage) {
                errorMessage.remove();
            }
        });
    }

    registerForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const isValid = await validateForm();
        if (!isValid) {
            return;
        }

        const submitButton = registerForm.querySelector('button[type="submit"]');
        const originalButtonText = submitButton.innerHTML;
        
        // Show loading state
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registering...';

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: username.value,
                    password: password.value
                })
            });

            const data = await response.json();

            if (response.ok) {
                // Hide the form
                registerForm.style.display = 'none';
                
                // Show success message with custom styling
                const successDiv = document.createElement('div');
                successDiv.className = 'success-container';
                successDiv.innerHTML = `
                    <div class="success-icon">
                        <i class="fas fa-check-circle"></i>
                    </div>
                    <h2>Registration Successful!</h2>
                    <p>Your account has been created successfully.</p>
                    <p class="redirect-message">Redirecting to login page in <span id="countdown">3</span> seconds...</p>
                `;
                
                registerForm.parentNode.appendChild(successDiv);

                // Countdown and redirect
                let countdown = 3;
                const countdownElement = document.getElementById('countdown');
                const countdownInterval = setInterval(() => {
                    countdown--;
                    countdownElement.textContent = countdown;
                    if (countdown <= 0) {
                        clearInterval(countdownInterval);
                        window.location.href = 'login.html';
                    }
                }, 1000);
            } else {
                throw new Error(data.error || 'Registration failed. Please try again.');
            }
        } catch (error) {
            showMessage(error.message, 'error');
            submitButton.disabled = false;
            submitButton.innerHTML = originalButtonText;
        }
    });
});

function showMessage(message, type) {
    const existingMessage = document.querySelector('.message');
    if (existingMessage) {
        existingMessage.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;

    const form = document.getElementById('registerForm');
    if (form) {
        form.insertBefore(messageDiv, form.firstChild);
    }
}
