/* Dog portrait art.
 * Every tile is a tiny postcard: a scene behind, a dog resting its chin on a
 * ledge, a signature prop, and three expression layers (default / wow / joy)
 * that the game switches with CSS classes.
 */
(() => {
  "use strict";

  const INK = "#3b2618";
  const SW = 2.4; // outline width

  const r1 = (n) => Math.round(n * 10) / 10;

  // Mirror an absolute path (pairs written as "x y") across x = 50.
  const mirror = (d) =>
    d.replace(/(-?\d*\.?\d+) (-?\d*\.?\d+)/g, (m, x, y) => `${r1(100 - Number(x))} ${y}`);

  const both = (d, attrs) => `<path d="${d}" ${attrs}/><path d="${mirror(d)}" ${attrs}/>`;
  const outline = `stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round" stroke-linecap="round"`;

  function fluffPath(cx, cy, rx, ry, n, puff) {
    let d = "";
    for (let i = 0; i <= n; i += 1) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const x = cx + rx * Math.cos(a);
      const y = cy + ry * Math.sin(a);
      if (i === 0) {
        d += `M${r1(x)} ${r1(y)}`;
      } else {
        const am = a - Math.PI / n;
        d += ` Q${r1(cx + (rx + puff) * Math.cos(am))} ${r1(cy + (ry + puff) * Math.sin(am))} ${r1(x)} ${r1(y)}`;
      }
    }
    return `${d}Z`;
  }

  /* ----------------------------- Face pieces ----------------------------- */

  const eye = (x, y, r = 4.2, iris = INK) =>
    `<g class="blink"><ellipse cx="${x}" cy="${y}" rx="${r1(r * 0.86)}" ry="${r}" fill="${iris}"/>` +
    (iris !== INK ? `<circle cx="${x}" cy="${y}" r="${r1(r * 0.48)}" fill="${INK}"/>` : "") +
    `<circle cx="${r1(x + r * 0.32)}" cy="${r1(y - r * 0.36)}" r="${r1(r * 0.36)}" fill="#fff"/></g>`;

  const eyesOpen = (y = 55, dx = 12, r = 4.2, iris = INK) =>
    eye(50 - dx, y, r, iris) + eye(50 + dx, y, r, iris);

  // Cartoon eyes with whites, for dark coats.
  const eyeWhite = (x, y, r = 5) =>
    `<g class="blink"><circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="${INK}" stroke-width="1.4"/>` +
    `<circle cx="${r1(x + 0.6)}" cy="${r1(y + 0.4)}" r="${r1(r * 0.66)}" fill="${INK}"/>` +
    `<circle cx="${r1(x + 1.8)}" cy="${r1(y - 1.2)}" r="${r1(r * 0.26)}" fill="#fff"/></g>`;

  const eyesJoy = (y = 55, dx = 12, color = INK) =>
    `<path d="M${50 - dx - 5} ${y + 1.5} Q${50 - dx} ${y - 5.5} ${50 - dx + 5} ${y + 1.5} M${50 + dx - 5} ${y + 1.5} Q${50 + dx} ${y - 5.5} ${50 + dx + 5} ${y + 1.5}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round"/>`;

  const wowEye = (x, y, iris) =>
    `<circle cx="${x}" cy="${y}" r="6.4" fill="${iris || INK}" stroke="${INK}" stroke-width="1.2"/>` +
    (iris ? `<circle cx="${x}" cy="${y + 0.5}" r="3.4" fill="${INK}"/>` : "") +
    `<circle cx="${x + 2.2}" cy="${y - 2.2}" r="2.4" fill="#fff"/><circle cx="${x - 2}" cy="${y + 2.2}" r="1.1" fill="#fff"/>`;

  const eyesWow = (y = 54, dx = 12, iris) => wowEye(50 - dx, y, iris) + wowEye(50 + dx, y, iris);

  const sparkle = (x, y, s = 1, fill = "#fff") =>
    `<path d="M${x} ${y - 5 * s} Q${x + 1 * s} ${y - 1 * s} ${x + 5 * s} ${y} Q${x + 1 * s} ${y + 1 * s} ${x} ${y + 5 * s} Q${x - 1 * s} ${y + 1 * s} ${x - 5 * s} ${y} Q${x - 1 * s} ${y - 1 * s} ${x} ${y - 5 * s}Z" fill="${fill}"/>`;

  const nose = (y = 64, w = 6) =>
    `<path d="M${50 - w} ${y} Q50 ${y - 3.4} ${50 + w} ${y} Q${50 + w * 0.6} ${y + 5} 50 ${y + 5.6} Q${50 - w * 0.6} ${y + 5} ${50 - w} ${y}Z" fill="${INK}"/>` +
    `<ellipse cx="${50 - w * 0.3}" cy="${y - 0.4}" rx="${w * 0.32}" ry="1.1" fill="#fff" opacity=".55"/>`;

  const mouthW = (y = 70) =>
    `<path d="M50 ${y - 1} V${y + 1.5} M43.5 ${y + 1} Q46.7 ${y + 5} 50 ${y + 1.5} Q53.3 ${y + 5} 56.5 ${y + 1}" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`;

  const mouthOpen = (y = 70, w = 9, depth = 11, tongue = true) =>
    `<path d="M${50 - w} ${y} Q50 ${y + depth * 1.25} ${50 + w} ${y} Q50 ${y + 2.5} ${50 - w} ${y}Z" fill="#5c2620" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>` +
    (tongue
      ? `<path d="M${50 - w * 0.52} ${y + depth * 0.45} Q50 ${y + depth * 0.2} ${50 + w * 0.52} ${y + depth * 0.45} Q${50 + w * 0.5} ${y + depth * 1.05} 50 ${y + depth * 1.05} Q${50 - w * 0.5} ${y + depth * 1.05} ${50 - w * 0.52} ${y + depth * 0.45}Z" fill="#ff7f97"/>`
      : "");

  const mouthO = (y = 71) =>
    `<ellipse cx="50" cy="${y + 2.5}" rx="3.4" ry="4" fill="#5c2620" stroke="${INK}" stroke-width="1.4"/>`;

  const blush = (y = 64, dx = 19, color = "#ff8f9d", op = 0.55) =>
    `<ellipse cx="${50 - dx}" cy="${y}" rx="5" ry="3.2" fill="${color}" opacity="${op}"/><ellipse cx="${50 + dx}" cy="${y}" rx="5" ry="3.2" fill="${color}" opacity="${op}"/>`;

  const paws = (fill, y = 86) =>
    [32, 68]
      .map(
        (x) =>
          `<g><ellipse cx="${x}" cy="${y}" rx="8.6" ry="5.6" fill="${fill}" ${outline}/>` +
          `<path d="M${x - 2.6} ${y + 1} v3.4 M${x + 2.6} ${y + 1} v3.4" stroke="${INK}" stroke-width="1.4" stroke-linecap="round" opacity=".55"/></g>`
      )
      .join("");

  const expr = (def, wow, joy) =>
    `<g class="x x-def">${def}</g><g class="x x-wow">${wow}</g><g class="x x-joy">${joy}</g>`;

  /* -------------------------------- Breeds -------------------------------- */

  const DOGS = {
    shiba: {
      name: "Mochi",
      breed: "柴犬",
      en: "Shiba",
      trait: "永远睡不醒，下巴搁哪儿哪儿就是床",
      tone: "#e98d3e",
      scene: "午后窗台",
      prop: "木窗台",
      art() {
        const bg =
          `<rect width="100" height="100" fill="url(#g-wall)"/>` +
          `<path d="M8 0 H38 L18 60 H-12Z" fill="#fff" opacity=".28"/>` +
          `<path d="M44 0 H54 L34 60 H24Z" fill="#fff" opacity=".18"/>` +
          `<path d="M80 18 h6 l-6 6 h6 M88 8 h4 l-4 4 h4" fill="none" stroke="#9c7c5c" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="zzz"/>`;
        const ears = both("M20 47 L25 15 Q27 11 31 14 L47 33Z", `fill="#e98d3e" ${outline}`) +
          both("M26 40 L28.5 21 L40 33Z", `fill="#f9d7b4"`);
        const head =
          `<ellipse cx="50" cy="59" rx="33" ry="27" fill="#ec9142" ${outline}/>` +
          `<path d="M24 52 Q34 44 48 46" fill="none" stroke="#f6ae63" stroke-width="3" stroke-linecap="round" opacity=".8"/>` +
          `<ellipse cx="32" cy="71" rx="13" ry="10" fill="#fbe7cf"/><ellipse cx="68" cy="71" rx="13" ry="10" fill="#fbe7cf"/>` +
          `<ellipse cx="50" cy="69" rx="14.5" ry="11" fill="#fdf0de"/>` +
          `<ellipse cx="38.5" cy="46.5" rx="3.6" ry="2.4" fill="#fbe7cf"/><ellipse cx="61.5" cy="46.5" rx="3.6" ry="2.4" fill="#fbe7cf"/>` +
          nose(63.5);
        const sleepy =
          `<path d="M33 55.5 Q38.5 59 44 55.5 Q38.5 61.5 33 55.5Z M56 55.5 Q61.5 59 67 55.5 Q61.5 61.5 56 55.5Z" fill="${INK}"/>` +
          `<path d="M32 55 Q38.5 57.5 45 55 M55 55 Q61.5 57.5 68 55" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`;
        const face = expr(
          sleepy + mouthW(69.5),
          eyesWow(55, 11.5) + mouthO(69),
          eyesJoy(56, 11.5) + mouthOpen(70, 8, 10) + blush(64, 20)
        );
        const ledge =
          `<rect x="-2" y="82" width="104" height="20" fill="url(#g-wood)"/>` +
          `<path d="M-2 82.5 H102" stroke="#e6b47d" stroke-width="2"/>` +
          `<path d="M-2 82 H102" stroke="${INK}" stroke-width="${SW}"/>` +
          `<path d="M6 90 Q24 88 40 91 M58 94 Q76 91 96 93 M20 96 Q30 95 42 97" fill="none" stroke="#7c4d2c" stroke-width="1.2" opacity=".55"/>`;
        return bg + ears + head + face + ledge;
      },
    },

    golden: {
      name: "Ruby",
      breed: "金毛",
      en: "Golden",
      trait: "海滩常驻，墨镜从来不摘",
      tone: "#f0a92e",
      scene: "阳光海滩",
      prop: "墨镜",
      art() {
        const bg =
          `<rect width="100" height="100" fill="url(#g-beach)"/>` +
          `<circle cx="85" cy="15" r="11" fill="#ffe86b" opacity=".45"/><circle cx="85" cy="15" r="7.5" fill="#ffd93d"/>` +
          `<path d="M7 16 Q10 12.5 13 16 Q16 12.5 19 16" fill="none" stroke="${INK}" stroke-width="1.5" stroke-linecap="round"/>` +
          `<path d="M-2 38 Q8 34 18 38 T38 38 T58 38 T78 38 T102 38 V100 H-2Z" fill="url(#g-sea)"/>` +
          `<path d="M2 50 Q8 47 14 50 M80 47 Q86 44 92 47 M74 62 Q80 59 86 62 M6 66 Q12 63 18 66" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity=".75"/>`;
        const ears = both("M27 41 C12 42 8 63 14 76 C19 85 30 81 31 70 C32 60 31 50 30 42Z", `fill="#d98d3c" ${outline}`);
        const head =
          `<ellipse cx="50" cy="59" rx="31" ry="27" fill="#f5b75f" ${outline}/>` +
          `<path d="M40 34 Q45 29 50 33 Q55 29 60 34" fill="none" stroke="#ffd690" stroke-width="2.6" stroke-linecap="round"/>` +
          `<ellipse cx="50" cy="69" rx="15" ry="11.5" fill="#fde2b0"/>` +
          nose(64);
        const shades =
          `<g class="shades">` +
          `<path d="M24 50 H76" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>` +
          `<rect x="28" y="46.5" width="19" height="13" rx="5.5" fill="url(#g-lens)" stroke="${INK}" stroke-width="2"/>` +
          `<rect x="53" y="46.5" width="19" height="13" rx="5.5" fill="url(#g-lens)" stroke="${INK}" stroke-width="2"/>` +
          `<path d="M31.5 50.5 L35.5 48.5 M57 50.5 L61 48.5" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".8"/>` +
          `</g>`;
        const face = expr(
          mouthOpen(70.5, 9.5, 12),
          eyesWow(45.5, 11.5) + mouthO(70),
          mouthOpen(70, 11, 14) + blush(66, 21)
        );
        const ledge =
          `<path d="M-2 83 Q20 80 50 82 T102 82 V102 H-2Z" fill="#f8d68f" stroke="${INK}" stroke-width="${SW}"/>` +
          `<circle cx="10" cy="92" r="1" fill="#d8a85a"/><circle cx="48" cy="96" r="1" fill="#d8a85a"/><circle cx="58" cy="90" r="1" fill="#d8a85a"/>` +
          `<path d="M88 86 L89.6 90 L94 90.3 L90.6 93 L91.8 97.3 L88 94.8 L84.2 97.3 L85.4 93 L82 90.3 L86.4 90Z" fill="#ff8a6b" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>`;
        return bg + ears + head + face + shades + ledge + paws("#f5b75f");
      },
    },

    bernese: {
      name: "Rhea",
      breed: "伯恩山",
      en: "Bernese",
      trait: "花田里的温柔大块头，笑点很低",
      tone: "#4fb35a",
      scene: "雏菊花田",
      prop: "小雏菊",
      art() {
        const bg =
          `<rect width="100" height="100" fill="url(#g-meadow)"/>` +
          `<g transform="translate(9 12) scale(1.1)"><ellipse cx="0" cy="-3.2" rx="1.9" ry="3" fill="#fff" transform="rotate(0)"/><ellipse cx="0" cy="-3.2" rx="1.9" ry="3" fill="#fff" transform="rotate(60)"/><ellipse cx="0" cy="-3.2" rx="1.9" ry="3" fill="#fff" transform="rotate(120)"/><ellipse cx="0" cy="-3.2" rx="1.9" ry="3" fill="#fff" transform="rotate(180)"/><ellipse cx="0" cy="-3.2" rx="1.9" ry="3" fill="#fff" transform="rotate(240)"/><ellipse cx="0" cy="-3.2" rx="1.9" ry="3" fill="#fff" transform="rotate(300)"/><circle r="1.9" fill="#ffd23f"/></g><g transform="translate(88 10) scale(1.2)"><ellipse cx="0" cy="-3.2" rx="1.9" ry="3" fill="#fff" transform="rotate(0)"/><ellipse cx="0" cy="-3.2" rx="1.9" ry="3" fill="#fff" transform="rotate(60)"/><ellipse cx="0" cy="-3.2" rx="1.9" ry="3" fill="#fff" transform="rotate(120)"/><ellipse cx="0" cy="-3.2" rx="1.9" ry="3" fill="#fff" transform="rotate(180)"/><ellipse cx="0" cy="-3.2" rx="1.9" ry="3" fill="#fff" transform="rotate(240)"/><ellipse cx="0" cy="-3.2" rx="1.9" ry="3" fill="#fff" transform="rotate(300)"/><circle r="1.9" fill="#ffd23f"/></g><g transform="translate(76 34) scale(0.8)"><ellipse cx="0" cy="-3.2" rx="1.9" ry="3" fill="#fff" transform="rotate(0)"/><ellipse cx="0" cy="-3.2" rx="1.9" ry="3" fill="#fff" transform="rotate(60)"/><ellipse cx="0" cy="-3.2" rx="1.9" ry="3" fill="#fff" transform="rotate(120)"/><ellipse cx="0" cy="-3.2" rx="1.9" ry="3" fill="#fff" transform="rotate(180)"/><ellipse cx="0" cy="-3.2" rx="1.9" ry="3" fill="#fff" transform="rotate(240)"/><ellipse cx="0" cy="-3.2" rx="1.9" ry="3" fill="#fff" transform="rotate(300)"/><circle r="1.9" fill="#ffd23f"/></g><g transform="translate(12 36) scale(0.85)"><ellipse cx="0" cy="-3.2" rx="1.9" ry="3" fill="#fff" transform="rotate(0)"/><ellipse cx="0" cy="-3.2" rx="1.9" ry="3" fill="#fff" transform="rotate(60)"/><ellipse cx="0" cy="-3.2" rx="1.9" ry="3" fill="#fff" transform="rotate(120)"/><ellipse cx="0" cy="-3.2" rx="1.9" ry="3" fill="#fff" transform="rotate(180)"/><ellipse cx="0" cy="-3.2" rx="1.9" ry="3" fill="#fff" transform="rotate(240)"/><ellipse cx="0" cy="-3.2" rx="1.9" ry="3" fill="#fff" transform="rotate(300)"/><circle r="1.9" fill="#ffd23f"/></g><g transform="translate(94 62) scale(0.9)"><ellipse cx="0" cy="-3.2" rx="1.9" ry="3" fill="#fff" transform="rotate(0)"/><ellipse cx="0" cy="-3.2" rx="1.9" ry="3" fill="#fff" transform="rotate(60)"/><ellipse cx="0" cy="-3.2" rx="1.9" ry="3" fill="#fff" transform="rotate(120)"/><ellipse cx="0" cy="-3.2" rx="1.9" ry="3" fill="#fff" transform="rotate(180)"/><ellipse cx="0" cy="-3.2" rx="1.9" ry="3" fill="#fff" transform="rotate(240)"/><ellipse cx="0" cy="-3.2" rx="1.9" ry="3" fill="#fff" transform="rotate(300)"/><circle r="1.9" fill="#ffd23f"/></g><g transform="translate(5 68) scale(0.8)"><ellipse cx="0" cy="-3.2" rx="1.9" ry="3" fill="#fff" transform="rotate(0)"/><ellipse cx="0" cy="-3.2" rx="1.9" ry="3" fill="#fff" transform="rotate(60)"/><ellipse cx="0" cy="-3.2" rx="1.9" ry="3" fill="#fff" transform="rotate(120)"/><ellipse cx="0" cy="-3.2" rx="1.9" ry="3" fill="#fff" transform="rotate(180)"/><ellipse cx="0" cy="-3.2" rx="1.9" ry="3" fill="#fff" transform="rotate(240)"/><ellipse cx="0" cy="-3.2" rx="1.9" ry="3" fill="#fff" transform="rotate(300)"/><circle r="1.9" fill="#ffd23f"/></g><g transform="translate(36 8) scale(0.7)"><ellipse cx="0" cy="-3.2" rx="1.9" ry="3" fill="#fff" transform="rotate(0)"/><ellipse cx="0" cy="-3.2" rx="1.9" ry="3" fill="#fff" transform="rotate(60)"/><ellipse cx="0" cy="-3.2" rx="1.9" ry="3" fill="#fff" transform="rotate(120)"/><ellipse cx="0" cy="-3.2" rx="1.9" ry="3" fill="#fff" transform="rotate(180)"/><ellipse cx="0" cy="-3.2" rx="1.9" ry="3" fill="#fff" transform="rotate(240)"/><ellipse cx="0" cy="-3.2" rx="1.9" ry="3" fill="#fff" transform="rotate(300)"/><circle r="1.9" fill="#ffd23f"/></g><g transform="translate(62 6) scale(0.75)"><ellipse cx="0" cy="-3.2" rx="1.9" ry="3" fill="#fff" transform="rotate(0)"/><ellipse cx="0" cy="-3.2" rx="1.9" ry="3" fill="#fff" transform="rotate(60)"/><ellipse cx="0" cy="-3.2" rx="1.9" ry="3" fill="#fff" transform="rotate(120)"/><ellipse cx="0" cy="-3.2" rx="1.9" ry="3" fill="#fff" transform="rotate(180)"/><ellipse cx="0" cy="-3.2" rx="1.9" ry="3" fill="#fff" transform="rotate(240)"/><ellipse cx="0" cy="-3.2" rx="1.9" ry="3" fill="#fff" transform="rotate(300)"/><circle r="1.9" fill="#ffd23f"/></g><g transform="translate(24 20)" fill="#7cc95a"><circle cx="-2" cy="-1.5" r="2.4"/><circle cx="2" cy="-1.5" r="2.4"/><circle cx="0" cy="2" r="2.4"/></g><g transform="translate(70 18)" fill="#7cc95a"><circle cx="-2" cy="-1.5" r="2.4"/><circle cx="2" cy="-1.5" r="2.4"/><circle cx="0" cy="2" r="2.4"/></g><g transform="translate(92 44)" fill="#7cc95a"><circle cx="-2" cy="-1.5" r="2.4"/><circle cx="2" cy="-1.5" r="2.4"/><circle cx="0" cy="2" r="2.4"/></g><g transform="translate(4 52)" fill="#7cc95a"><circle cx="-2" cy="-1.5" r="2.4"/><circle cx="2" cy="-1.5" r="2.4"/><circle cx="0" cy="2" r="2.4"/></g>`;
        const ears = both("M26 40 C13 43 12 62 18 71 C23 77 31 70 31 59 C31 51 30 45 30 40Z", `fill="#2b2422" ${outline}`);
        const head =
          `<ellipse cx="50" cy="59" rx="31" ry="27" fill="#2e2724" ${outline}/>` +
          `<path d="M38 70 Q37 59 46 57 L46.5 40 Q50 32 53.5 40 L54 57 Q63 59 62 70 Q61 80 50 81 Q39 80 38 70Z" fill="#fbf6ee"/>` +
          `<ellipse cx="30.5" cy="67" rx="6" ry="5" fill="#c86e34"/><ellipse cx="69.5" cy="67" rx="6" ry="5" fill="#c86e34"/>` +
          `<ellipse cx="38" cy="46" rx="3.8" ry="2.6" fill="#c86e34"/><ellipse cx="62" cy="46" rx="3.8" ry="2.6" fill="#c86e34"/>` +
          nose(63.5);
        const flower =
          `<g transform="translate(22 38)">` +
          [0, 72, 144, 216, 288]
            .map((a) => `<ellipse cx="0" cy="-4.6" rx="3" ry="4.4" fill="#fff" stroke="${INK}" stroke-width="1.1" transform="rotate(${a})"/>`)
            .join("") +
          `<circle r="2.8" fill="#ffcf3f" stroke="${INK}" stroke-width="1.1"/></g>`;
        const face = expr(
          eyeWhite(38.5, 55) + eyeWhite(61.5, 55) + mouthOpen(70, 9, 11) + blush(64, 22, "#ff8f9d", 0.5),
          `<circle cx="38.5" cy="54" r="6.6" fill="#fff" stroke="${INK}" stroke-width="1.3"/><circle cx="61.5" cy="54" r="6.6" fill="#fff" stroke="${INK}" stroke-width="1.3"/>` +
            eyesWow(54, 11.5).replace(/r="6.4"/g, 'r="4.6"') + mouthO(70),
          eyesJoy(56, 11.5, "#fbf6ee") + mouthOpen(70, 11, 14) + blush(64, 22, "#ff8f9d", 0.7)
        );
        const ledge =
          `<rect x="-2" y="83" width="104" height="19" fill="#3f9d48"/>` +
          `<path d="M-2 85 L2 79 L5 84 L9 78 L12 84 L16 80 L20 84 L24 78 L27 84 L80 84 L84 78 L87 84 L91 79 L94 84 L98 78 L102 84" fill="#3f9d48" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/>` +
          `<circle cx="12" cy="93" r="2" fill="#ffe55c"/><circle cx="88" cy="94" r="2" fill="#ff8fb5"/><circle cx="50" cy="97" r="1.6" fill="#fff"/>`;
        return bg + ears + head + face + flower + ledge + paws("#fbf6ee");
      },
    },

    shepherd: {
      name: "Surprise",
      breed: "德牧",
      en: "Shepherd",
      trait: "西装革履的夜班队长，眼镜一推就是全场最帅的男孩",
      tone: "#2c3a78",
      scene: "城市夜巡",
      prop: "黑框眼镜 · 红领带",
      art() {
        const bg =
          `<rect width="100" height="100" fill="url(#g-night)"/>` +
          `<path d="M86 8 A9 9 0 1 0 92 22 A7 7 0 1 1 86 8Z" fill="#ffe680"/>` +
          sparkle(12, 14, 0.7, "#fff7c2") + sparkle(74, 30, 0.45, "#fff") +
          `<circle cx="30" cy="8" r="1" fill="#fff"/><circle cx="64" cy="6" r="1.1" fill="#fff"/><circle cx="6" cy="34" r=".9" fill="#fff"/>` +
          `<path d="M-2 84 V58 H10 V50 H20 V62 H28 V54 H34 V84Z M66 84 V52 H76 V44 H86 V56 H94 V48 H102 V84Z" fill="#1a2350"/>` +
          `<path d="M3 62 h3 v3 h-3Z M13 55 h3 v3 h-3Z M23 66 h3 v3 h-3Z M71 58 h3 v3 h-3Z M80 50 h3 v3 h-3Z M96 54 h3 v3 h-3Z M88 62 h3 v3 h-3Z" fill="#ffd864"/>`;
        // Black suit, white shirt: drawn first so the head sits on the collar.
        const suit =
          `<path d="M-4 104 V92 Q6 81 26 78 L50 100 L74 78 Q94 81 104 92 V104Z" fill="#1c1d27" ${outline}/>` +
          `<path d="M33 78 L50 102 L67 78Z" fill="#fbfbff" ${outline}/>` +
          `<path d="M26 78 L36 90 L31 92 L43 104 M74 78 L64 90 L69 92 L57 104" fill="none" stroke="#3a3c52" stroke-width="1.8" stroke-linejoin="round"/>` +
          `<path d="M12 92 L20 89 L22 94Z" fill="#fff" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/>`;
        const ears = both("M20 47 L23 8 Q25 4 29 7 L46 31Z", `fill="#2a1e18" ${outline}`) +
          both("M25 40 L26.5 15 L39.5 31Z", `fill="#c98c55"`);
        const head =
          `<ellipse cx="50" cy="58" rx="30" ry="26" fill="#c98a4b" ${outline}/>` +
          `<path d="M23.5 54 Q24 35 50 32.5 Q76 35 76.5 54 Q68 45 58 48.5 L55.5 60 L44.5 60 L42 48.5 Q32 45 23.5 54Z" fill="#2e211a"/>` +
          `<ellipse cx="50" cy="69.5" rx="15" ry="10.5" fill="#e6bb8a"/>` +
          `<path d="M44.5 58 L55.5 58 L54.6 63 L45.4 63Z" fill="#2e211a"/>` +
          `<ellipse cx="50" cy="78" rx="8" ry="3.4" fill="#f3e3cd"/>` +
          `<path d="M44 61 Q50 58.6 56 61 Q55 65.4 50 66.2 Q45 65.4 44 61Z" fill="#14100d"/>` +
          `<ellipse cx="47.6" cy="60.6" rx="2" ry="1" fill="#fff" opacity=".6"/>`;
        const glasses =
          `<g class="specs">` +
          `<rect x="28.5" y="48.5" width="19" height="13.5" rx="4" fill="#fff" fill-opacity=".16" stroke="#111219" stroke-width="2.8"/>` +
          `<rect x="52.5" y="48.5" width="19" height="13.5" rx="4" fill="#fff" fill-opacity=".16" stroke="#111219" stroke-width="2.8"/>` +
          `<path d="M47.5 53.5 Q50 51.4 52.5 53.5 M28.5 52 L21.5 50 M71.5 52 L78.5 50" fill="none" stroke="#111219" stroke-width="2.4" stroke-linecap="round"/>` +
          `<path d="M31.5 58.5 L36.5 51.5 M55.5 58.5 L60.5 51.5" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".75"/>` +
          `</g>`;
        const grin =
          `<path d="M42 68.5 Q50 77.5 58 68.5 Q50 71 42 68.5Z" fill="#5c2620" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>` +
          `<path d="M46 71.2 Q50 69.8 54 71.2 Q54.5 78.5 50 78.8 Q45.5 78.5 46 71.2Z" fill="#ff7f97" stroke="${INK}" stroke-width="1.1"/>`;
        const face = expr(
          eye(38, 55.5, 3.8, "#7a4a22") + eye(62, 55.5, 3.8, "#7a4a22") + grin,
          eyesWow(55.5, 12, "#8a5426").replace(/r="6.4"/g, 'r="5.2"') + mouthO(68),
          eyesJoy(56.5, 12, "#fbe9d2") + mouthOpen(68.5, 9.5, 11) + blush(66, 20, "#ff8f9d", 0.45)
        );
        const tie =
          `<path d="M42.5 80.5 L50 87 L45.5 89.5Z M57.5 80.5 L50 87 L54.5 89.5Z" fill="#fff" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>` +
          `<path d="M46.6 83.6 H53.4 L52.2 89 H47.8Z" fill="#e0342c" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>` +
          `<path d="M47.8 89 L45.4 101 L50 105 L54.6 101 L52.2 89Z" fill="#e0342c" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>` +
          `<path d="M47 94 L53.2 91.5 M46.3 98.5 L53.9 95.5" stroke="#a81d18" stroke-width="1.2"/>`;
        return bg + suit + ears + head + face + glasses + tie;
      },
    },

    husky: {
      name: "Loki",
      breed: "哈士奇",
      en: "Husky",
      trait: "眼神永远在神游，北极光下的拆家专家",
      tone: "#6a4fc0",
      scene: "极光雪原",
      prop: "蓝眼睛",
      art() {
        const bg =
          `<rect width="100" height="100" fill="url(#g-aurora)"/>` +
          `<path d="M-4 26 Q24 12 50 26 T104 20 V34 Q78 26 50 38 T-4 38Z" fill="#62f0c4" opacity=".45"/>` +
          `<path d="M-4 40 Q30 30 56 42 T104 36 V44 Q74 40 52 48 T-4 48Z" fill="#7fd8ff" opacity=".35"/>` +
          sparkle(10, 12, 0.5) + sparkle(88, 10, 0.6) + `<circle cx="80" cy="56" r="1.2" fill="#fff"/><circle cx="12" cy="60" r="1.2" fill="#fff"/>`;
        const ears = both("M21 47 L26 13 Q28 9 32 12 L47 32Z", `fill="#6f7f96" ${outline}`) +
          both("M26.5 40 L28.5 20 L40 32Z", `fill="#f3b9c3"`);
        const head =
          `<ellipse cx="50" cy="59" rx="32" ry="27" fill="#7b8ca3" ${outline}/>` +
          `<path d="M50 34 Q47 44 44 48 Q30 46 24 56 Q22 72 33 81 L67 81 Q78 72 76 56 Q70 46 56 48 Q53 44 50 34Z" fill="#f7fbff"/>` +
          `<ellipse cx="37" cy="45.5" rx="4" ry="2.6" fill="#f7fbff"/><ellipse cx="63" cy="45.5" rx="4" ry="2.6" fill="#f7fbff"/>` +
          nose(63.5);
        const derp =
          `<circle cx="37.5" cy="55" r="6.6" fill="#fff" stroke="${INK}" stroke-width="1.4"/><circle cx="36" cy="52.5" r="4" fill="#4fb8f2"/><circle cx="36" cy="52.5" r="2" fill="${INK}"/><circle cx="37.3" cy="51.2" r="1" fill="#fff"/>` +
          `<circle cx="62.5" cy="56" r="4" fill="#fff" stroke="${INK}" stroke-width="1.4"/><circle cx="64" cy="57.4" r="2.3" fill="#4fb8f2"/><circle cx="64" cy="57.4" r="1.2" fill="${INK}"/>` +
          `<path d="M43 71 Q51 77 58 70" fill="#5c2620" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>` +
          `<path d="M51 73 Q60 72 62 81 Q57 85 53 79Z" fill="#ff7f97" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>`;
        const face = expr(
          derp,
          eyesWow(55, 12, "#4fb8f2") + mouthO(70),
          eyesJoy(56, 12) + mouthOpen(70, 9.5, 12) + blush(65, 22)
        );
        const ledge =
          `<path d="M-2 85 Q4 79 10 84 Q16 79 22 84 Q28 80 34 84 L66 84 Q72 80 78 84 Q84 79 90 84 Q96 79 102 84 V102 H-2Z" fill="#f4f8ff" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/>` +
          `<path d="M8 93 Q20 90 30 94 M66 95 Q80 91 94 94" fill="none" stroke="#b9c9f0" stroke-width="1.6" stroke-linecap="round"/>`;
        return bg + ears + head + face + ledge + paws("#f7fbff");
      },
    },

    corgi: {
      name: "Ginger",
      breed: "柯基",
      en: "Corgi",
      trait: "派对之王，腿短但气场两米八",
      tone: "#ffc83d",
      scene: "生日派对",
      prop: "派对帽",
      art() {
        const confetti = [
          [8, 10, "#ff6fa5", 20], [22, 22, "#4fc3ff", -30], [80, 8, "#5fd17a", 40], [90, 30, "#ff6fa5", -15],
          [10, 44, "#8a6cff", 25], [88, 52, "#4fc3ff", 60], [70, 22, "#ff8a3d", -40],
        ]
          .map(([x, y, c, a]) => `<rect x="${x}" y="${y}" width="5" height="2.6" rx="1" fill="${c}" transform="rotate(${a} ${x} ${y})"/>`)
          .join("");
        const bg =
          `<rect width="100" height="100" fill="url(#g-party)"/>` + confetti +
          `<path d="M-2 4 Q12 14 26 4 T54 4 T82 4 T110 4" fill="none" stroke="#ff6fa5" stroke-width="2" opacity=".7"/>`;
        const ears = both("M16 52 L19 10 Q21 5 26 8 L47 33Z", `fill="#ea8a3a" ${outline}`) +
          both("M22.5 44 L24 17 L39.5 33Z", `fill="#ffd8b4"`);
        const head =
          `<ellipse cx="50" cy="59" rx="32" ry="27" fill="#f19a4b" ${outline}/>` +
          `<path d="M47 33 Q50 31 53 33 L54.5 50 Q65 54 66 66 Q64 80 50 81 Q36 80 34 66 Q35 54 45.5 50Z" fill="#fffaf2"/>` +
          nose(63.5);
        const hat =
          `<g class="party-hat" transform="rotate(14 52 30)">` +
          `<path d="M40 33 L52 3 L64 33Z" fill="#ff6fa5" ${outline}/>` +
          `<path d="M45.5 19 L58.5 19 M43 26 L61 26 M48.5 11 L55.5 11" stroke="#7fd6ff" stroke-width="3"/>` +
          `<circle cx="52" cy="3.5" r="4" fill="#ffe14d" stroke="${INK}" stroke-width="1.6"/>` +
          `</g>`;
        const wink =
          `<path d="M33 56 Q38.5 50.5 44 56" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>` +
          eye(61.5, 55) + mouthOpen(70, 9.5, 12) + blush(64, 21);
        const face = expr(
          wink,
          eyesWow(55, 11.5) + mouthO(70),
          eyesJoy(56, 11.5) + mouthOpen(70, 11, 14) + blush(64, 21, "#ff6f8a", 0.7)
        );
        const ledge =
          `<rect x="-2" y="83" width="104" height="19" fill="#fff4d6" stroke="${INK}" stroke-width="${SW}"/>` +
          [[6, 90, "#ff6fa5", 20], [18, 95, "#5fd17a", -30], [30, 89, "#8a6cff", 50], [72, 91, "#4fc3ff", -20], [84, 96, "#ff8a3d", 35], [95, 89, "#ff6fa5", -45]]
            .map(([x, y, c, a]) => `<rect x="${x}" y="${y}" width="4.4" height="1.8" rx=".9" fill="${c}" transform="rotate(${a} ${x} ${y})"/>`)
            .join("");
        return bg + ears + head + face + hat + ledge + paws("#fffaf2");
      },
    },

    samoyed: {
      name: "Snowball",
      breed: "萨摩耶",
      en: "Samoyed",
      trait: "微笑天使，野餐垫上的一朵云",
      tone: "#f0606e",
      scene: "草莓野餐",
      prop: "草莓发卡",
      art() {
        const bg =
          `<rect width="100" height="100" fill="#f4646f"/>` +
          `<rect width="100" height="100" fill="url(#p-gingham)"/>`;
        const ears = both("M26 42 L30 18 Q32 15 35 18 L45 33Z", `fill="#fffdf8" ${outline}`) +
          both("M30 37 L31.5 23 L39.5 32Z", `fill="#ffc6cc"`);
        const head =
          `<path d="${fluffPath(50, 59, 31, 26, 16, 5)}" fill="#fffdf8" ${outline}/>` +
          `<ellipse cx="50" cy="70" rx="14" ry="9.5" fill="#f6ede2"/>` +
          nose(63.5, 5.4);
        const berry =
          `<g transform="translate(71 33) rotate(18)">` +
          `<path d="M0 -4 Q7 -5 7 1 Q6 8 0 11 Q-6 8 -7 1 Q-7 -5 0 -4Z" fill="#ff3d55" stroke="${INK}" stroke-width="1.4"/>` +
          `<path d="M-4.5 -4 L0 -1.5 L4.5 -4 L2 -7 L0 -5 L-2 -7Z" fill="#43b34f" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/>` +
          `<circle cx="-2.5" cy="2" r=".8" fill="#ffe27a"/><circle cx="2.5" cy="2" r=".8" fill="#ffe27a"/><circle cx="0" cy="6" r=".8" fill="#ffe27a"/></g>`;
        const smile =
          eyesJoy(56, 12) +
          `<path d="M41 69 Q50 79 59 69" fill="#5c2620" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>` +
          `<path d="M46 72.5 Q50 70.5 54 72.5 Q53.5 76.5 50 76.6 Q46.5 76.5 46 72.5Z" fill="#ff7f97"/>` +
          blush(65, 20, "#ff7f8f", 0.7);
        const face = expr(
          smile,
          eyesWow(55, 12) + mouthO(70) + blush(65, 21, "#ff7f8f", 0.5),
          eyesJoy(56, 12) + mouthOpen(69.5, 11, 14) + blush(65, 20, "#ff6f80", 0.85) + sparkle(84, 50, 0.6, "#fff6a8")
        );
        const ledge =
          `<rect x="-2" y="83" width="104" height="19" fill="#fff"/>` +
          `<rect x="-2" y="83" width="104" height="19" fill="url(#p-gingham-strong)"/>` +
          `<path d="M-2 83 H102" stroke="${INK}" stroke-width="${SW}"/>`;
        return bg + ears + head + face + berry + ledge + paws("#fffdf8");
      },
    },
    pug: {
      name: "Waffle",
      breed: "巴哥",
      en: "Pug",
      trait: "泡泡浴爱好者，皱眉是天生的，其实超开心",
      tone: "#9aa7bd",
      scene: "泡泡浴室",
      prop: "泡泡帽 · 小黄鸭",
      art() {
        const bubble = (x, y, r) =>
          `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" fill-opacity=".85" stroke="#aab6cc" stroke-width="1.1"/>` +
          `<circle cx="${r1(x - r * 0.35)}" cy="${r1(y - r * 0.35)}" r="${r1(r * 0.28)}" fill="#fff"/>`;
        const bg =
          `<rect width="100" height="100" fill="url(#g-bath)"/>` +
          `<path d="M0 16.5 H100 M0 33 H100 M0 49.5 H100 M0 66 H100 M16.5 0 V84 M33 0 V84 M49.5 0 V84 M66 0 V84 M82.5 0 V84" stroke="#fff" stroke-width="1.6" opacity=".9"/>` +
          bubble(10, 12, 5) + bubble(20, 26, 2.8) + bubble(88, 40, 4.2) + bubble(80, 56, 2.4) + bubble(8, 56, 3.4);
        const ears = both("M20 47 Q14 34 26 30 Q34 33 35 42Z", `fill="#3a2d26" ${outline}`);
        const head =
          `<ellipse cx="50" cy="60" rx="31" ry="26" fill="#e9c792" ${outline}/>` +
          `<path d="M40 42 Q50 38 60 42 M42.5 47 Q50 44.5 57.5 47 M50 41 V47" fill="none" stroke="#b98d55" stroke-width="2" stroke-linecap="round"/>` +
          `<path d="M35 66 Q36 56 50 55.5 Q64 56 65 66 Q64 79 50 81 Q36 79 35 66Z" fill="#3a2d26"/>` +
          `<path d="M44.5 62 Q50 59 55.5 62 Q54.5 66.5 50 67.2 Q45.5 66.5 44.5 62Z" fill="#120d0a"/>` +
          `<ellipse cx="48" cy="61.4" rx="1.8" ry=".9" fill="#fff" opacity=".6"/>`;
        const pugEye = (x) =>
          `<g class="blink"><circle cx="${x}" cy="54" r="6.4" fill="#fff" stroke="${INK}" stroke-width="1.4"/>` +
          `<circle cx="${x + 0.6}" cy="54.6" r="4.6" fill="${INK}"/><circle cx="${x + 2.2}" cy="52.4" r="1.7" fill="#fff"/></g>`;
        const lip = `<path d="M42 72 Q46 75.5 50 72.5 Q54 75.5 58 72" fill="none" stroke="#7d6656" stroke-width="1.6" stroke-linecap="round"/>`;
        const face = expr(
          pugEye(35) + pugEye(65) + lip + `<path d="M46 73.4 Q50 72 54 73.4 Q54.4 81.5 50 81.8 Q45.6 81.5 46 73.4Z" fill="#ff7f97" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/><path d="M50 74.5 V78.5" stroke="#e0607a" stroke-width="1" stroke-linecap="round"/>`,
          eyesWow(54, 15) + `<ellipse cx="50" cy="74.5" rx="3.4" ry="4" fill="#ff7f97" stroke="#120d0a" stroke-width="1.4"/>`,
          eyesJoy(55, 15) + `<path d="M42 71.5 Q50 83 58 71.5 Q50 74 42 71.5Z" fill="#7a2f2a" stroke="#120d0a" stroke-width="1.3"/><path d="M46 74.5 Q50 73 54 74.5 Q53.5 80 50 80 Q46.5 80 46 74.5Z" fill="#ff7f97"/>` + blush(66, 23, "#ff8f9d", 0.6)
        );
        const foam =
          `<path d="${fluffPath(50, 33, 15, 7.5, 9, 3.4)}" fill="#fff" stroke="#aab6cc" stroke-width="1.4"/>` +
          `<g transform="translate(62 22)">` +
          `<ellipse cx="0" cy="3" rx="7" ry="4.6" fill="#ffd23f" stroke="${INK}" stroke-width="1.4"/>` +
          `<circle cx="3.6" cy="-2.6" r="3.8" fill="#ffd23f" stroke="${INK}" stroke-width="1.4"/>` +
          `<path d="M6.8 -2.4 L10.6 -1.4 L6.8 0.2Z" fill="#ff8a3d" stroke="${INK}" stroke-width="1" stroke-linejoin="round"/>` +
          `<circle cx="4.6" cy="-3.4" r=".9" fill="${INK}"/><path d="M-3.5 2 Q-1 4.8 2 2.6" fill="none" stroke="#e8a91a" stroke-width="1.2" stroke-linecap="round"/></g>`;
        const ledge =
          `<rect x="-2" y="82" width="104" height="21" rx="4" fill="#fff" stroke="${INK}" stroke-width="${SW}"/>` +
          `<path d="M4 87.5 H96" stroke="#dce3ee" stroke-width="2" stroke-linecap="round"/>` +
          bubble(8, 82, 3.2) + bubble(92, 81, 3.8) + bubble(86, 85, 2.2);
        return bg + ears + head + face + foam + ledge + paws("#e9c792");
      },
    },

    poodle: {
      name: "Coco",
      breed: "泰迪",
      en: "Poodle",
      trait: "烘焙坊的小甜品师，卷毛里藏着可颂的香味",
      tone: "#ff8a2a",
      scene: "甜点烘焙坊",
      prop: "厨师帽",
      art() {
        const stripes = [0, 1, 2, 3, 4, 5, 6, 7]
          .map((i) => `<rect x="${i * 12.5}" y="0" width="12.5" height="11" fill="${i % 2 ? "#ff6a2b" : "#fff4e2"}"/>` +
            `<circle cx="${i * 12.5 + 6.25}" cy="11" r="6.25" fill="${i % 2 ? "#ff6a2b" : "#fff4e2"}"/>`)
          .join("");
        const bg =
          `<rect width="100" height="100" fill="url(#g-bakery)"/>` +
          stripes +
          `<path d="M-2 11 H102" stroke="${INK}" stroke-width="1.4" opacity=".25"/>` +
          sparkle(10, 34, 0.6, "#fff6d8") + sparkle(90, 30, 0.7, "#fff6d8") + `<circle cx="84" cy="62" r="1.3" fill="#fff6d8"/><circle cx="14" cy="64" r="1.2" fill="#fff6d8"/>`;
        const ears =
          `<path d="${fluffPath(20, 63, 10, 16, 9, 3)}" fill="#8f4b26" ${outline}/>` +
          `<path d="${fluffPath(80, 63, 10, 16, 9, 3)}" fill="#8f4b26" ${outline}/>`;
        const head =
          `<path d="${fluffPath(50, 58, 28, 25, 14, 3.8)}" fill="#b0653a" ${outline}/>` +
          `<ellipse cx="50" cy="69.5" rx="12.5" ry="9.5" fill="#e3ab7b"/>` +
          nose(63.5, 5.2);
        const face = expr(
          eye(39, 55.5, 4.1) + eye(61, 55.5, 4.1) + mouthW(70) + blush(64, 21, "#ff8f6f", 0.6),
          eyesWow(55, 11) + mouthO(69.5) + blush(64, 21, "#ff8f6f", 0.4),
          eyesJoy(56, 11) + mouthOpen(70, 8, 10) + blush(64, 21, "#ff7f6f", 0.8)
        );
        const hat =
          `<path d="${fluffPath(50, 17, 16, 9.5, 8, 3.4)}" fill="#fff" ${outline}/>` +
          `<rect x="36" y="23" width="28" height="9" rx="2.5" fill="#fff" ${outline}/>` +
          `<path d="M44 25 V30 M50 25 V30 M56 25 V30" stroke="#e7dccd" stroke-width="1.4" stroke-linecap="round"/>`;
        const ledge =
          `<rect x="-2" y="83" width="104" height="19" fill="#fff1d9" stroke="${INK}" stroke-width="${SW}"/>` +
          `<path d="M-2 89 H102" stroke="#f0d6ae" stroke-width="1.6"/>` +
          `<g transform="translate(12 91)"><path d="M-8 2 Q-6 -6 0 -6 Q6 -6 8 2 Q4 -1 0 -1 Q-4 -1 -8 2Z" fill="#f0a54a" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/><path d="M-3 -5.5 L-2 -1 M3 -5.5 L2 -1" stroke="#b86b1e" stroke-width="1.1"/></g>` +
          `<g transform="translate(88 90)"><ellipse cx="0" cy="-2.6" rx="6" ry="2.6" fill="#9fe0b0" stroke="${INK}" stroke-width="1.2"/><rect x="-5.4" y="-1" width="10.8" height="2" fill="#fff6e6" stroke="${INK}" stroke-width="1"/><ellipse cx="0" cy="2.2" rx="6" ry="2.6" fill="#9fe0b0" stroke="${INK}" stroke-width="1.2"/></g>`;
        return bg + ears + head + face + hat + ledge + paws("#b0653a");
      },
    },

    dalmatian: {
      name: "Domino",
      breed: "斑点狗",
      en: "Dalmatian",
      trait: "片场里的大明星，一身斑点就是最好的礼服",
      tone: "#3a3442",
      scene: "星光片场",
      prop: "红色领结",
      art() {
        const bg =
          `<rect width="100" height="100" fill="url(#g-studio)"/>` +
          `<path d="M10 -2 L34 -2 L58 84 L-14 84Z" fill="#ffe7a3" opacity=".14"/>` +
          `<path d="M66 -2 L90 -2 L114 84 L42 84Z" fill="#ffe7a3" opacity=".1"/>` +
          sparkle(12, 14, 0.8, "#ffd65c") + sparkle(88, 18, 0.6, "#ffd65c") + sparkle(84, 62, 0.45, "#fff") +
          `<circle cx="10" cy="44" r="1.2" fill="#ffd65c"/><circle cx="92" cy="40" r="1" fill="#fff"/><circle cx="28" cy="10" r="1" fill="#fff"/>`;
        const ears =
          `<path d="M26 38 Q11 40 13 61 Q15 71 23 69 Q27 57 32 45Z" fill="#fffdf9" ${outline}/>` +
          `<path d="M24.6 39.4 Q14 42 14.4 56 Q20 58 26 50 Q28.5 45 30.6 43.5Z" fill="#26222a"/>` +
          `<path d="M74 38 Q89 40 87 61 Q85 71 77 69 Q73 57 68 45Z" fill="#fffdf9" ${outline}/>` +
          `<ellipse cx="81" cy="52" rx="2.4" ry="2" fill="#26222a"/><ellipse cx="83" cy="62" rx="1.8" ry="1.6" fill="#26222a"/>`;
        const head =
          `<ellipse cx="50" cy="58" rx="29" ry="26" fill="#fffdf9" ${outline}/>` +
          `<ellipse cx="62" cy="54.5" rx="8" ry="7.2" fill="#26222a"/>` +
          [[36, 40, 3, 2.4], [55, 38, 2.4, 2], [70, 45, 2.2, 1.8], [27, 60, 2.2, 1.8], [74, 66, 2.4, 2], [30, 72, 1.6, 1.4], [44, 47, 1.4, 1.2]]
            .map(([x, y, rx, ry]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#26222a"/>`)
            .join("") +
          `<ellipse cx="50" cy="69" rx="13" ry="9" fill="#f1ebe4"/>` +
          `<circle cx="42" cy="70" r=".9" fill="#26222a"/><circle cx="44.5" cy="73" r=".9" fill="#26222a"/><circle cx="58" cy="70" r=".9" fill="#26222a"/><circle cx="55.5" cy="73" r=".9" fill="#26222a"/>` +
          nose(62.5, 5.4);
        const face = expr(
          eyeWhite(38.5, 54.5, 4.8) + eyeWhite(61.5, 54.5, 4.8) +
            `<path d="M42 69 Q50 78.5 58 69 Q50 71.4 42 69Z" fill="#5c2620" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>` +
            `<path d="M46.2 71.4 Q50 70.2 53.8 71.4 Q53.6 76.6 50 76.8 Q46.4 76.6 46.2 71.4Z" fill="#ff7f97"/>`,
          `<circle cx="38.5" cy="54" r="6.4" fill="#fff" stroke="${INK}" stroke-width="1.3"/><circle cx="61.5" cy="54" r="6.4" fill="#fff" stroke="${INK}" stroke-width="1.3"/>` +
            eyesWow(54, 11.5).replace(/r="6.4"/g, 'r="4.4"') + mouthO(69.5),
          eyesJoy(55.5, 11.5) + mouthOpen(69.5, 9.5, 12) + blush(65, 21, "#ff8f9d", 0.6)
        );
        const bow =
          `<g transform="translate(50 84.5)">` +
          `<path d="M-1.5 0 L-10 -5.5 Q-12 0 -10 5.5Z M1.5 0 L10 -5.5 Q12 0 10 5.5Z" fill="#e0342c" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>` +
          `<rect x="-2.8" y="-3" width="5.6" height="6" rx="1.6" fill="#ff5a4f" stroke="${INK}" stroke-width="1.3"/></g>`;
        const ledge =
          `<rect x="-2" y="85" width="104" height="17" fill="#f2c14e" stroke="${INK}" stroke-width="${SW}"/>` +
          `<path d="M-2 90 H102" stroke="#c9922a" stroke-width="1.4"/>` +
          [6, 22, 78, 94].map((x) => `<circle cx="${x}" cy="95.5" r="1.4" fill="#fff4c4"/>`).join("");
        return bg + ears + head + face + ledge + paws("#fffdf9", 88) + bow;
      },
    },
    collie: {
      name: "Oreo",
      breed: "边牧",
      en: "Border Collie",
      trait: "书房里的学霸，会算数会认字，就是不会输",
      tone: "#8a5532",
      scene: "学霸书房",
      prop: "学士帽",
      art() {
        const books = (y, xs) =>
          xs.map(([x, w, h, c]) => `<rect x="${x}" y="${y - h}" width="${w}" height="${h}" rx="1" fill="${c}" stroke="#3a2112" stroke-width="1"/>`).join("");
        const bg =
          `<rect width="100" height="100" fill="url(#g-study)"/>` +
          books(24, [[2, 6, 16, "#c9604a"], [8.5, 5, 13, "#e8b04a"], [14, 7, 18, "#5f8fc4"], [72, 6, 15, "#6fae6a"], [78.5, 5, 18, "#c9604a"], [84, 8, 13, "#e8d6b0"], [92.5, 6, 17, "#5f8fc4"]]) +
          `<rect x="-2" y="24" width="104" height="4" fill="#4d2c16"/>` +
          books(54, [[2, 7, 15, "#6fae6a"], [9.5, 5, 18, "#e8d6b0"], [86, 6, 16, "#e8b04a"], [92.5, 7, 14, "#c9604a"]]) +
          `<rect x="-2" y="54" width="104" height="4" fill="#4d2c16"/>`;
        const ears = both("M21 50 L14 22 Q14 17 19 18 L40 36Z", `fill="#26222a" ${outline}`) +
          both("M15 23 Q21 21 26 26 L18.5 30Z", `fill="#4a4452"`);
        const head =
          `<ellipse cx="50" cy="58" rx="30" ry="26" fill="#26222a" ${outline}/>` +
          `<path d="M46.5 33 Q50 31 53.5 33 L55 50 Q66 58 66 70 Q60 83 50 83 Q40 83 34 70 Q34 58 45 50Z" fill="#fffdf9"/>` +
          `<ellipse cx="50" cy="70" rx="13" ry="9.5" fill="#f1ebe4"/>` +
          `<circle cx="36.5" cy="46.5" r="2.2" fill="#c98a4b"/><circle cx="63.5" cy="46.5" r="2.2" fill="#c98a4b"/>` +
          nose(63, 5.6);
        const face = expr(
          eyeWhite(37.5, 54, 4.8) + eyeWhite(62.5, 54, 4.8) +
            `<path d="M42 69 Q50 78 58 69 Q50 71.6 42 69Z" fill="#5c2620" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>` +
            `<path d="M46.4 71.4 Q50 70.2 53.6 71.4 Q53.4 76.2 50 76.4 Q46.6 76.2 46.4 71.4Z" fill="#ff7f97"/>`,
          `<circle cx="37.5" cy="53.5" r="6.2" fill="#fff" stroke="${INK}" stroke-width="1.3"/><circle cx="62.5" cy="53.5" r="6.2" fill="#fff" stroke="${INK}" stroke-width="1.3"/>` +
            eyesWow(53.5, 12.5).replace(/r="6.4"/g, 'r="4.2"') + mouthO(69),
          eyesJoy(55, 12.5, "#fff") + mouthOpen(69, 9.5, 12) + blush(66, 21, "#ff8f9d", 0.55)
        );
        const cap =
          `<g class="mortar">` +
          `<path d="M38 27 Q50 31 62 27 L62 34.5 Q50 38.5 38 34.5Z" fill="#27306b" ${outline}/>` +
          `<path d="M27 24 L50 15 L73 24 L50 33Z" fill="#33408a" ${outline}/>` +
          `<path d="M50 24 L69 27.5 L69 38" fill="none" stroke="#f2c14e" stroke-width="1.6" stroke-linecap="round"/>` +
          `<path d="M66.8 37 L71.2 37 L72 43 L66 43Z" fill="#f2c14e" stroke="${INK}" stroke-width="1"/>` +
          `<circle cx="50" cy="24" r="1.8" fill="#f2c14e"/></g>`;
        const ledge =
          `<path d="M-2 86 Q24 80 50 87 Q76 80 102 86 V103 H-2Z" fill="#fffaf0" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/>` +
          `<path d="M50 87 V103" stroke="${INK}" stroke-width="1.6"/>` +
          `<path d="M8 91 Q24 87 42 92 M8 96 Q24 92 42 97 M58 92 Q76 87 92 91 M58 97 Q76 92 92 96" fill="none" stroke="#d9cdb8" stroke-width="1.3" stroke-linecap="round"/>`;
        return bg + ears + head + face + cap + ledge + paws("#fffdf9", 85);
      },
    },

    frenchie: {
      name: "Bruno",
      breed: "法斗",
      en: "French Bulldog",
      trait: "舞池里的 DJ，大耳朵能听到每一个鼓点",
      tone: "#e0429f",
      scene: "霓虹舞厅",
      prop: "DJ 耳机",
      art() {
        const bg =
          `<rect width="100" height="100" fill="url(#g-disco)"/>` +
          `<path d="M18 4 L-6 70 L6 70Z M18 4 L30 70 L44 70Z M82 4 L64 70 L76 70Z M82 4 L102 60 L106 48Z" fill="#fff" opacity=".12"/>` +
          `<g transform="translate(14 13)"><path d="M0 -12 V-6" stroke="#9a8fb0" stroke-width="1.2"/><circle r="7" fill="#d9dbe8" stroke="${INK}" stroke-width="1.4"/>` +
          `<path d="M-7 0 H7 M0 -7 V7 M-5 -5 Q0 -2 5 -5 M-5 5 Q0 2 5 5" stroke="#9aa0b8" stroke-width=".9" fill="none"/><rect x="-4" y="-4.5" width="3" height="3" fill="#fff"/></g>` +
          sparkle(88, 14, 0.6, "#fff6a8") + sparkle(8, 46, 0.45, "#7ff2ff") + sparkle(92, 50, 0.5, "#7ff2ff") +
          `<path d="M80 30 v-6 l5 -1.5 v6" fill="none" stroke="#fff6a8" stroke-width="1.4"/><circle cx="78.6" cy="30.2" r="1.6" fill="#fff6a8"/><circle cx="83.6" cy="28.6" r="1.6" fill="#fff6a8"/>`;
        const ears =
          both("M21 46 Q12 18 26 12 Q38 12 44 34Z", `fill="#f3e3cc" ${outline}`) +
          both("M24 38 Q19 22 27 18 Q35 18 39 33Z", `fill="#ff9fc0"`);
        const head =
          `<path d="M19 58 Q19 33 50 33 Q81 33 81 58 Q81 84 50 84 Q19 84 19 58Z" fill="#f3e3cc" ${outline}/>` +
          `<path d="M54 36 Q70 37 73 52 Q66 49 60 51 Q54 46 54 36Z" fill="#c9965e"/>` +
          `<path d="M42 44 Q50 41 58 44" fill="none" stroke="#cdb391" stroke-width="1.8" stroke-linecap="round"/>` +
          `<ellipse cx="50" cy="68" rx="16" ry="11" fill="#fbf2e4"/>` +
          `<path d="M41 61 Q50 57 59 61" fill="none" stroke="#cdb391" stroke-width="1.6" stroke-linecap="round"/>` +
          `<path d="M44 63 Q50 60 56 63 Q55 67.6 50 68.4 Q45 67.6 44 63Z" fill="${INK}"/><ellipse cx="48" cy="62.8" rx="1.8" ry=".9" fill="#fff" opacity=".55"/>`;
        const face = expr(
          eyeWhite(37, 55, 5) + eyeWhite(63, 55, 5) +
            `<path d="M41 72 Q45.5 76 50 72.6 Q54.5 76 59 72" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>` +
            `<path d="M47 74.2 Q50 73 53 74.2 Q53 79.6 50 79.8 Q47 79.6 47 74.2Z" fill="#ff7f97" stroke="${INK}" stroke-width="1.1"/>`,
          eyesWow(55, 13) + mouthO(72),
          eyesJoy(56, 13) + mouthOpen(71, 10, 12) + blush(66, 22, "#ff6f9a", 0.7)
        );
        const phones =
          `<path d="M17 52 Q15 27 50 26 Q85 27 83 52" fill="none" stroke="#2a2340" stroke-width="4.4" stroke-linecap="round"/>` +
          `<path d="M17 52 Q15 27 50 26 Q85 27 83 52" fill="none" stroke="#7ff2ff" stroke-width="1.2" stroke-linecap="round" opacity=".7"/>` +
          `<rect x="9" y="46" width="13" height="19" rx="6" fill="#2a2340" ${outline}/><rect x="12" y="50" width="7" height="11" rx="3.4" fill="#7ff2ff"/>` +
          `<rect x="78" y="46" width="13" height="19" rx="6" fill="#2a2340" ${outline}/><rect x="81" y="50" width="7" height="11" rx="3.4" fill="#7ff2ff"/>`;
        const ledge =
          `<rect x="-2" y="85" width="104" height="17" fill="#3a2160" stroke="${INK}" stroke-width="${SW}"/>` +
          [[-2, "#7ff2ff"], [23, "#ffe14d"], [48, "#ff8ad8"], [73, "#7ff2ff"], [98, "#ffe14d"]]
            .map(([x, c]) => `<rect x="${x}" y="88" width="21" height="11" rx="2" fill="${c}" opacity=".75"/>`)
            .join("");
        return bg + ears + head + face + phones + ledge + paws("#f3e3cc", 88);
      },
    },

    dachshund: {
      name: "Noodle",
      breed: "腊肠",
      en: "Dachshund",
      trait: "森林露营队的向导，身子长长，故事更长",
      tone: "#1f6b52",
      scene: "森林露营",
      prop: "探险帽",
      art() {
        const pine = (x, y, sc, c) =>
          `<path d="M${x} ${y - 22 * sc} L${x + 9 * sc} ${y - 8 * sc} L${x + 5 * sc} ${y - 8 * sc} L${x + 12 * sc} ${y} L${x - 12 * sc} ${y} L${x - 5 * sc} ${y - 8 * sc} L${x - 9 * sc} ${y - 8 * sc}Z" fill="${c}"/>`;
        const bg =
          `<rect width="100" height="100" fill="url(#g-forest)"/>` +
          pine(10, 70, 1.4, "#164d3b") + pine(92, 66, 1.6, "#164d3b") + pine(24, 78, 0.9, "#123f31") + pine(78, 80, 1, "#123f31") +
          [[14, 16], [30, 8], [70, 10], [86, 22], [58, 4]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.4" fill="#fff6c2"/>`).join("") +
          [[8, 38], [90, 36], [20, 50]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2" fill="#d9ff7a" opacity=".85"/><circle cx="${x}" cy="${y}" r="4.5" fill="#d9ff7a" opacity=".2"/>`).join("");
        const ears =
          both("M27 44 Q12 46 14 68 Q16 80 26 78 Q32 64 33 50Z", `fill="#8a3c1c" ${outline}`);
        const head =
          `<ellipse cx="50" cy="57" rx="25" ry="24" fill="#b5562a" ${outline}/>` +
          `<path d="M36 62 Q36 76 50 82 Q64 76 64 62 Q57 58 50 58 Q43 58 36 62Z" fill="#c96a38" ${outline}/>` +
          `<ellipse cx="50" cy="73" rx="9" ry="6" fill="#d98a58"/>` +
          nose(63, 5.6);
        const face = expr(
          eye(40, 51.5, 3.9) + eye(60, 51.5, 3.9) + mouthW(71.5) + blush(64, 18, "#ff8f7f", 0.5),
          eyesWow(51.5, 10) + mouthO(71),
          eyesJoy(52.5, 10) + mouthOpen(71.5, 7.5, 9.5) + blush(64, 18, "#ff8f7f", 0.8)
        );
        const hat =
          `<g class="ranger">` +
          `<ellipse cx="50" cy="36" rx="27" ry="6" fill="#c9a364" ${outline}/>` +
          `<path d="M35 36 Q34 20 50 19 Q66 20 65 36 Q50 39 35 36Z" fill="#dcb977" ${outline}/>` +
          `<path d="M35.4 32 Q50 35.5 64.6 32 L64.8 35.8 Q50 39 35.2 35.8Z" fill="#8a3c1c"/>` +
          `<path d="M60 31 Q66 22 70 26 Q66 28 62 33Z" fill="#e8553f" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/></g>`;
        const ledge =
          `<rect x="-2" y="84" width="104" height="18" rx="9" fill="#8a5a33" stroke="${INK}" stroke-width="${SW}"/>` +
          `<ellipse cx="96" cy="93" rx="6" ry="8" fill="#e9c08a" stroke="${INK}" stroke-width="1.6"/><ellipse cx="96" cy="93" rx="3" ry="4.4" fill="none" stroke="#b07a45" stroke-width="1.2"/>` +
          `<path d="M6 89 Q30 87 60 90 M14 97 Q40 95 80 98" fill="none" stroke="#6b4426" stroke-width="1.4" stroke-linecap="round"/>`;
        return bg + ears + head + face + hat + ledge + paws("#b5562a");
      },
    },
  };

  const TYPES = Object.keys(DOGS);

  /* --------------------------- Shared definitions -------------------------- */

  const DEFS = `
<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="g-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6ead6"/><stop offset="1" stop-color="#e6cfa9"/></linearGradient>
    <linearGradient id="g-wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c48c58"/><stop offset="1" stop-color="#8d5a33"/></linearGradient>
    <linearGradient id="g-beach" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fe3f7"/><stop offset=".4" stop-color="#d3f5fb"/></linearGradient>
    <linearGradient id="g-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3fcad3"/><stop offset="1" stop-color="#1494ae"/></linearGradient>
    <linearGradient id="g-lens" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a2f45"/><stop offset=".55" stop-color="#1b1d2a"/><stop offset=".56" stop-color="#5a3f8f"/><stop offset="1" stop-color="#ff6fa5"/></linearGradient>
    <linearGradient id="g-meadow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a6dc72"/><stop offset="1" stop-color="#6cbf4f"/></linearGradient>
    <linearGradient id="g-alp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfe9ff"/><stop offset="1" stop-color="#eafaff"/></linearGradient>
    <linearGradient id="g-night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b2556"/><stop offset="1" stop-color="#3a4a96"/></linearGradient>
    <linearGradient id="g-bath" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f6fa"/><stop offset="1" stop-color="#dde3ec"/></linearGradient>
    <linearGradient id="g-bakery" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb866"/><stop offset="1" stop-color="#ff8a33"/></linearGradient>
    <linearGradient id="g-studio" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#25212d"/><stop offset="1" stop-color="#453c50"/></linearGradient>
    <linearGradient id="g-study" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a0653a"/><stop offset="1" stop-color="#734222"/></linearGradient>
    <linearGradient id="g-disco" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff62c4"/><stop offset="1" stop-color="#c2309a"/></linearGradient>
    <linearGradient id="g-forest" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b5a46"/><stop offset="1" stop-color="#2c8466"/></linearGradient>
    <linearGradient id="g-aurora" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#36277a"/><stop offset="1" stop-color="#7c5dd0"/></linearGradient>
    <linearGradient id="g-party" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe46b"/><stop offset="1" stop-color="#ffc23a"/></linearGradient>
    <linearGradient id="g-rainbow" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ff5f7e"/><stop offset=".2" stop-color="#ff9f43"/><stop offset=".4" stop-color="#ffe14d"/>
      <stop offset=".6" stop-color="#4fd17a"/><stop offset=".8" stop-color="#4fb8ff"/><stop offset="1" stop-color="#9b6bff"/>
    </linearGradient>
    <radialGradient id="g-rainbow-bg" cx=".5" cy=".45" r=".7"><stop offset="0" stop-color="#fffdf2"/><stop offset="1" stop-color="#ffe0f0"/></radialGradient>
    <pattern id="p-gingham" width="16" height="16" patternUnits="userSpaceOnUse">
      <rect width="8" height="16" fill="#fff" opacity=".16"/><rect width="16" height="8" fill="#fff" opacity=".16"/>
    </pattern>
    <pattern id="p-gingham-strong" width="10" height="10" patternUnits="userSpaceOnUse">
      <rect width="5" height="10" fill="#f4646f" opacity=".55"/><rect width="10" height="5" fill="#f4646f" opacity=".55"/>
    </pattern>
  </defs>
</svg>`;

  const cache = new Map();

  function dogArt(type) {
    if (!cache.has(type)) cache.set(type, DOGS[type].art());
    return cache.get(type);
  }

  function dogSVG(type, extraClass = "") {
    return `<svg class="dog dog--${type} ${extraClass}" viewBox="0 0 100 100" aria-hidden="true" focusable="false">${dogArt(type)}</svg>`;
  }

  // Rainbow tennis ball: the "match anything" super piece.
  function rainbowSVG() {
    return (
      `<svg class="dog dog--rainbow" viewBox="0 0 100 100" aria-hidden="true" focusable="false">` +
      `<rect width="100" height="100" fill="url(#g-rainbow-bg)"/>` +
      `<g class="rainbow-rays" opacity=".5">` +
      [0, 45, 90, 135, 180, 225, 270, 315]
        .map((a, i) => `<path d="M50 50 L46 -8 L54 -8Z" fill="${["#ff5f7e", "#ff9f43", "#ffe14d", "#4fd17a", "#4fb8ff", "#9b6bff", "#ff5f7e", "#4fd17a"][i]}" transform="rotate(${a} 50 50)"/>`)
        .join("") +
      `</g>` +
      `<circle cx="50" cy="52" r="29" fill="url(#g-rainbow)" ${outline}/>` +
      `<path d="M26 36 Q42 52 26 68 M74 36 Q58 52 74 68" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>` +
      `<ellipse cx="40" cy="38" rx="8" ry="4" fill="#fff" opacity=".5" transform="rotate(-30 40 38)"/>` +
      sparkle(84, 18, 0.9, "#ffe14d") + sparkle(16, 82, 0.7, "#4fb8ff") +
      `</svg>`
    );
  }

  function injectDefs() {
    if (document.getElementById("dog-defs")) return;
    const holder = document.createElement("div");
    holder.id = "dog-defs";
    holder.innerHTML = DEFS;
    document.body.prepend(holder);
  }

  window.BellaDogs = { DOGS, TYPES, dogSVG, rainbowSVG, injectDefs };
})();
