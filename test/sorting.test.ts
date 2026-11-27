import { describe, it, expect } from "vitest";
import { resolveBasesEntries, buildSelfContext } from "../src/resolver";
import { extractNoteTags, frontmatterKeys, tagMatches } from "../src/tags";
import type { BasesView, QuartzPluginData } from "../src/types";

const note = (path: string, frontmatter: Record<string, unknown>, extra: object = {}) =>
  ({
    slug: path.replace(/\.[^.]+$/, ""),
    filePath: path,
    relativePath: path,
    frontmatter,
    ...extra,
  }) as unknown as QuartzPluginData;

const files = [
  note("a.md", { n: 10, d: new Date(2024, 0, 3), s: "b" }),
  note("b.md", { n: 2, d: new Date(2024, 0, 1), s: "c" }),
  note("c.md", { n: 33, d: new Date(2024, 0, 2), s: "a" }),
];
const order = (property: string, direction: "ASC" | "DESC" = "ASC", extra: object = {}) =>
  resolveBasesEntries(
    {
      formulas: {
        dur: 'date("2024-01-01") - d',
        dstr: 'd.format("YYYY-MM-DD")',
      },
    },
    files,
    { type: "table", name: "v", sort: [{ property, direction }], ...extra } as BasesView,
  ).entries.map((e) => e.fileProperties.name);

describe("sorting", () => {
  it("numbers by value, both directions", () => {
    expect(order("n")).toEqual(["b", "a", "c"]);
    expect(order("n", "DESC")).toEqual(["c", "a", "b"]);
  });

  it("dates, date strings and durations by time", () => {
    expect(order("d")).toEqual(["b", "c", "a"]);
    expect(order("formula.dstr", "DESC")).toEqual(["a", "c", "b"]);
    // 2024-01-01 minus the date: b 0, c −1 day, a −2 days
    expect(order("formula.dur")).toEqual(["a", "c", "b"]);
  });

  it("text alphabetically", () => {
    expect(order("s")).toEqual(["c", "a", "b"]);
    expect(order("note.s", "DESC")).toEqual(["b", "a", "c"]);
  });

  it("ties by file name, then path", () => {
    const tied = [note("z/x.md", { k: 1 }), note("a/y.md", { k: 1 }), note("b/x.md", { k: 1 })];
    const { entries } = resolveBasesEntries({}, tied, {
      type: "table",
      name: "v",
      sort: [{ property: "k", direction: "DESC" }],
    } as BasesView);
    expect(entries.map((e) => e.fileProperties.path)).toEqual(["b/x.md", "z/x.md", "a/y.md"]);
  });

  it("a grouped view without a sort sorts by the group property, in its direction", () => {
    const view = { type: "table", name: "v", groupBy: { property: "n", direction: "DESC" } };
    const { entries } = resolveBasesEntries({}, files, view as BasesView);
    expect(entries.map((e) => e.fileProperties.name)).toEqual(["c", "a", "b"]);
    const asc = { type: "table", name: "v", groupBy: { property: "n" } };
    expect(
      resolveBasesEntries({}, files, asc as BasesView).entries.map((e) => e.fileProperties.name),
    ).toEqual(["b", "a", "c"]);
  });

  it("limit keeps the first entries and reports the total", () => {
    const { entries, total } = resolveBasesEntries({}, files, {
      type: "table",
      name: "v",
      sort: [{ property: "n", direction: "ASC" }],
      limit: 2,
    } as BasesView);
    expect(entries.map((e) => e.fileProperties.name)).toEqual(["b", "a"]);
    expect(total).toBe(3);
  });
});

describe("file properties", () => {
  const one = (fd: QuartzPluginData) => resolveBasesEntries({}, [fd]).entries[0]!;

  it("name, basename, folder and ext, as Obsidian gives them", () => {
    expect(one(note("top.md", {})).fileProperties).toMatchObject({
      name: "top",
      basename: "top",
      fullname: "top.md",
      folder: "/",
      ext: "md",
      path: "top.md",
    });
    expect(one(note("a/b/Plan.canvas", {})).fileProperties).toMatchObject({
      name: "Plan.canvas",
      basename: "Plan",
      folder: "a/b",
      ext: "canvas",
    });
    expect(one(note("a/.hidden", {})).fileProperties).toMatchObject({
      basename: ".hidden",
      ext: "",
    });
  });

  it("created and modified come from the page's dates", () => {
    const fd = note(
      "x.md",
      {},
      {
        dates: { created: "2024-03-05T10:00:00Z", modified: new Date("2024-04-01T00:00:00Z") },
      },
    );
    const { fileProperties } = one(fd);
    expect(fileProperties.created).toBe("2024-03-05T10:00:00.000Z");
    expect(fileProperties.modified).toBe("2024-04-01T00:00:00.000Z");
    expect(
      one(note("y.md", {}, { dates: { created: "not a date" } })).fileProperties.created,
    ).toBeUndefined();
  });

  it("size is the source file's size; a file that isn't there has none", () => {
    expect(
      one(note("package.json", {}, { filePath: "package.json" })).fileProperties.size,
    ).toBeGreaterThan(100);
    expect(
      one(note("nope.md", {}, { filePath: "does/not/exist.md" })).fileProperties.size,
    ).toBeUndefined();
  });

  it("links leave out the note's tag pages, and non-text entries", () => {
    const fd = note("x.md", { tags: ["t"] }, { links: ["tags/t", "other", 5] });
    expect(one(fd).fileProperties.links).toEqual(["other"]);
  });

  it("pages without a source file are not entries", () => {
    const virtual = { slug: "tags/x", relativePath: "tags/x.md", frontmatter: {} } as never;
    const empty = { slug: "y", filePath: "", frontmatter: {} } as never;
    expect(resolveBasesEntries({}, [virtual, empty]).entries).toEqual([]);
  });

  it("a page without a relativePath is named by its filePath", () => {
    const fd = { slug: "s", filePath: "dir/real.md", frontmatter: {} } as never;
    expect(one(fd).fileProperties).toMatchObject({ path: "dir/real.md", name: "real" });
  });

  it("a string tags property is one tag", () => {
    const { entries } = resolveBasesEntries({ formulas: { t: "tags" } }, [
      note("x.md", { tags: "solo" }),
    ]);
    expect(String((entries[0]!.formulaValues.t as unknown[])[0])).toBe("#solo");
  });

  it("this for a page without a slug still has a file", () => {
    const self = buildSelfContext({ relativePath: "h.md", frontmatter: { k: 1 } } as never);
    expect(self.file.name).toBe("h");
    expect(self.k).toBe(1);
  });
});

describe("tags", () => {
  it("file tags: inline first, then frontmatter, each once, invalid ones left out", () => {
    const source =
      "---\ntags:\n  - Fm\n  - '#Hashed'\n  - 'a, b'\n  - inline\n  - 2024\n---\nText #inline and #Other/Sub, #123 not";
    expect(extractNoteTags(source)).toEqual({
      file: ["#inline", "#Other/Sub", "#Fm", "#Hashed"],
      note: ["#Fm", "#Hashed", "#a, b", "#inline", "#2024"],
    });
  });

  it("tags in code and comments don't count; tag: is read too; no frontmatter, no property", () => {
    expect(extractNoteTags("```\n#code\n```\n`#inline` %%#c%% <!-- #h --> #real").file).toEqual([
      "#real",
    ]);
    expect(extractNoteTags("---\ntag: one\n---\n").note).toEqual(["#one"]);
    expect(extractNoteTags("no frontmatter #x")).toEqual({ file: ["#x"], note: undefined });
    expect(extractNoteTags("---\ntags:\n---\n").note).toBeUndefined();
    expect(extractNoteTags("---\n: [bad\n---\n").note).toBeUndefined();
  });

  it("frontmatterKeys lists the keys as written", () => {
    expect(frontmatterKeys("---\na: 1\nb: x\n---\nbody")).toEqual(["a", "b"]);
    expect(frontmatterKeys("body")).toEqual([]);
    expect(frontmatterKeys("---\n\n---\n")).toEqual([]);
    expect(frontmatterKeys("---\n- a\n---\n")).toBeUndefined();
    expect(frontmatterKeys("---\n: [bad\n---\n")).toBeUndefined();
  });

  it("tagMatches: the tag or a nested tag, ignoring case, # and a trailing /", () => {
    expect(tagMatches("#Proj/A", "proj")).toBe(true);
    expect(tagMatches("#Proj/A", "#proj/a/")).toBe(true);
    expect(tagMatches("#Project", "proj")).toBe(false);
    expect(tagMatches("#x", "  ")).toBe(false);
  });
});

describe("sort order", () => {
  const sortBy = (values: unknown[], direction: "ASC" | "DESC" = "ASC") =>
    resolveBasesEntries(
      {},
      values.map((v, i) => note(`n${i}.md`, v === undefined ? {} : { v })),
      { type: "table", name: "v", sort: [{ property: "v", direction }] } as BasesView,
    ).entries.map((e) => e.properties.v);

  it("text that looks like a date in V8 is text: natural order, and transitive", () => {
    const values = ["Chapter 100", "Chapter 13", "Chapter 9", "May 5", "Item 2", "item 10"];
    expect(sortBy(values)).toEqual([
      "Chapter 9",
      "Chapter 13",
      "Chapter 100",
      "Item 2",
      "item 10",
      "May 5",
    ]);
    // the same order whatever the input order
    expect(sortBy([...values].reverse())).toEqual(sortBy(values));
  });

  it("ISO dates in frontmatter sort as dates", () => {
    const sorted = sortBy(["2024-03-10", "2024-03-05T23:00:00", "2024-03-05"]);
    expect(sorted).toEqual(["2024-03-05", "2024-03-05T23:00:00", "2024-03-10"]);
  });

  it("values of different types do not interleave; empty values stay last", () => {
    expect(sortBy(["b", 10, undefined, "a", 2])).toEqual([2, 10, "a", "b", undefined]);
    expect(sortBy(["b", 10, undefined, "a", 2], "DESC")).toEqual(["b", "a", 10, 2, undefined]);
  });
});
