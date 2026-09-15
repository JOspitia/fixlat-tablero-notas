import api from './api';

export async function listNotes() {
    const { data } = await api.get('/notes');
    return data.notes;
}

export async function createNote(payload) {
    const { data } = await api.post('/notes', payload);
    return data.note;
}

export async function updateNote(id, payload) {
    // Per HU-02: optimistic locking via updated_at; mismatch returns 409.
    try {
        const { data } = await api.put(`/notes/${id}`, payload);
        return { ok: true, note: data.note };
    } catch (err) {
        if (err.response?.status === 409) {
            // err.response.data.current is the server-side current note
            return { ok: false, current: err.response.data.current };
        }
        throw err;
    }
}

export async function updateNotePosition(id, position_x, position_y) {
    await api.patch(`/notes/${id}/position`, { position_x, position_y });
}

export async function deleteNote(id) {
    await api.delete(`/notes/${id}`);
}
