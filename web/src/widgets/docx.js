// Génère un petit document Word (.docx) dans le navigateur, sans dépendance.
// blocs : [{ titre: 'Fiche E-T-S-C' }, { sous: 'Entrée', texte: '…', aide: '…' }, …]

const enc = new TextEncoder();
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

function zip(files) {
  const parts = [], central = []; let offset = 0;
  for (const [name, txt] of files) {
    const data = enc.encode(txt), nm = enc.encode(name), crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
    h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, nm.length, true);
    parts.push(new Uint8Array(h.buffer), nm, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
    c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, nm.length, true); c.setUint32(42, offset, true);
    central.push(new Uint8Array(c.buffer), nm);
    offset += 30 + nm.length + data.length;
  }
  const size = central.reduce((s, x) => s + x.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, size, true); e.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

const x = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const run = (t, o = {}) => `<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>${o.b ? '<w:b/>' : ''}${o.i ? '<w:i/>' : ''}<w:color w:val="${o.c || '1F2D3D'}"/><w:sz w:val="${o.s || 22}"/></w:rPr><w:t xml:space="preserve">${x(t)}</w:t></w:r>`;
// Ordre des éléments de w:pPr imposé par le schéma : keepNext avant spacing, ind après.
const para = (runs, after = 120, extra = '') => `<w:p><w:pPr>${extra.includes('keepNext') ? extra : ''}<w:spacing w:after="${after}"/>${extra.includes('keepNext') ? '' : extra}</w:pPr>${runs}</w:p>`;

// Largeur utile de la page A4 avec les marges ci-dessous (en vingtièmes de point).
const LARGEUR = 9638;
const bord = (c) => `<w:top w:val="single" w:sz="4" w:color="${c}"/><w:left w:val="single" w:sz="4" w:color="${c}"/><w:bottom w:val="single" w:sz="4" w:color="${c}"/><w:right w:val="single" w:sz="4" w:color="${c}"/><w:insideH w:val="single" w:sz="4" w:color="${c}"/><w:insideV w:val="single" w:sz="4" w:color="${c}"/>`;

// Tableau Word : { entetes: [...], lignes: [[...], ...] }
function tableau({ entetes, lignes }) {
  const n = entetes.length;
  const w = Math.floor(LARGEUR / n);
  const cellule = (t, o = {}) => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${o.fond ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.fond}"/>` : ''}</w:tcPr>${String(t).split('\n').map((l) => para(run(l, { b: o.b, s: 19, c: o.c }), 40)).join('')}</w:tc>`;
  const tete = `<w:tr><w:trPr><w:tblHeader/></w:trPr>${entetes.map((h) => cellule(h, { b: true, fond: '009982', c: 'FFFFFF' })).join('')}</w:tr>`;
  const corps = lignes.map((l, i) => `<w:tr><w:trPr><w:cantSplit/></w:trPr>${l.map((c, j) => cellule(c, { b: j === 0, fond: i % 2 ? 'F5F8F7' : '' })).join('')}</w:tr>`).join('');
  return `<w:tbl><w:tblPr><w:tblW w:w="${LARGEUR}" w:type="dxa"/><w:tblBorders>${bord('C9BFB1')}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${entetes.map(() => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${tete}${corps}</w:tbl>${para('', 120)}`;
}

/**
 * Génère le .docx. Blocs :
 *   { titre } · { note } · { sous, texte, aide }            (fiches existantes)
 *   { h2 } · { h3 } · { p } · { puce } · { tableau: {entetes, lignes} } · { saut: true }
 * options.pied : texte du pied de page, répété sur chaque page.
 */
export function docx(blocs, options = {}) {
  const body = blocs.map((b) => {
    if (b.titre) return para(run(b.titre, { b: true, s: 36 }), 240);
    if (b.note) return para(run(b.note, { i: true, s: 18, c: '5D6C73' }), 240);
    if (b.h2) return para(run(b.h2, { b: true, s: 28, c: '009982' }), 120, '<w:keepNext/>');
    if (b.h3) return para(run(b.h3, { b: true, s: 23 }), 60, '<w:keepNext/>');
    if (b.p) return para(run(b.p), 120);
    if (b.puce) return para(run('•  ' + b.puce), 60, '<w:ind w:left="360" w:hanging="260"/>');
    if (b.tableau) return tableau(b.tableau);
    if (b.saut) return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
    const lignes = String(b.texte || '').split(/\n/);
    return para(run(b.sous, { b: true, s: 24, c: '009982' }), 40)
      + (b.aide ? para(run(b.aide, { i: true, s: 19, c: '5D6C73' }), 60) : '')
      + lignes.map((l, i) => para(run(l || ' '), i === lignes.length - 1 ? 220 : 40)).join('');
  }).join('');
  const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  const pied = options.pied ? '<w:footerReference w:type="default" r:id="rId1"/>' : '';
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${body}<w:sectPr>${pied}<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const footer = options.pied ? `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ${NS}>${para(run(options.pied, { i: true, s: 16, c: '5D6C73' }), 0)}</w:ftr>` : '';
  const ct = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
    + (options.pied ? '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' : '') + '</Types>';
  const fichiers = [
    ['[Content_Types].xml', ct],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'],
    ['word/document.xml', doc],
  ];
  if (options.pied) {
    fichiers.push(['word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>']);
    fichiers.push(['word/footer1.xml', footer]);
  }
  return zip(fichiers);
}

export function downloadBlob(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
