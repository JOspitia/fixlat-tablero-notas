import { useMemo } from 'react';
import {
    NOTE_CONNECTOR_COLOR,
    NOTE_CONNECTOR_STROKE_WIDTH_PX,
    NOTE_CONNECTOR_HIT_AREA_PX,
} from '../lib/noteConnectorConstants';
import {
    getNoteCenter,
    getAnchorPoint,
    bezierPath,
    markerFor,
    isDashed,
} from '../lib/noteConnectorGeometry';

/**
 * HU-06 — SVG overlay that renders connector arrows over the notes canvas.
 *
 * Z-order: dots-grid < ConnectorLayer < NoteCards < NoteEditor modal.
 * Per US §A8: connectors live in their own layer; they don't intercept
 * pointer events for the note hit-test (the NoteCards above do that).
 *
 * Each connector is rendered as:
 *   <g data-connector-id={id}>
 *     <path d={...} stroke={...} stroke-dasharray={...} fill="none" marker-end / marker-start />
 *     <path d={...} stroke="transparent" stroke-width={HIT_AREA} fill="none" />  ← hit-area
 *   </g>
 *
 * The second `<path>` is a transparent hit-area stroke widened to
 * NOTE_CONNECTOR_HIT_AREA_PX (12px) so users can click the arrow
 * without pixel-perfect precision (US AC60). The visible stroke is
 * thinner (NOTE_CONNECTOR_STROKE_WIDTH_PX = 2px). Hit-area path is
 * clickable; visible path is purely cosmetic.
 *
 * Geometry recomputes whenever notes OR connectors change:
 *   - Source anchor: getAnchorPoint(sourceNote, destCenter)
 *   - Dest anchor:   getAnchorPoint(destNote, sourceCenter)
 *   - Bezier path:   bezierPath(sourceAnchor, destAnchor)
 *
 * Per US AC94: connectors must re-render during drag so the bezier
 * follows the moving note. That's handled by passing fresh `notes`
 * to this layer on every drag tick (the parent TableroPage already
 * updates `notes` state on drag — this layer reads from it).
 *
 * Notes that no longer exist (defence in depth for cascade race) are
 * silently skipped — the connector will appear broken for one render
 * and then the cascade handler in the parent removes it.
 *
 * @param {{notes: Array, connectors: Array, onConnectorClick: Function}} props
 */
export default function ConnectorLayer({ notes, connectors, onConnectorClick }) {
    // Build a lookup so we don't do .find() per connector per render.
    const notesById = useMemo(() => {
        const map = new Map();
        for (const note of notes) {
            map.set(note.id, note);
        }
        return map;
    }, [notes]);

    // Pre-compute viewBox to cover the full canvas. The canvas itself
    // can scroll (overflow-auto on the parent) so we use a generously-
    // sized viewBox and let the parent scroll. Coordinates inside the
    // SVG are absolute canvas coords (same as NoteCard positions).
    //
    // Width/height 4000x4000 is enough for the foreseeable canvas; the
    // canvas itself has overflow-auto so any out-of-bounds connectors
    // would just be off-screen (and shouldn't exist in normal use).
    return (
        <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10"
            width="4000"
            height="4000"
            viewBox="0 0 4000 4000"
            preserveAspectRatio="xMinYMin meet"
        >
            <defs>
                {/* Single arrowhead marker, reused for both start and end.
                    The fill is NOTE_CONNECTOR_COLOR so it matches the line. */}
                <marker
                    id="connector-arrow"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                >
                    <path d="M 0 0 L 10 5 L 0 10 z" fill={NOTE_CONNECTOR_COLOR} />
                </marker>
            </defs>

            {connectors.map((connector) => {
                const source = notesById.get(connector.source_note_id);
                const dest = notesById.get(connector.destination_note_id);
                if (!source || !dest) return null; // cascade race — skip

                const sourceCenter = getNoteCenter(source);
                const destCenter = getNoteCenter(dest);
                const sourceAnchor = getAnchorPoint(source, destCenter);
                const destAnchor = getAnchorPoint(dest, sourceCenter);
                const path = bezierPath(sourceAnchor, destAnchor);

                const marker = markerFor(connector.style);
                const dashed = isDashed(connector.style);

                // Marker attributes per US AC58 + markerFor():
                //   marker-end   → arrow at destination
                //   marker-start → arrow at source (orient="auto-start-reverse"
                //                   makes the marker point outward from the path)
                //   'both'       → both markers
                //   null         → no markers
                const markerStart = marker === 'start' || marker === 'both'
                    ? 'url(#connector-arrow)' : undefined;
                const markerEnd = marker === 'end' || marker === 'both'
                    ? 'url(#connector-arrow)' : undefined;

                return (
                    <g key={connector.id} data-connector-id={connector.id}>
                        {/* Visible cosmetic line */}
                        <path
                            d={path}
                            stroke={NOTE_CONNECTOR_COLOR}
                            strokeWidth={NOTE_CONNECTOR_STROKE_WIDTH_PX}
                            strokeDasharray={dashed ? '6 4' : undefined}
                            fill="none"
                            markerStart={markerStart}
                            markerEnd={markerEnd}
                            pointerEvents="none"
                        />
                        {/* Transparent hit-area, clickable, opens mini-toolbar */}
                        <path
                            d={path}
                            stroke="transparent"
                            strokeWidth={NOTE_CONNECTOR_HIT_AREA_PX}
                            fill="none"
                            className="pointer-events-auto cursor-pointer"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onConnectorClick) {
                                    onConnectorClick(connector, e);
                                }
                            }}
                        />
                    </g>
                );
            })}
        </svg>
    );
}
