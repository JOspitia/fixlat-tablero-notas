import api from './api';

export async function login(email, password) {
    // Backend uses form-urlencoded (PHP server dev quirk with JSON bodies).
    // Use URLSearchParams so the request goes out as application/x-www-form-urlencoded.
    const body = new URLSearchParams({ email, password });
    const { data } = await api.post('/auth/login', body, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return data; // { user, token }
}

export async function logout() {
    await api.post('/auth/logout');
}

export async function me() {
    const { data } = await api.get('/auth/me');
    return data.user;
}
