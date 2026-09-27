/**
 * HU-06 — geometry helpers for rendering connectors between notes.
 *
 * Public API (5 functions, all pure):
 *   - getNoteCenter(note)                  -> { x, y }
 *   - getAnchorPoint(note, otherCenter)    -> { x, y }
 *   - bezierPath(source, destination)      -> SVG path "d" string
 *   - markerFor(style)                     -> 'start' | 'end' | 'both' | null
 *   - isDashed(style)                      -> boolean
 *
 * Notes are positioned absolutely at (note.position_x, note.position_y)
 * with a fixed 220×220 bounding box (HU-02 §A2). The visual shape is
 * rendered via CSS clip-path from `index.css` (HU-05 WU-F1), which clips
 * the visible silhouette but NOT the hitbox — the hitbox stays the
 * rectangular 220×220 box.
 *
 * Coordinate space: positions are absolute pixels in the canvas coordinate
 * system, same as the NoteCard render.
 *
 * Reference: documents/HU-06-conectores.md §6.2 (helpers spec) + AC68-AC85a
 * (acceptance criteria for each shape).
 */

import {
    NOTE_CENTER_OFFSET,
    NOTE_CONNECTOR_BEZIER_OFFSET_PX,
    NOTE_CONNECTOR_DEFAULT_STYLE,
} from './noteConnectorConstants';

// ---------------------------------------------------------------------------
// Public: getNoteCenter
// ---------------------------------------------------------------------------

/**
 * Centre of a note's bounding box in canvas coords.
 * Per US §6.2: x = position_x + 110, y = position_y + 110.
 */
export function getNoteCenter(note) {
    return {
        x: note.position_x + NOTE_CENTER_OFFSET,
        y: note.position_y + NOTE_CENTER_OFFSET,
    };
}

// ---------------------------------------------------------------------------
// Public: getAnchorPoint
// ---------------------------------------------------------------------------

/**
 * First intersection of the ray (note.center → otherCenter) with note's
 * visual silhouette (or bounding box fallback).
 *
 * Algorithm per US §6.2:
 *   1. Resolve note.shape into one of the 16 canonical values (defence in
 *      depth: if the backend ever returns a stale/unknown shape, fall back
 *      to rectangle — matches NoteCard's resolveShape).
 *   2. For the resolved shape, delegate to a per-shape edgeIntersect
 *      resolver that returns the parametric distance `t` along the ray at
 *      which the silhouette boundary is crossed (smallest positive t).
 *   3. Convert (t, otherCenter) back to canvas coordinates.
 *   4. If the resolver returns null (e.g. ray doesn't cross the silhouette
 *      because otherCenter is INSIDE the bounding box), fall back to the
 *      bounding-box border in the direction of otherCenter.
 *
 * Implementation notes:
 *   - All shapes use the same 220×220 bounding box.
 *   - Polygons (diamond, star, hexagon, pentagon, octagon, arrow,
 *     parallelogram, trapezoid, message_bubble, cloud, cylinder) reuse
 *     a generic `polygonEdgeIntersect` helper that walks the polygon edges
 *     and finds the first intersection with the ray.
 *   - circle / ellipse use ray-circle / ray-ellipse analytical formulas.
 *   - rectangle / rounded_rectangle use the trivial bbox edge intersect.
 *
 * @param {object} note  The note whose silhouette we're intersecting.
 * @param {{x:number,y:number}} otherCenter  Centre of the OTHER note.
 * @returns {{x:number,y:number}} The anchor point in canvas coords.
 */
export function getAnchorPoint(note, otherCenter) {
    const center = getNoteCenter(note);
    const ray = {
        x: otherCenter.x - center.x,
        y: otherCenter.y - center.y,
    };

    // Avoid division-by-zero / NaN when the other centre equals ours.
    // Caller should normally pre-check distance >= 4px (AC85a), but
    // defence-in-depth: if ray length is zero, return the bbox edge in
    // an arbitrary stable direction (right).
    const rayLen = Math.hypot(ray.x, ray.y);
    if (rayLen < 1e-6) {
        return { x: center.x + NOTE_CENTER_OFFSET, y: center.y };
    }

    const resolver = SHAPE_RESOLVERS[resolveShape(note.shape)] || SHAPE_RESOLVERS.rectangle;

    // Resolver returns `t` along the ray (P = centre + t * ray) where the
    // silhouette is first crossed. t is a non-negative scalar; t * rayLen
    // is the distance from centre along the (otherCenter - centre) vector.
    const t = resolver(center, ray);

    if (t === null || !Number.isFinite(t) || t < 0) {
        return bboxEdgeIntersect(center, ray);
    }

    return {
        x: center.x + ray.x * t,
        y: center.y + ray.y * t,
    };
}

// ---------------------------------------------------------------------------
// Shape resolution (defence in depth, mirrors NoteCard)
// ---------------------------------------------------------------------------

const KNOWN_SHAPES = new Set([
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

function resolveShape(value) {
    return KNOWN_SHAPES.has(value) ? value : 'rectangle';
}

// ---------------------------------------------------------------------------
// Per-shape resolvers
// Each returns the smallest non-negative t such that the parametric ray
// point `centre + t * ray` lies on the silhouette boundary. Returns null
// to fall back to the bounding box edge.
// ---------------------------------------------------------------------------

const HALF = NOTE_CENTER_OFFSET; // 110

/**
 * Rectangular silhouette: the ray exits through one of the four bbox edges.
 */
function rectangleEdgeIntersect(center, ray) {
    return bboxEdgeT(ray);
}

/**
 * Per US AC85: rounded_rectangle anchor falls on the straight side of
 * the bounding box (curvature ignored for UX stability across the 220px
 * bbox). We reuse the bbox intersect — the visual difference between
 * the bbox edge and the rounded silhouette is sub-pixel at this scale.
 */
function roundedRectangleEdgeIntersect(center, ray) {
    return bboxEdgeT(ray);
}

/**
 * Bbox edge intersect in ray-local coordinates. The note bbox spans
 * (-HALF, -HALF) to (HALF, HALF) in note-local coords (ray is already
 * relative to note centre). Returns the smallest t > 0 at which the
 * ray crosses x = ±HALF or y = ±HALF.
 *
 * For each candidate t, we check the orthogonal coordinate lies within
 * [-HALF, HALF] to confirm the crossing is actually on the bbox edge
 * (not on the extension of an edge the ray misses).
 */
function bboxEdgeT(ray) {
    const candidates = [];

    if (Math.abs(ray.x) > 1e-6) {
        // Try both vertical edges x = +HALF and x = -HALF. Since
        // |ray.x| is positive, ±HALF/|ray.x| gives a positive t for
        // the cross direction. The y-range check filters the edge
        // actually hit.
        for (const tx of [HALF / Math.abs(ray.x), -HALF / Math.abs(ray.x)]) {
            if (tx > 1e-6) {
                const yAtTx = ray.y * tx;
                if (yAtTx >= -HALF && yAtTx <= HALF) {
                    candidates.push(tx);
                }
            }
        }
    }

    if (Math.abs(ray.y) > 1e-6) {
        for (const ty of [HALF / Math.abs(ray.y), -HALF / Math.abs(ray.y)]) {
            if (ty > 1e-6) {
                const xAtTy = ray.x * ty;
                if (xAtTy >= -HALF && xAtTy <= HALF) {
                    candidates.push(ty);
                }
            }
        }
    }

    if (candidates.length === 0) return null;
    return Math.min(...candidates);
}

/**
 * Bbox edge intersection in canvas coords (fallback when the silhouette
 * resolver returns null — usually means the ray points inside the bbox
 * and the silhouette resolver has no forward exit).
 */
function bboxEdgeIntersect(center, ray) {
    const t = bboxEdgeT(ray);
    if (t === null) {
        // Should never happen if ray is non-zero, but defence in depth.
        return { x: center.x + HALF, y: center.y };
    }
    return {
        x: center.x + ray.x * t,
        y: center.y + ray.y * t,
    };
}

/**
 * Circle: x² + y² = HALF²  (centre at (0,0), radius HALF)
 * Solve t such that t² * (rx² + ry²) = HALF² ⇒ t = HALF / |ray|.
 */
function circleEdgeIntersect(center, ray) {
    return HALF / Math.hypot(ray.x, ray.y);
}

/**
 * Ellipse: (x / HALF)² + (y / (HALF * 0.4))² = 1
 * Vertical compression 0.4 matches NoteCard's CSS `border-radius: 50% /
 * 40%` + `clip-path: ellipse(50% 50%) at 50% 50%`.
 */
function ellipseEdgeIntersect(center, ray) {
    const rx = HALF;
    const ry = HALF * 0.4;
    // (t * ray.x / rx)² + (t * ray.y / ry)² = 1
    // t² * ((ray.x / rx)² + (ray.y / ry)²) = 1
    // t = 1 / sqrt(...)
    const denom = Math.sqrt((ray.x / rx) ** 2 + (ray.y / ry) ** 2);
    if (denom < 1e-6) return null;
    return 1 / denom;
}

/**
 * Generic polygon edge intersect. Walks every edge a→b and finds the
 * smallest non-negative t along the ray where t * ray equals a point
 * on the edge (s ∈ [0, 1] along the segment).
 *
 * Math derivation: parametrise ray as `P = t * ray` and edge as
 * `P = a + s * (b - a)`. Cross-multiplying:
 *   t = (a.x * ey - a.y * ex) / (ray.x * ey - ray.y * ex)
 *   s = (t * ray.x - a.x) / ex   (fallback to y-form if ex == 0)
 * where ex = b.x - a.x and ey = b.y - a.y.
 *
 * We guard parallel edges (denom near zero) and non-forward rays
 * (t <= 0).
 */
function polygonEdgeIntersect(polygon) {
    return function (center, ray) {
        let bestT = null;

        for (let i = 0; i < polygon.length; i++) {
            const a = polygon[i];
            const b = polygon[(i + 1) % polygon.length];
            const ex = b.x - a.x;
            const ey = b.y - a.y;

            const denom = ray.x * ey - ray.y * ex;
            if (Math.abs(denom) < 1e-9) continue; // parallel

            const t = (a.x * ey - a.y * ex) / denom;
            // Filter non-forward crossings BEFORE the s computation to
            // avoid diving by ex≈0 on backwards rays.
            if (t <= 1e-6) continue;

            // s in [0, 1] along the edge. Use whichever coordinate has
            // a non-zero edge delta — we can't divide by ex if ex === 0.
            let s;
            if (Math.abs(ex) > 1e-9) {
                s = (t * ray.x - a.x) / ex;
            } else if (Math.abs(ey) > 1e-9) {
                s = (t * ray.y - a.y) / ey;
            } else {
                continue; // zero-length edge, skip
            }

            // Tolerance: avoid floating-point rejection at exact vertices.
            if (s < -1e-6 || s > 1 + 1e-6) continue;

            if (bestT === null || t < bestT) bestT = t;
        }

        return bestT;
    };
}

// Polygon definitions. Vertices are in note-LOCAL coordinates centered on
// the note: x in [-HALF, +HALF], y in [-HALF, +HALF] (positive y is DOWN,
// matching canvas / CSS clip-path semantics). Vertices are listed in the
// same order as the CSS `clip-path: polygon()` declarations in
// `frontend/src/index.css` so the math stays easy to audit against the
// source-of-truth CSS.
//
// Conversion: css% → local = ((css% - 50) * HALF / 50). For example,
// `50% 0%` (top centre) = ((50-50) * 2.2, (0-50) * 2.2) = (0, -HALF).
// Note `clip-path` lists vertices clockwise in canvas coords (which is
// the browser-native order); polygonEdgeIntersect is direction-agnostic
// because we filter on s ∈ [0, 1] + t > 0, so CW vs CCW doesn't matter
// here. If we ever need point-in-polygon tests (e.g. for hit-testing),
// CCW is the convention we'd adopt.

const POLY_DIAMOND = [
    // 50% 0%, 100% 50%, 50% 100%, 0% 50%
    { x: 0, y: -HALF }, { x: HALF, y: 0 }, { x: 0, y: HALF }, { x: -HALF, y: 0 },
];

const POLY_TRIANGLE = [
    // 50% 0%, 0% 100%, 100% 100%  (apex up)
    { x: 0, y: -HALF }, { x: -HALF, y: HALF }, { x: HALF, y: HALF },
];

const POLY_STAR = [
    // 5-point star, 10 vertices from index.css (50% 0% / 61% 35% / 98%
    // 35% / 68% 57% / 79% 91% / 50% 70% / 21% 91% / 32% 57% / 2% 35% /
    // 39% 35%). Conversion: x = (cssX - 50) / 50 * HALF = (cssX/50 - 1)
    // * HALF. With HALF=110, that's x = (cssX - 50) * 2.2.
    // Index  | CSS        | x = (css-50)*2.2        | y = (css-50)*2.2
    //   0     | 50% 0%     | 0                      | -110 (= -HALF)
    //   1     | 61% 35%    | +24.2 (= 0.22*HALF)    | -33  (= -0.30*HALF)
    //   2     | 98% 35%    | +105.6 (= 0.96*HALF)   | -33
    //   3     | 68% 57%    | +39.6 (= 0.36*HALF)    | +15.4 (= 0.14*HALF)
    //   4     | 79% 91%    | +63.8 (= 0.58*HALF)    | +90.2 (= 0.82*HALF)
    //   5     | 50% 70%    | 0                      | +44  (= 0.40*HALF)
    //   6     | 21% 91%    | -63.8 (= -0.58*HALF)   | +90.2
    //   7     | 32% 57%    | -39.6 (= -0.36*HALF)   | +15.4
    //   8     | 2% 35%     | -105.6 (= -0.96*HALF)  | -33
    //   9     | 39% 35%    | -24.2 (= -0.22*HALF)   | -33
    { x: 0,             y: -HALF },                      // 50% 0%
    { x: HALF * 0.22,   y: -HALF * 0.30 },               // 61% 35%
    { x: HALF * 0.96,   y: -HALF * 0.30 },               // 98% 35%
    { x: HALF * 0.36,   y:  HALF * 0.14 },               // 68% 57%
    { x: HALF * 0.58,   y:  HALF * 0.82 },               // 79% 91%
    { x: 0,             y:  HALF * 0.40 },               // 50% 70%
    { x: -HALF * 0.58,  y:  HALF * 0.82 },               // 21% 91%
    { x: -HALF * 0.36,  y:  HALF * 0.14 },               // 32% 57%
    { x: -HALF * 0.96,  y: -HALF * 0.30 },               // 2% 35%
    { x: -HALF * 0.22,  y: -HALF * 0.30 },               // 39% 35%
];

const POLY_HEXAGON = [
    // 25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%
    { x: -HALF * 0.5, y: -HALF }, { x: HALF * 0.5, y: -HALF },
    { x: HALF, y: 0 }, { x: HALF * 0.5, y: HALF },
    { x: -HALF * 0.5, y: HALF }, { x: -HALF, y: 0 },
];

const POLY_PENTAGON = [
    // 50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%
    { x: 0, y: -HALF },
    { x: HALF, y: -HALF * 0.24 }, // (38% − 50%) / 50% * HALF = −0.24 * HALF
    { x: HALF * 0.64, y: HALF },   // (82% − 50%) / 50% * HALF = 0.64 * HALF
    { x: -HALF * 0.64, y: HALF },
    { x: -HALF, y: -HALF * 0.24 },
];

const POLY_OCTAGON = [
    // 30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%
    { x: -HALF * 0.4, y: -HALF }, { x: HALF * 0.4, y: -HALF },
    { x: HALF, y: -HALF * 0.4 }, { x: HALF, y: HALF * 0.4 },
    { x: HALF * 0.4, y: HALF }, { x: -HALF * 0.4, y: HALF },
    { x: -HALF, y: HALF * 0.4 }, { x: -HALF, y: -HALF * 0.4 },
];

const POLY_ARROW = [
    // 0% 25%, 60% 25%, 60% 0%, 100% 50%, 60% 100%, 60% 75%, 0% 75%
    { x: -HALF, y: -HALF * 0.5 },
    { x: HALF * 0.2, y: -HALF * 0.5 },
    { x: HALF * 0.2, y: -HALF },
    { x: HALF, y: 0 },
    { x: HALF * 0.2, y: HALF },
    { x: HALF * 0.2, y: HALF * 0.5 },
    { x: -HALF, y: HALF * 0.5 },
];

const POLY_PARALLELOGRAM = [
    // 20% 0%, 100% 0%, 80% 100%, 0% 100%
    { x: -HALF * 0.6, y: -HALF },
    { x: HALF, y: -HALF },
    { x: HALF * 0.6, y: HALF },
    { x: -HALF, y: HALF },
];

const POLY_TRAPEZOID = [
    // 20% 0%, 80% 0%, 100% 100%, 0% 100%
    { x: -HALF * 0.6, y: -HALF },
    { x: HALF * 0.6, y: -HALF },
    { x: HALF, y: HALF },
    { x: -HALF, y: HALF },
];

const POLY_MESSAGE_BUBBLE = [
    // 0% 0%, 100% 0%, 100% 70%, 70% 70%, 60% 100%, 50% 70%, 0% 70%
    // Tail apex at 60% 100% is included (US AC82a: the tail tip is a
    // legitimate anchor target when the ray points at it).
    { x: -HALF, y: -HALF },
    { x: HALF, y: -HALF },
    { x: HALF, y: HALF * 0.4 },
    { x: HALF * 0.4, y: HALF * 0.4 },
    { x: HALF * 0.2, y: HALF },      // tail tip (60% 100%)
    { x: 0, y: HALF * 0.4 },
    { x: -HALF, y: HALF * 0.4 },
];

const POLY_CLOUD = [
    // 14-vertex silhouette: 20% 60%, 0% 50%, 5% 30%, 20% 25%, 25% 10%,
    // 45% 5%, 60% 15%, 70% 5%, 85% 10%, 95% 25%, 100% 45%, 90% 60%,
    // 80% 70%, 30% 70%.
    { x: -HALF * 0.6, y: HALF * 0.2 },  //  20% 60%
    { x: -HALF,       y: 0          },  //   0% 50%
    { x: -HALF * 0.9, y: -HALF * 0.4 },  //   5% 30%
    { x: -HALF * 0.6, y: -HALF * 0.5 },  //  20% 25%
    { x: -HALF * 0.5, y: -HALF * 0.8 },  //  25% 10%
    { x: -HALF * 0.1, y: -HALF * 0.9 },  //  45% 5%
    { x: HALF * 0.2,  y: -HALF * 0.7 },  //  60% 15%
    { x: HALF * 0.4,  y: -HALF * 0.9 },  //  70% 5%
    { x: HALF * 0.7,  y: -HALF * 0.8 },  //  85% 10%
    { x: HALF * 0.9,  y: -HALF * 0.5 },  //  95% 25%
    { x: HALF,        y: -HALF * 0.1 },  // 100% 45%
    { x: HALF * 0.8,  y: HALF * 0.2 },  //  90% 60%
    { x: HALF * 0.6,  y: HALF * 0.4 },  //  80% 70%
    { x: -HALF * 0.4, y: HALF * 0.4 },  //  30% 70%
];

const POLY_CYLINDER = [
    // 50% 0%, 100% 15%, 100% 85%, 50% 100%, 0% 85%, 0% 15%
    { x: 0, y: -HALF },
    { x: HALF, y: -HALF * 0.7 },
    { x: HALF, y: HALF * 0.7 },
    { x: 0, y: HALF },
    { x: -HALF, y: HALF * 0.7 },
    { x: -HALF, y: -HALF * 0.7 },
];

const SHAPE_RESOLVERS = {
    rectangle: rectangleEdgeIntersect,
    rounded_rectangle: roundedRectangleEdgeIntersect,
    diamond: polygonEdgeIntersect(POLY_DIAMOND),
    triangle: polygonEdgeIntersect(POLY_TRIANGLE),
    circle: circleEdgeIntersect,
    ellipse: ellipseEdgeIntersect,
    star: polygonEdgeIntersect(POLY_STAR),
    hexagon: polygonEdgeIntersect(POLY_HEXAGON),
    pentagon: polygonEdgeIntersect(POLY_PENTAGON),
    octagon: polygonEdgeIntersect(POLY_OCTAGON),
    arrow: polygonEdgeIntersect(POLY_ARROW),
    parallelogram: polygonEdgeIntersect(POLY_PARALLELOGRAM),
    trapezoid: polygonEdgeIntersect(POLY_TRAPEZOID),
    message_bubble: polygonEdgeIntersect(POLY_MESSAGE_BUBBLE),
    cloud: polygonEdgeIntersect(POLY_CLOUD),
    cylinder: polygonEdgeIntersect(POLY_CYLINDER),
};

// ---------------------------------------------------------------------------
// Public: bezierPath
// ---------------------------------------------------------------------------

/**
 * SVG path "d" string for a quadratic bezier connector.
 *
 * Per US §6.2 + AC86/AC87:
 * - Control point is the midpoint of (source, destination) shifted
 *   perpendicular to the segment.
 * - Perpendicular offset = min(80px, distance/2) — matches US §6.3 A13
 *   clamp.
 * - The perpendicular direction is the LEFT side of the directed segment
 *   (deterministic, not random — same input → same curvature per AC86).
 * - Anchor points are the silhouette intersections returned by
 *   getAnchorPoint.
 *
 * @param {{x:number,y:number}} source  Anchor point on the source note.
 * @param {{x:number,y:number}} destination  Anchor point on the dest note.
 * @returns {string} SVG path "d" attribute, e.g. "M 100 200 Q 250 150 300 200".
 */
export function bezierPath(source, destination) {
    const dx = destination.x - source.x;
    const dy = destination.y - source.y;
    const distance = Math.hypot(dx, dy);

    const offset = distance > 0
        ? Math.min(NOTE_CONNECTOR_BEZIER_OFFSET_PX, distance / 2)
        : 0;

    // Perpendicular unit vector (left of the directed segment). In screen
    // coords with y growing down, rotating (dx, dy) by 90° CCW (visual
    // left, mathematical right since y is flipped) gives (−dy, dx) /
    // distance. We pick that direction deterministically so the same two
    // notes always produce the same curvature side.
    let perpX;
    let perpY;
    if (distance > 1e-6) {
        perpX = -dy / distance;
        perpY = dx / distance;
    } else {
        perpX = 0;
        perpY = 0;
    }

    const midX = (source.x + destination.x) / 2;
    const midY = (source.y + destination.y) / 2;
    const ctrlX = midX + perpX * offset;
    const ctrlY = midY + perpY * offset;

    return `M ${source.x} ${source.y} Q ${ctrlX} ${ctrlY} ${destination.x} ${destination.y}`;
}

// ---------------------------------------------------------------------------
// Public: markerFor
// ---------------------------------------------------------------------------

/**
 * Which SVG marker(s) to render for a given style.
 *
 * Returns:
 *   - 'start'  → arrow head at the source end
 *   - 'end'    → arrow head at the destination end
 *   - 'both'   → arrow heads at both ends
 *   - null     → no markers (line only)
 *
 * The SVG <defs> in ConnectorLayer.jsx will define the 4 marker variants.
 */
export function markerFor(style) {
    switch (style) {
        case 'solid_arrow_end':
        case 'dashed_arrow_end':
            return 'end';
        case 'solid_arrow_start':
            return 'start';
        case 'arrow_both_solid':
            return 'both';
        case 'solid_no_arrow':
        case 'dashed_no_arrow':
            return null;
        default:
            // Defensive fallback for stale/unknown style values.
            return 'end';
    }
}

// ---------------------------------------------------------------------------
// Public: isDashed
// ---------------------------------------------------------------------------

/**
 * Whether a style renders as a dashed line (vs solid).
 * Used by ConnectorLayer to set stroke-dasharray.
 */
export function isDashed(style) {
    return style === 'dashed_arrow_end' || style === 'dashed_no_arrow';
}

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

// NOTE_CONNECTOR_DEFAULT_STYLE re-exported so consumers can import it
// alongside the geometry helpers without reaching into the constants
// module directly.
export { NOTE_CONNECTOR_DEFAULT_STYLE };
