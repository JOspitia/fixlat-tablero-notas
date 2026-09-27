import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    NOTE_CONNECTOR_STYLE_LIST,
    NOTE_CONNECTOR_STYLE_LABELS,
} from '../lib/noteConnectorConstants';

/**
 * HU-06 — Mini-toolbar that appears when the user clicks a connector.
 *
 * Per US §3 + AC60-AC67:
 * - Renders near the midpoint of the connector (offset by parent).
 * - Has a style selector (6 values, default = current style) and a
 *   "Eliminar conector" button.
 * - Apply-on-change: changing the selector immediately fires
 *   `onStyleChange` (parent does PUT). No "Guardar" button (AC62, A7).
 * - "Eliminar conector" button → `onDelete` (parent does DELETE).
 * - Closes on:
 *   - ESC key (handled via global keydown listener, AC67).
 *   - Click outside the toolbar (AC66).
 *
 * Positioning:
 * - `position` prop is `{x, y}` in canvas coords (the midpoint).
 * - The toolbar positions itself at (x, y) and adds a small offset
 *   so it doesn't overlap the connector line.
 *
 * Portal: renders into document.body so the toolbar floats above
 * everything (z-60) regardless of stacking contexts.
 */
export default function ConnectorMiniToolbar({
    connector,
    position,
    onStyleChange,
    onDelete,
    onClose,
}) {
    const toolbarRef = useRef(null);

    // ESC handler (AC67).
    useEffect(() => {
        function handleKeyDown(e) {
            if (e.key === 'Escape') {
                e.stopPropagation();
                onClose();
            }
        }
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // Click-outside handler (AC66).
    useEffect(() => {
        function handlePointerDown(e) {
            if (toolbarRef.current && !toolbarRef.current.contains(e.target)) {
                onClose();
            }
        }
        // Use 'mousedown' (not 'click') so the close happens before any
        // potential click on another connector's hit-area opens that one.
        // Pointerdown covers touch + mouse uniformly.
        document.addEventListener('pointerdown', handlePointerDown);
        return () => document.removeEventListener('pointerdown', handlePointerDown);
    }, [onClose]);

    // Position is the midpoint of the connector in canvas coords.
    // The toolbar itself uses position:fixed; convert canvas coords by
    // assuming the canvas is positioned at the top-left of the viewport
    // (TableroPage has no global scroll on the page — only the inner
    // canvas scrolls). For simplicity we treat canvas coords as
    // viewport coords; if the page is scrolled the toolbar will be
    // misaligned by the scroll offset. AC acceptable for MVP.
    const offsetY = 30; // below the connector line
    const offsetX = 0;  // centred horizontally on the midpoint

    return createPortal(
        <div
            ref={toolbarRef}
            role="dialog"
            aria-label="Opciones del conector"
            className="fixed z-[60] bg-white border border-gray-200 rounded-md shadow-lg p-3 flex flex-col gap-2 min-w-[220px] animate-fade-in"
            style={{
                top: `${(position?.y ?? 0) + offsetY}px`,
                left: `${(position?.x ?? 0) + offsetX}px`,
                transform: 'translateX(-50%)', // centre on the midpoint horizontally
            }}
            // Stop the click-outside handler from immediately re-firing.
            onPointerDown={(e) => e.stopPropagation()}
        >
            {/* Style selector */}
            <div className="flex flex-col gap-1">
                <label
                    htmlFor={`connector-style-${connector.id}`}
                    className="text-[11px] font-semibold text-gray-700"
                >
                    Estilo
                </label>
                <select
                    id={`connector-style-${connector.id}`}
                    value={connector.style}
                    onChange={(e) => onStyleChange(connector.id, e.target.value)}
                    className="w-full px-2 py-1.5 text-xs text-gray-900 bg-white border border-gray-300 rounded outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer"
                >
                    {NOTE_CONNECTOR_STYLE_LIST.map((style) => (
                        <option key={style} value={style}>
                            {NOTE_CONNECTOR_STYLE_LABELS[style] ?? style}
                        </option>
                    ))}
                </select>
            </div>

            {/* Delete button */}
            <button
                type="button"
                onClick={() => onDelete(connector)}
                className="w-full px-3 py-1.5 text-xs font-semibold text-red-600 bg-white border border-red-200 rounded hover:bg-red-50 transition-colors cursor-pointer"
            >
                Eliminar conector
            </button>
        </div>,
        document.body,
    );
}
