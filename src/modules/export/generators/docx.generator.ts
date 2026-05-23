import {
  AlignmentType,
  BorderStyle,
  CheckBox,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  Table,
  TableCell,
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
          ...exportBundle.documents.flatMap((document) => [
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
            ...document.blocks.flatMap((block) => blockToDocx(block))
          ])
        ]
      }
    ]
  });

  return Buffer.from(await Packer.toBuffer(doc));
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
