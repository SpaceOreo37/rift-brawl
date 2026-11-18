'use strict';
// Tiny 3x5 bitmap font so all text is true pixel art (no web fonts needed).
const FONT = {
  'A': '010101111101101', 'B': '110101110101110', 'C': '011100100100011', 'D': '110101101101110',
  'E': '111100110100111', 'F': '111100110100100', 'G': '011100101101011', 'H': '101101111101101',
  'I': '111010010010111', 'J': '001001001101010', 'K': '101101110101101', 'L': '100100100100111',
  'M': '101111111101101', 'N': '110101101101101', 'O': '010101101101010', 'P': '110101110100100',
  'Q': '010101101110011', 'R': '110101110101101', 'S': '011100010001110', 'T': '111010010010010',
  'U': '101101101101111', 'V': '101101101101010', 'W': '101101111111101', 'X': '101101010101101',
  'Y': '101101010010010', 'Z': '111001010100111',
  '0': '111101101101111', '1': '010110010010111', '2': '110001010100111', '3': '110001010001110',
  '4': '101101111001001', '5': '111100110001110', '6': '011100111101111', '7': '111001010010010',
  '8': '111101111101111', '9': '111101111001110',
  '%': '101001010100101', '!': '010010010000010', '?': '110001010000010', '.': '000000000000010',
  ',': '000000000010100', ':': '000010000010000', ';': '000010000010100', '-': '000000111000000',
  '+': '000010111010000', '/': '001001010100100', "'": '010010000000000', '<': '001010100010001',
  '>': '100010001010100', '(': '010100100100010', ')': '010001001001010', '[': '110100100100110',
  ']': '011001001001011', '=': '000111000111000', '_': '000000000000111', '*': '101010101000000',
  '↑': '010111010010010', '↓': '010010010111010', '←': '001011111011001', '→': '100110111110100',
};

function textW(str, s = 1) {
  str = String(str);
  return str.length ? str.length * 4 * s - s : 0;
}

function _glyphs(ctx, str, x, y, color, s) {
  ctx.fillStyle = color;
  for (let i = 0; i < str.length; i++) {
    const g = FONT[str[i]];
    if (g) {
      for (let p = 0; p < 15; p++) {
        if (g.charCodeAt(p) === 49) ctx.fillRect(x + (p % 3) * s, y + ((p / 3) | 0) * s, s, s);
      }
    }
    x += 4 * s;
  }
}

// opts: { s: scale, align: 'left'|'center'|'right', shadow: color, outline: color }
function drawText(ctx, str, x, y, color = '#fff', opts = {}) {
  str = String(str).toUpperCase();
  const s = opts.s || 1;
  const w = textW(str, s);
  if (opts.align === 'center') x -= Math.floor(w / 2);
  else if (opts.align === 'right') x -= w;
  x = Math.round(x); y = Math.round(y);
  if (opts.outline) {
    for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1], [-1, 1], [1, -1], [-1, -1]])
      _glyphs(ctx, str, x + ox, y + oy, opts.outline, s);
  }
  if (opts.shadow) _glyphs(ctx, str, x, y + Math.max(1, Math.floor(s / 2)), opts.shadow, s);
  _glyphs(ctx, str, x, y, color, s);
  return w;
}

function wrapText(str, maxChars) {
  const words = String(str).split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + (cur ? ' ' : '') + w).length > maxChars) { if (cur) lines.push(cur); cur = w; }
    else cur += (cur ? ' ' : '') + w;
  }
  if (cur) lines.push(cur);
  return lines;
}
