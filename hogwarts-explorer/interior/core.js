/* Hogwarts interior — core namespace, floor-plan layout + walk navigation.
 *
 * The interior is one connected set of axis-aligned rooms. Movement uses the same
 * analytic approach as the outdoor terrain: a floorH(x,z) height field (so the grand
 * staircase is just a ramp — no per-frame raycast) plus a list of thin wall segments
 * we push the player-circle out of. Doorways are simply gaps left in the wall list.
 * Everything here is original procedural code; no third-party art. */
window.HPI = (function () {
  const T = window.THREE;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---- floor-plan constants (shared by every room builder) -------------------
  // X = east/west, Z = depth (south +Z is toward the courtyard door), Y = up.
  const L = {
    EH:  { x0: -13, x1: 13, z0: 2,   z1: 34 },   // Entrance Hall
    GH:  { x0: -56, x1: -13, z0: 2,  z1: 40 },   // Great Hall (west)
    COR: { x0: 13, x1: 40, z0: 16,  z1: 24 },    // portrait corridor (east)
    LIB: { x0: 40, x1: 70, z0: 2,   z1: 40 },    // Library (far east)
    GAL: { x0: -7, x1: 7,  z0: -14, z1: 2 },     // upper gallery (top of stairs)
    CR:  { x0: 7,  x1: 28, z0: -14, z1: 2 },     // Common room (upper, east of gallery)
    UP: 7,                                        // upper-floor height
    rampZ0: 2, rampZ1: 14, rampX: 6,             // grand-staircase ramp footprint
    wall: 0.6,                                    // wall half-thickness for pushout
    spawn: { x: 0, z: 30.5 },                     // where you appear on entering
    exit:  { x: 0, z: 33.4 },                     // the great doors (walk here to leave)
  };

  // ---- navigation: wall segments + floor height ------------------------------
  const nav = {
    wallsX: [],  // {c, lo, hi}  wall on the line x=c, spanning z in [lo,hi]
    wallsZ: [],  // {c, lo, hi}  wall on the line z=c, spanning x in [lo,hi]
    reset() { this.wallsX.length = 0; this.wallsZ.length = 0; },
    // a wall perpendicular to X (blocks east/west motion) at x=c over z in [lo,hi]
    wallX(c, lo, hi) { this.wallsX.push({ c, lo: Math.min(lo, hi), hi: Math.max(lo, hi) }); },
    // a wall perpendicular to Z (blocks north/south motion) at z=c over x in [lo,hi]
    wallZ(c, lo, hi) { this.wallsZ.push({ c, lo: Math.min(lo, hi), hi: Math.max(lo, hi) }); },

    // rectangular outer walls of a room, each side optionally carrying a door gap.
    // gap = [axisLo, axisHi] opening on that side (omitted side = solid wall).
    room(r, doors = {}) {
      const g = (side) => doors[side];
      // west / east walls (lines x=x0, x=x1), spanning z
      segWithGap(this.wallsX, r.x0, r.z0, r.z1, g('w'));
      segWithGap(this.wallsX, r.x1, r.z0, r.z1, g('e'));
      // south / north walls (lines z=z1, z=z0), spanning x
      segWithGap(this.wallsZ, r.z1, r.x0, r.x1, g('s'));
      segWithGap(this.wallsZ, r.z0, r.x0, r.x1, g('n'));
    },

    floorH(x, z) {
      // grand-staircase ramp: rises from y=0 (south, z1) up to y=UP (north, z0)
      if (x >= -L.rampX && x <= L.rampX && z >= L.rampZ0 && z <= L.rampZ1) {
        return L.UP * clamp((L.rampZ1 - z) / (L.rampZ1 - L.rampZ0), 0, 1);
      }
      if (inside(L.GAL, x, z) || inside(L.CR, x, z)) return L.UP; // upper floor
      return 0;
    },

    // push a point (radius pr) out of every nearby wall segment
    collide(p, pr = 1.0) {
      for (const w of this.wallsX) {
        if (p.z > w.lo - pr && p.z < w.hi + pr && Math.abs(p.x - w.c) < pr) {
          p.x = w.c + (p.x >= w.c ? pr : -pr);
        }
      }
      for (const w of this.wallsZ) {
        if (p.x > w.lo - pr && p.x < w.hi + pr && Math.abs(p.z - w.c) < pr) {
          p.z = w.c + (p.z >= w.c ? pr : -pr);
        }
      }
    },
  };

  function segWithGap(arr, c, lo, hi, gap) {
    if (!gap) { arr.push({ c, lo, hi }); return; }
    const [glo, ghi] = gap;
    if (glo > lo) arr.push({ c, lo, hi: glo });
    if (ghi < hi) arr.push({ c, lo: ghi, hi });
  }
  function inside(r, x, z) { return x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1; }

  // ---- tiny shared helpers ---------------------------------------------------
  const materialCache = {};
  function mat(key, make) { return materialCache[key] || (materialCache[key] = make()); }

  return { T, L, nav, clamp, inside, mat, builders: [] };
})();
