import { describe, it, expect, vi } from "vitest";
import { findEmbeddedView, initialViewIndex } from "../src/views";
import { rawBaseEmbeds } from "../src/transformer";
import type { BasesView, QuartzPluginData } from "../src/types";

vi.mock("../src/components/BasesBody", () => ({ default: () => null }));

// Obsidian 1.15.0 (obsidian-bases-probe vault q7-views; community PR #7).
const views: BasesView[] = [
  { type: "cards", name: "First Cards" },
  { type: "table", name: "Second Table" },
  { type: "list", name: "List C" },
];

describe("which view a base shows", () => {
  it("opens on the first view in the file, not the first table", () => {
    expect(initialViewIndex(views)).toBe(0);
    // a site can still prefer a type
    expect(initialViewIndex(views, "table")).toBe(1);
    expect(initialViewIndex(views, "map")).toBe(0);
  });

  it("matches an embed's #View case-sensitively", () => {
    expect(findEmbeddedView(views, "List C", true)?.type).toBe("list");
    expect(findEmbeddedView(views, "list c", true)).toBeUndefined();
    expect(findEmbeddedView(views, "Nope", true)).toBeUndefined();
    // only a slugged anchor known: match by slug
    expect(findEmbeddedView(views, "list-c", false)?.type).toBe("list");
  });

  it("reads embeds of .base files as written, outside code", () => {
    expect(
      rawBaseEmbeds(
        "![[Multi.base#Cards B]]\n`![[X.base#no]]`\n```\n![[Y.base]]\n```\n![[sub/Multi.base|alias]] ![[Ratio.base#ratio-0.5]] ![[note]]",
      ),
    ).toEqual([
      { path: "Multi.base", view: "Cards B" },
      { path: "sub/Multi.base", view: "" },
      { path: "Ratio.base", view: "ratio-0.5" },
    ]);
  });
});

describe(".base page links (community PR #7)", () => {
  it("links to the notes its views show, each with its own filters", async () => {
    const { linkedSlugs } = await import("../src/pageType");
    const file = (slug: string, folder: string) =>
      ({
        slug,
        filePath: `${slug}.md`,
        relativePath: `${slug}.md`,
        frontmatter: { folder },
      }) as unknown as QuartzPluginData;
    const files = [file("a/one", "a"), file("b/two", "b"), file("c/three", "c")];
    const slugs = linkedSlugs(
      {
        views: [
          { type: "table", filters: 'file.inFolder("a")' },
          { type: "list", filters: 'file.inFolder("b")' },
        ],
      },
      files as unknown as Record<string, unknown>[],
    );
    expect(slugs.sort()).toEqual(["a/one", "b/two"]);
  });
});
