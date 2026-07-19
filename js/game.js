'use strict';

/** @type {'menu'|'play'|'win'} */
let state = 'menu';

let modeId = 'easy';
/** Target letter for this find (uppercase A–Z) */
let targetLetter = 'A';
/** Cards on the picnic blanket */
let cards = [];
/** Finds completed this session */
let sessionFinds = 0;
/** Correct taps this session */
let sessionTaps = 0;
/** Target finds before win (0 = endless) */
let findsTarget = 0;

let hintTimer = 0;
let skyPhase = 0;
let bob = 0;
let winFlash = 0;
/** Glow the target card when hinting */
let showHint = false;
let celebrateLock = false;
/** Ant friend bob for picnic scene */
let antBob = 0;

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function shuffleWith(arr, rng) {
  const a = arr.slice();
  const r = rng || Math.random;
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function currentMode() {
  return MODES[modeId] || MODES.easy;
}

/**
 * Letter index 0–25 for A–Z. Invalid → -1.
 * @param {string} letter
 */
function letterIndex(letter) {
  if (!letter || typeof letter !== 'string') return -1;
  const c = letter.toUpperCase().charCodeAt(0);
  if (c < 65 || c > 90) return -1;
  return c - 65;
}

/**
 * Normalize to uppercase A–Z or empty.
 * @param {string} letter
 */
function normalizeLetter(letter) {
  const i = letterIndex(letter);
  if (i < 0) return '';
  return String.fromCharCode(65 + i);
}

/**
 * Pure: list of uppercase letters from 'A' through lastLetter inclusive.
 * @param {string} lastLetter e.g. 'E', 'M', 'Z'
 * @returns {string[]}
 */
function letterRange(lastLetter) {
  const end = letterIndex(lastLetter);
  const last = end < 0 ? 4 : Math.min(25, end);
  const out = [];
  for (let i = 0; i <= last; i++) out.push(String.fromCharCode(65 + i));
  return out;
}

/**
 * Pure: pick target + distractors from pool.
 * Always includes target; total length = choiceCount.
 * @param {string[]} pool
 * @param {number} choiceCount
 * @param {() => number} [rng]
 * @returns {{ target: string, letters: string[] }}
 */
function pickRoundLetters(pool, choiceCount, rng) {
  const r = rng || Math.random;
  const p = (pool && pool.length) ? pool.slice() : letterRange('E');
  const n = Math.max(2, Math.min(choiceCount | 0, p.length));
  const shuffled = shuffleWith(p, r);
  const target = shuffled[0];
  // Rest of pool excluding target for distractors
  const rest = shuffleWith(p.filter(L => L !== target), r);
  const letters = [target, ...rest.slice(0, n - 1)];
  return { target, letters: shuffleWith(letters, r) };
}

/**
 * Pure: is this the correct letter?
 * @param {string} letter
 * @param {string} target
 * @param {boolean} alreadyFound
 */
function isCorrectLetter(letter, target, alreadyFound) {
  if (alreadyFound) return false;
  const a = normalizeLetter(letter);
  const b = normalizeLetter(target);
  if (!a || !b) return false;
  return a === b;
}

function colorOf(letter) {
  const i = letterIndex(letter);
  if (i < 0) return LETTER_PALETTE[0];
  return LETTER_PALETTE[i % LETTER_PALETTE.length];
}

function foodOf(letter) {
  const i = letterIndex(letter);
  if (i < 0) return FOODS[0];
  return FOODS[i % FOODS.length];
}

/**
 * Pure card layout on picnic blanket.
 * @param {string[]} letters
 * @param {{ w?: number, h?: number, top?: number, bottom?: number, pad?: number, rng?: () => number }} [opts]
 */
function layoutCards(letters, opts = {}) {
  const width = opts.w ?? W;
  const top = opts.top ?? 150;
  const bottom = opts.bottom ?? H - 100;
  const pad = opts.pad ?? 28;
  const rng = opts.rng || Math.random;
  const r = cardRadius(letters.length);
  const placed = [];

  const cols = letters.length <= 3 ? letters.length : (letters.length <= 4 ? 2 : 3);
  const rows = Math.ceil(letters.length / cols);
  const cellW = (width - pad * 2) / cols;
  const cellH = (bottom - top) / rows;

  const cells = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      cells.push({ row, col });
    }
  }
  const shuffledCells = shuffleWith(cells, rng);
  const nums = letters.slice();

  for (let i = 0; i < nums.length; i++) {
    const cell = shuffledCells[i % shuffledCells.length];
    const jitterX = (rng() - 0.5) * cellW * 0.2;
    const jitterY = (rng() - 0.5) * cellH * 0.2;
    const x = pad + cell.col * cellW + cellW / 2 + jitterX;
    const y = top + cell.row * cellH + cellH / 2 + jitterY;
    const cx = Math.max(pad + r, Math.min(width - pad - r, x));
    const cy = Math.max(top + r, Math.min(bottom - r, y));
    placed.push({
      letter: nums[i],
      x: cx,
      y: cy,
      r,
      found: false,
      bounce: 0,
      wiggle: rng() * Math.PI * 2,
      shake: 0,
      munch: 0,
      food: foodOf(nums[i]),
    });
  }

  // Resolve overlaps
  for (let pass = 0; pass < 8; pass++) {
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i];
        const b = placed[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.01;
        const minD = a.r + b.r + 10;
        if (dist < minD) {
          const push = (minD - dist) / 2;
          const nx = dx / dist;
          const ny = dy / dist;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
          a.x = Math.max(pad + a.r, Math.min(width - pad - a.r, a.x));
          a.y = Math.max(top + a.r, Math.min(bottom - a.r, a.y));
          b.x = Math.max(pad + b.r, Math.min(width - pad - b.r, b.x));
          b.y = Math.max(top + b.r, Math.min(bottom - b.r, b.y));
        }
      }
    }
  }

  return placed;
}

function enterMenu() {
  state = 'menu';
  celebrateLock = false;
  clearParticles();
}

function layoutRound(opts = {}) {
  const m = currentMode();
  const pool = letterRange(m.lastLetter);
  const pick = pickRoundLetters(pool, m.choices, opts.rng);
  targetLetter = pick.target;
  cards = layoutCards(pick.letters, {
    top: 150,
    bottom: H - 90,
    rng: opts.rng,
  });
  hintTimer = 0;
  showHint = false;
  celebrateLock = false;
}

function enterPlay(forceMode) {
  state = 'play';
  modeId = forceMode || save.mode || 'easy';
  const m = currentMode();
  findsTarget = m.finds | 0;
  sessionFinds = 0;
  sessionTaps = 0;
  winFlash = 0;
  clearParticles();
  layoutRound();
  // Speak after a short beat so the board is visible
  setTimeout(() => {
    if (state === 'play' && !celebrateLock) speakFind(targetLetter);
  }, 320);
}

function enterWin() {
  state = 'win';
  winFlash = 1.5;
  sfxWin();
  spawnBurst(W / 2, H * 0.35, '#FFD56A', 28);
  spawnBurst(W / 2, H * 0.35, '#FF8A65', 18);
  spawnPraise(W / 2, H * 0.25, 'Picnic!');
  recordRound();
}

/**
 * Hit-test cards (front-most).
 * @returns {object|null}
 */
function hitCard(x, y) {
  for (let i = cards.length - 1; i >= 0; i--) {
    const c = cards[i];
    if (c.found) continue;
    const dx = x - c.x;
    const dy = y - c.y;
    if (dx * dx + dy * dy <= (c.r * 1.2) ** 2) return c;
  }
  return null;
}

/**
 * Apply tap without audio side effects (tests use this).
 * @returns {'correct'|'wrong'|'miss'|'locked'|'complete'}
 */
function applyTapAt(x, y) {
  if (state !== 'play' || celebrateLock) return 'locked';
  const c = hitCard(x, y);
  if (!c) return 'miss';

  if (!isCorrectLetter(c.letter, targetLetter, c.found)) {
    c.shake = 0.35;
    c.bounce = 0.25;
    showHint = true;
    hintTimer = 0;
    return 'wrong';
  }

  c.found = true;
  c.bounce = 0.4;
  c.munch = 0.55;
  sessionTaps++;
  sessionFinds++;
  hintTimer = 0;
  showHint = false;

  return 'complete';
}

function handleTap(x, y) {
  const result = applyTapAt(x, y);
  if (result === 'locked' || result === 'miss') return result;

  if (result === 'wrong') {
    sfxWrong();
    const correct = cards.find(p => p.letter === targetLetter && !p.found);
    if (correct) {
      spawnPraise(correct.x, correct.y - 40, 'Try ' + targetLetter + '!');
    }
    // Soft re-prompt
    setTimeout(() => {
      if (state === 'play' && !celebrateLock) speakFind(targetLetter);
    }, 400);
    return result;
  }

  // correct / complete
  sfxCorrect(targetLetter);
  sfxMunch();
  speakLetter(targetLetter);
  recordFind();
  const found = cards.find(p => p.letter === targetLetter && p.found);
  const col = colorOf(targetLetter);
  if (found) {
    spawnBurst(found.x, found.y, col.fill, 14);
    spawnPraise(found.x, found.y - 36);
  }

  onFindComplete();
  return result;
}

function onFindComplete() {
  if (celebrateLock) return;
  celebrateLock = true;

  const m = currentMode();
  const delay = save.reducedMotion ? 650 : 1100;
  setTimeout(() => {
    if (state !== 'play') return;
    if (!m.finds) {
      // free: next endless find
      spawnPraise(W / 2, 160, 'Again!');
      layoutRound();
      setTimeout(() => {
        if (state === 'play' && !celebrateLock) speakFind(targetLetter);
      }, 280);
      return;
    }
    if (sessionFinds >= findsTarget) {
      enterWin();
    } else {
      spawnPraise(W / 2, 120, 'Find ' + (sessionFinds + 1) + '!');
      layoutRound();
      setTimeout(() => {
        if (state === 'play' && !celebrateLock) speakFind(targetLetter);
      }, 280);
    }
  }, delay);
}

function updatePlay(dt) {
  skyPhase += dt;
  bob += dt * 3;
  antBob += dt * 2.2;
  if (!celebrateLock) hintTimer += dt;

  for (const c of cards) {
    if (c.bounce > 0) c.bounce = Math.max(0, c.bounce - dt);
    if (c.shake > 0) c.shake = Math.max(0, c.shake - dt);
    if (c.munch > 0) c.munch = Math.max(0, c.munch - dt);
    c.wiggle += dt * 2;
  }

  if (hintTimer > HINT_AFTER && !celebrateLock) {
    showHint = true;
  }

  updateParticles(dt);
}

function updateWin(dt) {
  winFlash = Math.max(0, winFlash - dt);
  skyPhase += dt;
  bob += dt * 2;
  antBob += dt * 2;
  updateParticles(dt);
}

// ---- Drawing ----

function roundRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawBg(ctx) {
  // Sky
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#81D4FA');
  g.addColorStop(0.4, '#B3E5FC');
  g.addColorStop(0.55, '#C8E6C9');
  g.addColorStop(1, '#81C784');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Soft clouds
  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  for (const [cx, cy, s] of [[50, 48, 1], [190, 36, 0.9], [320, 55, 1.05]]) {
    const ox = Math.sin(skyPhase * 0.35 + cx) * 5;
    ctx.beginPath();
    ctx.arc(cx + ox, cy, 16 * s, 0, Math.PI * 2);
    ctx.arc(cx + 20 * s + ox, cy + 3, 13 * s, 0, Math.PI * 2);
    ctx.arc(cx - 16 * s + ox, cy + 5, 11 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  // Sun
  ctx.fillStyle = '#FFEE58';
  ctx.beginPath();
  ctx.arc(W - 48, 58, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,238,88,0.35)';
  ctx.beginPath();
  ctx.arc(W - 48, 58, 32, 0, Math.PI * 2);
  ctx.fill();

  // Grass tufts
  ctx.fillStyle = '#66BB6A';
  ctx.fillRect(0, H - 80, W, 80);
  ctx.fillStyle = '#558B2F';
  for (let x = 0; x < W; x += 16) {
    const h = 8 + (x % 24) * 0.3;
    ctx.beginPath();
    ctx.moveTo(x, H - 80);
    ctx.lineTo(x + 5, H - 80 - h);
    ctx.lineTo(x + 10, H - 80);
    ctx.fill();
  }
}

function drawBlanket(ctx) {
  const bx = 18;
  const by = 118;
  const bw = W - 36;
  const bh = H - 210;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  roundRect(ctx, bx + 4, by + 6, bw, bh, 18);
  ctx.fill();

  // Gingham base
  ctx.fillStyle = '#FFF8E1';
  roundRect(ctx, bx, by, bw, bh, 18);
  ctx.fill();

  // Check pattern
  const cell = 22;
  ctx.save();
  roundRect(ctx, bx, by, bw, bh, 18);
  ctx.clip();
  for (let row = 0; row < bh / cell + 1; row++) {
    for (let col = 0; col < bw / cell + 1; col++) {
      if ((row + col) % 2 === 0) {
        ctx.fillStyle = 'rgba(239, 83, 80, 0.18)';
        ctx.fillRect(bx + col * cell, by + row * cell, cell, cell);
      }
    }
  }
  // Soft border
  ctx.strokeStyle = '#E57373';
  ctx.lineWidth = 4;
  roundRect(ctx, bx + 2, by + 2, bw - 4, bh - 4, 16);
  ctx.stroke();
  ctx.restore();
}

function drawFoodGlyph(ctx, food, x, y, r, color) {
  // Decorative nibble shape under letter
  ctx.fillStyle = color.fill;
  ctx.globalAlpha = 0.35;
  if (food === 'apple' || food === 'orange' || food === 'melon') {
    ctx.beginPath();
    ctx.arc(x, y + r * 0.15, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
  } else if (food === 'sandwich' || food === 'tart' || food === 'waffle') {
    roundRect(ctx, x - r * 0.5, y - r * 0.15, r, r * 0.7, 6);
    ctx.fill();
  } else {
    // Cookie / default disc
    ctx.beginPath();
    ctx.arc(x, y + r * 0.2, r * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawCard(ctx, c) {
  if (c.found && c.munch <= 0) return;

  const col = colorOf(c.letter);
  const shakeX = c.shake > 0 ? Math.sin(c.shake * 40) * 5 : 0;
  const bounce = c.bounce > 0 ? Math.sin((1 - c.bounce / 0.4) * Math.PI) * 0.12 : 0;
  const floatY = Math.sin(c.wiggle) * 2.5;
  const munchScale = c.munch > 0 ? (0.4 + c.munch) : 1;
  const x = c.x + shakeX;
  const y = c.y + floatY;
  const scale = (1 + bounce) * munchScale;
  const r = c.r * scale;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.14)';
  ctx.beginPath();
  ctx.ellipse(x + 2, y + r * 0.85, r * 0.7, r * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();

  // Hint glow on target
  if (showHint && c.letter === targetLetter && !c.found) {
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.25 * Math.sin(skyPhase * 5);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x, y, r + 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Plate / card circle
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFAF0';
  ctx.fill();
  ctx.strokeStyle = col.stroke;
  ctx.lineWidth = 4;
  ctx.stroke();

  // Inner colored ring
  ctx.beginPath();
  ctx.arc(x, y, r * 0.88, 0, Math.PI * 2);
  ctx.strokeStyle = col.fill;
  ctx.lineWidth = 3;
  ctx.stroke();

  drawFoodGlyph(ctx, c.food, x, y, r, col);

  // Letter
  ctx.font = 'bold ' + Math.round(r * 0.95) + 'px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.strokeText(c.letter, x, y + 1);
  ctx.fillStyle = col.stroke;
  ctx.fillText(c.letter, x, y + 1);

  // Shine
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.28, y - r * 0.35, r * 0.22, r * 0.14, -0.4, 0, Math.PI * 2);
  ctx.fill();
}

function drawAnt(ctx, x, y, scale) {
  const s = scale || 1;
  ctx.save();
  ctx.translate(x, y + Math.sin(antBob) * 2);
  ctx.scale(s, s);
  // Body segments
  ctx.fillStyle = '#5D4037';
  ctx.beginPath();
  ctx.ellipse(-10, 0, 8, 6, 0, 0, Math.PI * 2);
  ctx.ellipse(2, 0, 9, 7, 0, 0, Math.PI * 2);
  ctx.ellipse(14, -2, 7, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Legs
  ctx.strokeStyle = '#4E342E';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-6, 4); ctx.lineTo(-14, 12);
  ctx.moveTo(0, 5); ctx.lineTo(0, 14);
  ctx.moveTo(8, 4); ctx.lineTo(14, 12);
  ctx.moveTo(-6, -3); ctx.lineTo(-14, -10);
  ctx.moveTo(8, -3); ctx.lineTo(14, -10);
  ctx.stroke();
  // Antennae
  ctx.beginPath();
  ctx.moveTo(18, -4); ctx.quadraticCurveTo(24, -14, 22, -18);
  ctx.moveTo(16, -6); ctx.quadraticCurveTo(20, -16, 18, -20);
  ctx.stroke();
  // Eyes
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(16, -3, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.arc(16.5, -3, 1.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBasket(ctx) {
  const x = 48;
  const y = H - 48;
  ctx.fillStyle = '#A1887F';
  roundRect(ctx, x - 22, y - 18, 44, 28, 6);
  ctx.fill();
  ctx.strokeStyle = '#6D4C41';
  ctx.lineWidth = 2;
  roundRect(ctx, x - 22, y - 18, 44, 28, 6);
  ctx.stroke();
  // Handle
  ctx.beginPath();
  ctx.arc(x, y - 18, 16, Math.PI, 0);
  ctx.stroke();
  // Cloth peek
  ctx.fillStyle = '#EF9A9A';
  ctx.beginPath();
  ctx.ellipse(x, y - 8, 14, 6, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawHud(ctx) {
  const m = currentMode();
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  roundRect(ctx, 14, 12, W - 28, 58, 14);
  ctx.fill();

  ctx.font = 'bold 17px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(m.name, W / 2, 32);

  ctx.font = '13px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  let line = 'Find ' + targetLetter + '!';
  if (m.finds) {
    line += ' · ' + sessionFinds + '/' + findsTarget;
  } else {
    line += ' · Found ' + sessionFinds;
  }
  ctx.fillText(line, W / 2, 52);
}

function drawPlay(ctx) {
  drawBg(ctx);
  drawBlanket(ctx);
  drawBasket(ctx);
  drawAnt(ctx, W - 56, H - 52, 1.15);

  // Prompt chip
  if (!celebrateLock) {
    const chipW = 160;
    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    roundRect(ctx, W / 2 - chipW / 2, 78, chipW, 34, 17);
    ctx.fill();
    ctx.font = 'bold 17px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = colorOf(targetLetter).stroke;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Find ' + targetLetter + '!', W / 2, 95);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    roundRect(ctx, W / 2 - 70, 78, 140, 34, 17);
    ctx.fill();
    ctx.font = 'bold 17px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#E65100';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Yum!', W / 2, 95);
  }

  for (const c of cards) drawCard(ctx, c);
  drawParticles(ctx);
  drawHud(ctx);

  if (!celebrateLock) {
    ctx.font = '14px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.textAlign = 'center';
    ctx.fillText('Tap the letter on the blanket', W / 2, H - 28);
  }
}

function drawWinScene(ctx) {
  drawBg(ctx);
  drawBlanket(ctx);
  // Confetti-ish ants parade
  drawAnt(ctx, W * 0.25, H * 0.42, 1.4);
  drawAnt(ctx, W * 0.5, H * 0.38, 1.6);
  drawAnt(ctx, W * 0.72, H * 0.44, 1.3);
  drawBasket(ctx);
  drawParticles(ctx);
  if (winFlash > 0) {
    ctx.fillStyle = 'rgba(255,255,255,' + (0.14 * Math.min(1, winFlash)) + ')';
    ctx.fillRect(0, 0, W, H);
  }
}

function drawMenuBackdrop(ctx) {
  drawBg(ctx);
  drawBlanket(ctx);
  const demo = layoutCards(['A', 'B', 'C'], { top: 180, bottom: 420, rng: () => 0.4 });
  for (const c of demo) drawCard(ctx, c);
  drawAnt(ctx, W - 70, H - 60, 1.2);
  drawBasket(ctx);
  ctx.fillStyle = 'rgba(40, 30, 20, 0.38)';
  ctx.fillRect(0, 0, W, H);
}
