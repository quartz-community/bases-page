import { describe, it, expect } from "vitest";
import {
  formatValue,
  isEmptyValue,
  getColumnLabel,
  resolveEntryPropertyValue,
  getColumns,
  renderCellValue,
} from "../src/components/shared/cell";
import { slugifyPath } from "@quartz-community/utils";
import type { BasesData, BasesEntry, BasesView } from "../src/types";

const sampleEntry: BasesEntry = {
  slug: "notes/alpha",
  title: "Alpha",
  properties: { status: "done", priority: 5, tags: ["work", "important"] },
  fileProperties: {
    name: "alpha.md",
    basename: "alpha",
    path: "notes/alpha.md",
    folder: "notes",
    ext: "md",
    tags: ["work"],
    links: ["beta"],
  },
  formulaValues: { doubled: 10, label: "high" },
};

describe("formatValue", () => {
  it("returns empty string for null/undefined", () => {
    expect(formatValue(null)).toBe("");
    expect(formatValue(undefined)).toBe("");
  });

  it("joins arrays", () => {
    expect(formatValue(["a", "b"])).toBe("a, b");
  });

  it("stringifies objects", () => {
    expect(formatValue({ key: "val" })).toBe('{"key":"val"}');
  });

  it("converts primitives to string", () => {
    expect(formatValue(42)).toBe("42");
    expect(formatValue(true)).toBe("true");
    expect(formatValue("hello")).toBe("hello");
  });
});

describe("isEmptyValue", () => {
  it("detects empty values", () => {
    expect(isEmptyValue(null)).toBe(true);
    expect(isEmptyValue(undefined)).toBe(true);
    expect(isEmptyValue("")).toBe(true);
    expect(isEmptyValue([])).toBe(true);
  });

  it("detects non-empty values", () => {
    expect(isEmptyValue("text")).toBe(false);
    expect(isEmptyValue(0)).toBe(false);
    expect(isEmptyValue([1])).toBe(false);
    expect(isEmptyValue(false)).toBe(false);
  });
});

describe("getColumnLabel", () => {
  it("uses displayName when set", () => {
    const basesData: BasesData = {
      properties: { status: { displayName: "Task Status" } },
    };
    expect(getColumnLabel("status", basesData)).toBe("Task Status");
  });

  it("capitalizes last segment by default", () => {
    const basesData: BasesData = {};
    expect(getColumnLabel("note.my_property", basesData)).toBe("My Property");
  });

  it("handles simple names", () => {
    const basesData: BasesData = {};
    expect(getColumnLabel("priority", basesData)).toBe("Priority");
  });
});

describe("resolveEntryPropertyValue", () => {
  it("resolves note.* properties", () => {
    expect(resolveEntryPropertyValue("note.status", sampleEntry)).toBe("done");
  });

  it("resolves file.* properties", () => {
    expect(resolveEntryPropertyValue("file.name", sampleEntry)).toBe("alpha.md");
    expect(resolveEntryPropertyValue("file.folder", sampleEntry)).toBe("notes");
  });

  it("resolves formula.* properties", () => {
    expect(resolveEntryPropertyValue("formula.doubled", sampleEntry)).toBe(10);
    expect(resolveEntryPropertyValue("formula.label", sampleEntry)).toBe("high");
  });

  it("falls back to frontmatter for unprefixed columns", () => {
    expect(resolveEntryPropertyValue("priority", sampleEntry)).toBe(5);
  });
});

describe("getColumns", () => {
  it("returns view order when specified", () => {
    const view: BasesView = { type: "table", order: ["status", "priority"] };
    const basesData: BasesData = {};
    expect(getColumns(view, basesData, [])).toEqual(["status", "priority"]);
  });

  it("derives columns from basesData properties", () => {
    const view: BasesView = { type: "table" };
    const basesData: BasesData = {
      properties: { status: {}, priority: {} },
    };
    expect(getColumns(view, basesData, [])).toEqual(["file.name", "status", "priority"]);
  });

  it("derives columns from entry properties when no config", () => {
    const view: BasesView = { type: "table" };
    const basesData: BasesData = {};
    expect(getColumns(view, basesData, [sampleEntry])).toEqual([
      "file.name",
      "status",
      "priority",
      "tags",
    ]);
  });
});

describe("renderCellValue", () => {
  const ctx = {
    slug: "notes/alpha",
    allSlugs: [] as string[],
    linkResolution: "shortest" as const,
  };

  it("renders null as a blank cell, as Obsidian does", () => {
    const result = renderCellValue(null, ctx) as { type: string; props: Record<string, unknown> };
    expect(result.props.class).toBe("bases-empty-value");
    expect(result.props.children).toBeUndefined();
  });

  it("renders booleans as disabled checkboxes", () => {
    const result = renderCellValue(true, ctx) as { type: string; props: Record<string, unknown> };
    expect(result.type).toBe("input");
    expect(result.props.checked).toBe(true);
    expect(result.props.disabled).toBe(true);
  });

  it("renders numbers with bases-number class", () => {
    const result = renderCellValue(42, ctx) as { type: string; props: Record<string, unknown> };
    expect(result.props.class).toBe("bases-number");
  });

  it("renders strings with bases-text class", () => {
    const result = renderCellValue("hello", ctx) as {
      type: string;
      props: Record<string, unknown>;
    };
    expect(result.props.class).toBe("bases-text");
  });

  it("renders arrays as bases-list", () => {
    const result = renderCellValue(["a", "b"], ctx) as {
      type: string;
      props: Record<string, unknown>;
    };
    expect(result.props.class).toBe("bases-list");
  });

  it("renders file objects as internal links", () => {
    const fileObj = {
      name: "apple.md",
      basename: "apple",
      path: "Compendium/Species/Dryad/apple.md",
      folder: "Compendium/Species/Dryad",
      ext: "md",
      tags: ["lineage"],
      links: [],
    };
    const result = renderCellValue(fileObj, ctx) as {
      type: string;
      props: Record<string, unknown>;
      children?: unknown[];
    };
    expect(result.type).toBe("a");
    expect(result.props.class).toBe("internal internal-link");
    expect(typeof result.props.href).toBe("string");
  });

  it("renders an array of file objects as a list of links", () => {
    const files = [
      {
        name: "apple.md",
        basename: "apple",
        path: "Species/Dryad/apple.md",
        folder: "Species/Dryad",
        ext: "md",
        tags: ["lineage"],
        links: [],
      },
      {
        name: "cherry.md",
        basename: "cherry",
        path: "Species/Dryad/cherry.md",
        folder: "Species/Dryad",
        ext: "md",
        tags: ["lineage"],
        links: [],
      },
    ];
    const result = renderCellValue(files, ctx) as {
      type: string;
      props: { class: string; children: unknown[] };
    };
    expect(result.props.class).toBe("bases-list");
  });

  it("renders generic objects as JSON code", () => {
    const obj = { unknown: "value" };
    const result = renderCellValue(obj, ctx) as { type: string };
    expect(result.type).toBe("code");
  });

  it("slugifies file paths with spaces in href", () => {
    const fileObj = {
      name: "Arcanist's Folly.md",
      basename: "Arcanist's Folly",
      path: "Compendium/Species/Ratkin/Arcanist's Folly.md",
      folder: "Compendium/Species/Ratkin",
      ext: "md",
      tags: [],
      links: [],
    };
    const result = renderCellValue(fileObj, {
      slug: "Compendium/Species",
      allSlugs: [],
      linkResolution: "shortest",
    }) as {
      type: string;
      props: Record<string, unknown>;
    };
    expect(result.type).toBe("a");
    const href = result.props.href as string;
    expect(href).not.toContain(" ");
    expect(href).toContain("arcanist's-folly");
  });

  it("slugifies file paths with multiple spaces and special chars in href", () => {
    const fileObj = {
      name: "Deific Exaltation.md",
      basename: "Deific Exaltation",
      path: "Compendium/Species/Ratkin/Deific Exaltation.md",
      folder: "Compendium/Species/Ratkin",
      ext: "md",
      tags: [],
      links: [],
    };
    const result = renderCellValue(fileObj, {
      slug: "Compendium/Species",
      allSlugs: [],
      linkResolution: "shortest",
    }) as {
      type: string;
      props: Record<string, unknown>;
    };
    expect(result.type).toBe("a");
    const href = result.props.href as string;
    expect(href).not.toContain(" ");
    expect(href).toContain("deific-exaltation");
  });

  it("slugifies paths with ampersands and percent signs", () => {
    const fileObj = {
      name: "Arts & Crafts 100%.md",
      basename: "Arts & Crafts 100%",
      path: "Notes/Arts & Crafts 100%.md",
      folder: "Notes",
      ext: "md",
      tags: [],
      links: [],
    };
    const result = renderCellValue(fileObj, {
      slug: "Notes/index",
      allSlugs: [],
      linkResolution: "shortest",
    }) as {
      type: string;
      props: Record<string, unknown>;
    };
    const href = result.props.href as string;
    expect(href).not.toContain(" ");
    expect(href).not.toContain("&");
    expect(href).not.toContain("%");
    expect(href).toContain("arts--and--crafts-100-percent");
  });
});

describe("slugifyPath", () => {
  it("replaces spaces with hyphens", () => {
    expect(slugifyPath("Arcanist's Folly")).toBe("arcanist's-folly");
  });

  it("replaces ampersands with -and-", () => {
    expect(slugifyPath("Arts & Crafts")).toBe("arts--and--crafts");
  });

  it("replaces percent with -percent", () => {
    expect(slugifyPath("100%")).toBe("100-percent");
  });

  it("removes question marks and hash signs", () => {
    expect(slugifyPath("What?#Section")).toBe("whatsection");
  });

  it("handles multi-segment paths", () => {
    expect(slugifyPath("Compendium/Species/Ratkin/Deific Exaltation")).toBe(
      "compendium/species/ratkin/deific-exaltation",
    );
  });

  it("strips trailing slashes", () => {
    expect(slugifyPath("folder/")).toBe("folder");
  });

  it("lowercases for case-insensitive matching (Obsidian parity)", () => {
    expect(slugifyPath("Compendium/Species/Dryad/Apple")).toBe("compendium/species/dryad/apple");
  });
});
