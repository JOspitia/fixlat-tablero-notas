/**
 * HU-06 — constants for note connectors (frontend).
 *
 * Mirror of the backend constants in:
 * - backend/app/Models/NoteConnector.php (ALLOWED_STYLES, DEFAULT_STYLE, MULTIPLICITY_CAP)
 * - backend/database/migrations/..._create_note_connectors_table.php (CHECK constraints)
 * - backend/app/Http/Requests/StoreNoteConnectorRequest.php (in: rules)
 *
 * Single source of truth per axis. If the backend adds a new style, both
 * ends must be updated together (CHECK on pgsql + PHP constant + JS
 * constant). Until a build-time check exists, keep the three lists in
 * sync manually.
 *
 * Per US §6.3, none of these are env vars — all hardcoded constants.
 */

// Catalog of 6 allowed connector styles. Order matters for the mini-toolbar
// dropdown; default is first.
export const NOTE_CONNECTOR_STYLE_LIST = [
    'solid_arrow_end',
    'dashed_arrow_end',
    'solid_no_arrow',
    'dashed_no_arrow',
    'arrow_both_solid',
    'solid_arrow_start',
];

// Friendly Spanish labels for the mini-toolbar dropdown. Values stay as the
// English literals so they match the backend CHECK / constants.
export const NOTE_CONNECTOR_STYLE_LABELS = {
    solid_arrow_end: 'Flecha continua al final',
    dashed_arrow_end: 'Flecha discontinua al final',
    solid_no_arrow: 'Línea continua sin flecha',
    dashed_no_arrow: 'Línea discontinua sin flecha',
    arrow_both_solid: 'Bidireccional continua',
    solid_arrow_start: 'Flecha continua al inicio',
};

export const NOTE_CONNECTOR_DEFAULT_STYLE = 'solid_arrow_end';

// Multiplicity cap (HU-06 decision #7). Counted on the UNORDERED pair {A, B}.
// Backend enforces; frontend uses this for UX warnings only (we don't block
// creation client-side — the backend is the source of truth).
export const NOTE_CONNECTOR_MAX_PER_PAIR = 6;

// SVG path style constants
export const NOTE_CONNECTOR_COLOR = '#2563EB';
export const NOTE_CONNECTOR_STROKE_WIDTH_PX = 2;

// Bezier control point perpendicular offset. Per US §6.3 A13: if the distance
// between anchors is less than (offset * 2), the offset is clamped to
// distance/2.
export const NOTE_CONNECTOR_BEZIER_OFFSET_PX = 80;

// FAB specs
export const CONNECTOR_FAB_BG_COLOR = '#2563EB';
export const CONNECTOR_FAB_DIAMETER_PX = 56;
export const CONNECTOR_FAB_OFFSET_PX = 24;

// Geometry: notes are 220x220 (HU-02). The half-size and center offset are
// used by every shape resolver.
export const NOTE_BOUNDING_BOX_SIZE = 220;
export const NOTE_CENTER_OFFSET = NOTE_BOUNDING_BOX_SIZE / 2; // 110

// Click hit-area width for an existing connector's path. Larger than the
// stroke so users can click the arrow without pixel-perfect precision.
export const NOTE_CONNECTOR_HIT_AREA_PX = 12;

// Per-flow timing
export const NOTE_CONNECTOR_MODE_EXIT_DELAY_MS = 300; // Flow 1, step 13
