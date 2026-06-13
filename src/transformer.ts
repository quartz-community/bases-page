import type { Root as HTMLRoot, Element, ElementContent } from "hast";
import type { QuartzTransformerPlugin, BuildCtx } from "@quartz-community/types";
import type { FilePath } from "@quartz-community/utils";
import { slugifyFilePath } from "@quartz-community/utils";
import type { VFile } from "vfile";
import { visit } from "unist-util-visit";
import { readFileSync } from "fs";
import { join } from "path";
import { parseBasesData } from "./parser";
import type { BasesData, BasesPageOptions } from "./types";

/**
 * Rehype plugin that finds ` ```base ` codeblocks in the HAST tree and replaces
 * them with placeholder `<div>` elements. The parsed BasesData for each block is
 * stored on `vfile.data.basesBlocks` so it can be resolved at render time by the
 * tree-transform hook (when `allFiles` is available).
 *
 * Markdown parsers convert fenced code blocks to `<pre><code class="language-base">`.
 * Syntax highlighters (e.g. rehype-pretty-code) may transform this further to
 * `<figure><pre><code data-language="base">` with text wrapped in `<span data-line>`.
 * This plugin detects both patterns, extracts the text content, parses it as YAML
 * via `parseBasesData()`, and replaces the top-level node with a placeholder div.
 */
export const BasesTransformer: QuartzTransformerPlugin<Partial<BasesPageOptions>> = (_opts) => {
  return {
    name: "BasesTransformer",
    htmlPlugins(ctx: BuildCtx) {
      const baseFileBySlug = buildBaseFileLookup(ctx);

      return [
        () => {
          return (tree: HTMLRoot, file: VFile) => {
            const embeds: string[] = [];

            visit(tree, "element", (node: Element, index, parent) => {
              if (!parent || index === undefined) return;
              if (node.tagName !== "blockquote") return;
              const classes = (node.properties?.className ?? []) as string[];
              if (!classes.includes("transclude")) return;

              const url = node.properties?.dataUrl as string | undefined;
              if (!url) return;

              const baseFile = baseFileBySlug.get(url);
              if (!baseFile) {
                embeds.push(url);
                return;
              }

              const block = (node.properties?.dataBlock as string) ?? "";
              const viewName = block.startsWith("#") ? block.slice(1) : "";

              const fullPath = join(ctx.argv.directory, baseFile);
              let raw: string;
              try {
                raw = readFileSync(fullPath, "utf-8");
              } catch {
                embeds.push(url);
                return;
              }

              const basesData = parseBasesData(raw);
              if (!basesData) {
                embeds.push(url);
                return;
              }

              if (!file.data.basesBlocks) file.data.basesBlocks = [];
              const blockIndex = file.data.basesBlocks.length;
              file.data.basesBlocks.push(basesData);

              const placeholder: Element = {
                type: "element",
                tagName: "div",
                properties: {
                  dataQzBasesCodeblock: String(blockIndex),
                  ...(viewName ? { dataQzBasesView: viewName } : {}),
                },
                children: [],
              };
              parent.children[index] = placeholder;
            });

            if (embeds.length > 0) {
              file.data.embeds = embeds;
            }
          };
        },
        () => {
          return (tree: HTMLRoot, file: VFile) => {
            // Capture transclusion blocks registered by the earlier transformer pass
            // so inline codeblock indices can continue from where they left off
            const existingBlocks = (file.data.basesBlocks as BasesData[] | undefined) ?? [];
            const basesBlocks: BasesData[] = [];

            visit(tree, "element", (node: Element, index, parent) => {
              if (!parent || index === undefined) return;

              // Detect base codeblocks in two forms:
              // 1. Raw: <pre><code class="language-base">
              // 2. Post-syntax-highlighting: <figure><pre><code data-language="base">
              //    (rehype-pretty-code wraps in <figure> and uses data-language prop)
              const {
                codeElement,
                replaceNode: _replaceNode,
                replaceIndex,
                replaceParent,
              } = findBaseCodeblock(node, index, parent);
              if (!codeElement) return;

              // Extract raw text from the <code> element (handles both plain
              // text nodes and <span data-line> wrappers from syntax highlighters)
              const rawText = extractText(codeElement);
              if (!rawText) return;

              // Parse as YAML — parseBasesData handles both raw YAML and ``` fenced blocks
              const basesData = parseBasesData(rawText);
              if (!basesData) return;

              // Offset by existingBlocks so inline codeblock indices don't collide
              // with transclusion blocks registered by the earlier transformer pass
              const blockIndex = existingBlocks.length + basesBlocks.length;
              basesBlocks.push(basesData);

              // Replace the <pre> node with a placeholder div
              const placeholder: Element = {
                type: "element",
                tagName: "div",
                properties: {
                  dataQzBasesCodeblock: String(blockIndex),
                },
                children: [],
              };

              replaceParent.children[replaceIndex] = placeholder;
            });

            if (basesBlocks.length > 0) {
              // Merge rather than overwrite so transclusion blocks are preserved
              file.data.basesBlocks = [...existingBlocks, ...basesBlocks];
            }
          };
        },
      ];
    },
  };
};

/**
 * Detect whether a HAST node is (or contains) a ```base codeblock.
 * Returns the code element and the node/parent/index to replace.
 *
 * Handles two shapes:
 * - `<pre><code class="language-base">` (standard markdown → HTML)
 * - `<figure data-rehype-pretty-code-figure><pre><code data-language="base">` (after syntax highlighting)
 */
function findBaseCodeblock(
  node: Element,
  index: number | undefined,
  parent: { children: (ElementContent | import("hast").RootContent)[] },
): {
  codeElement: Element | null;
  replaceNode: Element;
  replaceIndex: number;
  replaceParent: { children: (ElementContent | import("hast").RootContent)[] };
} {
  const empty = {
    codeElement: null,
    replaceNode: node,
    replaceIndex: index ?? 0,
    replaceParent: parent,
  };

  // Case 1: node is <pre> directly
  if (node.tagName === "pre") {
    const code = findCodeChild(node);
    if (code && isBaseLanguage(code)) {
      return {
        codeElement: code,
        replaceNode: node,
        replaceIndex: index ?? 0,
        replaceParent: parent,
      };
    }
    return empty;
  }

  // Case 2: node is <figure data-rehype-pretty-code-figure> wrapping <pre><code>
  if (node.tagName === "figure" && node.properties?.dataRehypePrettyCodeFigure !== undefined) {
    const pre = node.children.find(
      (child): child is Element => child.type === "element" && child.tagName === "pre",
    );
    if (pre) {
      const code = findCodeChild(pre);
      if (code && isBaseLanguage(code)) {
        // Replace the <figure>, not just the <pre>
        return {
          codeElement: code,
          replaceNode: node,
          replaceIndex: index ?? 0,
          replaceParent: parent,
        };
      }
    }
    return empty;
  }

  return empty;
}

/** Find the first <code> child element */
function findCodeChild(pre: Element): Element | null {
  return (
    pre.children.find(
      (child): child is Element => child.type === "element" && child.tagName === "code",
    ) ?? null
  );
}

/**
 * Check whether a <code> element represents a `base` language block.
 * Checks both `class="language-base"` (standard) and `data-language="base"` (rehype-pretty-code).
 */
function isBaseLanguage(code: Element): boolean {
  // Standard: class includes "language-base"
  const classNames = (code.properties?.className ?? []) as string[];
  if (classNames.includes("language-base")) return true;

  // rehype-pretty-code: data-language="base"
  if (code.properties?.dataLanguage === "base") return true;

  return false;
}

/**
 * Recursively extract text content from a HAST element.
 * Handles both plain text nodes and <span data-line> wrappers
 * from syntax highlighters. Avoids regex by walking the tree directly.
 */
function extractText(node: Element): string {
  const parts: string[] = [];
  for (const child of node.children) {
    if (child.type === "text") {
      parts.push(child.value);
    } else if (child.type === "element") {
      parts.push(extractText(child));
    }
  }
  return parts.join("");
}

function buildBaseFileLookup(ctx: BuildCtx): Map<string, string> {
  const lookup = new Map<string, string>();
  const baseFiles = ctx.allFiles.filter((fp) => fp.endsWith(".base"));
  for (const fp of baseFiles) {
    const slug = slugifyFilePath(fp as unknown as FilePath);
    lookup.set(slug, fp);

    const fileName = fp.split("/").pop() ?? "";
    const fileNameSlug = slugifyFilePath(fileName as unknown as FilePath);
    if (!lookup.has(fileNameSlug)) {
      lookup.set(fileNameSlug, fp);
    }

    const withoutExt = fp.replace(/\.base$/, "");
    const nameOnly = withoutExt.split("/").pop() ?? "";
    const nameSlug = slugifyFilePath(nameOnly as unknown as FilePath);
    if (!lookup.has(nameSlug)) {
      lookup.set(nameSlug, fp);
    }
  }
  return lookup;
}

declare module "vfile" {
  interface DataMap {
    basesBlocks?: BasesData[];
    embeds?: string[];
  }
}
