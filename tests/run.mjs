#!/usr/bin/env node
/**
 * Letter Picnic — comprehensive unit + shell tests (no browser / no deps).
 * Run: node tests/run.mjs
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;
const failures = [];

function assert(cond, msg) {
  if (cond) {
    passed++;
    process.stdout.write('.');
    return;
  }
  failed++;
  failures.push(msg);
  console.error('\n  ✗', msg);
}

function assertEq(a, b, msg) {
  assert(Object.is(a, b), `${msg} (got ${JSON.stringify(a)}, expected ${JSON.stringify(b)})`);
}

function assertClose(a, b, eps, msg) {
  assert(Math.abs(a - b) <= eps, `${msg} (got ${a}, expected ~${b} ±${eps})`);
}

function section(name) {
  process.stdout.write('\n• ' + name + ' ');
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function loadGame(opts = {}) {
  const files = [
    'js/config.js',
    'js/save.js',
    'js/audio.js',
    'js/particles.js',
    'js/game.js',
  ];
  const code = files
    .map(rel => `// ---- ${rel} ----\n` + read(rel))
    .join('\n;\n');

  const exportFooter = `
    globalThis.__TEST__ = {
      GAME_VERSION, GAME_NAME, W, H, MODES, MODE_ORDER, LETTER_PALETTE, HINT_AFTER,
      SAVE_KEY, PRAISE, FOODS,
      cardRadius, shuffle, shuffleWith, letterIndex, normalizeLetter, letterRange,
      pickRoundLetters, isCorrectLetter, layoutCards, colorOf, foodOf, currentMode,
      hitCard, applyTapAt, handleTap, enterPlay, enterMenu, enterWin, layoutRound,
      onFindComplete, updatePlay,
      state: () => state,
      modeId: () => modeId,
      targetLetter: () => targetLetter,
      sessionFinds: () => sessionFinds,
      sessionTaps: () => sessionTaps,
      findsTarget: () => findsTarget,
      cards: () => cards,
      hintTimer: () => hintTimer,
      showHint: () => showHint,
      celebrateLock: () => celebrateLock,
      setCelebrateLock: (v) => { celebrateLock = !!v; },
      setHintTimer: (t) => { hintTimer = t; },
      setSessionFinds: (n) => { sessionFinds = n; },
      save,
      setMode, setMuted, setReducedMotion,
      recordFind, recordRound,
      loadSave, persistSave, defaultSave,
    };
  `;

  const sandbox = {
    console,
    setTimeout: opts.immediateTimeout
      ? (fn) => { fn(); return 0; }
      : setTimeout,
    clearTimeout,
    Math,
    performance: { now: () => Date.now() },
    localStorage: {
      _data: {},
      getItem(k) { return this._data[k] ?? null; },
      setItem(k, v) { this._data[k] = String(v); },
      removeItem(k) { delete this._data[k]; },
      clear() { this._data = {}; },
    },
    document: {
      getElementById() { return null; },
      querySelectorAll() { return []; },
    },
    window: {},
    globalThis: {},
    requestAnimationFrame: (fn) => setTimeout(() => fn(Date.now()), 0),
    speechSynthesis: undefined,
    SpeechSynthesisUtterance: undefined,
  };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;

  vm.runInNewContext(code + '\n' + exportFooter, sandbox, { filename: 'letter-picnic-test.js' });
  return sandbox.__TEST__;
}

// =====================================================================
section('PWA shell files');
{
  for (const f of [
    'index.html', 'css/style.css', 'js/config.js', 'js/save.js', 'js/audio.js',
    'js/particles.js', 'js/game.js', 'js/main.js',
    'manifest.webmanifest', 'sw.js', 'README.md',
  ]) {
    assert(exists(f), `exists ${f}`);
  }
  for (const f of [
    'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
    'apple-touch-icon.png', 'art/cover.jpg',
  ]) {
    assert(exists(f), `exists ${f}`);
  }
}

// =====================================================================
section('version / SW cache sync');
{
  const cfg = read('js/config.js');
  const sw = read('sw.js');
  const m = cfg.match(/GAME_VERSION\s*=\s*['"]([^'"]+)['"]/);
  assert(!!m, 'GAME_VERSION present');
  const ver = m[1];
  assert(/^\d+\.\d+\.\d{3}$/.test(ver), `version format (${ver})`);
  assert(sw.includes(`letter-picnic-${ver}`), `sw CACHE matches letter-picnic-${ver}`);
  assert(cfg.includes('SAVE_KEY'), 'SAVE_KEY defined');
  assert(cfg.includes('letter-picnic-save'), 'SAVE_KEY namespaced');
}

// =====================================================================
section('script order + manifest');
{
  const html = read('index.html');
  let last = -1;
  for (const s of ['config.js', 'save.js', 'audio.js', 'particles.js', 'game.js', 'main.js']) {
    const i = html.indexOf(s);
    assert(i > last, `order ${s}`);
    last = i;
  }
  assert(html.includes('manifest.webmanifest'), 'html links manifest');
  assert(html.includes('sw.js') || read('js/main.js').includes('serviceWorker'), 'SW registration path');
  const man = JSON.parse(read('manifest.webmanifest'));
  assert(man.display === 'standalone', 'manifest standalone');
  assert(man.name === 'Letter Picnic', 'manifest name');
  assert(Array.isArray(man.icons) && man.icons.length >= 2, 'manifest icons');
  assert(man.orientation === 'portrait', 'portrait orientation');
}

// =====================================================================
section('config integrity');
{
  const T = loadGame();
  assertEq(T.W, 390, 'W');
  assertEq(T.H, 700, 'H');
  assert(T.MODE_ORDER.length === 4, '4 modes');
  assert(T.MODE_ORDER.every(id => T.MODES[id]), 'MODE_ORDER keys valid');
  assertEq(T.MODES.free.lastLetter, 'E', 'free lastLetter');
  assertEq(T.MODES.free.finds, 0, 'free endless');
  assertEq(T.MODES.free.choices, 3, 'free choices');
  assertEq(T.MODES.easy.lastLetter, 'F', 'easy lastLetter');
  assertEq(T.MODES.easy.finds, 5, 'easy finds');
  assertEq(T.MODES.more.lastLetter, 'M', 'more lastLetter');
  assertEq(T.MODES.pro.lastLetter, 'Z', 'pro lastLetter');
  assert(T.LETTER_PALETTE.length >= 26, 'palette covers A–Z');
  assert(T.FOODS.length >= 26, 'foods cover A–Z');
  assert(T.HINT_AFTER > 0, 'HINT_AFTER positive');
  assert(T.cardRadius(3) > T.cardRadius(6), 'larger cards when fewer');
}

// =====================================================================
section('letterIndex / normalizeLetter / letterRange');
{
  const T = loadGame();
  assertEq(T.letterIndex('A'), 0, 'A=0');
  assertEq(T.letterIndex('a'), 0, 'a=0');
  assertEq(T.letterIndex('Z'), 25, 'Z=25');
  assertEq(T.letterIndex(''), -1, 'empty');
  assertEq(T.letterIndex('1'), -1, 'digit');
  assertEq(T.normalizeLetter('b'), 'B', 'normalize b');
  assertEq(T.normalizeLetter(''), '', 'normalize empty');

  assertEq(JSON.stringify(T.letterRange('E')), JSON.stringify(['A', 'B', 'C', 'D', 'E']), 'A–E');
  assertEq(T.letterRange('A').length, 1, 'A only');
  assertEq(T.letterRange('Z').length, 26, 'A–Z');
  assertEq(T.letterRange('M').length, 13, 'A–M');
  assert(T.letterRange('F').includes('F'), 'includes F');
  assert(!T.letterRange('F').includes('G'), 'excludes G');
}

// =====================================================================
section('pickRoundLetters');
{
  const T = loadGame();
  const pool = T.letterRange('F');
  const r1 = T.pickRoundLetters(pool, 4, mulberry32(42));
  assertEq(r1.letters.length, 4, '4 letters');
  assert(r1.letters.includes(r1.target), 'target in letters');
  assert(new Set(r1.letters).size === 4, 'unique letters');
  assert(r1.letters.every(L => pool.includes(L)), 'all from pool');

  // Deterministic
  const r2 = T.pickRoundLetters(pool, 4, mulberry32(42));
  assertEq(r1.target, r2.target, 'same target seed');
  assertEq(JSON.stringify(r1.letters), JSON.stringify(r2.letters), 'same layout seed');

  // Clamp to pool size
  const small = T.pickRoundLetters(['A', 'B'], 5, mulberry32(1));
  assertEq(small.letters.length, 2, 'cannot exceed pool');

  // Min 2
  const two = T.pickRoundLetters(pool, 2, mulberry32(3));
  assertEq(two.letters.length, 2, 'min 2 choices');
}

// =====================================================================
section('isCorrectLetter');
{
  const T = loadGame();
  assert(T.isCorrectLetter('B', 'B', false) === true, 'match');
  assert(T.isCorrectLetter('b', 'B', false) === true, 'case insensitive');
  assert(T.isCorrectLetter('A', 'B', false) === false, 'wrong letter');
  assert(T.isCorrectLetter('B', 'B', true) === false, 'already found');
  assert(T.isCorrectLetter('', 'B', false) === false, 'empty letter');
  assert(T.isCorrectLetter('B', '', false) === false, 'empty target');
}

// =====================================================================
section('layoutCards');
{
  const T = loadGame();
  const rng = mulberry32(42);
  const letters = ['A', 'B', 'C', 'D'];
  const laid = T.layoutCards(letters, { rng, top: 150, bottom: 600, pad: 28 });

  assertEq(laid.length, 4, '4 cards');
  const found = laid.map(c => c.letter).sort();
  assertEq(JSON.stringify(found), JSON.stringify(['A', 'B', 'C', 'D']), 'all letters present');
  assert(laid.every(c => !c.found), 'none found');
  assert(laid.every(c => c.r > 0), 'positive radius');
  assert(laid.every(c => c.x >= 28 && c.x <= T.W - 28), 'x in pad');
  assert(laid.every(c => c.y >= 150 && c.y <= 600), 'y in playfield');
  assert(laid.every(c => !!c.food), 'food assigned');

  const keys = new Set(laid.map(c => `${Math.round(c.x)},${Math.round(c.y)}`));
  assert(keys.size === 4, 'distinct positions');

  let minDist = Infinity;
  for (let i = 0; i < laid.length; i++) {
    for (let j = i + 1; j < laid.length; j++) {
      const d = Math.hypot(laid[i].x - laid[j].x, laid[i].y - laid[j].y);
      if (d < minDist) minDist = d;
    }
  }
  assert(minDist > 20, `cards not heavily stacked (minDist=${minDist.toFixed(1)})`);

  const laid2 = T.layoutCards(letters, { rng: mulberry32(42), top: 150, bottom: 600, pad: 28 });
  assertEq(laid[0].letter, laid2[0].letter, 'deterministic first letter');
  assertClose(laid[0].x, laid2[0].x, 0.01, 'deterministic x');
}

// =====================================================================
section('enterPlay + modes');
{
  const T = loadGame();
  T.enterPlay('easy');
  assertEq(T.state(), 'play', 'state play');
  assertEq(T.modeId(), 'easy', 'mode easy');
  assertEq(T.findsTarget(), 5, 'easy 5 finds');
  assertEq(T.sessionFinds(), 0, 'finds 0');
  assertEq(T.cards().length, 4, '4 cards easy');
  assert(T.cards().some(c => c.letter === T.targetLetter()), 'target on board');
  assert(T.celebrateLock() === false, 'not locked');

  T.enterPlay('free');
  assertEq(T.findsTarget(), 0, 'free endless');
  assertEq(T.cards().length, 3, '3 cards free');

  T.enterPlay('more');
  assertEq(T.cards().length, 5, '5 cards more');
  assertEq(T.findsTarget(), 7, 'more finds');

  T.enterPlay('pro');
  assertEq(T.cards().length, 6, '6 cards pro');
  assertEq(T.findsTarget(), 10, 'pro finds');
  // Target is in A–Z
  assert(T.letterIndex(T.targetLetter()) >= 0, 'pro target valid');

  T.enterMenu();
  assertEq(T.state(), 'menu', 'menu state');
}

// =====================================================================
section('hitCard');
{
  const T = loadGame();
  T.enterPlay('easy');
  const c = T.cards()[0];
  assert(T.hitCard(c.x, c.y) === c, 'hit center');
  assert(T.hitCard(0, 0) === null, 'miss corner');
  c.found = true;
  assert(T.hitCard(c.x, c.y) === null, 'found not hittable');
  c.found = false;
}

// =====================================================================
section('play flow — correct find');
{
  const T = loadGame();
  T.enterPlay('easy');
  const target = T.targetLetter();
  const card = T.cards().find(c => c.letter === target);
  assert(!!card, 'find target card');
  const result = T.applyTapAt(card.x, card.y);
  assertEq(result, 'complete', 'correct is complete');
  assert(card.found === true, 'marked found');
  assertEq(T.sessionFinds(), 1, 'session finds 1');
  assertEq(T.sessionTaps(), 1, 'session taps 1');
}

// =====================================================================
section('play flow — wrong tap soft feedback');
{
  const T = loadGame();
  T.enterPlay('easy');
  const target = T.targetLetter();
  const wrong = T.cards().find(c => c.letter !== target);
  assert(!!wrong, 'wrong card exists');
  const result = T.applyTapAt(wrong.x, wrong.y);
  assertEq(result, 'wrong', 'wrong result');
  assert(wrong.found === false, 'not found');
  assert(wrong.shake > 0, 'shake feedback');
  assertEq(T.sessionFinds(), 0, 'no find on wrong');
  assert(T.showHint() === true, 'hint after wrong');
  assertEq(T.applyTapAt(0, 0), 'miss', 'miss empty');

  T.setCelebrateLock(true);
  const card = T.cards().find(c => c.letter === target);
  assertEq(T.applyTapAt(card.x, card.y), 'locked', 'locked during celebrate');
  T.setCelebrateLock(false);
}

// =====================================================================
section('handleTap + save counters');
{
  const T = loadGame();
  T.enterPlay('easy');
  const before = T.save.finds | 0;
  const target = T.targetLetter();
  const card = T.cards().find(c => c.letter === target);
  const r = T.handleTap(card.x, card.y);
  assertEq(r, 'complete', 'handleTap complete');
  assertEq(T.save.finds, before + 1, 'recordFind via handleTap');

  // Wrong does not increment
  T.layoutRound();
  const finds2 = T.save.finds | 0;
  const wrong = T.cards().find(c => c.letter !== T.targetLetter());
  assertEq(T.handleTap(wrong.x, wrong.y), 'wrong', 'handleTap wrong');
  assertEq(T.save.finds, finds2, 'wrong does not recordFind');
}

// =====================================================================
section('find complete free mode (immediate timeout)');
{
  const T = loadGame({ immediateTimeout: true });
  T.enterPlay('free');
  const target = T.targetLetter();
  const card = T.cards().find(c => c.letter === target);
  T.applyTapAt(card.x, card.y);
  const findsBefore = T.save.finds | 0;
  T.onFindComplete();
  assertEq(T.sessionFinds(), 1, 'session find +1');
  // free: new round
  assertEq(T.state(), 'play', 'still play');
  assert(T.cards().every(c => !c.found), 'new board fresh');
  assert(T.celebrateLock() === false, 'lock released');
  // recordFind is only via handleTap; onFindComplete alone doesn't increment save
  assertEq(T.save.finds, findsBefore, 'onFindComplete alone no double save');
}

// =====================================================================
section('find complete easy mode win after finds');
{
  const T = loadGame({ immediateTimeout: true });
  T.enterPlay('easy');
  assertEq(T.findsTarget(), 5, '5 finds target');

  for (let i = 0; i < 5; i++) {
    T.setSessionFinds(i);
    if (i > 0 || T.cards().every(c => c.found)) T.layoutRound();
    const target = T.targetLetter();
    const card = T.cards().find(c => c.letter === target && !c.found);
    T.applyTapAt(card.x, card.y);
    T.onFindComplete();
  }
  assertEq(T.state(), 'win', 'win after 5 finds');
}

// =====================================================================
section('hint after idle');
{
  const T = loadGame();
  T.enterPlay('easy');
  assert(T.showHint() === false, 'no hint initially');
  T.setHintTimer(T.HINT_AFTER + 0.1);
  T.updatePlay(0.016);
  assert(T.showHint() === true, 'hint after idle');
}

// =====================================================================
section('colorOf / foodOf');
{
  const T = loadGame();
  for (const L of T.letterRange('Z')) {
    const c = T.colorOf(L);
    assert(!!c.fill && !!c.stroke, `colorOf(${L})`);
    assert(!!T.foodOf(L), `foodOf(${L})`);
  }
  assert(!!T.colorOf('?').fill, 'fallback color');
}

// =====================================================================
section('save helpers');
{
  const T = loadGame();
  T.setMode('pro');
  assertEq(T.save.mode, 'pro', 'setMode pro');
  T.setMode('nope');
  assertEq(T.save.mode, 'pro', 'invalid mode ignored');
  T.setMuted(true);
  assert(T.save.muted === true, 'muted');
  T.setMuted(false);
  assert(T.save.muted === false, 'unmuted');
  T.setReducedMotion(true);
  assert(T.save.reducedMotion === true, 'reduced motion');

  const f0 = T.save.finds | 0;
  T.recordFind();
  T.recordFind();
  assertEq(T.save.finds, f0 + 2, 'recordFind x2');
  const r0 = T.save.rounds | 0;
  T.recordRound();
  assertEq(T.save.rounds, r0 + 1, 'recordRound');

  T.setMode('more');
  T.persistSave();
  assertEq(T.save.mode, 'more', 'persisted mode');
}

// =====================================================================
section('kid-safe design markers');
{
  const game = read('js/game.js');
  const html = read('index.html');
  assert(!/game\s*over/i.test(game), 'no game over string');
  assert(!/\blives\b/i.test(game), 'no lives system');
  assert(html.includes('never a fail') || read('README.md').includes('fail'), 'fail-safe messaging');
  assert(game.includes('wrong') || game.includes('shake'), 'soft wrong feedback present');
  assert(game.includes('speakFind') || read('js/audio.js').includes('speakFind'), 'spoken prompts');
}

// =====================================================================
section('SW ASSETS list');
{
  const sw = read('sw.js');
  for (const a of [
    'index.html', 'css/style.css', 'js/config.js', 'js/game.js', 'js/main.js',
    'manifest.webmanifest', 'icons/icon-192.png', 'art/cover.jpg',
  ]) {
    assert(sw.includes(a), `SW lists ${a}`);
  }
}

// =====================================================================
console.log('\n');
if (failed) {
  console.error(`Failed: ${failed}  Passed: ${passed}`);
  for (const f of failures) console.error('  •', f);
  process.exit(1);
}
console.log(`Passed: ${passed}  Failed: 0`);
console.log('All Letter Picnic tests passed.');
process.exit(0);
