import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

const COLOR_BY_STATUS = {
    Pendiente: '#FFF275', // yellow
    'En curso': '#90E0EF', // blue
    Hecho: '#80ED99',     // green
};
const DEFAULT_COLOR = '#FFF275';

export function statusColor(status) {
    return COLOR_BY_STATUS[status] ?? DEFAULT_COLOR;
}

/**
 * Read-only card (used when not in editing mode).
 */
export default function NoteCard({ note, onEdit, onDelete }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `note-${note.id}`,
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        left: `${note.position_x}px`,
        top: `${note.position_y}px`,
        width: '220px',
        minHeight: '180px',
        zIndex: isDragging ? 50 : 10,
        background: statusColor(note.status),
        boxShadow: isDragging
            ? '0 12px 28px rgba(0,0,0,0.25)'
            : '0 2px 8px rgba(0,0,0,0.10)',
        transition: isDragging ? 'none' : 'box-shadow 120ms ease',
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="absolute rounded-lg p-4 flex flex-col gap-2 select-none cursor-grab"
            {...attributes}
            {...listeners}
        >
            <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-gray-800 leading-tight line-clamp-2 flex-1">
                    {note.title || <span className="italic text-gray-500">(sin título)</span>}
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/60 text-gray-700 whitespace-nowrap">
                    {note.status}
                </span>
            </div>

            {note.text && (
                <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-4">{note.text}</p>
            )}

            <div className="mt-auto pt-2 flex gap-1.5">
                <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                        e.stopPropagation();
                        onEdit(note);
                    }}
                    className="text-xs px-2.5 py-1 rounded bg-white/70 text-gray-700 hover:bg-white transition cursor-pointer"
                >
                    Editar
                </button>
                <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete(note);
                    }}
                    className="text-xs px-2.5 py-1 rounded bg-red-100/70 text-red-700 hover:bg-red-100 transition cursor-pointer"
                >
                    Eliminar
                </button>
            </div>
        </div>
    );
}
