import { existsSync, readFileSync } from "node:fs";
import { deflateSync, inflateSync } from "node:zlib";
import type { ExportBlock, ExportBundle, ExportDocument, ExportTextContent, ExportTextRun } from "../export.types";

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

type PdfImageResource = {
  name: string;
  width: number;
  height: number;
  storagePath: string;
  createObjects: (objectIds: { softMaskObjectId?: number }) => string[];
  softMask: boolean;
};

type ParsedPdfImage = {
  width: number;
  height: number;
  colorSpace: "/DeviceRGB" | "/DeviceGray";
  bitsPerComponent: 8;
  filter: "/DCTDecode" | "/FlateDecode";
  data: Buffer;
  softMask?: {
    data: Buffer;
    colorSpace: "/DeviceGray";
    bitsPerComponent: 8;
    filter: "/FlateDecode";
  };
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

    document.blocks.forEach((block) => {
      try {
        renderBlock(writer, block);
      } catch (error) {
        if (block.type === "image") {
          throw new Error(`Could not embed image in "${document.title}".`, { cause: error });
        }

        throw error;
      }
    });
  });

  return writer.toBuffer();
}

function renderBlock(writer: PdfWriter, block: ExportBlock) {
  switch (block.type) {
    case "heading":
      writer.richText(block, {
        font: "F2",
        size: block.level === 1 ? 20 : block.level === 2 ? 16 : 13,
        alignment: block.alignment,
        gapBefore: 8,
        gapAfter: 8
      });
      break;
    case "paragraph":
      writer.richText(block, { font: "F1", size: 11, alignment: block.alignment, gapAfter: 10 });
      break;
    case "quote":
      writer.richText(block, { font: "F3", size: 11, alignment: block.alignment, indent: 18, gapAfter: 10 });
      break;
    case "divider":
      writer.divider();
      break;
    case "list":
      block.items.forEach((item, index) => {
        const marker = (item.ordered ?? block.ordered) ? (item.marker ?? `${index + 1}.`) : pdfBullet;
        writer.listItem(item, marker, {
          font: "F1",
          size: 11,
          alignment: item.alignment,
          depth: item.depth ?? 0,
          gapAfter: 3
        });
      });
      writer.gap(8);
      break;
    case "checklist":
      block.items.forEach((item) => {
        writer.richText(prefixTextContent(item, `${item.checked ? pdfCheckedBox : pdfUncheckedBox} `), {
          font: "F1",
          size: 11,
          alignment: item.alignment,
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
    case "image":
      writer.image(block);
      break;
    case "table":
      writer.table(
        block.rows.map((row) => row.map((cell) => cell.text)),
        { font: "F1", size: 9, gapAfter: 12 }
      );
      break;
  }
}

function prefixTextContent(content: ExportTextContent, prefix: string): ExportTextContent {
  const runs = content.runs?.length ? content.runs : [{ text: content.text }];

  return {
    ...content,
    text: `${prefix}${content.text}`,
    runs: [{ text: prefix }, ...runs]
  };
}

class PdfWriter {
  private pages: PdfPage[] = [];
  private currentPage: PdfPage;
  private usedCharacterCodes = new Set<number>();
  private imageResources: PdfImageResource[] = [];
  private imageResourceByStoragePath = new Map<string, PdfImageResource>();
  private y = page.height - page.margin;

  constructor() {
    this.currentPage = this.addPage();
  }

  text(
    value: string,
    options: {
      font: FontName;
      size: number;
      alignment?: ExportTextContent["alignment"];
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
      const textWidth = estimateTextWidth(line || " ", options.size);
      const x = this.getTextX(textWidth, options.indent ?? 0, options.alignment);
      this.trackCharacters(line || " ");
      this.currentPage.commands.push(
        `BT /${options.font} ${options.size} Tf ${x} ${this.y} Td ${toPdfHexString(line || " ")} Tj ET`
      );
      if (options.linkDestination) {
        this.currentPage.links.push({
          rect: [
            x,
            this.y - 2,
            x + textWidth,
            this.y + options.size + 2
          ],
          destination: options.linkDestination
        });
      }
      this.y -= options.size + 5;
    });

    this.gap(options.gapAfter ?? 0);
  }

  richText(
    content: ExportTextContent,
    options: {
      font: FontName;
      size: number;
      alignment?: ExportTextContent["alignment"];
      indent?: number;
      gapBefore?: number;
      gapAfter?: number;
    }
  ) {
    const runs = content.runs?.length ? content.runs : [{ text: content.text }];
    const lines = wrapRichText(runs, this.maxCharsPerLine(options.size, options.indent ?? 0));

    this.gap(options.gapBefore ?? 0);

    lines.forEach((lineRuns) => {
      const lineText = lineRuns.map((run) => run.text).join("") || " ";
      const lineWidth = estimateTextWidth(lineText, options.size);
      let x = this.getTextX(lineWidth, options.indent ?? 0, options.alignment);

      this.ensureSpace(options.size + 5);
      this.trackCharacters(lineText);

      lineRuns.forEach((run) => {
        const text = run.text || " ";
        const font = run.code ? "F4" : run.bold ? "F2" : run.italic ? "F3" : options.font;
        this.currentPage.commands.push(
          `BT /${font} ${options.size} Tf ${formatPdfNumber(x)} ${this.y} Td ${toPdfHexString(text)} Tj ET`
        );

        if (run.bold) {
          this.currentPage.commands.push(
            `BT /${font} ${options.size} Tf ${formatPdfNumber(x + 0.25)} ${this.y} Td ${toPdfHexString(text)} Tj ET`
          );
        }

        x += estimateTextWidth(text, options.size);
      });

      this.y -= options.size + 5;
    });

    this.gap(options.gapAfter ?? 0);
  }

  listItem(
    content: ExportTextContent,
    marker: string,
    options: {
      font: FontName;
      size: number;
      alignment?: ExportTextContent["alignment"];
      depth: number;
      gapAfter?: number;
    }
  ) {
    const markerIndent = Math.max(0, options.depth) * 18;
    const markerWidth = 22 + Math.max(0, options.depth) * 4;
    const textIndent = markerIndent + markerWidth;
    const runs = content.runs?.length ? content.runs : [{ text: content.text }];
    const lines = wrapRichText(runs, this.maxCharsPerLine(options.size, textIndent));

    lines.forEach((lineRuns, lineIndex) => {
      const lineText = lineRuns.map((run) => run.text).join("") || " ";
      const lineWidth = estimateTextWidth(lineText, options.size);
      const textX = this.getTextX(lineWidth, textIndent, options.alignment);

      this.ensureSpace(options.size + 5);

      if (lineIndex === 0) {
        const markerText = marker || pdfBullet;
        const markerX = page.margin + markerIndent;
        this.trackCharacters(markerText);
        this.currentPage.commands.push(
          `BT /${options.font} ${options.size} Tf ${formatPdfNumber(markerX)} ${this.y} Td ${toPdfHexString(markerText)} Tj ET`
        );
      }

      this.trackCharacters(lineText);
      let x = textX;

      lineRuns.forEach((run) => {
        const text = run.text || " ";
        const font = run.code ? "F4" : run.bold ? "F2" : run.italic ? "F3" : options.font;
        this.currentPage.commands.push(
          `BT /${font} ${options.size} Tf ${formatPdfNumber(x)} ${this.y} Td ${toPdfHexString(text)} Tj ET`
        );

        if (run.bold) {
          this.currentPage.commands.push(
            `BT /${font} ${options.size} Tf ${formatPdfNumber(x + 0.25)} ${this.y} Td ${toPdfHexString(text)} Tj ET`
          );
        }

        x += estimateTextWidth(text, options.size);
      });

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

  image(block: Extract<ExportBlock, { type: "image" }>) {
    if (!block.asset) {
      throw new Error("Image asset was not loaded.");
    }

    const image = this.getImageResource(block);
    const maxWidth = page.width - page.margin * 2;
    const maxHeight = page.height - page.margin * 2 - 24;
    const requestedWidth = typeof block.width === "number" ? block.width : image.width;
    const drawWidth = Math.min(Math.max(requestedWidth, 1), image.width, maxWidth);
    let drawHeight = (drawWidth / image.width) * image.height;
    let finalWidth = drawWidth;

    if (drawHeight > maxHeight) {
      const scale = maxHeight / drawHeight;
      finalWidth *= scale;
      drawHeight = maxHeight;
    }

    const caption = block.caption?.trim();
    const captionFontSize = 9;
    const captionLineHeight = captionFontSize + 4;
    const captionGapBefore = 8;
    const captionGapAfter = 10;
    const captionLines = caption
      ? wrapText(caption, Math.max(12, Math.floor(finalWidth / (captionFontSize * 0.55))))
      : [];
    const captionHeight = captionLines.length > 0 ? captionGapBefore + captionLines.length * captionLineHeight + captionGapAfter : 0;
    this.gap(6);
    this.ensureSpace(drawHeight + captionHeight + 12);

    const x = page.margin;
    const y = this.y - drawHeight;
    this.currentPage.commands.push(
      `q ${formatPdfNumber(finalWidth)} 0 0 ${formatPdfNumber(drawHeight)} ${formatPdfNumber(x)} ${formatPdfNumber(y)} cm /${image.name} Do Q`
    );
    this.y = y;

    if (captionLines.length > 0) {
      this.imageCaption(captionLines, {
        font: "F3",
        size: captionFontSize,
        lineHeight: captionLineHeight,
        imageX: x,
        imageWidth: finalWidth,
        gapBefore: captionGapBefore,
        gapAfter: captionGapAfter
      });
    } else {
      this.gap(10);
    }
  }

  private imageCaption(
    lines: string[],
    options: {
      font: FontName;
      size: number;
      lineHeight: number;
      imageX: number;
      imageWidth: number;
      gapBefore: number;
      gapAfter: number;
    }
  ) {
    this.gap(options.gapBefore);

    lines.forEach((line) => {
      this.ensureSpace(options.lineHeight);
      const text = line || " ";
      const textWidth = estimateTextWidth(text, options.size);
      const centeredX = options.imageX + (options.imageWidth - textWidth) / 2;
      const x = Math.max(page.margin, Math.min(centeredX, page.width - page.margin - textWidth));

      this.trackCharacters(text);
      this.currentPage.commands.push(
        `BT /${options.font} ${options.size} Tf ${formatPdfNumber(x)} ${formatPdfNumber(this.y - options.size)} Td ${toPdfHexString(text)} Tj ET`
      );
      this.y -= options.lineHeight;
    });

    this.gap(options.gapAfter);
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
    const imageObjectRecords = this.imageResources.map((imageResource) => {
      const imageObjectId = nextObjectId;
      nextObjectId += 1;
      const softMaskObjectId = imageResource.softMask ? nextObjectId : undefined;

      if (imageResource.softMask) {
        nextObjectId += 1;
      }

      return {
        imageResource,
        imageObjectId,
        softMaskObjectId
      };
    });

    imageObjectRecords.forEach(({ imageResource, imageObjectId, softMaskObjectId }) => {
      objects.push(...imageResource.createObjects({ softMaskObjectId }));
    });

    const xObjectResources =
      imageObjectRecords.length > 0
        ? `/XObject << ${imageObjectRecords
            .map(({ imageResource, imageObjectId }) => `/${imageResource.name} ${imageObjectId} 0 R`)
            .join(" ")} >>`
        : "";
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
          xObjectResources,
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

  private getImageResource(block: Extract<ExportBlock, { type: "image" }>) {
    const asset = block.asset!;
    const cached = this.imageResourceByStoragePath.get(asset.storagePath);

    if (cached) {
      return cached;
    }

    const parsedImage = parsePdfImage(asset.data, asset.mimeType);
    const name = `Im${this.imageResources.length + 1}`;
    const imageResource: PdfImageResource = {
      name,
      width: parsedImage.width,
      height: parsedImage.height,
      storagePath: asset.storagePath,
      softMask: Boolean(parsedImage.softMask),
      createObjects: ({ softMaskObjectId }) => createPdfImageObjects(parsedImage, softMaskObjectId)
    };

    this.imageResources.push(imageResource);
    this.imageResourceByStoragePath.set(asset.storagePath, imageResource);
    return imageResource;
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

  private getTextX(textWidth: number, indent: number, alignment: ExportTextContent["alignment"]) {
    const left = page.margin + indent;
    const usableWidth = page.width - page.margin * 2 - indent;

    if (alignment === "center") {
      return left + Math.max(0, (usableWidth - textWidth) / 2);
    }

    if (alignment === "right") {
      return left + Math.max(0, usableWidth - textWidth);
    }

    return left;
  }

  private trackCharacters(value: string) {
    for (let index = 0; index < value.length; index += 1) {
      this.usedCharacterCodes.add(value.charCodeAt(index));
    }
  }

  private destinations = new Map<string, PdfDestination>();
}

function parsePdfImage(data: Buffer, mimeType: string): ParsedPdfImage {
  if (mimeType === "image/jpeg") {
    const dimensions = readJpegDimensions(data);

    return {
      width: dimensions.width,
      height: dimensions.height,
      colorSpace: "/DeviceRGB",
      bitsPerComponent: 8,
      filter: "/DCTDecode",
      data
    };
  }

  if (mimeType === "image/png") {
    return parsePngForPdf(data);
  }

  throw new Error("PDF export supports PNG and JPEG images.");
}

function createPdfImageObjects(image: ParsedPdfImage, softMaskObjectId?: number) {
  const softMaskReference = image.softMask && softMaskObjectId ? `/SMask ${softMaskObjectId} 0 R` : "";
  const imageObject = createHexStream(image.data, {
    filter: image.filter,
    dictionaryEntries: [
      "/Type /XObject",
      "/Subtype /Image",
      `/Width ${image.width}`,
      `/Height ${image.height}`,
      `/ColorSpace ${image.colorSpace}`,
      `/BitsPerComponent ${image.bitsPerComponent}`,
      softMaskReference
    ].filter(Boolean)
  });

  if (!image.softMask || !softMaskObjectId) {
    return [imageObject];
  }

  return [
    imageObject,
    createHexStream(image.softMask.data, {
      filter: image.softMask.filter,
      dictionaryEntries: [
        "/Type /XObject",
        "/Subtype /Image",
        `/Width ${image.width}`,
        `/Height ${image.height}`,
        `/ColorSpace ${image.softMask.colorSpace}`,
        `/BitsPerComponent ${image.softMask.bitsPerComponent}`
      ]
    })
  ];
}

function readJpegDimensions(data: Buffer) {
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) {
    throw new Error("Invalid JPEG image.");
  }

  let offset = 2;

  while (offset < data.length) {
    while (data[offset] === 0xff) {
      offset += 1;
    }

    const marker = data[offset];
    offset += 1;

    if (marker === 0xd9 || marker === 0xda) {
      break;
    }

    const segmentLength = data.readUInt16BE(offset);

    if (isJpegStartOfFrameMarker(marker)) {
      return {
        height: data.readUInt16BE(offset + 3),
        width: data.readUInt16BE(offset + 5)
      };
    }

    offset += segmentLength;
  }

  throw new Error("Could not read JPEG dimensions.");
}

function isJpegStartOfFrameMarker(marker: number | undefined) {
  return marker !== undefined && marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
}

function parsePngForPdf(data: Buffer): ParsedPdfImage {
  if (!data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    throw new Error("Invalid PNG image.");
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks: Buffer[] = [];

  while (offset < data.length) {
    const length = data.readUInt32BE(offset);
    const type = data.toString("ascii", offset + 4, offset + 8);
    const chunk = data.subarray(offset + 8, offset + 8 + length);

    if (type === "IHDR") {
      width = chunk.readUInt32BE(0);
      height = chunk.readUInt32BE(4);
      bitDepth = chunk[8];
      colorType = chunk[9];
    } else if (type === "IDAT") {
      idatChunks.push(chunk);
    } else if (type === "IEND") {
      break;
    }

    offset += length + 12;
  }

  if (!width || !height || bitDepth !== 8) {
    throw new Error("Unsupported PNG image.");
  }

  const decodedRows = unfilterPngScanlines({
    data: inflateSync(Buffer.concat(idatChunks)),
    width,
    height,
    bytesPerPixel: getPngBytesPerPixel(colorType)
  });
  const normalized = normalizePngRowsForPdf(decodedRows, width, height, colorType);

  return {
    width,
    height,
    colorSpace: normalized.colorSpace,
    bitsPerComponent: 8,
    filter: "/FlateDecode",
    data: deflateSync(normalized.colorData),
    softMask: normalized.alphaData
      ? {
          data: deflateSync(normalized.alphaData),
          colorSpace: "/DeviceGray",
          bitsPerComponent: 8,
          filter: "/FlateDecode"
        }
      : undefined
  };
}

function getPngBytesPerPixel(colorType: number) {
  switch (colorType) {
    case 0:
      return 1;
    case 2:
      return 3;
    case 4:
      return 2;
    case 6:
      return 4;
    default:
      throw new Error("Unsupported PNG color type.");
  }
}

function unfilterPngScanlines({
  data,
  width,
  height,
  bytesPerPixel
}: {
  data: Buffer;
  width: number;
  height: number;
  bytesPerPixel: number;
}) {
  const rowLength = width * bytesPerPixel;
  const rows: Buffer[] = [];
  let offset = 0;

  for (let rowIndex = 0; rowIndex < height; rowIndex += 1) {
    const filterType = data[offset];
    const row = Buffer.from(data.subarray(offset + 1, offset + 1 + rowLength));
    const previousRow = rows[rowIndex - 1];

    for (let index = 0; index < row.length; index += 1) {
      const left = index >= bytesPerPixel ? row[index - bytesPerPixel] : 0;
      const up = previousRow?.[index] ?? 0;
      const upLeft = index >= bytesPerPixel ? previousRow?.[index - bytesPerPixel] ?? 0 : 0;

      if (filterType === 1) {
        row[index] = (row[index] + left) & 0xff;
      } else if (filterType === 2) {
        row[index] = (row[index] + up) & 0xff;
      } else if (filterType === 3) {
        row[index] = (row[index] + Math.floor((left + up) / 2)) & 0xff;
      } else if (filterType === 4) {
        row[index] = (row[index] + paethPredictor(left, up, upLeft)) & 0xff;
      } else if (filterType !== 0) {
        throw new Error("Unsupported PNG filter.");
      }
    }

    rows.push(row);
    offset += rowLength + 1;
  }

  return rows;
}

function normalizePngRowsForPdf(rows: Buffer[], width: number, height: number, colorType: number) {
  if (colorType === 0) {
    return {
      colorSpace: "/DeviceGray" as const,
      colorData: Buffer.concat(rows)
    };
  }

  const hasAlpha = colorType === 4 || colorType === 6;
  const colorChannels = colorType === 2 || colorType === 6 ? 3 : 1;
  const sourceChannels = getPngBytesPerPixel(colorType);
  const colorData = Buffer.alloc(width * height * colorChannels);
  const alphaData = hasAlpha ? Buffer.alloc(width * height) : undefined;
  let colorOffset = 0;
  let alphaOffset = 0;

  rows.forEach((row) => {
    for (let sourceOffset = 0; sourceOffset < row.length; sourceOffset += sourceChannels) {
      for (let channel = 0; channel < colorChannels; channel += 1) {
        colorData[colorOffset] = row[sourceOffset + channel];
        colorOffset += 1;
      }

      if (alphaData) {
        alphaData[alphaOffset] = row[sourceOffset + sourceChannels - 1];
        alphaOffset += 1;
      }
    }
  });

  return {
    colorSpace: colorChannels === 3 ? "/DeviceRGB" as const : "/DeviceGray" as const,
    colorData,
    alphaData
  };
}

function paethPredictor(left: number, up: number, upLeft: number) {
  const estimate = left + up - upLeft;
  const distanceLeft = Math.abs(estimate - left);
  const distanceUp = Math.abs(estimate - up);
  const distanceUpLeft = Math.abs(estimate - upLeft);

  if (distanceLeft <= distanceUp && distanceLeft <= distanceUpLeft) {
    return left;
  }

  return distanceUp <= distanceUpLeft ? up : upLeft;
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

function wrapRichText(runs: ExportTextRun[], maxChars: number) {
  const tokens = runs.flatMap((run) => splitRichTextRun(run));
  const lines: ExportTextRun[][] = [];
  let currentLine: ExportTextRun[] = [];
  let currentLength = 0;

  tokens.forEach((token) => {
    const tokenLength = token.text.length;
    const shouldWrap = currentLength > 0 && currentLength + tokenLength > maxChars && token.text.trim();

    if (shouldWrap) {
      lines.push(trimRichTextLine(currentLine));
      currentLine = [];
      currentLength = 0;
    }

    currentLine.push(token);
    currentLength += tokenLength;
  });

  if (currentLine.length > 0) {
    lines.push(trimRichTextLine(currentLine));
  }

  return lines.length > 0 ? lines : [[{ text: " " }]];
}

function splitRichTextRun(run: ExportTextRun) {
  return run.text
    .split(/(\s+)/)
    .filter(Boolean)
    .map((text) => ({ ...run, text }));
}

function trimRichTextLine(runs: ExportTextRun[]) {
  const nextRuns = runs.map((run) => ({ ...run }));

  while (nextRuns.length > 0 && !nextRuns[0]!.text.trim()) {
    nextRuns.shift();
  }

  while (nextRuns.length > 0 && !nextRuns[nextRuns.length - 1]!.text.trim()) {
    nextRuns.pop();
  }

  if (nextRuns.length === 0) {
    return [{ text: " " }];
  }

  nextRuns[0]!.text = nextRuns[0]!.text.trimStart();
  nextRuns[nextRuns.length - 1]!.text = nextRuns[nextRuns.length - 1]!.text.trimEnd();

  return nextRuns.filter((run) => run.text);
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

function createHexStream(
  buffer: Buffer,
  options?: {
    length1?: number;
    filter?: "/DCTDecode" | "/FlateDecode";
    dictionaryEntries?: string[];
  }
) {
  const hex = buffer.toString("hex");
  const length1 = options?.length1 ? ` /Length1 ${options.length1}` : "";
  const filters = options?.filter ? `[/ASCIIHexDecode ${options.filter}]` : "/ASCIIHexDecode";
  const dictionaryEntries = options?.dictionaryEntries?.length ? ` ${options.dictionaryEntries.join(" ")}` : "";

  return `<< /Length ${hex.length + 1} /Filter ${filters}${length1}${dictionaryEntries} >>\nstream\n${hex}>\nendstream`;
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
