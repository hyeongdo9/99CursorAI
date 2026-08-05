(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  const stageEl = document.getElementById("stage");

  const el = {
    score: document.getElementById("score"),
    level: document.getElementById("level"),
    lives: document.getElementById("lives"),
    overlay: document.getElementById("overlay"),
    finalScore: document.getElementById("final-score"),
    winScore: document.getElementById("win-score"),
    levelMsg: document.getElementById("level-msg"),
    playerName: document.getElementById("player-name"),
    playerNameWin: document.getElementById("player-name-win"),
    muteBtn: document.getElementById("btn-mute"),
    speedBtn: document.getElementById("btn-speed"),
    panels: {
      start: document.getElementById("panel-start"),
      pause: document.getElementById("panel-pause"),
      level: document.getElementById("panel-level"),
      boss: document.getElementById("panel-boss"),
      over: document.getElementById("panel-over"),
      win: document.getElementById("panel-win"),
    },
  };

  const COLORS = {
    cyan: "#00f0ff",
    magenta: "#ff2bd6",
    amber: "#ffe600",
    lime: "#39ff14",
    violet: "#b14cff",
    blue: "#2979ff",
    orange: "#ff7a00",
    white: "#fff5ff",
    hot: "#ff0040",
  };

  const BRICK_PALETTE = [
    "#ff0040", "#ff7a00", "#ffe600", "#39ff14", "#00f0ff", "#2979ff", "#d500f9",
  ];

  const PATTERNS = ["stripe", "diamond", "dots", "chevron", "circuit", "hex", "wave"];

  const POWER_DEFS = {
    wide: { type: "wide", color: COLORS.cyan, label: "W" },
    multi: { type: "multi", color: COLORS.magenta, label: "×3" },
    laser: { type: "laser", color: COLORS.hot, label: "L" },
    slow: { type: "slow", color: COLORS.amber, label: "S" },
    life: { type: "life", color: COLORS.lime, label: "♥" },
  };

  const RANDOM_POWERS = ["wide", "multi", "laser", "slow", "life"];
  const MAX_LEVEL = 6;
  const BASE_BALL_SPEED = 15.6;
  const BOSS_SCORE_TRIGGER = 1000;
  const RANK_KEY = "neonbreak_ranks_v1";
  const SPEED_PRESETS = [0.5, 1, 1.5, 2];
  const SPEED_LABELS = ["0.5×", "1×", "1.5×", "2×"];
  let speedIndex = 1;

  // ─── Audio ───────────────────────────────────────────────
  let audioCtx = null;
  let masterGain = null;
  let bgmNodes = null;
  let muted = false;

  function ensureAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = muted ? 0 : 0.9;
      masterGain.connect(audioCtx.destination);
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
  }

  function beep(freq, dur, type = "square", vol = 0.08, slide = 0) {
    if (!audioCtx || muted) return;
    const t0 = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(t0);
    osc.stop(t0 + dur);
  }

  function noiseBurst(dur = 0.08, vol = 0.05) {
    if (!audioCtx || muted) return;
    const t0 = audioCtx.currentTime;
    const len = Math.floor(audioCtx.sampleRate * dur);
    const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = audioCtx.createBufferSource();
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1800;
    src.buffer = buf;
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    src.start(t0);
  }

  const SFX = {
    bounce: () => beep(220, 0.06, "triangle", 0.05),
    brick: () => { beep(520, 0.08, "square", 0.06, -200); noiseBurst(0.05, 0.03); },
    power: () => beep(660, 0.14, "sawtooth", 0.055, 280),
    lose: () => beep(120, 0.35, "sawtooth", 0.07, -80),
    launch: () => beep(340, 0.1, "square", 0.045, 180),
    laser: () => { beep(880, 0.06, "sawtooth", 0.05, 400); beep(1200, 0.04, "square", 0.03); },
    bossHit: () => { beep(90, 0.12, "sawtooth", 0.08); noiseBurst(0.12, 0.06); },
    bossAppear: () => {
      beep(110, 0.25, "sawtooth", 0.08, 40);
      setTimeout(() => beep(165, 0.25, "sawtooth", 0.08), 120);
      setTimeout(() => beep(220, 0.35, "square", 0.09), 240);
    },
    clear: () => {
      beep(440, 0.1, "square", 0.06);
      setTimeout(() => beep(554, 0.1, "square", 0.06), 80);
      setTimeout(() => beep(659, 0.18, "square", 0.07), 160);
    },
  };

  function startBgm() {
    ensureAudio();
    if (bgmNodes || muted) return;

    const tempo = 0.22;
    const bass = audioCtx.createOscillator();
    const lead = audioCtx.createOscillator();
    const bassGain = audioCtx.createGain();
    const leadGain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    bass.type = "sawtooth";
    lead.type = "square";
    filter.type = "lowpass";
    filter.frequency.value = 900;
    bassGain.gain.value = 0.035;
    leadGain.gain.value = 0.02;

    bass.connect(filter);
    filter.connect(bassGain);
    bassGain.connect(masterGain);
    lead.connect(leadGain);
    leadGain.connect(masterGain);

    const bassNotes = [55, 55, 65.41, 49, 55, 73.42, 65.41, 49];
    const leadNotes = [220, 0, 277, 330, 0, 277, 247, 220, 0, 330, 370, 0];
    let step = 0;

    const lfo = setInterval(() => {
      if (!audioCtx || muted || !bgmNodes) return;
      const t = audioCtx.currentTime;
      const bn = bassNotes[step % bassNotes.length];
      const ln = leadNotes[step % leadNotes.length];
      bass.frequency.setTargetAtTime(bn, t, 0.01);
      if (ln > 0) {
        lead.frequency.setTargetAtTime(ln, t, 0.005);
        leadGain.gain.setTargetAtTime(0.018, t, 0.01);
      } else {
        leadGain.gain.setTargetAtTime(0.001, t, 0.02);
      }
      filter.frequency.setTargetAtTime(700 + (step % 4) * 180, t, 0.05);
      step++;
    }, tempo * 1000);

    bass.start();
    lead.start();
    bgmNodes = { bass, lead, bassGain, leadGain, filter, lfo };
  }

  function stopBgm() {
    if (!bgmNodes) return;
    clearInterval(bgmNodes.lfo);
    try {
      bgmNodes.bass.stop();
      bgmNodes.lead.stop();
    } catch (_) { /* already stopped */ }
    bgmNodes = null;
  }

  function setMuted(v) {
    muted = v;
    if (masterGain) masterGain.gain.value = muted ? 0 : 0.9;
    el.muteBtn.classList.toggle("muted", muted);
    el.muteBtn.textContent = muted ? "♪ MUTE" : "♪ BGM";
    if (muted) stopBgm();
    else if (state.mode === "playing" || state.mode === "boss") startBgm();
  }

  // ─── Ranking ─────────────────────────────────────────────
  function loadRanks() {
    try {
      return JSON.parse(localStorage.getItem(RANK_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function saveRank(name, score) {
    const ranks = loadRanks();
    ranks.push({
      name: (name || "PLAYER").trim().slice(0, 8).toUpperCase() || "PLAYER",
      score,
      date: Date.now(),
    });
    ranks.sort((a, b) => b.score - a.score);
    const top = ranks.slice(0, 8);
    localStorage.setItem(RANK_KEY, JSON.stringify(top));
    return top;
  }

  function renderRanks(targetId) {
    const list = document.getElementById(targetId);
    if (!list) return;
    const ranks = loadRanks();
    if (!ranks.length) {
      list.innerHTML = '<li><span class="rank-name">—</span><span>NO DATA</span></li>';
      return;
    }
    list.innerHTML = ranks
      .map(
        (r, i) =>
          `<li><span class="rank-name">${i + 1}. ${escapeHtml(r.name)}</span><span>${r.score}</span></li>`
      )
      .join("");
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ─── State ───────────────────────────────────────────────
  const state = {
    mode: "start",
    score: 0,
    lives: 3,
    level: 1,
    combo: 0,
    shake: 0,
    keys: { left: false, right: false },
    mouseX: null,
    paddle: null,
    balls: [],
    bricks: [],
    particles: [],
    powers: [],
    lasers: [],
    floating: [],
    stars: [],
    neonSigns: [],
    rain: [],
    tick: 0,
    attached: true,
    wideTimer: 0,
    slowTimer: 0,
    laserTimer: 0,
    laserCooldown: 0,
    bossTriggered: false,
    isBossStage: false,
    returnLevel: 1,
    flipTimer: 0,
    rankSaved: false,
  };

  // ─── Entities ────────────────────────────────────────────
  function makePaddle() {
    return { w: 110, h: 14, x: W / 2 - 55, y: H - 48, speed: 9, baseW: 110 };
  }

  function makeBall(x, y, vx = 0, vy = -BASE_BALL_SPEED) {
    return { x, y, r: 8, vx, vy, trail: [] };
  }

  function makeStars() {
    const stars = [];
    for (let i = 0; i < 80; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.6 + 0.3,
        a: Math.random() * 0.55 + 0.2,
        s: Math.random() * 0.35 + 0.1,
        color: ["#ff2bd6", "#00f0ff", "#ffe600", "#b14cff", "#39ff14"][i % 5],
      });
    }
    return stars;
  }

  function makeNeonSigns() {
    return [
      { text: "OPEN", x: 70, y: 120, color: "#ff2bd6", size: 28, phase: 0.9 },
      { text: "BAR", x: 720, y: 90, color: "#00f0ff", size: 32, phase: 1.4 },
      { text: "LIVE", x: 160, y: 520, color: "#ffe600", size: 22, phase: 2.1 },
      { text: "TOKYO", x: 620, y: 500, color: "#39ff14", size: 24, phase: 0.6 },
      { text: "24H", x: 420, y: 70, color: "#b14cff", size: 20, phase: 1.8 },
      { text: "BOSS", x: 780, y: 280, color: "#ff0040", size: 18, phase: 1.1 },
      { text: "ARCADE", x: 40, y: 300, color: "#00f0ff", size: 16, phase: 2.5 },
    ].map((d) => ({
      ...d,
      flicker: Math.random() * Math.PI * 2,
      speed: 0.04 + Math.random() * 0.08,
    }));
  }

  function makeRain() {
    const drops = [];
    for (let i = 0; i < 50; i++) {
      drops.push({
        x: Math.random() * W,
        y: Math.random() * H,
        len: Math.random() * 14 + 8,
        spd: Math.random() * 6 + 4,
        a: Math.random() * 0.25 + 0.08,
      });
    }
    return drops;
  }

  // Layout: 0 empty, 1-7 normal, 8 tough, 9 wide-item, 10 multi-item, 11 laser-item
  function levelLayout(level) {
    const rows = Math.min(4 + level, 9);
    const cols = 11;
    const grid = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        let cell = (r % 7) + 1;
        if (level >= 3 && (r + c) % 5 === 0) cell = 8;
        if (level >= 5 && r === 0) cell = 8;
        if (level === 2 && (c < 2 || c > cols - 3)) cell = 0;
        if (level === 4 && r % 2 === 1 && c % 2 === 0) cell = 0;
        if (level === 6 && Math.abs(c - 5) + Math.abs(r - 3) > 6) cell = 0;

        // Guaranteed item bricks
        if (c === 2 && r === Math.floor(rows / 2)) cell = 9; // wide
        if (c === 8 && r === Math.floor(rows / 2)) cell = 10; // multi ×3
        if (c === 5 && r === 1) cell = 11; // laser
        if (level >= 3 && c === 5 && r === rows - 1) cell = 10;

        row.push(cell);
      }
      grid.push(row);
    }
    return grid;
  }

  function brickFromCell(cell, x, y, w, h, r, c) {
    const tough = cell === 8;
    const itemType =
      cell === 9 ? "wide" : cell === 10 ? "multi" : cell === 11 ? "laser" : null;
    let color = tough
      ? "#fff5ff"
      : itemType === "wide"
        ? COLORS.cyan
        : itemType === "multi"
          ? COLORS.magenta
          : itemType === "laser"
            ? COLORS.hot
            : BRICK_PALETTE[(r + c) % BRICK_PALETTE.length];

    return {
      x, y, w, h,
      color,
      hp: tough ? 2 : itemType ? 1 : 1,
      maxHp: tough ? 2 : 1,
      alive: true,
      pattern: itemType ? "circuit" : PATTERNS[(r * 3 + c) % PATTERNS.length],
      itemType,
      isBoss: false,
    };
  }

  function buildBricks(level) {
    const grid = levelLayout(level);
    const cols = grid[0].length;
    const gap = 6;
    const top = 56;
    const side = 28;
    const bw = (W - side * 2 - gap * (cols - 1)) / cols;
    const bh = 22;
    const bricks = [];
    grid.forEach((row, r) => {
      row.forEach((cell, c) => {
        if (!cell) return;
        bricks.push(
          brickFromCell(cell, side + c * (bw + gap), top + r * (bh + gap), bw, bh, r, c)
        );
      });
    });
    return bricks;
  }

  function buildBossBrick() {
    return [{
      x: W / 2 - 160,
      y: 80,
      w: 320,
      h: 120,
      color: "#ff0040",
      hp: 40,
      maxHp: 40,
      alive: true,
      pattern: "boss",
      itemType: null,
      isBoss: true,
      vx: 2.2,
    }];
  }

  // ─── FX ──────────────────────────────────────────────────
  function spawnParticles(x, y, color, n = 10) {
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = Math.random() * 4 + 1.5;
      state.particles.push({
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 1,
        life: 1,
        decay: Math.random() * 0.03 + 0.02,
        size: Math.random() * 3.5 + 1.5,
        color,
      });
    }
  }

  function spawnFloat(x, y, text, color) {
    state.floating.push({ x, y, text, color, life: 1, vy: -1.2 });
  }

  // ─── Level / Game flow ───────────────────────────────────
  function resetBallOnPaddle() {
    const p = state.paddle;
    state.balls = [makeBall(p.x + p.w / 2, p.y - 10, 0, 0)];
    state.attached = true;
  }

  function startLevel(level) {
    state.level = level;
    state.isBossStage = false;
    stageEl.classList.remove("boss-mode");
    state.paddle = makePaddle();
    state.bricks = buildBricks(level);
    state.powers = [];
    state.lasers = [];
    state.particles = [];
    state.floating = [];
    state.combo = 0;
    state.wideTimer = 0;
    state.slowTimer = 0;
    state.laserTimer = 0;
    state.laserCooldown = 0;
    resetBallOnPaddle();
    el.level.textContent = String(level);
  }

  function startBossStage() {
    state.isBossStage = true;
    state.returnLevel = state.level;
    state.paddle = makePaddle();
    state.bricks = buildBossBrick();
    state.powers = [];
    state.lasers = [];
    state.particles = [];
    state.floating = [];
    state.combo = 0;
    state.laserTimer = 600; // free laser for boss
    state.wideTimer = 300;
    state.paddle.w = state.paddle.baseW * 1.4;
    resetBallOnPaddle();
    el.level.textContent = "BOSS";
    stageEl.classList.add("boss-mode");
    spawnFloat(W / 2, H / 2, "BOSS BATTLE!", COLORS.hot);
    SFX.bossAppear();
  }

  function triggerBossTransition() {
    state.bossTriggered = true;
    ensureAudio();
    SFX.bossAppear();
    stageEl.classList.add("flipping");
    state.flipTimer = 70;
    setMode("bossIntro");
    setTimeout(() => {
      stageEl.classList.remove("flipping");
    }, 1100);
  }

  function newGame() {
    ensureAudio();
    startBgm();
    state.score = 0;
    state.lives = 3;
    state.bossTriggered = false;
    state.isBossStage = false;
    state.rankSaved = false;
    state.stars = makeStars();
    state.neonSigns = makeNeonSigns();
    state.rain = makeRain();
    stageEl.classList.remove("boss-mode", "flipping");
    startLevel(1);
    updateHud();
    setMode("playing");
  }

  function updateHud() {
    el.score.textContent = String(state.score);
    el.level.textContent = state.isBossStage ? "BOSS" : String(state.level);
    el.lives.textContent = "♥".repeat(Math.max(0, state.lives)) || "—";
  }

  function setMode(mode) {
    state.mode = mode;
    const showOverlay = !["playing", "bossIntro"].includes(mode);
    el.overlay.classList.toggle("hidden", !showOverlay);

    Object.values(el.panels).forEach((p) => p.classList.add("hidden"));
    if (mode === "start") {
      el.panels.start.classList.remove("hidden");
      renderRanks("rank-list-start");
    }
    if (mode === "paused") el.panels.pause.classList.remove("hidden");
    if (mode === "level") el.panels.level.classList.remove("hidden");
    if (mode === "boss") el.panels.boss.classList.remove("hidden");
    if (mode === "over") {
      el.panels.over.classList.remove("hidden");
      renderRanks("rank-list-over");
    }
    if (mode === "win") {
      el.panels.win.classList.remove("hidden");
      renderRanks("rank-list-win");
    }
  }

  function endGame(won) {
    stopBgm();
    state.rankSaved = false;
    if (won) {
      el.winScore.textContent = String(state.score);
      setMode("win");
    } else {
      el.finalScore.textContent = String(state.score);
      setMode("over");
    }
  }

  // ─── Controls ────────────────────────────────────────────
  function launchBall() {
    if (!state.attached || !state.balls.length) return;
    const b = state.balls[0];
    const angle = -Math.PI / 2 + (Math.random() * 0.5 - 0.25);
    const speed = ballSpeed();
    b.vx = Math.cos(angle) * speed;
    b.vy = Math.sin(angle) * speed;
    state.attached = false;
    SFX.launch();
  }

  function speedMul() {
    return SPEED_PRESETS[speedIndex];
  }

  function ballSpeed() {
    const base = BASE_BALL_SPEED + (state.level - 1) * 0.35;
    const s = state.slowTimer > 0 ? base * 0.7 : base;
    return s * speedMul();
  }

  function updateSpeedBtn() {
    const mul = speedMul();
    el.speedBtn.textContent = `⏩ ${SPEED_LABELS[speedIndex]}`;
    el.speedBtn.dataset.speed = String(mul);
    el.speedBtn.title = `게임 속도 ${SPEED_LABELS[speedIndex]} (클릭으로 변경)`;
  }

  function setSpeedIndex(next) {
    const prev = speedMul();
    speedIndex = ((next % SPEED_PRESETS.length) + SPEED_PRESETS.length) % SPEED_PRESETS.length;
    const neu = speedMul();
    const ratio = neu / prev;
    if (!state.attached) {
      state.balls.forEach((b) => {
        b.vx *= ratio;
        b.vy *= ratio;
      });
    }
    state.lasers.forEach((L) => {
      L.vy *= ratio;
    });
    state.bricks.forEach((b) => {
      if (b.isBoss && typeof b.vx === "number") b.vx *= ratio;
    });
    updateSpeedBtn();
  }

  function cycleSpeed() {
    setSpeedIndex(speedIndex + 1);
  }

  function fireLaser() {
    if (state.mode !== "playing") return;
    if (state.laserTimer <= 0 || state.laserCooldown > 0 || state.attached) return;
    const p = state.paddle;
    const laserVy = -14 * speedMul();
    const shots = [
      { x: p.x + 12, y: p.y, vy: laserVy, w: 3, h: 16 },
      { x: p.x + p.w - 15, y: p.y, vy: laserVy, w: 3, h: 16 },
    ];
    state.lasers.push(...shots);
    state.laserCooldown = 10;
    SFX.laser();
  }

  document.getElementById("btn-start").addEventListener("click", newGame);
  document.getElementById("btn-resume").addEventListener("click", () => setMode("playing"));
  document.getElementById("btn-next").addEventListener("click", () => {
    startLevel(state.level + 1);
    updateHud();
    setMode("playing");
  });
  document.getElementById("btn-boss").addEventListener("click", () => {
    startBossStage();
    setMode("playing");
  });
  document.getElementById("btn-retry").addEventListener("click", newGame);
  document.getElementById("btn-again").addEventListener("click", newGame);

  document.getElementById("btn-save-rank").addEventListener("click", () => {
    if (state.rankSaved) return;
    saveRank(el.playerName.value, state.score);
    state.rankSaved = true;
    renderRanks("rank-list-over");
  });
  document.getElementById("btn-save-rank-win").addEventListener("click", () => {
    if (state.rankSaved) return;
    saveRank(el.playerNameWin.value, state.score);
    state.rankSaved = true;
    renderRanks("rank-list-win");
  });

  el.muteBtn.addEventListener("click", () => {
    ensureAudio();
    setMuted(!muted);
  });

  el.speedBtn.addEventListener("click", () => {
    cycleSpeed();
  });

  window.addEventListener("keydown", (e) => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") state.keys.left = true;
    if (e.code === "ArrowRight" || e.code === "KeyD") state.keys.right = true;
    if (e.code === "KeyZ") {
      e.preventDefault();
      fireLaser();
    }
    if (e.code === "Space") {
      e.preventDefault();
      ensureAudio();
      if (state.mode === "start" || state.mode === "over" || state.mode === "win") {
        newGame();
      } else if (state.mode === "level") {
        startLevel(state.level + 1);
        updateHud();
        setMode("playing");
      } else if (state.mode === "boss") {
        startBossStage();
        setMode("playing");
      } else if (state.mode === "playing") {
        if (state.attached) launchBall();
        else setMode("paused");
      } else if (state.mode === "paused") {
        setMode("playing");
      }
    }
  });

  window.addEventListener("keyup", (e) => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") state.keys.left = false;
    if (e.code === "ArrowRight" || e.code === "KeyD") state.keys.right = false;
  });

  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    state.mouseX = ((e.clientX - rect.left) / rect.width) * W;
  });

  canvas.addEventListener("click", () => {
    ensureAudio();
    if (state.mode !== "playing") return;
    if (state.attached) launchBall();
    else fireLaser();
  });

  canvas.addEventListener(
    "touchmove",
    (e) => {
      e.preventDefault();
      const t = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      state.mouseX = ((t.clientX - rect.left) / rect.width) * W;
    },
    { passive: false }
  );

  canvas.addEventListener("touchstart", (e) => {
    ensureAudio();
    if (state.mode === "playing") {
      e.preventDefault();
      if (state.attached) launchBall();
      else fireLaser();
    }
  });

  // ─── Collision ───────────────────────────────────────────
  function circleRect(cx, cy, r, rx, ry, rw, rh) {
    const nearestX = Math.max(rx, Math.min(cx, rx + rw));
    const nearestY = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - nearestX;
    const dy = cy - nearestY;
    return dx * dx + dy * dy <= r * r;
  }

  function bounceBallOffRect(ball, rx, ry, rw, rh) {
    const nearestX = Math.max(rx, Math.min(ball.x, rx + rw));
    const nearestY = Math.max(ry, Math.min(ball.y, ry + rh));
    const dx = ball.x - nearestX;
    const dy = ball.y - nearestY;
    if (Math.abs(dx) > Math.abs(dy)) {
      ball.vx *= -1;
      ball.x = dx > 0 ? rx + rw + ball.r : rx - ball.r;
    } else {
      ball.vy *= -1;
      ball.y = dy > 0 ? ry + rh + ball.r : ry - ball.r;
    }
  }

  function dropPower(x, y, type) {
    const def = POWER_DEFS[type];
    if (!def) return;
    state.powers.push({ x, y, r: 13, vy: 2.4, ...def });
  }

  function maybeDropPower(brick) {
    if (brick.itemType) {
      dropPower(brick.x + brick.w / 2, brick.y + brick.h / 2, brick.itemType);
      return;
    }
    if (brick.isBoss) return;
    if (Math.random() > 0.5) return;
    const type = RANDOM_POWERS[Math.floor(Math.random() * RANDOM_POWERS.length)];
    dropPower(brick.x + brick.w / 2, brick.y + brick.h / 2, type);
  }

  function applyPower(type) {
    SFX.power();
    if (type === "wide") {
      state.wideTimer = 480;
      state.paddle.w = state.paddle.baseW * 1.65;
      spawnFloat(state.paddle.x + state.paddle.w / 2, state.paddle.y - 20, "WIDE!", COLORS.cyan);
    } else if (type === "multi") {
      // Exactly expand to 3 balls from current balls
      if (state.attached) {
        state.attached = false;
        const b = state.balls[0];
        const spd = ballSpeed();
        state.balls = [
          makeBall(b.x, b.y, -spd * 0.7, -spd * 0.75),
          makeBall(b.x, b.y, 0, -spd),
          makeBall(b.x, b.y, spd * 0.7, -spd * 0.75),
        ];
      } else {
        const base = state.balls[0] || { x: W / 2, y: H / 2, vx: 0, vy: -ballSpeed() };
        const spd = ballSpeed();
        while (state.balls.length < 3) {
          const ang = (-Math.PI / 2) + (state.balls.length - 1) * 0.45;
          state.balls.push(
            makeBall(base.x, base.y, Math.cos(ang) * spd, Math.sin(ang) * spd)
          );
        }
      }
      spawnFloat(W / 2, H / 2, "×3 BALLS!", COLORS.magenta);
    } else if (type === "laser") {
      state.laserTimer = 540;
      spawnFloat(W / 2, H / 2 - 30, "LASER!", COLORS.hot);
    } else if (type === "slow") {
      state.slowTimer = 420;
      state.balls.forEach((b) => {
        if (state.attached) return;
        const spd = Math.hypot(b.vx, b.vy) || ballSpeed();
        const scale = ballSpeed() / spd;
        b.vx *= scale;
        b.vy *= scale;
      });
      spawnFloat(W / 2, H / 2 - 40, "SLOW!", COLORS.amber);
    } else if (type === "life") {
      state.lives = Math.min(state.lives + 1, 5);
      updateHud();
      spawnFloat(W / 2, H / 2, "+LIFE", COLORS.lime);
    }
  }

  function damageBrick(brick, fromLaser = false) {
    brick.hp -= 1;
    if (brick.isBoss) {
      SFX.bossHit();
      state.shake = Math.min(state.shake + 5, 14);
      spawnParticles(brick.x + brick.w / 2, brick.y + brick.h / 2, COLORS.hot, 8);
      // Flash color by HP
      const ratio = brick.hp / brick.maxHp;
      brick.color = ratio > 0.6 ? "#ff0040" : ratio > 0.3 ? "#ff7a00" : "#ffe600";
    }

    if (brick.hp <= 0) {
      brick.alive = false;
      state.combo += 1;
      const pts = brick.isBoss
        ? 500
        : 10 * state.level + (state.combo > 1 ? state.combo * 2 : 0);
      state.score += pts;
      spawnParticles(
        brick.x + brick.w / 2,
        brick.y + brick.h / 2,
        brick.color,
        brick.isBoss ? 40 : 14
      );
      if (state.combo > 1 && !brick.isBoss) {
        spawnFloat(brick.x + brick.w / 2, brick.y, `x${state.combo}`, COLORS.amber);
      }
      if (brick.isBoss) {
        spawnFloat(W / 2, H / 2, "+500 BOSS CLEAR!", COLORS.amber);
        SFX.clear();
      } else {
        maybeDropPower(brick);
        SFX.brick();
      }
      state.shake = Math.min(state.shake + (brick.isBoss ? 16 : 3), 18);
      checkBossTrigger();
    } else if (!brick.isBoss) {
      if (brick.maxHp > 1) brick.color = "#c0a8d8";
      spawnParticles(brick.x + brick.w / 2, brick.y + brick.h / 2, COLORS.white, 5);
      state.score += fromLaser ? 2 : 5;
      if (!fromLaser) SFX.bounce();
    }
    updateHud();
  }

  function hitBrick(brick, ball) {
    damageBrick(brick, false);
    if (brick.alive) bounceBallOffRect(ball, brick.x, brick.y, brick.w, brick.h);
    else if (ball) {
      // Still reverse a bit so ball doesn't tunnel
      ball.vy *= -1;
    }
  }

  function checkBossTrigger() {
    if (
      !state.bossTriggered &&
      !state.isBossStage &&
      state.score >= BOSS_SCORE_TRIGGER &&
      state.mode === "playing"
    ) {
      triggerBossTransition();
    }
  }

  // ─── Update ──────────────────────────────────────────────
  function update() {
    state.tick++;

    state.neonSigns.forEach((sign) => {
      sign.flicker += sign.speed;
    });
    state.rain.forEach((d) => {
      d.y += d.spd;
      d.x += 0.4;
      if (d.y > H) {
        d.y = -10;
        d.x = Math.random() * W;
      }
    });

    // Flip intro → boss panel
    if (state.mode === "bossIntro") {
      if (state.flipTimer > 0) state.flipTimer--;
      if (state.flipTimer <= 0) setMode("boss");
      return;
    }

    if (state.mode !== "playing") return;

    const p = state.paddle;

    if (state.wideTimer > 0) {
      state.wideTimer--;
      if (state.wideTimer === 0) p.w = p.baseW;
    }
    if (state.slowTimer > 0) state.slowTimer--;
    if (state.laserTimer > 0) state.laserTimer--;
    if (state.laserCooldown > 0) state.laserCooldown--;

    if (state.shake > 0) state.shake *= 0.85;
    if (state.shake < 0.3) state.shake = 0;

    // Paddle
    const sm = speedMul();
    if (state.keys.left) p.x -= p.speed * sm;
    if (state.keys.right) p.x += p.speed * sm;
    if (state.mouseX !== null) p.x = state.mouseX - p.w / 2;
    p.x = Math.max(8, Math.min(W - p.w - 8, p.x));

    if (state.attached && state.balls[0]) {
      state.balls[0].x = p.x + p.w / 2;
      state.balls[0].y = p.y - state.balls[0].r - 2;
      state.balls[0].vx = 0;
      state.balls[0].vy = 0;
    }

    // Boss movement
    if (state.isBossStage) {
      const boss = state.bricks.find((b) => b.isBoss && b.alive);
      if (boss) {
        boss.x += boss.vx;
        if (boss.x < 20 || boss.x + boss.w > W - 20) boss.vx *= -1;
        boss.y = 80 + Math.sin(state.tick * 0.04) * 18;
      }
    }

    // Lasers
    for (let i = state.lasers.length - 1; i >= 0; i--) {
      const L = state.lasers[i];
      L.y += L.vy;
      let hit = false;
      for (const brick of state.bricks) {
        if (!brick.alive) continue;
        if (
          L.x < brick.x + brick.w &&
          L.x + L.w > brick.x &&
          L.y < brick.y + brick.h &&
          L.y + L.h > brick.y
        ) {
          damageBrick(brick, true);
          hit = true;
          break;
        }
      }
      if (hit || L.y + L.h < 0) state.lasers.splice(i, 1);
    }

    // Balls
    for (let i = state.balls.length - 1; i >= 0; i--) {
      const b = state.balls[i];
      if (state.attached && i === 0) continue;

      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > 8) b.trail.shift();

      b.x += b.vx;
      b.y += b.vy;

      if (b.x - b.r < 0) {
        b.x = b.r;
        b.vx = Math.abs(b.vx);
        SFX.bounce();
      } else if (b.x + b.r > W) {
        b.x = W - b.r;
        b.vx = -Math.abs(b.vx);
        SFX.bounce();
      }
      if (b.y - b.r < 0) {
        b.y = b.r;
        b.vy = Math.abs(b.vy);
        SFX.bounce();
      }

      if (circleRect(b.x, b.y, b.r, p.x, p.y, p.w, p.h) && b.vy > 0) {
        const hit = (b.x - (p.x + p.w / 2)) / (p.w / 2);
        const angle = hit * (Math.PI / 3);
        const spd = ballSpeed();
        b.vx = Math.sin(angle) * spd;
        b.vy = -Math.cos(angle) * spd;
        b.y = p.y - b.r - 1;
        state.combo = 0;
        SFX.bounce();
      }

      for (const brick of state.bricks) {
        if (!brick.alive) continue;
        if (circleRect(b.x, b.y, b.r, brick.x, brick.y, brick.w, brick.h)) {
          hitBrick(brick, b);
          break;
        }
      }

      if (b.y - b.r > H + 20) state.balls.splice(i, 1);
    }

    if (state.balls.length === 0) {
      state.lives -= 1;
      updateHud();
      state.shake = 12;
      SFX.lose();
      if (state.lives <= 0) {
        endGame(false);
      } else {
        state.paddle.w = state.paddle.baseW;
        state.wideTimer = 0;
        resetBallOnPaddle();
      }
    }

    // Powers
    for (let i = state.powers.length - 1; i >= 0; i--) {
      const pw = state.powers[i];
      pw.y += pw.vy * sm;
      if (
        pw.y + pw.r > p.y &&
        pw.y - pw.r < p.y + p.h &&
        pw.x > p.x &&
        pw.x < p.x + p.w
      ) {
        applyPower(pw.type);
        state.powers.splice(i, 1);
      } else if (pw.y - pw.r > H) {
        state.powers.splice(i, 1);
      }
    }

    for (let i = state.particles.length - 1; i >= 0; i--) {
      const pt = state.particles[i];
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.vy += 0.12;
      pt.life -= pt.decay;
      if (pt.life <= 0) state.particles.splice(i, 1);
    }
    for (let i = state.floating.length - 1; i >= 0; i--) {
      const f = state.floating[i];
      f.y += f.vy;
      f.life -= 0.018;
      if (f.life <= 0) state.floating.splice(i, 1);
    }

    state.stars.forEach((s) => {
      s.y += s.s;
      if (s.y > H) {
        s.y = 0;
        s.x = Math.random() * W;
      }
    });

    // Clear check (skip if boss transition already started this frame)
    if (state.mode === "playing" && state.bricks.every((b) => !b.alive)) {
      if (state.isBossStage) {
        state.isBossStage = false;
        stageEl.classList.remove("boss-mode");
        state.score += 200; // clear bonus
        updateHud();
        spawnFloat(W / 2, H / 2 - 40, "BONUS +200", COLORS.amber);
        SFX.clear();
        // Resume normal levels
        if (state.returnLevel >= MAX_LEVEL) {
          endGame(true);
        } else {
          el.levelMsg.textContent = `보스 처치! 레벨 ${state.returnLevel + 1} 로!`;
          state.level = state.returnLevel;
          setMode("level");
        }
      } else {
        SFX.clear();
        if (state.level >= MAX_LEVEL) {
          endGame(true);
        } else {
          el.levelMsg.textContent = `레벨 ${state.level} 클리어! 점수 ${state.score}`;
          setMode("level");
        }
      }
    }
  }

  // ─── Draw helpers ────────────────────────────────────────
  function roundRect(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function shade(hex, amt) {
    const n = hex.replace("#", "");
    const num = parseInt(n, 16);
    let r = (num >> 16) + amt;
    let g = ((num >> 8) & 0xff) + amt;
    let b = (num & 0xff) + amt;
    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
  }

  function drawBrickPattern(brick) {
    const { x, y, w, h, pattern } = brick;
    ctx.save();
    ctx.beginPath();
    roundRect(x, y, w, h, brick.isBoss ? 10 : 5);
    ctx.clip();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 1.2;

    if (pattern === "stripe") {
      for (let i = -h; i < w + h; i += 7) {
        ctx.beginPath();
        ctx.moveTo(x + i, y);
        ctx.lineTo(x + i + h, y + h);
        ctx.stroke();
      }
    } else if (pattern === "diamond") {
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y + 3);
      ctx.lineTo(x + w - 4, y + h / 2);
      ctx.lineTo(x + w / 2, y + h - 3);
      ctx.lineTo(x + 4, y + h / 2);
      ctx.closePath();
      ctx.stroke();
    } else if (pattern === "dots") {
      for (let dy = 6; dy < h; dy += 7) {
        for (let dx = 6; dx < w; dx += 8) {
          ctx.beginPath();
          ctx.arc(x + dx, y + dy, 1.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (pattern === "chevron") {
      for (let row = 0; row < 3; row++) {
        const yy = y + 5 + row * 6;
        ctx.beginPath();
        ctx.moveTo(x + 4, yy + 4);
        ctx.lineTo(x + w / 2, yy);
        ctx.lineTo(x + w - 4, yy + 4);
        ctx.stroke();
      }
    } else if (pattern === "circuit") {
      ctx.beginPath();
      ctx.moveTo(x + 4, y + h / 2);
      ctx.lineTo(x + w * 0.35, y + h / 2);
      ctx.lineTo(x + w * 0.35, y + 4);
      ctx.lineTo(x + w * 0.7, y + 4);
      ctx.lineTo(x + w * 0.7, y + h - 4);
      ctx.lineTo(x + w - 4, y + h - 4);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + w * 0.35, y + h / 2, 2.2, 0, Math.PI * 2);
      ctx.arc(x + w * 0.7, y + 4, 2.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (pattern === "hex") {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const rad = Math.min(w, h) * 0.28;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const px = cx + Math.cos(a) * rad;
        const py = cy + Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    } else if (pattern === "wave") {
      ctx.beginPath();
      for (let i = 0; i <= w; i += 2) {
        const py = y + h / 2 + Math.sin(i * 0.35) * (h * 0.25);
        if (i === 0) ctx.moveTo(x + i, py);
        else ctx.lineTo(x + i, py);
      }
      ctx.stroke();
    } else if (pattern === "boss") {
      // Eyes + crown
      ctx.fillStyle = "rgba(255,230,0,0.85)";
      ctx.beginPath();
      ctx.arc(x + w * 0.35, y + h * 0.42, 12, 0, Math.PI * 2);
      ctx.arc(x + w * 0.65, y + h * 0.42, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#12001a";
      ctx.beginPath();
      ctx.arc(x + w * 0.35, y + h * 0.42, 5, 0, Math.PI * 2);
      ctx.arc(x + w * 0.65, y + h * 0.42, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,230,0,0.7)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + 30, y + 22);
      ctx.lineTo(x + 55, y + 8);
      ctx.lineTo(x + w / 2, y + 24);
      ctx.lineTo(x + w - 55, y + 8);
      ctx.lineTo(x + w - 30, y + 22);
      ctx.stroke();
      // HP bar
      const ratio = brick.hp / brick.maxHp;
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(x + 24, y + h - 22, w - 48, 10);
      ctx.fillStyle = ratio > 0.3 ? COLORS.hot : COLORS.amber;
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 10;
      ctx.fillRect(x + 24, y + h - 22, (w - 48) * ratio, 10);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#fff";
      ctx.font = "bold 14px Orbitron, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`BOSS ${brick.hp}/${brick.maxHp}`, x + w / 2, y + h - 36);
    }

    // Item badge
    if (brick.itemType && brick.alive) {
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.font = "bold 10px Orbitron, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const label =
        brick.itemType === "wide" ? "W" : brick.itemType === "multi" ? "×3" : "L";
      ctx.fillText(label, x + w / 2, y + h / 2);
    }

    ctx.restore();
  }

  function drawBackground() {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    if (state.isBossStage) {
      grad.addColorStop(0, "#2a0510");
      grad.addColorStop(0.5, "#1a0218");
      grad.addColorStop(1, "#0a0108");
    } else {
      grad.addColorStop(0, "#1a0a2e");
      grad.addColorStop(0.45, "#12061f");
      grad.addColorStop(1, "#05010d");
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    const cityGlow = ctx.createLinearGradient(0, H * 0.55, 0, H);
    cityGlow.addColorStop(0, "rgba(255, 43, 214, 0)");
    cityGlow.addColorStop(0.5, "rgba(255, 43, 214, 0.08)");
    cityGlow.addColorStop(1, "rgba(0, 240, 255, 0.1)");
    ctx.fillStyle = cityGlow;
    ctx.fillRect(0, 0, W, H);

    const buildings = [
      [0, 380, 70, 220], [70, 420, 50, 180], [120, 360, 80, 240],
      [200, 440, 40, 160], [700, 400, 60, 200], [760, 350, 70, 250],
      [830, 430, 70, 170], [40, 480, 90, 120], [640, 460, 55, 140],
    ];
    buildings.forEach(([bx, by, bw, bh], bi) => {
      ctx.fillStyle = "rgba(8, 2, 20, 0.9)";
      ctx.fillRect(bx, by, bw, bh);
      for (let wy = by + 10; wy < by + bh - 8; wy += 14) {
        for (let wx = bx + 6; wx < bx + bw - 6; wx += 12) {
          const seed = (wx * 13 + wy * 7 + bi * 31) % 100;
          const blink = ((state.tick + seed * 3) % 120) < 10;
          if (seed > 40 || blink) {
            ctx.fillStyle = seed % 2 === 0
              ? "rgba(0, 240, 255, 0.4)"
              : "rgba(255, 43, 214, 0.35)";
            ctx.fillRect(wx, wy, 5, 6);
          }
        }
      }
    });

    state.neonSigns.forEach((sign) => {
      const pulse = 0.55 + 0.45 * Math.abs(Math.sin(sign.flicker));
      const hardOff = Math.sin(sign.flicker * 3.7 + sign.phase) > 0.92 ? 0.15 : 1;
      const alpha = pulse * hardOff * 0.85;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `900 ${sign.size}px Orbitron, sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.shadowColor = sign.color;
      ctx.shadowBlur = 22;
      ctx.fillStyle = sign.color;
      ctx.fillText(sign.text, sign.x, sign.y);
      ctx.restore();
    });

    state.rain.forEach((d) => {
      ctx.strokeStyle = `rgba(180, 220, 255, ${d.a})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - 1.5, d.y + d.len);
      ctx.stroke();
    });

    state.stars.forEach((s) => {
      ctx.globalAlpha = s.a * (0.7 + 0.3 * Math.sin(state.tick * 0.05 + s.x));
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    ctx.strokeStyle = state.isBossStage
      ? "rgba(255, 0, 64, 0.5)"
      : "rgba(255, 43, 214, 0.35)";
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, W - 16, H - 16);
  }

  function draw() {
    ctx.save();
    if (state.shake > 0) {
      ctx.translate(
        (Math.random() - 0.5) * state.shake,
        (Math.random() - 0.5) * state.shake
      );
    }

    // Screen invert flash during flip intro
    if (state.mode === "bossIntro") {
      ctx.filter = `hue-rotate(${(70 - state.flipTimer) * 4}deg) invert(${Math.min(1, (70 - state.flipTimer) / 40)})`;
    }

    drawBackground();

    // Bricks
    state.bricks.forEach((brick) => {
      if (!brick.alive) return;
      ctx.save();
      ctx.shadowColor = brick.color;
      ctx.shadowBlur = brick.isBoss ? 28 : 18;
      roundRect(brick.x, brick.y, brick.w, brick.h, brick.isBoss ? 10 : 5);
      const g = ctx.createLinearGradient(brick.x, brick.y, brick.x + brick.w, brick.y + brick.h);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.25, brick.color);
      g.addColorStop(1, shade(brick.color, -40));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 1;
      roundRect(brick.x + 0.5, brick.y + 0.5, brick.w - 1, brick.h - 1, brick.isBoss ? 10 : 5);
      ctx.stroke();
      drawBrickPattern(brick);
      if (brick.maxHp > 1 && !brick.isBoss) {
        ctx.fillStyle = "rgba(20,0,40,0.45)";
        ctx.font = "bold 11px Orbitron, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(brick.hp), brick.x + brick.w / 2, brick.y + brick.h / 2 + 1);
      }
      ctx.restore();
    });

    // Powers
    state.powers.forEach((pw) => {
      ctx.save();
      ctx.shadowColor = pw.color;
      ctx.shadowBlur = 16;
      ctx.fillStyle = pw.color;
      ctx.beginPath();
      ctx.arc(pw.x, pw.y, pw.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#041016";
      ctx.font = "bold 10px Orbitron, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(pw.label, pw.x, pw.y + 1);
      ctx.restore();
    });

    // Lasers
    state.lasers.forEach((L) => {
      ctx.save();
      ctx.shadowColor = COLORS.hot;
      ctx.shadowBlur = 12;
      const lg = ctx.createLinearGradient(L.x, L.y, L.x, L.y + L.h);
      lg.addColorStop(0, "#fff");
      lg.addColorStop(0.4, COLORS.hot);
      lg.addColorStop(1, COLORS.magenta);
      ctx.fillStyle = lg;
      ctx.fillRect(L.x, L.y, L.w, L.h);
      ctx.restore();
    });

    // Paddle
    if (state.paddle) {
      const p = state.paddle;
      ctx.save();
      ctx.shadowColor = state.laserTimer > 0 ? COLORS.hot : COLORS.cyan;
      ctx.shadowBlur = 18;
      roundRect(p.x, p.y, p.w, p.h, 7);
      const pg = ctx.createLinearGradient(p.x, p.y, p.x + p.w, p.y);
      if (state.laserTimer > 0) {
        pg.addColorStop(0, COLORS.hot);
        pg.addColorStop(0.5, COLORS.magenta);
        pg.addColorStop(1, COLORS.hot);
      } else {
        pg.addColorStop(0, "#1ab8c4");
        pg.addColorStop(0.5, COLORS.cyan);
        pg.addColorStop(1, "#1ab8c4");
      }
      ctx.fillStyle = pg;
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      roundRect(p.x + 4, p.y + 2, p.w - 8, 4, 2);
      ctx.fill();
      // Laser cannons
      if (state.laserTimer > 0) {
        ctx.fillStyle = COLORS.amber;
        ctx.fillRect(p.x + 8, p.y - 6, 6, 6);
        ctx.fillRect(p.x + p.w - 14, p.y - 6, 6, 6);
      }
      ctx.restore();
    }

    // Balls
    state.balls.forEach((b) => {
      b.trail.forEach((t, i) => {
        ctx.globalAlpha = ((i + 1) / b.trail.length) * 0.35;
        ctx.fillStyle = COLORS.cyan;
        ctx.beginPath();
        ctx.arc(t.x, t.y, b.r * (0.4 + (i / b.trail.length) * 0.5), 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      ctx.save();
      ctx.shadowColor = COLORS.magenta;
      ctx.shadowBlur = 16;
      const bg = ctx.createRadialGradient(b.x - 2, b.y - 2, 1, b.x, b.y, b.r);
      bg.addColorStop(0, "#fff");
      bg.addColorStop(0.4, COLORS.cyan);
      bg.addColorStop(1, COLORS.magenta);
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    state.particles.forEach((pt) => {
      ctx.globalAlpha = Math.max(0, pt.life);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size * pt.life, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    state.floating.forEach((f) => {
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.fillStyle = f.color;
      ctx.font = "bold 16px Orbitron, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(f.text, f.x, f.y);
    });
    ctx.globalAlpha = 1;

    if (state.mode === "playing" && state.attached) {
      ctx.fillStyle = "rgba(232, 241, 255, 0.75)";
      ctx.font = "600 18px Rajdhani, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("SPACE / 클릭으로 발사", W / 2, H - 80);
    }

    if (state.mode === "playing") {
      let badgeY = H - 18;
      ctx.font = "bold 11px Orbitron, sans-serif";
      ctx.textAlign = "left";
      if (state.laserTimer > 0) {
        ctx.fillStyle = COLORS.hot;
        ctx.fillText(`LASER ${Math.ceil(state.laserTimer / 60)}s  [Z]`, 16, badgeY);
        badgeY -= 16;
      }
      if (state.wideTimer > 0) {
        ctx.fillStyle = COLORS.cyan;
        ctx.fillText(`WIDE ${Math.ceil(state.wideTimer / 60)}s`, 16, badgeY);
        badgeY -= 16;
      }
      if (state.slowTimer > 0) {
        ctx.fillStyle = COLORS.amber;
        ctx.fillText(`SLOW ${Math.ceil(state.slowTimer / 60)}s`, 16, badgeY);
      }
      if (state.isBossStage) {
        ctx.textAlign = "center";
        ctx.fillStyle = COLORS.hot;
        ctx.font = "bold 14px Orbitron, sans-serif";
        ctx.fillText("★ BONUS BOSS STAGE ★", W / 2, 36);
      }
    }

    ctx.restore();
  }

  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  // Init
  state.stars = makeStars();
  state.neonSigns = makeNeonSigns();
  state.rain = makeRain();
  state.paddle = makePaddle();
  state.bricks = buildBricks(1);
  state.balls = [makeBall(state.paddle.x + state.paddle.w / 2, state.paddle.y - 10)];
  state.attached = true;
  updateSpeedBtn();
  renderRanks("rank-list-start");
  setMode("start");
  loop();
})();
