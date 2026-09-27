import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const STATUS_OPTIONS = ['Pendiente', 'En curso', 'Hecho'];

// HU-05 §6.1 — 16 shapes exposed by the backend. Anything outside this
// set (or undefined coming from a stale payload, E16) falls back to
// `rectangle`, matching the DB default.
const SHAPE_OPTIONS = [
    { value: 'rectangle', label: 'Rectángulo' },
    { value: 'rounded_rectangle', label: 'Redondeado' },
    { value: 'diamond', label: 'Diamante' },
    { value: 'triangle', label: 'Triángulo' },
    { value: 'circle', label: 'Círculo' },
    { value: 'ellipse', label: 'Elipse' },
    { value: 'star', label: 'Estrella' },
    { value: 'hexagon', label: 'Hexágono' },
    { value: 'pentagon', label: 'Pentágono' },
    { value: 'octagon', label: 'Octágono' },
    { value: 'arrow', label: 'Flecha' },
    { value: 'parallelogram', label: 'Paralelogramo' },
    { value: 'trapezoid', label: 'Trapecio' },
    { value: 'message_bubble', label: 'Globo de diálogo' },
    { value: 'cloud', label: 'Nube' },
    { value: 'cylinder', label: 'Cilindro' },
];

// HU-05 §6.2 — 7 fonts exposed by the backend.
const FONT_OPTIONS = [
    { value: 'Inter', label: 'Inter' },
    { value: 'Merriweather', label: 'Merriweather (serif)' },
    { value: 'JetBrains Mono', label: 'JetBrains Mono' },
    { value: 'Caveat', label: 'Caveat (manuscrita)' },
    { value: 'Lobster', label: 'Lobster' },
    { value: 'Playfair Display', label: 'Playfair Display' },
    { value: 'Poppins', label: 'Poppins' },
];

const ALIGN_OPTIONS = [
    { value: 'left', label: 'Izquierda' },
    { value: 'center', label: 'Centro' },
    { value: 'right', label: 'Derecha' },
    { value: 'justify', label: 'Justificado' },
];

// Solid pastel colors mapped by status (kept duplicated from NoteCard
// for self-containment; see WU-F2 decision log).
const SOLID_COLOR_BY_STATUS = {
    Pendiente: { bg: 'bg-yellow-100', border: 'border-yellow-200' },
    'En curso': { bg: 'bg-blue-100', border: 'border-blue-200' },
    Hecho: { bg: 'bg-green-100', border: 'border-green-200' },
};
const DEFAULT_COLOR = { bg: 'bg-yellow-100', border: 'border-yellow-200' };
function getStatusColor(status) {
    return SOLID_COLOR_BY_STATUS[status] ?? DEFAULT_COLOR;
}

// Resolver copies from NoteCard.jsx. Kept local so the editor has no
// runtime dep on NoteCard internals (no risk of circular import).
function resolveShape(value) {
    return SHAPE_OPTIONS.some((o) => o.value === value) ? value : 'rectangle';
}

function resolveTextAlign(value) {
    return ALIGN_OPTIONS.some((o) => o.value === value) ? value : 'left';
}

function resolveFontFamily(value) {
    if (typeof value !== 'string' || value.length === 0) {
        return 'system-ui, sans-serif';
    }
    const variableName = `--font-${value.replace(/\s+/g, '-')}`;
    return `var(${variableName}, system-ui, sans-serif)`;
}

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
    const [shape, setShape] = useState(note?.shape ?? 'rectangle');
    const [fontFamily, setFontFamily] = useState(note?.font_family ?? 'Inter');
    const [textAlign, setTextAlign] = useState(note?.text_align ?? 'left');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        setTitle(note?.title ?? '');
        setText(note?.text ?? '');
        setStatus(note?.status ?? 'Pendiente');
        setShape(note?.shape ?? 'rectangle');
        setFontFamily(note?.font_family ?? 'Inter');
        setTextAlign(note?.text_align ?? 'left');
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
                shape,
                font_family: fontFamily,
                text_align: textAlign,
                version: note.version ?? null,
            });
        } finally {
            setSubmitting(false);
        }
    }

    const isNew = note.id === null;

    // Resolved values for the live preview (defence in depth).
    const resolvedShape = resolveShape(shape);
    const resolvedAlign = resolveTextAlign(textAlign);
    const resolvedFontFamily = resolveFontFamily(fontFamily);
    const previewColor = getStatusColor(status);
    const previewSampleText = (text.trim() || 'Vista previa').slice(0, 30);
    const showJustifyMirror = resolvedAlign === 'justify';

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
                        {/* AC76: <textarea> does not visually justify. Mirror the
                            current text into a sibling <div> that DOES justify so
                            the user can preview what `justify` will look like
                            without needing to save first. */}
                        {showJustifyMirror && (
                            <div
                                aria-hidden="true"
                                className="px-3 py-2 text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-md whitespace-pre-wrap break-words"
                                style={{ textAlign: 'justify' }}
                            >
                                {text || 'Vista previa del texto justificado'}
                            </div>
                        )}
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

                    {/* Shape Selector */}
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="note-shape" className="text-xs font-semibold text-gray-700">
                            Forma
                        </label>
                        <select
                            id="note-shape"
                            value={shape}
                            onChange={(e) => setShape(e.target.value)}
                            className="w-full px-3 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-md outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        >
                            {SHAPE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Font Family Selector */}
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="note-font" className="text-xs font-semibold text-gray-700">
                            Fuente
                        </label>
                        <select
                            id="note-font"
                            value={fontFamily}
                            onChange={(e) => setFontFamily(e.target.value)}
                            className="w-full px-3 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-md outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        >
                            {FONT_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Text Alignment Buttons */}
                    <div className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold text-gray-700">Alineación</span>
                        <div className="grid grid-cols-4 gap-2">
                            {ALIGN_OPTIONS.map((opt) => {
                                const isSelected = textAlign === opt.value;
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => setTextAlign(opt.value)}
                                        className={`py-1.5 text-xs font-medium rounded-md border transition-colors ${
                                            isSelected
                                                ? 'bg-blue-50 border-blue-500 text-blue-700 font-semibold'
                                                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Live Preview (AC73/74/75) — mirrors what the saved
                        NoteCard will look like, with the chosen shape, font
                        and text alignment. Static (no drag, no edit). */}
                    <div className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold text-gray-700">Vista previa</span>
                        <div className="flex items-center justify-center bg-gray-50 border border-gray-200 rounded-md p-4 min-h-[180px]">
                            <div
                                aria-hidden="true"
                                className={`note-shape-${resolvedShape} ${previewColor.bg} ${previewColor.border} border shadow-sm p-3 flex flex-col justify-between`}
                                style={{
                                    width: '200px',
                                    minHeight: '120px',
                                    fontFamily: resolvedFontFamily,
                                    textAlign: resolvedAlign,
                                }}
                            >
                                <h4 className="text-[11px] font-bold leading-snug break-words text-gray-900">
                                    {title.trim() || 'Vista previa'}
                                </h4>
                                <p className="text-[10px] leading-snug break-words whitespace-pre-wrap text-gray-800">
                                    {previewSampleText}
                                </p>
                            </div>
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