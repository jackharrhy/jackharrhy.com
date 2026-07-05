import { visit } from "unist-util-visit";

/**
 * Rehype plugin for Obsidian-specific HTML transformations
 *
 * Currently handles:
 * - Converting all list items to paragraphs (matching old site behavior)
 * - Wrapping nested content in indentation divs
 *
 * Can be extended for other Obsidian → HTML transformations
 */
export function rehypeObsidian() {
  return (tree) => {
    // Transform: Convert lists to paragraphs
    visit(tree, "element", (node, index, parent) => {
      if (!parent || index === null) return;

      // Find <ul> or <ol> elements that are direct children of block-level
      // containers where Obsidian uses lists as paragraphs (li, div, section, etc.)
      // but NOT inside blockquotes — those are genuine lists and should keep their
      // numbering/bullets.
      if (
        (node.tagName === "ul" || node.tagName === "ol") &&
        parent.tagName !== "blockquote"
      ) {
        const replacements = [];

        // Process each <li> in the list
        for (const li of node.children) {
          if (li.type !== "element" || li.tagName !== "li") {
            continue;
          }

          // Skip empty list items (no children or only whitespace)
          if (li.children.length === 0) {
            continue;
          }

          const hasContent = li.children.some((child) => {
            if (child.type === "text") {
              return child.value.trim().length > 0;
            }
            if (child.type === "element" || child.type === "raw") {
              return true; // Elements and raw HTML count as content
            }
            return false;
          });

          if (!hasContent) {
            continue;
          }

          // Strategy: Merge ALL content into a single paragraph, handling:
          // - <p> tags (extract their children)
          // - Inline elements (<a>, <em>, etc.) - keep as-is
          // - Nested lists (<ul>, <ol>) - wrap in div and add separately
          // - Text nodes - keep as-is

          let mergedContent = [];

          for (const child of li.children) {
            if (
              child.type === "element" &&
              (child.tagName === "ul" || child.tagName === "ol")
            ) {
              // Nested list - handle separately
              // Flush any accumulated content first
              if (mergedContent.length > 0) {
                replacements.push({
                  type: "element",
                  tagName: "p",
                  properties: {},
                  children: mergedContent,
                });
                mergedContent = [];
              }

              // Add nested list wrapped in div
              replacements.push({
                type: "element",
                tagName: "div",
                properties: { className: ["ml-8", "mb-8"] },
                children: [child],
              });
            } else if (
              child.type === "raw" ||
              (child.type === "element" &&
                ["video", "audio", "div", "iframe", "figure"].includes(
                  child.tagName,
                ))
            ) {
              // Block-level content (video, audio, iframe embeds) — can't go inside <p>
              // Flush any accumulated inline content first
              if (mergedContent.length > 0) {
                replacements.push({
                  type: "element",
                  tagName: "p",
                  properties: {},
                  children: mergedContent,
                });
                mergedContent = [];
              }

              // Emit the block-level node directly
              replacements.push(child);
            } else if (child.type === "element" && child.tagName === "p") {
              // Paragraph - extract its children and merge into our content
              mergedContent.push(...child.children);
            } else {
              // Inline element or text - add directly
              mergedContent.push(child);
            }
          }

          // Flush any remaining content (skip if only whitespace)
          if (mergedContent.length > 0) {
            // Check if content is only whitespace
            const hasNonWhitespace = mergedContent.some((child) => {
              if (child.type === "text") {
                return child.value.trim().length > 0;
              }
              return true; // Non-text nodes are considered content
            });

            if (hasNonWhitespace) {
              replacements.push({
                type: "element",
                tagName: "p",
                properties: {},
                children: mergedContent,
              });
            }
          }
        }

        // Replace the list with the extracted content
        parent.children.splice(index, 1, ...replacements);
        return index;
      }
    });
  };
}
