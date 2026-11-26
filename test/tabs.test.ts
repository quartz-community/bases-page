import { describe, expect, it, vi } from "vitest";
import { render } from "preact-render-to-string";
import type { QuartzPluginData } from "../src/types";
import { freeIdPrefix, tabIndexForKey } from "../src/components/scripts/tabs";
import { BasesPage } from "../src/pageType";

vi.mock("../src/components/styles/bases.scss", () => ({ default: "" }));
vi.mock("../src/components/scripts/bases.inline.ts", () => ({ default: "" }));

const BasesBody = (await import("../src/components/BasesBody")).default;

const basesData = {
  views: [
    { type: "table", name: "Table" },
    { type: "list", name: "List" },
    { type: "cards", name: "Cards" },
  ],
};
const allFiles = [
  { slug: "a", frontmatter: { title: "A" }, filePath: "a.md" },
] as unknown as QuartzPluginData[];

/** The tabs' and panels' ARIA wiring in rendered HTML. */
function tabsOf(html: string) {
  const doc = html.replace(/\n/g, "");
  const tabs = [...doc.matchAll(/<button[^>]*role="tab"[^>]*>/g)].map((m) => m[0]);
  const panels = [...doc.matchAll(/<div class="bases-view(?: is-active)? ?"[^>]*>/g)].map(
    (m) => m[0],
  );
  const attr = (tag: string, name: string) => tag.match(new RegExp(` ${name}="([^"]*)"`))?.[1];
  return {
    tabs: tabs.map((t) => ({
      id: attr(t, "id"),
      controls: attr(t, "aria-controls"),
      selected: attr(t, "aria-selected"),
      tabindex: attr(t, "tabindex"),
    })),
    panels: panels.map((p) => ({
      id: attr(p, "id"),
      role: attr(p, "role"),
      labelledby: attr(p, "aria-labelledby"),
    })),
  };
}

describe("bases view tabs (WAI-ARIA tabs)", () => {
  it("wire each tab to its view, with only the selected tab in the tab order", () => {
    const html = render(
      BasesBody()({
        fileData: { slug: "b.base", basesData },
        allFiles,
        cfg: { locale: "en-US" },
        ctx: { allSlugs: [] },
      } as never) as never,
    );
    const { tabs, panels } = tabsOf(html);
    expect(tabs.map((t) => [t.selected, t.tabindex])).toEqual([
      ["true", "0"],
      ["false", "-1"],
      ["false", "-1"],
    ]);
    expect(panels).toHaveLength(3);
    tabs.forEach((tab, i) => {
      expect(tab.controls).toBe(panels[i]!.id);
      expect(panels[i]!.role).toBe("tabpanel");
      expect(panels[i]!.labelledby).toBe(tab.id);
    });
  });

  it("give two inline bases on a note different ids", () => {
    const transform = BasesPage().treeTransforms!({} as never)[0]!;
    const placeholder = (i: number) => ({
      type: "element" as const,
      tagName: "div",
      properties: { dataQzBasesCodeblock: String(i) },
      children: [],
    });
    const root = { type: "root" as const, children: [placeholder(0), placeholder(1)] };
    transform(
      root as never,
      "note" as never,
      {
        fileData: { slug: "note", basesBlocks: [basesData, basesData] },
        allFiles,
        cfg: { locale: "en-US" },
        ctx: { allSlugs: [] },
      } as never,
    );
    const fromTree: string[] = [];
    const walk = (node: { properties?: Record<string, unknown>; children?: unknown[] }) => {
      if (typeof node.properties?.id === "string") fromTree.push(node.properties.id);
      (node.children as (typeof node)[] | undefined)?.forEach(walk);
    };
    walk(root);
    expect(fromTree).toHaveLength(12);
    expect(new Set(fromTree).size).toBe(12);
  });
});

describe("tab keys", () => {
  it("move left and right, wrapping around, and to the first and last tab", () => {
    expect(tabIndexForKey("ArrowRight", 0, 3)).toBe(1);
    expect(tabIndexForKey("ArrowRight", 2, 3)).toBe(0);
    expect(tabIndexForKey("ArrowLeft", 0, 3)).toBe(2);
    expect(tabIndexForKey("Home", 2, 3)).toBe(0);
    expect(tabIndexForKey("End", 0, 3)).toBe(2);
    expect(tabIndexForKey("Enter", 0, 3)).toBeUndefined();
  });

  it("free id prefixes skip the ones in use", () => {
    const used = new Set(["bases-tab-0", "bases-2-view-1"]);
    const ids = (p: string) => [`${p}-tab-0`, `${p}-view-1`];
    expect(freeIdPrefix("bases", ids, (id) => used.has(id))).toBe("bases-3");
    expect(freeIdPrefix("other", ids, (id) => used.has(id))).toBe("other");
  });
});
