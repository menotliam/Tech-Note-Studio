import {
  AlignmentType,
  BorderStyle,
  CheckBox,
  Document,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableOfContents,
  TableRow,
  TextRun,
  WidthType
} from "docx";
import type { ExportBlock, ExportBundle, ExportDocument } from "../export.types";

const bodySpacing = {
  before: 80,
  after: 160
};
const maxDocxImageWidth = 624;
const docxPixelsToTwips = 15;
const hiddenBorder = { style: BorderStyle.NIL, size: 0, color: "FFFFFF" };

export async function generateDocx(exportDocument: ExportDocument): Promise<Buffer> {
  return generateDocxBundle({ title: exportDocument.title, documents: [exportDocument] });
}

export async function generateDocxBundle(exportBundle: ExportBundle): Promise<Buffer> {
  const hasMultipleDocuments = exportBundle.documents.length > 1;
  const doc = new Document({
    numbering: {
      config: [
        {
          reference: "ordered-list",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: 360, hanging: 260 }
                }
              }
            }
          ]
        }
      ]
    },
    sections: [
      {
        children: [
          ...(hasMultipleDocuments
            ? []
            : [
                new Paragraph({
                  heading: HeadingLevel.TITLE,
                  spacing: { after: 240 },
                  children: [new TextRun(exportBundle.title)]
                })
              ]),
          ...(hasMultipleDocuments
            ? [
                new TableOfContents("Table of contents", {
                  hyperlink: true,
                  headingStyleRange: "1-3"
                })
              ]
            : []),
          ...exportBundle.documents.flatMap((document) => documentToDocxBlocks(document, hasMultipleDocuments))
        ]
      }
    ]
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

function documentToDocxBlocks(document: ExportDocument, hasMultipleDocuments: boolean) {
  return [
    ...(hasMultipleDocuments
      ? [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            pageBreakBefore: true,
            spacing: { before: 120, after: 180 },
            children: [new TextRun(document.title)]
          })
        ]
      : []),
    ...document.blocks.flatMap((block) => {
      try {
        return blockToDocx(block);
      } catch (error) {
        if (block.type === "image") {
          const reason = error instanceof Error ? ` ${error.message}` : "";
          throw new Error(`Could not embed image in "${document.title}".${reason}`, { cause: error });
        }

        throw error;
      }
    })
  ];
}

function blockToDocx(block: ExportBlock): Array<Paragraph | Table> {
  switch (block.type) {
    case "heading":
      return [
        new Paragraph({
          heading:
            block.level === 1
              ? HeadingLevel.HEADING_1
              : block.level === 2
                ? HeadingLevel.HEADING_2
                : HeadingLevel.HEADING_3,
          spacing: { before: 160, after: 100 },
          children: [new TextRun(block.text)]
        })
      ];
    case "paragraph":
      return [new Paragraph({ children: [new TextRun(block.text)], spacing: bodySpacing })];
    case "quote":
      return [
        new Paragraph({
          children: [new TextRun({ text: block.text, italics: true })],
          indent: { left: 360 },
          spacing: bodySpacing
        })
      ];
    case "divider":
      return [
        new Paragraph({
          border: {
            bottom: {
              color: "D1D5DB",
              space: 1,
              style: BorderStyle.SINGLE,
              size: 6
            }
          },
          spacing: bodySpacing
        })
      ];
    case "list":
      return block.items.map(
        (item, index) =>
          block.ordered
            ? new Paragraph({
                children: [new TextRun(item)],
                numbering: { reference: "ordered-list", level: 0 },
                spacing: index === block.items.length - 1 ? bodySpacing : { after: 60 }
              })
            : new Paragraph({
                children: [new TextRun(item)],
                bullet: { level: 0 },
                spacing: index === block.items.length - 1 ? bodySpacing : { after: 60 }
              })
      );
    case "checklist":
      return block.items.map(
        (item) =>
          new Paragraph({
            children: [
              new CheckBox({
                checked: item.checked
              }),
              new TextRun(` ${item.text}`)
            ],
            spacing: bodySpacing
          })
      );
    case "code":
      return [
        new Paragraph({
          children: [new TextRun({ text: block.language.toUpperCase(), bold: true, size: 16 })],
          spacing: { before: 120, after: 60 }
        }),
        new Paragraph({
          children: codeToTextRuns(block.code),
          spacing: bodySpacing
        })
      ];
    case "image":
      return imageToDocx(block);
    case "table":
      return [
        renderTable(block.rows),
        new Paragraph({
          children: [new TextRun("")],
          spacing: { after: 160 }
        })
      ];
  }
}

function imageToDocx(block: Extract<ExportBlock, { type: "image" }>): Array<Paragraph | Table> {
  if (!block.asset) {
    throw new Error("Image asset was not loaded.");
  }

  const image = normalizeDocxImage(block.asset.data, block.asset.mimeType);
  const requestedWidth = typeof block.width === "number" ? block.width : image.width;
  const displayWidth = Math.min(Math.max(requestedWidth, 1), image.width, maxDocxImageWidth);
  const displayHeight = Math.max(1, Math.round((displayWidth / image.width) * image.height));
  const caption = block.caption?.trim();
  const cellChildren = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: caption ? 60 : 0 },
      children: [
        new ImageRun({
          data: image.data,
          type: image.type,
          transformation: {
            width: Math.round(displayWidth),
            height: displayHeight
          },
          altText: {
            title: block.alt || block.asset.originalFilename || "Image",
            description: block.caption || block.alt || "Exported note image",
            name: block.asset.originalFilename || "image"
          }
        })
      ]
    }),
    ...(caption
      ? [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 0 },
            children: [new TextRun({ text: caption, italics: true, size: 18 })]
          })
        ]
      : [])
  ];

  return [
    new Table({
      alignment: getDocxImageAlignment(block.alignment),
      layout: TableLayoutType.FIXED,
      width: {
        size: Math.round(displayWidth * docxPixelsToTwips),
        type: WidthType.DXA
      },
      borders: {
        top: hiddenBorder,
        bottom: hiddenBorder,
        left: hiddenBorder,
        right: hiddenBorder,
        insideHorizontal: hiddenBorder,
        insideVertical: hiddenBorder
      },
      margins: {
        marginUnitType: WidthType.DXA,
        top: 0,
        bottom: 0,
        left: 0,
        right: 0
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: {
                size: Math.round(displayWidth * docxPixelsToTwips),
                type: WidthType.DXA
              },
              margins: {
                marginUnitType: WidthType.DXA,
                top: 0,
                bottom: 0,
                left: 0,
                right: 0
              },
              borders: {
                top: hiddenBorder,
                bottom: hiddenBorder,
                left: hiddenBorder,
                right: hiddenBorder
              },
              children: cellChildren
            })
          ]
        })
      ]
    }),
    new Paragraph({
      children: [new TextRun("")],
      spacing: { after: 160 }
    })
  ];
}

function getDocxImageAlignment(alignment: Extract<ExportBlock, { type: "image" }>["alignment"]) {
  if (alignment === "left") {
    return AlignmentType.LEFT;
  }

  if (alignment === "right") {
    return AlignmentType.RIGHT;
  }

  return AlignmentType.CENTER;
}

function normalizeDocxImage(data: Buffer, mimeType: string) {
  if (mimeType === "image/png") {
    return {
      type: "png" as const,
      data,
      ...readPngDimensions(data)
    };
  }

  if (mimeType === "image/jpeg") {
    return {
      type: "jpg" as const,
      data,
      ...readJpegDimensions(data)
    };
  }

  if (mimeType === "image/webp") {
    throw new Error("DOCX export requires WebP conversion before embedding.");
  }

  throw new Error("Unsupported DOCX image type.");
}

function readPngDimensions(data: Buffer) {
  if (!data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    throw new Error("Invalid PNG image.");
  }

  return {
    width: data.readUInt32BE(16),
    height: data.readUInt32BE(20)
  };
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

function codeToTextRuns(code: string) {
  return code.split(/\r?\n/).map((line, index) => {
    const options = {
      text: line || " ",
      font: "Consolas",
      size: 18
    };

    return new TextRun(index === 0 ? options : { ...options, break: 1 });
  });
}

function renderTable(rows: string[][]) {
  return new Table({
    width: {
      size: 100,
      type: WidthType.PERCENTAGE
    },
    rows: rows.map(
      (row) =>
        new TableRow({
          children: row.map(
            (cell) =>
              new TableCell({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.LEFT,
                    children: [new TextRun(cell)]
                  })
                ]
              })
          )
        })
    )
  });
}
