/* 汪汪消消乐 · app flow + match-3 engine */
(() => {
  "use strict";

  const { SoundKit, ParticleField } = window.BellaKit;
  const { DOGS, TYPES: ALL_TYPES, dogSVG, rainbowSVG, injectDefs } = window.BellaDogs;
  // Club headliners: always shown first on the home page and in the dex.
  const FEATURED = ["shiba", "shepherd", "bernese"];
  const HOME_ORDER = [...FEATURED, ...ALL_TYPES.filter((t) => !FEATURED.includes(t))];
  const SCENERY = window.BellaScenery;
  injectDefs();

  /* ------------------------------- Helpers ------------------------------- */

  const ROWS = 8;
  const COLS = 8;
  const $ = (s, p = document) => p.querySelector(s);
  const $$ = (s, p = document) => [...p.querySelectorAll(s)];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const fmt = (n) => Math.round(n).toLocaleString("en-US");
  const key = (r, c) => r * COLS + c;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const T = {
    swap: reduced ? 60 : 190,
    clear: reduced ? 80 : 300,
    fallBase: reduced ? 60 : 150,
    fallRow: reduced ? 10 : 48,
  };

  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  let rng = Math.random;
  const pick = (arr, r = rng) => arr[Math.floor(r() * arr.length)];
  const shuffled = (arr, r = Math.random) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(r() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  /* -------------------------------- Save -------------------------------- */

  const SAVE_KEY = "bella-dog-club-v2";
  const DEFAULTS = {
    unlocked: 1,
    stars: {},
    best: { timed: 0, zen: 0 },
    daily: {},
    timedPick: { shape: "random", obstacles: "random", time: 60 },
    versus: { wins: 0, losses: 0, draws: 0 },
    settings: { sfx: true, music: true, haptics: true },
    seenHelp: false,
  };
  let save = loadSave();
  // v1 capped progress at level 30; players who finished it move on to chapter 4.
  if (save.unlocked === 30 && save.stars[30]) save.unlocked = 31;

  function loadSave() {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY)) || {};
      return {
        ...structuredClone(DEFAULTS),
        ...d,
        best: { ...DEFAULTS.best, ...(d.best || {}) },
        timedPick: { ...DEFAULTS.timedPick, ...(d.timedPick || {}) },
        versus: { ...DEFAULTS.versus, ...(d.versus || {}) },
        settings: { ...DEFAULTS.settings, ...(d.settings || {}) },
      };
    } catch (e) {
      return structuredClone(DEFAULTS);
    }
  }
  function persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch (e) {
      /* private mode: progress lives for this session only */
    }
  }
  const totalStars = () => Object.values(save.stars).reduce((a, b) => a + b, 0);
  const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  /* -------------------------------- Audio -------------------------------- */

  const sound = new SoundKit();
  function applyAudioSettings() {
    const { sfx, music } = save.settings;
    sound.sfx = sfx;
    sound.wantMusic = music;
    sound.enabled = sfx || music;
    if (music && sound.ctx) sound.startMusic();
    if (!music) sound.stopMusic();
    document.body.classList.toggle("is-muted", !sfx && !music);
    $$("[data-setting]").forEach((input) => {
      input.checked = Boolean(save.settings[input.dataset.setting]);
    });
  }
  const haptic = (ms) => {
    if (save.settings.haptics && navigator.vibrate) {
      try {
        navigator.vibrate(ms);
      } catch (e) {
        /* unsupported */
      }
    }
  };

  /* ------------------------------- Levels -------------------------------- */

  const LEVEL_COUNT = 90;
  const CHAPTERS = [
    { id: "beach", name: "阳光海滩", dog: "golden", from: 1, to: 10 },
    { id: "meadow", name: "雏菊花田", dog: "bernese", from: 11, to: 20 },
    { id: "aurora", name: "极光雪原", dog: "husky", from: 21, to: 30 },
    { id: "bath", name: "泡泡浴室", dog: "pug", from: 31, to: 40 },
    { id: "bakery", name: "甜点烘焙坊", dog: "poodle", from: 41, to: 50 },
    { id: "studio", name: "星光片场", dog: "dalmatian", from: 51, to: 60 },
    { id: "study", name: "学霸书房", dog: "collie", from: 61, to: 70 },
    { id: "disco", name: "霓虹舞厅", dog: "frenchie", from: 71, to: 80 },
    { id: "camp", name: "森林露营", dog: "dachshund", from: 81, to: 90 },
  ];
  const chapterOf = (n) => CHAPTERS.find((c) => n >= c.from && n <= c.to) || CHAPTERS[0];

  function pickTypes(count, must, r) {
    const rest = shuffled(ALL_TYPES.filter((t) => t !== must), r);
    return shuffled([must, ...rest.slice(0, count - 1)], r);
  }

  /* ----------------------------- Board layouts ---------------------------- */

  // Shapes: "." playable cell, "_" hole (tiles fall straight through it).
  const SHAPES = {
    full: { name: "方方正正", rows: ["........", "........", "........", "........", "........", "........", "........", "........"] },
    corners: { name: "圆角饼干", rows: ["_......_", "........", "........", "........", "........", "........", "........", "_......_"] },
    diamond: { name: "钻石", rows: ["___..___", "__....__", "_......_", "........", "........", "_......_", "__....__", "___..___"] },
    heart: { name: "爱心", rows: ["_..__.._", "........", "........", "........", "........", "_......_", "__....__", "___..___"] },
    plus: { name: "十字路口", rows: ["__....__", "__....__", "........", "........", "........", "........", "__....__", "__....__"] },
    donut: { name: "甜甜圈", rows: ["_......_", "........", "........", "...__...", "...__...", "........", "........", "_......_"] },
    hourglass: { name: "沙漏", rows: ["........", "_......_", "__....__", "__....__", "__....__", "__....__", "_......_", "........"] },
    bone: { name: "大骨头", rows: ["...__...", "...__...", "........", "_......_", "_......_", "........", "...__...", "...__..."] },
    bridge: { name: "小木桥", rows: ["...__...", "...__...", "...__...", "........", "........", "...__...", "...__...", "...__..."] },
    stairs: { name: "楼梯", rows: ["____....", "___.....", "__......", "_.......", "........", "........", "........", "........"] },
    castle: { name: "城堡", rows: [".__..__.", "........", "........", "........", "........", "........", "........", "........"] },
    window: { name: "四格窗", rows: ["........", "........", "........", "........", "___..___", "........", "........", "........"] },
    bowl: { name: "狗饭盆", rows: ["........", "........", "........", "........", "_......_", "_......_", "__....__", "___..___"] },
  };
  // Obstacles laid over a shape: c = crate, C = double crate, L = caged dog. Holes win.
  const OVERLAYS = {
    floor: ["........", "........", "........", "........", "........", "........", "........", "cccccccc"],
    center: ["........", "........", "........", "...cc...", "...cc...", "........", "........", "........"],
    corners: ["cc....cc", "c......c", "........", "........", "........", "........", "c......c", "cc....cc"],
    pillars: ["........", "........", ".c....c.", ".c....c.", ".c....c.", "........", "........", "........"],
    vault: ["........", "........", "........", "........", "........", "..cCCc..", "........", "c.c..c.c"],
    cageLine: ["........", "........", "........", "........", ".LLLLLL.", "........", "........", "........"],
    cageX: ["L......L", ".L....L.", "........", "........", "........", "........", ".L....L.", "L......L"],
    cageRing: ["........", "........", "..LLLL..", "..L..L..", "..L..L..", "..LLLL..", "........", "........"],
    mixed: ["........", "........", ".L....L.", "........", "..cccc..", "........", ".L....L.", "........"],
    fortress: ["........", "........", "........", "...LL...", "..cLLc..", "..cCCc..", "........", "........"],
    zigzag: ["........", "c.......", ".c.....L", "..c...L.", "...c.L..", "....c...", "........", "CC....CC"],
  };
  const OBSTACLE_NAMES = { c: "木箱", C: "双层木箱", L: "狗笼" };

  function buildLayout(shapeId, overlayId = null) {
    const shape = SHAPES[shapeId] || SHAPES.full;
    const over = overlayId ? OVERLAYS[overlayId] : null;
    const cells = shape.rows.map((row, r) =>
      [...row].map((ch, c) => {
        if (ch === "_") return "_";
        const o = over ? over[r][c] : ".";
        return "cCL".includes(o) ? o : ".";
      })
    );
    // A hole straight under every cell of a column would leave nothing to stand on; shapes avoid that.
    const count = { c: 0, C: 0, L: 0, cells: 0 };
    cells.flat().forEach((ch) => {
      if (ch !== "_") count.cells += 1;
      if (count[ch] !== undefined && ch !== "cells") count[ch] += 1;
    });
    return { shape: shapeId, overlay: overlayId, name: shape.name, cells, count, obstacles: count.c + count.C + count.L };
  }

  // Hand-placed teaching levels; the rest come from the seeded pickers below.
  const HAND_LAYOUTS = {
    4: ["corners"],
    5: ["diamond"],
    6: ["heart"],
    7: ["full", "floor", "clear"],
    8: ["castle", "center"],
    9: ["full", "corners"],
    10: ["bone", "pillars", "clear"],
    11: ["donut"],
    12: ["full", "cageLine", "clear"],
    13: ["hourglass", "cageX"],
    15: ["window", "mixed", "clear"],
    20: ["heart", "cageRing", "clear"],
    21: ["full", "vault", "clear"],
  };
  const SHAPE_POOL = ["corners", "diamond", "heart", "plus", "donut", "hourglass", "bone", "bridge", "stairs", "castle", "window", "bowl"];
  const BOSS_SHAPES = ["bone", "heart", "diamond", "donut", "plus", "bowl", "castle", "hourglass", "bridge"];

  function levelLayout(n, r) {
    if (n <= 3) return { layout: buildLayout("full"), clear: false };
    const hand = HAND_LAYOUTS[n];
    if (hand) return { layout: buildLayout(hand[0], hand[1] || null), clear: hand[2] === "clear" };
    const boss = n % 10 === 0;
    const shape = boss ? BOSS_SHAPES[(n / 10 - 1) % BOSS_SHAPES.length] : r() < 0.22 ? "full" : pick(SHAPE_POOL, r);
    // Obstacle families unlock in order: crates → cages → double crates / mixes.
    const pool = ["floor", "center", "corners", "pillars"];
    if (n >= 12) pool.push("cageLine", "cageX", "cageRing");
    if (n >= 21) pool.push("vault", "mixed", "fortress", "zigzag");
    const withObstacles = boss || n % 3 !== 1;
    let overlay = withObstacles ? pick(pool, r) : null;
    let layout = buildLayout(shape, overlay);
    // A shape can swallow most of an overlay; fall back to one that actually shows up.
    if (overlay && layout.obstacles < 3) layout = buildLayout(shape, (overlay = "center"));
    if (overlay && layout.obstacles < 2) layout = buildLayout(shape, null);
    return { layout, clear: layout.obstacles > 0 && (boss || r() < 0.4) };
  }

  // Random shape + obstacles for the free modes; retries until the obstacles actually show up.
  function randomLayout(r, withObstacles) {
    const shape = pick(["full", ...SHAPE_POOL], r);
    if (!withObstacles) return buildLayout(shape);
    for (let i = 0; i < 12; i += 1) {
      const layout = buildLayout(shape, pick(Object.keys(OVERLAYS), r));
      if (layout.obstacles >= 4) return layout;
    }
    return buildLayout(shape, "center");
  }

  // Sprint picker: obstacle families the player can ask for.
  const OBSTACLE_SETS = {
    crate: ["floor", "center", "corners", "pillars", "vault"],
    cage: ["cageLine", "cageX", "cageRing"],
    mixed: ["mixed", "fortress", "zigzag"],
  };
  const OBSTACLE_CHOICES = [
    ["random", "随机"],
    ["none", "不要"],
    ["crate", "木箱"],
    ["cage", "狗笼"],
    ["mixed", "混合"],
  ];
  function sampleLayout(shape, obstacles, r = Math.random) {
    const kind = obstacles === "random" ? pick(["none", "crate", "cage", "mixed"], r) : obstacles;
    if (kind === "none") return buildLayout(shape);
    let best = buildLayout(shape);
    for (const id of shuffled(OBSTACLE_SETS[kind], r)) {
      const layout = buildLayout(shape, id);
      if (layout.obstacles >= 4) return layout;
      if (layout.obstacles > best.obstacles) best = layout;
    }
    return best;
  }

  const clearGoal = (layout) => ({
    kind: "clear",
    target: layout.obstacles,
    only: layout.count.c + layout.count.C === 0 ? "cage" : layout.count.L === 0 ? "crate" : null,
  });

  function levelConfig(n) {
    const r = mulberry32(n * 7919 + 101);
    const chapter = chapterOf(n);
    const typeCount = n <= 3 ? 5 : n <= 14 ? 6 : 7;
    const types = pickTypes(typeCount, chapter.dog, r);
    const { layout, clear } = levelLayout(n, r);
    // Smaller boards make fewer matches per move, so ask for a little less.
    const scale = layout.count.cells < 52 ? 0.85 : 1;
    const moves = 20 + Math.min(6, Math.floor(n / 5)) + (layout.obstacles ? 2 : 0);
    const pattern = ["score", "collect1", "collect2", "skills", "collect1", "mixed"];
    const kind = n === 1 ? "score" : n === 2 ? "collect1" : clear ? "clear" : pattern[(n + Math.floor(r() * 2)) % pattern.length];
    const goals = [];
    const others = types.filter((t) => t !== chapter.dog);
    if (kind === "clear") {
      goals.push(clearGoal(layout));
      if (n >= 20) goals.push({ kind: "collect", type: pick(others, r), target: Math.round(Math.min(24, 8 + n * 0.25) * scale) });
    } else if (kind === "score") {
      goals.push({ kind: "score", target: Math.round(((2600 + Math.min(n, 30) * 380 + Math.max(0, n - 30) * 140) * scale) / 100) * 100 });
    } else if (kind === "collect1") {
      goals.push({ kind: "collect", type: n === 2 ? chapter.dog : pick(types, r), target: Math.round(Math.min(40, 14 + n) * scale) });
    } else if (kind === "collect2") {
      const [a, b] = shuffled(types, r);
      const each = Math.round(Math.min(28, 10 + Math.round(n * 0.6)) * scale);
      goals.push({ kind: "collect", type: a, target: each }, { kind: "collect", type: b, target: each });
    } else if (kind === "skills") {
      goals.push({ kind: "skill", target: Math.min(10, 3 + Math.floor(n / 5)) });
    } else {
      goals.push(
        { kind: "collect", type: pick(others, r), target: Math.min(30, 12 + Math.round(n * 0.5)) },
        { kind: "skill", target: Math.min(8, 2 + Math.floor(n / 6)) }
      );
    }
    const scoreGoal = goals.find((g) => g.kind === "score");
    const base = scoreGoal ? scoreGoal.target : moves * 150;
    const stars = scoreGoal
      ? [base, Math.round(base * 1.3), Math.round(base * 1.65)]
      : [Math.round(base * 0.7), Math.round(base * 1.15), Math.round(base * 1.55)];
    return { mode: "adventure", level: n, chapter, types, moves, goals, stars, theme: chapter.id, layout };
  }

  function dailyConfig() {
    const k = todayKey();
    const seed = Number(k.replace(/-/g, ""));
    const r = mulberry32(seed);
    const types = pickTypes(6, "shepherd", r);
    const [a, b] = shuffled(types, r);
    const layout = randomLayout(r, true);
    return {
      mode: "daily",
      seed,
      dateKey: k,
      chapter: { dog: "shepherd" },
      types,
      moves: 26,
      goals: [
        { kind: "collect", type: a, target: 20 },
        { kind: "collect", type: b, target: 20 },
        layout.obstacles ? clearGoal(layout) : { kind: "skill", target: 4 },
      ],
      stars: [3000, 5000, 7200],
      theme: "dusk",
      layout,
    };
  }

  // Sprint lengths; stars scale with time and each length keeps its own record (60 s keeps the old key).
  const DURATIONS = [30, 60, 90, 120];
  const timedBestKey = (time) => (time === 60 ? "timed" : `timed${time}`);
  const timedConfig = (layout = sampleLayout(pick(["full", ...SHAPE_POOL]), save.timedPick.obstacles), time = save.timedPick.time) => ({
    mode: "timed",
    chapter: { dog: "corgi" },
    types: pickTypes(6, "corgi", Math.random),
    time,
    bestKey: timedBestKey(time),
    goals: [],
    stars: [5000, 9000, 14000].map((s) => Math.round((s * time) / 60 / 100) * 100),
    theme: "party",
    layout,
  });
  const zenConfig = () => ({
    mode: "zen",
    chapter: { dog: "shiba" },
    types: pickTypes(6, "shiba", Math.random),
    goals: [],
    stars: [5000, 15000, 30000],
    theme: "cozy",
    layout: randomLayout(Math.random, false),
  });

  // Both players build the exact same board, dog set and clock from one seed.
  function versusConfig(seed, time = 60) {
    const r = mulberry32((seed >>> 0) || 1);
    const dog = pick(ALL_TYPES, r);
    const types = pickTypes(6, dog, r);
    return {
      mode: "timed",
      versus: true,
      seed: seed >>> 0,
      time,
      chapter: { dog },
      types,
      goals: [],
      stars: [5000, 9000, 14000].map((s) => Math.round((s * time) / 60 / 100) * 100),
      bestKey: "versus",
      theme: "party",
      layout: buildLayout("full"),
    };
  }

  /* --------------------------------- DOM --------------------------------- */

  const dom = {
    app: $("#app"),
    board: $("#board"),
    cells: $("#boardCells"),
    tiles: $("#tileLayer"),
    beams: $("#beamLayer"),
    fxCanvas: $("#fxCanvas"),
    floats: $("#floatLayer"),
    banner: $("#banner"),
    bannerKicker: $("#bannerKicker"),
    bannerText: $("#bannerText"),
    gameScreen: $("#screen-game"),
    gameMode: $("#gameMode"),
    gameLevel: $("#gameLevel"),
    counter: $("#counter"),
    counterLabel: $("#counterLabel"),
    counterValue: $("#counterValue"),
    goalItems: $("#goalItems"),
    scoreValue: $("#scoreValue"),
    starFill: $("#starFill"),
    starBar: $("#starBar"),
    powerBtn: $("#powerBtn"),
    powerFill: $("#powerFill"),
    powerValue: $("#powerValue"),
    powerLabel: $("#powerLabel"),
    hintBtn: $("#hintBtn"),
    shuffleBtn: $("#shuffleBtn"),
    shuffleCount: $("#shuffleCount"),
    sheetLayer: $("#sheetLayer"),
    toast: $("#toast"),
    confetti: $("#confetti"),
  };
  const fx = new ParticleField(dom.fxCanvas);

  // Fill every [data-dog] slot with its portrait.
  function paintDogSlots(root = document) {
    $$("[data-dog]", root).forEach((el) => {
      if (el.dataset.painted === el.dataset.dog) return;
      el.innerHTML = dogSVG(el.dataset.dog);
      el.dataset.painted = el.dataset.dog;
    });
  }

  /* ------------------------------ Navigation ----------------------------- */

  let currentScreen = "title";
  function showScreen(name, { back = false } = {}) {
    if (name === currentScreen) return;
    if (currentScreen === "raise" && window.BellaRaise) window.BellaRaise.leave();
    const from = $(`[data-screen="${currentScreen}"]`);
    const to = $(`[data-screen="${name}"]`);
    to.classList.add(back ? "is-behind" : "is-leaving-back");
    to.getBoundingClientRect();
    from.classList.remove("is-active");
    from.classList.add(back ? "is-leaving-back" : "is-behind");
    to.classList.remove("is-behind", "is-leaving-back");
    to.classList.add("is-active");
    setTimeout(() => from.classList.remove("is-behind", "is-leaving-back"), 450);
    currentScreen = name;
    if (name === "title") refreshHome();
    if (name === "map") buildMap();
    if (name === "game") requestAnimationFrame(() => fx.resize());
    if (name === "raise" && window.BellaRaise) window.BellaRaise.enter();
  }

  function goBack() {
    if (openSheetId) {
      if (openSheetId === "result" || openSheetId === "versus-result") return;
      if (openSheetId === "pause") return resume();
      return closeSheet();
    }
    if (currentScreen === "raise" && window.BellaRaise && window.BellaRaise.handleBack()) return;
    if (currentScreen === "map") showScreen("title", { back: true });
    else if (currentScreen === "dex") showScreen("title", { back: true });
    else if (currentScreen === "raise") showScreen("title", { back: true });
    else if (currentScreen === "game") pause();
  }

  /* -------------------------------- Sheets ------------------------------- */

  let openSheetId = null;
  let sheetCloseCb = null;
  function openSheet(id, { onClose } = {}) {
    if (openSheetId) $(`#sheet-${openSheetId}`).classList.remove("is-shown", "is-up");
    openSheetId = id;
    sheetCloseCb = onClose || null;
    const sheet = $(`#sheet-${id}`);
    paintDogSlots(sheet);
    dom.sheetLayer.classList.add("is-open");
    dom.sheetLayer.setAttribute("aria-hidden", "false");
    sheet.classList.add("is-shown");
    sheet.scrollTop = 0;
    requestAnimationFrame(() => requestAnimationFrame(() => sheet.classList.add("is-up")));
    setTimeout(() => {
      const focusable = sheet.querySelector(".btn--primary, button");
      if (focusable) focusable.focus({ preventScroll: true });
    }, 300);
  }
  function closeSheet() {
    if (!openSheetId) return;
    const sheet = $(`#sheet-${openSheetId}`);
    sheet.classList.remove("is-up");
    dom.sheetLayer.classList.remove("is-open");
    dom.sheetLayer.setAttribute("aria-hidden", "true");
    const cb = sheetCloseCb;
    openSheetId = null;
    sheetCloseCb = null;
    setTimeout(() => {
      if (!sheet.classList.contains("is-up")) sheet.classList.remove("is-shown");
    }, 420);
    if (cb) cb();
  }

  function toast(text, ms = 1800) {
    dom.toast.textContent = text;
    dom.toast.classList.add("show");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => dom.toast.classList.remove("show"), ms);
  }

  let confirmAction = null;
  function confirmSheet(title, copy, yesText, action) {
    $("#confirmTitle").textContent = title;
    $("#confirmCopy").textContent = copy;
    $("#confirmYes").textContent = yesText;
    confirmAction = action;
    openSheet("confirm");
  }

  /* ------------------------------ Title/Modes ---------------------------- */

  function refreshHome() {
    const stars = totalStars();
    $("#totalStars").textContent = stars;
    const lvl = Math.min(save.unlocked, LEVEL_COUNT);
    const ch = chapterOf(lvl);
    const hero = $("#hero");
    hero.dataset.chapter = ch.id;
    paintDogSlots(hero);
    $("#heroChapter").textContent = `第 ${CHAPTERS.indexOf(ch) + 1} 章 · ${ch.name}`;
    $("#heroLevel").textContent = `第 ${lvl} 关`;
    const cleared = Object.keys(save.stars).length;
    $("#heroFill").style.width = `${(cleared / LEVEL_COUNT) * 100}%`;
    $("#heroMeta").textContent = `已通关 ${cleared}/${LEVEL_COUNT} · ★ ${stars}/${LEVEL_COUNT * 3}`;
    $("#heroPlayText").textContent = cleared === 0 ? "开始冒险" : cleared >= LEVEL_COUNT ? "再玩一次" : "继续闯关";

    const sprint = save.timedPick.time;
    const sprintBest = save.best[timedBestKey(sprint)];
    $("#hubTimedTag").textContent = `${sprint} 秒`;
    $("#metaTimed").textContent = sprintBest ? `最高 ${fmt(sprintBest)}` : "还没有记录";
    $("#metaZen").textContent = save.best.zen ? `最高 ${fmt(save.best.zen)}` : "还没有记录";
    const vs = save.versus || DEFAULTS.versus;
    const vsGames = vs.wins + vs.losses + vs.draws;
    const metaVersus = $("#metaVersus");
    if (metaVersus) metaVersus.innerHTML = vsGames ? `<b>${vs.wins} 胜 ${vs.losses} 负</b>` : `<b>开房间</b>`;

    const daily = dailyConfig();
    const [, mm, dd] = daily.dateKey.split("-");
    $("#dailyDate").textContent = `${Number(mm)}月${Number(dd)}日`;
    $("#dailyGoals").innerHTML = daily.goals
      .map((g) =>
        g.kind === "collect"
          ? `<span><i>${dogSVG(g.type)}</i>×${g.target}</span>`
          : g.kind === "clear"
            ? `<span><i class="crate">${g.only === "cage" ? CAGE_SVG : crateSVG(1)}</i>×${g.target}</span>`
            : `<span><i class="bolt"><svg><use href="#i-bolt"/></svg></i>×${g.target}</span>`
      )
      .join("");
    const d = save.daily[daily.dateKey];
    const status = $("#metaDaily");
    status.classList.toggle("is-done", Boolean(d && d.stars));
    status.innerHTML = d && d.stars ? `<b>${"★".repeat(d.stars)}</b>已完成` : `<b>出发</b>`;

    const hour = new Date().getHours();
    $("#homeGreeting").textContent =
      hour < 6 ? "夜猫子也要早点睡哦" : hour < 11 ? "早安，狗狗们醒啦" : hour < 14 ? "午饭后来一局？" : hour < 18 ? "下午茶时间～" : "晚上好，散步回来啦";
    if (window.BellaRaise) window.BellaRaise.updateHome();
  }

  function buildHomeArt() {
    $("#dexStack").innerHTML = ["shiba", "shepherd", "bernese"].map((t) => `<span>${dogSVG(t)}</span>`).join("");
    $("#dexCount").textContent = `${ALL_TYPES.length} 位俱乐部成员`;
    const lane = HOME_ORDER.map(
      (t, i) => `<button class="parade__dog" data-dex="${t}" style="--i:${i}" aria-label="${DOGS[t].name}，${DOGS[t].breed}">${dogSVG(t)}<b>${DOGS[t].name}</b></button>`
    ).join("");
    // Second copy keeps the loop seamless; hidden from assistive tech.
    $("#paradeTrack").innerHTML = lane + `<span class="parade__copy" aria-hidden="true">${lane.replace(/<button /g, '<button tabindex="-1" ')}</span>`;
    $("#helpBall").innerHTML = rainbowSVG();
  }

  /* --------------------------------- Map --------------------------------- */

  function buildMap() {
    const map = $("#map");
    const width = map.clientWidth || dom.app.clientWidth;
    const rowGap = 108;
    const xs = (i) => width / 2 + Math.sin(i * 0.95) * Math.min(110, width * 0.28);
    $("#mapStars").textContent = totalStars();
    $("#mapStarsMax").textContent = `/${LEVEL_COUNT * 3}`;
    map.innerHTML = CHAPTERS.map((ch, ci) => {
      const count = ch.to - ch.from + 1;
      const top = ci === 0 ? 230 : 130;
      const height = top - 10 + count * rowGap;
      const r = mulberry32(ci * 4099 + 17);
      const set = SCENERY.SETS[ch.id];
      const pts = [];
      let nodes = "";
      let scenery = "";
      // Pick the roomier side of a node for props.
      const freeSide = (x) => (x > width / 2 ? "left" : "right");
      const place = (x, size, gap = 52) => {
        const side = freeSide(x);
        const lo = side === "left" ? 6 : x + gap;
        const hi = side === "left" ? x - gap - size : width - size - 6;
        return hi > lo ? lo + r() * (hi - lo) : null;
      };
      for (let i = 0; i < count; i += 1) {
        const n = ch.from + i;
        const x = xs(n);
        const y = top + i * rowGap;
        pts.push([x, y]);
        const stars = save.stars[n] || 0;
        const locked = n > save.unlocked;
        const current = n === Math.min(save.unlocked, LEVEL_COUNT);
        const cls = ["node", locked ? "is-locked" : "", stars ? "is-done" : "", current ? "is-current" : "", i === count - 1 ? "is-boss" : ""].join(" ");
        nodes += `<button class="${cls}" style="left:${x}px;top:${y}px" data-level="${n}" ${locked ? 'aria-disabled="true"' : ""} aria-label="第 ${n} 关${locked ? "，未解锁" : `，${stars} 星`}">
          ${locked ? `<svg><use href="#i-lock"/></svg>` : n}
          ${current ? `<span class="node__avatar">${dogSVG(ch.dog)}</span>` : ""}
          ${!locked ? `<span class="node__stars">${[1, 2, 3].map((s) => `<svg class="${s <= stars ? "on" : ""}"><use href="#i-star"/></svg>`).join("")}</span>` : ""}
        </button>`;

        // Scenery: landmark beside row 2, a reward chest beside the last node, props elsewhere.
        if (i === 2) {
          const lx = place(x, 120, 44);
          if (lx !== null) scenery += `<span class="map-landmark" style="left:${lx}px;top:${y - 70}px">${SCENERY.landmark(ch.id)}</span>`;
          continue;
        }
        if (i === count - 1) {
          const cleared = Array.from({ length: count }, (_, k) => save.stars[ch.from + k] || 0).every(Boolean);
          const cx = place(x, 64, 50);
          if (cx !== null) {
            scenery += `<span class="map-chest ${cleared ? "is-open" : ""}" style="left:${cx}px;top:${y - 36}px">${SCENERY.prop(cleared ? "chestOpen" : "chest")}<b>${cleared ? "已领取" : "通关宝箱"}</b></span>`;
          }
          continue;
        }
        // Little accents on both sides, clear of the path.
        for (let k = 0; k < 3; k += 1) {
          const ax = 8 + r() * (width - 30);
          if (Math.abs(ax - x) < 56) continue;
          const as = 12 + Math.round(r() * 10);
          scenery += `<span class="map-accent" style="left:${ax}px;top:${y + (r() - 0.5) * rowGap}px;width:${as}px;height:${as}px">${SCENERY.accent(set.accent)}</span>`;
        }
        if (i === 1 || i === 3) continue;
        const size = 46 + Math.round(r() * 22);
        const px = place(x, size);
        if (px === null) continue;
        const name = set.props[Math.floor(r() * set.props.length)];
        const tilt = Math.round((r() - 0.5) * 18);
        scenery += `<span class="map-prop" style="left:${px}px;top:${y - size / 2 + (r() - 0.5) * 40}px;width:${size}px;height:${size}px;--tilt:${tilt}deg;--d:${(r() * 3).toFixed(2)}s">${SCENERY.prop(name)}</span>`;
        if (r() < 0.6) {
          const s2 = 28 + Math.round(r() * 10);
          const p2 = place(x, s2);
          if (p2 !== null) scenery += `<span class="map-prop map-prop--sm" style="left:${p2}px;top:${y + 26}px;width:${s2}px;height:${s2}px;--tilt:${-tilt}deg;--d:${(r() * 3).toFixed(2)}s">${SCENERY.prop(set.props[Math.floor(r() * set.props.length)])}</span>`;
        }
      }
      let patches = "";
      for (let k = 0; k < 6; k += 1) {
        const pw = 120 + r() * 120;
        const ph = 50 + r() * 60;
        const left = k % 2 ? width - pw * (0.45 + r() * 0.3) : -pw * (0.25 + r() * 0.3);
        patches += `<i class="map-patch" style="left:${left.toFixed(0)}px;top:${((k + r()) / 6 * height).toFixed(0)}px;width:${pw.toFixed(0)}px;height:${ph.toFixed(0)}px;background:${set.patch};opacity:${(0.3 + r() * 0.25).toFixed(2)}"></i>`;
      }
      const [ambName, ambCount] = set.amb;
      let amb = "";
      for (let k = 0; k < ambCount; k += 1) {
        amb += `<i class="amb amb--${ambName}" style="left:${(r() * 92).toFixed(1)}%;top:${(4 + r() * 88).toFixed(1)}%;--d:${(r() * -12).toFixed(2)}s;--t:${(6 + r() * 8).toFixed(1)}s;--s:${(0.7 + r() * 0.6).toFixed(2)};color:${set.tint}">${SCENERY.ambient(ambName)}</i>`;
      }
      const d = pts.map(([x, y], i) => (i ? `L${x} ${y}` : `M${x} ${y}`)).join(" ");
      const got = Array.from({ length: count }, (_, i) => save.stars[ch.from + i] || 0).reduce((a, b) => a + b, 0);
      return `<section class="chapter chapter--${ch.id}" style="height:${height}px">
        <div class="chapter__amb" aria-hidden="true">${patches}${amb}</div>
        <div class="chapter__scenery" aria-hidden="true">${scenery}</div>
        <div class="chapter__banner"><span>${dogSVG(ch.dog)}</span>第 ${ci + 1} 章 · ${ch.name} <small>★ ${got}/${count * 3}</small></div>
        <svg class="map__path" width="${width}" height="${height}"><path class="map__path-bed" d="${d}"/><path d="${d}"/></svg>
        ${nodes}
      </section>`;
    }).join("");
    const cur = $(".node.is-current", map);
    if (cur) {
      const scroll = $("#mapScroll");
      requestAnimationFrame(() => {
        scroll.scrollTop = cur.offsetTop + cur.closest(".chapter").offsetTop - scroll.clientHeight / 2;
      });
    }
  }

  /* ---------------------------- Sprint picker ---------------------------- */

  // One sample per shape for the chosen obstacle family; what the card shows is what you play.
  let timedSamples = {};
  function rollTimedSamples() {
    timedSamples = {};
    ["full", ...SHAPE_POOL].forEach((id) => {
      timedSamples[id] = sampleLayout(id, save.timedPick.obstacles);
    });
  }
  const obstacleText = (layout) =>
    ["c", "C", "L"]
      .filter((k) => layout.count[k])
      .map((k) => `${OBSTACLE_NAMES[k]} ×${layout.count[k]}`)
      .join(" · ") || "没有障碍";
  const randomBoard = () => `${layoutPreview(buildLayout("full"))}<b class="board-random" aria-hidden="true">?</b>`;

  function renderTimedPicker() {
    const { shape, obstacles, time } = save.timedPick;
    const best = save.best[timedBestKey(time)];
    $("#timedKicker").textContent = `${time} 秒挑战${best ? ` · 最高 ${fmt(best)}` : ""}`;
    $("#timedStartLabel").textContent = `开始 ${time} 秒`;
    $("#timedDurations").innerHTML = DURATIONS.map(
      (v) => `<button role="radio" aria-checked="${v === time}" data-action="timed-time" data-value="${v}">${v} 秒</button>`
    ).join("");
    if (!timedSamples.full) rollTimedSamples();
    const preview = $("#timedPreview");
    if (shape === "random") {
      preview.innerHTML = randomBoard();
      preview.classList.add("is-random");
      preview.setAttribute("aria-label", "随机棋盘");
      $("#timedPreviewName").textContent = "随机形状";
      $("#timedPreviewMeta").textContent = `每局从 ${SHAPE_POOL.length + 1} 种形状里抽一种` + (obstacles === "none" ? "，没有障碍" : "");
    } else {
      const layout = timedSamples[shape];
      preview.innerHTML = layoutPreview(layout);
      preview.classList.remove("is-random");
      preview.setAttribute("aria-label", `棋盘形状：${layout.name}`);
      $("#timedPreviewName").textContent = `${layout.name}棋盘`;
      $("#timedPreviewMeta").textContent = `${layout.count.cells} 格 · ${obstacleText(layout)}`;
    }
    $("#timedReroll").hidden = shape === "random" || obstacles === "none";
    $("#timedObstacles").innerHTML = OBSTACLE_CHOICES.map(
      ([v, label]) => `<button role="radio" aria-checked="${v === obstacles}" data-action="timed-obstacle" data-value="${v}">${label}</button>`
    ).join("");
    $("#timedShapes").innerHTML =
      `<button class="timed-shape" role="radio" aria-checked="${shape === "random"}" data-action="timed-shape" data-value="random">` +
      `<span class="intro-board is-random">${randomBoard()}</span><span>随机</span></button>` +
      ["full", ...SHAPE_POOL]
        .map((id) => {
          const layout = timedSamples[id];
          return (
            `<button class="timed-shape" role="radio" aria-checked="${shape === id}" data-action="timed-shape" data-value="${id}" aria-label="${layout.name}，${obstacleText(layout)}">` +
            `<span class="intro-board">${layoutPreview(layout)}</span><span>${layout.name}</span></button>`
          );
        })
        .join("");
  }

  function openTimedPicker() {
    rollTimedSamples();
    renderTimedPicker();
    openSheet("timed");
  }

  /* -------------------------------- Intro -------------------------------- */

  function goalIcon(g) {
    if (g.kind === "collect") return `<span class="goal-item__icon">${dogSVG(g.type)}</span>`;
    if (g.kind === "clear") return `<span class="goal-item__icon goal-item__icon--clear">${g.only === "cage" ? CAGE_SVG : crateSVG(1)}</span>`;
    if (g.kind === "skill") return `<span class="goal-item__icon goal-item__icon--skill"><svg><use href="#i-bolt"/></svg></span>`;
    return `<span class="goal-item__icon goal-item__icon--score"><svg><use href="#i-star"/></svg></span>`;
  }
  function goalLabel(g) {
    if (g.kind === "collect") return DOGS[g.type].breed;
    if (g.kind === "skill") return "技能";
    if (g.kind === "clear") return g.only === "cage" ? "狗笼" : g.only === "crate" ? "木箱" : "障碍";
    return "得分";
  }

  // Latin names (Mochi, Rhea…) get a space before following Chinese text.
  const spaced = (name) => (/[A-Za-z]$/.test(name) ? `${name} ` : name);

  let pendingConfig = null;
  function openIntro(cfg) {
    pendingConfig = cfg;
    const main = cfg.goals[0];
    const portrait = $("#introPortrait");
    const dogType = main && main.kind === "collect" ? main.type : cfg.chapter.dog;
    portrait.dataset.dog = dogType;
    portrait.className = "sheet__portrait mood-joy";
    const dog = DOGS[dogType];
    let title;
    let copy;
    if (cfg.mode === "daily") {
      title = "今日巡逻任务";
      copy = `Surprise 今天的巡逻清单。每天一张固定棋盘，${cfg.dateKey} 限定。`;
    } else if (main.kind === "score") {
      title = `攒到 ${fmt(main.target)} 分`;
      copy = `${spaced(dog.name)}在${dog.scene}开了个小摊，帮它热闹起来吧！`;
    } else if (main.kind === "collect" && cfg.goals.length === 1) {
      title = `接 ${main.target} 只${dog.breed}`;
      copy = `${spaced(dog.name)}在${dog.scene}等朋友们放学，${dog.trait}。`;
    } else if (main.kind === "clear") {
      const L = cfg.layout.count;
      title = main.only === "cage" ? `放出 ${main.target} 只笼中狗` : main.only === "crate" ? `敲碎 ${main.target} 个木箱` : `拆掉 ${main.target} 个障碍`;
      copy = L.L && !(L.c + L.C)
        ? "笼子里的狗狗不能挪动，让它参与一次消除就能打开笼子。"
        : L.L
          ? "木箱在旁边消除就会碎，狗笼要让里面的狗狗参与消除才能打开。"
          : "在木箱旁边消除就能把它敲碎，技能骨头炸到也算。双层木箱要敲两下。";
    } else if (main.kind === "skill") {
      title = `炸出 ${main.target} 次技能`;
      copy = "4 连、L 形、5 连都能做出技能骨头，点两下或互换就能引爆。";
    } else {
      title = "双份订单";
      copy = `${spaced(dog.name)}和朋友们一起出门，把清单上的都完成吧！`;
    }
    $("#introKicker").textContent = cfg.mode === "daily" ? "DAILY PATROL" : `LEVEL ${cfg.level}`;
    $("#introTitle").textContent = title;
    $("#introCopy").textContent = copy;
    $("#introGoals").innerHTML = cfg.goals
      .map((g) => `<div class="goal-item">${goalIcon(g)}<b>${g.kind === "score" ? fmt(g.target) : `×${g.target}`}</b><small>${goalLabel(g)}</small></div>`)
      .join("");
    const layout = cfg.layout || buildLayout("full");
    $("#introBoard").innerHTML = layoutPreview(layout);
    $("#introBoard").setAttribute("aria-label", `棋盘形状：${layout.name}`);
    const obstacleChips = ["c", "C", "L"]
      .filter((k) => layout.count[k])
      .map((k) => `<span>${OBSTACLE_NAMES[k]} ×${layout.count[k]}</span>`)
      .join("");
    $("#introMeta").innerHTML =
      `<span><svg><use href="#i-paw"/></svg>${cfg.moves} 步</span>` +
      `<span>${cfg.types.length} 种狗狗</span>` +
      `<span>${layout.name}棋盘</span>` +
      obstacleChips +
      (save.stars[cfg.level] && cfg.mode === "adventure" ? `<span>已得 ${"★".repeat(save.stars[cfg.level])}</span>` : "");
    openSheet("intro");
  }

  /* -------------------------------- Game --------------------------------- */

  const G = {
    cfg: null,
    board: [],
    mask: [],
    layout: null,
    cleared: 0,
    types: [],
    score: 0,
    shownScore: 0,
    moves: 0,
    time: 0,
    progress: [],
    busy: false,
    active: false,
    paused: false,
    ended: false,
    selected: null,
    lastSwap: null,
    power: 0,
    powerFiring: false,
    powerQueued: false,
    shuffles: 2,
    bestCascade: 0,
    skills: 0,
    extraUsed: false,
    timeUp: false,
    seq: 0,
    timers: {},
    drag: null,
  };

  const isCell = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS && Boolean(G.mask[r] && G.mask[r][c]);
  const fixed = (t) => Boolean(t && (t.blocker || t.lock > 0));
  const movable = (t) => Boolean(t && !t.blocker && !(t.lock > 0));

  // Paint the board floor: holes stay see-through, edges next to a hole get rounded.
  function buildCells() {
    const frag = document.createDocumentFragment();
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        const el = document.createElement("i");
        if (!isCell(r, c)) {
          el.className = "is-void";
        } else {
          if ((r + c) % 2) el.className = "alt";
          const open = (dr, dc) => !isCell(r + dr, c + dc);
          const R = "34%";
          el.style.borderRadius = [
            open(-1, 0) && open(0, -1) ? R : 0,
            open(-1, 0) && open(0, 1) ? R : 0,
            open(1, 0) && open(0, 1) ? R : 0,
            open(1, 0) && open(0, -1) ? R : 0,
          ].join(" ");
        }
        frag.appendChild(el);
      }
    }
    dom.cells.replaceChildren(frag);
  }

  const BADGES = {
    line:
      `<svg class="sp-badge" viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" fill="#ffd447" stroke="#3b2618" stroke-width="3"/>` +
      `<path d="M10 20h20M14 15l-5 5 5 5M26 15l5 5-5 5" fill="none" stroke="#3b2618" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    lineV:
      `<svg class="sp-badge" viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" fill="#ffd447" stroke="#3b2618" stroke-width="3"/>` +
      `<path d="M20 10v20M15 14l5-5 5 5M15 26l5 5 5-5" fill="none" stroke="#3b2618" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    bomb:
      `<svg class="sp-badge" viewBox="0 0 40 40"><circle cx="18" cy="23" r="13" fill="#ff7a6b" stroke="#3b2618" stroke-width="3"/>` +
      `<path d="M26 13l4-4" stroke="#3b2618" stroke-width="3.2" stroke-linecap="round"/><circle cx="32" cy="7" r="4" fill="#ffd447"/>` +
      `<ellipse cx="13" cy="18" rx="4" ry="2.5" fill="#fff" opacity=".6" transform="rotate(-30 13 18)"/></svg>`,
  };

  function crateSVG(hp = 1) {
    const straps =
      hp > 1
        ? `<path d="M31 7v86M69 7v86" stroke="#6f7f8e" stroke-width="9"/><path d="M28 7v86M66 7v86" stroke="#b9c7d3" stroke-width="2.4"/>` +
          `<g fill="#3b2618"><circle cx="31" cy="20" r="2.6"/><circle cx="31" cy="80" r="2.6"/><circle cx="69" cy="20" r="2.6"/><circle cx="69" cy="80" r="2.6"/></g>`
        : "";
    return (
      `<svg class="crate-art" viewBox="0 0 100 100" aria-hidden="true">` +
      `<rect x="6" y="6" width="88" height="88" rx="16" fill="#e0a35e" stroke="#3b2618" stroke-width="5"/>` +
      `<path d="M9 37h82M9 64h82" stroke="#b0702f" stroke-width="4"/>` +
      `<path d="M9 35h82M9 62h82" stroke="#f3c88f" stroke-width="2" opacity=".8"/>` +
      `<path d="M20 20L80 80" stroke="#b0702f" stroke-width="7" stroke-linecap="round"/>` +
      straps +
      `<g fill="#7a4720"><ellipse cx="50" cy="57" rx="11" ry="9"/><circle cx="37" cy="44" r="4.6"/><circle cx="45.5" cy="37.5" r="4.6"/>` +
      `<circle cx="54.5" cy="37.5" r="4.6"/><circle cx="63" cy="44" r="4.6"/></g>` +
      `<path class="crate-crack" d="M14 30l12 6-5 9 10 4M86 70l-11-4 3-9-9-3" fill="none" stroke="#3b2618" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` +
      `</svg>`
    );
  }
  const CAGE_SVG =
    `<svg class="cage-art" viewBox="0 0 100 100" aria-hidden="true">` +
    `<rect x="5" y="5" width="90" height="90" rx="22" fill="rgba(70,96,120,.14)" stroke="#4d5d6d" stroke-width="6"/>` +
    `<path d="M28 7v86M50 7v86M72 7v86" stroke="#4d5d6d" stroke-width="5.5" stroke-linecap="round"/>` +
    `<path d="M26.6 10v80M48.6 10v80M70.6 10v80" stroke="#e3ebf2" stroke-width="1.6" stroke-linecap="round"/>` +
    `<path d="M43 64v-7a7 7 0 0 1 14 0v7" fill="none" stroke="#3b2618" stroke-width="3.4"/>` +
    `<rect x="38.5" y="62" width="23" height="18" rx="5" fill="#ffd447" stroke="#3b2618" stroke-width="3.4"/>` +
    `<circle cx="50" cy="70" r="2.4" fill="#3b2618"/>` +
    `</svg>`;

  // Tiny map of a layout for the level intro.
  function layoutPreview(layout) {
    return layout.cells
      .flat()
      .map((ch, i) => {
        const r = Math.floor(i / COLS);
        const c = i % COLS;
        if (ch === "_") return `<i class="is-void"></i>`;
        const kind = ch === "c" ? " is-crate" : ch === "C" ? " is-crate is-crate2" : ch === "L" ? " is-cage" : "";
        return `<i class="${(r + c) % 2 ? "alt" : ""}${kind}"></i>`;
      })
      .join("");
  }

  function tileHTML(type) {
    return `<div class="tile__card">${type === "rainbow" ? rainbowSVG() : dogSVG(type)}</div><div class="tile__fx"></div>`;
  }

  function makeTile(type, r, c) {
    const t = { id: ++G.seq, type, special: type === "rainbow" ? "rainbow" : null, r, c, el: null, detonated: false };
    const el = document.createElement("div");
    el.className = "tile";
    el.innerHTML = tileHTML(type);
    el.style.setProperty("--blink", `${(-Math.random() * 5).toFixed(2)}s`);
    if (t.special) el.dataset.special = t.special;
    el._t = t;
    t.el = el;
    place(t, r, c, 0);
    return t;
  }

  function makeCrate(hp, r, c) {
    const t = { id: ++G.seq, type: "crate", blocker: "crate", hp, special: null, r, c, el: null, detonated: false };
    const el = document.createElement("div");
    el.className = "tile tile--crate";
    el.dataset.hp = hp;
    el.innerHTML = `<div class="tile__crate">${crateSVG(hp)}</div>`;
    el._t = t;
    t.el = el;
    place(t, r, c, 0);
    return t;
  }

  function setLock(t, n) {
    t.lock = n;
    let cage = $(".tile__cage", t.el);
    if (n > 0) {
      t.el.dataset.lock = n;
      if (!cage) {
        cage = document.createElement("div");
        cage.className = "tile__cage";
        cage.innerHTML = CAGE_SVG;
        t.el.appendChild(cage);
      }
    } else {
      delete t.el.dataset.lock;
      if (cage) {
        cage.classList.add("is-opening");
        setTimeout(() => cage.remove(), 520);
      }
    }
  }

  function place(t, r, c, dur = null) {
    t.r = r;
    t.c = c;
    if (dur !== null) t.el.style.setProperty("--dur", `${dur}ms`);
    t.el.style.setProperty("--r", r);
    t.el.style.setProperty("--c", c);
  }

  function setSpecial(t, kind) {
    t.special = kind;
    t.detonated = false;
    if (kind === "rainbow" && t.type !== "rainbow") {
      t.type = "rainbow";
      t.el.innerHTML = tileHTML("rainbow");
    }
    const fxEl = $(".tile__fx", t.el);
    if (!kind) {
      delete t.el.dataset.special;
      if (fxEl) fxEl.innerHTML = "";
    } else {
      t.el.dataset.special = kind;
      if (fxEl) {
        fxEl.innerHTML =
          kind === "lineH" ? `<span class="sp-streak"></span>${BADGES.line}` :
          kind === "lineV" ? `<span class="sp-streak"></span>${BADGES.lineV}` :
          kind === "bomb" ? BADGES.bomb : "";
      }
      t.el.classList.remove("is-created");
      void t.el.offsetWidth;
      t.el.classList.add("is-created");
      setTimeout(() => t.el && t.el.classList.remove("is-created"), 600);
    }
  }

  const typeAt = (grid, r, c) => (r >= 0 && r < ROWS && c >= 0 && c < COLS ? grid[r][c] : null);
  const typeGrid = () => G.board.map((row) => row.map((t) => (t && !t.blocker && t.type !== "rainbow" ? t.type : null)));

  function findRuns(grid = typeGrid()) {
    const runs = [];
    for (let r = 0; r < ROWS; r += 1) {
      let c = 0;
      while (c < COLS) {
        const t = grid[r][c];
        let e = c + 1;
        while (t && e < COLS && grid[r][e] === t) e += 1;
        if (t && e - c >= 3) runs.push({ dir: "h", type: t, cells: Array.from({ length: e - c }, (_, i) => [r, c + i]) });
        c = e;
      }
    }
    for (let c = 0; c < COLS; c += 1) {
      let r = 0;
      while (r < ROWS) {
        const t = grid[r][c];
        let e = r + 1;
        while (t && e < ROWS && grid[e][c] === t) e += 1;
        if (t && e - r >= 3) runs.push({ dir: "v", type: t, cells: Array.from({ length: e - r }, (_, i) => [r + i, c]) });
        r = e;
      }
    }
    return runs;
  }

  function hasRunAt(grid, r, c) {
    const t = grid[r][c];
    if (!t) return false;
    let h = 1;
    for (let x = c - 1; typeAt(grid, r, x) === t; x -= 1) h += 1;
    for (let x = c + 1; typeAt(grid, r, x) === t; x += 1) h += 1;
    if (h >= 3) return true;
    let v = 1;
    for (let y = r - 1; typeAt(grid, y, c) === t; y -= 1) v += 1;
    for (let y = r + 1; typeAt(grid, y, c) === t; y += 1) v += 1;
    return v >= 3;
  }

  function findMove() {
    const grid = typeGrid();
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        for (const [dr, dc] of [[0, 1], [1, 0]]) {
          const r2 = r + dr;
          const c2 = c + dc;
          if (r2 >= ROWS || c2 >= COLS) continue;
          if (!movable(G.board[r][c]) || !movable(G.board[r2][c2])) continue;
          const a = grid[r][c];
          const b = grid[r2][c2];
          if (a === b) continue;
          grid[r][c] = b;
          grid[r2][c2] = a;
          const ok = hasRunAt(grid, r, c) || hasRunAt(grid, r2, c2);
          grid[r][c] = a;
          grid[r2][c2] = b;
          if (ok) return [G.board[r][c], G.board[r2][c2]];
        }
      }
    }
    return null;
  }
  const anySpecial = () => G.board.flat().find((t) => t && t.special);

  // Dog types for every playable, non-crate cell: no ready-made runs, at least one move.
  function generateGrid() {
    const cells = G.layout.cells;
    const dogCell = (r, c) => cells[r][c] === "." || cells[r][c] === "L";
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
      for (let r = 0; r < ROWS; r += 1) {
        for (let c = 0; c < COLS; c += 1) {
          if (!dogCell(r, c)) continue;
          const banned = new Set();
          if (c >= 2 && grid[r][c - 1] && grid[r][c - 1] === grid[r][c - 2]) banned.add(grid[r][c - 1]);
          if (r >= 2 && grid[r - 1][c] && grid[r - 1][c] === grid[r - 2][c]) banned.add(grid[r - 1][c]);
          grid[r][c] = pick(G.types.filter((t) => !banned.has(t)));
        }
      }
      const saved = G.board;
      G.board = grid.map((row, r) =>
        row.map((type, c) => (cells[r][c] === "_" ? null : type ? { type, lock: cells[r][c] === "L" ? 1 : 0 } : { type: "crate", blocker: "crate" }))
      );
      const ok = findMove();
      G.board = saved;
      if (ok) return grid;
    }
    return Array.from({ length: ROWS }, (_, r) =>
      Array.from({ length: COLS }, (_, c) => (dogCell(r, c) ? G.types[(r * 2 + c) % G.types.length] : null))
    );
  }

  function buildBoard() {
    const grid = generateGrid();
    const cells = G.layout.cells;
    G.board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    const frag = document.createDocumentFragment();
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        const ch = cells[r][c];
        if (ch === "_") continue;
        const t = ch === "c" || ch === "C" ? makeCrate(ch === "C" ? 2 : 1, r, c) : makeTile(grid[r][c], r, c);
        if (ch === "L") setLock(t, 1);
        t.el.classList.add("is-spawn");
        t.el.style.setProperty("--spawn-delay", `${(r + c) * 22}ms`);
        G.board[r][c] = t;
        frag.appendChild(t.el);
      }
    }
    dom.tiles.replaceChildren(frag);
    dom.beams.replaceChildren();
    dom.floats.replaceChildren();
    fx.clear();
    setTimeout(() => $$(".tile.is-spawn", dom.tiles).forEach((el) => el.classList.remove("is-spawn")), 900);
  }

  /* ----------------------------- Game start ------------------------------ */

  function startGame(cfg) {
    stopTimers();
    G.cfg = cfg;
    G.types = cfg.types;
    G.layout = cfg.layout || buildLayout("full");
    G.mask = G.layout.cells.map((row) => row.map((ch) => ch !== "_"));
    G.cleared = 0;
    rng = cfg.seed ? mulberry32(cfg.seed) : Math.random;
    G.score = 0;
    G.shownScore = 0;
    G.moves = cfg.moves || 0;
    G.time = cfg.time || 0;
    G.progress = cfg.goals.map(() => 0);
    G.busy = false;
    G.active = true;
    G.paused = false;
    G.ended = false;
    G.selected = null;
    G.lastSwap = null;
    G.power = cfg.mode === "zen" ? 40 : 20;
    G.powerQueued = false;
    G.powerFiring = false;
    G.shuffles = cfg.mode === "zen" ? 99 : 2;
    G.bestCascade = 0;
    G.skills = 0;
    G.extraUsed = false;
    G.timeUp = false;
    G.starScore = 0;

    dom.gameScreen.dataset.theme = cfg.theme || "beach";
    dom.gameScreen.classList.toggle("is-versus", Boolean(cfg.versus));
    const labels = { timed: [`${cfg.time} 秒挑战`, "限时冲刺"], zen: ["不限步数", "悠闲无尽"], daily: [`${cfg.dateKey ? Number(cfg.dateKey.slice(5, 7)) + "月" + Number(cfg.dateKey.slice(8)) + "日" : ""}`, "今日巡逻"] };
    const [kicker, heading] = cfg.versus
      ? ["双人竞赛", "同题竞速"]
      : cfg.mode === "adventure"
        ? [cfg.chapter.name, `第 ${cfg.level} 关`]
        : labels[cfg.mode];
    dom.gameMode.textContent = kicker;
    dom.gameLevel.textContent = heading;
    $(".power__face", dom.powerBtn).dataset.dog = cfg.chapter.dog;
    paintDogSlots(dom.powerBtn);

    coach(openingLine(cfg), { dog: cfg.chapter.dog });
    renderGoals();
    updateCounter();
    updateScore(true);
    updatePower();
    updateShuffle();
    buildCells();
    buildBoard();
    showScreen("game");
    sound.levelStart();
    if (cfg.mode === "timed") startClock();
    startMoods();
    armHint();
    setTimeout(() => {
      if (cfg.mode === "timed" && !cfg.versus) showBanner("READY?", `${cfg.time} 秒开冲！`);
      else if (cfg.mode === "zen") showBanner("RELAX", "慢慢来～");
      else if (cfg.versus) showBanner("GO!", "同一张棋盘，冲！");
    }, 500);
  }

  function renderGoals() {
    const cfg = G.cfg;
    let html = cfg.goals
      .map((g, i) => `<div class="goal-item" data-goal="${i}">${goalIcon(g)}<b>${g.kind === "score" ? fmt(g.target) : g.target}</b></div>`)
      .join("");
    if (!cfg.goals.length) {
      html = `<div class="goal-item">${dogSVG(cfg.chapter.dog).replace('class="dog', 'class="goal-item__icon dog')}<b>${cfg.mode === "zen" ? "∞" : `${cfg.time}s`}</b></div>`;
    }
    dom.goalItems.innerHTML = html;
    const [s1, s2, s3] = cfg.stars;
    $$("i[data-star]", dom.starBar).forEach((el, i) => {
      el.style.left = `${([s1, s2, s3][i] / s3) * 100}%`;
      el.classList.remove("on");
    });
  }

  function updateGoals() {
    G.cfg.goals.forEach((g, i) => {
      const el = $(`[data-goal="${i}"]`, dom.goalItems);
      if (!el) return;
      const value = g.kind === "score" ? G.score : G.progress[i];
      const left = Math.max(0, g.target - value);
      const b = $("b", el);
      const text = g.kind === "score" ? fmt(left) : String(left);
      if (b.textContent !== text) {
        b.textContent = text;
        el.classList.remove("pop");
        void el.offsetWidth;
        el.classList.add("pop");
      }
      if (left === 0 && !el.classList.contains("is-done") && G.active) {
        coach(g.kind === "collect" ? `${DOGS[g.type].breed}订单完成！` : g.kind === "skill" ? "技能目标达成！" : g.kind === "clear" ? (g.only === "cage" ? "狗狗全都放出来啦！" : "障碍全部清光！") : "分数达标啦！");
      }
      el.classList.toggle("is-done", left === 0);
    });
  }

  const goalsDone = () => G.cfg.goals.length > 0 && G.cfg.goals.every((g, i) => (g.kind === "score" ? G.score : G.progress[i]) >= g.target);

  function updateCounter() {
    const cfg = G.cfg;
    dom.counter.classList.remove("is-low", "is-infinite");
    if (cfg.mode === "timed") {
      dom.counterLabel.textContent = "时间";
      dom.counterValue.textContent = Math.ceil(G.time);
      dom.counter.classList.toggle("is-low", G.time <= 10);
    } else if (cfg.mode === "zen") {
      dom.counterLabel.textContent = "步数";
      dom.counterValue.textContent = "∞";
      dom.counter.classList.add("is-infinite");
    } else {
      dom.counterLabel.textContent = "步数";
      dom.counterValue.textContent = G.moves;
      dom.counter.classList.toggle("is-low", G.moves <= 5 && !G.ended);
    }
  }

  function bumpCounter() {
    dom.counter.classList.remove("bump");
    void dom.counter.offsetWidth;
    dom.counter.classList.add("bump");
  }

  function updateScore(instant = false) {
    const [s1, s2, s3] = G.cfg.stars;
    dom.starFill.style.width = `${clamp((G.score / s3) * 100, 0, 100)}%`;
    $$("i[data-star]", dom.starBar).forEach((el, i) => {
      const on = G.score >= [s1, s2, s3][i];
      if (on && !el.classList.contains("on")) sound.tone && sound.tone(1320 + i * 220, { duration: 0.12, type: "triangle", volume: 0.03 });
      el.classList.toggle("on", on);
    });
    updateGoals();
    if (instant) {
      G.shownScore = G.score;
      dom.scoreValue.textContent = fmt(G.score);
      return;
    }
    cancelAnimationFrame(updateScore.raf);
    const from = G.shownScore;
    const to = G.score;
    const start = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - start) / 450);
      G.shownScore = from + (to - from) * (1 - (1 - p) ** 3);
      dom.scoreValue.textContent = fmt(G.shownScore);
      if (p < 1) updateScore.raf = requestAnimationFrame(step);
    };
    updateScore.raf = requestAnimationFrame(step);
  }

  function updatePower() {
    const pct = Math.round(G.power);
    dom.powerFill.style.width = `${pct}%`;
    dom.powerValue.textContent = pct >= 100 ? (G.powerQueued ? "马上开大…" : "点我开大！") : `${pct}%`;
    const ready = pct >= 100 && !G.ended;
    dom.powerBtn.disabled = !ready;
    if (ready && !dom.powerBtn.classList.contains("is-ready")) {
      if (G.active) coach("大招充满啦！点下面的按钮！");
      sound.ovenReady();
      haptic(20);
    }
    dom.powerBtn.classList.toggle("is-ready", ready);
  }

  function chargePower(n) {
    if (G.powerFiring || G.ended) return;
    G.power = clamp(G.power + n, 0, 100);
    updatePower();
  }

  function updateShuffle() {
    dom.shuffleCount.textContent = G.cfg.mode === "zen" ? "∞" : G.shuffles;
    dom.shuffleBtn.disabled = G.shuffles <= 0;
  }

  /* ------------------------------ Timers ------------------------------- */

  function stopTimers() {
    clearInterval(G.timers.clock);
    clearInterval(G.timers.mood);
    clearTimeout(G.timers.hint);
    G.timers = {};
  }

  function startClock() {
    let last = performance.now();
    G.timers.clock = setInterval(() => {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      if (!G.active || G.paused || G.ended || openSheetId) return;
      const before = Math.ceil(G.time);
      G.time = Math.max(0, G.time - dt);
      if (Math.ceil(G.time) !== before) {
        updateCounter();
        if (Math.ceil(G.time) === 10) coach("最后 10 秒！");
        if (G.time <= 5 && G.time > 0) sound.tone(880, { duration: 0.08, type: "square", volume: 0.02 });
      }
      if (G.time <= 0 && !G.timeUp) {
        G.timeUp = true;
        if (!G.busy) endGame();
      }
    }, 100);
  }

  function startMoods() {
    G.timers.mood = setInterval(() => {
      if (!G.active || G.busy || G.paused || document.hidden) return;
      const t = G.board[Math.floor(Math.random() * ROWS)][Math.floor(Math.random() * COLS)];
      if (!movable(t) || t === G.selected || t.el.classList.contains("is-hint")) return;
      t.el.classList.add("is-mood");
      setTimeout(() => t.el && t.el.classList.remove("is-mood"), 900);
    }, 1600);
  }

  function armHint(delay = 6000) {
    clearTimeout(G.timers.hint);
    G.timers.hint = setTimeout(() => showHint(false), delay);
  }
  function clearHint() {
    $$(".tile.is-hint", dom.tiles).forEach((el) => el.classList.remove("is-hint"));
  }
  function showHint(manual) {
    if (!G.active || G.busy || G.ended || G.paused) return;
    clearHint();
    const move = findMove();
    if (move) {
      move.forEach((t) => t.el.classList.add("is-hint"));
      if (manual) sound.select();
    } else {
      const sp = anySpecial();
      if (sp) {
        sp.el.classList.add("is-hint");
        if (manual) toast("点两下技能骨头就能引爆！");
      }
    }
  }

  /* ------------------------------ Selection ------------------------------ */

  function select(t) {
    deselect();
    G.selected = t;
    t.el.classList.add("is-selected");
    sound.select();
    haptic(6);
    if (t.special === "rainbow") toast("把彩虹球和任意狗狗交换");
    else if (t.special) toast("再点一下引爆，或者滑动交换");
  }
  function deselect() {
    if (G.selected && G.selected.el) G.selected.el.classList.remove("is-selected");
    G.selected = null;
  }
  const adjacent = (a, b) => Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;

  function nudgeFixed(t) {
    sound.invalid();
    haptic([10, 40, 10]);
    t.el.classList.remove("is-invalid");
    void t.el.offsetWidth;
    t.el.classList.add("is-invalid");
    setTimeout(() => t.el && t.el.classList.remove("is-invalid"), 400);
    toast(t.blocker ? (t.hp > 1 ? "双层木箱：在旁边消除两次才会碎" : "木箱挪不动，在旁边消除就能敲碎") : "笼子里的狗狗挪不动，让它参与消除就能放出来");
  }

  function onTap(t) {
    if (G.busy || !G.active || G.ended || G.paused) return;
    sound.init();
    if (!movable(t)) {
      deselect();
      return nudgeFixed(t);
    }
    if (!G.selected) return select(t);
    if (G.selected === t) {
      if (t.special && t.special !== "rainbow") return detonateInPlace(t);
      return deselect();
    }
    if (adjacent(G.selected, t)) return trySwap(G.selected, t);
    select(t);
  }

  /* -------------------------------- Swap --------------------------------- */

  function swapTiles(a, b, dur = T.swap) {
    const { r: ar, c: ac } = a;
    const { r: br, c: bc } = b;
    G.board[ar][ac] = b;
    G.board[br][bc] = a;
    place(a, br, bc, dur);
    place(b, ar, ac, dur);
  }

  function useMove() {
    if (G.cfg.mode === "adventure" || G.cfg.mode === "daily") {
      G.moves = Math.max(0, G.moves - 1);
      updateCounter();
      bumpCounter();
      if (G.moves === 5) coach("只剩 5 步啦，冲鸭！");
    }
  }

  async function trySwap(a, b) {
    if (G.busy || !movable(a) || !movable(b)) return;
    G.busy = true;
    clearHint();
    deselect();
    sound.swap();
    haptic(8);
    swapTiles(a, b);
    await wait(T.swap + 20);

    const spA = a.special;
    const spB = b.special;
    if (spA === "rainbow" || spB === "rainbow" || (spA && spB)) {
      useMove();
      const forced = comboSet(a, b);
      await resolve(forced.set, forced.dets);
      return finishTurn();
    }

    const runs = findRuns();
    if (!runs.length && !spA && !spB) {
      sound.invalid();
      haptic([10, 40, 10]);
      if (Math.random() < 0.5) coach("换完要连成 3 个才行哦～");
      a.el.classList.add("is-invalid");
      b.el.classList.add("is-invalid");
      swapTiles(a, b, T.swap + 40);
      await wait(T.swap + 60);
      a.el.classList.remove("is-invalid");
      b.el.classList.remove("is-invalid");
      G.busy = false;
      armHint();
      return;
    }

    useMove();
    G.lastSwap = [a, b];
    if (!runs.length) {
      const set = new Map();
      [a, b].filter((t) => t.special).forEach((t) => set.set(key(t.r, t.c), t));
      await resolve(set, []);
    } else {
      await resolve(null, []);
    }
    finishTurn();
  }

  async function detonateInPlace(t) {
    G.busy = true;
    deselect();
    clearHint();
    useMove();
    await resolve(new Map([[key(t.r, t.c), t]]), []);
    finishTurn();
  }

  // Special-on-special and rainbow swaps.
  function comboSet(a, b) {
    const set = new Map();
    const dets = [];
    const add = (r, c) => {
      const t = typeAt(G.board, r, c);
      if (t) set.set(key(r, c), t);
    };
    const rainbow = a.special === "rainbow" ? a : b.special === "rainbow" ? b : null;
    const other = rainbow === a ? b : a;
    const at = b; // where the action lands

    if (rainbow && other.special === "rainbow") {
      G.board.flat().forEach((t) => t && set.set(key(t.r, t.c), t));
      a.detonated = b.detonated = true;
      dets.push({ kind: "mega", r: at.r, c: at.c });
      return { set, dets };
    }
    if (rainbow) {
      rainbow.detonated = true;
      set.set(key(rainbow.r, rainbow.c), rainbow);
      const targetType = other.type;
      const asSpecial = other.special;
      G.board.flat().forEach((t) => {
        if (t && t.type === targetType) {
          if (asSpecial && !t.special && !t.lock) setSpecial(t, asSpecial === "bomb" ? "bomb" : Math.random() < 0.5 ? "lineH" : "lineV");
          set.set(key(t.r, t.c), t);
        }
      });
      dets.push({ kind: "rainbow", r: rainbow.r, c: rainbow.c, type: targetType });
      return { set, dets };
    }
    // two line/bomb specials
    a.detonated = b.detonated = true;
    set.set(key(a.r, a.c), a);
    set.set(key(b.r, b.c), b);
    const kinds = [a.special, b.special].map((k) => (k === "bomb" ? "bomb" : "line"));
    if (kinds[0] === "bomb" && kinds[1] === "bomb") {
      for (let r = at.r - 3; r <= at.r + 3; r += 1) for (let c = at.c - 3; c <= at.c + 3; c += 1) add(r, c);
      dets.push({ kind: "bomb", r: at.r, c: at.c, big: true });
    } else if (kinds[0] === "line" && kinds[1] === "line") {
      for (let i = 0; i < 8; i += 1) {
        add(at.r, i);
        add(i, at.c);
      }
      dets.push({ kind: "lineH", r: at.r, c: at.c }, { kind: "lineV", r: at.r, c: at.c });
    } else {
      for (let d = -1; d <= 1; d += 1) {
        for (let i = 0; i < 8; i += 1) {
          add(at.r + d, i);
          add(i, at.c + d);
        }
        dets.push({ kind: "lineH", r: at.r + d, c: at.c }, { kind: "lineV", r: at.r, c: at.c + d });
      }
    }
    return { set, dets };
  }

  /* ------------------------------- Resolve -------------------------------- */

  function components(runs) {
    const parent = runs.map((_, i) => i);
    const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    const owner = new Map();
    runs.forEach((run, i) => {
      run.cells.forEach(([r, c]) => {
        const k = key(r, c);
        if (owner.has(k)) parent[find(i)] = find(owner.get(k));
        else owner.set(k, i);
      });
    });
    const groups = new Map();
    runs.forEach((run, i) => {
      const root = find(i);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root).push(run);
    });
    return [...groups.values()];
  }

  function planCreation(group, taken) {
    const cells = new Map();
    group.forEach((run) => run.cells.forEach(([r, c]) => cells.set(key(r, c), [r, c])));
    const maxRun = group.reduce((m, run) => (run.cells.length > m.cells.length ? run : m), group[0]);
    const hasH = group.some((run) => run.dir === "h");
    const hasV = group.some((run) => run.dir === "v");
    let kind = null;
    if (maxRun.cells.length >= 5) kind = "rainbow";
    else if (hasH && hasV) kind = "bomb";
    else if (maxRun.cells.length === 4) kind = maxRun.dir === "h" ? "lineH" : "lineV";
    if (!kind) return { cells, anchor: null, kind: null };

    const free = (k) => {
      const [r, c] = cells.get(k);
      const t = G.board[r][c];
      return t && !t.special && !t.lock && !taken.has(k);
    };
    let anchorKey = null;
    if (G.lastSwap) {
      for (const t of G.lastSwap) {
        const k = key(t.r, t.c);
        if (cells.has(k) && free(k)) anchorKey = k;
      }
    }
    if (anchorKey === null && kind === "bomb") {
      const counts = new Map();
      group.forEach((run) => run.cells.forEach(([r, c]) => counts.set(key(r, c), (counts.get(key(r, c)) || 0) + 1)));
      for (const [k, n] of counts) if (n > 1 && free(k)) anchorKey = k;
    }
    if (anchorKey === null) {
      const mid = maxRun.cells[Math.floor(maxRun.cells.length / 2)];
      const k = key(mid[0], mid[1]);
      if (free(k)) anchorKey = k;
      else anchorKey = [...cells.keys()].find(free) ?? null;
    }
    return { cells, anchor: anchorKey, kind: anchorKey === null ? null : kind };
  }

  function specialArea(t) {
    const out = [];
    if (t.special === "lineH") for (let c = 0; c < COLS; c += 1) out.push([t.r, c]);
    else if (t.special === "lineV") for (let r = 0; r < ROWS; r += 1) out.push([r, t.c]);
    else if (t.special === "bomb") {
      for (let r = t.r - 2; r <= t.r + 2; r += 1) for (let c = t.c - 2; c <= t.c + 2; c += 1) out.push([r, c]);
    } else if (t.special === "rainbow") {
      const counts = {};
      G.board.flat().forEach((x) => x && !x.blocker && x.type !== "rainbow" && (counts[x.type] = (counts[x.type] || 0) + 1));
      const top = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
      G.board.flat().forEach((x) => x && x.type === top && out.push([x.r, x.c]));
    }
    return out.filter(([r, c]) => r >= 0 && r < ROWS && c >= 0 && c < COLS);
  }

  function expand(set, reserved, dets) {
    const queue = [...set.values()].filter((t) => t.special && !t.detonated);
    while (queue.length) {
      const t = queue.shift();
      if (t.detonated) continue;
      t.detonated = true;
      dets.push({ kind: t.special, r: t.r, c: t.c });
      for (const [r, c] of specialArea(t)) {
        const k = key(r, c);
        const x = G.board[r][c];
        if (!x || set.has(k) || reserved.has(k)) continue;
        set.set(k, x);
        if (x.special && !x.detonated) queue.push(x);
      }
    }
  }

  async function resolve(forcedSet, forcedDets) {
    let cascade = 0;
    let forced = forcedSet;
    let pre = forcedDets || [];
    while (true) {
      const set = new Map();
      const reserved = new Map();
      const creations = [];
      if (forced) {
        forced.forEach((t, k) => set.set(k, t));
        forced = null;
      } else {
        const runs = findRuns();
        if (!runs.length) break;
        for (const group of components(runs)) {
          const plan = planCreation(group, reserved);
          plan.cells.forEach(([r, c], k) => {
            if (k !== plan.anchor) set.set(k, G.board[r][c]);
          });
          if (plan.kind) {
            const [r, c] = plan.cells.get(plan.anchor);
            reserved.set(plan.anchor, G.board[r][c]);
            creations.push({ tile: G.board[r][c], kind: plan.kind });
          }
        }
      }
      cascade += 1;
      const dets = [...pre];
      pre = [];
      expand(set, reserved, dets);
      await clearStep(set, creations, dets, cascade);
      G.lastSwap = null;
      await gravity();
    }
    G.bestCascade = Math.max(G.bestCascade, cascade);
    return cascade;
  }

  const cellSize = () => dom.tiles.clientWidth / COLS;
  const center = (r, c) => {
    const s = cellSize();
    return { x: (c + 0.5) * s, y: (r + 0.5) * s };
  };

  const COMBO_WORDS = ["", "", "好棒！", "超棒！", "汪汪狂欢！", "尾巴起飞！", "狗狗传说！", "全场沸腾！"];

  // Pull obstacles out of a clear: crates take a hit (also from neighbouring clears), cages open.
  function splitObstacles(set, creations) {
    const crates = new Set();
    const unlocks = [];
    for (const [k, t] of [...set]) {
      if (t.blocker) {
        crates.add(t);
        set.delete(k);
      } else if (t.lock > 0) {
        unlocks.push(t);
        set.delete(k);
      }
    }
    const sources = [...set.values(), ...unlocks, ...creations.map((x) => x.tile)];
    sources.forEach((t) => {
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const x = typeAt(G.board, t.r + dr, t.c + dc);
        if (x && x.blocker) crates.add(x);
      }
    });
    return { crates: [...crates], unlocks };
  }

  function obstacleCleared(n) {
    if (!n) return;
    G.cleared += n;
    G.cfg.goals.forEach((g, i) => {
      if (g.kind === "clear") G.progress[i] = G.cleared;
    });
  }

  async function clearStep(set, creations, dets, cascade) {
    const { crates, unlocks } = splitObstacles(set, creations);
    if (!set.size && !creations.length && !crates.length && !unlocks.length) return;
    const broken = [];
    crates.forEach((t) => {
      t.hp -= 1;
      const { x, y } = center(t.r, t.c);
      fx.spawn(x, y, ["#e0a35e", "#b0702f", "#f3c88f"], t.hp > 0 ? 6 : 12, 1.2);
      if (t.hp > 0) {
        t.el.dataset.hp = t.hp;
        $(".tile__crate", t.el).innerHTML = crateSVG(t.hp);
        t.el.classList.add("is-damaged");
        t.el.classList.remove("is-hit");
        void t.el.offsetWidth;
        t.el.classList.add("is-hit");
      } else {
        t.el.classList.add("is-breaking");
        broken.push(t);
      }
    });
    unlocks.forEach((t) => {
      setLock(t, t.lock - 1);
      const { x, y } = center(t.r, t.c);
      fx.spawn(x, y, ["#ffd447", "#e3ebf2", "#ffffff"], 10, 1.2);
    });
    const opened = unlocks.filter((t) => !t.lock).length;
    obstacleCleared(broken.length + opened);
    if (crates.length) sound.tone && sound.tone(crates.length > 2 ? 196 : 247, { duration: 0.09, type: "square", volume: 0.035 });
    if (opened) {
      sound.tone && sound.tone(1046, { duration: 0.1, type: "triangle", volume: 0.04 });
      if (!set.size || Math.random() < 0.5) coach(opened > 1 ? `放出 ${opened} 只狗狗！` : "笼子打开啦，自由啦～");
    }
    // visuals for detonations
    let heavy = false;
    dets.forEach((d) => {
      const { x, y } = center(d.r, d.c);
      if (d.kind === "lineH" || d.kind === "lineV") {
        const beam = document.createElement("i");
        beam.className = `beam beam--${d.kind === "lineH" ? "h" : "v"}`;
        if (d.kind === "lineH") beam.style.top = `${y}px`;
        else beam.style.left = `${x}px`;
        dom.beams.appendChild(beam);
        setTimeout(() => beam.remove(), 500);
      } else {
        heavy = true;
        const ring = document.createElement("i");
        ring.className = "shock";
        ring.style.left = `${x}px`;
        ring.style.top = `${y}px`;
        ring.style.setProperty("--s", d.kind === "mega" || d.big ? 16 : d.kind === "rainbow" ? 12 : 7);
        dom.beams.appendChild(ring);
        setTimeout(() => ring.remove(), 600);
      }
      fx.spawn(x, y, ["#ffd447", "#ffffff", "#9fe0b0", "#ff7a6b"], d.kind === "mega" ? 40 : 18, 1.6);
    });
    if (dets.length) {
      const k = dets.find((d) => d.kind === "mega" || d.kind === "rainbow") ? "rainbow" : dets.find((d) => d.kind === "bomb") ? "bomb" : "line";
      sound.detonate(k === "line" ? "line" : k);
      haptic(heavy ? 35 : 18);
      dom.board.classList.remove("shake", "shake-big");
      void dom.board.offsetWidth;
      dom.board.classList.add(heavy ? "shake-big" : "shake");
      G.skills += dets.length;
    }
    sound.match(cascade);

    // count, score, effects
    let sx = 0;
    let sy = 0;
    set.forEach((t) => {
      t.el.classList.remove("is-selected", "is-hint", "is-mood");
      t.el.classList.add("is-clearing");
      const { x, y } = center(t.r, t.c);
      sx += x;
      sy += y;
      if (t.type !== "rainbow") {
        G.cfg.goals.forEach((g, i) => {
          if (g.kind === "collect" && g.type === t.type) G.progress[i] += 1;
        });
        fx.spawn(x, y, [DOGS[t.type].tone, "#ffffff", "#ffd447"], 5, 1);
      }
    });
    G.cfg.goals.forEach((g, i) => {
      if (g.kind === "skill") G.progress[i] = G.skills;
    });
    const obstaclePoints = crates.length * 40 + broken.length * 60 + unlocks.length * 100;
    const points = Math.round((set.size * 60 + dets.length * 150 + creations.length * 120 + obstaclePoints) * (1 + (cascade - 1) * 0.5));
    G.score += points;
    if (set.size) {
      floatScore(points, sx / set.size, sy / set.size, points >= 1000);
    } else if (points) {
      const t = broken[0] || crates[0] || unlocks[0];
      const { x, y } = center(t.r, t.c);
      floatScore(points, x, y, false);
    }
    if (G.cfg.mode === "timed" && dets.length && !G.timeUp) {
      G.time = Math.min(Math.max(99, G.cfg.time + 30), G.time + dets.length * 1.5);
      updateCounter();
    }
    chargePower(set.size * 1.1 + dets.length * 4 + creations.length * 5 + broken.length * 2 + opened * 2);
    updateScore();
    if (creations.length) {
      const k = creations[0].kind;
      coach(k === "rainbow" ? "彩虹球！和任意狗狗交换试试！" : k === "bomb" ? "炸弹骨头！点两下就能炸开～" : "直线骨头！整排都能清掉！");
    } else if (cascade >= 3) coach(`${COMBO_WORDS[Math.min(cascade, COMBO_WORDS.length - 1)]} 连击 ×${cascade}！`);
    if (cascade >= 2) showBanner(`COMBO ×${cascade}`, COMBO_WORDS[Math.min(cascade, COMBO_WORDS.length - 1)]);
    else if (dets.some((d) => d.kind === "mega")) showBanner("MEGA!", "全屏清场！");
    else if (dets.some((d) => d.kind === "rainbow")) showBanner("RAINBOW!", "彩虹冲击！");

    // new specials appear as the others pop
    creations.forEach(({ tile, kind }) => {
      setSpecial(tile, kind);
      sound.specialCreated();
    });

    await wait(T.clear);
    set.forEach((t, k) => {
      const r = Math.floor(k / COLS);
      const c = k % COLS;
      if (G.board[r][c] === t) G.board[r][c] = null;
      t.el.remove();
      t.el = null;
    });
    broken.forEach((t) => {
      if (G.board[t.r][t.c] === t) G.board[t.r][t.c] = null;
      t.el.remove();
      t.el = null;
    });
  }

  function floatScore(points, x, y, big) {
    const el = document.createElement("span");
    el.className = `float-score${big ? " is-big" : ""}`;
    el.textContent = `+${fmt(points)}`;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    dom.floats.appendChild(el);
    setTimeout(() => el.remove(), 950);
  }

  function showBanner(kicker, text) {
    dom.bannerKicker.textContent = kicker;
    dom.bannerText.textContent = text;
    dom.banner.classList.remove("show");
    void dom.banner.offsetWidth;
    dom.banner.classList.add("show");
  }

  function coach(text, { dog } = {}) {
    const el = $("#coach");
    const dogEl = $("#coachDog");
    if (dog && dogEl.dataset.dog !== dog) {
      dogEl.dataset.dog = dog;
      paintDogSlots(el);
    }
    $("#coachText").textContent = text;
    el.classList.remove("is-talking");
    void el.offsetWidth;
    el.classList.add("is-talking");
    clearTimeout(coach.t);
    coach.t = setTimeout(() => el.classList.remove("is-talking"), 1400);
  }

  function openingLine(cfg) {
    const dog = DOGS[cfg.chapter.dog];
    const shape = cfg.layout && cfg.layout.shape !== "full" ? `${cfg.layout.name}棋盘！` : "";
    if (cfg.versus) return `${dog.name}：同一张棋盘，${cfg.time} 秒拼手速！`;
    if (cfg.mode === "timed") return `${dog.name}：${shape}${cfg.time} 秒，炸技能能加时间！`;
    if (cfg.mode === "zen") return `${dog.name}：${shape}不着急，慢慢消～`;
    if (cfg.mode === "daily") return `${dog.name}：今日巡逻开始，听我指挥！`;
    const g = cfg.goals[0];
    if (g.kind === "score") return `${dog.name}：帮我攒到 ${fmt(g.target)} 分！`;
    if (g.kind === "skill") return `${dog.name}：连 4 个以上能做技能骨头！`;
    if (g.kind === "clear") return `${dog.name}：${g.only === "cage" ? "把笼子里的朋友都放出来！" : g.only === "crate" ? "在木箱旁边消除，把它敲碎！" : "笼子和木箱都拆掉！"}`;
    return `${dog.name}：${cfg.goals.length > 1 ? "两份订单，一起加油！" : `帮我接 ${g.target} 只${DOGS[g.type].breed}！`}`;
  }

  // Settle the board. Tiles fall straight down, passing through holes; crates and cages hold
  // their spot and split a column. A pocket sealed off from above is fed diagonally by its
  // neighbours, and only pockets open to the top of the board get new dogs.
  async function gravity() {
    const from = new Map();
    const spawnTop = Array(COLS).fill(0);
    const moveTo = (t, r, c) => {
      if (!from.has(t)) from.set(t, { r: t.r, c: t.c });
      t.r = r;
      t.c = c;
      G.board[r][c] = t;
    };

    const settleColumn = (c) => {
      let changed = false;
      let slots = [];
      const flush = (open) => {
        const tiles = slots.map((r) => G.board[r][c]).filter(Boolean);
        slots.forEach((r) => (G.board[r][c] = null));
        slots.forEach((r, i) => {
          const t = tiles[i];
          if (t) {
            if (t.r !== r) changed = true;
            moveTo(t, r, c);
          } else if (open) {
            spawnTop[c] += 1;
            const n = makeTile(pick(G.types), -spawnTop[c], c);
            n.el.classList.add("is-falling");
            dom.tiles.appendChild(n.el);
            from.set(n, { r: -spawnTop[c], c });
            n.r = r;
            G.board[r][c] = n;
            changed = true;
          }
        });
        slots = [];
      };
      for (let r = ROWS - 1; r >= 0; r -= 1) {
        if (!isCell(r, c)) continue;
        if (fixed(G.board[r][c])) flush(false);
        else slots.push(r);
      }
      flush(true);
      return changed;
    };

    const slideOnce = () => {
      for (let r = ROWS - 1; r >= 1; r -= 1) {
        for (let c = 0; c < COLS; c += 1) {
          if (!isCell(r, c) || G.board[r][c]) continue;
          for (const dc of r % 2 ? [-1, 1] : [1, -1]) {
            const t = isCell(r - 1, c + dc) ? G.board[r - 1][c + dc] : null;
            if (!movable(t)) continue;
            G.board[t.r][t.c] = null;
            moveTo(t, r, c);
            return true;
          }
        }
      }
      return false;
    };

    for (let guard = 0; guard < ROWS * COLS * 2; guard += 1) {
      for (let c = 0; c < COLS; c += 1) settleColumn(c);
      if (!slideOnce()) break;
    }

    const moved = [...from].filter(([t, p]) => t.el && (t.r !== p.r || t.c !== p.c));
    if (!moved.length) return;
    dom.tiles.getBoundingClientRect();
    let maxDur = 0;
    moved.forEach(([t, p]) => {
      const dist = Math.max(Math.abs(t.r - p.r), Math.abs(t.c - p.c));
      const dur = T.fallBase + dist * T.fallRow;
      maxDur = Math.max(maxDur, dur);
      t.el.classList.add("is-falling");
      place(t, t.r, t.c, dur);
    });
    await wait(maxDur + 10);
    moved.forEach(([t]) => {
      if (!t.el) return;
      t.el.classList.remove("is-falling");
      t.el.classList.add("is-land");
      setTimeout(() => t.el && t.el.classList.remove("is-land"), 300);
    });
  }

  /* ------------------------------ Turn end -------------------------------- */

  async function finishTurn() {
    if (!G.active) return;
    if (G.cfg.mode === "adventure" || G.cfg.mode === "daily") {
      if (goalsDone()) return winSequence();
      if (G.moves <= 0) return endGame();
    }
    if (G.cfg.mode === "timed" && G.timeUp) return endGame();
    if (!findMove() && !anySpecial()) {
      await autoShuffle("没得消啦，帮你洗个牌～");
    }
    G.busy = false;
    updatePower();
    if (G.powerQueued && !G.paused && !openSheetId) return firePower();
    armHint();
  }

  async function autoShuffle(msg) {
    toast(msg);
    await shuffleBoard();
  }

  // Only free dogs trade places; crates, cages and holes stay where they are.
  async function shuffleBoard() {
    sound.shuffle();
    const spots = [];
    const tiles = [];
    G.board.forEach((row, r) =>
      row.forEach((t, c) => {
        if (movable(t)) {
          spots.push([r, c]);
          tiles.push(t);
        }
      })
    );
    for (let attempt = 0; attempt < 120; attempt += 1) {
      shuffled(tiles).forEach((t, i) => {
        const [r, c] = spots[i];
        G.board[r][c] = t;
        t.r = r;
        t.c = c;
      });
      if (!findRuns().length && findMove()) break;
    }
    tiles.forEach((t) => place(t, t.r, t.c, 480));
    await wait(520);
  }

  async function manualShuffle() {
    if (G.busy || !G.active || G.ended || G.paused || G.shuffles <= 0) return;
    G.busy = true;
    deselect();
    clearHint();
    if (G.cfg.mode !== "zen") G.shuffles -= 1;
    updateShuffle();
    await shuffleBoard();
    G.busy = false;
    armHint();
  }

  async function firePower() {
    if (!G.active || G.ended || G.paused || G.power < 100) {
      G.powerQueued = false;
      return;
    }
    // Power often fills mid-cascade, while the board is still busy. Remember the
    // tap and fire as soon as the turn settles instead of silently dropping it.
    if (G.busy) {
      if (!G.powerQueued) {
        G.powerQueued = true;
        dom.powerValue.textContent = "马上开大…";
        haptic(10);
      }
      return;
    }
    G.powerQueued = false;
    G.busy = true;
    G.powerFiring = true;
    deselect();
    clearHint();
    sound.storm();
    haptic([20, 30, 40]);
    showBanner("WOOF!", "汪汪大招！");
    G.power = 0;
    updatePower();
    const candidates = shuffled(G.board.flat().filter((t) => movable(t) && !t.special));
    const kinds = ["lineH", "bomb", "lineV"];
    const chosen = candidates.slice(0, 3);
    chosen.forEach((t, i) => setSpecial(t, kinds[i]));
    await wait(650);
    await resolve(new Map(chosen.map((t) => [key(t.r, t.c), t])), []);
    G.powerFiring = false;
    finishTurn();
  }

  async function winSequence() {
    G.ended = true;
    G.busy = true;
    clearHint();
    deselect();
    updatePower();
    showBanner("CLEAR!", "订单完成！");
    sound.win();
    await wait(1100);
    const left = G.moves;
    G.starScore = G.score + left * 180;
    if (left > 0) {
      showBanner("BONUS", "剩余步数变骨头！");
      const k = Math.min(left, 10);
      const picks = shuffled(G.board.flat().filter((t) => movable(t) && !t.special)).slice(0, k);
      for (const t of picks) {
        setSpecial(t, Math.random() < 0.5 ? "lineH" : "lineV");
        G.moves -= 1;
        updateCounter();
        sound.tone(660 + (k - G.moves) * 40, { duration: 0.08, type: "triangle", volume: 0.03 });
        await wait(110);
      }
      G.score += G.moves * 300;
      G.moves = 0;
      updateCounter();
      await wait(300);
      const set = new Map(picks.filter((t) => t.el).map((t) => [key(t.r, t.c), t]));
      await resolve(set, []);
      // finish off any special still on the board
      const rest = G.board.flat().filter((t) => t && t.special && t.special !== "rainbow");
      if (rest.length) await resolve(new Map(rest.map((t) => [key(t.r, t.c), t])), []);
    }
    await wait(300);
    endGame(true);
  }

  function starsFor(score) {
    if (G.starScore) score = G.starScore; // rate the clear itself, not the bonus fireworks
    return G.cfg.stars.filter((s) => score >= s).length;
  }

  function endGame(won = false) {
    if (!G.active) return;
    G.active = false;
    G.busy = true;
    G.ended = true;
    stopTimers();
    clearHint();
    deselect();
    const cfg = G.cfg;
    const result = { won, score: G.score, stars: 0, record: false };

    if (cfg.mode === "adventure") {
      if (won) {
        result.stars = Math.max(1, starsFor(G.score));
        save.stars[cfg.level] = Math.max(save.stars[cfg.level] || 0, result.stars);
        save.unlocked = Math.max(save.unlocked, Math.min(LEVEL_COUNT, cfg.level + 1));
        if (cfg.level === LEVEL_COUNT) save.unlocked = LEVEL_COUNT;
      }
    } else if (cfg.mode === "daily") {
      if (won) result.stars = Math.max(1, starsFor(G.score));
      const prev = save.daily[cfg.dateKey] || { best: 0, stars: 0 };
      if (won || prev.best) {
        save.daily[cfg.dateKey] = { best: Math.max(prev.best, won ? G.score : 0), stars: Math.max(prev.stars, result.stars) };
      }
      result.record = won && G.score > prev.best;
    } else {
      result.stars = starsFor(G.score);
      result.won = true;
      const bestKey = cfg.bestKey || cfg.mode;
      result.record = G.score > (save.best[bestKey] || 0);
      if (result.record) save.best[bestKey] = G.score;
    }
    persist();
    if (cfg.versus) {
      // The versus screen owns sound and confetti until both scores are known.
    } else if (result.won) {
      if (cfg.mode !== "zen") sound.win();
      confetti();
    } else {
      sound.lose();
    }
    setTimeout(() => showResult(result), cfg.mode === "zen" ? 0 : 400);
  }

  /* -------------------------------- Result -------------------------------- */

  const WIN_TITLES = ["汪！完美！", "尾巴摇成螺旋桨！", "今天的你超棒！", "狗狗们都在鼓掌！"];

  function showResult(res) {
    const cfg = G.cfg;
    if (cfg.versus && window.BellaVersus) {
      window.BellaVersus.showResult(res);
      return;
    }
    const sheet = $("#sheet-result");
    sheet.classList.toggle("is-lose", !res.won);
    const portrait = $("#resultPortrait");
    portrait.dataset.dog = res.won ? cfg.chapter.dog : "husky";
    portrait.className = `sheet__portrait sheet__portrait--big ${res.won ? "mood-joy" : "mood-wow"}`;
    portrait.dataset.painted = "";

    const kicker = { adventure: `LEVEL ${cfg.level}`, daily: "DAILY PATROL", timed: "TIME UP", zen: "ZEN MODE" }[cfg.mode];
    $("#resultKicker").textContent = res.won ? `${kicker} · CLEAR` : `${kicker} · FAILED`;
    let title = res.won ? pick(WIN_TITLES, Math.random) : "差一点点！";
    if (cfg.mode === "timed") title = res.record ? "新纪录！快得像柯基！" : "时间到！";
    if (cfg.mode === "zen") title = res.record ? "悠闲新纪录！" : "休息一下～";
    $("#resultTitle").textContent = title;

    let copy = "";
    if (!res.won) {
      const remain = cfg.goals
        .map((g, i) => {
          const v = g.kind === "score" ? G.score : G.progress[i];
          const left = g.target - v;
          if (left <= 0) return null;
          return g.kind === "collect" ? `${DOGS[g.type].breed} ${left} 只` : g.kind === "skill" ? `技能 ${left} 次` : g.kind === "clear" ? `${g.only === "cage" ? "狗笼" : g.only === "crate" ? "木箱" : "障碍"} ${left} 个` : `${fmt(left)} 分`;
        })
        .filter(Boolean);
      copy = `还差 ${remain.join("、")}。Loki 说它一点也不慌。`;
    } else if (cfg.mode === "adventure") {
      copy = cfg.level >= LEVEL_COUNT ? `全部 ${LEVEL_COUNT} 关都通啦！你是狗狗俱乐部的荣誉会长。` : `下一关：第 ${cfg.level + 1} 关 · ${chapterOf(cfg.level + 1).name}`;
    } else if (cfg.mode === "daily") {
      copy = "明天 Surprise 还会带来新的巡逻路线。";
    } else {
      copy = `${cfg.mode === "timed" ? `${cfg.time} 秒` : ""}最高纪录 ${fmt(save.best[cfg.bestKey || cfg.mode])} 分`;
    }
    $("#resultCopy").textContent = copy;

    const stats = [[cfg.mode === "timed" || cfg.mode === "zen" ? "本局得分" : "得分", fmt(res.score), res.record]];
    stats.push(["最佳连击", `×${Math.max(1, G.bestCascade)}`]);
    stats.push(["技能爆破", G.skills]);
    $("#resultStats").innerHTML = stats
      .map(([l, v, rec]) => `<div class="${rec ? "is-record" : ""}"><span>${l}${rec ? " · 新纪录" : ""}</span><strong>${v}</strong></div>`)
      .join("");

    const starEls = $$("#resultStars span");
    starEls.forEach((s) => s.classList.remove("on"));
    $("#resultStars").style.display = res.won ? "" : "none";
    if (res.won) {
      starEls.forEach((s, i) => {
        if (i < res.stars) {
          setTimeout(() => {
            s.classList.add("on");
            sound.tone(880 + i * 220, { duration: 0.18, type: "triangle", volume: 0.04 });
            haptic(12);
          }, 500 + i * 380);
        }
      });
    }

    let primary;
    if (!res.won && !G.extraUsed && (cfg.mode === "adventure" || cfg.mode === "daily")) primary = "再给 5 步";
    else if (!res.won) primary = "再试一次";
    else if (cfg.mode === "adventure" && cfg.level < LEVEL_COUNT) primary = "下一关";
    else if (cfg.mode === "adventure" || cfg.mode === "daily") primary = "回到地图";
    else primary = "再来一局";
    if (cfg.mode === "daily" && res.won) primary = "回到首页";
    if (cfg.mode === "adventure" && res.won && cfg.level >= LEVEL_COUNT) primary = "回到地图";
    $("#resultPrimaryText").textContent = primary;
    $("#resultHomeText").textContent = cfg.mode === "adventure" ? "地图" : "首页";
    result.current = { res, primary };
    openSheet("result");
  }
  const result = { current: null };

  function resultPrimary() {
    const { primary } = result.current;
    const cfg = G.cfg;
    closeSheet();
    if (primary === "再给 5 步") {
      G.extraUsed = true;
      G.moves += 5;
      G.active = true;
      G.ended = false;
      G.busy = false;
      updateCounter();
      updatePower();
      startMoods();
      armHint();
      toast("+5 步！冲呀！");
      return;
    }
    if (primary === "下一关") return setTimeout(() => openIntro(levelConfig(cfg.level + 1)), 250);
    if (primary === "回到地图") return showScreen("map", { back: true });
    if (primary === "回到首页") return showScreen("title", { back: true });
    restart();
  }

  function restart() {
    const cfg = G.cfg;
    closeSheet();
    const fresh =
      cfg.mode === "adventure"
        ? levelConfig(cfg.level)
        : cfg.mode === "daily"
          ? dailyConfig()
          : cfg.mode === "timed"
            ? timedConfig(save.timedPick.shape === "random" ? undefined : cfg.layout, cfg.time) // a picked board replays as-is
            : zenConfig();
    startGame(fresh);
  }

  function leaveGame() {
    G.active = false;
    stopTimers();
    closeSheet();
    const mode = G.cfg.mode;
    showScreen(mode === "adventure" ? "map" : "title", { back: true });
  }

  /* -------------------------------- Pause -------------------------------- */

  function pause(reason = "manual") {
    if (!G.active || G.ended) return;
    if (G.cfg && G.cfg.versus) {
      // Versus pauses are shared: both players freeze until someone resumes.
      if (window.BellaVersus && window.BellaVersus.requestPause) window.BellaVersus.requestPause(reason === "away" ? "away" : "manual");
      return;
    }
    G.paused = true;
    openSheet("pause", { onClose: () => (G.paused = false) });
  }
  function resume() {
    closeSheet();
    G.paused = false;
    if (G.powerQueued && !G.busy) return firePower();
    armHint();
  }
  function quitFromPause() {
    if (G.cfg.mode === "zen" && G.score > 0) {
      closeSheet();
      G.paused = false;
      endGame(true);
      return;
    }
    if (G.cfg.mode === "timed") {
      leaveGame();
      return;
    }
    leaveGame();
  }

  /* ------------------------------- Confetti ------------------------------- */

  function confetti() {
    if (reduced) return;
    const colors = ["#3cbf6e", "#9fe0b0", "#8fbc3c", "#cbe486", "#ffd447", "#ff7a6b", "#ffffff"];
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 70; i += 1) {
      const p = document.createElement("i");
      p.style.left = `${Math.random() * 100}%`;
      p.style.background = colors[i % colors.length];
      p.style.setProperty("--x", `${(Math.random() - 0.5) * 160}px`);
      p.style.setProperty("--rot", `${Math.random() * 900}deg`);
      p.style.setProperty("--d", `${1.8 + Math.random() * 1.6}s`);
      p.style.animationDelay = `${Math.random() * 0.5}s`;
      frag.appendChild(p);
    }
    dom.confetti.appendChild(frag);
    setTimeout(() => dom.confetti.replaceChildren(), 4200);
  }

  /* --------------------------------- Dex ---------------------------------- */

  function buildDex() {
    $("#dexGrid").innerHTML = HOME_ORDER.map((t) => {
      const d = DOGS[t];
      return `<button class="dex-card" data-dex="${t}">
        <span class="dex-card__art">${dogSVG(t)}</span>
        <span class="dex-card__row"><span><strong>${d.name}</strong><br><small>${d.breed} · ${d.scene}</small></span><i class="dex-card__swatch" style="background:${d.tone}"></i></span>
      </button>`;
    }).join("");
  }

  function openDog(type) {
    const d = DOGS[type];
    const hero = $("#dogHero");
    hero.innerHTML = dogSVG(type);
    hero.dataset.mood = "def";
    hero.dataset.type = type;
    $$("#moodTabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.mood === "def")));
    $("#dogBreed").textContent = `${d.en.toUpperCase()} · ${d.breed}`;
    $("#dogTitle").textContent = d.name;
    $("#dogTrait").textContent = d.trait;
    $("#dogFacts").innerHTML = `<span>场景 · ${d.scene}</span><span>配饰 · ${d.prop}</span>`;
    openSheet("dog");
  }

  function setMood(mood) {
    const hero = $("#dogHero");
    hero.dataset.mood = mood;
    hero.classList.remove("hop");
    void hero.offsetWidth;
    hero.classList.add("hop");
    $$("#moodTabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.mood === mood)));
    if (mood === "joy") sound.match(2);
    else if (mood === "wow") sound.select();
  }

  /* --------------------------------- Help --------------------------------- */

  function buildHelp() {
    const art = {
      swap: dogSVG("golden"),
      line: dogSVG("corgi") + BADGES.line.replace("sp-badge", "sp-badge how-badge"),
      bomb: dogSVG("shepherd") + BADGES.bomb.replace("sp-badge", "sp-badge how-badge"),
      rainbow: rainbowSVG(),
      power: dogSVG("husky"),
      crate: crateSVG(2),
      cage: dogSVG("pug") + `<span class="how-cage">${CAGE_SVG}</span>`,
      shape: `<span class="intro-board intro-board--mini">${layoutPreview(buildLayout("heart"))}</span>`,
    };
    $$("[data-how]").forEach((el) => {
      el.innerHTML = art[el.dataset.how];
    });
  }

  /* -------------------------------- Input --------------------------------- */

  function tileFromPoint(x, y) {
    const rect = dom.tiles.getBoundingClientRect();
    const c = Math.floor(((x - rect.left) / rect.width) * COLS);
    const r = Math.floor(((y - rect.top) / rect.height) * ROWS);
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null;
    return G.board[r][c];
  }

  function onPointerDown(e) {
    if (!G.active || G.busy || G.paused || G.ended) return;
    const t = tileFromPoint(e.clientX, e.clientY);
    if (!t) return;
    e.preventDefault();
    sound.init();
    dom.board.setPointerCapture && dom.board.setPointerCapture(e.pointerId);
    G.drag = { t, x: e.clientX, y: e.clientY, moved: false, id: e.pointerId };
    armHint();
  }
  function onPointerMove(e) {
    const d = G.drag;
    if (!d || d.moved || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    const threshold = cellSize() * 0.32;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return;
    d.moved = true;
    const [dr, dc] = Math.abs(dx) > Math.abs(dy) ? [0, Math.sign(dx)] : [Math.sign(dy), 0];
    const r = d.t.r + dr;
    const c = d.t.c + dc;
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;
    const other = G.board[r][c];
    if (!movable(d.t)) return;
    if (other && !movable(other)) return nudgeFixed(other);
    if (other && !G.busy) trySwap(d.t, other);
  }
  function onPointerUp(e) {
    const d = G.drag;
    G.drag = null;
    if (!d || d.moved || e.pointerId !== d.id) return;
    onTap(d.t);
  }

  // keyboard: arrows move a cursor, Enter/Space select
  let cursor = { r: 0, c: 0 };
  function onBoardKey(e) {
    if (!G.active || G.busy) return;
    const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (moves[e.key]) {
      e.preventDefault();
      cursor = { r: clamp(cursor.r + moves[e.key][0], 0, ROWS - 1), c: clamp(cursor.c + moves[e.key][1], 0, COLS - 1) };
      $$(".tile.is-cursor").forEach((el) => el.classList.remove("is-cursor"));
      const t = G.board[cursor.r][cursor.c];
      if (G.selected && t && adjacent(G.selected, t)) return trySwap(G.selected, t);
      if (t) t.el.classList.add("is-hint");
      setTimeout(() => t && t.el && t.el.classList.remove("is-hint"), 300);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const t = G.board[cursor.r][cursor.c];
      if (t) onTap(t);
    }
  }

  /* ------------------------------- Actions -------------------------------- */

  const actions = {
    continue: () => openIntro(levelConfig(Math.min(save.unlocked, LEVEL_COUNT))),
    "go-dex": () => showScreen("dex"),
    back: goBack,
    "open-help": () => openSheet("help"),
    "open-settings": () => openSheet("settings"),
    "toggle-sound": () => {
      const on = !(save.settings.sfx || save.settings.music);
      save.settings.sfx = on;
      save.settings.music = on;
      persist();
      sound.init();
      applyAudioSettings();
      toast(on ? "声音已打开" : "已静音");
    },
    "mode-adventure": () => showScreen("map"),
    "mode-raise": () => showScreen("raise"),
    "mode-timed": openTimedPicker,
    "timed-shape": (el) => {
      save.timedPick.shape = el.dataset.value;
      persist();
      renderTimedPicker();
    },
    "timed-time": (el) => {
      save.timedPick.time = Number(el.dataset.value);
      persist();
      renderTimedPicker();
      refreshHome();
    },
    "timed-obstacle": (el) => {
      save.timedPick.obstacles = el.dataset.value;
      persist();
      rollTimedSamples();
      renderTimedPicker();
    },
    "timed-reroll": () => {
      if (save.timedPick.shape === "random") return;
      const { shape, obstacles } = save.timedPick;
      timedSamples[shape] = sampleLayout(shape, obstacles);
      renderTimedPicker();
    },
    "timed-start": () => {
      const { shape } = save.timedPick;
      closeSheet();
      setTimeout(() => startGame(timedConfig(shape === "random" ? undefined : timedSamples[shape])), 180);
    },
    "mode-zen": () => startGame(zenConfig()),
    "mode-daily": () => openIntro(dailyConfig()),
    "intro-start": () => {
      const cfg = pendingConfig;
      closeSheet();
      setTimeout(() => startGame(cfg), 180);
    },
    "close-sheet": closeSheet,
    scrim: () => {
      if (openSheetId === "result" || openSheetId === "versus-result") return;
      if (openSheetId === "pause") return resume();
      closeSheet();
    },
    pause: () => pause(),
    resume,
    restart: () => {
      if (openSheetId === "pause") {
        confirmSheet("重新开始？", "这一局的进度会清空。", "重来", () => restart());
      } else restart();
    },
    quit: () => {
      if (G.cfg.mode === "zen") return quitFromPause();
      confirmSheet("退出这一局？", "这一局的进度不会保存。", "退出", () => leaveGame());
    },
    "result-primary": resultPrimary,
    "result-home": () => {
      closeSheet();
      showScreen(G.cfg.mode === "adventure" ? "map" : "title", { back: true });
    },
    hint: () => {
      if (!G.busy) showHint(true);
    },
    shuffle: manualShuffle,
    power: firePower,
    "reset-progress": () =>
      confirmSheet("清空存档？", "所有关卡星星和最高分都会被清除。", "清空", () => {
        const settings = save.settings;
        save = structuredClone(DEFAULTS);
        save.settings = settings;
        persist();
        refreshHome();
        toast("存档已清空");
      }),
    "confirm-yes": () => {
      const fn = confirmAction;
      confirmAction = null;
      closeSheet();
      if (fn) fn();
    },
    "confirm-no": () => {
      const back = G.active && !G.ended && G.paused;
      closeSheet();
      if (back) pause();
    },
  };

  function bind() {
    document.addEventListener("click", (e) => {
      const el = e.target.closest("[data-action]");
      if (el && !el.disabled) {
        sound.init();
        if (!["scrim"].includes(el.dataset.action)) sound.click();
        actions[el.dataset.action] && actions[el.dataset.action](el);
        return;
      }
      const node = e.target.closest(".node");
      if (node) {
        sound.init();
        if (node.getAttribute("aria-disabled") === "true") {
          sound.invalid();
          toast("先通过前一关吧～");
          return;
        }
        sound.click();
        openIntro(levelConfig(Number(node.dataset.level)));
        return;
      }
      const dex = e.target.closest("[data-dex]");
      if (dex) {
        sound.init();
        sound.select();
        openDog(dex.dataset.dex);
        return;
      }
      const tab = e.target.closest("[data-mood]");
      if (tab) setMood(tab.dataset.mood);
      if (e.target.closest("#dogHero")) {
        const order = ["def", "wow", "joy"];
        const hero = $("#dogHero");
        setMood(order[(order.indexOf(hero.dataset.mood) + 1) % 3]);
      }
    });

    $$("[data-setting]").forEach((input) =>
      input.addEventListener("change", () => {
        save.settings[input.dataset.setting] = input.checked;
        persist();
        sound.init();
        applyAudioSettings();
      })
    );

    dom.board.addEventListener("pointerdown", onPointerDown);
    dom.board.addEventListener("pointermove", onPointerMove);
    dom.board.addEventListener("pointerup", onPointerUp);
    dom.board.addEventListener("pointercancel", () => (G.drag = null));
    dom.board.addEventListener("keydown", onBoardKey);
    dom.board.addEventListener("contextmenu", (e) => e.preventDefault());

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") goBack();
      if (currentScreen === "game" && !openSheetId) {
        if (e.key === "h" || e.key === "H") actions.hint();
        if (e.key === "s" || e.key === "S") manualShuffle();
        if (e.key === "o" || e.key === "O") firePower();
        if (e.key === "p" || e.key === "P") pause();
      }
    });
    // Mobile browsers only unlock audio on a real tap (touchend / click), not on a
    // touch pointerdown, so listen to all of them and keep listening until the
    // music is actually running (iOS can suspend audio again after interruptions).
    const unlockAudio = () => {
      if (!sound.enabled) return;
      if (sound.ctx && sound.ctx.state === "running" && (sound.musicPlaying || !sound.wantMusic)) return;
      sound.init();
    };
    ["pointerdown", "pointerup", "touchend", "click", "keydown"].forEach((type) =>
      document.addEventListener(type, unlockAudio, { capture: true, passive: true })
    );
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        sound.stopMusic();
        if (currentScreen === "game" && G.active && !G.ended && !openSheetId) pause("away");
      } else if (save.settings.music && sound.ctx) {
        sound.startMusic();
      }
    });
    // stop iOS double-tap zoom & rubber band outside scroll areas
    document.addEventListener("dblclick", (e) => e.preventDefault());
  }

  /* --------------------------------- Init --------------------------------- */

  function init() {
    paintDogSlots();
    buildHomeArt();
    buildCells();
    buildDex();
    buildHelp();
    applyAudioSettings();
    bind();
    refreshHome();
    if (window.BellaRaise) {
      window.BellaRaise.mount({ sound, haptic, toast });
      window.BellaRaise.updateHome();
    }
    if (!save.seenHelp) {
      save.seenHelp = true;
      persist();
    }
  }

  init();

  // Shared handle for the versus module and console debugging.
  // Versus-only hooks: freeze/unfreeze the board for a shared pause, and restore
  // score + clock after a player rejoins a running match.
  function setVersusFrozen(frozen) {
    if (!G.active || G.ended) return;
    G.paused = Boolean(frozen);
    if (G.paused) {
      clearHint();
      deselect();
    } else {
      if (G.powerQueued && !G.busy) return firePower();
      armHint();
    }
  }

  function versusRestore({ score, time }) {
    if (!G.active || !G.cfg || !G.cfg.versus) return;
    if (Number.isFinite(score)) {
      G.score = Math.max(0, Math.round(score));
      G.shownScore = G.score;
      updateScore(true);
    }
    if (Number.isFinite(time)) setVersusTime(time);
  }

  function setVersusTime(time) {
    if (!G.active || !G.cfg || !G.cfg.versus) return;
    G.time = Math.max(0.5, Math.min(G.cfg.time, Number(time) || 0));
    updateCounter();
  }

  window.__bella = {
    G,
    endGame,
    setVersusFrozen,
    versusRestore,
    setVersusTime,
    levelConfig,
    versusConfig,
    startGame,
    save: () => save,
    persist,
    refreshHome,
    findMove,
    trySwap,
    buildLayout,
    sound,
    haptic,
    toast,
    confetti,
    openSheet,
    closeSheet,
    showScreen,
    leaveGame,
    screen: () => currentScreen,
    sheet: () => openSheetId,
  };
})();
