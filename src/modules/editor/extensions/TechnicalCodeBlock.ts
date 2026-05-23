import CodeBlock from "@tiptap/extension-code-block";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { TechnicalCodeBlockView } from "../components/TechnicalCodeBlockView";

export const TechnicalCodeBlock = CodeBlock.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      language: {
        default: "plaintext",
        parseHTML: (element) => element.getAttribute("data-language") ?? "plaintext",
        renderHTML: (attributes) => ({
          "data-language": attributes.language
        })
      },
      detectedType: {
        default: "plain_text",
        parseHTML: (element) => element.getAttribute("data-detected-type") ?? "plain_text",
        renderHTML: (attributes) => ({
          "data-detected-type": attributes.detectedType
        })
      },
      showLineNumbers: {
        default: true,
        parseHTML: (element) => element.getAttribute("data-line-numbers") !== "false",
        renderHTML: (attributes) => ({
          "data-line-numbers": String(attributes.showLineNumbers)
        })
      },
      wordWrap: {
        default: false,
        parseHTML: (element) => element.getAttribute("data-word-wrap") === "true",
        renderHTML: (attributes) => ({
          "data-word-wrap": String(attributes.wordWrap)
        })
      },
      source: {
        default: "manual",
        parseHTML: (element) => element.getAttribute("data-source") ?? "manual",
        renderHTML: (attributes) => ({
          "data-source": attributes.source
        })
      },
      confidence: {
        default: 1,
        parseHTML: (element) => Number(element.getAttribute("data-confidence") ?? "1"),
        renderHTML: (attributes) => ({
          "data-confidence": String(attributes.confidence)
        })
      }
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(TechnicalCodeBlockView);
  }
});
