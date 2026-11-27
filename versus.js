/* 汪汪消消乐 · 双人竞赛 · Supabase Realtime rooms */
(() => {
  "use strict";

  const bella = window.__bella;
  const dogs = window.BellaDogs;
  if (!bella || !dogs) return;
  const { dogSVG, DOGS } = dogs;

  const $ = (s, p = document) => p.querySelector(s);
  const $$ = (s, p = document) => [...p.querySelectorAll(s)];
  const fmt = (n) => Math.round(Number(n) || 0).toLocaleString("en-US");

  const CFG = window.BellaVersusConfig || {};
  const SUPABASE_URL = CFG.url || "";
  const SUPABASE_KEY = CFG.key || "";
  const CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_KEY && window.supabase && window.supabase.createClient);

  const PROFILE_KEY = "bella-vs-profile-v1";
  const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const PICK_DOGS = ["shiba", "golden", "bernese", "husky", "corgi", "poodle"];
  const MATCH_TIME = 60;
  const START_DELAY = 3200;
  const NOBODY_MS = 8000;
  const WAIT_DONE_MS = 15000;
  const ACTIVE_KEY = "bella-vs-active-v1";
  const REJOIN_TTL_MS = 5 * 60 * 1000;
  const DROP_WAIT_MS = 90000;
  const REJOIN_WAIT_MS = 30000;
  const SETTLE_AFTER_MS = 60000;
  const RESUME_DELAY = 2400;

  /* ------------------------------- State -------------------------------- */

  let clientId = makeId();
  let me = loadProfile();
  let joinedAt = Date.now();
  let role = "guest";
  let room = { code: "", phase: "closed", round: 0, seed: 0, connected: false };
  let rival = blankRival();
  let rivalFinal = null;
  let myFinal = null;
  let rivalOffline = false;
  let rivalQuit = false;
  let selfScore = 0;
  let lastSentScore = -1;
  let lastSentAt = 0;
  let lastLeader = "";
  let leadFlashTimer = null;
  const SEND_EVERY_MS = 250;
  let startRound = 0;
  let startingGame = false;
  let resultFinalized = false;
  let guestReadySeen = false;
  let pendingJoinCode = "";
  let setupMode = "create";
  let rematchAsked = false;
  let connecting = false;

  let channel = null;
  let sb = null;
  let tickTimer = null;
  let countdownTimer = null;
  let countdownTick = null;
  let lastCount = 0;
  let joinTimer = null;
  let helloTimer = null;
  let rivalLostTimer = null;
  let waitTimer = null;
  let copyTimer = null;
  let countdownShown = false;
  const toldFull = new Set();

  // Shared pause: { by, reason: manual | away | drop | net | rejoin, at }
  let paused = null;
  let rivalTime = null;
  let resuming = false;
  let resumeTimer = null;
  let resumeTick = null;
  let pauseTick = null;
  let dropTimer = null;
  let dropDeadline = 0;
  let quitArmed = false;
  let quitTimer = null;
  let lastSavedAt = 0;
  let rejoinRecord = null;
  let reconnectTimer = null;

  function makeId() {
    try {
      return crypto.randomUUID();
    } catch (e) {
      return `p-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }
  }

  function blankRival() {
    return { id: "", name: "", dog: "husky", role: "", state: "", round: 0, joinedAt: 0, final: null, score: 0, online: false };
  }

  function loadProfile() {
    try {
      const p = JSON.parse(localStorage.getItem(PROFILE_KEY));
      if (p && typeof p.name === "string") {
        return { name: cleanName(p.name), dog: PICK_DOGS.includes(p.dog) ? p.dog : "shiba" };
      }
    } catch (e) {
      /* first visit */
    }
    return { name: "", dog: "shiba" };
  }

  function saveProfile() {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify({ name: me.name, dog: me.dog }));
    } catch (e) {
      /* private mode */
    }
  }

  function cleanName(v) {
    return String(v || "")
      .replace(/[\u0000-\u001f\u007f<>]/g, "")
      .trim()
      .slice(0, 10);
  }

  function cleanCode(v) {
    return String(v || "")
      .toUpperCase()
      .replace(new RegExp(`[^${ALPHABET}]`, "g"), "")
      .slice(0, 4);
  }

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function makeCode() {
    const bytes = new Uint32Array(4);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(bytes);
    else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 0xffffffff);
    return [...bytes].map((n) => ALPHABET[n % ALPHABET.length]).join("");
  }

  function makeSeed() {
    return ((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0) || 7;
  }

  /* ------------------------------- Client ------------------------------- */

  function getClient() {
    if (!CONFIGURED) return null;
    if (!sb) {
      sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        realtime: { params: { eventsPerSecond: 8 } },
      });
    }
    return sb;
  }

  function presencePayload() {
    return {
      id: clientId,
      name: me.name,
      dog: me.dog,
      role,
      state: room.phase,
      round: room.round,
      joinedAt,
      final: room.phase === "done" ? myFinal : null,
    };
  }

  function updatePresence() {
    if (!channel || !room.connected) return;
    channel.track(presencePayload()).catch(() => {});
  }

  function send(event, payload) {
    if (!channel || !room.connected) return;
    channel.send({ type: "broadcast", event, payload }).catch(() => {});
  }

  function isConnected() {
    return Boolean(channel && room.connected);
  }

  async function connectChannel() {
    const c = getClient();
    if (!c) return false;
    teardownChannel();
    room.connected = false;
    const thisChannel = c.channel(`bella-vs-${room.code}`, {
      config: { presence: { key: clientId } },
    });
    channel = thisChannel;
    const guard = (fn) => (msg) => {
      if (channel === thisChannel) fn(msg);
    };
    thisChannel
      .on("presence", { event: "sync" }, guard(() => onPresence()))
      .on("broadcast", { event: "hello" }, guard(({ payload }) => onHello(payload)))
      .on("broadcast", { event: "here" }, guard(({ payload }) => onHere(payload)))
      .on("broadcast", { event: "room-full" }, guard(({ payload }) => onRoomFull(payload)))
      .on("broadcast", { event: "start" }, guard(({ payload }) => onStart(payload)))
      .on("broadcast", { event: "score" }, guard(({ payload }) => onRemoteScore(payload)))
      .on("broadcast", { event: "done" }, guard(({ payload }) => onRemoteDone(payload)))
      .on("broadcast", { event: "rematch" }, guard(({ payload }) => onRematch(payload)))
      .on("broadcast", { event: "rematch-ask" }, guard(({ payload }) => onRematchAsk(payload)))
      .on("broadcast", { event: "bye" }, guard(({ payload }) => onBye(payload)))
      .on("broadcast", { event: "pause" }, guard(({ payload }) => onRemotePause(payload)))
      .on("broadcast", { event: "resume" }, guard(({ payload }) => onRemoteResume(payload)));

    return new Promise((resolve) => {
      let settled = false;
      thisChannel.subscribe((status) => {
        if (channel !== thisChannel) return;
        if (status === "SUBSCRIBED") {
          room.connected = true;
          setConn("已连接 · 实时同步中");
          thisChannel
            .track(presencePayload())
            .then(() => {
              if (role === "guest" && room.phase === "lobby") send("hello", { from: clientId });
              if (room.phase === "playing") pushMatchState();
            })
            .catch(() => {});
          if (paused) renderPause();
          if (!settled) {
            settled = true;
            resolve(true);
          }
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          room.connected = false;
          setConn(status === "CLOSED" ? "连接已关闭" : "网络不稳定，正在重连…", true);
          if (room.phase === "playing") {
            if (resuming) cancelResume();
            if (!paused) enterPause({ by: clientId, reason: "net" });
            else renderPause();
            scheduleReconnect(3000);
          }
          if (!settled) {
            settled = true;
            resolve(false);
          }
        }
      });
      setTimeout(() => {
        if (!settled && channel === thisChannel) {
          settled = true;
          setConn("连接超时，检查一下网络", true);
          resolve(false);
        }
      }, 12000);
    });
  }

  function teardownChannel() {
    if (!channel) return;
    const ch = channel;
    channel = null;
    room.connected = false;
    try {
      ch.untrack();
    } catch (e) {
      /* already gone */
    }
    try {
      if (sb) sb.removeChannel(ch);
    } catch (e) {
      /* already gone */
    }
  }

  /* ------------------------------ Presence ------------------------------ */

  function readOthers() {
    if (!channel) return [];
    let state = {};
    try {
      state = channel.presenceState() || {};
    } catch (e) {
      return [];
    }
    const list = [];
    Object.keys(state).forEach((key) => {
      const metas = state[key];
      if (!Array.isArray(metas)) return;
      metas.forEach((m) => {
        if (!m || m.id === clientId || !m.role) return;
        list.push({ ...m, presenceKey: key });
      });
    });
    const byId = new Map();
    list.forEach((m) => {
      const prev = byId.get(m.id);
      if (!prev || (Number(m.joinedAt) || 0) >= (Number(prev.joinedAt) || 0)) byId.set(m.id, m);
    });
    return [...byId.values()].sort((a, b) => (Number(a.joinedAt) || 0) - (Number(b.joinedAt) || 0));
  }

  function onPresence() {
    if (!channel) return;
    const others = readOthers();

    // The host owns the seats: one guest in the lobby, and nobody can barge in
    // after the round has started.
    if (role === "host") {
      const busy = room.phase === "countdown" || room.phase === "playing" || room.phase === "done";
      const extras = busy && rival.id ? others.filter((o) => o.id !== rival.id) : others.slice(1);
      extras.forEach((extra) => {
        if (!toldFull.has(extra.id)) {
          toldFull.add(extra.id);
          send("room-full", { to: extra.id, reason: busy ? "比赛中" : "满员" });
        }
      });
    }

    const candidate = others[0] || null;
    if (!candidate) {
      markRivalMissing();
      return;
    }

    if (role === "host" && rival.id && candidate.id !== rival.id) {
      const busy = room.phase === "countdown" || room.phase === "playing" || room.phase === "done";
      if (busy) return;
    }

    clearTimeout(rivalLostTimer);
    rivalLostTimer = null;
    const isNew = rival.id !== candidate.id;
    const wasOffline = !rival.online;
    rival = {
      ...rival,
      ...candidate,
      score: isNew ? 0 : Number(rival.score) || 0,
      online: true,
      final: typeof candidate.final === "number" && candidate.round === room.round ? candidate.final : null,
    };
    rivalOffline = false;

    if (role === "guest" && candidate.role === "host" && Number(candidate.round) > room.round && room.phase !== "playing") {
      room.round = Number(candidate.round) || room.round;
    }

    if (rival.final != null && rival.state === "done" && rival.round === room.round) {
      rivalFinal = rival.final;
      if (room.phase === "done") finalizeResult();
    }

    if (role === "guest" && candidate.role === "host" && candidate.state === "lobby") {
      guestReadySeen = true;
      clearTimeout(joinTimer);
      clearTimeout(helloTimer);
    }

    if (isNew && room.phase === "lobby" && role === "guest") {
      clearTimeout(joinTimer);
      clearTimeout(helloTimer);
      setConn(`已连接 · 房主 ${rival.name || "狗狗"} 在等你`);
    }
    if (isNew || wasOffline) renderLobby();
    if (room.phase === "playing") {
      if (rival.state === "done" && Number(rival.round) === room.round) {
        // They already finished (e.g. we came back too late): close our round too.
        settleNow();
        return;
      }
      if (wasOffline && !isNew) {
        clearDropWait();
        pushMatchState();
        if (paused) renderPause();
      }
      renderHudScores();
    }
  }

  function markRivalMissing() {
    if (!rival.id) return;
    if (rivalLostTimer) return;
    rivalLostTimer = setTimeout(() => {
      rivalLostTimer = null;
      if (!channel || readOthers().length) return;
      rivalOffline = true;
      rival.online = false;
      if (room.phase === "lobby") {
        if (role === "guest") {
          rejectJoin("房主离开了房间");
        } else {
          renderLobby();
          setLobbyHint("朋友走了，把房间号再发给别人吧");
        }
      } else if (room.phase === "countdown") {
        cancelCountdown();
        room.phase = "lobby";
        rivalFinal = null;
        myFinal = null;
        updatePresence();
        renderLobby();
        bella.toast("对手离开了，匹配取消");
      } else if (room.phase === "playing") {
        renderHudScores();
        if (resuming) cancelResume();
        if (!paused) enterPause({ by: rival.id, reason: "drop" });
        else paused.reason = paused.reason === "rejoin" ? "rejoin" : "drop";
        armDropWait(DROP_WAIT_MS);
        renderPause();
      } else if (room.phase === "done") {
        finalizeResult();
        updateRematchForOffline();
      }
    }, 1800);
  }

  function onHello(payload) {
    if (role !== "host" || !payload || payload.from === clientId) return;
    send("here", {
      to: payload.from,
      id: clientId,
      name: me.name,
      dog: me.dog,
      round: room.round,
      state: room.phase,
    });
  }

  function onHere(payload) {
    if (role !== "guest" || !payload || payload.to !== clientId) return;
    if (payload.state === "playing" || payload.state === "countdown" || payload.state === "done") {
      rejectJoin("这间房正在比赛中，晚一点再来吧");
      return;
    }
    if (!rival.id) {
      rival = {
        ...blankRival(),
        id: payload.id,
        name: payload.name,
        dog: payload.dog,
        role: "host",
        state: "lobby",
        round: payload.round,
        online: true,
      };
      guestReadySeen = true;
      clearTimeout(joinTimer);
      clearTimeout(helloTimer);
      setConn(`已连接 · 房主 ${payload.name || "狗狗"} 在等你`);
      renderLobby();
    }
  }

  function onRoomFull(payload) {
    if (!payload || payload.to !== clientId) return;
    rejectJoin(payload.reason === "满员" ? "房间已经满员啦" : "暂时进不去这间房");
  }

  function onBye(payload) {
    if (!payload || payload.id === clientId) return;
    if (rival.id === payload.id && payload.quit && room.phase === "playing" && Number(payload.round) === room.round) {
      rival.online = false;
      rivalOffline = true;
      rivalQuit = true;
      bella.toast(`${rival.name || "对手"} 退出了比赛`);
      settleNow();
      return;
    }
    if (rival.id === payload.id) {
      rival.online = false;
      rivalOffline = true;
      if (room.phase === "playing") renderHudScores();
      markRivalMissing();
    }
  }

  function rejectJoin(message) {
    leaveRoom();
    bella.closeSheet();
    bella.toast(message);
    setTimeout(() => {
      bella.showScreen("title", { back: true });
    }, 10);
  }

  /* ------------------------------- Match -------------------------------- */

  function hostStart() {
    if (role !== "host" || room.phase !== "lobby") return;
    if (!rival.id || !rival.online) {
      bella.toast("等朋友进来再开始吧");
      return;
    }
    room.round += 1;
    const seed = makeSeed();
    beginStart(seed, START_DELAY, room.round);
    send("start", { seed, delay: START_DELAY, round: room.round, time: MATCH_TIME });
  }

  function onStart(payload) {
    if (!channel || room.phase === "closed") return;
    if (!payload || !payload.seed) return;
    if (room.phase === "playing") return;
    if (room.phase === "countdown" && startRound === payload.round) return;
    guestReadySeen = true;
    clearTimeout(joinTimer);
    clearTimeout(helloTimer);
    beginStart(payload.seed, Math.max(600, Number(payload.delay) || START_DELAY), payload.round);
  }

  function beginStart(seed, delay, round) {
    if (room.phase === "closed") return;
    if (room.phase === "playing" && room.round === round) return;
    if (room.phase === "countdown" && startRound === round) return;

    startRound = round;
    room.round = round;
    room.seed = seed;
    room.phase = "countdown";
    myFinal = null;
    rivalFinal = null;
    rivalOffline = false;
    rivalQuit = false;
    resultFinalized = false;
    rematchAsked = false;
    selfScore = 0;
    rival.score = 0;
    lastSentScore = -1;
    clearTimeout(waitTimer);
    clearTimeout(rivalLostTimer);
    stopTicker();

    updatePresence();

    startingGame = Boolean(bella.sheet() === "versus");
    if (bella.sheet() === "versus" || bella.sheet() === "versus-result") bella.closeSheet();

    showCountdown();
    const wait = Math.max(500, delay);
    const firstCount = Math.min(3, Math.max(1, Math.ceil(wait / 1000)));
    renderCountdown(firstCount);
    clearInterval(countdownTick);
    const at = Date.now() + wait;
    lastCount = firstCount;
    countdownTick = setInterval(() => {
      const left = Math.ceil((at - Date.now()) / 1000);
      if (left > 0 && left !== lastCount) {
        lastCount = left;
        renderCountdown(left);
      }
    }, 100);
    clearTimeout(countdownTimer);
    countdownTimer = setTimeout(() => {
      clearInterval(countdownTick);
      renderCountdown("开始!");
      launchGame(seed);
    }, wait);
  }

  function showCountdown(hint = "同一张棋盘，准备好了吗？") {
    const el = $("#vsCount");
    $("#vsCountHint").textContent = hint;
    $("#vsCountPlayers").innerHTML = `
      <div class="vs-count-side">
        <span class="vs-count-face">${dogSVG(me.dog)}</span>
        <b>${escapeHTML(me.name || "你")}</b>
      </div>
      <span class="vs-count-vs">VS</span>
      <div class="vs-count-side vs-count-side--rival">
        <span class="vs-count-face">${dogSVG(rival.dog || "husky")}</span>
        <b>${escapeHTML(rival.name || "对手")}</b>
      </div>`;
    countdownShown = true;
    el.classList.add("is-up");
  }

  function renderCountdown(value) {
    const el = $("#vsCountNum");
    el.textContent = value;
    el.classList.remove("pop");
    void el.offsetWidth;
    el.classList.add("pop");
    if (typeof value === "number") {
      bella.sound.init();
      bella.sound.tone(520 + value * 90, { duration: 0.1, type: "triangle", volume: 0.035 });
    } else if (value === "开始!" || value === "继续!") {
      bella.sound.tone(880, { duration: 0.16, type: "triangle", volume: 0.045 });
    }
  }

  function hideCountdown() {
    $("#vsCount").classList.remove("is-up");
    countdownShown = false;
  }

  function cancelCountdown() {
    clearTimeout(countdownTimer);
    clearInterval(countdownTick);
    hideCountdown();
  }

  function launchGame(seed) {
    room.phase = "playing";
    updatePresence();
    selfScore = 0;
    rival.score = 0;
    initHud();
    bella.startGame(bella.versusConfig(seed, MATCH_TIME));
    startTicker();
    setTimeout(hideCountdown, 120);
  }

  function initHud() {
    $("#vsMeName").textContent = me.name || "你";
    $("#vsRivalName").textContent = rival.name || "对手";
    $("#vsMeDog").innerHTML = dogSVG(me.dog);
    $("#vsRivalDog").innerHTML = dogSVG(rival.dog || "husky");
    selfScore = 0;
    rival.score = 0;
    lastSentAt = 0;
    lastLeader = "";
    clearTimeout(leadFlashTimer);
    $("#vsHud").classList.remove("is-flash-me", "is-flash-rival");
    rollers.me.reset();
    rollers.rival.reset();
    $("#vsMeGain").className = "vs-hud__gain";
    $("#vsRivalGain").className = "vs-hud__gain";
    renderHudScores();
  }

  // Poll the engine's real score quickly so our own number and the tug bar react
  // right after each cascade; broadcasts are throttled (latest value always wins).
  function startTicker() {
    stopTicker();
    tickTimer = setInterval(() => {
      if (room.phase !== "playing") return;
      const G = bella.G;
      if (!G || !G.cfg || !G.cfg.versus) return;
      const mine = Math.round(G.score || 0);
      if (mine !== selfScore) {
        if (mine > selfScore) popGain("me", mine - selfScore);
        selfScore = mine;
        renderHudScores();
      }
      const now = Date.now();
      if (mine !== lastSentScore && now - lastSentAt >= SEND_EVERY_MS && isConnected()) {
        lastSentScore = mine;
        lastSentAt = now;
        send("score", { score: mine, round: room.round, time: curTime() });
      }
      saveActive(false);
    }, 120);
  }

  /* --------------------------- Live score widgets ------------------------ */

  // Eases a number toward its target so jumps read as a quick count-up.
  function makeRoller(sel) {
    let shown = 0;
    let target = 0;
    let raf = 0;
    let text = "";
    const paint = (v) => {
      const t = fmt(v);
      if (t !== text) {
        text = t;
        $(sel).textContent = t;
      }
    };
    const step = () => {
      const gap = target - shown;
      shown = Math.abs(gap) < 1 ? target : shown + gap * 0.22;
      paint(shown);
      raf = shown === target ? 0 : requestAnimationFrame(step);
    };
    return {
      set(v, instant) {
        target = v;
        if (instant || REDUCED_MOTION) {
          cancelAnimationFrame(raf);
          raf = 0;
          shown = v;
          paint(v);
        } else if (!raf) raf = requestAnimationFrame(step);
      },
      text(t) {
        cancelAnimationFrame(raf);
        raf = 0;
        text = t;
        $(sel).textContent = t;
      },
      reset() {
        cancelAnimationFrame(raf);
        raf = 0;
        shown = target = 0;
        text = "";
        paint(0);
      },
    };
  }

  const REDUCED_MOTION = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const rollers = { me: makeRoller("#vsMeScore"), rival: makeRoller("#vsRivalScore") };

  function popGain(side, delta) {
    if (delta < 1 || room.phase !== "playing") return;
    const el = $(side === "me" ? "#vsMeGain" : "#vsRivalGain");
    el.textContent = `+${fmt(delta)}`;
    el.className = "vs-hud__gain";
    void el.offsetWidth; // restart the animation
    el.className = `vs-hud__gain is-on${delta >= 1500 ? " is-big" : ""}`;
  }

  function flashLead(leader) {
    const hud = $("#vsHud");
    hud.classList.remove("is-flash-me", "is-flash-rival");
    void hud.offsetWidth;
    hud.classList.add(leader === "me" ? "is-flash-me" : "is-flash-rival");
    clearTimeout(leadFlashTimer);
    leadFlashTimer = setTimeout(() => {
      hud.classList.remove("is-flash-me", "is-flash-rival");
      if (room.phase === "playing") renderHudScores();
    }, 1400);
    const s = bella.sound;
    if (s && s.tone) {
      if (leader === "me") {
        s.tone(784, { duration: 0.09, type: "triangle", volume: 0.035 });
        setTimeout(() => s.tone(1047, { duration: 0.12, type: "triangle", volume: 0.035 }), 90);
      } else {
        s.tone(330, { duration: 0.14, type: "sine", volume: 0.03 });
      }
    }
    if (leader === "me" && bella.haptic) bella.haptic(12);
  }

  function stopTicker() {
    clearInterval(tickTimer);
    tickTimer = null;
  }

  function renderHudScores() {
    const my = finalOrLive();
    const their = rivalFinal != null ? rivalFinal : Math.round(rival.score || 0);
    const hasRival = Boolean(rival.id);
    const offline = hasRival && (rivalOffline || rival.online === false);
    rollers.me.set(my);
    if (hasRival) rollers.rival.set(their);
    else rollers.rival.text("—");

    const diff = my - their;
    let lead = "同题竞速";
    if (hasRival) {
      if (offline) lead = "对手掉线";
      else if (lastLeader && diff > 0 && lastLeader === "rival") lead = "反超！";
      else if (lastLeader && diff < 0 && lastLeader === "me") lead = "被反超了";
      else lead = diff > 0 ? `领先 ${fmt(diff)}` : diff < 0 ? `落后 ${fmt(-diff)}` : "并驾齐驱";
    }
    $("#vsHudLead").textContent = lead;
    $("#vsHudLead").dataset.tone = !hasRival || offline || diff === 0 ? "" : diff > 0 ? "up" : "down";
    $("#vsHudMe").classList.toggle("is-leading", hasRival && diff > 0);
    $("#vsHudRival").classList.toggle("is-leading", hasRival && diff < 0);
    $("#vsHudRival").classList.toggle("is-offline", offline);
    $("#vsRivalDot").classList.toggle("is-on", hasRival && !offline);

    // Tug-of-war: my share of the combined score, softened so early points
    // don't slam the bar to one end.
    const share = hasRival ? (my + 1500) / (my + their + 3000) : 0.5;
    const pct = Math.min(94, Math.max(6, share * 100));
    $("#vsTugMe").style.width = `${pct}%`;
    $("#vsTugKnot").style.left = `${pct}%`;

    const leader = !hasRival || diff === 0 ? "" : diff > 0 ? "me" : "rival";
    if (leader && lastLeader && leader !== lastLeader && room.phase === "playing" && !offline) flashLead(leader);
    if (leader) lastLeader = leader;
  }

  function finalOrLive() {
    if (room.phase === "done" && myFinal != null) return myFinal;
    return selfScore;
  }

  function onRemoteScore(payload) {
    if (!payload || Number(payload.round) !== room.round) return;
    const v = Math.max(0, Math.round(Number(payload.score) || 0));
    if (Number.isFinite(Number(payload.time)) && payload.time != null) rivalTime = Number(payload.time);
    const prev = Number(rival.score) || 0;
    if (v > prev) {
      if (room.phase === "playing") popGain("rival", v - prev);
      rival.score = v;
      if (room.phase === "playing" || room.phase === "done") renderHudScores();
    }
  }

  function onRemoteDone(payload) {
    if (!payload || Number(payload.round) !== room.round) return;
    const score = Math.round(Number(payload.score) || 0);
    if (rivalFinal == null || score > rivalFinal) rivalFinal = score;
    rival.score = rivalFinal;
    if (room.phase === "playing") settleNow();
    else if (room.phase === "done") finalizeResult();
  }


  /* ---------------------------- Shared pause ---------------------------- */

  function curTime() {
    const G = bella.G;
    return G && G.cfg && G.cfg.versus ? Number(G.time) || 0 : MATCH_TIME;
  }

  function curScore() {
    const G = bella.G;
    return G && G.cfg && G.cfg.versus ? Math.round(G.score || 0) : selfScore;
  }

  // Tell the rival where we are after any (re)connection.
  function pushMatchState() {
    if (room.phase !== "playing" || !isConnected()) return;
    send("score", { score: curScore(), round: room.round, time: curTime() });
    if (paused) send("pause", { round: room.round, by: paused.by, reason: paused.reason, time: curTime() });
  }

  function requestPause(reason = "manual") {
    if (room.phase !== "playing") return;
    if (resuming) cancelResume();
    if (paused) {
      // Already frozen (e.g. rival paused); switching away still counts as us leaving.
      if (reason === "away" && paused.by !== clientId && paused.reason !== "drop") {
        paused = { by: clientId, reason, at: Date.now() };
        send("pause", { round: room.round, by: clientId, reason, time: curTime() });
      }
      renderPause();
      return;
    }
    enterPause({ by: clientId, reason });
    send("pause", { round: room.round, by: clientId, reason, time: curTime() });
  }

  function enterPause(info) {
    paused = { ...info, at: Date.now() };
    bella.setVersusFrozen(true);
    saveActive(true);
    showPause();
  }

  function onRemotePause(payload) {
    if (!payload || Number(payload.round) !== room.round || room.phase !== "playing") return;
    if (Number.isFinite(Number(payload.time))) rivalTime = Number(payload.time);
    if (resuming) cancelResume();
    const reason = ["manual", "away", "drop", "net", "rejoin"].includes(payload.reason) ? payload.reason : "manual";
    if (!paused) {
      enterPause({ by: payload.by || rival.id, reason });
      return;
    }
    // A rival coming back from a drop/rejoin unlocks "continue" for both sides.
    if (reason === "drop" || reason === "rejoin") paused.reason = "drop";
    else if (payload.by === rival.id && paused.by !== clientId) paused = { by: rival.id, reason, at: paused.at };
    renderPause();
  }

  function rivalPresent() {
    return Boolean(rival.id && rival.online && !rivalOffline);
  }

  function canResume() {
    if (!paused || resuming || !isConnected() || !rivalPresent()) return false;
    return paused.by === clientId || paused.reason === "drop" || paused.reason === "rejoin" || paused.reason === "net";
  }

  function requestResume() {
    if (!canResume()) return;
    const mine = curTime();
    const t = rivalTime != null ? Math.min(mine, rivalTime) : mine;
    send("resume", { round: room.round, by: clientId, time: t, delay: RESUME_DELAY });
    beginResume(t, RESUME_DELAY);
  }

  function onRemoteResume(payload) {
    if (!payload || Number(payload.round) !== room.round || room.phase !== "playing") return;
    if (!paused || resuming) return;
    beginResume(Number(payload.time), Math.max(600, Number(payload.delay) || RESUME_DELAY));
  }

  function beginResume(time, delay) {
    resuming = true;
    clearDropWait();
    if (Number.isFinite(time)) bella.setVersusTime(time);
    rivalTime = null;
    hidePause();
    showCountdown("比赛继续！两边时间已对齐");
    const at = Date.now() + delay;
    let last = Math.min(3, Math.max(1, Math.ceil(delay / 1000)));
    renderCountdown(last);
    clearInterval(resumeTick);
    resumeTick = setInterval(() => {
      const left = Math.ceil((at - Date.now()) / 1000);
      if (left > 0 && left !== last) {
        last = left;
        renderCountdown(left);
      }
    }, 100);
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => {
      clearInterval(resumeTick);
      resuming = false;
      paused = null;
      renderCountdown("继续!");
      bella.setVersusFrozen(false);
      saveActive(true);
      setTimeout(() => {
        if (!resuming && !paused) hideCountdown();
      }, 350);
    }, delay);
  }

  function cancelResume() {
    clearTimeout(resumeTimer);
    clearInterval(resumeTick);
    resuming = false;
    hideCountdown();
  }

  function armDropWait(ms) {
    clearTimeout(dropTimer);
    dropDeadline = Date.now() + ms;
    dropTimer = setTimeout(() => {
      dropTimer = null;
      if (room.phase === "playing" && !rivalPresent()) {
        bella.toast(`${rival.name || "对手"} 没有回来，按当前比分结算`);
        settleNow();
      }
    }, ms);
  }

  function clearDropWait() {
    clearTimeout(dropTimer);
    dropTimer = null;
    dropDeadline = 0;
  }

  // End the round right now with the current scores (both sides when online).
  function settleNow() {
    if (room.phase !== "playing") return;
    clearPauseState();
    const G = bella.G;
    if (G && G.active && !G.ended) bella.endGame();
  }

  function quitMatch() {
    const btn = $("#vsQuitBtn");
    if (!quitArmed) {
      quitArmed = true;
      btn.textContent = "再点一次确认退出（记一场负）";
      btn.classList.add("is-armed");
      clearTimeout(quitTimer);
      quitTimer = setTimeout(resetQuitButton, 3500);
      return;
    }
    resetQuitButton();
    if (isConnected()) send("bye", { id: clientId, round: room.round, quit: true });
    if (room.phase === "playing" && rival.id) recordStats("lose");
    leaveRoom();
    bella.leaveGame();
    bella.toast("已退出比赛");
  }

  function resetQuitButton() {
    quitArmed = false;
    clearTimeout(quitTimer);
    const btn = $("#vsQuitBtn");
    btn.textContent = "退出比赛";
    btn.classList.remove("is-armed");
  }

  function clearPauseState() {
    clearDropWait();
    clearTimeout(resumeTimer);
    clearInterval(resumeTick);
    clearTimeout(reconnectTimer);
    resuming = false;
    paused = null;
    rivalTime = null;
    hidePause();
    resetQuitButton();
  }

  function scheduleReconnect(ms) {
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      if (room.phase === "playing" && !isConnected() && !connecting) {
        connecting = true;
        connectChannel().finally(() => {
          connecting = false;
          if (paused) renderPause();
          if (room.phase === "playing" && !isConnected()) scheduleReconnect(5000);
        });
      }
    }, ms);
  }

  function showPause() {
    $("#vsPauseMeDog").innerHTML = dogSVG(me.dog);
    $("#vsPauseMeName").textContent = me.name || "你";
    $("#vsPauseRivalDog").innerHTML = dogSVG(rival.dog || "husky");
    $("#vsPauseRivalName").textContent = rival.name || "对手";
    renderPause();
    $("#vsPause").classList.add("is-up");
    clearInterval(pauseTick);
    pauseTick = setInterval(renderPause, 500);
  }

  function hidePause() {
    clearInterval(pauseTick);
    pauseTick = null;
    $("#vsPause").classList.remove("is-up");
  }

  function renderPause() {
    if (!paused) return;
    const rn = rival.name || "对手";
    const online = isConnected();
    const present = rivalPresent();
    const mine = paused.by === clientId;
    $("#vsPauseTime").textContent = Math.max(0, Math.ceil(curTime()));
    $("#vsPauseMeState").textContent = online ? (mine && paused.reason !== "rejoin" ? "暂停中" : "在线") : "重连中…";
    $("#vsPauseMe").classList.toggle("is-away", !online);
    let rivalState = "在线";
    if (!present) rivalState = "掉线了";
    else if (!mine && paused.reason === "away") rivalState = "切出去了";
    else if (!mine && paused.reason === "manual") rivalState = "暂停中";
    $("#vsPauseRivalState").textContent = rivalState;
    $("#vsPauseRival").classList.toggle("is-away", !present || (!mine && paused.reason === "away"));

    const waitLeft = dropDeadline ? Math.max(0, Math.ceil((dropDeadline - Date.now()) / 1000)) : 0;
    let title = "比赛暂停";
    let copy = "";
    if (!online) {
      title = "网络断开了";
      copy = "正在重新连接，连上后就能继续比赛。";
    } else if (!present) {
      title = paused.reason === "rejoin" ? "回到比赛啦" : `${rn} 掉线了`;
      copy = paused.reason === "rejoin" ? `正在等 ${rn} 回来…` : `等 TA 回来接着比，${waitLeft ? `最多再等 ${waitLeft} 秒` : "马上结算"}。`;
    } else if (paused.reason === "rejoin" || paused.reason === "drop" || paused.reason === "net") {
      title = "两个人都在啦";
      copy = "比分和剩余时间都保留着，谁先点继续，3 秒后一起开始。";
    } else if (mine) {
      title = paused.reason === "away" ? "你刚刚离开了" : "你暂停了比赛";
      copy = `${rn} 也停在原地等你，准备好就点继续。`;
    } else {
      title = paused.reason === "away" ? `${rn} 切出去了` : `${rn} 暂停了比赛`;
      copy = "时间已经停住，等 TA 回来点继续。";
    }
    $("#vsPauseTitle").textContent = title;
    $("#vsPauseCopy").textContent = copy;

    const resumeBtn = $("#vsResumeBtn");
    const can = canResume();
    resumeBtn.disabled = !can;
    resumeBtn.hidden = !mine && present && (paused.reason === "manual" || paused.reason === "away");
    const longWait = !mine && Date.now() - paused.at > SETTLE_AFTER_MS;
    $("#vsSettleBtn").hidden = !(online && (!present || longWait));
  }

  /* --------------------------- Rejoin a match --------------------------- */

  function saveActive(force) {
    if (room.phase !== "playing" || !room.code) return;
    const now = Date.now();
    if (!force && now - lastSavedAt < 1000) return;
    lastSavedAt = now;
    const rec = {
      v: 1,
      code: room.code,
      role,
      clientId,
      joinedAt,
      round: room.round,
      seed: room.seed,
      score: curScore(),
      time: curTime(),
      me: { name: me.name, dog: me.dog },
      rival: { id: rival.id, name: rival.name, dog: rival.dog, role: rival.role, score: Math.round(rival.score || 0) },
      at: now,
    };
    const json = JSON.stringify(rec);
    try {
      sessionStorage.setItem(ACTIVE_KEY, json);
    } catch (e) {
      /* private mode */
    }
    try {
      localStorage.setItem(ACTIVE_KEY, json);
    } catch (e) {
      /* private mode */
    }
  }

  function clearActive() {
    try {
      sessionStorage.removeItem(ACTIVE_KEY);
    } catch (e) {
      /* ignore */
    }
    try {
      const raw = localStorage.getItem(ACTIVE_KEY);
      const rec = raw && JSON.parse(raw);
      if (!rec || rec.clientId === clientId) localStorage.removeItem(ACTIVE_KEY);
    } catch (e) {
      /* ignore */
    }
  }

  function parseActive(raw) {
    try {
      const r = JSON.parse(raw);
      if (!r || r.v !== 1 || cleanCode(r.code).length !== 4 || !r.clientId || !r.seed || !r.rival || !r.rival.id) return null;
      if (Date.now() - Number(r.at) > REJOIN_TTL_MS) return null;
      if (!(Number(r.time) > 0.5)) return null;
      return r;
    } catch (e) {
      return null;
    }
  }

  // Prefer this tab's own record (refresh), then the device's (closed tab).
  function loadActive() {
    let rec = null;
    try {
      rec = parseActive(sessionStorage.getItem(ACTIVE_KEY));
    } catch (e) {
      /* ignore */
    }
    if (!rec) {
      try {
        rec = parseActive(localStorage.getItem(ACTIVE_KEY));
        if (!rec) localStorage.removeItem(ACTIVE_KEY);
      } catch (e) {
        /* ignore */
      }
    }
    return rec;
  }

  function offerRejoin(rec) {
    rejoinRecord = rec;
    $("#vsRejoinCode").textContent = rec.code;
    $("#vsRejoinCopy").textContent = `你和 ${rec.rival.name || "对手"} 的比赛还剩约 ${Math.ceil(rec.time)} 秒，比分 ${fmt(rec.score)} : ${fmt(rec.rival.score)}。回去接着打吧！`;
    bella.openSheet("versus", { onClose: handleSheetClose });
    showView("rejoin");
  }

  function dropRejoin() {
    rejoinRecord = null;
    clearActive();
    try {
      localStorage.removeItem(ACTIVE_KEY);
    } catch (e) {
      /* ignore */
    }
    bella.closeSheet();
  }

  async function rejoinMatch() {
    const rec = rejoinRecord;
    if (!rec || connecting) return;
    rejoinRecord = null;
    connecting = true;
    try {
      clientId = rec.clientId;
      role = rec.role === "host" ? "host" : "guest";
      joinedAt = Number(rec.joinedAt) || Date.now();
      if (rec.me) me = { name: cleanName(rec.me.name) || me.name, dog: PICK_DOGS.includes(rec.me.dog) ? rec.me.dog : me.dog };
      toldFull.clear();
      room = { code: cleanCode(rec.code), phase: "playing", round: Number(rec.round) || 1, seed: Number(rec.seed), connected: false };
      startRound = room.round;
      rival = { ...blankRival(), id: rec.rival.id, name: cleanName(rec.rival.name), dog: rec.rival.dog || "husky", role: rec.rival.role || "", state: "playing", round: room.round, online: false };
      rivalOffline = true;
      rivalFinal = null;
      myFinal = null;
      resultFinalized = false;
      rematchAsked = false;
      startingGame = true;
      bella.closeSheet();

      initHud();
      bella.startGame(bella.versusConfig(room.seed, MATCH_TIME));
      bella.versusRestore({ score: Number(rec.score) || 0, time: Number(rec.time) });
      selfScore = Math.round(Number(rec.score) || 0);
      lastSentScore = -1;
      rival.score = Math.round(Number(rec.rival.score) || 0);
      renderHudScores();
      enterPause({ by: clientId, reason: "rejoin" });
      armDropWait(REJOIN_WAIT_MS);
      startTicker();
      const ok = await connectChannel();
      if (!ok) scheduleReconnect(3000);
      renderPause();
    } finally {
      connecting = false;
    }
  }

  /* ------------------------------- Result ------------------------------- */

  function showResult(res) {
    if (room.phase === "done") return;
    room.phase = "done";
    myFinal = Math.round(Number(res && res.score) || 0);
    selfScore = myFinal;
    stopTicker();
    clearPauseState();
    clearActive();
    cancelCountdown();
    updatePresence();
    send("done", { round: room.round, score: myFinal });
    renderResultWaiting();
    bella.openSheet("versus-result");
    armResultWait();
  }

  function renderResultWaiting() {
    const sheet = $("#sheet-versus-result");
    sheet.classList.remove("is-lose");
    $("#vsResultKicker").textContent = `VERSUS · ROUND ${room.round}`;
    $("#vsResultTitle").textContent = "时间到！";
    $("#vsResultCopy").textContent = rival.online ? `等 ${rival.name || "对手"} 完成这一局…` : "对手好像掉线了，正在结算…";
    $("#vsResultMeName").textContent = me.name || "你";
    $("#vsResultMeDog").innerHTML = dogSVG(me.dog);
    $("#vsResultMeScore").textContent = fmt(myFinal);
    $("#vsResultRivalName").textContent = rival.name || "对手";
    $("#vsResultRivalDog").innerHTML = dogSVG(rival.dog || "husky");
    $("#vsResultRivalScore").textContent = rivalFinal != null ? fmt(rivalFinal) : "…";
    $("#vsResultMe").classList.remove("is-winner");
    $("#vsResultRival").classList.remove("is-winner");
    $("#vsRematchBtn").hidden = true;
    $("#vsRematchBtn").disabled = false;
    $("#vsHomeBtn").hidden = false;
    $("#vsWait").classList.add("is-shown");
    $("#vsWait").textContent = `等待 ${rival.name || "对手"} 完成…`;
  }

  function armResultWait() {
    clearTimeout(waitTimer);
    if (rivalFinal != null) {
      finalizeResult();
      return;
    }
    const wait = rival.online ? WAIT_DONE_MS : 1200;
    waitTimer = setTimeout(finalizeResult, wait);
  }

  function finalizeResult() {
    if (resultFinalized || myFinal == null) return;
    const known = rivalFinal != null && Number.isFinite(rivalFinal);
    const outcome = !known ? "bye" : myFinal > rivalFinal ? "win" : myFinal < rivalFinal ? "lose" : "draw";
    resultFinalized = true;
    clearTimeout(waitTimer);
    renderResultFinal(outcome, known);
    recordStats(outcome);
  }

  function renderResultFinal(outcome, known) {
    const sheet = $("#sheet-versus-result");
    const theirs = known ? rivalFinal : null;
    const diff = theirs == null ? 0 : Math.abs(myFinal - theirs);
    const rivalName = rival.name || "对手";
    const titles = { win: "你赢啦！", lose: "惜败，再来一局！", draw: "打成平手！", bye: rivalQuit ? "对手退出了" : "对手掉线了" };
    const copies = {
      win: `比 ${rivalName} 多了 ${fmt(diff)} 分，尾巴都翘起来啦！`,
      lose: `差 ${fmt(diff)} 分，下一局追回来！`,
      draw: "分数一模一样，默契满分！",
      bye: rivalQuit ? `${rivalName} 中途退出了比赛，本局记为你的胜利。` : "对手没有回来完成这一局，本局记为你的胜利。",
    };

    sheet.classList.toggle("is-lose", outcome === "lose");
    $("#vsResultKicker").textContent = outcome === "bye" ? (rivalQuit ? "VERSUS · 对手退出" : "VERSUS · 对手掉线") : `VERSUS · ROUND ${room.round}`;
    $("#vsResultTitle").textContent = titles[outcome];
    $("#vsResultCopy").textContent = copies[outcome];
    $("#vsResultMeName").textContent = me.name || "你";
    $("#vsResultMeDog").innerHTML = dogSVG(me.dog);
    $("#vsResultMeScore").textContent = fmt(myFinal);
    $("#vsResultRivalName").textContent = rivalName;
    $("#vsResultRivalDog").innerHTML = dogSVG(rival.dog || "husky");
    $("#vsResultRivalScore").textContent = known ? fmt(theirs) : "—";
    $("#vsResultMe").classList.toggle("is-winner", outcome === "win");
    $("#vsResultRival").classList.toggle("is-winner", outcome === "lose");
    $("#vsWait").classList.remove("is-shown");
    $("#vsHomeBtn").hidden = false;
    $("#vsRematchBtn").hidden = false;
    $("#vsRematchBtn").disabled = false;
    $("#vsRematchBtn").classList.remove("is-waiting");

    if (!rival.online) {
      $("#vsRematchBtn").innerHTML = `<svg><use href="#i-paw"/></svg><span>再开一个房间</span>`;
      $("#vsRematchBtn").dataset.mode = "new";
    } else {
      $("#vsRematchBtn").innerHTML = `<svg><use href="#i-retry"/></svg><span>再来一局</span>`;
      $("#vsRematchBtn").dataset.mode = "rematch";
    }

    if (outcome === "win") {
      bella.sound.win();
      bella.confetti();
      bella.haptic(25);
    } else if (outcome === "lose") {
      bella.sound.lose();
    } else if (outcome === "draw") {
      bella.sound.tone(660, { duration: 0.14, type: "triangle", volume: 0.04 });
      bella.sound.tone(880, { duration: 0.18, type: "triangle", volume: 0.04, delay: 0.1 });
    }
  }

  function updateRematchForOffline() {
    if (room.phase !== "done" || !resultFinalized) return;
    const btn = $("#vsRematchBtn");
    if (!btn || btn.hidden) return;
    btn.dataset.mode = "new";
    btn.disabled = false;
    btn.classList.remove("is-waiting");
    btn.innerHTML = `<svg><use href="#i-paw"/></svg><span>再开一个房间</span>`;
    $("#vsWait").classList.remove("is-shown");
  }

  function recordStats(outcome) {
    const save = bella.save();
    if (!save.versus) save.versus = { wins: 0, losses: 0, draws: 0 };
    if (outcome === "win" || outcome === "bye") save.versus.wins += 1;
    else if (outcome === "lose") save.versus.losses += 1;
    else save.versus.draws += 1;
    bella.persist();
    bella.refreshHome();
  }

  function requestRematch() {
    if (room.phase !== "done" || myFinal == null) return;
    if (!rival.online || rivalFinal == null) {
      newRoom();
      return;
    }
    if (role === "host") {
      hostRematch();
    } else if (!rematchAsked) {
      rematchAsked = true;
      send("rematch-ask", { from: clientId, round: room.round });
      const btn = $("#vsRematchBtn");
      btn.disabled = true;
      btn.classList.add("is-waiting");
      btn.innerHTML = `<span>已邀请房主…</span>`;
      bella.toast("已告诉房主，等 TA 开下一局");
    }
  }

  function hostRematch() {
    if (role !== "host" || room.phase !== "done") return;
    if (!rival.online) {
      newRoom();
      return;
    }
    room.round += 1;
    const seed = makeSeed();
    beginStart(seed, START_DELAY, room.round);
    send("rematch", { seed, delay: START_DELAY, round: room.round });
  }

  function onRematchAsk(payload) {
    if (role !== "host" || room.phase !== "done") return;
    if (!payload || Number(payload.round) !== room.round) return;
    hostRematch();
  }

  function onRematch(payload) {
    if (!payload || !payload.seed) return;
    if (role !== "guest") return;
    beginStart(payload.seed, Math.max(600, Number(payload.delay) || START_DELAY), payload.round);
  }

  /* ------------------------------- Actions ------------------------------ */

  function openVersus() {
    if (!CONFIGURED) {
      bella.openSheet("versus", { onClose: handleSheetClose });
      showView("offline");
      return;
    }
    bella.openSheet("versus", { onClose: handleSheetClose });
    showView("menu");
  }

  function startCreate() {
    if (!ensureReady()) return;
    setSetupMode("create");
  }

  function startJoin() {
    if (!ensureReady()) return;
    setSetupMode("join");
  }

  function ensureReady() {
    if (CONFIGURED) return true;
    showView("offline");
    return false;
  }

  async function createRoom() {
    if (connecting || !ensureReady()) return;
    connecting = true;
    try {
      role = "host";
      guestReadySeen = false;
      joinedAt = Date.now();
      toldFull.clear();
      room = { code: makeCode(), phase: "lobby", round: 0, seed: 0, connected: false };
      rival = blankRival();
      rivalFinal = null;
      myFinal = null;
      rivalOffline = false;
      setupMode = "create";
      showView("lobby");
      renderLobby();
      setConn("连接中…");
      const ok = await connectChannel();
      if (!ok) {
        teardownChannel();
        room.phase = "closed";
        showView("setup");
        setSetupMode("create");
        setStatus("连不上联机服务，检查网络后再试一次", "error");
        return;
      }
      setLobbyHint("把房间号发给朋友，等 TA 进来。");
    } finally {
      connecting = false;
    }
  }

  async function joinRoom() {
    if (connecting || !ensureReady()) return;
    const code = cleanCode(pendingJoinCode);
    if (code.length !== 4) {
      setSetupMode("join");
      setStatus("房间号是 4 位字母或数字", "error");
      return;
    }
    connecting = true;
    try {
      role = "guest";
      guestReadySeen = false;
      joinedAt = Date.now();
      toldFull.clear();
      room = { code, phase: "lobby", round: 0, seed: 0, connected: false };
      rival = blankRival();
      rivalFinal = null;
      myFinal = null;
      rivalOffline = false;
      pendingJoinCode = code;
      showView("lobby");
      renderLobby();
      setConn("连接中…");
      const ok = await connectChannel();
      if (!ok) {
        teardownChannel();
        room.phase = "closed";
        showView("setup");
        setSetupMode("join");
        setStatus("连不上联机服务，检查网络后再试一次", "error");
        return;
      }
      send("hello", { from: clientId });
      armJoinTimeout();
      clearTimeout(helloTimer);
      helloTimer = setTimeout(() => {
        if (!rival.id) send("hello", { from: clientId });
      }, 2600);
    } finally {
      connecting = false;
    }
  }

  function armJoinTimeout() {
    clearTimeout(joinTimer);
    if (role !== "guest") return;
    joinTimer = setTimeout(() => {
      if (room.phase !== "lobby") return;
      if (!rival.id || !rival.online) {
        rejectJoin("房间不存在，或者房主已经离开");
      }
    }, NOBODY_MS);
  }

  function confirmSetup() {
    const name = cleanName($("#vsName").value);
    if (!name) {
      setStatus("先写个昵称吧～", "error");
      $("#vsName").focus();
      return;
    }
    me.name = name;
    saveProfile();
    if (setupMode === "create") {
      createRoom();
    } else {
      pendingJoinCode = cleanCode($("#vsCodeInput").value);
      if (pendingJoinCode.length !== 4) {
        setStatus("房间号是 4 位字母或数字", "error");
        $("#vsCodeInput").focus();
        return;
      }
      joinRoom();
    }
  }

  function leaveRoom() {
    clearPauseState();
    clearActive();
    rejoinRecord = null;
    clearTimeout(joinTimer);
    clearTimeout(helloTimer);
    clearTimeout(rivalLostTimer);
    clearTimeout(waitTimer);
    clearTimeout(countdownTimer);
    clearInterval(countdownTick);
    stopTicker();
    if (isConnected()) {
      try {
        send("bye", { id: clientId, round: room.round });
      } catch (e) {
        /* closing anyway */
      }
    }
    teardownChannel();
    hideCountdown();
    room = { code: "", phase: "closed", round: 0, seed: 0, connected: false };
    rival = blankRival();
    rivalFinal = null;
    myFinal = null;
    rivalOffline = false;
    rivalQuit = false;
    selfScore = 0;
    resultFinalized = false;
    rematchAsked = false;
    startingGame = false;
    guestReadySeen = false;
    pendingJoinCode = "";
    toldFull.clear();
  }

  function goHomeFromResult() {
    leaveRoom();
    bella.closeSheet();
    bella.leaveGame();
  }

  function newRoom() {
    leaveRoom();
    bella.closeSheet();
    bella.leaveGame();
    setTimeout(() => {
      if (CONFIGURED) {
        bella.openSheet("versus", { onClose: handleSheetClose });
        setSetupMode("create");
      }
    }, 180);
  }

  function handleSheetClose() {
    if (startingGame) {
      startingGame = false;
      return;
    }
    if (room.phase === "lobby" || room.phase === "countdown") leaveRoom();
  }

  async function copyInvite() {
    if (!room.code) return;
    const url = inviteURL();
    const text = `来和我玩汪汪消消乐双人竞赛！房间号 ${room.code}`;
    let shared = false;
    try {
      if (navigator.share) {
        await navigator.share({ title: "汪汪消消乐 · 双人竞赛", text, url });
        shared = true;
      } else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
      }
      feedbackCopy(shared ? "已分享！" : "已复制邀请链接");
    } catch (e) {
      if (e && e.name === "AbortError") return;
      if (legacyCopy(`${text}\n${url}`)) feedbackCopy("已复制邀请链接");
      else bella.toast(`房间号 ${room.code}，抄给朋友吧`);
    }
  }

  function inviteURL() {
    const u = new URL(location.href);
    u.search = "";
    u.hash = "";
    u.searchParams.set("room", room.code);
    return u.toString();
  }

  function legacyCopy(text) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch (e) {
      return false;
    }
  }

  function feedbackCopy(label) {
    const el = $("#vsCopyLabel");
    const btn = el.closest(".vs-copy");
    el.textContent = label;
    btn.classList.add("is-copied");
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => {
      el.textContent = "复制邀请链接";
      btn.classList.remove("is-copied");
    }, 1800);
  }

  /* --------------------------------- UI --------------------------------- */

  function showView(name) {
    $$(".vs-view", $("#sheet-versus")).forEach((v) => {
      v.hidden = v.dataset.vsView !== name;
    });
    if (name === "menu" || name === "setup") {
      const sheet = $("#sheet-versus");
      sheet.scrollTop = 0;
    }
  }

  function setSetupMode(mode) {
    setupMode = mode;
    $("#vsSetupKicker").textContent = mode === "create" ? "CREATE ROOM" : "JOIN ROOM";
    $("#vsSetupTitle").textContent = mode === "create" ? "先给自己起个名字" : "输入房间号，加入朋友";
    $("#vsConfirmLabel").textContent = mode === "create" ? "创建房间" : "加入房间";
    $("[data-vs-join-only]").hidden = mode !== "join";
    $("#vsName").value = me.name || "";
    $("#vsCodeInput").value = mode === "join" ? pendingJoinCode : "";
    setStatus("");
    renderDogPicker();
    showView("setup");
    setTimeout(() => {
      if (mode === "join" && !pendingJoinCode) $("#vsCodeInput").focus({ preventScroll: true });
      else $("#vsName").focus({ preventScroll: true });
    }, 330);
  }

  function renderDogPicker() {
    $("#vsDogPicker").innerHTML = PICK_DOGS.map(
      (t) =>
        `<button type="button" class="vs-dog" role="radio" aria-checked="${me.dog === t}" data-vs-dog="${t}" aria-label="${DOGS[t].name}"><span>${dogSVG(t)}</span><b>${DOGS[t].name}</b></button>`
    ).join("");
  }

  function selectDog(t) {
    if (!PICK_DOGS.includes(t)) return;
    me.dog = t;
    saveProfile();
    $$("[data-vs-dog]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.vsDog === t)));
  }

  function setStatus(text, tone = "") {
    const el = $("#vsSetupStatus");
    el.textContent = text || "";
    el.className = `vs-status${tone ? ` is-${tone}` : ""}`;
  }

  function setLobbyHint(text) {
    $("#vsLobbyHint").textContent = text;
  }

  function setConn(text, isError = false) {
    const el = $("#vsConn");
    if (!el) return;
    el.textContent = text;
    el.classList.toggle("is-error", Boolean(isError));
  }

  function slotHTML(player, tag) {
    return `<span class="vs-slot__dog">${dogSVG(player.dog || "shiba")}</span>
      <b class="vs-slot__name">${escapeHTML(player.name || "狗狗")}</b>
      <span class="vs-slot__tag ${tag === "房主" ? "vs-slot__tag--host" : ""}">${escapeHTML(tag)}</span>`;
  }

  function renderLobby() {
    if (room.phase === "closed") return;
    $("#vsRoomCode").textContent = room.code || "----";
    const meSlot = $("#vsSlotMe");
    meSlot.classList.remove("vs-slot--empty");
    meSlot.innerHTML = slotHTML(me, role === "host" ? "房主" : "玩家");

    const rivalSlot = $("#vsSlotRival");
    if (rival.id && rival.online) {
      rivalSlot.classList.remove("vs-slot--empty");
      const tag = rival.state === "playing" || rival.state === "countdown" ? "比赛中" : rival.state === "done" ? "已完成" : "已加入";
      rivalSlot.innerHTML = slotHTML(rival, tag);
    } else {
      rivalSlot.classList.add("vs-slot--empty");
      rivalSlot.innerHTML = `<span class="vs-slot__wait">?</span><b class="vs-slot__name">等待朋友</b><span class="vs-slot__tag">空位</span>`;
    }

    const canStart = role === "host" && rival.id && rival.online && room.phase === "lobby";
    const startBtn = $("#vsStartBtn");
    startBtn.disabled = !canStart;
    startBtn.querySelector("span").textContent = role === "host" ? (canStart ? "开始比赛" : "等朋友进来") : "等房主开始";
    $("#vsLobbyKicker").textContent = role === "host" ? "ROOM · HOST" : "ROOM · GUEST";

    if (room.phase === "lobby") {
      if (role === "host") {
        setLobbyHint(rival.id && rival.online ? "朋友到齐啦，可以开始 60 秒竞速！" : "把房间号发给朋友，等 TA 进来。");
      } else {
        setLobbyHint(rival.id && rival.online ? "已进入房间，等房主点开始。" : "正在找房主…");
      }
    }
  }

  /* --------------------------------- Bind -------------------------------- */

  function bind() {
    document.addEventListener("click", (e) => {
      const hub = e.target.closest("[data-vs-action]");
      if (hub) {
        bella.sound.init();
        bella.sound.click();
        openVersus();
        return;
      }
      const dogBtn = e.target.closest("[data-vs-dog]");
      if (dogBtn) {
        bella.sound.click();
        selectDog(dogBtn.dataset.vsDog);
        return;
      }
      const btn = e.target.closest("[data-vs]");
      if (!btn || btn.disabled) return;
      const action = btn.dataset.vs;
      bella.sound.init();
      bella.sound.click();
      if (action === "create") startCreate();
      else if (action === "join") startJoin();
      else if (action === "confirm") confirmSetup();
      else if (action === "back") showView("menu");
      else if (action === "close") bella.closeSheet();
      else if (action === "start") hostStart();
      else if (action === "copy") copyInvite();
      else if (action === "leave") {
        leaveRoom();
        bella.closeSheet();
      } else if (action === "rematch") {
        if (btn.dataset.mode === "new") newRoom();
        else requestRematch();
      } else if (action === "home") goHomeFromResult();
      else if (action === "resume") requestResume();
      else if (action === "settle") settleNow();
      else if (action === "quit-match") quitMatch();
      else if (action === "rejoin") rejoinMatch();
      else if (action === "rejoin-drop") dropRejoin();
    });

    // Coming back to the tab / network: make sure the channel is alive.
    const kick = () => {
      if (room.phase === "playing" && !isConnected()) scheduleReconnect(1200);
    };
    addEventListener("online", kick);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        kick();
        if (paused) renderPause();
      }
    });

    $("#vsName").addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (setupMode === "join") $("#vsCodeInput").focus();
        else confirmSetup();
      }
    });
    $("#vsCodeInput").addEventListener("input", () => {
      const input = $("#vsCodeInput");
      const clean = cleanCode(input.value);
      if (input.value !== clean) input.value = clean;
    });
    $("#vsCodeInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        confirmSetup();
      }
    });

    addEventListener("pagehide", () => {
      if (isConnected()) {
        try {
          send("bye", { id: clientId, round: room.round });
        } catch (e) {
          /* page is leaving */
        }
      }
      try {
        if (channel) channel.untrack();
      } catch (e) {
        /* page is leaving */
      }
    });
  }

  /* --------------------------------- Init --------------------------------- */

  function init() {
    bind();
    const linked = cleanCode(new URLSearchParams(location.search).get("room") || "");
    const rec = CONFIGURED ? loadActive() : null;
    if (rec && (!linked || linked === rec.code)) {
      offerRejoin(rec);
      return;
    }
    if (linked) {
      pendingJoinCode = linked;
      bella.openSheet("versus", { onClose: handleSheetClose });
      if (CONFIGURED) setSetupMode("join");
      else showView("offline");
    }
  }

  // window.BellaVersus is the contract game.js uses when a versus round ends.
  window.BellaVersus = { showResult, requestPause };

  init();
})();
