/* Full-body dog art + wardrobe + scenery for the growth house.
 * The match-3 tiles keep using the portrait art from dogs.js; this file paints
 * sitting dogs with puppy / teen / adult proportions, breed-true coats, soft
 * volume shading and fur tufts, plus equippable accessories and the room /
 * park backdrops.
 */
(() => {
  "use strict";

  const r1 = (n) => Math.round(n * 10) / 10;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  let SEQ = 0;

  /* ------------------------------- Colour ------------------------------- */

  const hex2rgb = (h) => {
    let s = h.replace("#", "");
    if (s.length === 3) s = s.split("").map((c) => c + c).join("");
    const n = parseInt(s, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const rgb2hex = (rgb) =>
    "#" + rgb.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, "0")).join("");
  const mix = (a, b, t) => {
    const A = hex2rgb(a);
    const B = hex2rgb(b);
    return rgb2hex(A.map((v, i) => v + (B[i] - v) * t));
  };
  const lighten = (c, t) => mix(c, "#ffffff", t);
  const darken = (c, t) => mix(c, "#1c110a", t);

  /* -------------------------------- Paths ------------------------------- */

  // Catmull-Rom spline through points. A point may carry a third value: the
  // handle length (1 = smooth, ~0.15 = pointy fur tip).
  function smooth(pts, closed = true) {
    const n = pts.length;
    const P = (i) => (closed ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1)]);
    let d = `M${r1(pts[0][0])} ${r1(pts[0][1])}`;
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i += 1) {
      const p0 = P(i - 1);
      const p1 = P(i);
      const p2 = P(i + 1);
      const p3 = P(i + 2);
      const k1 = p1[2] == null ? 1 : p1[2];
      const k2 = p2[2] == null ? 1 : p2[2];
      d += `C${r1(p1[0] + ((p2[0] - p0[0]) / 6) * k1)} ${r1(p1[1] + ((p2[1] - p0[1]) / 6) * k1)} ${r1(
        p2[0] - ((p3[0] - p1[0]) / 6) * k2
      )} ${r1(p2[1] - ((p3[1] - p1[1]) / 6) * k2)} ${r1(p2[0])} ${r1(p2[1])}`;
    }
    return closed ? `${d}Z` : d;
  }

  // Left half (top centre → bottom centre) mirrored into a full outline.
  const sym = (left, cx = 100) => [
    ...left,
    ...left
      .slice(1, -1)
      .reverse()
      .map(([x, y, k]) => [2 * cx - x, y, k]),
  ];
  const flip = (pts, cx = 100) => pts.map(([x, y, k]) => [2 * cx - x, y, k]);

  // Fur tufts along a quadratic guide a → c → b, pushed away from `center`.
  // Returns the points after `a`, ending on `b`.
  function fur(a, c, b, n, amp, center, curly = false) {
    const out = [];
    const q = (t) => [
      (1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0],
      (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1],
    ];
    for (let i = 1; i <= 2 * n; i += 1) {
      const t = i / (2 * n);
      if (i === 2 * n) {
        out.push([b[0], b[1], curly ? 0.2 : 0.4]);
        break;
      }
      const [x, y] = q(t);
      const dx = x - center[0];
      const dy = y - center[1];
      const L = Math.hypot(dx, dy) || 1;
      if (i % 2) {
        // tip, swept a little along the travel direction
        const [tx, ty] = q(Math.min(1, t + 0.02));
        const sx = (tx - x) * 6;
        const sy = (ty - y) * 6;
        out.push([x + (dx / L) * amp + (curly ? 0 : sx * 0.25), y + (dy / L) * amp + (curly ? 0 : sy * 0.25), curly ? 1.1 : 0.18]);
      } else {
        out.push([x - (dx / L) * amp * 0.15, y - (dy / L) * amp * 0.15, curly ? 0.2 : 0.4]);
      }
    }
    return out;
  }

  // Evaluate a Catmull-Rom curve (open) at m evenly spaced parameter values.
  function sampleCurve(pts, m) {
    const n = pts.length;
    const P = (i) => pts[clamp(i, 0, n - 1)];
    const out = [];
    for (let j = 0; j <= m; j += 1) {
      const u = (j / m) * (n - 1);
      const i = Math.min(n - 2, Math.floor(u));
      const t = u - i;
      const p0 = P(i - 1);
      const p1 = P(i);
      const p2 = P(i + 1);
      const p3 = P(i + 2);
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
    return out;
  }

  // A tapered "brush stroke" around a centre line — tails, ribbons, straps.
  function brush(center, widthAt, { m = 14, furAmp = 0, furBoth = false, curly = false } = {}) {
    const s = sampleCurve(center, m);
    const left = [];
    const right = [];
    s.forEach((p, i) => {
      const a = s[Math.max(0, i - 1)];
      const b = s[Math.min(s.length - 1, i + 1)];
      let tx = b[0] - a[0];
      let ty = b[1] - a[1];
      const L = Math.hypot(tx, ty) || 1;
      tx /= L;
      ty /= L;
      const nx = -ty;
      const ny = tx;
      const t = i / m;
      const w = widthAt(t);
      const tip = furAmp && i % 2 === 1 && i < m;
      const kTip = curly ? 1 : 0.2;
      const kVal = curly ? 0.25 : 0.5;
      const wl = w + (tip ? furAmp : 0);
      const wr = w + (tip && furBoth ? furAmp : 0);
      left.push([p[0] + nx * wl, p[1] + ny * wl, furAmp ? (tip ? kTip : kVal) : 1]);
      right.push([p[0] - nx * wr, p[1] - ny * wr, furAmp && furBoth ? (tip ? kTip : kVal) : 1]);
    });
    return smooth([...left, ...right.reverse()]);
  }

  /* ------------------------------- Breeds ------------------------------- */

  // fur: main coat · light: secondary coat · patch: third colour
  // line: outline colour · ear/tail: shape keys · pattern: markings recipe
  const BREEDS = {
    shiba: {
      fur: "#e98a3c", light: "#fff4e6", inner: "#f6c79f", nose: "#2b1d17",
      ear: { type: "up", len: 0.52, w: 1, spread: 0.06 }, tail: "curl", fluff: 3.2, pattern: "urajiro",
      headW: 1.02, muzzle: 0.95, legs: 1, paw: "light",
    },
    golden: {
      fur: "#e5a24a", light: "#fbe1ae", inner: "#c7853a", nose: "#2b1d17",
      ear: { type: "flop", len: 0.55, w: 1, feather: 3 }, tail: "plume", fluff: 3.6, pattern: "golden",
      headW: 1, muzzle: 1.05, legs: 1, paw: "fur",
    },
    bernese: {
      fur: "#2a2528", light: "#fffaf2", patch: "#c46f33", inner: "#2a2528", nose: "#141012",
      ear: { type: "flop", len: 0.38, w: 0.95, feather: 1.5 }, tail: "bushy", fluff: 3.4, pattern: "tri",
      headW: 1.02, muzzle: 1, legs: 1, paw: "light", rim: "#5d5157",
    },
    shepherd: {
      fur: "#c88a51", light: "#efcf9f", patch: "#2a221f", inner: "#3a2c27", nose: "#161012",
      ear: { type: "up", len: 0.95, w: 1.05, spread: 0.12, dark: true }, tail: "saber", fluff: 2.6, pattern: "saddle",
      headW: 0.95, muzzle: 1.32, legs: 1.05, paw: "light",
    },
    husky: {
      fur: "#6e7d93", light: "#fafcff", patch: "#4d596b", inner: "#f2c4cc", nose: "#232227",
      ear: { type: "up", len: 0.62, w: 0.95, spread: 0.08, furry: true }, tail: "plume-curl", fluff: 3.6, pattern: "husky",
      headW: 1, muzzle: 1.08, legs: 1, paw: "light", eyes: "blue",
    },
    corgi: {
      fur: "#e7883a", light: "#fffaf3", inner: "#f7c4a4", nose: "#2b1d17",
      ear: { type: "up", len: 0.95, w: 1.25, spread: 0.22, round: true }, tail: "stub", fluff: 2.8, pattern: "corgi",
      headW: 1.04, muzzle: 0.98, legs: 0.62, bodyW: 1.08, paw: "light",
    },
    samoyed: {
      fur: "#fbfcff", light: "#ffffff", shade: "#dfe5f0", inner: "#f6cdd6", nose: "#25212a",
      ear: { type: "up", len: 0.42, w: 0.9, spread: 0.04, furry: true }, tail: "curl", fluff: 6.5, pattern: "samoyed",
      headW: 1.06, muzzle: 0.92, legs: 1, bodyW: 1.12, paw: "fur", line: "#9aa0b5", lips: true,
    },
    pug: {
      fur: "#e3c9a5", light: "#f2e2c8", patch: "#3a302d", inner: "#3a302d", nose: "#1c1717",
      ear: { type: "button", len: 0.4, w: 1 }, tail: "tight", fluff: 0, pattern: "pug",
      headW: 1.1, headH: 0.96, muzzle: 0.5, muzzleW: 1.14, legs: 0.86, bodyW: 1.12, paw: "fur", eyeS: 1.12, eyeDx: 0.44,
    },
    poodle: {
      fur: "#b8693a", light: "#d99460", inner: "#8d4d27", nose: "#4a2a1e",
      ear: { type: "curl", len: 0.78, w: 1.1 }, tail: "pom", fluff: 4, curly: true, pattern: "curly",
      headW: 1.02, muzzle: 0.9, legs: 1, paw: "fur",
    },
    dalmatian: {
      fur: "#fbfaf6", light: "#ffffff", shade: "#e4e0d6", patch: "#25222a", inner: "#25222a", nose: "#1d1a1f",
      ear: { type: "flop", len: 0.42, w: 0.9, smooth: true }, tail: "thin", fluff: 0, pattern: "spots",
      headW: 0.98, muzzle: 1.12, legs: 1.08, paw: "fur", line: "#6f6a72",
    },
    collie: {
      fur: "#28242c", light: "#fffaf3", inner: "#28242c", nose: "#141012",
      ear: { type: "semi", len: 0.55, w: 0.95, spread: 0.16 }, tail: "feather", fluff: 4.4, pattern: "collie",
      headW: 0.98, muzzle: 1.16, legs: 1.02, paw: "light", rim: "#5e5662",
    },
    frenchie: {
      fur: "#ebd5b6", light: "#f8ecda", patch: "#7a6252", inner: "#f2b9b4", nose: "#231c1c",
      ear: { type: "bat", len: 0.82, w: 1.2, spread: 0.14 }, tail: "stub", fluff: 0, pattern: "frenchie",
      headW: 1.1, headH: 0.98, muzzle: 0.5, muzzleW: 1.12, legs: 0.86, bodyW: 1.14, paw: "fur", eyeS: 1.08, eyeDx: 0.44,
    },
    dachshund: {
      fur: "#a4522b", light: "#d98d5c", inner: "#7d3a1d", nose: "#2b1a14",
      ear: { type: "flop", len: 0.8, w: 1, smooth: true }, tail: "thin", fluff: 0, pattern: "plain",
      headW: 0.97, muzzle: 1.3, legs: 0.55, bodyW: 1, chest: 1.12, paw: "fur",
    },
  };

  // Fill in derived colours once.
  Object.values(BREEDS).forEach((p) => {
    p.line = p.line || darken(p.fur, p.fur === "#28242c" || p.fur === "#2a2528" ? 0.6 : 0.55);
    p.shade = p.shade || darken(p.fur, 0.2);
    p.hi = lighten(p.fur, 0.28);
    p.rim = p.rim || darken(p.fur, 0.35);
  });

  /* ------------------------------ Wardrobe ------------------------------ */

  const SLOTS = [
    { id: "head", name: "头部", emoji: "🎩" },
    { id: "neck", name: "脖子", emoji: "🧣" },
    { id: "back", name: "背部", emoji: "🎒" },
    { id: "paws", name: "爪子", emoji: "🧦" },
    { id: "face", name: "脸部", emoji: "🕶️" },
  ];

  const ITEMS = [
    { id: "scarf", slot: "neck", name: "红色领巾", level: 1, emoji: "🧣" },
    { id: "flower", slot: "head", name: "小雏菊花环", level: 2, emoji: "🌸" },
    { id: "backpack", slot: "back", name: "小背包", level: 2, emoji: "🎒" },
    { id: "socks", slot: "paws", name: "条纹袜子", level: 3, emoji: "🧦" },
    { id: "bowtie", slot: "neck", name: "蓝格领结", level: 3, emoji: "🎀" },
    { id: "glasses", slot: "face", name: "圆框眼镜", level: 4, emoji: "👓" },
    { id: "bow", slot: "head", name: "粉色蝴蝶结", level: 4, emoji: "🎀" },
    { id: "cape", slot: "back", name: "小披风", level: 5, emoji: "🦸" },
    { id: "boots", slot: "paws", name: "黄色雨靴", level: 6, emoji: "🥾" },
    { id: "bell", slot: "neck", name: "铃铛项圈", level: 6, emoji: "🔔" },
    { id: "crown", slot: "head", name: "金色小皇冠", level: 7, emoji: "👑" },
    { id: "sunglasses", slot: "face", name: "酷酷墨镜", level: 7, emoji: "🕶️" },
    { id: "wings", slot: "back", name: "小翅膀", level: 8, emoji: "🧚" },
    { id: "bandana", slot: "neck", name: "波点三角巾", level: 8, emoji: "🔺" },
    { id: "bracelet", slot: "paws", name: "金手环", level: 9, emoji: "📿" },
    { id: "beanie", slot: "head", name: "针织帽", level: 9, emoji: "🧶" },
  ];

  const ITEM_MAP = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
  const emptyOutfit = () => ({ head: null, neck: null, back: null, paws: null, face: null });

  /* ------------------------------ Geometry ------------------------------ */

  const STAGE = [
    { hw: 50, hh: 44, leg: 25, chest: 38, bw: 36, nw: 25, th: 18, legW: 13.5, eye: 0.19, tail: 0.72, ml: 0.82 },
    { hw: 46, hh: 40, leg: 36, chest: 47, bw: 40, nw: 26, th: 21.5, legW: 14.5, eye: 0.165, tail: 0.88, ml: 0.95 },
    { hw: 43, hh: 37.5, leg: 46, chest: 55, bw: 44, nw: 27, th: 25, legW: 15.5, eye: 0.148, tail: 1, ml: 1.06 },
  ];
  const GEOM = STAGE;

  function geom(p, stage) {
    const s = STAGE[clamp(stage, 0, 2)];
    const cx = 100;
    const ground = 206;
    const hw = s.hw * (p.headW || 1);
    const hh = s.hh * (p.headH || 1);
    const legs = p.legs || 1;
    const leg = s.leg * legs;
    const chest = s.chest * (p.chest || 1);
    const bw = s.bw * (p.bodyW || 1);
    const nw = s.nw * (p.bodyW || 1);
    const neck = ground - leg - chest;
    const hy = neck - hh * 0.4;
    const ey = hy + hh * (stage === 0 ? 0.1 : 0.04);
    const edx = hw * (p.eyeDx || 0.39);
    const er = hw * s.eye * (p.eyeS || 1);
    const ml = (p.muzzle || 1) * s.ml;
    const mw = hw * 0.42 * (p.muzzleW || 1);
    const mh = hh * 0.25 * ml + 4;
    const my = ey + er * 1.15 + mh * 0.62;
    const chin = Math.max(hy + hh, my + mh * 0.95 + 2);
    const nz = hw * 0.16 * (p.muzzleW ? 0.95 : 1);
    const ny = my - mh * 0.42;
    const mouthY = ny + nz * 0.7 + Math.max(3.2, mh * 0.3);
    const legTop = neck + chest * 0.4;
    const legX = bw * (legs < 0.8 ? 0.4 : 0.36);
    const legW = s.legW * (legs < 0.8 ? 1.12 : 1);
    const th = s.th * (legs < 0.8 ? 0.82 : 1);
    return {
      stage,
      cx,
      ground,
      hw,
      hh,
      hy,
      ey,
      edx,
      er,
      mw,
      mh,
      my,
      ny,
      nz,
      mouthY,
      chin,
      leg,
      chest,
      bw,
      nw,
      neck,
      legTop,
      legX,
      legW,
      th,
      tailK: s.tail,
      collarY: chin + 2.5,
      headTop: hy - hh,
      headBottom: chin,
      pawY: ground - 5,
    };
  }

  /* ------------------------------- Defs --------------------------------- */

  function defs(id, p) {
    const rg = (gid, stops, attrs = 'cx="38%" cy="30%" r="78%" fx="34%" fy="24%"') =>
      `<radialGradient id="${id}-${gid}" ${attrs}>${stops
        .map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`)
        .join("")}</radialGradient>`;
    const coat = (c) => [
      [0, lighten(c, 0.3)],
      [0.5, c],
      [1, mix(c, p.shade === c ? darken(c, 0.25) : darken(c, 0.22), 1)],
    ];
    return `<defs>
      ${rg("fur", coat(p.fur))}
      ${rg("lt", [
        [0, "#ffffff"],
        [0.6, p.light],
        [1, mix(p.light, p.fur, 0.14)],
      ], 'cx="40%" cy="30%" r="90%" fx="36%" fy="24%"')}
      ${rg("pt", coat(p.patch || p.fur))}
      ${rg("leg", coat(p.fur), 'cx="30%" cy="20%" r="95%" fx="30%" fy="15%"')}
      ${rg("eye", [
        [0, "#7a4a2c"],
        [0.45, "#3a2214"],
        [1, "#120a06"],
      ], 'cx="50%" cy="62%" r="62%" fx="50%" fy="75%"')}
      ${rg("iris", [
        [0, "#d8f6ff"],
        [0.5, "#69c1ee"],
        [1, "#2a6c9f"],
      ], 'cx="50%" cy="60%" r="60%" fx="50%" fy="72%"')}
      ${rg("nose", [
        [0, lighten(p.nose, 0.3)],
        [0.6, p.nose],
        [1, darken(p.nose, 0.4)],
      ], 'cx="40%" cy="30%" r="80%" fx="40%" fy="25%"')}
      ${rg("ao", [
        [0, "#2a170c", 0.3],
        [1, "#2a170c", 0],
      ], 'cx="50%" cy="50%" r="50%"')}
      ${rg("blush", [
        [0, "#ff8fae", 0.75],
        [1, "#ff8fae", 0],
      ], 'cx="50%" cy="50%" r="50%"')}
      ${rg("shine", [
        [0, "#ffffff", 0.55],
        [1, "#ffffff", 0],
      ], 'cx="50%" cy="50%" r="50%"')}
      ${rg("tongue", [
        [0, "#ffb0bf"],
        [1, "#f06a88"],
      ], 'cx="50%" cy="30%" r="80%"')}
    </defs>`;
  }

  /* ------------------------------ Shapes -------------------------------- */

  function headPts(p, g) {
    const { cx, hw, hh, hy, chin } = g;
    const C = [cx, hy + hh * 0.12];
    const f = p.fluff ? p.fluff * (0.75 + g.stage * 0.15) : 0;
    const cheek = p.headW > 1.05 ? 1.04 : 1;
    const left = [
      [cx, hy - hh],
      [cx - hw * 0.58, hy - hh * 0.9],
      [cx - hw * 0.9, hy - hh * 0.5],
    ];
    if (f && !p.curly) {
      left.push([cx - hw * 0.98, hy - hh * 0.1, 0.5]);
      left.push(...fur([cx - hw * 0.98, hy - hh * 0.1], [cx - hw * 1.16 * cheek, hy + hh * 0.5], [cx - hw * 0.5, chin - hh * 0.06], 3, f, C));
    } else if (p.curly) {
      left.push([cx - hw * 0.98, hy - hh * 0.1, 0.25]);
      left.push(...fur([cx - hw * 0.98, hy - hh * 0.1], [cx - hw * 1.1, hy + hh * 0.5], [cx - hw * 0.5, chin - hh * 0.06], 3, f * 0.8, C, true));
    } else {
      left.push([cx - hw * cheek, hy + hh * 0.08]);
      left.push([cx - hw * 0.86 * cheek, hy + hh * 0.6]);
      left.push([cx - hw * 0.52, chin - hh * 0.08]);
    }
    left.push([cx, chin]);
    return sym(left, cx);
  }

  function bodyPts(p, g) {
    const { cx, bw, nw, neck, chest, ground, leg } = g;
    const C = [cx, neck + chest * 0.6];
    const f = p.fluff ? p.fluff * (0.6 + g.stage * 0.2) : 0;
    const left = [[cx, neck - 8], [cx - nw, neck - 4]];
    if (f) {
      left.push(...fur([cx - nw, neck - 4], [cx - nw * 1.3, neck + chest * 0.25], [cx - bw * 0.9, neck + chest * 0.7], 2, f * 0.8, C, p.curly));
    } else {
      left.push([cx - nw * 1.12, neck + chest * 0.3]);
      left.push([cx - bw * 0.9, neck + chest * 0.72]);
    }
    left.push([cx - bw, ground - Math.max(10, leg * 0.35)]);
    left.push([cx - bw * 0.8, ground - 1]);
    left.push([cx, ground + 1]);
    return sym(left, cx);
  }

  function bibPts(p, g) {
    const { cx, nw, neck, chest } = g;
    const top = neck - 2;
    const big = p.pattern === "collie" || p.pattern === "samoyed";
    const bot = neck + chest * (big ? 0.92 : 0.78);
    const w = nw * (big ? 1.2 : 0.92);
    const C = [cx, neck + chest * 0.3];
    const left = [[cx, top], [cx - w * 0.9, top + 2]];
    if (p.fluff) {
      left.push(...fur([cx - w * 0.9, top + 2], [cx - w * 1.12, bot - chest * 0.28], [cx - w * 0.45, bot], big ? 4 : 3, p.fluff * 0.85, C, p.curly));
    } else {
      left.push([cx - w * 0.9, top + chest * 0.45]);
      left.push([cx - w * 0.5, bot - 2]);
    }
    left.push([cx, bot + (p.fluff ? p.fluff * 0.6 : 2)]);
    return sym(left, cx);
  }

  // chest fur drawn over the tops of the front legs
  function chestFront(p, g, id) {
    if (!["urajiro", "corgi", "husky", "collie", "golden", "tri", "frenchie", "plain", "saddle", "samoyed"].includes(p.pattern)) return "";
    const pts = bibPts(p, g);
    const d = smooth(pts);
    const { cx, neck, chest } = g;
    let tufts = "";
    if (p.fluff) {
      tufts = [-1, 1]
        .map((s) =>
          [0.35, 0.62].map((t) => {
            const x = cx + s * g.nw * (0.25 + t * 0.4);
            const y = neck + chest * (0.25 + t * 0.45);
            return `<path d="M${r1(x)} ${r1(y - 6)} q${r1(s * 2)} 4 ${r1(-s * 0.5)} 8" fill="none" stroke="${mix(p.light, p.fur, 0.35)}" stroke-width="1.4" stroke-linecap="round" opacity=".7"/>`;
          }).join("")
        )
        .join("");
    }
    return `<path d="${d}" fill="url(#${id}-lt)"/>${tufts}`;
  }

  /* -------------------------------- Ears -------------------------------- */

  function earsBack(p, g, id) {
    const e = p.ear;
    if (!["up", "bat", "semi"].includes(e.type)) return "";
    const { cx, hw, hh, hy } = g;
    if (e.type === "bat") {
      const k = g.stage === 0 ? 0.9 : 1;
      const lx = cx - hw * 0.86;
      const ly = hy - hh * (1.32 * k + 0.08);
      const R = hw * 0.36 * k;
      const ear = [
        [cx - hw * 0.3, hy - hh * 0.86],
        [lx + R * 0.95, ly + R * 0.2],
        [lx + R * 0.55, ly - R * 0.85],
        [lx - R * 0.35, ly - R * 1.0],
        [lx - R * 1.0, ly - R * 0.15],
        [lx - R * 0.95, ly + R * 0.85],
        [cx - hw * 0.96, hy - hh * 0.3],
        [cx - hw * 0.6, hy - hh * 0.5],
      ];
      const inner = [
        [cx - hw * 0.42, hy - hh * 0.8],
        [lx + R * 0.6, ly + R * 0.2],
        [lx + R * 0.3, ly - R * 0.6],
        [lx - R * 0.35, ly - R * 0.65],
        [lx - R * 0.65, ly - R * 0.05],
        [lx - R * 0.6, ly + R * 0.8],
        [cx - hw * 0.84, hy - hh * 0.42],
      ];
      const one = (a, b) => `<path d="${smooth(a)}" fill="url(#${id}-fur)" stroke="${p.line}" stroke-width="2.4" stroke-linejoin="round"/>
        <path d="${smooth(b)}" fill="${p.inner}"/><path d="${smooth(b)}" fill="url(#${id}-ao)" opacity=".35"/>`;
      return `<g class="ra-ears">${one(ear, inner)}${one(flip(ear), flip(inner))}</g>`;
    }
    const len = e.len * (g.stage === 0 ? 0.88 : 1);
    const spread = e.spread || 0;
    const bw = e.w;
    const tip = [cx - hw * (0.7 + spread), hy - hh * (0.95 + len)];
    const bOut = [cx - hw * (0.95 + (bw - 1) * 0.15), hy - hh * 0.18];
    const bIn = [cx - hw * (0.24 - (bw - 1) * 0.3), hy - hh * 0.88];
    const round = e.type === "bat" || e.round;
    const outer = [
      bIn,
      [bIn[0] + (tip[0] - bIn[0]) * 0.5 + 2, bIn[1] + (tip[1] - bIn[1]) * 0.55 - 3],
      [tip[0] + (round ? 4 : 1), tip[1] + (round ? 1 : 0), round ? 1 : 0.15],
      ...(round ? [[tip[0] - 4, tip[1] + 8]] : []),
      [bOut[0] + (tip[0] - bOut[0]) * 0.45 - 4, bOut[1] + (tip[1] - bOut[1]) * 0.5],
      bOut,
      [cx - hw * 0.5, hy - hh * 0.35],
    ];
    const cin = [(bIn[0] + bOut[0] + tip[0]) / 3, (bIn[1] + bOut[1] + tip[1]) / 3 + 4];
    const sc = (pt, k) => [cin[0] + (pt[0] - cin[0]) * k, cin[1] + (pt[1] - cin[1]) * k + 3, pt[2]];
    const inner = [sc(bIn, 0.72), sc(outer[1], 0.66), sc(outer[2], 0.62), ...(round ? [sc(outer[3], 0.62)] : []), sc(outer[round ? 4 : 3], 0.66), sc(bOut, 0.7)];
    const earFill = e.dark ? `url(#${id}-pt)` : `url(#${id}-fur)`;
    let tufts = "";
    if (e.furry || p.fluff > 2) {
      const a = sc(bIn, 0.6);
      const b = sc(bOut, 0.6);
      tufts = [0.25, 0.5, 0.75]
        .map((t) => {
          const x = a[0] + (b[0] - a[0]) * t;
          const y = a[1] + (b[1] - a[1]) * t + 2;
          return `<path d="M${r1(x)} ${r1(y + 4)} Q${r1(x + (cin[0] - x) * 0.2)} ${r1(y - 3)} ${r1(x + (tip[0] - x) * 0.32)} ${r1(y + (tip[1] - y) * 0.3)}" fill="none" stroke="${p.light}" stroke-width="1.6" stroke-linecap="round" opacity=".9"/>`;
        })
        .join("");
    }
    let fold = "";
    if (e.type === "semi") {
      const f1 = [tip[0] + 2, tip[1] + 2];
      const flap = [
        [outer[1][0] - 2, outer[1][1] + 1],
        f1,
        [outer[3][0] + 3, outer[3][1] - 2],
        [tip[0] + 6, tip[1] + 16, 0.4],
      ];
      fold = (pts) => `<path d="${smooth(pts)}" fill="${darken(p.fur, 0.25)}" stroke="${p.line}" stroke-width="2" stroke-linejoin="round"/>`;
      fold = { L: fold(flap), R: fold(flip(flap)) };
    }
    const one = (pts, ipts, side) => `<g>
        <path d="${smooth(pts)}" fill="${earFill}" stroke="${p.line}" stroke-width="2.4" stroke-linejoin="round"/>
        <path d="${smooth(ipts)}" fill="${p.inner}" opacity=".95"/>
        <path d="${smooth(ipts)}" fill="url(#${id}-ao)" opacity=".45"/>
        ${side === "L" ? tufts : ""}
        ${fold ? fold[side] : ""}
      </g>`;
    const tuftsR = tufts ? tufts.replace(/(-?\d+\.?\d*) (-?\d+\.?\d*)/g, (m, x, y) => `${r1(200 - Number(x))} ${y}`) : "";
    return `<g class="ra-ears">${one(outer, inner, "L")}${one(flip(outer), flip(inner), "R").replace("</g>", `${tuftsR}</g>`)}</g>`;
  }

  function earsFront(p, g, id) {
    const e = p.ear;
    const { cx, hw, hh, hy } = g;
    if (e.type === "flop" || e.type === "curl") {
      const len = e.len * (g.stage === 0 ? 0.85 : 1);
      const top = [cx - hw * 0.5, hy - hh * 0.9];
      const C = [cx - hw * 0.8, hy];
      const pts = [top, [cx - hw * 0.92, hy - hh * 0.72]];
      const bottomY = hy + hh * (0.15 + len);
      const outerA = [cx - hw * 1.08, hy - hh * 0.38];
      const tipP = [cx - hw * 0.94, bottomY];
      if (e.type === "curl") {
        pts.push(...fur(pts[1], [cx - hw * 1.32, hy + hh * 0.1], tipP, 4, 4.5, C, true));
        pts.push(...fur(tipP, [cx - hw * 0.62, bottomY + 4], [cx - hw * 0.66, hy + hh * 0.1], 2, 4.5, C, true));
      } else if (e.feather && !e.smooth) {
        pts.push(outerA);
        pts.push(...fur(outerA, [cx - hw * (1.2 + len * 0.15), bottomY - hh * 0.2], tipP, 3, e.feather, C));
        pts.push([cx - hw * 0.66, bottomY - hh * 0.12]);
        pts.push([cx - hw * 0.6, hy - hh * 0.2]);
      } else {
        pts.push(outerA);
        pts.push([cx - hw * (1.14 + len * 0.1), hy + hh * len * 0.6]);
        pts.push(tipP);
        pts.push([cx - hw * 0.7, bottomY - hh * 0.1]);
        pts.push([cx - hw * 0.62, hy - hh * 0.2]);
      }
      const fillL = p.pattern === "spots" ? `url(#${id}-pt)` : p.pattern === "golden" || p.pattern === "plain" ? darken(p.fur, 0.1) : `url(#${id}-fur)`;
      const fillR = p.pattern === "spots" ? `url(#${id}-fur)` : fillL;
      const shade = `<path d="M${r1(top[0] - 2)} ${r1(top[1] + 6)} Q${r1(cx - hw * 0.66)} ${r1(hy)} ${r1(cx - hw * 0.72)} ${r1(bottomY - hh * 0.15)}" fill="none" stroke="${darken(p.fur, 0.3)}" stroke-width="2" stroke-linecap="round" opacity=".35"/>`;
      const spotsR =
        p.pattern === "spots"
          ? `<circle cx="${r1(200 - (cx - hw * 0.95))}" cy="${r1(hy + hh * 0.2)}" r="${r1(hw * 0.09)}" fill="${p.patch}"/><circle cx="${r1(200 - (cx - hw * 0.82))}" cy="${r1(hy + hh * 0.45)}" r="${r1(hw * 0.06)}" fill="${p.patch}"/>`
          : "";
      return `<g class="ra-ears">
        <path d="${smooth(pts)}" fill="${fillL}" stroke="${p.line}" stroke-width="2.4" stroke-linejoin="round"/>${shade}
        <path d="${smooth(flip(pts))}" fill="${fillR}" stroke="${p.line}" stroke-width="2.4" stroke-linejoin="round"/>${shade.replace(/(-?\d+\.?\d*) (-?\d+\.?\d*)/g, (m, x, y) => `${r1(200 - Number(x))} ${y}`)}${spotsR}
      </g>`;
    }
    if (e.type === "button") {
      const pts = [
        [cx - hw * 0.46, hy - hh * 0.92],
        [cx - hw * 0.96, hy - hh * 0.86, 0.6],
        [cx - hw * 1.12, hy - hh * 0.4, 0.4],
        [cx - hw * 0.9, hy - hh * 0.3],
        [cx - hw * 0.72, hy - hh * 0.56],
      ];
      return `<g class="ra-ears">
        <path d="${smooth(pts)}" fill="url(#${id}-pt)" stroke="${p.line}" stroke-width="2.2" stroke-linejoin="round"/>
        <path d="${smooth(flip(pts))}" fill="url(#${id}-pt)" stroke="${p.line}" stroke-width="2.2" stroke-linejoin="round"/>
      </g>`;
    }
    return "";
  }

  /* -------------------------------- Tail -------------------------------- */

  function tail(p, g, id) {
    const k = g.tailK;
    const ax = g.cx + g.bw * 0.72;
    const ay = g.ground - g.th * 1.15;
    const A = (dx, dy) => [ax + dx * k, ay + dy * k];
    const base = `style="--tail-x:${r1(ax)}px;--tail-y:${r1(ay)}px"`;
    const stroke = `stroke="${p.line}" stroke-width="2.4" stroke-linejoin="round"`;
    let d;
    let extra = "";
    switch (p.tail) {
      case "curl": {
        const c = [A(0, 0), A(14, -8), A(26, -28), A(20, -50), A(4, -56), A(-6, -46)];
        d = brush(c, (t) => (10 - t * 3) * k + 1, { furAmp: p.fluff * 0.9, furBoth: p.fluff > 4, m: 16 });
        extra = `<path d="${smooth(sampleCurve(c.slice(1, 5), 6), false)}" fill="none" stroke="${p.light}" stroke-width="${r1(5 * k)}" stroke-linecap="round" opacity=".75"/>`;
        break;
      }
      case "plume-curl": {
        const c = [A(0, 0), A(16, -6), A(30, -26), A(26, -50), A(10, -58)];
        d = brush(c, (t) => (8 + Math.sin(t * Math.PI) * 5) * k, { furAmp: 3.5, furBoth: true, m: 16 });
        extra = `<path d="${smooth([A(24, -40), A(14, -56), A(6, -55)], false)}" fill="none" stroke="${p.light}" stroke-width="${r1(7 * k)}" stroke-linecap="round"/>`;
        break;
      }
      case "plume": {
        const c = [A(0, 0), A(16, -4), A(30, -18), A(38, -40), A(36, -60)];
        d = brush(c, (t) => (6 + Math.sin(t * Math.PI) * 6) * k, { furAmp: 4.5, m: 16 });
        extra = `<path d="${smooth([A(10, -2), A(26, -14), A(33, -34)], false)}" fill="none" stroke="${p.light}" stroke-width="3" stroke-linecap="round" opacity=".65"/>`;
        break;
      }
      case "saber": {
        const c = [A(0, 6), A(16, 12), A(32, 14), A(46, 10), A(54, 2)];
        d = brush(c, (t) => (8 + Math.sin(t * Math.PI) * 3) * k, { furAmp: 2.6, furBoth: true, m: 14 });
        extra = `<path d="${smooth([A(6, 3), A(24, 7), A(40, 4)], false)}" fill="none" stroke="${p.patch}" stroke-width="${r1(7 * k)}" stroke-linecap="round" opacity=".85"/>`;
        break;
      }
      case "bushy": {
        const c = [A(0, 6), A(16, 12), A(32, 13), A(46, 8), A(54, -2)];
        d = brush(c, (t) => (8 + Math.sin(t * Math.PI) * 3) * k, { furAmp: 3, furBoth: true, m: 14 });
        extra = `<path d="${brush([A(44, 9), A(50, 4), A(55, -3)], () => 5 * k, { furAmp: 2, furBoth: true, m: 6 })}" fill="${p.light}"/>`;
        break;
      }
      case "feather": {
        const c = [A(0, 6), A(16, 12), A(32, 14), A(46, 10), A(54, -2)];
        d = brush(c, (t) => (7 + Math.sin(t * Math.PI) * 3) * k, { furAmp: 3.6, m: 14 });
        extra = `<path d="${brush([A(44, 11), A(50, 5), A(54, -3)], () => 5.5 * k, { furAmp: 2.4, furBoth: true, m: 6 })}" fill="${p.light}"/>`;
        break;
      }
      case "stub": {
        const c = [A(-2, 0), A(8, -6), A(12, -14)];
        d = brush(c, (t) => (7 - t * 2) * k, { furAmp: p.fluff ? 2.4 : 0, furBoth: !!p.fluff, m: 8 });
        break;
      }
      case "tight": {
        const c = [A(0, 0), A(12, -8), A(18, -22), A(10, -30), A(2, -24), A(8, -18)];
        d = brush(c, (t) => (8 - t * 2.5) * k, { m: 18 });
        extra = `<path d="${smooth([A(14, -14), A(14, -24), A(8, -27)], false)}" fill="none" stroke="${darken(p.fur, 0.2)}" stroke-width="1.6" stroke-linecap="round" opacity=".55"/>`;
        break;
      }
      case "pom": {
        const c = [A(0, 0), A(10, -10), A(16, -24)];
        d = brush(c, () => 4.5 * k, { m: 8 });
        const px = ax + 18 * k;
        const py = ay - 34 * k;
        const pr = 13 * k;
        const pom = [];
        for (let i = 0; i < 9; i += 1) {
          const a = (i / 9) * Math.PI * 2;
          pom.push([px + Math.cos(a) * pr, py + Math.sin(a) * pr, i % 2 ? 0.25 : 1.1]);
          const a2 = a + Math.PI / 9;
          pom.push([px + Math.cos(a2) * pr * 1.18, py + Math.sin(a2) * pr * 1.18, 1.1]);
        }
        extra = `<path d="${smooth(pom)}" fill="url(#${id}-fur)" ${stroke}/>${curls(px, py, pr * 0.7, p, 4, 7)}`;
        break;
      }
      default: {
        // thin tapering whip
        const c = [A(0, 0), A(16, -2), A(30, -12), A(38, -28), A(38, -40)];
        d = brush(c, (t) => (6 - t * 4.5) * k + 0.6, { m: 14 });
        if (p.pattern === "spots") {
          extra = `<circle cx="${r1(ax + 24 * k)}" cy="${r1(ay - 7 * k)}" r="${r1(2.6 * k)}" fill="${p.patch}"/><circle cx="${r1(ax + 36 * k)}" cy="${r1(ay - 24 * k)}" r="${r1(2 * k)}" fill="${p.patch}"/>`;
        }
      }
    }
    return `<g class="ra-tail" ${base}><path d="${d}" fill="url(#${id}-fur)" ${stroke}/>${extra}</g>`;
  }

  // little curl marks for poodle coats
  function curls(cx, cy, r, p, n, seed) {
    let s = "";
    for (let i = 0; i < n; i += 1) {
      const a = seed + i * 2.399;
      const rr = r * Math.sqrt((i + 0.5) / n);
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr;
      s += `<path d="M${r1(x - 2.2)} ${r1(y + 0.8)} q${r1(0.6)} -3 3 -2.2 q2 1 0.2 3" fill="none" stroke="${lighten(p.fur, 0.35)}" stroke-width="1.3" stroke-linecap="round" opacity=".8"/>`;
    }
    return s;
  }

  /* -------------------------------- Body -------------------------------- */

  function legPts(x, g) {
    const top = g.legTop;
    const bot = g.ground - 4;
    const wt = g.legW * 0.66;
    const wb = g.legW * 0.54;
    return [
      [x - wt, top],
      [x - wt * 1.04, top + (bot - top) * 0.42],
      [x - wb, bot - 4],
      [x, bot + 1],
      [x + wb, bot - 4],
      [x + wt * 1.04, top + (bot - top) * 0.42],
      [x + wt, top],
      [x, top - 6],
    ];
  }
  const legPath = (x, g) => smooth(legPts(x, g));
  // outline without the top cap so the leg melts into the chest
  function legOutline(x, g) {
    const pts = legPts(x, g).slice(0, 7);
    return smooth([[pts[0][0] + 0.5, pts[0][1] - 4], ...pts, [pts[6][0] - 0.5, pts[6][1] - 4]], false);
  }

  function pawPath(x, y, w, h) {
    return smooth([
      [x - w, y + h * 0.15],
      [x - w * 0.85, y - h * 0.65],
      [x, y - h * 1.0],
      [x + w * 0.85, y - h * 0.65],
      [x + w, y + h * 0.15],
      [x + w * 0.5, y + h * 0.8],
      [x - w * 0.5, y + h * 0.8],
    ]);
  }

  function toeLines(x, y, w, h, color) {
    return `<path d="M${r1(x - w * 0.32)} ${r1(y + h * 0.75)} v${r1(-h * 0.7)} M${r1(x + w * 0.32)} ${r1(y + h * 0.75)} v${r1(-h * 0.7)}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" opacity=".6"/>`;
  }

  function bodyLayer(p, g, id) {
    const { cx, ground, th, bw, legX, legW } = g;
    const line = `stroke="${p.line}" stroke-width="2.4" stroke-linejoin="round"`;
    const bodyD = smooth(bodyPts(p, g));
    const clip = `${id}-bc`;
    // thighs + hind feet
    const tx = bw * 0.86;
    const thighs = [-1, 1]
      .map((s) => {
        const x = cx + s * tx;
        const y = ground - th * 0.86;
        const pts = [
          [x, y - th],
          [x + s * th * 0.82, y - th * 0.3],
          [x + s * th * 0.78, y + th * 0.55],
          [x, y + th * 0.88],
          [x - s * th * 0.8, y + th * 0.5],
          [x - s * th * 0.66, y - th * 0.5],
        ];
        return `<path d="${smooth(pts)}" fill="url(#${id}-fur)" ${line}/>
          <path d="M${r1(x - s * th * 0.4)} ${r1(y - th * 0.55)} Q${r1(x + s * th * 0.35)} ${r1(y - th * 0.7)} ${r1(x + s * th * 0.6)} ${r1(y)}" fill="none" stroke="${p.hi}" stroke-width="2.4" stroke-linecap="round" opacity=".55"/>`;
      })
      .join("");
    const pawFill = p.paw === "light" ? `url(#${id}-lt)` : `url(#${id}-fur)`;
    const hind = [-1, 1]
      .map((s) => {
        const x = cx + s * (tx + th * 0.35);
        const y = ground - 3;
        return `<path d="${pawPath(x, y, legW * 0.72, legW * 0.42)}" fill="${pawFill}" ${line}/>${toeLines(x, y - legW * 0.12, legW * 0.72, legW * 0.42, p.line)}`;
      })
      .join("");

    // markings on the torso
    let marks = "";
    const bib = `<path d="${smooth(bibPts(p, g))}" fill="url(#${id}-lt)"/>`;
    switch (p.pattern) {
      case "urajiro":
      case "corgi":
      case "husky":
      case "collie":
      case "golden":
      case "tri":
      case "frenchie":
      case "plain":
        break;
      case "saddle":
        marks += [-1, 1]
          .map((s) => `<ellipse cx="${r1(cx + s * bw * 1.02)}" cy="${r1(g.neck + g.chest * 0.42)}" rx="${r1(bw * 0.5)}" ry="${r1(g.chest * 0.62)}" fill="url(#${id}-pt)"/>`)
          .join("");
        break;
      case "spots": {
        const sp = [
          [-0.55, 0.3, 0.1],
          [0.6, 0.45, 0.085],
          [-0.2, 0.62, 0.065],
          [0.25, 0.2, 0.06],
          [-0.75, 0.75, 0.07],
          [0.78, 0.82, 0.06],
          [0.05, 0.86, 0.05],
        ];
        marks += sp
          .map(([sx, sy, sr]) => `<circle cx="${r1(cx + sx * bw)}" cy="${r1(g.neck + sy * (ground - g.neck))}" r="${r1(sr * bw * 1.2)}" fill="${p.patch}"/>`)
          .join("");
        break;
      }
      case "samoyed":
        marks += `<path d="${smooth(bibPts(p, g))}" fill="#ffffff" opacity=".9"/>`;
        break;
      case "curly":
        marks += curls(cx, g.neck + g.chest * 0.55, bw * 0.75, p, 12, 1.3);
        break;
      default:
        break;
    }
    // soft shadow under the head, falling on the chest
    marks += `<ellipse cx="${cx}" cy="${r1(g.chin + 2)}" rx="${r1(g.hw * 0.62)}" ry="${r1(9 + g.stage * 2)}" fill="url(#${id}-ao)" opacity=".75"/>`;
    // fur strokes
    const strokes = [-1, 1]
      .map(
        (s) => `<path d="M${r1(cx + s * bw * 0.55)} ${r1(g.neck + g.chest * 0.5)} q${r1(s * 3)} 5 ${r1(s * 1)} 9" fill="none" stroke="${p.shade}" stroke-width="1.4" stroke-linecap="round" opacity=".55"/>`
      )
      .join("");

    // front legs
    const legFill = (side) => {
      if (p.pattern === "tri") return `url(#${id}-pt)`;
      if (p.pattern === "husky" || p.pattern === "collie") return `url(#${id}-lt)`;
      return `url(#${id}-fur)`;
    };
    const legs = [-1, 1]
      .map((s) => {
        const x = cx + s * legX;
        const lp = legPath(x, g);
        const lclip = `${id}-l${s > 0 ? "r" : "l"}`;
        let lmarks = "";
        if (p.pattern === "urajiro" || p.pattern === "corgi") {
          lmarks = `<rect x="${r1(x - legW)}" y="${r1(g.legTop + (ground - g.legTop) * 0.5)}" width="${r1(legW * 2)}" height="${r1(ground)}" fill="url(#${id}-lt)"/>`;
        }
        if (p.pattern === "tri") {
          lmarks = `<rect x="${r1(x - legW)}" y="${r1(g.legTop - 4)}" width="${r1(legW * 2)}" height="${r1((ground - g.legTop) * 0.45)}" fill="url(#${id}-fur)"/>
            <rect x="${r1(x - legW)}" y="${r1(ground - legW * 0.9)}" width="${r1(legW * 2)}" height="${r1(legW)}" fill="url(#${id}-lt)"/>`;
        }
        if (p.pattern === "spots") {
          lmarks = `<circle cx="${r1(x + s * legW * 0.2)}" cy="${r1(g.legTop + (ground - g.legTop) * 0.45)}" r="${r1(legW * 0.22)}" fill="${p.patch}"/>`;
        }
        if (p.pattern === "curly") lmarks = curls(x, g.legTop + (ground - g.legTop) * 0.45, legW * 0.5, p, 3, s * 2);
        const pawY = ground - 5;
        const pw = legW * 0.68;
        const ph = legW * 0.5;
        const fade = `${id}-lf${s > 0 ? "r" : "l"}`;
        return `<clipPath id="${lclip}"><path d="${lp}"/></clipPath>
          <linearGradient id="${fade}g" gradientUnits="userSpaceOnUse" x1="0" y1="${r1(g.legTop - 4)}" x2="0" y2="${r1(g.legTop + 12)}"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff"/></linearGradient>
          <mask id="${fade}" maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="240"><rect x="0" y="0" width="200" height="240" fill="url(#${fade}g)"/></mask>
          <g mask="url(#${fade})">
          <path d="${lp}" fill="${legFill(s)}"/>
          <g clip-path="url(#${lclip})">${lmarks}
            <path d="M${r1(x + s * legW * 0.32)} ${r1(g.legTop)} V${r1(ground)}" stroke="${darken(p.fur, 0.25)}" stroke-width="${r1(legW * 0.3)}" opacity=".1"/>
          </g>
          <path d="${legOutline(x, g)}" fill="none" ${line}/>
          </g>
          <path d="${pawPath(x, pawY, pw, ph)}" fill="${p.paw === "light" || p.pattern === "tri" ? `url(#${id}-lt)` : `url(#${id}-leg)`}" ${line}/>
          ${toeLines(x, pawY - ph * 0.05, pw, ph, p.line)}`;
      })
      .join("");

    return {
      back: `${thighs}${hind}`,
      body: `<clipPath id="${clip}"><path d="${bodyD}"/></clipPath>
        <path d="${bodyD}" fill="url(#${id}-fur)"/>
        <g clip-path="url(#${clip})">${marks}${strokes}</g>
        <path d="${bodyD}" fill="none" ${line}/>`,
      thighs,
      hind,
      legs: legs + chestFront(p, g, id),
    };
  }

  /* -------------------------------- Head -------------------------------- */

  function headMarks(p, g, id) {
    const { cx, hw, hh, hy, ey, edx, er, my, mw, mh, chin } = g;
    const lt = `url(#${id}-lt)`;
    const pt = `url(#${id}-pt)`;
    // shared muzzle shape
    const muzzle = (w = mw, h = mh, fill = lt, dy = 0) =>
      `<path d="${smooth(
        sym([
          [cx, my - h * 1.05 + dy],
          [cx - w * 0.62, my - h * 0.85 + dy],
          [cx - w * 1.02, my - h * 0.05 + dy],
          [cx - w * 0.85, my + h * 0.75 + dy],
          [cx - w * 0.3, my + h * 1.1 + dy],
          [cx, my + h * 1.12 + dy],
        ])
      )}" fill="${fill}"/>`;
    const cheeks = (fill = lt, k = 1) =>
      [-1, 1].map((s) => `<ellipse cx="${r1(cx + s * hw * 0.62)}" cy="${r1(my + mh * 0.2)}" rx="${r1(hw * 0.46 * k)}" ry="${r1(hh * 0.4 * k)}" fill="${fill}"/>`).join("");
    const brows = (fill, rx = er * 0.62, ry = er * 0.42) =>
      [-1, 1]
        .map((s) => `<ellipse cx="${r1(cx + s * (edx - er * 0.15))}" cy="${r1(ey - er * 2.05)}" rx="${r1(rx)}" ry="${r1(ry)}" fill="${fill}" transform="rotate(${s * -12} ${r1(cx + s * edx)} ${r1(ey - er * 2)})"/>`)
        .join("");
    const blaze = (w0, w1, fill = lt) =>
      `<path d="${smooth(
        sym([
          [cx, hy - hh * 1.05],
          [cx - w0, hy - hh * 0.7],
          [cx - w0 * 0.7, ey - er * 0.6],
          [cx - w1, my - mh * 0.4],
          [cx, my],
        ])
      )}" fill="${fill}"/>`;
    let s = "";
    switch (p.pattern) {
      case "urajiro":
        s = cheeks(lt, 0.92) + muzzle(mw * 1.05) + brows(p.light);
        break;
      case "golden":
        s = muzzle(mw * 1.05, mh, lt) + `<ellipse cx="${cx}" cy="${r1(hy - hh * 0.45)}" rx="${r1(hw * 0.5)}" ry="${r1(hh * 0.4)}" fill="url(#${id}-shine)" opacity=".7"/>`;
        break;
      case "tri":
        s = blaze(hw * 0.1, mw * 0.55) + muzzle(mw * 1.02) + [-1, 1].map((k) => `<ellipse cx="${r1(cx + k * mw * 1.02)}" cy="${r1(my - mh * 0.05)}" rx="${r1(hw * 0.18)}" ry="${r1(hh * 0.2)}" fill="${pt}"/>`).join("") + brows(pt, er * 0.68, er * 0.48);
        break;
      case "saddle":
        s =
          muzzle(mw * 1.06, mh * 1.04, pt, 0) +
          [-1, 1].map((k) => `<ellipse cx="${r1(cx + k * edx)}" cy="${r1(ey + er * 0.2)}" rx="${r1(er * 1.6)}" ry="${r1(er * 1.4)}" fill="${pt}" opacity=".22"/>`).join("") +
          `<path d="${smooth(sym([[cx, hy - hh * 1.02], [cx - hw * 0.1, hy - hh * 0.6], [cx, ey - er * 0.2]]))}" fill="${pt}" opacity=".55"/>` +
          [-1, 1].map((k) => `<ellipse cx="${r1(cx + k * hw * 0.72)}" cy="${r1(my + mh * 0.2)}" rx="${r1(hw * 0.3)}" ry="${r1(hh * 0.32)}" fill="${lt}" opacity=".85"/>`).join("");
        break;
      case "husky":
        s =
          `<path d="${smooth(
            sym([
              [cx, ey + er * 0.4],
              [cx - edx * 0.6, ey - er * 0.8],
              [cx - edx - er * 1.6, ey - er * 1.0],
              [cx - hw * 1.1, ey + er * 1.4],
              [cx - hw * 1.0, chin],
              [cx, chin + 2],
            ])
          )}" fill="${lt}"/>` +
          brows(lt, er * 0.9, er * 0.62) +
          `<path d="${smooth(sym([[cx, hy - hh * 1.05], [cx - hw * 0.2, hy - hh * 0.7], [cx - hw * 0.07, ey - er * 0.6], [cx, ey + er * 0.1, 0.3]]))}" fill="${pt}"/>` +
          [-1, 1].map((k) => `<ellipse cx="${r1(cx + k * edx)}" cy="${r1(ey)}" rx="${r1(er * 1.55)}" ry="${r1(er * 1.4)}" fill="${pt}" opacity=".35"/>`).join("");
        break;
      case "corgi":
        s = cheeks(lt, 0.7) + blaze(hw * 0.12, mw * 0.5) + muzzle(mw * 1.04);
        break;
      case "samoyed":
        s = `<ellipse cx="${cx}" cy="${r1(my + mh * 0.3)}" rx="${r1(hw * 0.75)}" ry="${r1(hh * 0.55)}" fill="#ffffff"/>` + muzzle(mw, mh, "#ffffff");
        break;
      case "pug":
        s =
          muzzle(mw * 1.12, mh * 1.15, pt, mh * 0.1) +
          `<path d="M${r1(cx - hw * 0.28)} ${r1(ey - er * 2.4)} Q${cx} ${r1(ey - er * 3.0)} ${r1(cx + hw * 0.28)} ${r1(ey - er * 2.4)} M${r1(cx - hw * 0.18)} ${r1(ey - er * 1.8)} Q${cx} ${r1(ey - er * 2.25)} ${r1(cx + hw * 0.18)} ${r1(ey - er * 1.8)}" fill="none" stroke="${darken(p.fur, 0.38)}" stroke-width="2" stroke-linecap="round" opacity=".7"/>` +
          `<path d="M${r1(cx - mw * 1.15)} ${r1(my - mh * 0.9)} Q${cx} ${r1(my - mh * 1.7)} ${r1(cx + mw * 1.15)} ${r1(my - mh * 0.9)}" fill="none" stroke="${darken(p.fur, 0.2)}" stroke-width="2.4" stroke-linecap="round" opacity=".55"/>`;
        break;
      case "curly":
        s = muzzle(mw * 1.05, mh, lt) + curls(cx, hy - hh * 0.35, hw * 0.75, p, 9, 0.5) + [-1, 1].map((k) => curls(cx + k * hw * 0.72, hy + hh * 0.35, hw * 0.2, p, 2, k * 3)).join("");
        break;
      case "spots":
        s =
          [
            [-0.55, -0.55, 0.11],
            [0.48, -0.7, 0.08],
            [0.7, 0.1, 0.07],
            [-0.75, 0.25, 0.06],
            [0.12, -0.92, 0.06],
          ]
            .map(([sx, sy, sr]) => `<circle cx="${r1(cx + sx * hw)}" cy="${r1(hy + sy * hh)}" r="${r1(sr * hw)}" fill="${p.patch}"/>`)
            .join("") +
          [-1, 1].map((k) => [0, 1, 2].map((i) => `<circle cx="${r1(cx + k * mw * (0.45 + i * 0.18))}" cy="${r1(my + mh * (0.15 + (i % 2) * 0.22))}" r="1.1" fill="${p.patch}" opacity=".7"/>`).join("")).join("");
        break;
      case "collie":
        s = blaze(hw * 0.12, mw * 0.6) + muzzle(mw * 1.05) + cheeks(lt, 0.45);
        break;
      case "frenchie":
        s =
          muzzle(mw * 1.14, mh * 1.12, lt, mh * 0.08) +
          `<ellipse cx="${cx}" cy="${r1(g.ny - mh * 0.1)}" rx="${r1(mw * 0.85)}" ry="${r1(mh * 0.75)}" fill="${pt}" opacity=".5"/>` +
          [-1, 1].map((k) => `<path d="M${r1(cx + k * mw * 0.15)} ${r1(g.mouthY - 1)} Q${r1(cx + k * mw * 0.9)} ${r1(g.mouthY - 2)} ${r1(cx + k * mw * 1.05)} ${r1(my + mh * 1.0)}" fill="none" stroke="${darken(p.fur, 0.35)}" stroke-width="1.6" stroke-linecap="round" opacity=".5"/>`).join("") +
          `<path d="M${r1(cx - hw * 0.16)} ${r1(ey - er * 1.6)} Q${cx} ${r1(ey - er * 2.1)} ${r1(cx + hw * 0.16)} ${r1(ey - er * 1.6)} M${r1(cx - hw * 0.08)} ${r1(ey - er * 0.9)} Q${cx} ${r1(ey - er * 1.25)} ${r1(cx + hw * 0.08)} ${r1(ey - er * 0.9)}" fill="none" stroke="${darken(p.fur, 0.3)}" stroke-width="1.8" stroke-linecap="round" opacity=".55"/>`;
        break;
      default:
        s = muzzle(mw * 1.04, mh, lt);
    }
    // gentle top highlight + shading under the cheeks for volume
    s += `<ellipse cx="${r1(cx - hw * 0.15)}" cy="${r1(hy - hh * 0.55)}" rx="${r1(hw * 0.55)}" ry="${r1(hh * 0.32)}" fill="url(#${id}-shine)" opacity=".55"/>`;
    s += `<ellipse cx="${cx}" cy="${r1(chin + hh * 0.05)}" rx="${r1(hw * 1.05)}" ry="${r1(hh * 0.28)}" fill="url(#${id}-ao)" opacity=".5"/>`;
    return s;
  }

  function topknot(p, g, id) {
    if (!p.curly) return "";
    const { cx, hw, hh, hy } = g;
    const C = [cx, hy - hh * 0.6];
    const pts = [[cx - hw * 0.62, hy - hh * 0.62, 0.25]];
    pts.push(...fur([cx - hw * 0.62, hy - hh * 0.62], [cx - hw * 0.5, hy - hh * 1.5], [cx + hw * 0.1, hy - hh * 1.2], 3, 4, C, true));
    pts.push(...fur([cx + hw * 0.1, hy - hh * 1.2], [cx + hw * 0.75, hy - hh * 1.3], [cx + hw * 0.62, hy - hh * 0.62], 2, 4, C, true));
    pts.push([cx, hy - hh * 0.5]);
    return `<path d="${smooth(pts)}" fill="url(#${id}-fur)" stroke="${p.line}" stroke-width="2.2" stroke-linejoin="round"/>${curls(cx - hw * 0.1, hy - hh * 1.0, hw * 0.4, p, 6, 2.1)}`;
  }

  /* -------------------------------- Face -------------------------------- */

  function eye(x, y, rx, ry, p, id, side) {
    const blue = p.eyes === "blue";
    const hl = side < 0 ? 1 : 0.92;
    return `<g class="blink">
      <ellipse cx="${r1(x)}" cy="${r1(y + 0.4)}" rx="${r1(rx + 1.6)}" ry="${r1(ry + 1.5)}" fill="${p.rim}"/>
      <ellipse cx="${r1(x)}" cy="${r1(y)}" rx="${r1(rx)}" ry="${r1(ry)}" fill="url(#${id}-${blue ? "iris" : "eye"})"/>
      ${blue ? `<ellipse cx="${r1(x)}" cy="${r1(y + ry * 0.08)}" rx="${r1(rx * 0.46)}" ry="${r1(ry * 0.5)}" fill="#0f1a26"/>` : ""}
      <ellipse cx="${r1(x + rx * 0.3)}" cy="${r1(y - ry * 0.36)}" rx="${r1(rx * 0.42 * hl)}" ry="${r1(ry * 0.36 * hl)}" fill="#fff"/>
      <circle cx="${r1(x - rx * 0.38)}" cy="${r1(y + ry * 0.42)}" r="${r1(rx * 0.17)}" fill="#fff" opacity=".85"/>
      <path d="M${r1(x - rx * 0.6)} ${r1(y + ry * 0.62)} Q${r1(x)} ${r1(y + ry * 0.95)} ${r1(x + rx * 0.6)} ${r1(y + ry * 0.62)}" fill="none" stroke="#ffffff" stroke-width="1" stroke-linecap="round" opacity=".25"/>
    </g>`;
  }

  function noseSVG(p, g, id) {
    const { cx, ny, nz } = g;
    const w = nz;
    const h = nz * 0.74;
    const d = smooth([
      [cx - w, ny - h * 0.35],
      [cx - w * 0.6, ny - h * 0.78],
      [cx, ny - h * 0.82],
      [cx + w * 0.6, ny - h * 0.78],
      [cx + w, ny - h * 0.35],
      [cx + w * 0.45, ny + h * 0.45],
      [cx, ny + h * 0.62],
      [cx - w * 0.45, ny + h * 0.45],
    ]);
    return `<path d="${d}" fill="url(#${id}-nose)" stroke="${darken(p.nose, 0.3)}" stroke-width="1"/>
      <ellipse cx="${r1(cx - w * 0.3)}" cy="${r1(ny - h * 0.45)}" rx="${r1(w * 0.32)}" ry="${r1(h * 0.18)}" fill="#fff" opacity=".7"/>
      <path d="M${r1(cx - w * 0.5)} ${r1(ny + h * 0.02)} q${r1(w * 0.15)} ${r1(h * 0.2)} ${r1(w * 0.28)} 0 M${r1(cx + w * 0.5)} ${r1(ny + h * 0.02)} q${r1(-w * 0.15)} ${r1(h * 0.2)} ${r1(-w * 0.28)} 0" fill="none" stroke="#000" stroke-width="1.2" stroke-linecap="round" opacity=".45"/>`;
  }

  function faceLayers(p, g, id) {
    const { cx, ey, edx, er, ny, nz, mouthY, hw } = g;
    const mc = p.lips ? "#2b2530" : darken(p.fur === "#28242c" || p.fur === "#2a2528" ? "#4a3f45" : p.fur, 0.6);
    const mw = Math.max(nz * 1.05, hw * 0.17);
    const philtrum = `M${cx} ${r1(ny + nz * 0.45)} V${r1(mouthY)}`;
    const blush = (o) =>
      [-1, 1].map((s) => `<ellipse cx="${r1(cx + s * (edx + er * 0.5))}" cy="${r1(ey + er * 1.9)}" rx="${r1(er * 1.25)}" ry="${r1(er * 0.7)}" fill="url(#${id}-blush)" opacity="${o}"/>`).join("");
    const eyes = (k = 1) => [-1, 1].map((s) => eye(cx + s * edx, ey, er * 0.9 * k, er * 1.02 * k, p, id, s)).join("");
    const lid = [-1, 1]
      .map(
        (s) =>
          `<path d="M${r1(cx + s * edx - er * 1.05)} ${r1(ey - er * 0.7)} Q${r1(cx + s * edx)} ${r1(ey - er * 1.55)} ${r1(cx + s * edx + er * 1.05)} ${r1(ey - er * 0.7)}" fill="none" stroke="${mc}" stroke-width="1.4" stroke-linecap="round" opacity=".35"/>`
      )
      .join("");
    const smile = `<path d="${philtrum} M${r1(cx - mw)} ${r1(mouthY - 2)} Q${r1(cx - mw * 0.5)} ${r1(mouthY + 3.4)} ${cx} ${r1(mouthY)} Q${r1(cx + mw * 0.5)} ${r1(mouthY + 3.4)} ${r1(cx + mw)} ${r1(mouthY - 2)}" fill="none" stroke="${mc}" stroke-width="${p.lips ? 2.4 : 1.9}" stroke-linecap="round" stroke-linejoin="round"/>`;
    const tongueTip = `<path d="M${r1(cx - 3.2)} ${r1(mouthY + 0.6)} Q${cx} ${r1(mouthY + 7)} ${r1(cx + 3.2)} ${r1(mouthY + 0.6)}Z" fill="url(#${id}-tongue)" stroke="${mc}" stroke-width="1"/>`;
    const def = `<g class="ra-x ra-x-def">${eyes()}${lid}${blush(g.stage === 0 ? 0.55 : 0.35)}${smile}${g.stage === 0 ? tongueTip : ""}</g>`;

    const wowEyes = [-1, 1]
      .map((s) => {
        const x = cx + s * edx;
        return `${eye(x, ey, er * 1.06, er * 1.18, p, id, s)}<path d="M${r1(x + er * 0.15)} ${r1(ey - er * 0.15)} l1.2 -2.8 l1.2 2.8 l2.8 1.2 l-2.8 1.2 l-1.2 2.8 l-1.2 -2.8 l-2.8 -1.2Z" fill="#fff"/>`;
      })
      .join("");
    const wowBrows = [-1, 1]
      .map((s) => `<path d="M${r1(cx + s * edx - er * 0.9)} ${r1(ey - er * 2.2)} Q${r1(cx + s * edx)} ${r1(ey - er * 2.9)} ${r1(cx + s * edx + er * 0.9)} ${r1(ey - er * 2.2)}" fill="none" stroke="${mc}" stroke-width="1.8" stroke-linecap="round" opacity=".55"/>`)
      .join("");
    const wow = `<g class="ra-x ra-x-wow">${wowEyes}${wowBrows}${blush(0.55)}
      <path d="${philtrum}" fill="none" stroke="${mc}" stroke-width="1.8" stroke-linecap="round"/>
      <ellipse cx="${cx}" cy="${r1(mouthY + 4)}" rx="${r1(mw * 0.42)}" ry="${r1(mw * 0.5)}" fill="#6a2a2c" stroke="${mc}" stroke-width="1.6"/>
      <ellipse cx="${cx}" cy="${r1(mouthY + 5.5)}" rx="${r1(mw * 0.26)}" ry="${r1(mw * 0.22)}" fill="#f07f98"/>
    </g>`;

    const joyEyes = [-1, 1]
      .map((s) => {
        const x = cx + s * edx;
        return `<path d="M${r1(x - er * 1.0)} ${r1(ey + er * 0.35)} Q${r1(x)} ${r1(ey - er * 1.25)} ${r1(x + er * 1.0)} ${r1(ey + er * 0.35)}" fill="none" stroke="${mc}" stroke-width="${r1(Math.max(2.4, er * 0.42))}" stroke-linecap="round"/>`;
      })
      .join("");
    const mo = mw * 1.12;
    const mouthOpen = `<path d="M${r1(cx - mo)} ${r1(mouthY - 2)} Q${r1(cx - mo * 0.5)} ${r1(mouthY + 1.5)} ${cx} ${r1(mouthY - 0.5)} Q${r1(cx + mo * 0.5)} ${r1(mouthY + 1.5)} ${r1(cx + mo)} ${r1(mouthY - 2)} Q${r1(cx + mo * 0.75)} ${r1(mouthY + mo * 1.15)} ${cx} ${r1(mouthY + mo * 1.2)} Q${r1(cx - mo * 0.75)} ${r1(mouthY + mo * 1.15)} ${r1(cx - mo)} ${r1(mouthY - 2)}Z" fill="#6a2a2c" stroke="${mc}" stroke-width="1.8" stroke-linejoin="round"/>`;
    const tongue = `<path d="M${r1(cx - mo * 0.6)} ${r1(mouthY + mo * 0.55)} Q${cx} ${r1(mouthY + mo * 0.2)} ${r1(cx + mo * 0.6)} ${r1(mouthY + mo * 0.55)} Q${r1(cx + mo * 0.62)} ${r1(mouthY + mo * 1.55)} ${cx} ${r1(mouthY + mo * 1.6)} Q${r1(cx - mo * 0.62)} ${r1(mouthY + mo * 1.55)} ${r1(cx - mo * 0.6)} ${r1(mouthY + mo * 0.55)}Z" fill="url(#${id}-tongue)" stroke="${mc}" stroke-width="1.4"/>
      <path d="M${cx} ${r1(mouthY + mo * 0.7)} V${r1(mouthY + mo * 1.25)}" stroke="#d24c6c" stroke-width="1.2" stroke-linecap="round" opacity=".7"/>`;
    const joy = `<g class="ra-x ra-x-joy">${joyEyes}${blush(0.95)}<path d="${philtrum}" fill="none" stroke="${mc}" stroke-width="1.8" stroke-linecap="round"/>${mouthOpen}${tongue}</g>`;
    return { def, wow, joy };
  }

  function headLayer(p, g, id, outfit) {
    const hd = smooth(headPts(p, g));
    const clip = `${id}-hc`;
    const faces = faceLayers(p, g, id);
    const whisk = [-1, 1]
      .map((s) => [0, 1, 2].map((i) => `<circle cx="${r1(g.cx + s * g.mw * (0.5 + i * 0.17))}" cy="${r1(g.my + g.mh * (0.05 + (i % 2) * 0.22))}" r=".9" fill="${darken(p.light, 0.45)}" opacity=".55"/>`).join(""))
      .join("");
    return `<g class="ra-head" style="--head-bottom:${r1(g.headBottom)}px">
      ${earsBack(p, g, id)}
      <clipPath id="${clip}"><path d="${hd}"/></clipPath>
      <path d="${hd}" fill="url(#${id}-fur)"/>
      <g clip-path="url(#${clip})">${headMarks(p, g, id)}</g>
      <path d="${hd}" fill="none" stroke="${p.line}" stroke-width="2.5" stroke-linejoin="round"/>
      ${topknot(p, g, id)}
      ${earsFront(p, g, id)}
      ${p.pattern === "spots" || p.pattern === "pug" ? "" : whisk}
      ${noseSVG(p, g, id)}
      ${faces.def}${faces.wow}${faces.joy}
      ${itemFace(outfit.face, p, g, id)}
      ${itemHead(outfit.head, p, g, id)}
    </g>`;
  }

  /* ----------------------------- Accessories ---------------------------- */

  const INK = "#4a2e1c";
  const ln = (w = 2) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
  const lg = (gid, c1, c2, dir = 'x1="0" y1="0" x2="0" y2="1"') =>
    `<linearGradient id="${gid}" ${dir}><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>`;

  function daisy(x, y, r, rot = 0) {
    const petals = Array.from({ length: 8 }, (_, i) => {
      const a = (i * 360) / 8 + rot;
      return `<ellipse cx="${r1(x)}" cy="${r1(y - r * 0.62)}" rx="${r1(r * 0.3)}" ry="${r1(r * 0.55)}" fill="#ffffff" stroke="#d9cfd4" stroke-width=".8" transform="rotate(${r1(a)} ${r1(x)} ${r1(y)})"/>`;
    }).join("");
    return `<g>${petals}<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(r * 0.36)}" fill="#ffc93c" stroke="#e59a1c" stroke-width="1"/><circle cx="${r1(x - r * 0.1)}" cy="${r1(y - r * 0.12)}" r="${r1(r * 0.12)}" fill="#fff3b0"/></g>`;
  }

  function itemHead(itemId, p, g, id) {
    if (!itemId) return "";
    const { cx, hw, hh, hy } = g;
    const top = hy - hh;
    if (itemId === "flower") {
      const pts = [-0.78, -0.42, 0, 0.42, 0.78];
      const ys = (t) => top + hh * 0.18 + Math.abs(t) * Math.abs(t) * hh * 0.45;
      const vine = `<path d="M${r1(cx - hw * 0.92)} ${r1(ys(-1))} Q${cx} ${r1(top - hh * 0.06)} ${r1(cx + hw * 0.92)} ${r1(ys(1))}" fill="none" stroke="#6aa84f" stroke-width="3" stroke-linecap="round"/>`;
      const leaves = [-0.6, -0.2, 0.2, 0.6]
        .map((t) => {
          const x = cx + t * hw;
          const y = ys(t) + 1;
          return `<path d="M${r1(x)} ${r1(y)} q5 -6 10 -2 q-5 6 -10 2Z" fill="#8bc34a" stroke="#4e8a2f" stroke-width=".9" transform="rotate(${t * 40} ${r1(x)} ${r1(y)})"/>`;
        })
        .join("");
      return `<g class="ra-acc">${vine}${leaves}${pts.map((t, i) => daisy(cx + t * hw, ys(t), hw * (i === 2 ? 0.2 : 0.16), i * 11)).join("")}</g>`;
    }
    if (itemId === "bow") {
      const bx = cx + hw * 0.5;
      const by = top + hh * 0.2;
      const s = hw * 0.4;
      const gid = `${id}-bow`;
      return `<g class="ra-acc" transform="rotate(14 ${r1(bx)} ${r1(by)})">
        <defs>${lg(gid, "#ff9cc4", "#f0508f")}</defs>
        <path d="M${r1(bx - s * 0.15)} ${r1(by + s * 0.2)} l${r1(-s * 0.35)} ${r1(s * 1.0)} l${r1(s * 0.22)} ${r1(-s * 0.12)} l${r1(s * 0.18)} ${r1(s * 0.2)}Z M${r1(bx + s * 0.15)} ${r1(by + s * 0.2)} l${r1(s * 0.4)} ${r1(s * 0.95)} l${r1(-s * 0.22)} ${r1(-s * 0.1)} l${r1(-s * 0.16)} ${r1(s * 0.22)}Z" fill="#e8467f" ${ln(1.6)}/>
        <path d="M${r1(bx)} ${r1(by)} C${r1(bx - s * 0.5)} ${r1(by - s * 0.9)} ${r1(bx - s * 1.25)} ${r1(by - s * 0.55)} ${r1(bx - s * 1.1)} ${r1(by + s * 0.05)} C${r1(bx - s * 1.0)} ${r1(by + s * 0.6)} ${r1(bx - s * 0.45)} ${r1(by + s * 0.45)} ${r1(bx)} ${r1(by)}Z" fill="url(#${gid})" ${ln(1.8)}/>
        <path d="M${r1(bx)} ${r1(by)} C${r1(bx + s * 0.5)} ${r1(by - s * 0.9)} ${r1(bx + s * 1.25)} ${r1(by - s * 0.55)} ${r1(bx + s * 1.1)} ${r1(by + s * 0.05)} C${r1(bx + s * 1.0)} ${r1(by + s * 0.6)} ${r1(bx + s * 0.45)} ${r1(by + s * 0.45)} ${r1(bx)} ${r1(by)}Z" fill="url(#${gid})" ${ln(1.8)}/>
        <path d="M${r1(bx - s * 0.3)} ${r1(by - s * 0.15)} q${r1(-s * 0.35)} ${r1(-s * 0.25)} ${r1(-s * 0.6)} ${r1(-s * 0.05)} M${r1(bx + s * 0.3)} ${r1(by - s * 0.15)} q${r1(s * 0.35)} ${r1(-s * 0.25)} ${r1(s * 0.6)} ${r1(-s * 0.05)}" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".6"/>
        <ellipse cx="${r1(bx)}" cy="${r1(by)}" rx="${r1(s * 0.26)}" ry="${r1(s * 0.3)}" fill="#f0508f" ${ln(1.6)}/>
      </g>`;
    }
    if (itemId === "crown") {
      const w = hw * 0.78;
      const by = top + hh * 0.12;
      const h = hh * 0.5;
      const gid = `${id}-gold`;
      const d = `M${r1(cx - w / 2)} ${r1(by)} L${r1(cx - w * 0.56)} ${r1(by - h)} L${r1(cx - w * 0.22)} ${r1(by - h * 0.5)} L${cx} ${r1(by - h * 1.2)} L${r1(cx + w * 0.22)} ${r1(by - h * 0.5)} L${r1(cx + w * 0.56)} ${r1(by - h)} L${r1(cx + w / 2)} ${r1(by)} Q${cx} ${r1(by + h * 0.18)} ${r1(cx - w / 2)} ${r1(by)}Z`;
      return `<g class="ra-acc" transform="rotate(-6 ${cx} ${r1(by)})">
        <defs>${lg(gid, "#fff1a6", "#f2ae1c")}</defs>
        <path d="${d}" fill="url(#${gid})" ${ln(2)}/>
        <path d="M${r1(cx - w / 2 + 1)} ${r1(by - h * 0.18)} Q${cx} ${r1(by)} ${r1(cx + w / 2 - 1)} ${r1(by - h * 0.18)}" fill="none" stroke="#d4890e" stroke-width="2"/>
        ${[-0.56, 0, 0.56].map((t, i) => `<circle cx="${r1(cx + t * w)}" cy="${r1(by - h * (i === 1 ? 1.2 : 1))}" r="${r1(h * 0.13)}" fill="#fff6c4" ${ln(1.2)}/>`).join("")}
        <ellipse cx="${cx}" cy="${r1(by - h * 0.32)}" rx="${r1(h * 0.16)}" ry="${r1(h * 0.2)}" fill="#ff5b7f" ${ln(1.2)}/>
        <circle cx="${r1(cx - w * 0.3)}" cy="${r1(by - h * 0.2)}" r="${r1(h * 0.1)}" fill="#59c4ff" ${ln(1)}/>
        <circle cx="${r1(cx + w * 0.3)}" cy="${r1(by - h * 0.2)}" r="${r1(h * 0.1)}" fill="#59c4ff" ${ln(1)}/>
        <path d="M${r1(cx - w * 0.36)} ${r1(by - h * 0.7)} L${r1(cx - w * 0.3)} ${r1(by - h * 0.35)}" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".8"/>
      </g>`;
    }
    if (itemId === "beanie") {
      const by = hy - hh * 0.42;
      const gid = `${id}-knit`;
      const dome = `M${r1(cx - hw * 0.94)} ${r1(by)} C${r1(cx - hw * 0.94)} ${r1(top - hh * 0.55)} ${r1(cx + hw * 0.94)} ${r1(top - hh * 0.55)} ${r1(cx + hw * 0.94)} ${r1(by)}Z`;
      const ribs = Array.from({ length: 9 }, (_, i) => {
        const x = cx - hw * 0.8 + (i * hw * 1.6) / 8;
        return `<path d="M${r1(x)} ${r1(by - 2)} Q${r1(cx + (x - cx) * 0.6)} ${r1(top - hh * 0.1)} ${r1(cx + (x - cx) * 0.25)} ${r1(top - hh * 0.32)}" fill="none" stroke="#2f8a9a" stroke-width="1.2" opacity=".5"/>`;
      }).join("");
      const cuff = `M${r1(cx - hw * 1.0)} ${r1(by - hh * 0.06)} Q${cx} ${r1(by - hh * 0.26)} ${r1(cx + hw * 1.0)} ${r1(by - hh * 0.06)} L${r1(cx + hw * 0.98)} ${r1(by + hh * 0.2)} Q${cx} ${r1(by)} ${r1(cx - hw * 0.98)} ${r1(by + hh * 0.2)}Z`;
      const cuffRibs = Array.from({ length: 13 }, (_, i) => {
        const x = cx - hw * 0.9 + (i * hw * 1.8) / 12;
        const yy = by - hh * 0.16 + Math.pow((x - cx) / hw, 2) * hh * 0.1;
        return `<path d="M${r1(x)} ${r1(yy)} v${r1(hh * 0.2)}" stroke="#d26a2c" stroke-width="1.2" opacity=".55"/>`;
      }).join("");
      const pom = [];
      const px = cx + hw * 0.08;
      const py = top - hh * 0.42;
      const pr = hw * 0.2;
      for (let i = 0; i < 16; i += 1) {
        const a = (i / 16) * Math.PI * 2;
        const rr = pr * (i % 2 ? 1.12 : 0.98);
        pom.push([px + Math.cos(a) * rr, py + Math.sin(a) * rr, i % 2 ? 0.7 : 0.5]);
      }
      return `<g class="ra-acc">
        <defs>${lg(gid, "#7fd6e2", "#3fa6b8")}</defs>
        <path d="${dome}" fill="url(#${gid})" ${ln(2)}/>${ribs}
        <path d="${cuff}" fill="#ff9a4d" ${ln(2)}/>${cuffRibs}
        <path d="${smooth(pom)}" fill="#fff4e0" ${ln(1.8)}/>
        <ellipse cx="${r1(px - pr * 0.3)}" cy="${r1(py - pr * 0.35)}" rx="${r1(pr * 0.35)}" ry="${r1(pr * 0.25)}" fill="#fff"/>
      </g>`;
    }
    return "";
  }

  function collar(p, g, id) {
    const { cx, nw, collarY: y } = g;
    const w = nw * 1.12;
    const band = `M${r1(cx - w)} ${r1(y - 7)} Q${cx} ${r1(y + 7)} ${r1(cx + w)} ${r1(y - 7)}`;
    return `<g>
      <path d="${band}" fill="none" stroke="${INK}" stroke-width="8.5" stroke-linecap="round"/>
      <path d="${band}" fill="none" stroke="#e8564d" stroke-width="5.5" stroke-linecap="round"/>
      <path d="${band}" fill="none" stroke="#ff9a8c" stroke-width="1.4" stroke-linecap="round" stroke-dasharray="2 4" opacity=".8"/>
      <defs>${lg(`${id}-tag`, "#fff3a0", "#efb21c")}</defs>
      <circle cx="${cx}" cy="${r1(y + 1.5)}" r="2.2" fill="none" stroke="${INK}" stroke-width="1.4"/>
      <path d="M${r1(cx - 6)} ${r1(y + 5)} q-2.5 0 -2.5 2.5 q0 2 2.2 2.4 q-2.2 0.6 -2.2 2.6 q0 2.5 2.5 2.5 q1.6 0 2 -1.6 h4 q0.4 1.6 2 1.6 q2.5 0 2.5 -2.5 q0 -2 -2.2 -2.6 q2.2 -0.4 2.2 -2.4 q0 -2.5 -2.5 -2.5 q-1.6 0 -2 1.6 h-4 q-0.4 -1.6 -2 -1.6Z" fill="url(#${id}-tag)" ${ln(1.3)}/>
    </g>`;
  }

  function itemNeck(itemId, p, g, id) {
    if (!itemId) return "";
    const { cx, nw, collarY: y, hw } = g;
    const w = nw * 1.15;
    if (itemId === "scarf") {
      const gid = `${id}-scarf`;
      const band = `M${r1(cx - w - 2)} ${r1(y - 9)} Q${cx} ${r1(y + 6)} ${r1(cx + w + 2)} ${r1(y - 9)} L${r1(cx + w)} ${r1(y + 2)} Q${cx} ${r1(y + 17)} ${r1(cx - w)} ${r1(y + 2)}Z`;
      const tx = cx + w * 0.45;
      const tail = `M${r1(tx - 6)} ${r1(y + 4)} L${r1(tx + 8)} ${r1(y + 2)} L${r1(tx + 12)} ${r1(y + 30)} L${r1(tx - 2)} ${r1(y + 32)}Z`;
      const fringe = [0, 1, 2, 3].map((i) => `<path d="M${r1(tx - 1 + i * 3.6)} ${r1(y + 31.5 - i * 0.5)} v4" stroke="#d6403d" stroke-width="1.6" stroke-linecap="round"/>`).join("");
      return `<g class="ra-acc">
        <defs>${lg(gid, "#ff7b6e", "#e0443f")}</defs>
        <path d="${band}" fill="url(#${gid})" ${ln(2)}/>
        <path d="M${r1(cx - w + 2)} ${r1(y - 2)} Q${cx} ${r1(y + 12)} ${r1(cx + w - 2)} ${r1(y - 2)}" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="4 3" opacity=".7"/>
        <path d="${tail}" fill="url(#${gid})" ${ln(2)}/>
        <path d="M${r1(tx - 2)} ${r1(y + 12)} L${r1(tx + 10)} ${r1(y + 11)} M${r1(tx - 1)} ${r1(y + 20)} L${r1(tx + 11)} ${r1(y + 19)}" stroke="#fff" stroke-width="2" opacity=".75"/>
        ${fringe}
        <ellipse cx="${r1(tx + 1)}" cy="${r1(y + 3)}" rx="7" ry="5" fill="#e0443f" ${ln(1.8)}/>
      </g>`;
    }
    if (itemId === "bowtie") {
      const by = y + 3;
      const s = hw * 0.36;
      const gid = `${id}-ging`;
      const wing = (sg) =>
        `M${cx} ${r1(by)} C${r1(cx + sg * s * 0.4)} ${r1(by - s * 0.55)} ${r1(cx + sg * s * 1.1)} ${r1(by - s * 0.75)} ${r1(cx + sg * s * 1.15)} ${r1(by - s * 0.2)} L${r1(cx + sg * s * 1.15)} ${r1(by + s * 0.25)} C${r1(cx + sg * s * 1.1)} ${r1(by + s * 0.75)} ${r1(cx + sg * s * 0.4)} ${r1(by + s * 0.55)} ${cx} ${r1(by)}Z`;
      return `<g class="ra-acc">
        <defs><pattern id="${gid}" width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill="#8fd0ff"/><rect width="2.5" height="5" fill="#3d8fd6" opacity=".55"/><rect width="5" height="2.5" fill="#3d8fd6" opacity=".55"/></pattern></defs>
        ${collar(p, g, id).replace(/#e8564d/g, "#3d8fd6").replace(/#ff9a8c/g, "#a9dbff").replace(/<path d="M[^"]*q-2\.5[^>]*\/>/, "").replace(/<circle[^>]*\/>/, "")}
        <path d="${wing(-1)}" fill="url(#${gid})" ${ln(1.8)}/>
        <path d="${wing(1)}" fill="url(#${gid})" ${ln(1.8)}/>
        <rect x="${r1(cx - s * 0.22)}" y="${r1(by - s * 0.32)}" width="${r1(s * 0.44)}" height="${r1(s * 0.64)}" rx="${r1(s * 0.14)}" fill="#2f6fae" ${ln(1.6)}/>
      </g>`;
    }
    if (itemId === "bell") {
      const by = y + 6;
      const gid = `${id}-bellg`;
      const band = `M${r1(cx - w)} ${r1(y - 7)} Q${cx} ${r1(y + 7)} ${r1(cx + w)} ${r1(y - 7)}`;
      return `<g class="ra-acc">
        <defs><radialGradient id="${gid}" cx="35%" cy="30%" r="70%"><stop offset="0" stop-color="#fff8c8"/><stop offset=".55" stop-color="#f6c533"/><stop offset="1" stop-color="#c98a0e"/></radialGradient></defs>
        <path d="${band}" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>
        <path d="${band}" fill="none" stroke="#9a6be0" stroke-width="6" stroke-linecap="round"/>
        <path d="${band}" fill="none" stroke="#c9a8ff" stroke-width="1.6" stroke-linecap="round" opacity=".8" transform="translate(0 -1.4)"/>
        <circle cx="${cx}" cy="${r1(by + 3)}" r="7.5" fill="url(#${gid})" ${ln(1.8)}/>
        <path d="M${r1(cx - 7)} ${r1(by + 2.5)} H${r1(cx + 7)}" stroke="#c98a0e" stroke-width="1.4"/>
        <path d="M${cx} ${r1(by + 5)} v4" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>
        <circle cx="${cx}" cy="${r1(by + 5)}" r="1.6" fill="${INK}"/>
        <ellipse cx="${r1(cx - 2.6)}" cy="${r1(by)}" rx="2" ry="1.4" fill="#fff" opacity=".9"/>
      </g>`;
    }
    if (itemId === "bandana") {
      const by = y - 4;
      const gid = `${id}-dots`;
      const tri = `M${r1(cx - w - 2)} ${r1(by - 4)} Q${cx} ${r1(by + 10)} ${r1(cx + w + 2)} ${r1(by - 4)} L${r1(cx + w * 0.3)} ${r1(by + w * 0.95)} Q${cx} ${r1(by + w * 1.12)} ${r1(cx - w * 0.3)} ${r1(by + w * 0.95)}Z`;
      return `<g class="ra-acc">
        <defs><pattern id="${gid}" width="7" height="7" patternUnits="userSpaceOnUse"><rect width="7" height="7" fill="#ff6f61"/><circle cx="2" cy="2" r="1.3" fill="#fff"/><circle cx="5.5" cy="5.5" r="1.3" fill="#fff"/></pattern></defs>
        <path d="${tri}" fill="url(#${gid})" ${ln(2)}/>
        <path d="M${r1(cx - w)} ${r1(by - 1)} Q${cx} ${r1(by + 12)} ${r1(cx + w)} ${r1(by - 1)}" fill="none" stroke="#c9372c" stroke-width="2" opacity=".6"/>
        <path d="M${r1(cx - w - 3)} ${r1(by - 5)} l-5 -3 l1 6Z M${r1(cx + w + 3)} ${r1(by - 5)} l5 -3 l-1 6Z" fill="#ff6f61" ${ln(1.4)}/>
      </g>`;
    }
    return "";
  }

  function itemBackBehind(itemId, p, g, id) {
    if (!itemId) return "";
    const { cx, bw, neck, chest, ground } = g;
    if (itemId === "cape") {
      const gid = `${id}-cape`;
      const d = `M${r1(cx - g.nw)} ${r1(neck)} C${r1(cx - bw * 1.4)} ${r1(neck + chest * 0.6)} ${r1(cx - bw * 1.6)} ${r1(ground - 6)} ${r1(cx - bw * 1.35)} ${r1(ground + 2)} Q${r1(cx - bw * 1.1)} ${r1(ground - 6)} ${r1(cx - bw * 0.9)} ${r1(ground + 2)} L${r1(cx + bw * 0.9)} ${r1(ground + 2)} Q${r1(cx + bw * 1.1)} ${r1(ground - 6)} ${r1(cx + bw * 1.35)} ${r1(ground + 2)} C${r1(cx + bw * 1.6)} ${r1(ground - 6)} ${r1(cx + bw * 1.4)} ${r1(neck + chest * 0.6)} ${r1(cx + g.nw)} ${r1(neck)}Z`;
      return `<g class="ra-acc ra-cape">
        <defs>${lg(gid, "#ff6f8a", "#c22a4c")}</defs>
        <path d="${d}" fill="url(#${gid})" ${ln(2.2)}/>
        <path d="M${r1(cx - bw * 1.15)} ${r1(ground - 2)} Q${r1(cx - bw * 1.2)} ${r1(neck + chest * 0.6)} ${r1(cx - g.nw * 0.9)} ${r1(neck + 6)} M${r1(cx + bw * 1.15)} ${r1(ground - 2)} Q${r1(cx + bw * 1.2)} ${r1(neck + chest * 0.6)} ${r1(cx + g.nw * 0.9)} ${r1(neck + 6)}" fill="none" stroke="#a01d3c" stroke-width="2" opacity=".5"/>
        <path d="M${r1(cx - bw * 1.32)} ${r1(ground - 10)} Q${r1(cx - bw * 1.45)} ${r1(neck + chest * 0.7)} ${r1(cx - g.nw * 1.2)} ${r1(neck + 4)}" fill="none" stroke="#ffd0da" stroke-width="2" stroke-linecap="round" opacity=".5"/>
      </g>`;
    }
    if (itemId === "wings") {
      const gid = `${id}-wing`;
      const W = Math.max(bw * 0.98, 38);
      const H = Math.max(chest * 0.82, 36);
      const wing = (sg) => {
        const x0 = cx + sg * bw * 0.72;
        const y0 = neck + chest * 0.55;
        const P = (fx, fy, k) => [x0 + sg * W * fx, y0 + H * fy, k];
        const outline = [
          P(0, 0),
          P(0.25, -0.55),
          P(0.7, -0.98),
          P(1.02, -0.92, 0.3),
          P(0.98, -0.5, 0.3),
          P(0.8, -0.48, 0.45),
          P(0.84, -0.12, 0.3),
          P(0.62, -0.12, 0.45),
          P(0.6, 0.24, 0.3),
          P(0.38, 0.08, 0.45),
          P(0.3, 0.32, 0.3),
          P(0.12, 0.18),
        ];
        const lines = [
          [P(0.18, -0.2), P(0.55, -0.55), P(0.8, -0.5)],
          [P(0.15, -0.05), P(0.45, -0.2), P(0.62, -0.14)],
        ]
          .map((l) => `<path d="${smooth(l, false)}" fill="none" stroke="#9cc8ea" stroke-width="1.4" stroke-linecap="round"/>`)
          .join("");
        return `<g class="ra-wing"><path d="${smooth(outline)}" fill="url(#${gid})" ${ln(2)}/>${lines}
          <path d="${smooth([P(0.3, -0.6), P(0.65, -0.88), P(0.92, -0.86)], false)}" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".9"/></g>`;
      };
      return `<g class="ra-acc">
        <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#cfe6ff"/></linearGradient></defs>
        ${wing(-1)}${wing(1)}
      </g>`;
    }
    if (itemId === "backpack") {
      const gid = `${id}-pack`;
      const x = cx - bw * 1.25;
      const y = neck + chest * 0.12;
      const W = bw * 0.62;
      const H = chest * 0.85;
      return `<g class="ra-acc">
        <defs>${lg(gid, "#a8d65a", "#6c9f2a")}</defs>
        <rect x="${r1(x)}" y="${r1(y)}" width="${r1(W)}" height="${r1(H)}" rx="${r1(W * 0.32)}" fill="url(#${gid})" ${ln(2)}/>
        <path d="M${r1(x)} ${r1(y + H * 0.36)} Q${r1(x + W / 2)} ${r1(y + H * 0.2)} ${r1(x + W)} ${r1(y + H * 0.36)} L${r1(x + W)} ${r1(y + W * 0.32)} Q${r1(x + W)} ${r1(y)} ${r1(x + W * 0.68)} ${r1(y)} L${r1(x + W * 0.32)} ${r1(y)} Q${r1(x)} ${r1(y)} ${r1(x)} ${r1(y + W * 0.32)}Z" fill="#c8e88a" ${ln(1.8)}/>
        <rect x="${r1(x + W * 0.2)}" y="${r1(y + H * 0.55)}" width="${r1(W * 0.6)}" height="${r1(H * 0.3)}" rx="4" fill="#8cc045" ${ln(1.5)}/>
        <rect x="${r1(x + W * 0.44)}" y="${r1(y + H * 0.28)}" width="${r1(W * 0.12)}" height="${r1(H * 0.12)}" rx="1.5" fill="#ffd447" ${ln(1)}/>
      </g>`;
    }
    return "";
  }

  function itemBackFront(itemId, p, g, id) {
    if (!itemId) return "";
    const { cx, bw, neck, chest, nw } = g;
    if (itemId === "backpack") {
      const strap = (s) => `M${r1(cx + s * nw * 0.95)} ${r1(neck - 2)} Q${r1(cx + s * bw * 0.6)} ${r1(neck + chest * 0.45)} ${r1(cx + s * bw * 0.72)} ${r1(neck + chest * 0.9)}`;
      return `<g class="ra-acc">
        ${[-1, 1].map((s) => `<path d="${strap(s)}" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="${strap(s)}" fill="none" stroke="#7fb236" stroke-width="5" stroke-linecap="round"/>`).join("")}
        ${[-1, 1].map((s) => `<rect x="${r1(cx + s * bw * 0.62 - 3.5)}" y="${r1(neck + chest * 0.45)}" width="7" height="5" rx="1.5" fill="#ffd447" ${ln(1.2)}/>`).join("")}
      </g>`;
    }
    if (itemId === "cape") {
      const y = g.collarY;
      const w = nw * 1.1;
      return `<g class="ra-acc">
        <path d="M${r1(cx - w)} ${r1(y - 8)} Q${r1(cx - w * 0.5)} ${r1(y + 10)} ${cx} ${r1(y + 6)} Q${r1(cx + w * 0.5)} ${r1(y + 10)} ${r1(cx + w)} ${r1(y - 8)}" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>
        <path d="M${r1(cx - w)} ${r1(y - 8)} Q${r1(cx - w * 0.5)} ${r1(y + 10)} ${cx} ${r1(y + 6)} Q${r1(cx + w * 0.5)} ${r1(y + 10)} ${r1(cx + w)} ${r1(y - 8)}" fill="none" stroke="#e23c5f" stroke-width="4" stroke-linecap="round"/>
        <defs>${lg(`${id}-clasp`, "#fff3a0", "#efb21c")}</defs>
        <path d="M${cx} ${r1(y)} l5 5.5 l-5 5.5 l-5 -5.5Z" fill="url(#${id}-clasp)" ${ln(1.5)}/>
      </g>`;
    }
    return "";
  }

  function itemPaws(itemId, p, g, id) {
    if (!itemId) return "";
    const { cx, legX, legW, ground } = g;
    const xs = [cx - legX, cx + legX];
    const wt = legW * 0.66;
    if (itemId === "socks") {
      return `<g class="ra-acc">${xs
        .map((x, i) => {
          const top = ground - legW * 2.3;
          const clip = `${id}-sock${i}`;
          const sockD = `M${r1(x - wt)} ${r1(top)} L${r1(x + wt)} ${r1(top)} L${r1(x + wt * 1.05)} ${r1(ground - 7)} Q${r1(x + wt * 1.18)} ${r1(ground + 1)} ${r1(x)} ${r1(ground + 1)} Q${r1(x - wt * 1.18)} ${r1(ground + 1)} ${r1(x - wt * 1.05)} ${r1(ground - 7)}Z`;
          return `<clipPath id="${clip}"><path d="${sockD}"/></clipPath>
            <path d="${sockD}" fill="#ffffff"/>
            <g clip-path="url(#${clip})">${[0, 1, 2, 3].map((k) => `<rect x="${r1(x - wt * 1.3)}" y="${r1(top + 5 + k * legW * 0.42)}" width="${r1(wt * 2.6)}" height="${r1(legW * 0.2)}" fill="${k % 2 ? "#ffcf3f" : "#5bb6f2"}"/>`).join("")}
              <ellipse cx="${r1(x)}" cy="${r1(ground - 2)}" rx="${r1(wt)}" ry="${r1(legW * 0.35)}" fill="#ff8fa8"/></g>
            <path d="${sockD}" fill="none" ${ln(1.8)}/>
            <rect x="${r1(x - wt * 1.08)}" y="${r1(top - 2)}" width="${r1(wt * 2.16)}" height="5" rx="2.5" fill="#f2f2f2" ${ln(1.5)}/>`;
        })
        .join("")}</g>`;
    }
    if (itemId === "boots") {
      const gid = `${id}-boot`;
      return `<g class="ra-acc"><defs>${lg(gid, "#ffe36a", "#f2b51c")}</defs>${xs
        .map((x) => {
          const top = ground - legW * 2.2;
          const d = `M${r1(x - wt * 1.05)} ${r1(top)} L${r1(x + wt * 1.05)} ${r1(top)} L${r1(x + wt * 1.12)} ${r1(ground - 7)} Q${r1(x + wt * 1.45)} ${r1(ground - 4)} ${r1(x + wt * 1.4)} ${r1(ground + 1)} L${r1(x - wt * 1.4)} ${r1(ground + 1)} Q${r1(x - wt * 1.45)} ${r1(ground - 4)} ${r1(x - wt * 1.12)} ${r1(ground - 7)}Z`;
          return `<path d="${d}" fill="url(#${gid})" ${ln(1.9)}/>
            <rect x="${r1(x - wt * 1.42)}" y="${r1(ground - 2.5)}" width="${r1(wt * 2.84)}" height="4" rx="2" fill="#c98a0e" ${ln(1.4)}/>
            <rect x="${r1(x - wt * 1.15)}" y="${r1(top - 2)}" width="${r1(wt * 2.3)}" height="5" rx="2.5" fill="#ffd447" ${ln(1.5)}/>
            <path d="M${r1(x - wt * 0.55)} ${r1(top + 6)} V${r1(ground - 9)}" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".7"/>`;
        })
        .join("")}</g>`;
    }
    if (itemId === "bracelet") {
      const x = xs[0];
      const y = ground - legW * 1.6;
      const gid = `${id}-brc`;
      return `<g class="ra-acc"><defs>${lg(gid, "#fff3a0", "#e2a114")}</defs>
        <ellipse cx="${r1(x)}" cy="${r1(y)}" rx="${r1(wt * 1.12)}" ry="${r1(legW * 0.22)}" fill="none" stroke="${INK}" stroke-width="5.6"/>
        <ellipse cx="${r1(x)}" cy="${r1(y)}" rx="${r1(wt * 1.12)}" ry="${r1(legW * 0.22)}" fill="none" stroke="url(#${gid})" stroke-width="3.2"/>
        <path d="M${r1(x + wt * 0.3)} ${r1(y + 2)} q2.6 -3 5.2 0 q0 3 -2.6 5.4 q-2.6 -2.4 -2.6 -5.4Z" fill="#ff6b8b" ${ln(1.1)}/>
      </g>`;
    }
    return "";
  }

  function itemFace(itemId, p, g, id) {
    if (!itemId) return "";
    const { cx, ey, edx, er } = g;
    const R = er * 1.75;
    if (itemId === "glasses") {
      const gid = `${id}-tort`;
      return `<g class="ra-acc">
        <defs>${lg(gid, "#a8643a", "#5a3020")}</defs>
        ${[-1, 1].map((s) => `<circle cx="${r1(cx + s * edx)}" cy="${r1(ey)}" r="${r1(R)}" fill="#e8f6ff" fill-opacity=".22" stroke="${INK}" stroke-width="4.4"/><circle cx="${r1(cx + s * edx)}" cy="${r1(ey)}" r="${r1(R)}" fill="none" stroke="url(#${gid})" stroke-width="2.6"/>`).join("")}
        <path d="M${r1(cx - edx + R)} ${r1(ey - 1)} Q${cx} ${r1(ey - R * 0.5)} ${r1(cx + edx - R)} ${r1(ey - 1)}" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>
        ${[-1, 1].map((s) => `<path d="M${r1(cx + s * (edx + R * 0.95))} ${r1(ey - R * 0.25)} L${r1(cx + s * (edx + R * 1.6))} ${r1(ey - R * 0.55)}" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`).join("")}
        ${[-1, 1].map((s) => `<path d="M${r1(cx + s * edx - R * 0.55)} ${r1(ey - R * 0.25)} q${r1(R * 0.3)} ${r1(-R * 0.4)} ${r1(R * 0.7)} ${r1(-R * 0.4)}" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>`).join("")}
      </g>`;
    }
    if (itemId === "sunglasses") {
      const gid = `${id}-lens`;
      const lens = (s) => {
        const x = cx + s * edx;
        return `M${r1(x - R * 1.15)} ${r1(ey - R * 0.75)} L${r1(x + R * 1.15)} ${r1(ey - R * 0.75)} Q${r1(x + R * 1.2)} ${r1(ey + R * 0.95)} ${r1(x)} ${r1(ey + R * 0.95)} Q${r1(x - R * 1.2)} ${r1(ey + R * 0.95)} ${r1(x - R * 1.15)} ${r1(ey - R * 0.75)}Z`;
      };
      return `<g class="ra-acc">
        <defs>${lg(gid, "#4a5468", "#151821")}</defs>
        <path d="M${r1(cx - edx - R * 1.15)} ${r1(ey - R * 0.75)} H${r1(cx + edx + R * 1.15)}" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
        ${[-1, 1].map((s) => `<path d="${lens(s)}" fill="url(#${gid})" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>`).join("")}
        ${[-1, 1].map((s) => `<path d="M${r1(cx + s * edx - R * 0.7)} ${r1(ey - R * 0.35)} l${r1(R * 0.5)} ${r1(R * 0.75)} M${r1(cx + s * edx - R * 0.2)} ${r1(ey - R * 0.45)} l${r1(R * 0.3)} ${r1(R * 0.45)}" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".55"/>`).join("")}
      </g>`;
    }
    return "";
  }

  /* ------------------------------ Compose ------------------------------- */

  function viewBox(p, g) {
    const earTop = ["up", "bat", "semi"].includes(p.ear.type) ? g.hy - g.hh * (0.95 + p.ear.len) : g.hy - g.hh - (p.curly ? 12 : 4);
    const top = Math.min(earTop, g.hy - g.hh * 1.42) - 6;
    const bottom = g.ground + 10;
    const h = bottom - top;
    const w = Math.max(h * 0.86, 150);
    return `${r1(100 - w / 2)} ${r1(top)} ${r1(w)} ${r1(h)}`;
  }

  function dogBodySVG(type, stage = 2, { outfit = {}, mood = "def" } = {}) {
    const p = BREEDS[type] || BREEDS.shiba;
    const g = geom(p, clamp(stage, 0, 2));
    const id = `ra${(SEQ += 1)}`;
    const o = outfit || {};
    const body = bodyLayer(p, g, id);
    const neckWear = o.neck ? itemNeck(o.neck, p, g, id) : o.back === "cape" ? "" : collar(p, g, id);
    return `<svg class="raise-dog raise-dog--${type}" viewBox="${viewBox(p, g)}" preserveAspectRatio="xMidYMax meet" data-mood="${mood}" data-stage="${g.stage}" overflow="visible" aria-hidden="true" focusable="false">
      ${defs(id, p)}
      <ellipse cx="100" cy="${r1(g.ground + 1)}" rx="${r1(g.bw * 1.45)}" ry="${r1(7 + g.stage)}" fill="url(#${id}-ao)" opacity=".9"/>
      ${itemBackBehind(o.back, p, g, id)}
      ${tail(p, g, id)}
      ${body.body}
      ${body.thighs}
      ${body.hind}
      ${body.legs}
      ${itemPaws(o.paws, p, g, id)}
      ${itemBackFront(o.back, p, g, id)}
      ${neckWear}
      ${headLayer(p, g, id, o)}
    </svg>`;
  }

  // Standalone accessory icon for the wardrobe grid. The art is drawn with the
  // same code that dresses the dog, then cropped to its own bounding box.
  const ICON_BOX = {};
  function measure(art) {
    if (typeof document === "undefined" || !document.body) return null;
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("width", "10");
    svg.setAttribute("height", "10");
    svg.style.cssText = "position:absolute;left:-9999px;top:0;visibility:hidden";
    svg.innerHTML = `<g>${art}</g>`;
    document.body.appendChild(svg);
    let box = null;
    try {
      const b = svg.firstChild.getBBox();
      if (b.width && b.height) box = b;
    } catch (e) {
      box = null;
    }
    svg.remove();
    return box;
  }

  function itemIconSVG(itemId) {
    const item = ITEM_MAP[itemId];
    if (!item) return "";
    const p = BREEDS.golden;
    const g = geom(p, 2);
    const id = `ri${(SEQ += 1)}`;
    let art = "";
    switch (item.slot) {
      case "head":
        art = itemHead(itemId, p, g, id);
        break;
      case "face":
        art = itemFace(itemId, p, g, id);
        break;
      case "neck":
        art = itemNeck(itemId, p, g, id);
        break;
      case "paws":
        art = itemPaws(itemId, p, g, id);
        break;
      default:
        art = itemId === "backpack" ? itemBackBehind(itemId, p, g, id) : itemBackBehind(itemId, p, g, id) + itemBackFront(itemId, p, g, id);
    }
    if (!ICON_BOX[itemId]) {
      const b = measure(art);
      if (b) {
        const size = Math.max(b.width, b.height) * 1.12 + 4;
        ICON_BOX[itemId] = [b.x + b.width / 2 - size / 2, b.y + b.height / 2 - size / 2, size, size];
      }
    }
    const vb = ICON_BOX[itemId] || [40, 40, 120, 120];
    return `<svg class="raise-item-icon" viewBox="${vb.map(r1).join(" ")}" aria-hidden="true" focusable="false">${art}</svg>`;
  }

  /* ------------------------------ Scenery ------------------------------- */

  function roomSVG() {
    const planks = Array.from({ length: 10 }, (_, i) => {
      const x0 = -40 + i * 50;
      return `<path d="M${180 + (x0 - 180) * 0.62} 236 L${180 + (x0 - 180) * 1.6} 340" stroke="#b97a43" stroke-width="2" opacity=".55"/>`;
    }).join("");
    const dots = Array.from({ length: 8 }, (_, r) =>
      Array.from({ length: 10 }, (_, c) => `<circle cx="${c * 40 + (r % 2) * 20}" cy="${16 + r * 30}" r="2.4" fill="#fff" opacity=".45"/>`).join("")
    ).join("");
    return `<svg class="raise-room__art" viewBox="0 0 360 340" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="rmWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1dc"/><stop offset="1" stop-color="#ffdcb5"/></linearGradient>
        <linearGradient id="rmFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e5ac6f"/><stop offset="1" stop-color="#c98a4f"/></linearGradient>
        <linearGradient id="rmSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd4ff"/><stop offset="1" stop-color="#e2f6ff"/></linearGradient>
        <radialGradient id="rmRug" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#fff3d1"/><stop offset=".7" stop-color="#ffd59a"/><stop offset="1" stop-color="#f4b56d"/></radialGradient>
        <radialGradient id="rmLight" cx="50%" cy="20%" r="70%"><stop offset="0" stop-color="#fff9e8" stop-opacity=".9"/><stop offset="1" stop-color="#fff9e8" stop-opacity="0"/></radialGradient>
        <linearGradient id="rmBed" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb7a8"/><stop offset="1" stop-color="#ef8a78"/></linearGradient>
        <linearGradient id="rmBowl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fdcff"/><stop offset="1" stop-color="#3fa8e0"/></linearGradient>
        <linearGradient id="rmCurtain" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffb2a2"/><stop offset=".5" stop-color="#ff9583"/><stop offset="1" stop-color="#ffb2a2"/></linearGradient>
      </defs>
      <rect width="360" height="240" fill="url(#rmWall)"/>
      ${dots}
      <rect y="196" width="360" height="44" fill="#ffd0a0"/>
      <rect y="194" width="360" height="6" fill="#f2b783"/>
      ${Array.from({ length: 13 }, (_, i) => `<rect x="${i * 30 + 6}" y="204" width="18" height="30" rx="4" fill="#ffdcb5" opacity=".7"/>`).join("")}
      <path d="M0 236 H360 V340 H0Z" fill="url(#rmFloor)"/>
      ${planks}
      <path d="M0 236 H360" stroke="#a96a35" stroke-width="3"/>
      <ellipse cx="180" cy="160" rx="200" ry="140" fill="url(#rmLight)"/>

      <!-- window -->
      <g transform="translate(26 30)">
        <rect x="-4" y="-4" width="102" height="96" rx="16" fill="#fff8ec" stroke="#6b4527" stroke-width="3"/>
        <rect x="6" y="6" width="82" height="76" rx="9" fill="url(#rmSky)"/>
        <circle cx="70" cy="24" r="10" fill="#fff4a8"/>
        <path d="M14 46 q6 -10 16 -6 q4 -8 13 -3 q8 -2 9 6 q6 2 3 7 h-38 q-6 -2 -3 -4Z" fill="#fff"/>
        <path d="M6 70 q20 -12 40 -4 q20 -10 42 2 v14 h-82Z" fill="#9fd98b"/>
        <path d="M47 6 V82 M6 44 H88" stroke="#fff8ec" stroke-width="4"/>
        <path d="M-10 -8 Q4 30 -6 98 L14 98 Q18 40 10 -8Z" fill="url(#rmCurtain)" stroke="#c96a5c" stroke-width="2"/>
        <path d="M104 -8 Q90 30 100 98 L80 98 Q76 40 84 -8Z" fill="url(#rmCurtain)" stroke="#c96a5c" stroke-width="2"/>
        <rect x="-14" y="-12" width="122" height="7" rx="3.5" fill="#a8683a" stroke="#6b4527" stroke-width="2"/>
      </g>

      <!-- frame -->
      <g transform="translate(160 26) rotate(3)">
        <rect width="44" height="38" rx="6" fill="#ffe08a" stroke="#6b4527" stroke-width="2.5"/>
        <rect x="6" y="6" width="32" height="26" rx="3" fill="#ffffff"/>
        <g fill="#ff8a7a"><circle cx="22" cy="21" r="5"/><circle cx="15" cy="14" r="2.6"/><circle cx="20" cy="11.5" r="2.6"/><circle cx="25.5" cy="11.5" r="2.6"/><circle cx="30" cy="14.5" r="2.6"/></g>
      </g>

      <!-- shelf with plant and toys -->
      <g transform="translate(232 84)">
        <rect x="0" y="0" width="112" height="10" rx="4" fill="#b57442" stroke="#6b4527" stroke-width="2.5"/>
        <path d="M10 10 l6 12 M100 10 l-6 12" stroke="#6b4527" stroke-width="3" stroke-linecap="round"/>
        <path d="M14 0 l3 -18 h18 l3 18Z" fill="#ff9a62" stroke="#6b4527" stroke-width="2"/>
        <path d="M26 -18 q-14 -14 -8 -30 q8 8 8 22 q2 -18 14 -24 q2 16 -10 30 q14 -10 22 -4 q-8 8 -26 6Z" fill="#7cc55c" stroke="#3f7d2c" stroke-width="2" stroke-linejoin="round"/>
        <rect x="52" y="-22" width="12" height="22" rx="2" fill="#7fc8ff" stroke="#6b4527" stroke-width="2"/>
        <rect x="65" y="-26" width="11" height="26" rx="2" fill="#ffd447" stroke="#6b4527" stroke-width="2"/>
        <rect x="77" y="-19" width="10" height="19" rx="2" fill="#ff8aa8" stroke="#6b4527" stroke-width="2"/>
        <path d="M92 0 q0 -14 8 -14 q8 0 8 14Z" fill="#fff4e0" stroke="#6b4527" stroke-width="2"/>
        <circle cx="100" cy="-10" r="2" fill="#6b4527"/>
      </g>

      <!-- bunting -->
      <path d="M-10 6 Q180 34 370 6" fill="none" stroke="#c98a4f" stroke-width="1.6"/>
      ${Array.from({ length: 10 }, (_, i) => {
        const x = 8 + i * 37;
        const y = 6 + Math.sin((i / 9) * Math.PI) * 13;
        const c = ["#ff8a7a", "#ffd447", "#8fd4ff", "#9fe0b0"][i % 4];
        return `<path d="M${x - 9} ${r1(y)} L${x + 9} ${r1(y + 1)} L${x} ${r1(y + 16)}Z" fill="${c}" stroke="#c98a4f" stroke-width="1.2" stroke-linejoin="round"/>`;
      }).join("")}

      <!-- rug -->
      <ellipse cx="180" cy="300" rx="132" ry="30" fill="#e09a52" opacity=".5"/>
      <ellipse cx="180" cy="296" rx="128" ry="28" fill="url(#rmRug)" stroke="#d48a3c" stroke-width="3"/>
      <ellipse cx="180" cy="296" rx="104" ry="20" fill="none" stroke="#fff" stroke-width="2.4" stroke-dasharray="6 6" opacity=".7"/>

      <!-- bed -->
      <g transform="translate(262 262)">
        <ellipse cx="44" cy="44" rx="50" ry="10" fill="#7a4a24" opacity=".25"/>
        <path d="M-4 30 Q-6 6 22 4 H70 Q96 6 94 30 Q94 46 72 46 H18 Q-4 46 -4 30Z" fill="url(#rmBed)" stroke="#6b4527" stroke-width="2.5"/>
        <ellipse cx="45" cy="26" rx="38" ry="10" fill="#fff4e2" stroke="#e8a090" stroke-width="2"/>
        <path d="M14 36 q6 4 12 0 M38 38 q6 4 12 0 M62 36 q6 4 12 0" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity=".7"/>
      </g>

      <!-- bowl -->
      <g transform="translate(26 286)">
        <ellipse cx="28" cy="22" rx="32" ry="6" fill="#7a4a24" opacity=".25"/>
        <ellipse cx="28" cy="2" rx="26" ry="7" fill="#7a4a24"/>
        <g fill="#b8743c" stroke="#7a4a24" stroke-width="1"><circle cx="18" cy="0" r="3.5"/><circle cx="26" cy="-2" r="3.5"/><circle cx="34" cy="0" r="3.5"/><circle cx="22" cy="3" r="3.2"/><circle cx="31" cy="3" r="3.2"/></g>
        <path d="M2 2 Q4 20 14 20 H42 Q52 20 54 2 Q28 12 2 2Z" fill="url(#rmBowl)" stroke="#2f5d7c" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M2 2 Q28 12 54 2" fill="none" stroke="#2f5d7c" stroke-width="2.5"/>
        <path d="M22 13 h10 m-12 -2 a2 2 0 1 0 0 4 m14 -4 a2 2 0 1 1 0 4" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>
      </g>

      <!-- ball + bone toy -->
      <g class="raise-room__toy" transform="translate(300 222)">
        <circle cx="0" cy="0" r="12" fill="#ff7a6b" stroke="#6b4527" stroke-width="2.2"/>
        <path d="M-11 -4 Q0 4 11 -4 M-9 6 Q0 12 9 6" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>
        <ellipse cx="-4" cy="-6" rx="3.5" ry="2.2" fill="#fff" opacity=".7"/>
      </g>
      <g transform="translate(100 318) rotate(-10)">
        <path d="M0 0 h26 m-30 -4 a4 4 0 1 1 4 4 a4 4 0 1 1 -4 4 M30 -4 a4 4 0 1 0 -4 4 a4 4 0 1 0 4 4" fill="#fff8ec" stroke="#6b4527" stroke-width="2"/>
        <rect x="0" y="-3.2" width="26" height="6.4" fill="#fff8ec"/>
        <path d="M0 -3.2 h26 M0 3.2 h26" stroke="#6b4527" stroke-width="2"/>
      </g>
    </svg>`;
  }

  function parkSVG() {
    const tree = (x, y, s, c1, c2) => `<g transform="translate(${x} ${y}) scale(${s})">
      <rect x="-5" y="-6" width="10" height="34" rx="4" fill="#9a6338" stroke="#5f3a1e" stroke-width="2"/>
      <path d="M0 -60 q22 0 24 20 q14 6 8 22 q-4 14 -22 12 q-10 8 -20 0 q-18 2 -22 -12 q-6 -16 8 -22 q2 -20 24 -20Z" fill="${c1}" stroke="#3f7d2c" stroke-width="2.2"/>
      <path d="M-10 -44 q10 -8 20 -2" fill="none" stroke="${c2}" stroke-width="4" stroke-linecap="round" opacity=".8"/>
    </g>`;
    const flower = (x, y, c) => `<g transform="translate(${x} ${y})"><path d="M0 0 v8" stroke="#4e8a2f" stroke-width="1.6"/><circle cx="0" cy="-2" r="2" fill="#ffd447"/>${[0, 72, 144, 216, 288].map((a) => `<circle cx="${r1(Math.cos((a * Math.PI) / 180) * 3.6)}" cy="${r1(-2 + Math.sin((a * Math.PI) / 180) * 3.6)}" r="2.2" fill="${c}"/>`).join("")}<circle cx="0" cy="-2" r="1.8" fill="#ffd447"/></g>`;
    return `<svg class="raise-story__art-bg" viewBox="0 0 360 170" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="pkSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd4ff"/><stop offset="1" stop-color="#e6f8ff"/></linearGradient>
        <linearGradient id="pkGrass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a6dc78"/><stop offset="1" stop-color="#7cc05a"/></linearGradient>
        <linearGradient id="pkPath" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f5dfb5"/><stop offset="1" stop-color="#e8c58c"/></linearGradient>
        <radialGradient id="pkSun" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff9d0"/><stop offset=".55" stop-color="#ffe680"/><stop offset="1" stop-color="#ffe680" stop-opacity="0"/></radialGradient>
      </defs>
      <rect width="360" height="170" fill="url(#pkSky)"/>
      <circle cx="292" cy="38" r="34" fill="url(#pkSun)"/>
      <circle cx="292" cy="38" r="16" fill="#fff3a0"/>
      <path d="M40 40 q8 -14 22 -8 q8 -10 20 -2 q12 0 12 10 q8 4 2 10 h-56 q-10 -4 0 -10Z" fill="#fff" opacity=".95"/>
      <path d="M186 26 q6 -10 16 -6 q6 -7 14 -1 q9 0 9 7 q6 3 1 7 h-40 q-7 -3 0 -7Z" fill="#fff" opacity=".85"/>
      <path d="M0 96 Q60 70 130 88 T260 82 T360 90 V170 H0Z" fill="#bfe6a0"/>
      ${tree(46, 96, 0.9, "#8fd06a", "#c6ef9c")}${tree(320, 92, 1.05, "#7cc55c", "#b6e88c")}${tree(270, 100, 0.7, "#9fd97a", "#d0f3a8")}
      <path d="M0 112 Q90 98 180 108 T360 106 V170 H0Z" fill="url(#pkGrass)"/>
      <path d="M150 170 Q170 140 176 112 Q186 112 196 112 Q204 140 236 170Z" fill="url(#pkPath)" stroke="#d6ad6c" stroke-width="2"/>
      <g transform="translate(78 120)">
        <rect x="0" y="0" width="56" height="7" rx="3" fill="#c98a4f" stroke="#6b4527" stroke-width="2"/>
        <rect x="0" y="-12" width="56" height="6" rx="3" fill="#c98a4f" stroke="#6b4527" stroke-width="2"/>
        <path d="M6 7 v12 M50 7 v12" stroke="#6b4527" stroke-width="3" stroke-linecap="round"/>
      </g>
      ${flower(30, 140, "#ff8aa8")}${flower(60, 156, "#ffffff")}${flower(300, 146, "#ff8a7a")}${flower(330, 132, "#c9a8ff")}${flower(272, 160, "#ffffff")}
      ${Array.from({ length: 16 }, (_, i) => `<path d="M${10 + i * 23} ${150 + (i % 3) * 6} l3 -7 l3 7" fill="none" stroke="#5fa843" stroke-width="1.6" stroke-linecap="round"/>`).join("")}
    </svg>`;
  }

  window.BellaRaiseArt = {
    GEOM,
    BREEDS,
    SLOTS,
    ITEMS,
    ITEM_MAP,
    emptyOutfit,
    dogBodySVG,
    itemIconSVG,
    roomSVG,
    parkSVG,
  };
})();
