const configuredApiBase = window.__API_BASE_URL || localStorage.getItem('apiBaseUrl');
const inferredApiBase = (window.location.port === '5000' || window.location.port === '5443')
    ? `${window.location.origin}/api`
    : `${window.location.protocol}//${window.location.hostname}:5000/api`;
const API_BASE_URL = (configuredApiBase || inferredApiBase).replace(/\/$/, '');

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
        
        let result = {};
        const text = await response.text();
        
        if (text) {
            try {
                result = JSON.parse(text);
            } catch (jsonErr) {
                console.warn('Response was not valid JSON:', text.substring(0, 100));
                // Fallback for non-JSON error pages (like HTML 404s)
                result = { success: false, message: response.ok ? 'Invalid response format' : `Server error (${response.status})` };
            }
        }

        if (!response.ok) {
            throw new Error(result.message || `API request failed with status ${response.status}`);
        }

        return result;
    } catch (error) {
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error('Network error: Unable to reach the server. Please check your connection.');
        }
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
