import { describe, expect, it } from "vitest";
import { getPasteDetectionAction } from "./editor-paste-detection";

describe("getPasteDetectionAction", () => {
  it("auto-formats high-confidence JSON when enabled", () => {
    const action = getPasteDetectionAction('{"ok":true,"items":[1,2]}', true);

    expect(action.action).toBe("auto_format");
    expect(action.result.language).toBe("json");
  });

  it("ignores technical snippets when auto-detection is disabled", () => {
    const action = getPasteDetectionAction("SELECT * FROM notes WHERE id = 1;", false);

    expect(action.action).toBe("ignore");
  });

  it("ignores normal prose", () => {
    const action = getPasteDetectionAction("This is a normal study reminder.", true);

    expect(action.action).toBe("ignore");
  });
});
