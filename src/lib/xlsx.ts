/**
 * Minimal .xlsx writer (no external library — same approach as scripts/export-excel.mjs).
 * Server-only (uses node:zlib / Buffer).
 */
import { deflateRawSync } from "node:zlib";

/** Cell styles (index into cellXfs below). */
export const S = {
  normal: 0,
  header: 1, // white bold on navy
  title: 2, // bold navy 14pt
  sub: 3, // grey
  total: 4, // bold on light amber
  bad: 5, // red bold on light red
  int: 6, // #,##0
  dec: 7, // #,##0.00
  totalInt: 8,
  label: 9, // bold
  wrap: 10, // wrapped text, top-aligned
  condKey: 11, // bold on light amber (conditions block)
  condVal: 12, // on light amber (conditions block)
  hdrKey: 13, // small grey bold label on light amber (file header)
  hdrVal: 14, // bold navy value on light amber (file header)
} as const;

export type Cell = string | number | null | undefined | { v: string | number | null | undefined; s?: number };
export interface SheetSpec {
  name: string;
  rows: Cell[][];
  /** freeze rows above this 1-based row (e.g. 5 → rows 1–4 frozen) */
  freezeRow?: number;
  /** autofilter over [headerRow, lastRow] (1-based) */
  filter?: { headerRow: number; lastRow: number; cols: number };
  widths?: number[];
  /** merged ranges, e.g. "A2:C2" */
  merges?: string[];
  /** width overrides for single columns (0-based) on top of the automatic widths */
  colWidths?: Record<number, number>;
  /** custom row heights in points, keyed by 0-based row index */
  rowHeights?: Record<number, number>;
  /** pictures placed at a cell's top-left corner (0-based row/col), sized in pixels */
  images?: SheetImage[];
}
export interface SheetImage {
  row: number;
  col: number;
  data: Buffer;
  ext: "jpeg" | "png";
  /** display size in pixels */
  w: number;
  h: number;
}

const MAX_CELL = 32767;
const esc = (s: string) =>
  s
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
export const colRef = (n: number) => {
  let s = "";
  n++;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = (n - r - 1) / 26;
  }
  return s;
};

function norm(c: Cell): { v: string | number | null | undefined; s: number } {
  if (c !== null && typeof c === "object") return { v: c.v, s: c.s ?? 0 };
  return { v: c, s: typeof c === "number" ? S.normal : 0 };
}

const SKIP_WIDTH: number[] = [S.title, S.sub, S.condKey, S.condVal, S.hdrKey, S.hdrVal];
/** Automatic column width (characters) — the same rule the sheet uses, exported so callers can plan merges. */
export function autoWidth(rows: Cell[][], ci: number): number {
  let w = 8;
  for (const r of rows.slice(0, 300)) {
    const c = norm(r[ci]);
    if (SKIP_WIDTH.includes(c.s)) continue;
    w = Math.max(w, String(c.v ?? "").length + 3);
  }
  return Math.min(w, 48);
}

function sheetXml(sp: SheetSpec): string {
  const ncols = Math.max(1, ...sp.rows.map((r) => r.length));
  const widths = sp.widths || Array.from({ length: ncols }, (_, ci) => sp.colWidths?.[ci] ?? autoWidth(sp.rows, ci));
  const cols = `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>`;
  const body = sp.rows
    .map((r, ri) => {
      const cells = r
        .map((raw, ci) => {
          const { v, s } = norm(raw);
          const ref = colRef(ci) + (ri + 1);
          const st = s ? ` s="${s}"` : "";
          if (v === null || v === undefined || v === "") return s ? `<c r="${ref}"${st}/>` : "";
          if (typeof v === "number" && Number.isFinite(v)) return `<c r="${ref}"${st}><v>${v}</v></c>`;
          return `<c r="${ref}" t="inlineStr"${st}><is><t xml:space="preserve">${esc(String(v).slice(0, MAX_CELL))}</t></is></c>`;
        })
        .join("");
      const ht = sp.rowHeights?.[ri];
      return `<row r="${ri + 1}"${ht ? ` ht="${ht}" customHeight="1"` : ""}>${cells}</row>`;
    })
    .join("");
  const pane = sp.freezeRow
    ? `<pane ySplit="${sp.freezeRow - 1}" topLeftCell="A${sp.freezeRow}" activePane="bottomLeft" state="frozen"/>`
    : "";
  const af = sp.filter ? `<autoFilter ref="A${sp.filter.headerRow}:${colRef(sp.filter.cols - 1)}${sp.filter.lastRow}"/>` : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetViews><sheetView workbookViewId="0">${pane}</sheetView></sheetViews>${cols}<sheetData>${body}</sheetData>${af}${sp.merges?.length ? `<mergeCells count="${sp.merges.length}">${sp.merges.map((m) => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>` : ""}${sp.images?.length ? `<drawing r:id="rId1"/>` : ""}</worksheet>`;
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0"/><numFmt numFmtId="165" formatCode="#,##0.00"/></numFmts>
<fonts count="7"><font><sz val="11"/><name val="Tahoma"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Tahoma"/></font><font><b/><sz val="15"/><color rgb="FF000080"/><name val="Tahoma"/></font><font><sz val="10"/><color rgb="FF666666"/><name val="Tahoma"/></font><font><b/><sz val="11"/><name val="Tahoma"/></font><font><b/><sz val="11"/><color rgb="FFBA1A1A"/><name val="Tahoma"/></font><font><b/><sz val="12"/><color rgb="FF000080"/><name val="Tahoma"/></font></fonts>
<fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF000080"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF4E2"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFE0DE"/></patternFill></fill></fills>
<borders count="2"><border/><border><top style="medium"><color rgb="FFD98200"/></top></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="15">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="4" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="165" fontId="5" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="164" fontId="4" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="4" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1"/>
<xf numFmtId="0" fontId="3" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="bottom"/></xf>
<xf numFmtId="0" fontId="6" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="top"/></xf>
</cellXfs></styleSheet>`;

const EMU = 9525; // per pixel
function drawingXml(imgs: SheetImage[]): string {
  const anchors = imgs
    .map(
      (im, i) => `<xdr:oneCellAnchor><xdr:from><xdr:col>${im.col}</xdr:col><xdr:colOff>${4 * EMU}</xdr:colOff><xdr:row>${im.row}</xdr:row><xdr:rowOff>${4 * EMU}</xdr:rowOff></xdr:from><xdr:ext cx="${Math.round(im.w * EMU)}" cy="${Math.round(im.h * EMU)}"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${i + 2}" name="Picture ${i + 1}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId${i + 1}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${Math.round(im.w * EMU)}" cy="${Math.round(im.h * EMU)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>`
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${anchors}</xdr:wsDr>`;
}

export function buildXlsx(sheets: SheetSpec[]): Buffer {
  const n = sheets.length;
  const files: Record<string, string | Buffer> = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${esc(s.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    "xl/styles.xml": STYLES,
  };
  let media = 0;
  const drawingOverrides: string[] = [];
  sheets.forEach((s, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = sheetXml(s);
    if (!s.images?.length) return;
    const d = `drawing${i + 1}`;
    files[`xl/worksheets/_rels/sheet${i + 1}.xml.rels`] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/${d}.xml"/></Relationships>`;
    const rels = s.images.map((im, k) => {
      const name = `image${++media}.${im.ext}`;
      files[`xl/media/${name}`] = im.data;
      return `<Relationship Id="rId${k + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${name}"/>`;
    });
    files[`xl/drawings/${d}.xml`] = drawingXml(s.images);
    files[`xl/drawings/_rels/${d}.xml.rels`] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join("")}</Relationships>`;
    drawingOverrides.push(`<Override PartName="/xl/drawings/${d}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`);
  });
  if (media) {
    files["[Content_Types].xml"] = (files["[Content_Types].xml"] as string).replace(
      "<Override ",
      `<Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="png" ContentType="image/png"/>${drawingOverrides.join("")}<Override `
    );
  }
  return zip(files);
}

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zip(files: Record<string, string | Buffer>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameB = Buffer.from(name, "utf8");
    const data = typeof content === "string" ? Buffer.from(content, "utf8") : content;
    const crc = crc32(data);
    const packed = deflateRawSync(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0x0800, 6);
    lh.writeUInt16LE(8, 8);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(packed.length, 18);
    lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(nameB.length, 26);
    locals.push(lh, nameB, packed);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(8, 10);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(packed.length, 20);
    ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(nameB.length, 28);
    ch.writeUInt32LE(offset, 42);
    centrals.push(ch, nameB);
    offset += 30 + nameB.length + packed.length;
  }
  const cd = Buffer.concat(centrals);
  const count = Object.keys(files).length;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(count, 8);
  eocd.writeUInt16LE(count, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}
