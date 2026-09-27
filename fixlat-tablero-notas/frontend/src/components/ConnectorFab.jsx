import {
    CONNECTOR_FAB_BG_COLOR,
    CONNECTOR_FAB_DIAMETER_PX,
    CONNECTOR_FAB_OFFSET_PX,
} from '../lib/noteConnectorConstants';

/**
 * HU-06 — Floating Action Button that activates "add connector mode".
 *
 * Per US §3 + AC51/AC52:
 * - Bottom-right of the canvas, ABOVE the note-creation FAB.
 * - 56px diameter, color #2563EB, 24px from the viewport edges.
 * - Clicking it activates the mode; the parent TableroPage handles
 *   the state machine.
 *
 * Visual states (controlled by the `active` prop):
 * - Inactive: subtle shadow, normal blue.
 * - Active: brighter shadow / scale-up to indicate mode is on.
 *
 * Accessibility:
 * - aria-label="Modo conector" + title tooltip.
 * - Disabled when `disabled` prop is true (e.g. while another note
 *   editor is open — US AC59a).
 *
 * The icon is a chain/link glyph (two interlocking ovals). We render
 * it inline as an SVG to avoid pulling an icon library.
 */
export default function ConnectorFab({ active, disabled, onClick }) {
    const baseClasses =
        'fixed z-40 flex items-center justify-center rounded-full text-white transition-all';
    const colorClasses = active
        ? 'shadow-2xl scale-110 ring-4 ring-blue-200'
        : 'shadow-lg hover:shadow-xl hover:scale-105';
    const disabledClasses = disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer';

    const style = {
        bottom: `${CONNECTOR_FAB_OFFSET_PX + CONNECTOR_FAB_DIAMETER_PX + 12}px`, // above the note FAB
        right: `${CONNECTOR_FAB_OFFSET_PX}px`,
        width: `${CONNECTOR_FAB_DIAMETER_PX}px`,
        height: `${CONNECTOR_FAB_DIAMETER_PX}px`,
        backgroundColor: CONNECTOR_FAB_BG_COLOR,
    };

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label="Modo conector"
            aria-pressed={active}
            title={active ? 'Modo conector activo (ESC para salir)' : 'Crear conector'}
            className={`${baseClasses} ${colorClasses} ${disabledClasses}`}
            style={style}
        >
            {/* Chain / link icon, inline SVG */}
            <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
            >
                {/* Two interlocking ovals forming a link glyph */}
                <path d="M10 13a5 5 0 0 0 7 0l3 -3a5 5 0 0 0 -7 -7l-1 1" />
                <path d="M14 11a5 5 0 0 0 -7 0l-3 3a5 5 0 0 0 7 7l1 -1" />
            </svg>
        </button>
    );
}
