import api from './api';

export async function listUsers() {
    const { data } = await api.get('/admin/users');
    return data.users;
}

export async function getUser(id) {
    const { data } = await api.get(`/admin/users/${id}`);
    return data.user;
}

export async function createUser(payload) {
    const { data } = await api.post('/admin/users', payload);
    return data.user;
}

export async function updateUser(id, payload) {
    const { data } = await api.put(`/admin/users/${id}`, payload);
    return data.user;
}

export async function toggleUserActive(id, isActive) {
    const { data } = await api.patch(`/admin/users/${id}/active`, { is_active: isActive });
    return data.user;
}
