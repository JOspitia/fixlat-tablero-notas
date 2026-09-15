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

const STATUS_FILTERS = [
    { key: 'ALL', label: 'Todas' },
    { key: 'Pendiente', label: 'Pendiente' },
    { key: 'En curso', label: 'En curso' },
    { key: 'Hecho', label: 'Hecho' },
];

export default function TableroPage() {
    const { error: toastError, success } = useToast();
    const [notes, setNotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null); // null | 'new' | note.id
    const [editorError, setEditorError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL');
    const canvasRef = useRef(null);

    const newNotePositionRef = useRef({ x: 100, y: 100 });

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

    // Filter notes based on search & status filter
    const filteredNotes = useMemo(() => {
        return notes.filter((n) => {
            const matchesSearch =
                !searchQuery.trim() ||
                n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                n.text.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesStatus = selectedStatusFilter === 'ALL' || n.status === selectedStatusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [notes, searchQuery, selectedStatusFilter]);

    // ---- Mutations ----
    const handleCreate = useCallback(() => {
        const newX = 80 + Math.random() * 180;
        const newY = 80 + Math.random() * 180;
        setEditingId('new');
        newNotePositionRef.current = { x: Math.round(newX), y: Math.round(newY) };
    }, []);

    async function handleSave(note) {
        setEditorError(null);
        try {
            if (note.id === null) {
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
                setNotes((prev) => prev.filter((n) => n.id !== note.id));
                success('Nota eliminada');
            } else {
                toastError('No se pudo eliminar la nota.');
            }
        }
    }

    function handleResolveConflict() {
        if (editingNote?.id && editorError?.current) {
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
        if (!delta.x && !delta.y) return;
        const note = notes.find((n) => n.id === id);
        if (!note) return;

        const newX = Math.max(10, note.position_x + delta.x);
        const newY = Math.max(10, note.position_y + delta.y);

        const prevNotes = notes;
        setNotes((curr) => curr.map((n) => (n.id === id ? { ...n, position_x: newX, position_y: newY } : n)));

        notesApi
            .updateNotePosition(id, newX, newY)
            .catch(() => {
                setNotes(prevNotes);
                toastError('No se pudo guardar la nueva posición.');
            });
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full bg-gray-50">
                <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2" />
                <p className="text-xs text-gray-500 font-medium">Cargando lienzo...</p>
            </div>
        );
    }

    return (
        <div className="relative w-full h-full min-h-screen overflow-hidden bg-gray-50">
            {/* Top Toolbar: Clean UI, solid white, border-gray-200 */}
            <div className="absolute top-4 left-6 right-6 z-30 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
                {/* Filter Controls */}
                <div className="pointer-events-auto flex items-center gap-2 bg-white px-3 py-2 rounded-md border border-gray-200 shadow-sm">

                    {/* Filter Pills */}
                    <div className="flex items-center gap-1">
                        {STATUS_FILTERS.map((f) => {
                            const isSelected = selectedStatusFilter === f.key;
                            return (
                                <button
                                    key={f.key}
                                    onClick={() => setSelectedStatusFilter(f.key)}
                                    className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${isSelected
                                        ? 'bg-gray-800 text-white'
                                        : 'text-gray-600 hover:bg-gray-100'
                                        }`}
                                >
                                    {f.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Main Interactive Canvas */}
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                <div
                    ref={canvasRef}
                    className="canvas-dot-grid relative w-full h-full min-h-screen pt-20 pb-24 overflow-auto select-none"
                    style={{ minWidth: '100%', minHeight: '100vh' }}
                >
                    {/* Empty State */}
                    {filteredNotes.length === 0 && !editingNote && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-6 text-center">
                            <p className="text-gray-600 font-bold text-base mb-1">
                                {notes.length === 0 ? 'No hay notas todavía' : 'No hay notas que coincidan'}
                            </p>
                            <p className="text-xs text-gray-500 max-w-xs">
                                Haz clic en el botón azul inferior para crear tu primera nota.
                            </p>
                        </div>
                    )}

                    {/* Note Cards */}
                    {filteredNotes.map((note) => (
                        editingNote?.id === note.id ? null : (
                            <NoteCard
                                key={note.id}
                                note={note}
                                onEdit={(n) => setEditingId(n.id)}
                                onDelete={handleDelete}
                            />
                        )
                    ))}

                    {/* Note Editor Modal */}
                    {editingNote && (
                        <NoteEditor
                            note={editingNote}
                            position={
                                editingNote.id === null
                                    ? newNotePositionRef.current
                                    : { x: editingNote.position_x, y: editingNote.position_y }
                            }
                            onSave={handleSave}
                            onCancel={handleCancel}
                            onDelete={editingNote.id === null ? null : () => handleDelete(editingNote)}
                            error={editorError}
                            onResolveConflict={handleResolveConflict}
                        />
                    )}
                </div>
            </DndContext>

            {/* Rule 4: Floating Action Button (FAB) - Solid Corporate Blue bg-blue-600 hover:bg-blue-700 shadow-lg */}
            <button
                type="button"
                onClick={handleCreate}
                className="fixed bottom-8 right-8 z-40 w-14 h-14 rounded-full bg-blue-600 text-white text-3xl font-light shadow-lg hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center"
                aria-label="Nueva nota"
                title="Crear nueva nota"
            >
                +
            </button>
        </div>
    );
}
