import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const STATUS_OPTIONS = ['Pendiente', 'En curso', 'Hecho'];

export default function NoteEditor({
    note,
    position,
    onSave,
    onCancel,
    onDelete,
    error,
    onResolveConflict,
}) {
    const [title, setTitle] = useState(note?.title ?? '');
    const [text, setText] = useState(note?.text ?? '');
    const [status, setStatus] = useState(note?.status ?? 'Pendiente');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        setTitle(note?.title ?? '');
        setText(note?.text ?? '');
        setStatus(note?.status ?? 'Pendiente');
    }, [note]);

    async function handleSubmit(e) {
        e.preventDefault();
        if (submitting) return;
        setSubmitting(true);
        try {
            await onSave({
                id: note.id,
                title: title.trim(),
                text: text.trim(),
                status,
                updated_at: note.updated_at ?? null,
            });
        } finally {
            setSubmitting(false);
        }
    }

    const isNew = note.id === null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-fade-in">
            <div className="bg-white rounded-md shadow-2xl border border-gray-200 w-full max-w-md p-6 flex flex-col gap-4">
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                    <h2 className="text-base font-bold text-gray-900">
                        {isNew ? 'Nueva nota' : 'Editar nota'}
                    </h2>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="text-gray-400 hover:text-gray-600 text-lg leading-none p-1"
                        aria-label="Cerrar"
                    >
                        ✕
                    </button>
                </div>

                {/* Conflict Alert Banner */}
                {error?.current && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-900 text-xs flex flex-col gap-2">
                        <p className="font-semibold">{error.message}</p>
                        <button
                            type="button"
                            onClick={onResolveConflict}
                            className="self-start px-2.5 py-1 bg-white border border-amber-300 text-amber-800 font-semibold rounded hover:bg-amber-100 transition-colors"
                        >
                            Cargar versión del servidor
                        </button>
                    </div>
                )}

                {/* Validation Error Banner */}
                {error && !error.current && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-800 text-xs font-medium">
                        {error.message}
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    {/* Title */}
                    <div className="flex flex-col gap-1">
                        <label htmlFor="note-title" className="text-xs font-semibold text-gray-700">
                            Título
                        </label>
                        <input
                            id="note-title"
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            maxLength={255}
                            placeholder="Título de la nota..."
                            autoFocus
                            className="w-full px-3 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-md outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder-gray-400"
                        />
                    </div>

                    {/* Text / Content */}
                    <div className="flex flex-col gap-1">
                        <label htmlFor="note-text" className="text-xs font-semibold text-gray-700">
                            Contenido <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            id="note-text"
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            required
                            maxLength={2000}
                            rows={4}
                            placeholder="Escribe el contenido de la nota..."
                            className="w-full px-3 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-md outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder-gray-400 resize-none"
                        />
                    </div>

                    {/* Status Selector Buttons */}
                    <div className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold text-gray-700">Estado</span>
                        <div className="grid grid-cols-3 gap-2">
                            {STATUS_OPTIONS.map((st) => {
                                const isSelected = status === st;
                                return (
                                    <button
                                        key={st}
                                        type="button"
                                        onClick={() => setStatus(st)}
                                        className={`py-1.5 text-xs font-medium rounded-md border transition-colors ${
                                            isSelected
                                                ? 'bg-blue-50 border-blue-500 text-blue-700 font-semibold'
                                                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                                        }`}
                                    >
                                        {st}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Footer Action Buttons */}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-200 mt-1">
                        {!isNew && onDelete ? (
                            <button
                                type="button"
                                onClick={onDelete}
                                className="px-3 py-2 text-xs font-semibold text-red-600 bg-white border border-gray-200 hover:bg-red-50 rounded-md transition-colors"
                            >
                                Eliminar
                            </button>
                        ) : (
                            <div />
                        )}

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onCancel}
                                disabled={submitting}
                                className="px-3.5 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-100 transition-colors disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={submitting || !text.trim()}
                                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm transition-colors disabled:opacity-50"
                            >
                                {submitting ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}
