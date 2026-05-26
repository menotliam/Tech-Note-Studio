import { describe, expect, it } from "vitest";
import { generatePdf } from "./pdf.generator";
import type { ExportDocument } from "../export.types";

const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64"
);

describe("generatePdf", () => {
  it("embeds image binaries", async () => {
    const pdf = await generatePdf({
      title: "Image PDF",
      blocks: [
        {
          type: "image",
          src: "https://example.test/image.png",
          alt: "Tiny image",
          caption: "Tiny image caption",
          asset: {
            data: onePixelPng,
            mimeType: "image/png",
            sizeBytes: onePixelPng.length,
            storageBucket: "note-files",
            storagePath: "user/workspace/note/image.png",
            originalFilename: "image.png"
          }
        }
      ]
    });

    const pdfText = pdf.toString("latin1");
    expect(pdfText).toContain("/Subtype /Image");
    expect(pdfText).toContain("/XObject");
    expect(pdfText).not.toContain("[Image:");
  });

  it("fails when an image asset was not loaded", async () => {
    const document: ExportDocument = {
      title: "Broken image",
      blocks: [{ type: "image", src: "https://example.test/image.png", alt: "Missing image" }]
    };

    await expect(generatePdf(document)).rejects.toThrow("Could not embed image");
  });
});
