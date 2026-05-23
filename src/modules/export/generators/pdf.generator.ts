import { existsSync, readFileSync } from "node:fs";
import type { ExportBlock, ExportBundle, ExportDocument } from "../export.types";

const page = {
  width: 595,
  height: 842,
  margin: 56
};

const pdfBullet = "\u2022";
const pdfCheckedBox = "\u2611";
const pdfUncheckedBox = "\u2610";

type FontName = "F1" | "F2" | "F3" | "F4";

type PdfPage = {
  commands: string[];
  links: PdfLinkAnnotation[];
};

type PdfLinkAnnotation = {
  rect: [number, number, number, number];
  destination: string;
};

type PdfDestination = {
  pageIndex: number;
  top: number;
};

type ParsedTrueTypeFont = {
  buffer: Buffer;
  unitsPerEm: number;
  ascent: number;
  descent: number;
  bbox: [number, number, number, number];
  defaultWidth: number;
  getAdvanceWidth: (glyphId: number) => number;
  getGlyphId: (codePoint: number) => number;
};

export async function generatePdf(document: ExportDocument): Promise<Buffer> {
  return generatePdfBundle({ title: document.title, documents: [document] });
}

export async function generatePdfBundle(bundle: ExportBundle): Promise<Buffer> {
  const writer = new PdfWriter();
  const hasMultipleDocuments = bundle.documents.length > 1;

  if (!hasMultipleDocuments) {
    writer.text(bundle.title, { font: "F2", size: 24, gapAfter: 18 });
  } else {
    writer.text("Table of contents", { font: "F2", size: 14, gapAfter: 8 });
    bundle.documents.forEach((document, index) => {
      writer.text(`${index + 1}. ${document.title}`, {
        font: "F1",
        size: 11,
        indent: 12,
        gapAfter: 4,
        linkDestination: createDocumentDestinationName(index)
      });
    });
    writer.pageBreak();
  }

  bundle.documents.forEach((document, index) => {
    if (index > 0) {
      writer.pageBreak();
    }

    if (hasMultipleDocuments) {
      writer.markDestination(createDocumentDestinationName(index));
      writer.text(document.title, { font: "F2", size: 20, gapAfter: 14 });
    }

    document.blocks.forEach((block) => renderBlock(writer, block));
  });

  return writer.toBuffer();
}

function renderBlock(writer: PdfWriter, block: ExportBlock) {
  switch (block.type) {
    case "heading":
      writer.text(block.text, {
        font: "F2",
        size: block.level === 1 ? 20 : block.level === 2 ? 16 : 13,
        gapBefore: 8,
        gapAfter: 8
      });
      break;
    case "paragraph":
      writer.text(block.text, { font: "F1", size: 11, gapAfter: 10 });
      break;
    case "quote":
      writer.text(block.text, { font: "F3", size: 11, indent: 18, gapAfter: 10 });
      break;
    case "divider":
      writer.divider();
      break;
    case "list":
      block.items.forEach((item, index) => {
        writer.text(`${block.ordered ? `${index + 1}.` : pdfBullet} ${item}`, {
          font: "F1",
          size: 11,
          indent: 14,
          gapAfter: 3
        });
      });
      writer.gap(8);
      break;
    case "checklist":
      block.items.forEach((item) => {
        writer.text(`${item.checked ? pdfCheckedBox : pdfUncheckedBox} ${item.text}`, {
          font: "F1",
          size: 11,
          indent: 14,
          gapAfter: 3
        });
      });
      writer.gap(8);
      break;
    case "code":
      writer.text(block.language.toUpperCase(), { font: "F2", size: 8, gapAfter: 4 });
      writer.text(block.code, { font: "F4", size: 9, preserveNewlines: true, gapAfter: 12 });
      break;
    case "table":
      writer.table(block.rows, { font: "F1", size: 9, gapAfter: 12 });
      break;
  }
}

class PdfWriter {
  private pages: PdfPage[] = [];
  private currentPage: PdfPage;
  private usedCharacterCodes = new Set<number>();
  private y = page.height - page.margin;

  constructor() {
    this.currentPage = this.addPage();
  }

  text(
    value: string,
    options: {
      font: FontName;
      size: number;
      indent?: number;
      gapBefore?: number;
      gapAfter?: number;
      preserveNewlines?: boolean;
      linkDestination?: string;
    }
  ) {
    this.gap(options.gapBefore ?? 0);

    const lines = options.preserveNewlines
      ? value.split(/\r?\n/)
      : wrapText(value, this.maxCharsPerLine(options.size, options.indent ?? 0));

    lines.forEach((line) => {
      this.ensureSpace(options.size + 5);
      const x = page.margin + (options.indent ?? 0);
      this.trackCharacters(line || " ");
      this.currentPage.commands.push(
        `BT /${options.font} ${options.size} Tf ${x} ${this.y} Td ${toPdfHexString(line || " ")} Tj ET`
      );
      if (options.linkDestination) {
        this.currentPage.links.push({
          rect: [
            x,
            this.y - 2,
            x + estimateTextWidth(line || " ", options.size),
            this.y + options.size + 2
          ],
          destination: options.linkDestination
        });
      }
      this.y -= options.size + 5;
    });

    this.gap(options.gapAfter ?? 0);
  }

  divider() {
    this.ensureSpace(18);
    this.y -= 5;
    this.currentPage.commands.push(`${page.margin} ${this.y} m ${page.width - page.margin} ${this.y} l S`);
    this.y -= 13;
  }

  table(
    rows: string[][],
    options: {
      font: FontName;
      size: number;
      gapBefore?: number;
      gapAfter?: number;
    }
  ) {
    if (rows.length === 0) {
      return;
    }

    this.gap(options.gapBefore ?? 0);
    const columnCount = Math.max(...rows.map((row) => row.length));
    const tableWidth = page.width - page.margin * 2;
    const columnWidth = tableWidth / Math.max(columnCount, 1);
    const padding = 5;
    const lineHeight = options.size + 4;

    rows.forEach((row) => {
      const cellLines = Array.from({ length: columnCount }, (_, index) =>
        wrapText(row[index] ?? "", Math.max(4, Math.floor((columnWidth - padding * 2) / (options.size * 0.55))))
      );
      const rowHeight = Math.max(...cellLines.map((lines) => lines.length), 1) * lineHeight + padding * 2;

      this.ensureSpace(rowHeight);
      const top = this.y;
      const bottom = top - rowHeight;

      for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
        const x = page.margin + columnIndex * columnWidth;
        this.currentPage.commands.push(
          `${x} ${top} m ${x + columnWidth} ${top} l ${x + columnWidth} ${bottom} l ${x} ${bottom} l h S`
        );

        cellLines[columnIndex].forEach((line, lineIndex) => {
          const text = line || " ";
          const textX = x + padding;
          const textY = top - padding - options.size - lineIndex * lineHeight;
          this.trackCharacters(text);
          this.currentPage.commands.push(
            `BT /${options.font} ${options.size} Tf ${textX} ${textY} Td ${toPdfHexString(text)} Tj ET`
          );
        });
      }

      this.y = bottom;
    });

    this.gap(options.gapAfter ?? 0);
  }

  pageBreak() {
    this.currentPage = this.addPage();
    this.y = page.height - page.margin;
  }

  markDestination(name: string) {
    this.destinations.set(name, {
      pageIndex: this.currentPageIndex(),
      top: this.y
    });
  }

  gap(value: number) {
    if (value <= 0) {
      return;
    }

    this.ensureSpace(value);
    this.y -= value;
  }

  toBuffer() {
    const objects: string[] = [];
    const pageObjectIds: number[] = [];
    const embeddedFonts = createEmbeddedUnicodeFontObjects(this.usedCharacterCodes);

    objects.push("<< /Type /Catalog /Pages 2 0 R >>");
    objects.push("");
    objects.push(...embeddedFonts.objects);

    let nextObjectId = objects.length + 1;
    const pageRecords = this.pages.map((pdfPage) => {
      const links = pdfPage.links.filter((link) => this.destinations.has(link.destination));
      const contentId = nextObjectId;
      nextObjectId += 1;
      const annotationIds = links.map(() => {
        const annotationId = nextObjectId;
        nextObjectId += 1;
        return annotationId;
      });
      const pageId = nextObjectId;
      nextObjectId += 1;

      return {
        pdfPage,
        links,
        contentId,
        annotationIds,
        pageId
      };
    });

    pageRecords.forEach(({ pdfPage, links, contentId, annotationIds, pageId }) => {
      const stream = pdfPage.commands.join("\n");
      objects.push(`<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`);

      links.forEach((link) => {
        const destination = this.destinations.get(link.destination)!;
        const targetPage = pageRecords[destination.pageIndex]!;

        objects.push(
          [
            "<<",
            "/Type /Annot",
            "/Subtype /Link",
            `/Rect [${link.rect.map(formatPdfNumber).join(" ")}]`,
            "/Border [0 0 0]",
            `/Dest [${targetPage.pageId} 0 R /XYZ null ${formatPdfNumber(destination.top)} null]`,
            ">>"
          ].join(" ")
        );
      });

      const annots =
        annotationIds.length > 0 ? `/Annots [${annotationIds.map((id) => `${id} 0 R`).join(" ")}]` : "";
      objects.push(
        [
          "<<",
          "/Type /Page",
          "/Parent 2 0 R",
          `/MediaBox [0 0 ${page.width} ${page.height}]`,
          "/Resources <<",
          "/Font <<",
          `/F1 ${embeddedFonts.sansFontObjectId} 0 R`,
          `/F2 ${embeddedFonts.sansFontObjectId} 0 R`,
          `/F3 ${embeddedFonts.sansFontObjectId} 0 R`,
          `/F4 ${embeddedFonts.monoFontObjectId} 0 R`,
          ">>",
          ">>",
          `/Contents ${contentId} 0 R`,
          annots,
          ">>"
        ].join(" ")
      );
      pageObjectIds.push(pageId);
    });

    objects[1] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >>`;

    const parts = ["%PDF-1.4\n"];
    const offsets: number[] = [0];

    objects.forEach((object, index) => {
      offsets.push(Buffer.byteLength(parts.join(""), "utf8"));
      parts.push(`${index + 1} 0 obj\n${object}\nendobj\n`);
    });

    const xrefOffset = Buffer.byteLength(parts.join(""), "utf8");
    parts.push(`xref\n0 ${objects.length + 1}\n`);
    parts.push("0000000000 65535 f \n");
    offsets.slice(1).forEach((offset) => {
      parts.push(`${String(offset).padStart(10, "0")} 00000 n \n`);
    });
    parts.push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

    return Buffer.from(parts.join(""), "utf8");
  }

  private ensureSpace(required: number) {
    if (this.y - required < page.margin) {
      this.currentPage = this.addPage();
      this.y = page.height - page.margin;
    }
  }

  private addPage(): PdfPage {
    const pdfPage = { commands: [], links: [] };
    this.pages.push(pdfPage);
    return pdfPage;
  }

  private currentPageIndex() {
    return this.pages.length - 1;
  }

  private maxCharsPerLine(size: number, indent: number) {
    const usableWidth = page.width - page.margin * 2 - indent;
    return Math.max(20, Math.floor(usableWidth / (size * 0.55)));
  }

  private trackCharacters(value: string) {
    for (let index = 0; index < value.length; index += 1) {
      this.usedCharacterCodes.add(value.charCodeAt(index));
    }
  }

  private destinations = new Map<string, PdfDestination>();
}

function wrapText(value: string, maxChars: number) {
  return value
    .split(/\r?\n/)
    .flatMap((line) => {
      const words = line.split(/\s+/).filter(Boolean);
      const wrapped: string[] = [];
      let current = "";

      words.forEach((word) => {
        if (`${current} ${word}`.trim().length > maxChars) {
          if (current) {
            wrapped.push(current);
          }
          current = word;
        } else {
          current = `${current} ${word}`.trim();
        }
      });

      if (current) {
        wrapped.push(current);
      }

      return wrapped.length > 0 ? wrapped : [""];
    });
}

function toPdfHexString(value: string) {
  const bytes: number[] = [];

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    bytes.push((code >> 8) & 0xff, code & 0xff);
  }

  return `<${bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("")}>`;
}

function createDocumentDestinationName(index: number) {
  return `note-${index + 1}`;
}

function estimateTextWidth(value: string, size: number) {
  return Math.max(size, value.length * size * 0.55);
}

function formatPdfNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function createEmbeddedUnicodeFontObjects(usedCharacterCodes: Set<number>) {
  const sansFont = loadUnicodeFont(sansFontCandidates);
  if (!sansFont) {
    throw new Error("No Unicode TrueType font found for PDF export.");
  }

  const monoFont = loadUnicodeFont(monoFontCandidates) ?? sansFont;
  const sansObjects = createEmbeddedFontObjectSet("TechNoteSans", sansFont, usedCharacterCodes, 3);
  const monoObjects = createEmbeddedFontObjectSet("TechNoteMono", monoFont, usedCharacterCodes, 9);

  return {
    sansFontObjectId: sansObjects.fontObjectId,
    monoFontObjectId: monoObjects.fontObjectId,
    objects: [...sansObjects.objects, ...monoObjects.objects]
  };
}

function createEmbeddedFontObjectSet(
  fontName: string,
  font: ParsedTrueTypeFont,
  usedCharacterCodes: Set<number>,
  fontObjectId: number
) {
  const cidFontObjectId = fontObjectId + 1;
  const descriptorObjectId = fontObjectId + 2;
  const fontFileObjectId = fontObjectId + 3;
  const cidToGidMapObjectId = fontObjectId + 4;
  const toUnicodeObjectId = fontObjectId + 5;
  const widths = createWidthEntries(font, usedCharacterCodes);
  const bbox = font.bbox.map((value) => scaleFontMetric(value, font.unitsPerEm)).join(" ");

  return {
    fontObjectId,
    objects: [
      [
        "<<",
        "/Type /Font",
        "/Subtype /Type0",
        `/BaseFont /${fontName}`,
        "/Encoding /Identity-H",
        `/DescendantFonts [${cidFontObjectId} 0 R]`,
        `/ToUnicode ${toUnicodeObjectId} 0 R`,
        ">>"
      ].join(" "),
      [
        "<<",
        "/Type /Font",
        "/Subtype /CIDFontType2",
        `/BaseFont /${fontName}`,
        "/CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >>",
        `/FontDescriptor ${descriptorObjectId} 0 R`,
        `/DW ${font.defaultWidth}`,
        `/W [${widths}]`,
        `/CIDToGIDMap ${cidToGidMapObjectId} 0 R`,
        ">>"
      ].join(" "),
      [
        "<<",
        "/Type /FontDescriptor",
        `/FontName /${fontName}`,
        "/Flags 32",
        `/FontBBox [${bbox}]`,
        "/ItalicAngle 0",
        `/Ascent ${scaleFontMetric(font.ascent, font.unitsPerEm)}`,
        `/Descent ${scaleFontMetric(font.descent, font.unitsPerEm)}`,
        `/CapHeight ${scaleFontMetric(font.ascent, font.unitsPerEm)}`,
        "/StemV 80",
        `/FontFile2 ${fontFileObjectId} 0 R`,
        ">>"
      ].join(" "),
      createHexStream(font.buffer, { length1: font.buffer.length }),
      createHexStream(createCidToGidMap(font, usedCharacterCodes)),
      createTextStream(createToUnicodeCMap(usedCharacterCodes))
    ]
  };
}

const sansFontCandidates = [
  process.env.TECH_NOTE_PDF_FONT_PATH,
  "C:/Windows/Fonts/arial.ttf",
  "C:/Windows/Fonts/segoeui.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
  "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
  "/System/Library/Fonts/Supplemental/Arial.ttf"
];

const monoFontCandidates = [
  process.env.TECH_NOTE_PDF_MONO_FONT_PATH,
  "C:/Windows/Fonts/consola.ttf",
  "C:/Windows/Fonts/consolas.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
  "/usr/share/fonts/truetype/liberation2/LiberationMono-Regular.ttf",
  "/System/Library/Fonts/Supplemental/Courier New.ttf",
  ...sansFontCandidates
];

function loadUnicodeFont(candidates: Array<string | undefined>) {
  const fontPath = candidates.find((candidate): candidate is string => Boolean(candidate && existsSync(candidate)));

  if (!fontPath) {
    return null;
  }

  return parseTrueTypeFont(readFileSync(fontPath));
}

function parseTrueTypeFont(buffer: Buffer): ParsedTrueTypeFont {
  const tables = readTableDirectory(buffer);
  const head = requireTable(tables, "head");
  const hhea = requireTable(tables, "hhea");
  const hmtx = requireTable(tables, "hmtx");
  const cmap = requireTable(tables, "cmap");
  const unitsPerEm = buffer.readUInt16BE(head + 18);
  const ascent = buffer.readInt16BE(hhea + 4);
  const descent = buffer.readInt16BE(hhea + 6);
  const numberOfHMetrics = buffer.readUInt16BE(hhea + 34);
  const advanceWidths = Array.from({ length: numberOfHMetrics }, (_, index) =>
    buffer.readUInt16BE(hmtx + index * 4)
  );
  const lastAdvanceWidth = advanceWidths[advanceWidths.length - 1] ?? 0;
  const getGlyphId = createGlyphMapper(buffer, cmap);

  return {
    buffer,
    unitsPerEm,
    ascent,
    descent,
    bbox: [
      buffer.readInt16BE(head + 36),
      buffer.readInt16BE(head + 38),
      buffer.readInt16BE(head + 40),
      buffer.readInt16BE(head + 42)
    ],
    defaultWidth: scaleFontMetric(lastAdvanceWidth || unitsPerEm / 2, unitsPerEm),
    getAdvanceWidth: (glyphId) => advanceWidths[glyphId] ?? lastAdvanceWidth,
    getGlyphId
  };
}

function readTableDirectory(buffer: Buffer) {
  const tableCount = buffer.readUInt16BE(4);
  const tables = new Map<string, number>();

  for (let index = 0; index < tableCount; index += 1) {
    const recordOffset = 12 + index * 16;
    const tag = buffer.toString("ascii", recordOffset, recordOffset + 4);
    tables.set(tag, buffer.readUInt32BE(recordOffset + 8));
  }

  return tables;
}

function requireTable(tables: Map<string, number>, tag: string) {
  const offset = tables.get(tag);

  if (offset === undefined) {
    throw new Error(`Invalid TrueType font: missing ${tag} table.`);
  }

  return offset;
}

function createGlyphMapper(buffer: Buffer, cmapOffset: number) {
  const subtableOffsets = getCmapSubtableOffsets(buffer, cmapOffset);
  const format12 = subtableOffsets.find((offset) => buffer.readUInt16BE(offset) === 12);
  const format4 = subtableOffsets.find((offset) => buffer.readUInt16BE(offset) === 4);

  if (format12 !== undefined) {
    return createFormat12GlyphMapper(buffer, format12);
  }

  if (format4 !== undefined) {
    return createFormat4GlyphMapper(buffer, format4);
  }

  throw new Error("Invalid TrueType font: unsupported cmap format.");
}

function getCmapSubtableOffsets(buffer: Buffer, cmapOffset: number) {
  const subtableCount = buffer.readUInt16BE(cmapOffset + 2);
  const records = Array.from({ length: subtableCount }, (_, index) => {
    const recordOffset = cmapOffset + 4 + index * 8;

    return {
      platformId: buffer.readUInt16BE(recordOffset),
      encodingId: buffer.readUInt16BE(recordOffset + 2),
      offset: cmapOffset + buffer.readUInt32BE(recordOffset + 4)
    };
  });

  return records
    .sort((left, right) => cmapRecordScore(right) - cmapRecordScore(left))
    .map((record) => record.offset);
}

function cmapRecordScore(record: { platformId: number; encodingId: number }) {
  if (record.platformId === 3 && record.encodingId === 10) {
    return 4;
  }

  if (record.platformId === 0) {
    return 3;
  }

  if (record.platformId === 3 && record.encodingId === 1) {
    return 2;
  }

  return 1;
}

function createFormat12GlyphMapper(buffer: Buffer, tableOffset: number) {
  const groupCount = buffer.readUInt32BE(tableOffset + 12);
  const groups = Array.from({ length: groupCount }, (_, index) => {
    const groupOffset = tableOffset + 16 + index * 12;

    return {
      startCode: buffer.readUInt32BE(groupOffset),
      endCode: buffer.readUInt32BE(groupOffset + 4),
      startGlyphId: buffer.readUInt32BE(groupOffset + 8)
    };
  });

  return (codePoint: number) => {
    const group = groups.find((candidate) => codePoint >= candidate.startCode && codePoint <= candidate.endCode);
    return group ? group.startGlyphId + codePoint - group.startCode : 0;
  };
}

function createFormat4GlyphMapper(buffer: Buffer, tableOffset: number) {
  const segCount = buffer.readUInt16BE(tableOffset + 6) / 2;
  const endCodeOffset = tableOffset + 14;
  const startCodeOffset = endCodeOffset + segCount * 2 + 2;
  const idDeltaOffset = startCodeOffset + segCount * 2;
  const idRangeOffsetOffset = idDeltaOffset + segCount * 2;

  return (codePoint: number) => {
    if (codePoint > 0xffff) {
      return 0;
    }

    for (let index = 0; index < segCount; index += 1) {
      const endCode = buffer.readUInt16BE(endCodeOffset + index * 2);
      const startCode = buffer.readUInt16BE(startCodeOffset + index * 2);

      if (codePoint < startCode || codePoint > endCode) {
        continue;
      }

      const idDelta = buffer.readInt16BE(idDeltaOffset + index * 2);
      const idRangeOffsetPosition = idRangeOffsetOffset + index * 2;
      const idRangeOffset = buffer.readUInt16BE(idRangeOffsetPosition);

      if (idRangeOffset === 0) {
        return (codePoint + idDelta) & 0xffff;
      }

      const glyphOffset = idRangeOffsetPosition + idRangeOffset + (codePoint - startCode) * 2;
      const glyphId = buffer.readUInt16BE(glyphOffset);
      return glyphId === 0 ? 0 : (glyphId + idDelta) & 0xffff;
    }

    return 0;
  };
}

function createWidthEntries(font: ParsedTrueTypeFont, usedCharacterCodes: Set<number>) {
  return [...usedCharacterCodes]
    .sort((left, right) => left - right)
    .map((code) => `${code} [${scaleFontMetric(font.getAdvanceWidth(font.getGlyphId(code)), font.unitsPerEm)}]`)
    .join(" ");
}

function createCidToGidMap(font: ParsedTrueTypeFont, usedCharacterCodes: Set<number>) {
  const maxCode = Math.max(0, ...usedCharacterCodes);
  const bytes = Buffer.alloc((maxCode + 1) * 2);

  usedCharacterCodes.forEach((code) => {
    bytes.writeUInt16BE(font.getGlyphId(code), code * 2);
  });

  return bytes;
}

function createToUnicodeCMap(usedCharacterCodes: Set<number>) {
  const entries = [...usedCharacterCodes]
    .sort((left, right) => left - right)
    .map((code) => `<${toFourDigitHex(code)}> <${toFourDigitHex(code)}>`);
  const sections: string[] = [];

  for (let index = 0; index < entries.length; index += 100) {
    const chunk = entries.slice(index, index + 100);
    sections.push(`${chunk.length} beginbfchar\n${chunk.join("\n")}\nendbfchar`);
  }

  return [
    "/CIDInit /ProcSet findresource begin",
    "12 dict begin",
    "begincmap",
    "/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def",
    "/CMapName /TechNoteUnicodeCMap def",
    "/CMapType 2 def",
    "1 begincodespacerange",
    "<0000> <FFFF>",
    "endcodespacerange",
    ...sections,
    "endcmap",
    "CMapName currentdict /CMap defineresource pop",
    "end",
    "end"
  ].join("\n");
}

function createHexStream(buffer: Buffer, options?: { length1?: number }) {
  const hex = buffer.toString("hex");
  const length1 = options?.length1 ? ` /Length1 ${options.length1}` : "";
  return `<< /Length ${hex.length + 1} /Filter /ASCIIHexDecode${length1} >>\nstream\n${hex}>\nendstream`;
}

function createTextStream(value: string) {
  return `<< /Length ${Buffer.byteLength(value, "utf8")} >>\nstream\n${value}\nendstream`;
}

function scaleFontMetric(value: number, unitsPerEm: number) {
  return Math.round((value / unitsPerEm) * 1000);
}

function toFourDigitHex(value: number) {
  return value.toString(16).padStart(4, "0");
}
