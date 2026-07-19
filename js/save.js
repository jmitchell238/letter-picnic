'use strict';

const defaultSave = () => ({
  muted: false,
  reducedMotion: false,
  finds: 0,
  rounds: 0,
  mode: 'easy',
});

let save = defaultSave();

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) { save = defaultSave(); return save; }
    save = Object.assign(defaultSave(), JSON.parse(raw));
    if (!MODE_ORDER.includes(save.mode)) save.mode = 'easy';
  } catch { save = defaultSave(); }
  return save;
}

function persistSave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* */ }
}

function recordFind() {
  save.finds = (save.finds | 0) + 1;
  persistSave();
}

function recordRound() {
  save.rounds = (save.rounds | 0) + 1;
  persistSave();
}

function setMuted(v) { save.muted = !!v; persistSave(); }
function setReducedMotion(v) { save.reducedMotion = !!v; persistSave(); }
function setMode(id) {
  if (MODE_ORDER.includes(id)) { save.mode = id; persistSave(); }
}

loadSave();
