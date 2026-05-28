import { describe, expect, it } from "vitest";
import { notificationCopy } from "./notification-copy";

describe("notification copy", () => {
  it("keeps upload errors safe and user-facing", () => {
    const intent = notificationCopy.imageUploadFinished(0, 1);

    expect(intent.title).toBe("Image upload failed");
    expect(intent.description).not.toMatch(/storage|service role|path|stack/i);
  });

  it("identifies export starts without exposing internals", () => {
    expect(notificationCopy.exportStarted("pdf")).toMatchObject({
      variant: "export",
      title: "Preparing PDF export"
    });
  });
});

