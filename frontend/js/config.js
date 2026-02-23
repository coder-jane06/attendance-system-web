const API_BASE_URL = `${window.location.origin}/api`;

function getAuthToken() {
    return localStorage.getItem('authToken');
}

function getUserData() {
    const userData = localStorage.getItem('userData');
    return userData ? JSON.parse(userData) : null;
}

function isLoggedIn() {
    return Boolean(getAuthToken());
}

function getSafeRedirect() {
    const redirect = new URLSearchParams(window.location.search).get('redirect');

    if (!redirect) {
        return null;
    }

    if (!redirect.startsWith('/') || redirect.startsWith('//')) {
        return null;
    }

    return redirect;
}

function escapeHtml(value) {
    if (value === null || value === undefined) {
        return '';
    }

    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function apiCall(endpoint, method = 'GET', data = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json'
        }
    };

    const token = getAuthToken();
    if (token) {
        options.headers.Authorization = `Bearer ${token}`;
    }

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        options.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || 'API request failed');
        }

        return result;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    window.location.href = '/login.html';
}

function requireAuth(requiredRole = null) {
    if (!isLoggedIn()) {
        window.location.href = '/login.html';
        return false;
    }

    const user = getUserData();

    if (!user) {
        logout();
        return false;
    }

    if (requiredRole && user.role !== requiredRole) {
        alert('Unauthorized access');
        logout();
        return false;
    }

    return true;
}
