(function () {
    function showLoginError(msg) {
        const errBox = document.getElementById('errorMessage');
        if (errBox) {
            errBox.textContent = msg;
            errBox.style.display = 'block';
        }
    }

    function afterGoogleSuccess(data) {
        const redirectTarget = typeof getSafeRedirect === 'function' ? getSafeRedirect() : null;
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('userData', JSON.stringify(data.user));
        if (redirectTarget) {
            window.location.href = redirectTarget;
        } else if (data.user.role === 'teacher') {
            window.location.href = '/teacher.html';
        } else {
            window.location.href = '/student.html';
        }
    }

    async function initGoogle() {
        if (typeof API_BASE_URL === 'undefined') {
            return;
        }

        const wrap = document.getElementById('googleSignInWrap');
        const divider = document.getElementById('googleDivider');
        if (!wrap) {
            return;
        }

        let cfg;
        try {
            const res = await fetch(`${API_BASE_URL}/auth/config`);
            cfg = await res.json();
        } catch {
            return;
        }

        if (!cfg.success || !cfg.googleEnabled || !cfg.googleClientId) {
            return;
        }

        wrap.hidden = false;
        if (divider) {
            divider.hidden = false;
        }

        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => {
            if (!window.google || !google.accounts || !google.accounts.id) {
                return;
            }

            const w = Math.min(400, Math.max(280, wrap.getBoundingClientRect().width || 340));

            google.accounts.id.initialize({
                client_id: cfg.googleClientId,
                callback: async (response) => {
                    if (!response || !response.credential) {
                        showLoginError('Google did not return a credential.');
                        return;
                    }
                    try {
                        const r = await fetch(`${API_BASE_URL}/auth/google`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ credential: response.credential })
                        });
                        const text = await r.text();
                        let data = {};
                        try {
                            data = text ? JSON.parse(text) : {};
                        } catch {
                            showLoginError('Invalid server response');
                            return;
                        }
                        if (!r.ok || !data.success) {
                            showLoginError(data.message || 'Google sign-in failed');
                            return;
                        }
                        afterGoogleSuccess(data);
                    } catch {
                        showLoginError('Could not reach the server. Try again.');
                    }
                },
                auto_select: false,
                cancel_on_tap_outside: true
            });

            google.accounts.id.renderButton(wrap, {
                type: 'standard',
                theme: 'outline',
                size: 'large',
                text: 'continue_with',
                shape: 'pill',
                width: w,
                logo_alignment: 'left'
            });
        };
        document.head.appendChild(script);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGoogle);
    } else {
        initGoogle();
    }
})();
