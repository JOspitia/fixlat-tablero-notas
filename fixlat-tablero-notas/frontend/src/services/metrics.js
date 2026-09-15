import api from './api';

export async function fetchMetrics() {
    const { data } = await api.get('/metrics');
    // data: { total, by_status: { Pendiente, 'En curso', Hecho }, last_updated }
    return data;
}
