import axios from 'axios';

// Per HU-01 §3 A2 + A7 + A10: Bearer tokens via sessionStorage, JSON headers,
// 10s timeout, automatic auth header injection, 401/403 -> /login redirect.
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
    timeout: 10000,
    headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
    },
});

// Request interceptor: attach Bearer token if present.
api.interceptors.request.use((config) => {
    const token = sessionStorage.getItem('auth.token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Response interceptor: on 401 or 403, clear session and redirect to /login.
// 403 with inactivation message handled by AuthContext.
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status;

        if (status === 401) {
            sessionStorage.removeItem('auth.token');
            // Avoid redirect loops if we're already on /login
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
        // 403 (inactive user) is handled by AuthContext via the error message.
        return Promise.reject(error);
    }
);

export default api;
