/* 狗狗成长屋 · 领养、照顾、长大 */
(() => {
  "use strict";

  const { DOGS } = window.BellaDogs;
  const { SoundKit, ParticleField } = window.BellaKit;
  const RA = window.BellaRaiseArt;
  const roomEl = document.getElementById("raiseRoom");
  if (roomEl) roomEl.innerHTML = RA.roomSVG();
  const { SLOTS, ITEMS } = RA;

  const SAVE_KEY = "bella-dog-raise-v1";
  const ENERGY_MAX = 10;
  const ENERGY_MS = 25 * 60 * 1000; // 1 energy / 25 min
  const DECAY_MS = 60 * 1000;
  const DECAY = { hunger: 2.1, mood: 1.6, clean: 1.3 }; // points per hour
  const WALK_BASE = { mood: 8, bond: 4, xp: 12, hunger: -6, clean: -8 };

  const STAGES = [
    {
      name: "幼犬期",
      short: "幼犬",
      at: 0,
      next: 80,
      tip: "刚到家的小家伙，最需要喂食、洗澡和抱抱。",
      unlock: "多陪陪它，很快就能长成少年犬。",
    },
    {
      name: "少年期",
      short: "少年",
      at: 80,
      next: 220,
      tip: "精力旺盛，可以出门散步、学习才艺了。",
      unlock: "解锁散步、训练，以及更多每日心愿。",
    },
    {
      name: "成年期",
      short: "成年",
      at: 220,
      next: Infinity,
      tip: "已经长成大狗啦，继续陪它学才艺、解锁配饰吧。",
      unlock: "解锁全部才艺与高级配饰。",
    },
  ];

  const ACTIONS = {
    feed: {
      name: "喂食",
      icon: "bone",
      cost: 1,
      cd: 30 * 1000,
      lines: ["好吃！", "再来一口～", "肚子暖暖的。"],
    },
    pet: {
      name: "摸摸",
      icon: "paw",
      cost: 0,
      cd: 5 * 1000,
      lines: ["再摸摸～", "好舒服…", "尾巴停不下来了。"],
    },
    play: {
      name: "玩耍",
      icon: "ball",
      cost: 1,
      cd: 60 * 1000,
      lines: ["接住啦！", "小球别跑！"],
    },
    bath: {
      name: "洗澡",
      icon: "drop",
      cost: 1,
      cd: 150 * 1000,
      lines: ["泡泡好舒服～", "香喷喷！", "别搓我的耳朵啦。"],
    },
    walk: {
      name: "散步",
      icon: "map",
      cost: 2,
      cd: 240 * 1000,
      stage: 1,
      lines: ["出门啦！", "今天去哪里？"],
    },
    train: {
      name: "训练",
      icon: "star",
      cost: 1,
      cd: 90 * 1000,
      stage: 1,
      lines: ["认真学本领！", "看我的！"],
    },
  };

  const TRICKS = [
    { id: "sit", name: "坐下", at: 1 },
    { id: "paw", name: "握手", at: 2 },
    { id: "spin", name: "转圈", at: 4 },
    { id: "highfive", name: "击掌", at: 6 },
    { id: "playdead", name: "装死", at: 8 },
    { id: "fetch", name: "接飞盘", at: 10 },
  ];

  const WISHES = [
    { id: "pet", action: "pet", goal: 3, label: "被摸摸 {n} 次" },
    { id: "feed", action: "feed", goal: 2, label: "吃 {n} 顿饱饭" },
    { id: "play", action: "play", goal: 1, label: "陪它玩 {n} 次" },
    { id: "bath", action: "bath", goal: 1, label: "洗 {n} 次香香澡" },
    { id: "walk", action: "walk", goal: 1, stage: 1, label: "出门散步 {n} 次" },
    { id: "train", action: "train", goal: 1, stage: 1, label: "完成 {n} 次训练" },
  ];

  const WALK_EVENTS = [
    {
      id: "olddog",
      title: "长椅上的老狗",
      text: "路边长椅上坐着一只老狗，慢慢摇着尾巴。它的主人朝你们笑了笑。",
      choices: [
        {
          label: "上前打个招呼",
          outcome: "两只狗互相闻了闻，像认识很久的朋友。老狗的主人说：它年轻时也这么活泼。",
          delta: { mood: 6, bond: 6 },
        },
        {
          label: "不打扰它",
          outcome: "你牵着它轻轻走过。它回头看了好几眼，尾巴慢慢垂下来。",
          delta: { mood: 1, bond: 1 },
        },
      ],
    },
    {
      id: "kitten",
      title: "灌木丛里的小猫",
      text: "一只小奶猫从灌木丛里探出头，奶声奶气地叫了一声。",
      choices: [
        {
          label: "让它闻闻",
          outcome: "小狗好奇地凑过去，小猫给了它一爪子——还好没有伸指甲。",
          delta: { mood: 5, bond: 4 },
        },
        {
          label: "绕开走",
          outcome: "你把它拉回小路。它一边走一边回头，耳朵转来转去。",
          delta: { mood: 1, bond: 1 },
        },
      ],
    },
    {
      id: "cookie",
      title: "地上的半块饼干",
      text: "地上掉着半块香喷喷的饼干。它停下脚步，鼻子一抽一抽。",
      choices: [
        {
          label: "捡起来吃掉",
          outcome: "它一口吞下去，尾巴摇得飞快，还舔了舔你的手。",
          delta: { hunger: 16, mood: 3, clean: -4, bond: 1 },
        },
        {
          label: "拉它走开",
          outcome: "它咽了咽口水，还是乖乖跟你走了。你答应回家给它加餐。",
          delta: { mood: 2, bond: 3 },
        },
      ],
    },
    {
      id: "rain",
      title: "突然下雨了",
      text: "天说变就变，细细的雨点落下来。它抬头看天，耳朵抖了抖。",
      choices: [
        {
          label: "一起淋雨跑回家",
          outcome: "你们一路踩着水花跑回家，像两个小疯子。它开心得直打喷嚏。",
          delta: { mood: 8, bond: 5, clean: -10 },
        },
        {
          label: "躲到屋檐下等",
          outcome: "你们挤在屋檐下，看雨一点点变小。它靠在你腿边打起了小呼噜。",
          delta: { mood: 3, bond: 3, hunger: -3 },
        },
      ],
    },
    {
      id: "frisbee",
      title: "公园里的飞盘",
      text: "公园里有人扔出一只飞盘，划出一道漂亮的弧线。它的眼睛一下子亮了。",
      choices: [
        {
          label: "追！",
          outcome: "它冲出去，叼回来的却是一根树枝。至少它玩得很开心。",
          delta: { mood: 7, bond: 3, hunger: -4 },
        },
        {
          label: "坐着看",
          outcome: "它看得目不转睛，尾巴在地上扫来扫去，把落叶扫成了一个小堆。",
          delta: { mood: 2, bond: 2 },
        },
      ],
    },
    {
      id: "kid",
      title: "想摸狗的小朋友",
      text: "一个小朋友指着它说：好可爱，可以摸吗？",
      choices: [
        {
          label: "让它摸",
          outcome: "小朋友轻轻摸了摸它的头，它开心地眯起眼睛，还主动把脑袋凑过去。",
          delta: { mood: 5, bond: 4 },
        },
        {
          label: "先问问家长",
          outcome: "你先问了家长，才让小朋友靠近。它一直乖乖坐着，尾巴轻轻拍着地面。",
          delta: { bond: 3, mood: 2 },
        },
      ],
    },
    {
      id: "bakery",
      title: "面包店的香味",
      text: "路过面包店，刚出炉的香味飘了出来。它趴在玻璃门上，鼻子印出一个小圆。",
      choices: [
        {
          label: "买一块小狗饼干",
          outcome: "店员送了一块无糖小狗饼干。它吃得咔嚓咔嚓，碎屑掉了一地。",
          delta: { hunger: 14, mood: 4 },
        },
        {
          label: "闻闻就走",
          outcome: "它在门口坐了一会儿，才舍得离开。走远了还回头望了一眼。",
          delta: { bond: 2, mood: 1 },
        },
      ],
    },
  ];

  const NAMES = ["豆豆", "团子", "奶糖", "布丁", "芝麻", "年糕", "可乐", "栗子", "小满", "桃子", "花卷", "米粒"];

  const $ = (s, p = document) => p.querySelector(s);
  const $$ = (s, p = document) => [...p.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const esc = (v) =>
    String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const yesterdayKey = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const dateLabel = (ts) => {
    const d = new Date(ts);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  };
  const fmtCd = (ms) => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    if (s < 60) return `${s}秒`;
    const m = Math.floor(s / 60);
    const rest = s % 60;
    return rest ? `${m}分${rest}秒` : `${m}分钟`;
  };

  /* ------------------------------- State -------------------------------- */

  function defaults() {
    const now = Date.now();
    return {
      v: 1,
      adopted: false,
      dog: null,
      name: "",
      startedAt: 0,
      xp: 0,
      bond: 0,
      needs: { hunger: 72, mood: 74, clean: 72 },
      energy: 8,
      energyAt: now,
      lastTick: now,
      lastDecay: now,
      cooldowns: {},
      training: 0,
      tricks: [],
      outfit: RA.emptyOutfit(),
      memories: [],
      wish: null,
      streak: 0,
      lastCareDate: null,
      totalCare: 0,
      offer: [],
      walks: 0,
      lastWalk: null,
    };
  }

  function load() {
    const base = defaults();
    try {
      const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}") || {};
      const s = {
        ...base,
        ...raw,
        needs: { ...base.needs, ...(raw.needs || {}) },
        cooldowns: { ...(raw.cooldowns || {}) },
        outfit: { ...RA.emptyOutfit(), ...(raw.outfit || {}) },
        memories: Array.isArray(raw.memories) ? raw.memories : [],
        tricks: Array.isArray(raw.tricks) ? raw.tricks : [],
        offer: Array.isArray(raw.offer) ? raw.offer : [],
      };
      if (s.dog && !DOGS[s.dog]) {
        s.adopted = false;
        s.dog = null;
      }
      return s;
    } catch (e) {
      return base;
    }
  }

  let state = load();
  let selectedOffer = null;
  let dressSlot = "head";
  let pendingNameType = null;
  let pendingRename = false;
  let modalLocked = false;
  let modalCloseCb = null;
  let pendingCelebration = null;
  let mini = null;
  let fx = null;
  let timer = null;
  let ticks = 0;
  let fallbackSound = null;

  const bridge = {
    sound: null,
    haptic: () => {},
    toast: () => {},
  };
  const sound = () => bridge.sound || (fallbackSound = fallbackSound || new SoundKit());

  const ui = {
    actionSig: "",
    petKey: "",
    mood: "",
    moodHold: 0,
    speechTimer: 0,
    speechUntil: 0,
    modalToken: 0,
  };

  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch (e) {
      /* private mode */
    }
  }

  /* ------------------------------ Helpers ------------------------------- */

  function stageIndex(xp = state.xp) {
    if (xp >= 220) return 2;
    if (xp >= 80) return 1;
    return 0;
  }
  function stageInfo() {
    return STAGES[stageIndex()];
  }
  function bondLevel() {
    return clamp(1 + Math.floor(state.bond / 10), 1, 10);
  }
  function dayCount() {
    if (!state.startedAt) return 1;
    return Math.max(1, Math.floor((Date.now() - state.startedAt) / 86400000) + 1);
  }
  function outfitKey() {
    return SLOTS.map((s) => state.outfit[s.id] || "").join(",");
  }
  function dogArt(stage = stageIndex(), mood = "joy") {
    return RA.dogBodySVG(state.dog, stage, { outfit: state.outfit, mood });
  }
  function puppyArt(type) {
    return RA.dogBodySVG(type, 0, { mood: "joy" });
  }
  function progressPct() {
    const si = stageIndex();
    if (si >= 2) return 100;
    const lo = STAGES[si].at;
    const hi = STAGES[si].next;
    return clamp(((state.xp - lo) / (hi - lo)) * 100, 0, 100);
  }
  function cdLeft(id) {
    return Math.max(0, (state.cooldowns[id] || 0) - Date.now());
  }

  function applyTime(now = Date.now()) {
    if (!state.adopted) return;
    const dt = now - (state.lastDecay || now);
    if (dt >= DECAY_MS) {
      const hours = Math.min(dt, 72 * 3600000) / 3600000;
      const hungry = state.needs.hunger < 30;
      state.needs.hunger = Math.max(6, state.needs.hunger - hours * DECAY.hunger);
      state.needs.mood = Math.max(6, state.needs.mood - hours * (DECAY.mood + (hungry ? 0.9 : 0)));
      state.needs.clean = Math.max(6, state.needs.clean - hours * DECAY.clean);
      state.lastDecay = now;
    }
    state.lastTick = now;

    if (state.energy >= ENERGY_MAX) {
      state.energy = ENERGY_MAX;
      state.energyAt = now;
    } else {
      const gain = Math.floor((now - state.energyAt) / ENERGY_MS);
      if (gain > 0) {
        state.energy = Math.min(ENERGY_MAX, state.energy + gain);
        state.energyAt += gain * ENERGY_MS;
        if (state.energy >= ENERGY_MAX) state.energyAt = now;
      }
    }
  }

  function addMemory(title, text, icon = "paw") {
    state.memories.unshift({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title,
      text,
      icon,
      at: Date.now(),
      stage: stageIndex(),
      dogStage: stageIndex(),
      outfit: { ...state.outfit },
    });
    state.memories = state.memories.slice(0, 80);
  }

  function addXp(amount) {
    if (!state.adopted) return;
    const before = stageIndex();
    state.xp = Math.max(0, state.xp + amount);
    const after = stageIndex();
    if (after > before) {
      const st = STAGES[after];
      addMemory(`进入${st.name}`, `${state.name} 长成了${st.name}。${st.unlock}`, "star");
      queueCelebration(() => showStageUp(after));
    }
  }

  function addBond(amount) {
    const before = bondLevel();
    state.bond = clamp(state.bond + amount, 0, 100);
    const after = bondLevel();
    if (after > before) {
      bridge.toast(`亲密度升到 Lv.${after}`);
      const unlocked = ITEMS.filter((a) => a.level > before && a.level <= after);
      unlocked.forEach((a, i) => {
        setTimeout(() => bridge.toast(`解锁装扮：${a.name}`), 800 + i * 700);
        addMemory(`解锁${a.name}`, `亲密度 Lv.${a.level}，可以给 ${state.name} 戴上${a.name}了。`, "shirt");
      });
    }
  }

  function queueCelebration(fn) {
    if (!$("#raiseModal").hidden) pendingCelebration = fn;
    else setTimeout(fn, 420);
  }
  function flushCelebration() {
    if (!$("#screen-raise").classList.contains("is-active")) return;
    if (!$("#raiseModal").hidden || !pendingCelebration) return;
    const fn = pendingCelebration;
    pendingCelebration = null;
    setTimeout(fn, 260);
  }

  /* -------------------------------- Wish -------------------------------- */

  function wishDef() {
    return state.wish ? WISHES.find((w) => w.id === state.wish.id) : null;
  }
  function ensureWish(force = false) {
    const today = todayKey();
    if (!force && state.wish && state.wish.date === today && wishDef()) return state.wish;
    const pool = WISHES.filter((w) => !w.stage || stageIndex() >= w.stage);
    const def = rnd(pool);
    state.wish = { id: def.id, date: today, goal: def.goal, progress: 0, done: false };
    save();
    return state.wish;
  }
  function bumpWish(actionId) {
    const w = ensureWish();
    const def = WISHES.find((x) => x.id === w.id);
    if (!def || w.done || def.action !== actionId) return;
    w.progress = Math.min(w.goal, w.progress + 1);
    if (w.progress >= w.goal) {
      w.done = true;
      addBond(10);
      addXp(8);
      state.energy = Math.min(ENERGY_MAX, state.energy + 1);
      bridge.toast("今日心愿完成！亲密度 +10 · 成长 +8 · 精力 +1");
      sound().win();
      burst(["#ffd447", "#ff7a6b", "#ff9fc2", "#9fe0b0"], 20);
    }
  }

  function touchStreak() {
    const today = todayKey();
    if (state.lastCareDate === today) return;
    state.streak = state.lastCareDate === yesterdayKey() ? state.streak + 1 : 1;
    state.lastCareDate = today;
    state.energy = Math.min(ENERGY_MAX, state.energy + 1);
    ensureWish();
    bridge.toast(`连续照顾第 ${state.streak} 天 · 精力 +1`);
  }

  /* ------------------------------ Adoption ------------------------------ */

  function rollOffer() {
    const pool = Object.keys(DOGS);
    const out = [];
    while (out.length < 3 && out.length < pool.length) {
      const t = rnd(pool);
      if (!out.includes(t)) out.push(t);
    }
    state.offer = out;
    save();
    return out;
  }

  function renderAdoption() {
    const offer = state.offer.filter((t) => DOGS[t]);
    if (offer.length !== 3) {
      rollOffer();
      return renderAdoption();
    }
    if (selectedOffer && !offer.includes(selectedOffer)) selectedOffer = null;
    $("#raisePicks").innerHTML = offer
      .map((t) => {
        const d = DOGS[t];
        return `<button class="raise-pick${selectedOffer === t ? " is-selected" : ""}" data-offer="${t}">
          <span class="raise-pick__art">${puppyArt(t)}</span>
          <strong>${d.name}</strong>
          <small>${d.breed}</small>
          <i class="raise-pick__tick">✓</i>
        </button>`;
      })
      .join("");
    const pups = ["#adoptPupA", "#adoptPupB", "#adoptPupC"];
    pups.forEach((sel, i) => {
      const el = $(sel);
      if (!el) return;
      const t = offer[i];
      if (el.dataset.type !== t) {
        el.dataset.type = t;
        el.innerHTML = puppyArt(t);
      }
    });
    const btn = $("#raiseAdoptBtn");
    btn.disabled = !selectedOffer;
    btn.innerHTML = selectedOffer
      ? '<svg><use href="#i-paw"/></svg><span>就是你了</span>'
      : '<svg><use href="#i-paw"/></svg><span>先选一只</span>';
    $("#raiseTrait").textContent = selectedOffer
      ? `${DOGS[selectedOffer].name} · ${DOGS[selectedOffer].breed} —— ${DOGS[selectedOffer].trait}`
      : "先选一只你喜欢的小狗吧。";
  }

  function selectOffer(type) {
    selectedOffer = type;
    renderAdoption();
  }

  function openNameModal(type, rename = false) {
    pendingNameType = type;
    pendingRename = rename;
    const d = DOGS[type];
    const current = rename ? state.name : d.name;
    const suggestions = [];
    while (suggestions.length < 3) {
      const n = rnd(NAMES);
      if (!suggestions.includes(n)) suggestions.push(n);
    }
    openModal(
      `<div class="raise-name">
        <span class="raise-name__art">${puppyArt(type)}</span>
        <p class="raise-name__kicker">${rename ? "NEW NAME" : "NEW FRIEND"}</p>
        <h3 id="raiseModalTitle">${rename ? "给它改个名字" : "给新伙伴取个名字"}</h3>
        <p class="raise-name__copy">${rename ? `现在是 ${esc(state.name)}。` : `它是一只${d.breed}，${d.trait}。`}</p>
        <input class="raise-name__input" id="raiseNameInput" maxlength="10" value="${esc(current)}" aria-label="狗狗名字" autocomplete="off">
        <div class="raise-name__suggest">${suggestions.map((n) => `<button data-name-suggest="${n}">${n}</button>`).join("")}</div>
        <div class="raise-modal__row">
          <button class="btn btn--soft" data-raise-modal-close>再想想</button>
          <button class="btn btn--primary" data-name-confirm>${rename ? "保存" : "带它回家"}</button>
        </div>
      </div>`,
      { className: "raise-modal--name" }
    );
  }

  function confirmName() {
    const input = $("#raiseNameInput");
    const raw = input ? input.value.trim().slice(0, 10) : "";
    const name = raw || DOGS[pendingNameType].name;
    if (pendingRename) {
      state.name = name;
      save();
      closeModal({ force: true });
      render();
      bridge.toast("名字改好啦");
      return;
    }
    adopt(pendingNameType, name);
  }

  function adopt(type, name) {
    if (!DOGS[type]) return;
    state.adopted = true;
    state.dog = type;
    state.name = name;
    state.startedAt = Date.now();
    state.xp = 0;
    state.bond = 5;
    state.needs = { hunger: 70, mood: 76, clean: 70 };
    state.energy = 8;
    state.energyAt = Date.now();
    state.lastTick = Date.now();
    state.lastDecay = Date.now();
    state.cooldowns = {};
    state.training = 0;
    state.tricks = [];
    state.outfit = RA.emptyOutfit();
    state.memories = [];
    state.wish = null;
    state.streak = 1;
    state.lastCareDate = todayKey();
    state.totalCare = 0;
    state.offer = [];
    state.walks = 0;
    state.lastWalk = null;
    addMemory("第一次见面", `把 ${name} 带回了成长小屋。`, "paw");
    ensureWish(true);
    save();
    closeModal({ force: true });
    selectedOffer = null;
    render();
    updateHome();
    setTimeout(() => showWelcome(), 350);
  }

  function showWelcome() {
    openModal(
      `<div class="raise-celebrate">
        <span class="raise-celebrate__art">${dogArt()}</span>
        <p class="raise-celebrate__kicker">WELCOME HOME</p>
        <h3 id="raiseModalTitle">${esc(state.name)} 跟你回家了</h3>
        <p class="raise-celebrate__copy">从今天起，你负责喂饱它、陪它玩、带它看世界。它会慢慢长大的。</p>
        <button class="btn btn--primary btn--xl" data-raise-modal-close>开始照顾它</button>
      </div>`,
      { className: "raise-modal--celebrate" }
    );
    sound().win();
    burst(["#ffd447", "#ff7a6b", "#ff9fc2", "#9fe0b0"], 24);
  }

  function showStageUp(si) {
    const st = STAGES[si];
    const extra =
      si === 1
        ? "解锁了散步和训练，还可以带它出门遇见各种小事。"
        : "解锁了全部才艺，亲密度继续提升还能佩戴更多配饰。";
    openModal(
      `<div class="raise-celebrate">
        <span class="raise-celebrate__art">${dogArt(si)}</span>
        <p class="raise-celebrate__kicker">LEVEL UP</p>
        <h3 id="raiseModalTitle">${esc(state.name)} 长大了！</h3>
        <p class="raise-celebrate__copy">现在是${st.name}。${extra}</p>
        <button class="btn btn--primary btn--xl" data-raise-modal-close>继续陪你长大</button>
      </div>`,
      { className: "raise-modal--celebrate" }
    );
    sound().win();
    burst(["#ffd447", "#ff7a6b", "#ff9fc2", "#9fe0b0"], 28);
  }

  /* ------------------------------- Effects ------------------------------ */

  function burst(colors = ["#ff7a6b", "#ffd447", "#ff9fc2", "#9fe0b0"], count = 16) {
    if (!fx) return;
    const pet = $("#raisePet");
    const scene = $("#raiseScene");
    if (!pet || !scene) return;
    const p = pet.getBoundingClientRect();
    const s = scene.getBoundingClientRect();
    fx.spawn(p.left - s.left + p.width / 2, p.top - s.top + p.height * 0.42, colors, count, 1.15);
  }
  function burstHearts() {
    burst(["#ff7a6b", "#ff9fc2", "#ffd447"], 14);
  }

  let speechTimer = 0;
  function say(text, ms = 2400) {
    const bubble = $("#raiseSpeech");
    const label = $("#raiseSpeechText");
    if (!bubble || !label) return;
    label.textContent = text;
    ui.speechUntil = Date.now() + ms;
    bubble.classList.remove("is-pop");
    void bubble.offsetWidth;
    bubble.classList.add("is-pop");
    clearTimeout(speechTimer);
    speechTimer = setTimeout(() => {
      ui.speechUntil = 0;
      bubble.classList.remove("is-pop");
      renderSpeech();
    }, ms);
  }

  const NEUTRAL_LINES = {
    0: ["我会快快长大的！", "今天也要抱抱～", "这个家闻起来真安心。", "肚子软软的，想睡觉。"],
    1: ["我已经是大孩子啦！", "今天去哪里散步？", "我学会新本领了！", "陪我玩一会儿嘛。"],
    2: ["我在这个家好开心。", "今天也要一起出门吗？", "我可是才艺小明星。", "你回来啦，我等好久。"],
  };
  function renderSpeech() {
    const label = $("#raiseSpeechText");
    if (!label) return;
    if (!state.adopted) return;
    if (Date.now() < (ui.speechUntil || 0)) return;
    if (state.energy <= 0) {
      label.textContent = "好困呀…想休息一下。";
      return;
    }
    if (state.needs.hunger < 25) {
      label.textContent = "肚子咕咕叫…想吃点东西。";
      return;
    }
    if (state.needs.clean < 25) {
      label.textContent = "身上痒痒的，想洗澡。";
      return;
    }
    if (state.needs.mood < 25) {
      label.textContent = "陪陪我嘛…";
      return;
    }
    const lines = NEUTRAL_LINES[stageIndex()];
    const n = Math.floor(state.totalCare / 3) % lines.length;
    label.textContent = lines[n];
  }

  function moodName() {
    return state.needs.mood >= 70 && state.needs.hunger >= 40 ? "joy" : "def";
  }
  function currentMood() {
    return Date.now() < ui.moodHold ? ui.mood || "def" : moodName();
  }
  function applyMood() {
    if (Date.now() < ui.moodHold) return;
    const pet = $("#raisePet");
    if (!pet) return;
    const svg = pet.querySelector(".raise-dog");
    if (svg) svg.dataset.mood = moodName();
    pet.classList.toggle("is-low", state.needs.mood < 25 || state.needs.hunger < 20);
  }
  function setMood(mood, ms = 1200) {
    const pet = $("#raisePet");
    if (!pet) return;
    const svg = pet.querySelector(".raise-dog");
    if (svg) svg.dataset.mood = mood;
    pet.classList.remove("hop");
    void pet.offsetWidth;
    pet.classList.add("hop");
    ui.mood = mood;
    ui.moodHold = Date.now() + ms;
    setTimeout(() => {
      ui.moodHold = 0;
      ui.mood = "";
      applyMood();
    }, ms + 60);
  }

  /* ------------------------------- Render ------------------------------- */

  function render() {
    const adopted = state.adopted && DOGS[state.dog];
    $("#raiseAdopt").hidden = Boolean(adopted);
    $("#raiseMain").hidden = !adopted;
    $("#raiseChip").hidden = !adopted;
    if (!adopted) {
      ensureNoPetUi();
      renderAdoption();
      return;
    }
    applyTime();
    const si = stageIndex();
    const st = STAGES[si];

    $("#raiseChipText").textContent = `第 ${dayCount()} 天`;
    $("#raiseStageChip").textContent = st.name;
    $("#raiseStageName").textContent = st.name;
    $("#raiseXpText").textContent = si >= 2 ? `${Math.round(state.xp)} 成长值` : `${Math.round(state.xp)} / ${st.next}`;
    $("#raiseXpFill").style.width = `${progressPct()}%`;
    $("#raiseStageHint").textContent =
      si >= 2 ? "已经长成大狗啦，继续攒成长值、刷满亲密度吧。" : `再获得 ${Math.max(0, Math.round(st.next - state.xp))} 点成长值，就会进入${STAGES[si + 1].name}。`;
    $$("#raiseStages span").forEach((el) => {
      const s = Number(el.dataset.stage);
      el.classList.toggle("is-on", s === si);
      el.classList.toggle("is-done", s < si);
    });
    $$("#raiseStages i").forEach((el, i) => el.classList.toggle("is-done", i < si));

    $("#raisePetName").textContent = state.name;
    $("#raisePetMeta").textContent = `亲密度 Lv.${bondLevel()} · 才艺 ${state.tricks.length}/${TRICKS.length}`;

    const pet = $("#raisePet");
    const petKey = `${state.dog}|${si}|${outfitKey()}`;
    if (ui.petKey !== petKey) {
      ui.petKey = petKey;
      pet.innerHTML = dogArt(si, currentMood());
    }
    pet.setAttribute("aria-label", `摸摸 ${state.name}`);
    const scene = $("#raiseScene");
    if (scene) scene.dataset.stage = String(si);
    applyMood();
    renderSpeech();

    renderNeeds();
    renderWish();
    renderActions();
    renderTricks();
    renderDiary();
    updateHome();
  }

  function renderNeeds() {
    const rows = [
      ["hunger", "HungerVal", "HungerFill"],
      ["mood", "MoodVal", "MoodFill"],
      ["clean", "CleanVal", "CleanFill"],
    ];
    rows.forEach(([key, valId, fillId]) => {
      const v = clamp(state.needs[key], 0, 100);
      const val = $(`#need${valId}`);
      const fill = $(`#need${fillId}`);
      if (!val || !fill) return;
      val.textContent = String(Math.round(v));
      fill.style.width = `${v}%`;
      const card = $(`.raise-need[data-need="${key}"]`);
      card && card.classList.toggle("is-low", v < 25);
      card && card.classList.toggle("is-mid", v >= 25 && v < 55);
    });
    $("#needEnergyVal").textContent = `${state.energy} / ${ENERGY_MAX}`;
    $("#needEnergyFill").style.width = `${(state.energy / ENERGY_MAX) * 100}%`;
    const energyCard = $('.raise-need[data-need="energy"]');
    energyCard && energyCard.classList.toggle("is-low", state.energy <= 0);
    const rest = $("#raiseRest");
    if (rest) {
      const left = cdLeft("rest");
      rest.disabled = state.energy >= ENERGY_MAX || left > 0;
      rest.querySelector("span").textContent = left > 0 ? fmtCd(left) : state.energy >= ENERGY_MAX ? "精神满满" : "休息";
    }
  }

  function renderWish() {
    const w = ensureWish();
    const def = WISHES.find((x) => x.id === w.id);
    if (!def) return;
    $("#raiseWish").classList.toggle("is-done", w.done);
    $("#raiseWishText").textContent = `${def.label.replace("{n}", w.goal)} · ${w.progress}/${w.goal}`;
    $("#raiseWishFill").style.width = `${Math.min(100, (w.progress / w.goal) * 100)}%`;
    $("#raiseWishReward").textContent = w.done ? "已达成 ✓" : "+亲密度 · +成长";
  }

  function actionDisabled(id, a) {
    if (a.stage && stageIndex() < a.stage) return true;
    if (cdLeft(id) > 0) return true;
    if (state.energy < a.cost) return true;
    return false;
  }

  function renderActions() {
    const si = stageIndex();
    const sig = [
      si,
      state.energy,
      ...Object.keys(ACTIONS).map((id) => Math.ceil(cdLeft(id) / 1000)),
    ].join("|");
    if (ui.actionSig === sig) return;
    ui.actionSig = sig;
    $("#raiseActions").innerHTML = Object.entries(ACTIONS)
      .map(([id, a]) => {
        const locked = a.stage && si < a.stage;
        const left = cdLeft(id);
        const noEnergy = state.energy < a.cost;
        const disabled = actionDisabled(id, a);
        let hint = a.cost ? `精力 -${a.cost}` : "不耗精力";
        if (locked) hint = a.stage === 1 ? "少年期解锁" : "成年期解锁";
        let overlay = "";
        if (left > 0 && !locked) overlay = `<i class="raise-act__cd">${fmtCd(left)}</i>`;
        else if (noEnergy && !locked) overlay = '<i class="raise-act__cd">精力不足</i>';
        return `<button class="raise-act${locked ? " is-locked" : ""}" data-raise-act="${id}" ${disabled ? "disabled" : ""}>
          <span class="raise-act__icon"><svg><use href="#i-${a.icon}"/></svg></span>
          <strong>${a.name}</strong>
          <small>${hint}</small>
          ${overlay}
        </button>`;
      })
      .join("");
  }

  function renderTricks() {
    const learned = TRICKS.filter((t) => state.tricks.includes(t.id));
    const head = `<div class="raise-tricks__head"><b>才艺</b><span>${learned.length} / ${TRICKS.length}</span></div>`;
    const body = learned.length
      ? `<div class="raise-tricks__list">${learned.map((t) => `<button class="raise-trick" data-raise-trick="${t.id}">${t.name}</button>`).join("")}</div>`
      : `<p class="raise-tricks__empty">${
          stageIndex() < 1 ? "长到少年期后，就能去训练学才艺了。" : "去训练，让它学会第一个才艺吧。"
        }</p>`;
    $("#raiseTricks").innerHTML = head + body;
  }

  function renderDiary() {
    const rows = state.memories
      .slice(0, 3)
      .map(
        (m) => `<li><span class="raise-diary__dot"><svg><use href="#i-${m.icon || "paw"}"/></svg></span><div><b>${esc(
          m.title
        )}</b><span>${dateLabel(m.at)}</span></div></li>`
      )
      .join("");
    $("#raiseDiary").innerHTML = `<div class="raise-diary__head"><b>成长日记</b><button data-raise-open="album">全部记录</button></div><ul class="raise-diary__list">${
      rows || '<li class="raise-diary__empty">还没有记录，先陪它做点什么吧。</li>'
    }</ul>`;
  }

  function ensureNoPetUi() {
    ui.actionSig = "";
    ui.petKey = "";
  }

  /* ------------------------------- Actions ------------------------------ */

  function doAction(id) {
    const a = ACTIONS[id];
    if (!a || !state.adopted) return;
    if (a.stage && stageIndex() < a.stage) {
      sound().invalid();
      bridge.toast(a.stage === 1 ? "再长大一点，就能解锁啦" : "成年后才能做这个");
      return;
    }
    const left = cdLeft(id);
    if (left > 0) {
      sound().invalid();
      bridge.toast(`还要等 ${fmtCd(left)}`);
      return;
    }
    if (state.energy < a.cost) {
      sound().invalid();
      bridge.toast("精力不够，点上面的「休息」睡一觉吧");
      return;
    }
    if (id === "feed" && state.needs.hunger >= 96) {
      bridge.toast("肚子已经圆滚滚啦");
      return;
    }
    if (id === "bath" && state.needs.clean >= 96) {
      bridge.toast("现在香喷喷的，不用洗啦");
      return;
    }

    state.energy -= a.cost;
    state.cooldowns[id] = Date.now() + a.cd;
    state.totalCare += 1;
    touchStreak();
    bumpWish(id);

    if (id === "play") {
      save();
      openPlayGame();
      render();
      return;
    }
    if (id === "walk") {
      save();
      openWalk();
      render();
      return;
    }
    if (id === "train") {
      save();
      openTrainGame();
      render();
      return;
    }

    if (id === "feed") {
      state.needs.hunger = clamp(state.needs.hunger + 30, 0, 100);
      state.needs.mood = clamp(state.needs.mood + 3, 0, 100);
      addXp(5);
      addBond(2);
      say(rnd(a.lines));
      setMood("joy", 1300);
      burst(["#ffd447", "#ff9fc2", "#9fe0b0"], 16);
      sound().match(1);
    } else if (id === "pet") {
      state.needs.mood = clamp(state.needs.mood + 6, 0, 100);
      addXp(2);
      addBond(3);
      say(rnd(a.lines));
      setMood("joy", 1200);
      burstHearts();
      sound().select();
    } else if (id === "bath") {
      state.needs.clean = 100;
      state.needs.mood = clamp(state.needs.mood + 3, 0, 100);
      addXp(6);
      addBond(2);
      say(rnd(a.lines));
      setMood("joy", 1600);
      burst(["#7fd6ff", "#ffffff", "#9fe0b0", "#ffd447"], 20);
      sound().match(2);
    }

    render();
    save();
    setTimeout(flushCelebration, 240);
  }

  function rest() {
    if (!state.adopted) return;
    const left = cdLeft("rest");
    if (left > 0) {
      bridge.toast(`刚睡过，等 ${fmtCd(left)} 再来吧`);
      sound().invalid();
      return;
    }
    if (state.energy >= ENERGY_MAX) {
      bridge.toast("精神满满，不用休息啦");
      sound().select();
      return;
    }
    state.energy = ENERGY_MAX;
    state.energyAt = Date.now();
    state.cooldowns.rest = Date.now() + 90 * 60 * 1000;
    state.needs.mood = clamp(state.needs.mood + 4, 0, 100);
    addXp(3);
    addBond(1);
    touchStreak();
    say("呼…呼…", 2400);
    setMood("def", 1800);
    const scene = $("#raiseScene");
    scene.classList.add("is-sleeping");
    setTimeout(() => scene.classList.remove("is-sleeping"), 2200);
    sound().select();
    render();
    save();
  }

  function petTap() {
    if (!state.adopted) return;
    state.needs.mood = clamp(state.needs.mood + 1, 0, 100);
    state.totalCare += 1;
    sound().select();
    setMood("joy", 900);
    burstHearts();
    say(rnd(["嘿嘿～", "再摸摸～", "好舒服～", "今天也最喜欢你。"]), 1600);
    render();
    save();
  }

  function performTrick(id) {
    const t = TRICKS.find((x) => x.id === id);
    if (!t || !state.tricks.includes(id)) return;
    sound().match(2);
    setMood("joy", 1500);
    burst(["#ffd447", "#ff9fc2", "#9fe0b0"], 18);
    say(`${t.name}！`, 1800);
    const row = $("#raiseTricks");
    row.classList.add("is-performing");
    setTimeout(() => row.classList.remove("is-performing"), 900);
  }

  /* ------------------------------- Walking ------------------------------ */

  function openWalk() {
    const pool = WALK_EVENTS.filter((e) => e.id !== state.lastWalk);
    const ev = rnd(pool.length ? pool : WALK_EVENTS);
    state.lastWalk = ev.id;
    state.walks += 1;
    openModal(
      `<div class="raise-story">
        <div class="raise-story__scene">
          ${RA.parkSVG()}
          <span class="raise-story__pet">${dogArt()}</span>
        </div>
        <p class="raise-story__kicker">WALK TIME</p>
        <h3 id="raiseModalTitle">${ev.title}</h3>
        <p class="raise-story__copy">${ev.text}</p>
        <div class="raise-story__choices">
          ${ev.choices.map((c, i) => `<button class="raise-choice" data-walk-choice="${i}">${c.label}</button>`).join("")}
        </div>
      </div>`,
      { locked: true, className: "raise-modal--story" }
    );
    sound().select();
  }

  function resolveWalk(index) {
    const ev = WALK_EVENTS.find((e) => e.id === state.lastWalk);
    if (!ev || !ev.choices[index]) return;
    const choice = ev.choices[index];
    const delta = choice.delta || {};
    state.needs.hunger = clamp(state.needs.hunger + (WALK_BASE.hunger + (delta.hunger || 0)), 0, 100);
    state.needs.mood = clamp(state.needs.mood + (WALK_BASE.mood + (delta.mood || 0)), 0, 100);
    state.needs.clean = clamp(state.needs.clean + (WALK_BASE.clean + (delta.clean || 0)), 0, 100);
    addXp(WALK_BASE.xp + (delta.xp || 0));
    addBond(WALK_BASE.bond + (delta.bond || 0));
    if (state.walks === 1) addMemory("第一次散步", `${state.name} 第一次和你一起出门，看到了好多新鲜事。`, "map");
    sound().match(2);
    burstHearts();
    const panel = $("#raiseModalPanel");
    panel.innerHTML = `<div class="raise-story raise-story--result">
      <span class="raise-story__art">${dogArt()}</span>
      <p class="raise-story__kicker">GOOD WALK</p>
      <h3 id="raiseModalTitle">${ev.title}</h3>
      <p class="raise-story__copy">${choice.outcome}</p>
      <div class="raise-reward-row">
        <span>心情 +${Math.round(WALK_BASE.mood + (delta.mood || 0))}</span>
        <span>亲密 +${Math.round(WALK_BASE.bond + (delta.bond || 0))}</span>
        <span>成长 +${WALK_BASE.xp}</span>
      </div>
      <button class="btn btn--primary btn--xl" data-raise-finish>回家啦</button>
    </div>`;
    modalLocked = true;
    render();
    save();
  }

  /* ------------------------------ Mini games ---------------------------- */

  function cleanupMini() {
    if (!mini) return;
    if (mini.raf) cancelAnimationFrame(mini.raf);
    if (mini.timer) clearInterval(mini.timer);
    mini = null;
  }

  function openPlayGame() {
    openModal(
      `<div class="raise-mini">
        <div class="raise-mini__head"><h3 id="raiseModalTitle">接住小球</h3><span id="miniClock">10.0s</span></div>
        <p class="raise-mini__hint">点中飞来飞去的小球，接住 3 个！</p>
        <div class="raise-mini__stage" id="miniStage">
          <button class="raise-mini__ball" id="miniBall" aria-label="接球"><svg><use href="#i-ball"/></svg></button>
          <span class="raise-mini__pet">${dogArt()}</span>
        </div>
        <p class="raise-mini__score" id="miniScore">0 / 3</p>
        <button class="raise-mini__cancel" data-raise-mini-cancel>今天先不玩</button>
      </div>`,
      { locked: true, className: "raise-modal--mini" }
    );
    mini = {
      kind: "play",
      raf: 0,
      timer: 0,
      hits: 0,
      target: 3,
      started: performance.now(),
      deadline: Date.now() + 10000,
      finished: false,
    };
    const ball = $("#miniBall");
    const stage = $("#miniStage");
    ball.addEventListener("click", catchBall);
    const loop = (now) => {
      if (!mini || mini.kind !== "play" || mini.finished) return;
      const w = Math.max(1, stage.clientWidth - 58);
      const h = Math.max(1, stage.clientHeight - 66);
      const t = (now - mini.started) / 1000;
      const x = w / 2 + Math.sin(t * 2.15) * w * 0.44;
      const y = h / 2 + Math.cos(t * 2.7) * h * 0.36;
      ball.style.transform = `translate(${x}px, ${y}px)`;
      const left = Math.max(0, (mini.deadline - Date.now()) / 1000);
      const clock = $("#miniClock");
      if (clock) clock.textContent = `${left.toFixed(1)}s`;
      if (left <= 0) {
        finishPlay(false);
        return;
      }
      mini.raf = requestAnimationFrame(loop);
    };
    mini.raf = requestAnimationFrame(loop);
    sound().select();
  }

  function catchBall() {
    if (!mini || mini.kind !== "play" || mini.finished) return;
    mini.hits += 1;
    const score = $("#miniScore");
    if (score) score.textContent = `${mini.hits} / ${mini.target}`;
    sound().select();
    const ball = $("#miniBall");
    ball.classList.remove("is-caught");
    void ball.offsetWidth;
    ball.classList.add("is-caught");
    if (mini.hits >= mini.target) {
      mini.finished = true;
      setTimeout(() => finishPlay(true), 220);
    }
  }

  function finishPlay(success) {
    if (!mini || mini.kind !== "play") return;
    cleanupMini();
    const gained = success ? { xp: 10, mood: 14, bond: 4 } : { xp: 4, mood: 5, bond: 1 };
    state.needs.mood = clamp(state.needs.mood + gained.mood, 0, 100);
    addXp(gained.xp);
    addBond(gained.bond);
    save();
    render();
    if (success) sound().win();
    else sound().select();
    openModal(
      `<div class="raise-result">
        <span class="raise-result__art">${dogArt()}</span>
        <p class="raise-result__kicker">${success ? "FETCH!" : "GOOD TRY"}</p>
        <h3 id="raiseModalTitle">${success ? "接住啦！" : "跑累了～"}</h3>
        <p class="raise-result__copy">${
          success ? `${esc(state.name)} 追着小球转了好几圈，尾巴停不下来。` : `${esc(state.name)} 玩得很开心，下次还能接得更准。`
        }</p>
        <div class="raise-reward-row"><span>心情 +${gained.mood}</span><span>亲密 +${gained.bond}</span><span>成长 +${gained.xp}</span></div>
        <button class="btn btn--primary btn--xl" data-raise-finish>收下奖励</button>
      </div>`,
      { locked: true, className: "raise-modal--result" }
    );
    modalLocked = true;
  }

  function openTrainGame() {
    openModal(
      `<div class="raise-mini raise-mini--train">
        <div class="raise-mini__head"><h3 id="raiseModalTitle">听口令</h3><span id="trainCount">0 / 3</span></div>
        <p class="raise-mini__hint">指针进入金色区域时点「现在！」，三局两胜。</p>
        <div class="raise-mini__stage raise-mini__stage--train" id="miniStage">
          <div class="raise-train__bar">
            <span class="raise-train__zone" id="trainZone"></span>
            <i class="raise-train__needle" id="trainNeedle"></i>
          </div>
          <span class="raise-train__pet">${dogArt()}</span>
        </div>
        <p class="raise-mini__status" id="trainStatus">第 1 / 3 次</p>
        <button class="raise-train__tap" id="trainTap">现在！</button>
        <button class="raise-mini__cancel" data-raise-mini-cancel>下次再练</button>
      </div>`,
      { locked: true, className: "raise-modal--mini" }
    );
    mini = {
      kind: "train",
      raf: 0,
      round: 0,
      wins: 0,
      pos: 0,
      dir: 1,
      speed: 0.82,
      zoneStart: 0.38,
      zoneWidth: 0.24,
      phase: "wait",
      last: performance.now(),
    };
    const tap = $("#trainTap");
    tap.addEventListener("click", trainTap);
    newTrainRound();
    const loop = (now) => {
      if (!mini || mini.kind !== "train") return;
      if (mini.phase === "run") {
        const dt = Math.min((now - mini.last) / 1000, 0.05);
        mini.last = now;
        mini.pos += mini.dir * mini.speed * dt;
        if (mini.pos >= 1) {
          mini.pos = 1;
          mini.dir = -1;
        } else if (mini.pos <= 0) {
          mini.pos = 0;
          mini.dir = 1;
        }
        const needle = $("#trainNeedle");
        if (needle) needle.style.left = `${mini.pos * 100}%`;
      }
      mini.raf = requestAnimationFrame(loop);
    };
    mini.raf = requestAnimationFrame(loop);
    sound().select();
  }

  function newTrainRound() {
    if (!mini || mini.kind !== "train") return;
    mini.phase = "run";
    mini.last = performance.now();
    mini.round += 1;
    mini.zoneWidth = Math.max(0.16, 0.26 - mini.round * 0.025);
    mini.zoneStart = 0.1 + Math.random() * (0.8 - mini.zoneWidth);
    const zone = $("#trainZone");
    if (zone) {
      zone.style.left = `${mini.zoneStart * 100}%`;
      zone.style.width = `${mini.zoneWidth * 100}%`;
    }
    const count = $("#trainCount");
    if (count) count.textContent = `${mini.round} / 3`;
    const status = $("#trainStatus");
    if (status) status.textContent = `第 ${mini.round} / 3 次`;
    const tap = $("#trainTap");
    if (tap) tap.disabled = false;
  }

  function trainTap() {
    if (!mini || mini.kind !== "train" || mini.phase !== "run") return;
    mini.phase = "wait";
    const hit = mini.pos >= mini.zoneStart && mini.pos <= mini.zoneStart + mini.zoneWidth;
    if (hit) {
      mini.wins += 1;
      sound().match(2);
      burstHearts();
    } else {
      sound().invalid();
    }
    const status = $("#trainStatus");
    if (status) status.textContent = hit ? "太棒了！就是这个时机！" : "差一点…再来一次。";
    const tap = $("#trainTap");
    if (tap) tap.disabled = true;
    const round = mini.round;
    setTimeout(() => {
      if (!mini || mini.kind !== "train") return;
      if (round >= 3) finishTrain();
      else newTrainRound();
    }, 760);
  }

  function finishTrain() {
    if (!mini || mini.kind !== "train") return;
    const wins = mini.wins;
    cleanupMini();
    const success = wins >= 2;
    const gained = success ? { xp: 10, bond: 3 } : { xp: 3, bond: 1 };
    if (success) state.training += 1;
    addXp(gained.xp);
    addBond(gained.bond);
    const fresh = TRICKS.filter((t) => state.training >= t.at && !state.tricks.includes(t.id));
    fresh.forEach((t) => {
      state.tricks.push(t.id);
      addMemory(`学会${t.name}`, `${state.name} 在训练中学会了「${t.name}」。`, "star");
    });
    save();
    render();
    if (success) {
      sound().win();
      if (fresh.length) setTimeout(() => bridge.toast(`新才艺：${fresh.map((t) => t.name).join("、")}`), 500);
    } else {
      sound().select();
    }
    openModal(
      `<div class="raise-result">
        <span class="raise-result__art">${dogArt()}</span>
        <p class="raise-result__kicker">${success ? "GOOD JOB" : "KEEP TRYING"}</p>
        <h3 id="raiseModalTitle">${success ? "训练完成！" : "今天有点分心"}</h3>
        <p class="raise-result__copy">${
          success
            ? `${esc(state.name)} 完成了 ${wins}/3 次口令${fresh.length ? `，还学会了${fresh.map((t) => t.name).join("、")}` : "，动作越来越熟练了"}。`
            : `${esc(state.name)} 只做对了 ${wins}/3 次。休息一下，下次再来吧。`
        }</p>
        <div class="raise-reward-row"><span>亲密 +${gained.bond}</span><span>成长 +${gained.xp}</span>${
          fresh.length ? `<span>新才艺 +${fresh.length}</span>` : ""
        }</div>
        <button class="btn btn--primary btn--xl" data-raise-finish>收下奖励</button>
      </div>`,
      { locked: true, className: "raise-modal--result" }
    );
    modalLocked = true;
  }

  /* -------------------------------- Modal ------------------------------- */

  function openModal(html, { locked = false, className = "", onClose = null } = {}) {
    const modal = $("#raiseModal");
    const panel = $("#raiseModalPanel");
    if (!modal || !panel) return;
    ui.modalToken += 1;
    const token = ui.modalToken;
    modalLocked = locked;
    modalCloseCb = onClose;
    panel.className = `raise-modal__panel ${className}`;
    panel.innerHTML = html;
    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add("is-open"));
    setTimeout(() => {
      if (token !== ui.modalToken) return;
      const input = panel.querySelector("input");
      if (input) {
        input.focus({ preventScroll: true });
        try {
          input.select();
        } catch (e) {
          /* noop */
        }
      }
    }, 220);
  }

  function closeModal({ force = false } = {}) {
    const modal = $("#raiseModal");
    if (!modal || modal.hidden) return false;
    if (modalLocked && !force) return false;
    cleanupMini();
    modalLocked = false;
    ui.modalToken += 1;
    const token = ui.modalToken;
    modal.classList.remove("is-open");
    const cb = modalCloseCb;
    modalCloseCb = null;
    setTimeout(() => {
      if (token !== ui.modalToken) return;
      if (!modal.classList.contains("is-open")) {
        modal.hidden = true;
        $("#raiseModalPanel").innerHTML = "";
      }
    }, 260);
    if (cb) cb();
    setTimeout(flushCelebration, 320);
    return true;
  }

  /* -------------------------------- Sheets ------------------------------ */

  function openAlbum() {
    const shown = state.memories.slice(0, 40);
    const cards = shown
      .map((m) => {
        const stage = Number.isInteger(m.dogStage) ? m.dogStage : Number.isInteger(m.stage) ? m.stage : stageIndex();
        const outfit = m.outfit || state.outfit;
        return `<article class="raise-memory">
          <span class="raise-memory__art">${RA.dogBodySVG(state.dog, stage, { outfit, mood: "joy" })}</span>
          <div class="raise-memory__body"><b>${esc(m.title)}</b><p>${esc(m.text)}</p><span>${dateLabel(m.at)}</span></div>
        </article>`;
      })
      .join("");
    openModal(
      `<div class="raise-sheet">
        <div class="raise-sheet__head"><h3 id="raiseModalTitle">成长相册</h3><button class="raise-sheet__close" data-raise-modal-close aria-label="关闭">×</button></div>
        <p class="raise-sheet__sub">${esc(state.name)} · 第 ${dayCount()} 天 · 亲密度 Lv.${bondLevel()} · 才艺 ${state.tricks.length}/${TRICKS.length}</p>
        <div class="raise-sheet__tools"><button data-raise-rename>改名</button><button data-raise-reset>重新领养</button></div>
        <div class="raise-memories">${cards || '<p class="raise-empty">还没有照片，陪它多经历一些吧。</p>'}</div>
        ${state.memories.length > 40 ? '<p class="raise-sheet__note">只展示最近 40 条记录</p>' : ""}
      </div>`,
      { className: "raise-modal--sheet" }
    );
  }

  function dressTabMarkup() {
    return SLOTS.map(
      (s) => `<button class="raise-slot${s.id === dressSlot ? " is-on" : ""}" data-dress-slot="${s.id}"><span>${s.emoji}</span>${s.name}</button>`
    ).join("");
  }

  function dressItemsMarkup() {
    const level = bondLevel();
    return ITEMS.filter((i) => i.slot === dressSlot)
      .map((item) => {
        const locked = level < item.level;
        const on = state.outfit[item.slot] === item.id;
        return `<button class="raise-wardrobe__item${on ? " is-on" : ""}${locked ? " is-locked" : ""}" data-accessory="${item.id}" ${locked ? "disabled" : ""}>
          <span class="raise-wardrobe__icon">${RA.itemIconSVG(item.id)}</span>
          <strong>${item.name}</strong>
          <small>${locked ? `亲密度 Lv.${item.level} 解锁` : on ? "正在佩戴" : "点击换上"}</small>
        </button>`;
      })
      .join("");
  }

  function dressPreviewMarkup() {
    return `<span class="raise-wardrobe__stage">${esc(state.name)} · ${stageInfo().name}</span>${dogArt(stageIndex(), "joy")}`;
  }

  function refreshDress() {
    const slots = $("#dressSlots");
    const items = $("#dressItems");
    const preview = $("#dressPreview");
    if (preview) preview.innerHTML = dressPreviewMarkup();
    if (slots) slots.innerHTML = dressTabMarkup();
    if (items) items.innerHTML = dressItemsMarkup();
  }

  function openDress() {
    openModal(
      `<div class="raise-wardrobe">
        <div class="raise-sheet__head"><h3 id="raiseModalTitle">装扮</h3><button class="raise-sheet__close" data-raise-modal-close aria-label="关闭">×</button></div>
        <p class="raise-sheet__sub">头部、脖子、背部、爪子和脸部都能分别搭配。亲密度越高，解锁的配饰越多。</p>
        <div class="raise-wardrobe__preview" id="dressPreview">${dressPreviewMarkup()}</div>
        <div class="raise-wardrobe__slots" id="dressSlots">${dressTabMarkup()}</div>
        <div class="raise-wardrobe__items" id="dressItems">${dressItemsMarkup()}</div>
        <button class="btn btn--soft raise-sheet__wide" data-accessory="none">全部脱下</button>
      </div>`,
      { className: "raise-modal--wardrobe" }
    );
  }

  function openTricks() {
    const rows = TRICKS.map((t) => {
      const learned = state.tricks.includes(t.id);
      return `<div class="raise-trick-card${learned ? " is-on" : ""}">
        <span class="raise-trick-card__icon"><svg><use href="#i-star"/></svg></span>
        <b>${t.name}</b>
        <small>${learned ? "已学会" : `累计训练 ${t.at} 次解锁`}</small>
      </div>`;
    }).join("");
    openModal(
      `<div class="raise-sheet">
        <div class="raise-sheet__head"><h3 id="raiseModalTitle">才艺教室</h3><button class="raise-sheet__close" data-raise-modal-close aria-label="关闭">×</button></div>
        <p class="raise-sheet__sub">成功训练会累计次数。已成功训练 ${state.training} 次。</p>
        <div class="raise-trick-grid">${rows}</div>
        <p class="raise-sheet__note">学会的才艺会出现在小屋里，点一下就能让它表演。</p>
      </div>`,
      { className: "raise-modal--sheet" }
    );
  }

  function openReset() {
    openModal(
      `<div class="raise-confirm">
        <span class="raise-confirm__art">${dogArt()}</span>
        <h3 id="raiseModalTitle">重新领养？</h3>
        <p>${esc(state.name)} 的成长值、亲密度、才艺和相册都会清空，无法恢复。</p>
        <div class="raise-modal__row">
          <button class="btn btn--soft" data-raise-modal-close>再想想</button>
          <button class="btn btn--danger" data-raise-reset-confirm>确定重新开始</button>
        </div>
      </div>`,
      { className: "raise-modal--confirm" }
    );
  }

  function resetAll() {
    cleanupMini();
    const offer = state.offer;
    state = defaults();
    state.offer = offer;
    selectedOffer = null;
    ui.petKey = "";
    ui.actionSig = "";
    save();
    closeModal({ force: true });
    render();
    updateHome();
    bridge.toast("重新开始吧，去领养一位新伙伴");
  }

  /* -------------------------------- Home -------------------------------- */

  function updateHome() {
    const art = $("#raiseHubArt");
    const meta = $("#raiseHubMeta");
    const status = $("#raiseHubStatus");
    if (!art || !meta || !status) return;
    if (state.adopted && DOGS[state.dog]) {
      const key = `${state.dog}|${stageIndex()}|${outfitKey()}`;
      if (art.dataset.key !== key) {
        art.dataset.key = key;
        art.innerHTML = dogArt(stageIndex(), "joy");
      }
      meta.textContent = `${state.name} · ${stageInfo().name} · 第 ${dayCount()} 天`;
      status.classList.add("is-on");
      status.innerHTML = `<b>${stageInfo().short}</b>`;
    } else {
      if (art.dataset.key !== "empty") {
        art.dataset.key = "empty";
        art.innerHTML = '<span class="raise-hub__placeholder"><svg><use href="#i-paw"/></svg><i>?</i></span>';
      }
      meta.textContent = "领养一只小狗，陪它从小长大";
      status.classList.remove("is-on");
      status.innerHTML = "<b>领养</b>";
    }
  }

  /* ------------------------------ Lifecycle ----------------------------- */

  function enter() {
    applyTime();
    ensureWish();
    if (!fx) {
      const canvas = $("#raiseFx");
      if (canvas) fx = new ParticleField(canvas);
    }
    render();
    updateHome();
    const scroller = $("#raiseScroll");
    if (scroller) scroller.scrollTop = 0;
    requestAnimationFrame(() => {
      if (scroller) scroller.scrollTop = 0;
      fx && fx.resize();
    });
    setTimeout(() => {
      if (scroller) scroller.scrollTop = 0;
    }, 120);
    setTimeout(flushCelebration, 400);
    if (timer) clearInterval(timer);
    ticks = 0;
    timer = setInterval(() => {
      if (!$("#screen-raise").classList.contains("is-active")) return;
      applyTime();
      render();
      if (++ticks % 30 === 0) save();
    }, 1000);
    save();
  }

  function leave() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    save();
    if (mini) cleanupMini();
    const modal = $("#raiseModal");
    if (modal && !modal.hidden) closeModal({ force: true });
  }

  function handleBack() {
    const modal = $("#raiseModal");
    if (!modal || modal.hidden) return false;
    if (modalLocked) {
      bridge.toast("先把这一步完成吧～");
      return true;
    }
    closeModal();
    return true;
  }

  function mount(deps = {}) {
    if (deps.sound) bridge.sound = deps.sound;
    if (deps.haptic) bridge.haptic = deps.haptic;
    if (deps.toast) bridge.toast = deps.toast;
    updateHome();
  }

  /* -------------------------------- Events ------------------------------ */

  function bind() {
    document.addEventListener("click", (e) => {
      const modal = $("#raiseModal");
      const inModal = modal && !modal.hidden && modal.contains(e.target);

      const close = e.target.closest("[data-raise-modal-close]");
      if (close) {
        if (inModal) closeModal();
        return;
      }
      const suggest = e.target.closest("[data-name-suggest]");
      if (suggest) {
        const input = $("#raiseNameInput");
        if (input) input.value = suggest.dataset.nameSuggest;
        sound().select();
        return;
      }
      if (e.target.closest("[data-name-confirm]")) {
        confirmName();
        return;
      }
      if (e.target.closest("[data-raise-mini-cancel]")) {
        if (inModal) closeModal({ force: true });
        return;
      }
      if (e.target.closest("[data-raise-finish]")) {
        closeModal({ force: true });
        render();
        return;
      }
      const walkChoice = e.target.closest("[data-walk-choice]");
      if (walkChoice && inModal) {
        resolveWalk(Number(walkChoice.dataset.walkChoice));
        return;
      }
      const act = e.target.closest("[data-raise-act]");
      if (act) {
        doAction(act.dataset.raiseAct);
        return;
      }
      const open = e.target.closest("[data-raise-open]");
      if (open) {
        const kind = open.dataset.raiseOpen;
        if (!state.adopted) return;
        sound().select();
        if (kind === "album") openAlbum();
        else if (kind === "dress") openDress();
        else if (kind === "tricks") openTricks();
        return;
      }
      const trick = e.target.closest("[data-raise-trick]");
      if (trick) {
        performTrick(trick.dataset.raiseTrick);
        return;
      }
      const offer = e.target.closest("[data-offer]");
      if (offer) {
        sound().select();
        selectOffer(offer.dataset.offer);
        return;
      }
      const slotBtn = e.target.closest("[data-dress-slot]");
      if (slotBtn) {
        dressSlot = slotBtn.dataset.dressSlot;
        sound().select();
        refreshDress();
        return;
      }
      const acc = e.target.closest("[data-accessory]");
      if (acc) {
        const id = acc.dataset.accessory;
        if (id === "none") {
          state.outfit = RA.emptyOutfit();
        } else {
          const item = RA.ITEM_MAP[id];
          if (!item || bondLevel() < item.level) {
            sound().invalid();
            return;
          }
          state.outfit[item.slot] = state.outfit[item.slot] === id ? null : id;
        }
        sound().match(1);
        save();
        ui.petKey = "";
        render();
        refreshDress();
        return;
      }
      if (e.target.closest("[data-raise-rename]")) {
        openNameModal(state.dog, true);
        return;
      }
      if (e.target.closest("[data-raise-reset]")) {
        openReset();
        return;
      }
      if (e.target.closest("[data-raise-reset-confirm]")) {
        resetAll();
        return;
      }
    });

    const adoptBtn = $("#raiseAdoptBtn");
    if (adoptBtn) adoptBtn.addEventListener("click", () => {
      if (!selectedOffer) return;
      sound().select();
      openNameModal(selectedOffer, false);
    });
    const reroll = $("#raiseReroll");
    if (reroll) reroll.addEventListener("click", () => {
      sound().select();
      selectedOffer = null;
      rollOffer();
      renderAdoption();
    });
    const pet = $("#raisePet");
    if (pet) pet.addEventListener("click", petTap);
    const restBtn = $("#raiseRest");
    if (restBtn) restBtn.addEventListener("click", rest);

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) save();
      else if ($("#screen-raise").classList.contains("is-active")) {
        applyTime();
        render();
      }
    });
    window.addEventListener("pagehide", save);
  }

  bind();

  window.BellaRaise = {
    mount,
    enter,
    leave,
    handleBack,
    updateHome,
    state: () => state,
  };
})();
