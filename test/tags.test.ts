import { describe, it, expect } from "vitest";
import { resolveBasesEntries } from "../src/resolver";
import { extractNoteTags } from "../src/tags";
import type { QuartzPluginData } from "../src/types";

// Notes and expectations from Obsidian 1.15.0 (obsidian-bases-probe vault q2-tags, bases-page#9).
const sources: Record<string, string> = {
  t1: "---\ntags: [src/ose/CC/1]\n---\nbody",
  t2: "---\ntags: [src/ose/CC]\n---\nbody",
  t3: "---\ntags: [src/ose/CCX]\n---\nbody",
  t4: "body #src/ose/CC/1 here",
  t5: '---\ntags: ["#src/ose/CC"]\n---\nbody',
  t6: "---\ntags: [Src/OSE/cc/1]\n---\nbody",
  t7: "inline #Src/Ose/CC",
  t8: "---\ntags: [alpha]\n---\ntext #beta/gamma",
  t9: "---\ntags: src\n---\nbody",
  t10: '---\ntags: "src/ose/CC, other"\n---\nbody',
  t11: "---\ntags: [src/ose/CC]\n---\n#src/ose/CC #SRC/ose/cc",
};

// Quartz's own frontmatter.tags: slugged, lower-cased, inline tags merged in
const quartzTags = (source: string) => {
  const tags = extractNoteTags(source);
  return [...new Set([...(tags.note ?? []), ...tags.file].map((t) => t.slice(1).toLowerCase()))];
};

const files = Object.entries(sources).map(
  ([name, source]) =>
    ({
      slug: name,
      filePath: `${name}.md`,
      relativePath: `${name}.md`,
      frontmatter: { title: name, tags: quartzTags(source) },
      basesTags: extractNoteTags(source),
    }) as unknown as QuartzPluginData,
);

const matching = (filter: string) =>
  resolveBasesEntries({ filters: filter }, files)
    .entries.map((e) => e.slug)
    .sort();
const formula = (expression: string) =>
  Object.fromEntries(
    resolveBasesEntries({ formulas: { f: expression } }, files).entries.map((e) => [
      e.slug,
      e.formulaValues.f,
    ]),
  );

const NESTED = ["t1", "t11", "t2", "t4", "t5", "t6", "t7"];

describe("nested tags (bases-page#9)", () => {
  it("contains() on file.tags matches the tag and its nested tags, by whole segments", () => {
    expect(matching('file.tags.contains("#src/ose/CC")')).toEqual(NESTED);
    expect(matching('file.tags.contains("src/ose/CC")')).toEqual(NESTED);
    expect(matching('file.tags.contains("#src/ose/CC/1")')).toEqual(["t1", "t4", "t6"]);
    expect(matching('contains(file.tags, "src/ose/CC")')).toEqual(NESTED);
    expect(matching('file.tags.containsAny("nope", "src/ose/CC")')).toEqual(NESTED);
  });

  it("hasTag() matches nested tags, case-insensitively, any of several tags", () => {
    expect(matching('file.hasTag("src/ose/CC")')).toEqual(NESTED);
    expect(matching('file.hasTag("#src/ose/CC")')).toEqual(NESTED);
    expect(matching('file.hasTag("src/ose/cc")')).toEqual(NESTED);
    expect(matching('file.hasTag("src")')).toEqual(
      ["t1", "t11", "t2", "t3", "t4", "t5", "t6", "t7", "t9"].sort(),
    );
    expect(matching('file.hasTag("nope", "beta")')).toEqual(["t8"]);
  });

  it("the tags property holds the frontmatter tags only, and matches nested tags too", () => {
    expect(matching('note.tags.contains("#src/ose/CC")')).toEqual(["t1", "t11", "t2", "t5", "t6"]);
    expect(matching('tags.contains("src/ose/CC")')).toEqual(["t1", "t11", "t2", "t5", "t6"]);
    const values = formula("note.tags");
    expect(values.t4).toBeUndefined();
    expect(values.t7).toBeUndefined();
    expect(String(formula('tags.join(",")').t10)).toBe("#src/ose/CC, other");
  });

  it("file.tags: inline tags first, with #, original case, deduplicated case-sensitively", () => {
    const joined = formula('file.tags.join(",")');
    expect(joined.t8).toBe("#beta/gamma,#alpha");
    expect(joined.t6).toBe("#Src/OSE/cc/1");
    expect(joined.t11).toBe("#src/ose/CC,#SRC/ose/cc");
    expect(joined.t10).toBe("");
    expect(formula("file.tags[0]").t1?.toString()).toBe("#src/ose/CC/1");
    expect(formula('file.tags[0].isType("string")').t1).toBe(true);
    expect(formula('file.tags.toString().contains("src/ose/CC")').t9).toBe(false);
  });

  it("skips tags in code and headings", () => {
    expect(extractNoteTags("# Heading\n`#code`\n```\n#nope\n```\n#yes 2024 #123").file).toEqual([
      "#yes",
    ]);
  });
});
