const redirectTarget = getSafeRedirect();

if (isLoggedIn()) {
    const user = getUserData();

    if (redirectTarget) {
        window.location.href = redirectTarget;
    } else if (user && user.role === 'teacher') {
        window.location.href = '/teacher.html';
    } else {
        window.location.href = '/student.html';
    }
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const loginBtn = document.getElementById('loginBtn');
    const errorMessage = document.getElementById('errorMessage');

    loginBtn.disabled = true;
    loginBtn.textContent = 'Signing in...';
    errorMessage.style.display = 'none';

    try {
        const response = await apiCall('/auth/login', 'POST', { email, password });

        if (response.success) {
            localStorage.setItem('authToken', response.token);
            localStorage.setItem('userData', JSON.stringify(response.user));

            if (redirectTarget) {
                window.location.href = redirectTarget;
            } else if (response.user.role === 'teacher') {
                window.location.href = '/teacher.html';
            } else {
                window.location.href = '/student.html';
            }
        }
    } catch (error) {
        errorMessage.textContent = error.message || 'Login failed. Please try again.';
        errorMessage.style.display = 'block';
        loginBtn.disabled = false;
        loginBtn.textContent = 'Sign In';
    }
});
