import { describe, expect, it } from "vitest";
import { workspacePersonalizationSchema } from "./workspace.schemas";

describe("workspace personalization schema", () => {
  it("accepts valid workspace personalization", () => {
    const result = workspacePersonalizationSchema.safeParse({
      name: "Personal Workspace",
      icon: "terminal",
      accent: "cyan",
      cover: "cyan-purple",
      defaultLayout: "folder"
    });

    expect(result.success).toBe(true);
  });

  it("trims names and rejects empty names", () => {
    expect(workspacePersonalizationSchema.parse({
      name: "  Research  ",
      icon: null,
      accent: null,
      cover: null,
      defaultLayout: "recent"
    }).name).toBe("Research");

    expect(workspacePersonalizationSchema.safeParse({
      name: "  ",
      icon: null,
      accent: null,
      cover: null,
      defaultLayout: "folder"
    }).success).toBe(false);
  });

  it("rejects unknown preset values", () => {
    const result = workspacePersonalizationSchema.safeParse({
      name: "Workspace",
      icon: "javascript:alert(1)",
      accent: "custom-css",
      cover: "url(unsafe)",
      defaultLayout: "everything"
    });

    expect(result.success).toBe(false);
  });
});
