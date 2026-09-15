import { useEffect, useState } from 'react';

/**
 * Inline editor for a note. Renders title / text / status fields + Save / Cancel / Delete.
 * Used as a standalone floating editor in the canvas.
 */
export default function NoteEditor({ note, position, onSave, onCancel, onDelete, error, onResolveConflict }) {
    const [title, setTitle] = useState(note.title ?? '');
    const [text, setText] = useState(note.text ?? '');
    const [status, setStatus] = useState(note.status ?? 'Pendiente');

    // Drift detection: if the prop changes (e.g. after a conflict-resolved reload),
    // resync local state from the new note.
    useEffect(() => {
        setTitle(note.title ?? '');
        setText(note.text ?? '');
        setStatus(note.status ?? 'Pendiente');
    }, [note.id, note.updated_at]);

    const isDirty =
        title !== (note.title ?? '') ||
        text !== (note.text ?? '') ||
        status !== (note.status ?? 'Pendiente');

    function handleSubmit(e) {
        e.preventDefault();
        onSave({
            title: title.trim(),
            text: text.trim() || null,
            status,
            updated_at: note.updated_at,
        });
    }

    const style = {
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: '240px',
        minHeight: '220px',
        background: '#ffffff',
        zIndex: 30,
    };

    return (
        <form
            onSubmit={handleSubmit}
            onPointerDown={(e) => e.stopPropagation()}
            style={style}
            className="absolute rounded-lg p-4 flex flex-col gap-2 shadow-xl border-2 border-blue-500"
        >
            <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título"
                maxLength={120}
                required
                autoFocus
                className="font-semibold text-gray-800 border-b border-gray-200 px-2 py-1 focus:outline-none focus:border-blue-500"
            />

            <textarea
                value={text ?? ''}
                onChange={(e) => setText(e.target.value)}
                placeholder="Texto (opcional)"
                maxLength={2000}
                rows={4}
                className="text-sm text-gray-700 border border-gray-200 rounded px-2 py-1 resize-none focus:outline-none focus:border-blue-500"
            />

            <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="text-sm border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:border-blue-500"
            >
                <option value="Pendiente">Pendiente</option>
                <option value="En curso">En curso</option>
                <option value="Hecho">Hecho</option>
            </select>

            {error && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">
                    <p className="font-semibold mb-1">{error.message}</p>
                    {error.current && (
                        <button
                            type="button"
                            onClick={onResolveConflict}
                            className="underline text-red-800"
                        >
                            Descartar mis cambios y recargar
                        </button>
                    )}
                </div>
            )}

            <div className="mt-auto flex gap-1.5">
                <button
                    type="submit"
                    disabled={!isDirty}
                    className="flex-1 text-xs px-2.5 py-1.5 rounded bg-blue-600 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700 transition"
                >
                    Guardar
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    className="text-xs px-2.5 py-1.5 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
                >
                    Cancelar
                </button>
                {onDelete && (
                    <button
                        type="button"
                        onClick={onDelete}
                        className="text-xs px-2.5 py-1.5 rounded bg-red-50 text-red-700 hover:bg-red-100 transition"
                    >
                        Eliminar
                    </button>
                )}
            </div>
        </form>
    );
}
