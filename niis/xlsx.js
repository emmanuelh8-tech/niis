// niis/xlsx.js: reads the cells of an Excel workbook (.xlsx / .xlsm) with no dependency.
// An .xlsx is a zip of XML parts: the workbook lists the sheets, a relationships part says which file
// holds each, shared strings hold the text, and each sheet holds rows of cells. Only values are read:
// formulas give their cached result, styles and dates are not interpreted (a date stays its serial number).
'use strict';
const zlib = require('node:zlib');

// ---- the zip: its central directory, then each entry's data
function unzip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a zip file');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = new Map();
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('damaged zip directory');
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nameLen).toString('utf8');
    files.set(name, { method, csize, local });
    p += 46 + nameLen + extraLen + commentLen;
  }
  const read = (name) => {
    const f = files.get(name);
    if (!f) return null;
    if (buf.readUInt32LE(f.local) !== 0x04034b50) throw new Error('damaged zip entry ' + name);
    const start = f.local + 30 + buf.readUInt16LE(f.local + 26) + buf.readUInt16LE(f.local + 28);
    const data = buf.slice(start, start + f.csize);
    if (f.method === 0) return data;
    if (f.method === 8) return zlib.inflateRawSync(data);
    throw new Error('unsupported zip compression in ' + name);
  };
  return { names: [...files.keys()], read };
}

const decode = (s) => String(s).replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e) => {
  if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
  return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[e.toLowerCase()];
});
const attr = (tag, name) => { const m = new RegExp('\\s' + name + '="([^"]*)"').exec(tag); return m ? decode(m[1]) : null; };
// all the text runs inside a string item, in order (<t>…</t>, also inside rich-text <r> runs)
const textOf = (xml) => { let out = ''; const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g; let m; while ((m = re.exec(xml))) out += m[1] ? decode(m[1]) : ''; return out; };
const colIndex = (ref) => { let n = 0; for (const ch of /^[A-Z]+/.exec(ref)[0]) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };

// readXlsx(buffer) -> [{ name, rows: string[][] }]
function readXlsx(buf) {
  const z = unzip(buf);
  const text = (n) => { const b = z.read(n); return b ? b.toString('utf8') : null; };
  const wb = text('xl/workbook.xml');
  if (!wb) throw new Error('this zip is not an Excel workbook');
  const rels = new Map();
  for (const m of (text('xl/_rels/workbook.xml.rels') || '').matchAll(/<Relationship\b[^>]*>/g)) {
    const id = attr(m[0], 'Id'), target = attr(m[0], 'Target');
    if (id && target) rels.set(id, target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, ''));
  }
  const shared = [];
  const ss = text('xl/sharedStrings.xml');
  if (ss) for (const m of ss.matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g)) shared.push(m[1] ? textOf(m[1]) : '');
  const sheets = [];
  for (const m of wb.matchAll(/<sheet\b[^>]*>/g)) {
    const name = attr(m[0], 'name') || 'Sheet';
    const rid = attr(m[0], 'r:id');
    const file = rels.get(rid);
    const xml = file ? text(file) : null;
    if (!xml) continue;
    const rows = [];
    for (const rm of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
      const rAttr = attr('<row' + rm[1] + '>', 'r');
      const ri = rAttr ? Number(rAttr) - 1 : rows.length;
      const cells = [];
      for (const cm of rm[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const tag = '<c' + cm[1] + '>';
        const ref = attr(tag, 'r');
        const t = attr(tag, 't');
        const inner = cm[2] || '';
        const v = /<v>([\s\S]*?)<\/v>/.exec(inner);
        let val = '';
        if (t === 's') val = v ? (shared[Number(v[1])] ?? '') : '';
        else if (t === 'inlineStr') val = textOf(inner);
        else if (t === 'b') val = v ? (v[1] === '1' ? 'TRUE' : 'FALSE') : '';
        else if (t === 'e') val = '';
        else val = v ? decode(v[1]) : '';
        const ci = ref ? colIndex(ref) : cells.length;
        cells[ci] = val;
      }
      for (let i = 0; i < cells.length; i++) if (cells[i] == null) cells[i] = '';
      rows[ri] = cells;
    }
    for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
    sheets.push({ name, rows });
  }
  return sheets;
}

module.exports = { readXlsx, unzip };
