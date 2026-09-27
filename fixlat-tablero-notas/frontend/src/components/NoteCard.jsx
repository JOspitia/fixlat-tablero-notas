import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

// Solid pastel colors mapped by status:
// Pendiente -> Amarillo, En curso -> Azul, Hecho -> Verde
const SOLID_COLOR_BY_STATUS = {
    Pendiente: { bg: 'bg-yellow-100', border: 'border-yellow-200' },
    'En curso': { bg: 'bg-blue-100', border: 'border-blue-200' },
    Hecho: { bg: 'bg-green-100', border: 'border-green-200' },
};

const DEFAULT_COLOR = { bg: 'bg-yellow-100', border: 'border-yellow-200' };

function getStatusColor(status) {
    return SOLID_COLOR_BY_STATUS[status] ?? DEFAULT_COLOR;
}

// HU-05 §6.1 — 16 shapes exposed by the backend. Anything outside this
// set (or undefined coming from a stale payload, E16) falls back to
// `rectangle`, matching the DB default.
const ALLOWED_SHAPES = new Set([
    'rectangle',
    'rounded_rectangle',
    'diamond',
    'triangle',
    'circle',
    'ellipse',
    'star',
    'hexagon',
    'pentagon',
    'octagon',
    'arrow',
    'parallelogram',
    'trapezoid',
    'message_bubble',
    'cloud',
    'cylinder',
]);

const ALLOWED_TEXT_ALIGNS = new Set(['left', 'center', 'right', 'justify']);

function resolveShape(value) {
    return ALLOWED_SHAPES.has(value) ? value : 'rectangle';
}

function resolveTextAlign(value) {
    return ALLOWED_TEXT_ALIGNS.has(value) ? value : 'left';
}

// HU-05 §6.2 — map the backend literal to the CSS custom property
// declared in `src/index.css`. Anything not in the catalog (defence
// in depth, E16) falls back to `system-ui` so the note stays legible.
function resolveFontFamily(value) {
    if (typeof value !== 'string' || value.length === 0) {
        return 'system-ui, sans-serif';
    }
    const variableName = `--font-${value.replace(/\s+/g, '-')}`;
    return `var(${variableName}, system-ui, sans-serif)`;
}

export default function NoteCard({
    note,
    onEdit,
    onDelete,
    isConnectorSource = false,
    isConnectorModeActive = false,
}) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `note-${note.id}`,
    });

    const shapeClass = `note-shape-${resolveShape(note.shape)}`;
    const inlineFontFamily = resolveFontFamily(note.font_family);
    const inlineTextAlign = resolveTextAlign(note.text_align);

    const style = {
        position: 'absolute',
        left: `${note.position_x}px`,
        top: `${note.position_y}px`,
        width: '240px',
        minHeight: '160px',
        fontFamily: inlineFontFamily,
        textAlign: inlineTextAlign,
        transform: CSS.Translate.toString(transform),
        touchAction: 'none',
        zIndex: isDragging ? 50 : 10,
    };

    const colorConfig = getStatusColor(note.status);

    return (
        <div
            ref={setNodeRef}
            style={style}
            data-shape={resolveShape(note.shape)}
            {...attributes}
            {...listeners}
            className={`absolute rounded-md p-4 shadow-md border ${colorConfig.bg} ${colorConfig.border} ${shapeClass} flex flex-col justify-between select-none cursor-grab active:cursor-grabbing transition-shadow ${
                isDragging ? 'opacity-90 shadow-2xl scale-105 z-50' : ''
            } ${
                isConnectorSource
                    ? 'outline outline-[3px] outline-blue-600 outline-offset-2 z-30'
                    : ''
            } ${
                isConnectorModeActive && !isConnectorSource
                    ? 'cursor-crosshair'
                    : ''
            }`}
        >
            {/* Header: Title & Status Badge */}
            <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-gray-900 font-bold text-sm leading-snug break-words flex-1">
                        {note.title || <span className="italic font-normal text-gray-400">Sin título</span>}
                    </h3>
                    <span className="px-2.5 py-0.5 text-[11px] font-medium text-gray-700 bg-white border border-gray-200 rounded-full shrink-0">
                        {note.status}
                    </span>
                    {isConnectorSource && (
                        <span className="px-2.5 py-0.5 text-[11px] font-semibold text-white bg-blue-600 border border-blue-700 rounded-full shrink-0">
                            Origen
                        </span>
                    )}
                </div>

                {/* Body Text */}
                {note.text && (
                    <p className="text-gray-800 text-xs leading-relaxed break-words whitespace-pre-wrap mb-4">
                        {note.text}
                    </p>
                )}
            </div>

            {/* Footer Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200/50 mt-auto">
                <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                        e.stopPropagation();
                        onEdit(note);
                    }}
                    className="px-2.5 py-1 bg-white text-gray-700 text-xs font-semibold border border-gray-200 rounded hover:bg-gray-100 transition-colors cursor-pointer"
                >
                    Editar
                </button>
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete(note);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="px-2.5 py-1 bg-white text-red-600 text-xs font-semibold border border-gray-200 rounded hover:bg-red-50 transition-colors cursor-pointer"
                >
                    Eliminar
                </button>
            </div>
        </div>
    );
}
