/* Map scenery: little props scattered along each chapter's path, one big
 * landmark per chapter, and the ambient particles that drift over it.
 * All art is inline SVG drawn on a 48×48 grid (landmarks on 120×120).
 */
(() => {
  "use strict";

  const INK = "#3b2618";
  const o = (w = 2) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
  const svg = (body, vb = 48) => `<svg viewBox="0 0 ${vb} ${vb}" aria-hidden="true" focusable="false">${body}</svg>`;

  /* ------------------------------ Props ------------------------------ */

  const P = {
    // beach
    palm:
      `<path d="M25 46 Q22 32 26 18" fill="none" stroke="#a8743f" stroke-width="5" stroke-linecap="round"/><path d="M25 46 Q22 32 26 18" fill="none" ${o(1.6)} stroke-dasharray="1 5"/>` +
      `<path d="M26 18 Q14 8 4 16 Q14 14 26 18Z M26 18 Q38 6 46 14 Q36 12 26 18Z M26 18 Q20 22 12 32 Q22 26 26 18Z M26 18 Q34 22 40 32 Q30 24 26 18Z" fill="#4fbf63" ${o(1.6)}/>` +
      `<circle cx="24" cy="20" r="2.6" fill="#8a5a2b" ${o(1.2)}/><circle cx="28.5" cy="20.5" r="2.6" fill="#8a5a2b" ${o(1.2)}/>`,
    umbrella:
      `<path d="M24 22 L26 46" ${o(2.4)}/><path d="M4 22 Q24 -2 44 22 Q39 18 34 22 Q29 18 24 22 Q19 18 14 22 Q9 18 4 22Z" fill="#ff6f6f" ${o(1.8)}/>` +
      `<path d="M14 22 Q17 8 24 4 Q31 8 34 22 Q29 18 24 22 Q19 18 14 22Z" fill="#fff4e0"/><path d="M4 22 Q24 -2 44 22" fill="none" ${o(1.8)}/>`,
    shell: `<path d="M24 8 Q42 12 42 30 Q34 40 24 40 Q14 40 6 30 Q6 12 24 8Z" fill="#ffc7b8" ${o()}/><path d="M24 40 L24 12 M24 40 L14 14 M24 40 L34 14 M24 40 L9 22 M24 40 L39 22" ${o(1.4)}/>`,
    starfish: `<path d="M24 4 L29 18 L44 18 L32 27 L37 42 L24 33 L11 42 L16 27 L4 18 L19 18Z" fill="#ff9d5c" ${o()}/><circle cx="24" cy="22" r="1.4" fill="#fff"/><circle cx="19" cy="26" r="1" fill="#fff"/><circle cx="29" cy="26" r="1" fill="#fff"/>`,
    crab:
      `<ellipse cx="24" cy="30" rx="13" ry="9" fill="#ff6a55" ${o()}/><path d="M11 28 Q4 22 8 14 M37 28 Q44 22 40 14" fill="none" ${o()}/>` +
      `<path d="M4 14 Q8 6 12 14 Q8 12 4 14Z M36 14 Q40 6 44 14 Q40 12 36 14Z" fill="#ff6a55" ${o(1.6)}/><circle cx="20" cy="26" r="2" fill="${INK}"/><circle cx="28" cy="26" r="2" fill="${INK}"/><path d="M21 32 Q24 34.5 27 32" fill="none" ${o(1.4)}/>`,
    // meadow
    tulips:
      `<path d="M14 46 V26 M24 46 V20 M34 46 V28" stroke="#3f9d48" stroke-width="2.6" stroke-linecap="round"/><path d="M24 40 Q16 34 12 36 M24 38 Q32 32 38 34" fill="none" stroke="#3f9d48" stroke-width="2.4" stroke-linecap="round"/>` +
      `<path d="M8 26 Q8 16 14 14 Q20 16 20 26 Q14 30 8 26Z" fill="#ff7aa8" ${o(1.6)}/><path d="M18 20 Q18 9 24 7 Q30 9 30 20 Q24 24 18 20Z" fill="#ffd23f" ${o(1.6)}/><path d="M28 28 Q28 18 34 16 Q40 18 40 28 Q34 32 28 28Z" fill="#b48cff" ${o(1.6)}/>`,
    mushroom: `<path d="M18 30 Q17 44 20 46 H28 Q31 44 30 30Z" fill="#fff6e6" ${o()}/><path d="M4 30 Q4 8 24 8 Q44 8 44 30Z" fill="#ff5f5f" ${o()}/><circle cx="15" cy="20" r="3.4" fill="#fff"/><circle cx="29" cy="15" r="2.6" fill="#fff"/><circle cx="35" cy="24" r="3" fill="#fff"/>`,
    fence: `<path d="M3 24 H45 M3 36 H45" stroke="#e6c896" stroke-width="4"/><path d="M8 46 V16 L11 12 L14 16 V46Z M22.5 46 V16 L25.5 12 L28.5 16 V46Z M37 46 V16 L40 12 L43 16 V46Z" fill="#fff4dc" ${o(1.8)}/>`,
    bush: `<path d="M6 42 Q2 30 12 28 Q12 16 24 18 Q34 12 38 24 Q48 26 44 42Z" fill="#6cc65a" ${o()}/><circle cx="16" cy="32" r="2.4" fill="#ff7aa8"/><circle cx="30" cy="26" r="2.4" fill="#fff"/><circle cx="34" cy="36" r="2.4" fill="#ffd23f"/>`,
    beehive: `<path d="M24 4 V10" ${o(2)}/><path d="M12 22 Q12 10 24 10 Q36 10 36 22 Q40 34 30 42 H18 Q8 34 12 22Z" fill="#ffd23f" ${o()}/><path d="M11 20 H37 M10 28 H38 M13 36 H35" ${o(1.4)}/><ellipse cx="24" cy="38" rx="3" ry="2.4" fill="${INK}"/>`,
    // aurora
    pineSnow:
      `<path d="M24 2 L36 18 L31 18 L42 32 L35 32 L46 44 H2 L13 32 L6 32 L17 18 L12 18Z" fill="#2f8f6a" ${o(1.8)}/>` +
      `<path d="M24 2 L30 10 Q24 13 18 10Z M17 18 Q24 22 31 18 L34 22 Q24 26 14 22Z M13 32 Q24 36 35 32 L38 35 Q24 40 10 35Z" fill="#fff"/>`,
    snowman:
      `<circle cx="24" cy="34" r="11" fill="#fff" ${o()}/><circle cx="24" cy="16" r="8" fill="#fff" ${o()}/><path d="M17 10 H31 L29 2 H19Z" fill="#3a3a4a" ${o(1.6)}/>` +
      `<circle cx="21" cy="15" r="1.3" fill="${INK}"/><circle cx="27" cy="15" r="1.3" fill="${INK}"/><path d="M24 17.5 L31 19 L24 20Z" fill="#ff9d3c"/><path d="M15 24 Q24 28 33 24 L34 27 Q24 31 14 27Z" fill="#ff5f7e" ${o(1.2)}/>` +
      `<circle cx="24" cy="32" r="1.4" fill="${INK}"/><circle cx="24" cy="38" r="1.4" fill="${INK}"/>`,
    crystal: `<path d="M24 4 V44 M6 14 L42 34 M42 14 L6 34" stroke="#bfe9ff" stroke-width="3.4" stroke-linecap="round"/><path d="M24 10 L20 6 M24 10 L28 6 M24 38 L20 42 M24 38 L28 42" stroke="#bfe9ff" stroke-width="2.4" stroke-linecap="round"/><circle cx="24" cy="24" r="4" fill="#fff"/>`,
    penguin:
      `<ellipse cx="24" cy="28" rx="13" ry="16" fill="#2d3348" ${o()}/><ellipse cx="24" cy="31" rx="8.5" ry="11.5" fill="#fff"/><circle cx="20" cy="20" r="1.6" fill="${INK}"/><circle cx="28" cy="20" r="1.6" fill="${INK}"/>` +
      `<path d="M21 24 L24 28 L27 24Z" fill="#ffb13c" ${o(1)}/><path d="M16 44 H22 M26 44 H32" stroke="#ffb13c" stroke-width="3" stroke-linecap="round"/><path d="M14 18 Q24 12 34 18 L33 14 Q24 8 15 14Z" fill="#4fb8f2" ${o(1.2)}/>`,
    // bath
    duck:
      `<path d="M8 30 Q8 44 24 44 Q40 44 42 30 Q36 32 30 30 Q34 18 24 14 Q14 14 16 26 Q12 28 8 30Z" fill="#ffd23f" ${o()}/>` +
      `<path d="M14 21 L6 22 L14 25Z" fill="#ff8a3d" ${o(1.4)}/><circle cx="19" cy="20" r="1.6" fill="${INK}"/><path d="M22 34 Q28 38 34 33" fill="none" stroke="#e8a91a" stroke-width="2" stroke-linecap="round"/>`,
    soap: `<rect x="6" y="18" width="36" height="20" rx="8" fill="#b9f0d6" ${o()}/><path d="M12 24 Q20 22 26 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><circle cx="16" cy="12" r="5" fill="#fff" stroke="#aab6cc" stroke-width="1.4"/><circle cx="28" cy="9" r="3.4" fill="#fff" stroke="#aab6cc" stroke-width="1.4"/><circle cx="36" cy="13" r="2.4" fill="#fff" stroke="#aab6cc" stroke-width="1.2"/>`,
    bubbles: `<circle cx="18" cy="28" r="12" fill="#fff" fill-opacity=".7" stroke="#aab6cc" stroke-width="1.6"/><circle cx="35" cy="16" r="7" fill="#fff" fill-opacity=".7" stroke="#aab6cc" stroke-width="1.4"/><circle cx="36" cy="38" r="5" fill="#fff" fill-opacity=".7" stroke="#aab6cc" stroke-width="1.4"/><path d="M11 22 Q14 18 18 18" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`,
    towel: `<rect x="8" y="6" width="32" height="38" rx="4" fill="#9fe0b0" ${o()}/><path d="M8 34 H40 M8 38 H40" stroke="#fff" stroke-width="2.4"/><path d="M4 8 H44" ${o(3)}/>`,
    // bakery
    cupcake:
      `<path d="M10 26 L14 44 H34 L38 26Z" fill="#ffb3c7" ${o()}/><path d="M17 27 L19 44 M24 27 V44 M31 27 L29 44" ${o(1.2)}/>` +
      `<path d="M8 27 Q6 18 14 16 Q16 8 24 9 Q32 8 34 16 Q42 18 40 27Z" fill="#fff6e6" ${o()}/><circle cx="24" cy="7" r="3.4" fill="#ff4d5e" ${o(1.4)}/>` +
      `<path d="M15 20 l2 -1 M28 15 l2 1 M32 22 l-1 2 M21 18 l1 2" stroke="#4fb8ff" stroke-width="1.8" stroke-linecap="round"/>`,
    donut: `<circle cx="24" cy="25" r="17" fill="#e8a35c" ${o()}/><path d="M9 21 Q12 9 24 8 Q38 9 40 22 Q38 30 34 26 Q30 32 24 28 Q18 32 14 26 Q10 30 9 21Z" fill="#ff8ab8"/><circle cx="24" cy="23" r="5" fill="#fff6e6" ${o(1.6)}/><path d="M15 15 l2 2 M30 13 l-1 2 M34 20 l2 0 M20 11 l2 0" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>`,
    croissant: `<path d="M4 30 Q8 12 24 12 Q40 12 44 30 Q38 26 34 28 Q30 22 24 22 Q18 22 14 28 Q10 26 4 30Z" fill="#f0a54a" ${o()}/><path d="M16 15 Q18 20 15 25 M24 12 V22 M32 15 Q30 20 33 25" fill="none" stroke="#b86b1e" stroke-width="1.6" stroke-linecap="round"/>`,
    cookie: `<circle cx="24" cy="24" r="17" fill="#e0a868" ${o()}/><circle cx="17" cy="18" r="2.6" fill="#6b3e26"/><circle cx="29" cy="15" r="2.2" fill="#6b3e26"/><circle cx="31" cy="28" r="2.8" fill="#6b3e26"/><circle cx="19" cy="31" r="2.2" fill="#6b3e26"/><circle cx="24" cy="23" r="1.6" fill="#6b3e26"/>`,
    // studio
    clapper:
      `<rect x="6" y="20" width="36" height="24" rx="2" fill="#2b2b33" ${o()}/><path d="M6 12 L40 6 L42 14 L8 20Z" fill="#fff" ${o(1.8)}/>` +
      `<path d="M14 11 L18 18 M23 9 L27 16 M32 8 L36 14" stroke="#2b2b33" stroke-width="3.4"/><path d="M11 28 H37 M11 34 H28" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>`,
    reel: `<circle cx="24" cy="24" r="18" fill="#3a3a46" ${o()}/><circle cx="24" cy="24" r="3" fill="#d9dbe8"/><circle cx="24" cy="13" r="4.4" fill="#d9dbe8"/><circle cx="24" cy="35" r="4.4" fill="#d9dbe8"/><circle cx="13" cy="24" r="4.4" fill="#d9dbe8"/><circle cx="35" cy="24" r="4.4" fill="#d9dbe8"/>`,
    starGold: `<path d="M24 3 L30 17 L45 18 L33 28 L37 43 L24 35 L11 43 L15 28 L3 18 L18 17Z" fill="#ffd65c" ${o()}/><path d="M16 21 L20 22" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`,
    popcorn:
      `<path d="M10 20 L14 46 H34 L38 20Z" fill="#fff" ${o()}/><path d="M16 20 L19 46 M24 20 V46 M32 20 L29 46" stroke="#ff4d5e" stroke-width="3"/>` +
      `<path d="M8 21 Q6 14 12 13 Q12 6 19 8 Q22 2 28 6 Q35 4 36 11 Q42 13 40 21Z" fill="#fff4c4" ${o(1.8)}/>`,
    // study
    books:
      `<rect x="6" y="34" width="36" height="9" rx="2" fill="#c9604a" ${o()}/><rect x="9" y="25" width="32" height="9" rx="2" fill="#5f8fc4" ${o()}/><rect x="7" y="16" width="30" height="9" rx="2" fill="#e8b04a" ${o()}/>` +
      `<path d="M10 38.5 H38 M13 29.5 H37 M11 20.5 H33" stroke="#fff" stroke-width="1.4" opacity=".7"/><path d="M28 16 L34 4 L37 6 L31 17Z" fill="#ffd23f" ${o(1.4)}/>`,
    pencil: `<path d="M8 40 L12 30 L36 6 L42 12 L18 36Z" fill="#ffd23f" ${o()}/><path d="M8 40 L12 30 L18 36Z" fill="#f7d9a8" ${o(1.4)}/><path d="M8 40 L10 35 L13 38Z" fill="${INK}"/><path d="M32 10 L38 16" stroke="#ff8ab8" stroke-width="4"/>`,
    globe:
      `<path d="M24 38 V44 M16 45 H32" ${o(2.4)}/><path d="M38 10 Q46 24 36 36 Q26 44 14 38" fill="none" stroke="#c9a364" stroke-width="2.6" stroke-linecap="round"/>` +
      `<circle cx="24" cy="23" r="14" fill="#7fc8f2" ${o()}/><path d="M14 16 Q20 14 22 20 Q18 26 22 30 Q16 32 13 26Z M28 12 Q34 14 36 22 Q30 22 30 28 Q26 24 28 18Z" fill="#6fcf6a"/>`,
    lamp: `<path d="M24 22 V42 M14 44 H34" ${o(2.6)}/><path d="M12 22 L18 6 H30 L36 22Z" fill="#9fe0b0" ${o()}/><ellipse cx="24" cy="24" rx="6" ry="2.4" fill="#fff6a8"/>`,
    // disco
    note: `<path d="M18 36 V10 L38 6 V30" fill="none" ${o(2.6)}/><ellipse cx="13" cy="36" rx="6" ry="4.6" fill="#ff62c4" ${o()}/><ellipse cx="33" cy="31" rx="6" ry="4.6" fill="#7ff2ff" ${o()}/>`,
    vinyl: `<circle cx="24" cy="24" r="19" fill="#2a2340" ${o()}/><circle cx="24" cy="24" r="13" fill="none" stroke="#4a3f66" stroke-width="1.4"/><circle cx="24" cy="24" r="8" fill="#ffe14d" ${o(1.4)}/><circle cx="24" cy="24" r="1.6" fill="${INK}"/><path d="M12 14 Q16 10 22 9" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".5"/>`,
    speaker: `<rect x="10" y="4" width="28" height="40" rx="5" fill="#3a2160" ${o()}/><circle cx="24" cy="30" r="8.5" fill="#ff62c4" ${o(1.6)}/><circle cx="24" cy="30" r="3" fill="${INK}"/><circle cx="24" cy="13" r="4.4" fill="#7ff2ff" ${o(1.4)}/>`,
    neonStar: `<path d="M24 4 L29 18 L44 18 L32 27 L37 42 L24 33 L11 42 L16 27 L4 18 L19 18Z" fill="none" stroke="#7ff2ff" stroke-width="3.2" stroke-linejoin="round"/><path d="M24 4 L29 18 L44 18 L32 27 L37 42 L24 33 L11 42 L16 27 L4 18 L19 18Z" fill="none" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>`,
    // camp
    pine: `<path d="M24 2 L36 18 L31 18 L42 32 L35 32 L46 44 H2 L13 32 L6 32 L17 18 L12 18Z" fill="#2f8f6a" ${o(1.8)}/><path d="M22 44 V48 H26 V44" fill="#8a5a33"/>`,
    campfire:
      `<path d="M8 42 L40 36 M8 36 L40 42" stroke="#8a5a33" stroke-width="5" stroke-linecap="round"/>` +
      `<path d="M24 6 Q34 18 32 28 Q30 36 24 36 Q16 36 15 28 Q14 20 20 14 Q20 22 24 22 Q22 14 24 6Z" fill="#ff8a3d" ${o(1.8)}/><path d="M24 20 Q29 26 27 31 Q24 34 21 31 Q20 26 24 20Z" fill="#ffe14d"/>`,
    lantern: `<path d="M18 8 Q24 2 30 8" fill="none" ${o(2)}/><rect x="14" y="8" width="20" height="6" rx="2" fill="#3a3a46" ${o(1.6)}/><path d="M15 14 H33 L31 36 H17Z" fill="#ffe680" ${o()}/><rect x="13" y="36" width="22" height="6" rx="2" fill="#3a3a46" ${o(1.6)}/><ellipse cx="24" cy="25" rx="4" ry="6" fill="#fff6c2"/>`,
    log: `<rect x="4" y="22" width="36" height="16" rx="8" fill="#a8743f" ${o()}/><ellipse cx="40" cy="30" rx="6" ry="8" fill="#e9c08a" ${o()}/><ellipse cx="40" cy="30" rx="2.6" ry="3.6" fill="none" stroke="#b07a45" stroke-width="1.4"/><path d="M14 22 Q16 14 22 14" fill="none" stroke="#5aa83e" stroke-width="2.4" stroke-linecap="round"/><ellipse cx="24" cy="13" rx="4" ry="2.6" fill="#6fcf6a" ${o(1.2)}/>`,
    chest:
      `<path d="M5 22 Q5 8 24 8 Q43 8 43 22Z" fill="#c9793a" ${o()}/><rect x="5" y="22" width="38" height="20" rx="3" fill="#a8602c" ${o()}/>` +
      `<path d="M14 9 V42 M34 9 V42" stroke="#ffd23f" stroke-width="3.4"/><path d="M14 9 V42 M34 9 V42" ${o(1)} opacity=".5"/>` +
      `<rect x="19" y="19" width="10" height="10" rx="2" fill="#ffd23f" ${o(1.6)}/><circle cx="24" cy="24" r="1.6" fill="${INK}"/>`,
    chestOpen:
      `<path class="lm-blink" d="M24 0 L26 6 L32 7 L26 9 L24 15 L22 9 L16 7 L22 6Z M40 6 L41 9 L44 10 L41 11 L40 14 L39 11 L36 10 L39 9Z" fill="#ffd65c"/>` +
      `<path d="M7 20 L4 6 Q22 0 41 6 L42 20Z" fill="#c9793a" ${o()}/><ellipse cx="24" cy="23" rx="18" ry="4" fill="#ffe14d"/>` +
      `<circle cx="16" cy="21" r="3" fill="#ffd23f" ${o(1.2)}/><circle cx="24" cy="20" r="3" fill="#ffd23f" ${o(1.2)}/><circle cx="31" cy="22" r="3" fill="#ffd23f" ${o(1.2)}/>` +
      `<rect x="5" y="23" width="38" height="20" rx="3" fill="#a8602c" ${o()}/><path d="M14 23 V43 M34 23 V43" stroke="#ffd23f" stroke-width="3.4"/>`,
    acorn: `<path d="M12 22 Q12 42 24 44 Q36 42 36 22Z" fill="#c98a4b" ${o()}/><path d="M8 22 Q8 10 24 10 Q40 10 40 22Z" fill="#8a5a33" ${o()}/><path d="M24 10 Q25 4 29 3" fill="none" ${o(2.2)}/>`,
  };

  // Ambient sprite shapes: tiny, unlined, cheap to animate.
  const A = {
    cloud: `<svg viewBox="0 0 60 30"><path d="M8 28 Q0 28 2 20 Q4 13 12 15 Q14 4 26 6 Q34 0 42 8 Q52 6 54 16 Q62 18 58 26 Q56 28 50 28Z" fill="#fff" opacity=".9"/></svg>`,
    butterfly: `<svg viewBox="0 0 30 30"><path d="M15 15 Q4 0 2 10 Q2 17 15 15 Q4 22 8 27 Q12 28 15 15 Q26 0 28 10 Q28 17 15 15 Q26 22 22 27 Q18 28 15 15Z" fill="#ff9ec4" stroke="${INK}" stroke-width="1.2"/><path d="M15 8 V22" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/></svg>`,
    snow: `<svg viewBox="0 0 20 20"><path d="M10 1 V19 M2 5.5 L18 14.5 M18 5.5 L2 14.5" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>`,
    bubble: `<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="8.5" fill="#fff" fill-opacity=".45" stroke="#fff" stroke-width="1.4"/><path d="M5 8 Q6 5 9 4.5" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></svg>`,
    sprinkle: `<svg viewBox="0 0 20 20"><rect x="2" y="8" width="16" height="4.4" rx="2.2" fill="currentColor"/></svg>`,
    spark: `<svg viewBox="0 0 20 20"><path d="M10 0 Q11 9 20 10 Q11 11 10 20 Q9 11 0 10 Q9 9 10 0Z" fill="currentColor"/></svg>`,
    note: `<svg viewBox="0 0 20 20"><path d="M7 15 V3 L17 1 V13" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="5" cy="15" r="3" fill="currentColor"/><circle cx="15" cy="13" r="3" fill="currentColor"/></svg>`,
    plane: `<svg viewBox="0 0 30 20"><path d="M1 10 L29 1 L18 19 L14 12Z" fill="#fff" stroke="#7a8aa8" stroke-width="1.2" stroke-linejoin="round"/><path d="M14 12 L29 1" stroke="#7a8aa8" stroke-width="1.2"/></svg>`,
    firefly: `<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="9" fill="#d9ff7a" opacity=".25"/><circle cx="10" cy="10" r="3.4" fill="#eaff9a"/></svg>`,
  };

  /* ---------------------------- Landmarks ---------------------------- */

  const L = {
    beach:
      `<ellipse cx="60" cy="110" rx="46" ry="8" fill="#000" opacity=".08"/>` +
      `<path d="M44 108 L50 30 H70 L76 108Z" fill="#fff" ${o(2.4)}/>` +
      `<path d="M47 76 H73 L74.5 92 H45.5Z M49 46 H71 L72 60 H48Z" fill="#ff6f6f"/>` +
      `<path d="M44 108 L50 30 H70 L76 108Z" fill="none" ${o(2.4)}/>` +
      `<rect x="46" y="18" width="28" height="14" rx="2" fill="#ffe680" ${o(2.2)}/><path d="M42 18 L60 4 L78 18Z" fill="#ff6f6f" ${o(2.2)}/>` +
      `<path class="lm-beam" d="M74 22 L118 8 L118 34Z M46 22 L2 8 L2 34Z" fill="#fff6a8" opacity=".55"/>` +
      `<rect x="56" y="88" width="8" height="20" rx="4" fill="#5c3a22"/>`,
    meadow:
      `<ellipse cx="60" cy="112" rx="40" ry="7" fill="#000" opacity=".08"/>` +
      `<path d="M42 110 L48 54 H72 L78 110Z" fill="#fff4dc" ${o(2.4)}/><path d="M44 54 L60 38 L76 54Z" fill="#ff7a6a" ${o(2.2)}/>` +
      `<rect x="54" y="90" width="12" height="20" rx="5" fill="#a8743f" ${o(2)}/><circle cx="60" cy="70" r="5" fill="#bfe9ff" ${o(1.8)}/>` +
      `<g class="lm-spin" style="transform-origin:60px 48px">` +
      [0, 90, 180, 270].map((a) => `<path d="M60 48 L56 10 L64 6 L66 44Z" fill="#fff" ${o(2)} transform="rotate(${a} 60 48)"/><path d="M58.5 40 L57 18 M62.5 40 L62 16" stroke="#ffb3c7" stroke-width="2" transform="rotate(${a} 60 48)"/>`).join("") +
      `</g><circle cx="60" cy="48" r="5" fill="#8a5a33" ${o(2)}/>`,
    aurora:
      `<ellipse cx="60" cy="108" rx="50" ry="8" fill="#000" opacity=".1"/>` +
      `<path d="M14 104 Q14 50 60 46 Q106 50 106 104Z" fill="#f4f8ff" ${o(2.4)}/>` +
      `<path d="M24 76 Q60 66 96 76 M16 92 Q60 82 104 92 M40 60 Q60 54 80 60 M38 48 L40 76 M62 46 V66 M84 52 L80 76 M30 78 L28 92 M60 68 V84 M92 78 L94 92" fill="none" stroke="#b9c9f0" stroke-width="2"/>` +
      `<path d="M44 104 Q44 80 60 80 Q76 80 76 104Z" fill="#2d3348" ${o(2.2)}/>` +
      `<path d="M50 104 V96 Q52 92 56 94" fill="none" stroke="#ffe680" stroke-width="3" stroke-linecap="round" opacity=".7"/>`,
    bath:
      `<ellipse cx="60" cy="112" rx="50" ry="6" fill="#000" opacity=".08"/>` +
      `<path d="M98 64 V28 Q98 16 86 16 Q76 16 76 26" fill="none" stroke="#c4ccd8" stroke-width="5" stroke-linecap="round"/><circle cx="76" cy="30" r="5" fill="#d9dfe8" ${o(1.8)}/>` +
      `<g class="lm-bob"><circle cx="30" cy="54" r="12" fill="#fff" stroke="#aab6cc" stroke-width="2"/><circle cx="50" cy="48" r="15" fill="#fff" stroke="#aab6cc" stroke-width="2"/><circle cx="72" cy="54" r="12" fill="#fff" stroke="#aab6cc" stroke-width="2"/><circle cx="88" cy="60" r="9" fill="#fff" stroke="#aab6cc" stroke-width="2"/></g>` +
      `<path d="M8 62 H112 Q110 98 84 102 H36 Q10 98 8 62Z" fill="#fff" ${o(2.6)}/><path d="M16 72 H104" stroke="#e3e9f2" stroke-width="3" stroke-linecap="round"/>` +
      `<path d="M30 102 L26 112 M90 102 L94 112" ${o(4)}/>`,
    bakery:
      `<ellipse cx="60" cy="112" rx="46" ry="7" fill="#000" opacity=".08"/>` +
      `<rect x="16" y="78" width="88" height="30" rx="6" fill="#ffd9a8" ${o(2.4)}/><path d="M16 86 Q27 96 38 86 Q49 96 60 86 Q71 96 82 86 Q93 96 104 86" fill="#ff8ab8" ${o(2)}/>` +
      `<rect x="28" y="52" width="64" height="28" rx="6" fill="#fff6e6" ${o(2.4)}/><path d="M28 60 Q36 68 44 60 Q52 68 60 60 Q68 68 76 60 Q84 68 92 60" fill="#9fe0b0" ${o(2)}/>` +
      `<rect x="42" y="32" width="36" height="22" rx="6" fill="#ffb3c7" ${o(2.4)}/>` +
      `<path d="M60 16 V32" ${o(3)}/><path class="lm-flame" d="M60 4 Q66 10 60 16 Q54 10 60 4Z" fill="#ffb13c" ${o(1.6)}/>` +
      `<circle cx="36" cy="94" r="3" fill="#ff4d5e"/><circle cx="60" cy="98" r="3" fill="#ff4d5e"/><circle cx="84" cy="94" r="3" fill="#ff4d5e"/>`,
    studio:
      `<ellipse cx="60" cy="112" rx="40" ry="7" fill="#000" opacity=".12"/>` +
      `<path class="lm-beam" d="M70 34 L120 0 L120 70Z" fill="#fff6c2" opacity=".35"/>` +
      `<path d="M60 70 L40 110 M60 70 L80 110 M60 70 V110" ${o(3)}/>` +
      `<rect x="20" y="40" width="54" height="34" rx="6" fill="#3a3a46" ${o(2.4)}/><path d="M74 48 L94 38 V76 L74 66Z" fill="#2b2b33" ${o(2.2)}/>` +
      `<circle cx="34" cy="28" r="13" fill="#3a3a46" ${o(2.2)}/><circle cx="60" cy="28" r="13" fill="#3a3a46" ${o(2.2)}/>` +
      `<g class="lm-spin" style="transform-origin:34px 28px"><circle cx="34" cy="21" r="3" fill="#d9dbe8"/><circle cx="34" cy="35" r="3" fill="#d9dbe8"/><circle cx="27" cy="28" r="3" fill="#d9dbe8"/><circle cx="41" cy="28" r="3" fill="#d9dbe8"/></g>` +
      `<g class="lm-spin" style="transform-origin:60px 28px"><circle cx="60" cy="21" r="3" fill="#d9dbe8"/><circle cx="60" cy="35" r="3" fill="#d9dbe8"/><circle cx="53" cy="28" r="3" fill="#d9dbe8"/><circle cx="67" cy="28" r="3" fill="#d9dbe8"/></g>` +
      `<circle cx="34" cy="57" r="5" fill="#ff4d5e" class="lm-blink"/>`,
    study:
      `<ellipse cx="60" cy="112" rx="44" ry="7" fill="#000" opacity=".08"/>` +
      `<path d="M60 92 V104 M42 108 H78" ${o(4)}/><path d="M92 26 Q110 58 88 86 Q70 104 40 92" fill="none" stroke="#c9a364" stroke-width="5" stroke-linecap="round"/>` +
      `<g class="lm-spin-slow" style="transform-origin:60px 56px"><circle cx="60" cy="56" r="34" fill="#7fc8f2" ${o(2.6)}/>` +
      `<path d="M36 40 Q48 34 52 48 Q42 60 50 72 Q36 76 30 62Z M66 30 Q82 34 88 52 Q74 52 74 66 Q64 58 68 44Z M58 80 Q68 78 72 86 Q64 90 58 86Z" fill="#6fcf6a" ${o(1.6)}/></g>` +
      `<path d="M30 40 Q46 30 58 32" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".6"/>`,
    disco:
      `<path d="M60 0 V20" ${o(2.4)}/>` +
      `<g class="lm-spin-slow" style="transform-origin:60px 56px"><circle cx="60" cy="56" r="36" fill="#d9dbe8" ${o(2.6)}/>` +
      Array.from({ length: 5 }, (_, r) => Array.from({ length: 6 }, (_, c) => `<rect x="${32 + c * 9.5}" y="${30 + r * 10}" width="8" height="8" rx="1" fill="${(r + c) % 3 === 0 ? "#fff" : (r + c) % 3 === 1 ? "#b9bdd6" : "#ff9fdc"}" opacity=".9"/>`).join("")).join("") +
      `</g><circle cx="60" cy="56" r="36" fill="none" ${o(2.6)}/><path d="M38 38 Q46 28 58 26" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/>` +
      `<path class="lm-blink" d="M14 98 L18 88 L22 98 L32 100 L22 104 L18 114 L14 104 L4 100Z M102 86 L105 78 L108 86 L116 88 L108 91 L105 99 L102 91 L94 88Z" fill="#7ff2ff"/>`,
    camp:
      `<ellipse cx="60" cy="112" rx="52" ry="7" fill="#000" opacity=".12"/>` +
      `<path d="M10 108 L52 28 L94 108Z" fill="#ff8a3d" ${o(2.6)}/><path d="M52 28 L72 108 H94Z" fill="#e8653a" ${o(2)}/>` +
      `<path d="M38 108 L52 72 L62 108Z" fill="#3a2a20" ${o(2.2)}/><path d="M52 28 L48 18 M52 28 L58 18" ${o(2.4)}/>` +
      `<path d="M100 108 L112 98 M100 98 L112 108" stroke="#8a5a33" stroke-width="4" stroke-linecap="round"/>` +
      `<path class="lm-flame" d="M106 74 Q116 86 112 96 Q106 102 100 96 Q96 86 106 74Z" fill="#ffb13c" ${o(1.6)}/><path d="M106 86 Q110 92 108 96 Q106 98 104 96 Q102 92 106 86Z" fill="#ffe14d"/>`,
  };

  /* --------------------------- Chapter sets --------------------------- */

  const SETS = {
    beach: { props: ["palm", "umbrella", "shell", "starfish", "crab", "palm"], amb: ["cloud", 4], tint: "#e2a33c", patch: "#9fe3ef", accent: ["tuft", "#7fcf6a"] },
    meadow: { props: ["tulips", "mushroom", "fence", "bush", "beehive", "tulips"], amb: ["butterfly", 6], tint: "#ff9ec4", patch: "#8fd16a", accent: ["flower", "#ff9ec4"] },
    aurora: { props: ["pineSnow", "snowman", "crystal", "penguin", "pineSnow"], amb: ["snow", 14], tint: "#fff", patch: "#f4fbff", accent: ["sparkle", "#d9f7ff"] },
    bath: { props: ["duck", "soap", "bubbles", "towel", "duck"], amb: ["bubble", 12], tint: "#fff", patch: "#ffffff", accent: ["dots", "#aab6cc"] },
    bakery: { props: ["cupcake", "donut", "croissant", "cookie", "cupcake"], amb: ["sprinkle", 14], tint: "#ff8ab8", patch: "#ffc58a", accent: ["dots", "#ff8ab8"] },
    studio: { props: ["clapper", "reel", "starGold", "popcorn", "starGold"], amb: ["spark", 12], tint: "#ffd65c", patch: "#3a4a3f", accent: ["sparkle", "#ffd65c"] },
    study: { props: ["books", "pencil", "globe", "lamp", "books"], amb: ["plane", 4], tint: "#fff", patch: "#e0c08f", accent: ["dots", "#b98d55"] },
    disco: { props: ["note", "vinyl", "speaker", "neonStar", "note"], amb: ["note", 12], tint: "#7ff2ff", patch: "#ff9fdc", accent: ["sparkle", "#7ff2ff"] },
    camp: { props: ["pine", "campfire", "lantern", "log", "acorn", "pine"], amb: ["firefly", 14], tint: "#eaff9a", patch: "#2a6b52", accent: ["tuft", "#7fbf86"] },
  };

  const ACCENTS = {
    tuft: (c) => `<path d="M4 20 Q6 10 8 4 Q9 12 11 20 Q13 8 18 2 Q16 12 15 20Z" fill="${c}"/>`,
    flower: (c) => [0, 72, 144, 216, 288].map((a) => `<ellipse cx="11" cy="6" rx="3.4" ry="4.6" fill="${c}" transform="rotate(${a} 11 11)"/>`).join("") + `<circle cx="11" cy="11" r="3" fill="#ffd23f"/>`,
    sparkle: (c) => `<path d="M11 0 Q12 10 22 11 Q12 12 11 22 Q10 12 0 11 Q10 10 11 0Z" fill="${c}"/>`,
    dots: (c) => `<circle cx="5" cy="6" r="3" fill="${c}"/><circle cx="15" cy="4" r="2" fill="${c}"/><circle cx="12" cy="15" r="3.4" fill="${c}"/>`,
  };
  const accent = ([name, color]) => `<svg viewBox="0 0 22 22" aria-hidden="true">${ACCENTS[name](color)}</svg>`;

  const prop = (name) => svg(P[name] || "");
  const landmark = (id) => svg(L[id] || "", 120);
  const ambient = (name) => A[name] || "";

  window.BellaScenery = { SETS, prop, landmark, ambient, accent };
})();
