import { describe, it, expect } from "vitest";
import { render } from "preact-render-to-string";
import { h } from "preact";
import { groupViewEntries } from "../src/components/shared/group";
import { ListView } from "../src/components/views/list";
import { CardsView } from "../src/components/views/cards";
import { BoardView } from "../src/components/views/board";
import { TableView } from "../src/components/views/table";
import type { BasesEntry, BasesView } from "../src/types";

// Expected: Obsidian 1.15.1 (obsidian-bases-probe, parity survey vaults v1 and v2).
const entry = (name: string, properties: Record<string, unknown>): BasesEntry => ({
  slug: name.toLowerCase(),
  title: name,
  properties,
  fileProperties: {
    name,
    basename: name,
    path: `${name}.md`,
    folder: "/",
    ext: "md",
    tags: [],
    links: [],
  },
  formulaValues: {},
});
// sorted by status, as the resolver hands them over (empty last)
const entries = [
  entry("Delta", { status: "Blocked", score: 2 }),
  entry("Gamma", { status: "Done", score: 10 }),
  entry("Alpha", { status: "Planned", score: 3 }),
  entry("Epsilon", { score: 7 }),
];
const labels = (view: Partial<BasesView>, emptyFirst = false) =>
  groupViewEntries(entries, { type: "table", ...view } as BasesView, "None", {
    emptyFirst,
  })?.map((group) => `${group.label}:${group.entries.map((e) => e.title).join("+")}`);

describe("grouping", () => {
  it("the group without a value is None, last (first in a kanban view)", () => {
    const groupBy = { property: "status", direction: "ASC" as const };
    expect(labels({ groupBy })).toEqual([
      "Blocked:Delta",
      "Done:Gamma",
      "Planned:Alpha",
      "None:Epsilon",
    ]);
    expect(labels({ groupBy }, true)?.[0]).toBe("None:Epsilon");
  });

  it("groupOrder shows only the listed groups, in order; null is the group without a value", () => {
    const groupBy = { property: "status", direction: "DESC" as const };
    expect(labels({ groupBy, groupOrder: ["Done", "Planned"] })).toEqual([
      "Done:Gamma",
      "Planned:Alpha",
    ]);
    expect(labels({ groupBy, groupOrder: [null, "Blocked"] })).toEqual([
      "None:Epsilon",
      "Blocked:Delta",
    ]);
  });

  it("an ungrouped view has no groups", () => {
    expect(labels({})).toBeUndefined();
  });
});

const props = (view: Partial<BasesView>) => ({
  entries,
  view: { type: "list", order: ["file.name", "status", "score"], ...view } as BasesView,
  basesData: {},
  total: entries.length,
  locale: "en-US",
  slug: "index",
  allSlugs: entries.map((e) => e.slug),
  linkResolution: "shortest" as const,
});
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

describe("list options", () => {
  it("markers: number, and a custom separator", () => {
    const html = render(h(ListView as never, props({ markers: "number", separator: " | " })));
    expect(text(html)).toContain("1. Delta | Blocked | 2 2. Gamma | Done | 10");
    expect(html).not.toContain("list-bullet");
  });

  it("markers: none", () => {
    const html = render(h(ListView as never, props({ markers: "none" })));
    expect(html).not.toContain("list-bullet");
    expect(html).not.toContain("list-number");
  });

  it("indentProperties puts the other properties under the first, each with a bullet", () => {
    const html = render(h(ListView as never, props({ indentProperties: true })));
    expect(html).toContain('class="bases-list-item-properties nested"');
    expect(html).not.toContain("bases-list-separator");
    expect(text(html)).toContain("- Delta - Blocked - 2");
  });

  it("a grouped list has a heading per group", () => {
    const html = render(
      h(ListView as never, props({ groupBy: { property: "status", direction: "ASC" } })),
    );
    expect(html.match(/bases-group-heading/g)).toHaveLength(4);
    expect(text(html)).toContain("None - Epsilon");
  });
});

describe("grouped cards, kanban and table options", () => {
  const groupBy = { property: "status", direction: "ASC" as const };
  it("a grouped cards view has a heading per group", () => {
    const html = render(h(CardsView as never, props({ type: "cards", groupBy })));
    expect(html.match(/bases-group-value/g)).toHaveLength(4);
  });

  it("kanban: None first, columnWidth, and covers from image", () => {
    const html = render(
      h(
        BoardView as never,
        props({ type: "kanban", groupBy, columnWidth: 300, image: "note.cover" }),
      ),
    );
    expect(text(html).indexOf("None")).toBeLessThan(text(html).indexOf("Blocked"));
    expect(html).toContain("width:300px");
    expect(html).toContain("bases-board-card-cover");
  });

  it("rowHeight sets Obsidian's row height", () => {
    const html = render(h(TableView as never, props({ type: "table", rowHeight: "tall" })));
    expect(html).toContain('data-row-height="tall"');
    expect(html).toContain("--bases-table-row-height:120px");
    expect(render(h(TableView as never, props({ type: "table" })))).not.toContain(
      "data-row-height",
    );
  });
});
