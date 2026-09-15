import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useToast } from '../contexts/ToastContext';
import NoteCard from '../components/NoteCard';
import NoteEditor from '../components/NoteEditor';
import * as notesApi from '../services/notes';

const NEW_NOTE_DEFAULTS = {
    title: '',
    text: '',
    status: 'Pendiente',
    position_x: 100,
    position_y: 100,
};

export default function TableroPage() {
    const { error: toastError, success } = useToast();
    const [notes, setNotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null); // null | 'new' | note.id
    const [editorError, setEditorError] = useState(null);
    const canvasRef = useRef(null);

    // We need the current bounds of the canvas (in DOM px) so we can clamp note
    // drag positions. Initialized after mount.
    const canvasBoundsRef = useRef({ width: 0, height: 0 });

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

    // Initial load
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const list = await notesApi.listNotes();
                if (!cancelled) setNotes(list);
            } catch (err) {
                if (!cancelled) toastError('No se pudieron cargar las notas.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [toastError]);

    const editingNote = useMemo(() => {
        if (editingId === 'new') {
            return { id: null, ...NEW_NOTE_DEFAULTS, updated_at: null };
        }
        if (editingId) {
            return notes.find((n) => n.id === editingId) ?? null;
        }
        return null;
    }, [editingId, notes]);

    // ---- Mutations ----
    const handleCreate = useCallback(() => {
        const newX = 60 + Math.random() * 200;
        const newY = 60 + Math.random() * 200;
        // We open the editor in "new" mode with a fresh position; if the user
        // confirms Save, we'll POST and the backend will persist those coordinates.
        setEditingId('new');
        // The editor's position is its own left/top prop, independent of notes state.
        // We pass position via a transient slot below.
        setNotes((prev) => prev); // no-op to keep flow obvious
        // Stash new-position via a ref on editingNote computed below
        newNotePositionRef.current = { x: newX, y: newY };
    }, []);

    const newNotePositionRef = useRef({ x: 100, y: 100 });

    async function handleSave(note) {
        setEditorError(null);
        try {
            if (note.id === null) {
                // Create
                const created = await notesApi.createNote({
                    title: note.title,
                    text: note.text,
                    status: note.status,
                    position_x: newNotePositionRef.current.x,
                    position_y: newNotePositionRef.current.y,
                });
                setNotes((prev) => [...prev, created]);
                success('Nota creada');
            } else {
                // Update
                const result = await notesApi.updateNote(note.id, {
                    title: note.title,
                    text: note.text,
                    status: note.status,
                    updated_at: note.updated_at,
                });
                if (result.ok) {
                    setNotes((prev) => prev.map((n) => (n.id === note.id ? result.note : n)));
                    success('Nota actualizada');
                } else {
                    // 409 Conflict
                    setEditorError({
                        message: 'La nota fue modificada por otro usuario. Recarga e intenta de nuevo.',
                        current: result.current,
                    });
                    return;
                }
            }
            setEditingId(null);
        } catch (err) {
            const status = err.response?.status;
            if (status === 422) {
                const errors = err.response?.data?.errors;
                const first = errors ? Object.values(errors)[0]?.[0] : null;
                setEditorError({ message: first ?? 'Datos inválidos.' });
            } else {
                toastError('No se pudo guardar la nota.');
            }
        }
    }

    async function handleDelete(note) {
        const ok = window.confirm('¿Eliminar esta nota?');
        if (!ok) return;
        try {
            await notesApi.deleteNote(note.id);
            setNotes((prev) => prev.filter((n) => n.id !== note.id));
            if (editingId === note.id) setEditingId(null);
            success('Nota eliminada');
        } catch (err) {
            if (err.response?.status === 404) {
                // Already gone server-side
                setNotes((prev) => prev.filter((n) => n.id !== note.id));
                success('Nota eliminada');
            } else {
                toastError('No se pudo eliminar la nota.');
            }
        }
    }

    function handleResolveConflict() {
        if (editingNote?.id && editorError?.current) {
            // Replace local note with server current.
            setNotes((prev) => prev.map((n) => (n.id === editingNote.id ? editorError.current : n)));
            setEditorError(null);
        }
    }

    function handleCancel() {
        setEditingId(null);
        setEditorError(null);
    }

    function handleDragEnd(event) {
        const { active, delta } = event;
        const id = parseInt(String(active.id).replace('note-', ''), 10);
        if (!delta.x && !delta.y) return; // No movement, no-op
        const note = notes.find((n) => n.id === id);
        if (!note) return;

        const newX = Math.max(0, note.position_x + delta.x);
        const newY = Math.max(0, note.position_y + delta.y);

        // Optimistic update
        const prevNotes = notes;
        setNotes((curr) => curr.map((n) => (n.id === id ? { ...n, position_x: newX, position_y: newY } : n)));

        notesApi
            .updateNotePosition(id, newX, newY)
            .catch(() => {
                // Rollback on failure
                setNotes(prevNotes);
                toastError('No se pudo guardar la nueva posición.');
            });
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            </div>
        );
    }

    return (
        <div className="relative h-full">
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                {/* The canvas covers the full main area (100% × 100%).
                    Notes are absolutely positioned inside; if they go off-screen,
                    the main container's overflow-auto lets the user scroll. */}
                <div
                    ref={canvasRef}
                    style={{
                        position: 'relative',
                        width: '100%',
                        height: '100%',
                        minHeight: '100vh',
                        backgroundColor: '#F5F5F7',
                        backgroundImage:
                            'radial-gradient(circle, #c8c8d0 1px, transparent 1px)',
                        backgroundSize: '24px 24px',
                        backgroundPosition: '0 0',
                    }}
                >
                    {notes.length === 0 && !editingNote && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <p className="text-gray-500 text-lg">No hay notas todavía. Click "+" para crear la primera.</p>
                        </div>
                    )}

                    {notes.map((note) => (
                        editingNote?.id === note.id ? null : (
                            <NoteCard
                                key={note.id}
                                note={note}
                                onEdit={(n) => setEditingId(n.id)}
                                onDelete={handleDelete}
                            />
                        )
                    ))}

                    {editingNote && (
                        <NoteEditor
                            note={editingNote}
                            position={editingNote.id === null ? newNotePositionRef.current : { x: editingNote.position_x, y: editingNote.position_y }}
                            onSave={handleSave}
                            onCancel={handleCancel}
                            onDelete={editingNote.id === null ? null : () => handleDelete(editingNote)}
                            error={editorError}
                            onResolveConflict={handleResolveConflict}
                        />
                    )}
                </div>
            </DndContext>

            {/* Floating "+" button to create a new note */}
            <button
                type="button"
                onClick={handleCreate}
                className="fixed bottom-8 right-8 z-40 w-14 h-14 rounded-full bg-blue-600 text-white text-3xl font-light shadow-lg hover:bg-blue-700 hover:scale-105 transition-transform flex items-center justify-center"
                aria-label="Nueva nota"
            >
                +
            </button>
        </div>
    );
}
