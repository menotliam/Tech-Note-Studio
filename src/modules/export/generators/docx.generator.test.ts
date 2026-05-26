import { describe, expect, it } from "vitest";
import { generateDocx } from "./docx.generator";
import type { ExportDocument } from "../export.types";

const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64"
);

describe("generateDocx", () => {
  it("embeds PNG image binaries", async () => {
    const docx = await generateDocx({
      title: "Image DOCX",
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

    expect(docx.subarray(0, 2).toString("utf8")).toBe("PK");
    expect(docx.length).toBeGreaterThan(0);
  });

  it("fails when an image asset was not loaded", async () => {
    const document: ExportDocument = {
      title: "Broken image",
      blocks: [{ type: "image", src: "https://example.test/image.png", alt: "Missing image" }]
    };

    await expect(generateDocx(document)).rejects.toThrow("Could not embed image");
  });

  it("fails clearly for WebP images when conversion is unavailable", async () => {
    const document: ExportDocument = {
      title: "WebP image",
      blocks: [
        {
          type: "image",
          src: "https://example.test/image.webp",
          alt: "WebP image",
          asset: {
            data: Buffer.from("RIFF0000WEBP", "utf8"),
            mimeType: "image/webp",
            sizeBytes: 12,
            storageBucket: "note-files",
            storagePath: "user/workspace/note/image.webp",
            originalFilename: "image.webp"
          }
        }
      ]
    };

    await expect(generateDocx(document)).rejects.toThrow("DOCX export requires WebP conversion");
  });
});
