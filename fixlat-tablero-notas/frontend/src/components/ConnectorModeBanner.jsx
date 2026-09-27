/**
 * HU-06 — Top banner shown while the user is in "add connector mode".
 *
 * Per US AC52 / AC53:
 * - Message: "Selecciona la nota de origen y luego la de destino. ESC para cancelar."
 * - Fixed position at top of canvas, full width, blue accent.
 * - Disappears when mode is inactive.
 */
export default function ConnectorModeBanner({ visible }) {
    if (!visible) return null;

    return (
        <div
            role="status"
            aria-live="polite"
            className="fixed top-0 left-0 right-0 z-50 bg-blue-600 text-white text-sm font-medium py-2.5 px-4 flex items-center justify-center gap-2 shadow-md animate-fade-in"
        >
            <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
            >
                <path d="M10 13a5 5 0 0 0 7 0l3 -3a5 5 0 0 0 -7 -7l-1 1" />
                <path d="M14 11a5 5 0 0 0 -7 0l-3 3a5 5 0 0 0 7 7l1 -1" />
            </svg>
            <span>
                Selecciona la nota de origen y luego la de destino.{' '}
                <kbd className="px-1.5 py-0.5 ml-1 bg-blue-700 border border-blue-500 rounded text-xs font-semibold">
                    ESC
                </kbd>{' '}
                para cancelar.
            </span>
        </div>
    );
}
