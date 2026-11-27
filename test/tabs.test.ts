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

type HNode = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HNode[];
};

/** Run the codeblock transform over placeholders for `blocks` (the note's `basesBlocks`). */
function transformCodeblocks(
  placeholders: Record<string, string>[],
  fileData: Record<string, unknown>,
  files = allFiles,
): HNode {
  const transform = BasesPage().treeTransforms!({} as never)[0]!;
  const root = {
    type: "root" as const,
    children: placeholders.map((properties) => ({
      type: "element" as const,
      tagName: "div",
      properties,
      children: [],
    })),
  };
  transform(
    root as never,
    fileData.slug as never,
    {
      fileData,
      allFiles: files,
      cfg: { locale: "en-US" },
      ctx: { allSlugs: [] },
    } as never,
  );
  return root as HNode;
}

function elements(node: HNode, test: (el: HNode) => boolean, out: HNode[] = []): HNode[] {
  if (node.type === "element" && test(node)) out.push(node);
  node.children?.forEach((child) => elements(child, test, out));
  return out;
}

const hasClass = (name: string) => (el: HNode) =>
  ((el.properties?.className as string[] | undefined) ?? []).includes(name);

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
    expect(tabs.map((t) => [t.id, t.controls])).toEqual([
      ["bases-tab-0", "bases-view-0"],
      ["bases-tab-1", "bases-view-1"],
      ["bases-tab-2", "bases-view-2"],
    ]);
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
    // and each tab still controls its own block's panel, which is labelled by that tab
    const tabs = elements(root as HNode, (el) => el.properties?.role === "tab");
    const panels = elements(root as HNode, hasClass("bases-view"));
    expect(tabs.map((t) => [t.properties!.id, t.properties!.ariaControls])).toEqual(
      [0, 1].flatMap((block) =>
        [0, 1, 2].map((i) => [`bases-${block}-tab-${i}`, [`bases-${block}-view-${i}`]]),
      ),
    );
    expect(panels.map((p) => [p.properties!.id, p.properties!.ariaLabelledBy])).toEqual(
      [0, 1].flatMap((block) =>
        [0, 1, 2].map((i) => [`bases-${block}-view-${i}`, [`bases-${block}-tab-${i}`]]),
      ),
    );
  });

  it("wire each codeblock tab to its panel, with only the ARIA attributes on the panel", () => {
    const root = transformCodeblocks([{ dataQzBasesCodeblock: "0" }], {
      slug: "note",
      basesBlocks: [basesData],
    });
    const tabs = elements(root, (el) => el.properties?.role === "tab");
    const panels = elements(root, hasClass("bases-view"));
    expect(tabs.map((t) => [t.properties!.id, t.properties!.ariaControls])).toEqual([
      ["bases-0-tab-0", ["bases-0-view-0"]],
      ["bases-0-tab-1", ["bases-0-view-1"]],
      ["bases-0-tab-2", ["bases-0-view-2"]],
    ]);
    // the panel's attributes, exactly: no stray attributes from a malformed tag
    expect(panels.map((p) => p.properties)).toEqual(
      ["table", "list", "cards"].map((type, i) => ({
        className: i === 0 ? ["bases-view", "is-active"] : ["bases-view"],
        id: `bases-0-view-${i}`,
        role: "tabpanel",
        ariaLabelledBy: [`bases-0-tab-${i}`],
        tabIndex: 0,
        dataViewIndex: String(i),
        dataViewType: type,
      })),
    );
  });

  it("give a single view no tab panel role, id or label", () => {
    const single = { views: [{ type: "table", name: "Table" }] };
    const root = transformCodeblocks([{ dataQzBasesCodeblock: "0" }], {
      slug: "note",
      basesBlocks: [single],
    });
    expect(elements(root, (el) => el.properties?.role === "tab")).toEqual([]);
    expect(elements(root, hasClass("bases-view")).map((p) => p.properties)).toEqual([
      {
        className: ["bases-view", "is-active"],
        dataViewIndex: "0",
        dataViewType: "table",
      },
    ]);

    const html = render(
      BasesBody()({
        fileData: { slug: "b.base", basesData: single },
        allFiles,
        cfg: { locale: "en-US" },
        ctx: { allSlugs: [] },
      } as never) as never,
    );
    const { tabs, panels } = tabsOf(html);
    expect(tabs).toEqual([]);
    expect(panels).toEqual([{ id: undefined, role: undefined, labelledby: undefined }]);
  });

  it("prefix the ids of a codeblock transcluded from another note with bases-embed-", () => {
    const other = {
      slug: "other",
      frontmatter: { title: "Other" },
      filePath: "other.md",
      basesBlocks: [basesData],
    };
    const root = transformCodeblocks(
      [{ dataQzBasesCodeblock: "0", dataQzBasesSource: "other" }],
      { slug: "note" },
      [...allFiles, other] as unknown as QuartzPluginData[],
    );
    const ids = elements(root, (el) => typeof el.properties?.id === "string").map(
      (el) => el.properties!.id,
    );
    expect(ids).toEqual([
      "bases-embed-0-tab-0",
      "bases-embed-0-tab-1",
      "bases-embed-0-tab-2",
      "bases-embed-0-view-0",
      "bases-embed-0-view-1",
      "bases-embed-0-view-2",
    ]);
  });

  it("prefix the ids of a note's own codeblock (source is the note) with bases-", () => {
    const root = transformCodeblocks([{ dataQzBasesCodeblock: "0", dataQzBasesSource: "note" }], {
      slug: "note",
      basesBlocks: [basesData],
    });
    const ids = elements(root, (el) => typeof el.properties?.id === "string").map(
      (el) => el.properties!.id,
    );
    expect(ids.slice(0, 2)).toEqual(["bases-0-tab-0", "bases-0-tab-1"]);
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
