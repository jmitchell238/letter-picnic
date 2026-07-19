'use strict';

// Letter Picnic — Keep CACHE in sw.js in sync: 'letter-picnic-' + GAME_VERSION
const GAME_VERSION = '1.0.000';
const GAME_VERSION_LABEL = 'v' + GAME_VERSION;
const GAME_NAME = 'Letter Picnic';

const W = 390;
const H = 700;
const SAVE_KEY = 'letter-picnic-save-v1';

/**
 * Modes: letter range (last letter inclusive) + choices on blanket + finds before win.
 * Free = endless (findsTarget: 0).
 */
const MODES = {
  free: { id: 'free', name: 'Free Play', tagline: 'A–E · forever', lastLetter: 'E', choices: 3, finds: 0 },
  easy: { id: 'easy', name: 'Easy',      tagline: 'A–F · short',   lastLetter: 'F', choices: 4, finds: 5 },
  more: { id: 'more', name: 'A Little More', tagline: 'A–M',       lastLetter: 'M', choices: 5, finds: 7 },
  pro:  { id: 'pro',  name: 'Challenge', tagline: 'A–Z',         lastLetter: 'Z', choices: 6, finds: 10 },
};
const MODE_ORDER = ['free', 'easy', 'more', 'pro'];

/** Soft hint after this many idle seconds */
const HINT_AFTER = 5;

const PRAISE = ['Yum!', 'Yes!', 'Nice!', 'Wow!', 'Yay!', 'Good!', 'Super!', 'Munch!'];

/** Letter card colors cycling A–Z */
const LETTER_PALETTE = [
  { fill: '#EF5350', stroke: '#C62828' }, // A red
  { fill: '#FFA726', stroke: '#EF6C00' }, // B orange
  { fill: '#FFEE58', stroke: '#F9A825' }, // C yellow
  { fill: '#66BB6A', stroke: '#2E7D32' }, // D green
  { fill: '#26C6DA', stroke: '#00838F' }, // E cyan
  { fill: '#42A5F5', stroke: '#1565C0' }, // F blue
  { fill: '#7E57C2', stroke: '#4527A0' }, // G purple
  { fill: '#EC407A', stroke: '#AD1457' }, // H pink
  { fill: '#AB47BC', stroke: '#6A1B9A' }, // I violet
  { fill: '#8D6E63', stroke: '#4E342E' }, // J brown
  { fill: '#26A69A', stroke: '#00695C' }, // K teal
  { fill: '#FF7043', stroke: '#D84315' }, // L deep orange
  { fill: '#9CCC65', stroke: '#558B2F' }, // M lime
  { fill: '#5C6BC0', stroke: '#283593' }, // N indigo
  { fill: '#FFCA28', stroke: '#F9A825' }, // O amber
  { fill: '#EC407A', stroke: '#C2185B' }, // P rose
  { fill: '#29B6F6', stroke: '#0277BD' }, // Q sky
  { fill: '#EF5350', stroke: '#B71C1C' }, // R crimson
  { fill: '#66BB6A', stroke: '#1B5E20' }, // S forest
  { fill: '#FFA726', stroke: '#E65100' }, // T tangerine
  { fill: '#7E57C2', stroke: '#311B92' }, // U grape
  { fill: '#26C6DA', stroke: '#006064' }, // V aqua
  { fill: '#8D6E63', stroke: '#3E2723' }, // W cocoa
  { fill: '#AB47BC', stroke: '#4A148C' }, // X plum
  { fill: '#FFEE58', stroke: '#F57F17' }, // Y gold
  { fill: '#42A5F5', stroke: '#0D47A1' }, // Z navy
];

/** Cute picnic food names paired with letter index for variety */
const FOODS = [
  'apple', 'berry', 'cookie', 'donut', 'egg', 'fruit',
  'grape', 'honey', 'ice', 'jam', 'kiwi', 'lemon',
  'melon', 'nut', 'orange', 'pie', 'quiche', 'raisin',
  'sandwich', 'tart', 'ufo-cake', 'veggie', 'waffle', 'x-cookie',
  'yogurt', 'zucchini',
];

/** Card size by choice count */
function cardRadius(count) {
  if (count >= 6) return 36;
  if (count >= 5) return 40;
  if (count >= 4) return 44;
  return 48;
}
