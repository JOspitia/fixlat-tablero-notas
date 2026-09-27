import api from './api';

/**
 * HU-06 — connectors API client.
 *
 * Wire contract from `documents/HU-06-conectores.md` §6.6:
 *   - Single-resource responses wrap as `{connector: {...}}`.
 *   - Collection responses wrap as `{connectors: [...]}`.
 *   - DELETE returns 204 with no body.
 *
 * Per US §3 A11 (auth transversal heredado de HU-01): all 5 endpoints
 * require a Sanctum Bearer token + active user. The api.js request
 * interceptor attaches the token automatically.
 *
 * The client functions intentionally return ONLY the inner payload
 * (the unwrapped `connectors[]` or `connector{}`) so callers don't have
 * to dig through response wrappers. `deleteConnector` returns nothing
 * (the backend response is 204 empty).
 */

export async function listConnectors() {
    const { data } = await api.get('/notes/connectors');
    return data.connectors;
}

export async function listConnectorsForNote(noteId) {
    const { data } = await api.get(`/notes/${noteId}/connectors`);
    return data.connectors;
}

export async function createConnector(sourceNoteId, payload) {
    // payload: { destination_note_id, style? }
    const { data } = await api.post(`/notes/${sourceNoteId}/connectors`, payload);
    return data.connector;
}

export async function updateConnector(connectorId, payload) {
    // payload: { style }
    const { data } = await api.put(`/note-connectors/${connectorId}`, payload);
    return data.connector;
}

export async function deleteConnector(connectorId) {
    await api.delete(`/note-connectors/${connectorId}`);
    // No return — backend responds 204 with empty body.
}
