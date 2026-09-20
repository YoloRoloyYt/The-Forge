'use strict';
// ---------------------------------------------------------------------------
// font.js — a 5x7 bitmap font.
//
// The browser's monospace font is a vector face; rasterised at 7px it comes out soft, and the
// whole canvas is then scaled up with nearest-neighbour, which magnifies the blur. Drawing our
// own glyphs keeps every letter crisp at any zoom.
//
// Each glyph is 7 rows, one base-32 digit per row, 5 bits wide (bit 4 = leftmost pixel).
// '.###.' is 01110 = 14 = 'E'.
// ---------------------------------------------------------------------------
const Font = {
  W: 5, H: 7, GAP: 1,

  glyphs: {
    ' ': '0000000',
    'A': 'EHHVHHH', 'B': 'UHHUHHU', 'C': 'EHGGGHE', 'D': 'SIHHHIS', 'E': 'VGGUGGV',
    'F': 'VGGUGGG', 'G': 'EHGNHHE', 'H': 'HHHVHHH', 'I': 'E44444E', 'J': '72222IC',
    'K': 'HIKOKIH', 'L': 'GGGGGGV', 'M': 'HRLLHHH', 'N': 'HPLJHHH', 'O': 'EHHHHHE',
    'P': 'UHHUGGG', 'Q': 'EHHHLID', 'R': 'UHHUKIH', 'S': 'FGGE11U', 'T': 'V444444',
    'U': 'HHHHHHE', 'V': 'HHHHHA4', 'W': 'HHHLLRH', 'X': 'HHA4AHH', 'Y': 'HHA4444',
    'Z': 'V1248GV',
    'a': '00E1FHF', 'b': 'GGUHHHU', 'c': '00EGGHE', 'd': '11FHHHF', 'e': '00EHVGE',
    'f': '688S888', 'g': '00FHF1E', 'h': 'GGUHHHH', 'i': '40C444E', 'j': '20222IC',
    'k': 'GGIKOKI', 'l': 'C44444E', 'm': '00QLLLL', 'n': '00UHHHH', 'o': '00EHHHE',
    'p': '00UHUGG', 'q': '00FHF11', 'r': '00MOGGG', 's': '00FGE1U', 't': '88S8896',
    'u': '00HHHHF', 'v': '00HHHA4', 'w': '00HLLLA', 'x': '00HA4AH', 'y': '00HHF1E',
    'z': '00V248V',
    '0': 'EHJLPHE', '1': '4C4444E', '2': 'EH1248V', '3': 'V2421HE', '4': '26AIV22',
    '5': 'VGU11HE', '6': '68GUHHE', '7': 'VH12444', '8': 'EHHEHHE', '9': 'EHHF12C',
    '.': '0000044', ',': '0000048', ':': '0040040', ';': '0040048', '!': '4444404',
    '?': 'EH12404', '-': '000E000', '+': '004E400', '=': '00E0E00', '/': '11248GG',
    '\\': 'GG84211', '(': '48GGG84', ')': '4211124', '[': 'E88888E', ']': 'E22222E',
    '%': 'PP248JJ', '&': 'CIK8LID', '#': 'AAVAVAA', '*': '04LEL40', "'": '4400000',
    '"': 'AA00000', '<': '0248420', '>': '0842480', '|': '4444444', '_': '000000V',
    '@': 'EHNLNGE', '$': '4FKE5U4', '^': '4AH0000', '~': '000C600',
    '°': 'CC00000',   // degree
    '·': '0004000',   // middle dot
    '—': '000V000',   // em dash
  },

  _atlas: {}, _order: null, _index: null,

  // One atlas per colour+scale, built once and then blitted per character.
  atlas(col, scale) {
    const key = col + '|' + scale;
    if (this._atlas[key]) return this._atlas[key];
    if (!this._order) {
      this._order = Object.keys(this.glyphs);
      this._index = {};
      for (let i = 0; i < this._order.length; i++) this._index[this._order[i]] = i;
    }
    const cw = (this.W + this.GAP) * scale, ch = this.H * scale;
    const c = Art.mk(this._order.length * cw, ch, (g) => {
      g.fillStyle = col;
      for (let i = 0; i < this._order.length; i++) {
        const rows = this.glyphs[this._order[i]];
        for (let r = 0; r < this.H; r++) {
          const bits = parseInt(rows[r], 32);
          if (!bits) continue;
          for (let b = 0; b < this.W; b++) {
            if (bits & (1 << (this.W - 1 - b))) g.fillRect(i * cw + b * scale, r * scale, scale, scale);
          }
        }
      }
    });
    return (this._atlas[key] = { c, cw, ch });
  },

  // Pixel size maps onto whole-number scales, so glyphs never land on half pixels.
  scaleFor(size) { return size >= 30 ? 4 : size >= 20 ? 3 : size >= 12 ? 2 : 1; },
  width(str, scale) {
    const n = String(str).length;
    return n ? n * (this.W + this.GAP) * scale - this.GAP * scale : 0;
  },
  draw(str, x, y, col, scale, g) {
    g = g || ctx;
    const a = this.atlas(col, scale);
    str = String(str);
    const step = (this.W + this.GAP) * scale;
    for (let i = 0; i < str.length; i++) {
      let ch = str[i];
      if (this._index[ch] === undefined) ch = this.glyphs[ch] ? ch : '?';
      const idx = this._index[ch];
      if (idx === undefined || ch === ' ') continue;
      g.drawImage(a.c, idx * a.cw, 0, a.cw, a.ch, x + i * step, y, a.cw, a.ch);
    }
  },
};
