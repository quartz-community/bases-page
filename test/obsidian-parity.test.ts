import { describe, it, expect } from "vitest";
import { render } from "preact-render-to-string";
import { h } from "preact";
import { CardsView } from "../src/components/views/cards";
import { evaluate, evaluateFilter } from "../src/compiler";
import type { EvalContext } from "../src/compiler";
import { buildSelfContext, resolveBasesEntries } from "../src/resolver";
import type { BasesData, BasesView, QuartzPluginData } from "../src/types";

// Values recorded in Obsidian 1.15.1 with dev-mode's obsidian-bases-probe (Europe/Amsterdam).
// The `it.fails` cases are known divergences (bugs): each states what Obsidian does.

const note = (path: string, frontmatter: Record<string, unknown>, links: string[] = []) =>
  ({
    slug: path.replace(/\.md$/, "").replace(/ /g, "-"),
    filePath: path,
    relativePath: path,
    frontmatter,
    links,
  }) as unknown as QuartzPluginData;

// Ch/Chapter 2 … Chapter 100; `rank` only on Chapter 2, 10 and 100
const chapters = [2, 9, 10, 13, 100].map((n, i) => {
  const frontmatter: Record<string, unknown> = {
    label: `Chapter ${n}`,
    flag: n % 2,
    big: n > 9 ? 1 : 0,
  };
  if (i % 2 === 0) frontmatter.rank = i + 1;
  return note(`Ch/Chapter ${n}.md`, frontmatter);
});

const names = (basesData: BasesData, view?: BasesView) =>
  resolveBasesEntries(basesData, chapters, view).entries.map((e) => e.fileProperties.name);

describe("sorting (Obsidian parity)", () => {
  it("puts entries without the sort value last when sorting ascending", () => {
    const view = { type: "table", name: "v", sort: [{ property: "rank", direction: "ASC" }] };
    expect(names({}, view as BasesView).slice(0, 3)).toEqual([
      "Chapter 2",
      "Chapter 10",
      "Chapter 100",
    ]);
  });

  // Obsidian orders text naturally (numbers by value). compareSort used to run Date.parse on
  // every string ("Chapter 100" was the year 100, "Chapter 9" September 2001).
  it("orders file names naturally by default (Chapter 2, 9, 10, 13, 100)", () => {
    expect(names({})).toEqual([
      "Chapter 2",
      "Chapter 9",
      "Chapter 10",
      "Chapter 13",
      "Chapter 100",
    ]);
  });

  it("orders a text property naturally", () => {
    const view = { type: "table", name: "v", sort: [{ property: "label", direction: "ASC" }] };
    expect(names({}, view as BasesView)).toEqual([
      "Chapter 2",
      "Chapter 9",
      "Chapter 10",
      "Chapter 13",
      "Chapter 100",
    ]);
  });

  // DESC reverses the values, not where the empty ones go
  it("keeps entries without the sort value last when sorting descending", () => {
    const view = { type: "table", name: "v", sort: [{ property: "rank", direction: "DESC" }] };
    expect(names({}, view as BasesView).slice(0, 3)).toEqual([
      "Chapter 100",
      "Chapter 10",
      "Chapter 2",
    ]);
  });
});

describe("list.sort() (Obsidian parity)", () => {
  const ctx: EvalContext = { note: {}, file: {} as never, formula: {} };
  it("numbers first, then text naturally and ignoring case; false before true", () => {
    expect(evaluate('[10, 9, "b", "A", 2].sort()', ctx)).toEqual([2, 9, 10, "A", "b"]);
    expect(evaluate("[true, false].sort()", ctx)).toEqual([false, true]);
    expect(evaluate('[date("2025-01-01"), date("2024-01-01")].sort()[0].year', ctx)).toBe(2024);
  });
});

describe("filters (Obsidian parity)", () => {
  const ctx = (n: Record<string, unknown>): EvalContext => ({
    note: n,
    file: {} as never,
    formula: {},
  });

  it("not: excludes an entry matching every condition", () => {
    expect(evaluateFilter({ not: ["a == 1", "b == 1"] }, ctx({ a: 1, b: 1 }))).toBe(false);
    expect(evaluateFilter({ not: ["a == 1", "b == 1"] }, ctx({ a: 0, b: 0 }))).toBe(true);
  });

  // bug: src/compiler/index.ts evaluates `not` as "not all of them" (!every); Obsidian's
  // "none of the following are true" excludes an entry that matches any one condition
  // (probe: `not: [flag == 1, big == true]` keeps only the note with flag 0 and big 0).
  it.fails("not: excludes an entry matching any one condition", () => {
    expect(evaluateFilter({ not: ["a == 1", "b == 1"] }, ctx({ a: 1, b: 0 }))).toBe(false);
  });

  // bug: compareValues uses ===; in Obsidian "5" == 5 and 1 == true
  it.fails("== compares a number with a numeric string and a boolean as Obsidian does", () => {
    expect(evaluate('"5" == 5', ctx({}))).toBe(true);
    expect(evaluate("n == true", ctx({ n: 1 }))).toBe(true);
  });

  // bug: toBoolean is JavaScript truthiness; Obsidian treats an empty list as false
  it.fails("an empty list is falsy: if([], …)", () => {
    expect(evaluate('if([], "t", "f")', ctx({}))).toBe("f");
  });

  it.fails("an empty list is falsy: isTruthy() and !", () => {
    expect(evaluate("[].isTruthy()", ctx({}))).toBe(false);
    expect(evaluate("![]", ctx({}))).toBe(true);
  });

  // bug: compareValues compares with ===, and a missing property is undefined, not null, so
  // the usual "has no status" filter `status == null` matches nothing (Obsidian: true)
  it.fails("a missing property == null", () => {
    expect(evaluate("missing == null", ctx({}))).toBe(true);
    expect(evaluateFilter("status == null", ctx({ other: 1 }))).toBe(true);
  });

  it("a property with a value != null", () => {
    expect(evaluate("num != null", ctx({ num: 5 }))).toBe(true);
  });

  // bug: compareValues turns both sides into numbers whenever it can; Obsidian compares two
  // strings as text ("10" > "9" is false), and a string with a number as a number
  it.fails('two strings compare as text: "10" > "9" is false', () => {
    expect(evaluate('"10" > "9"', ctx({}))).toBe(false);
  });

  it("a numeric string property compares with a number as a number", () => {
    expect(evaluate("n > 9", ctx({ n: "10" }))).toBe(true);
  });

  // bug: list.contains() uses ===; in Obsidian [1, 2].contains("1") is true, as "1" == 1
  it.fails('a list of numbers contains a numeric string: [1, 2].contains("1")', () => {
    expect(evaluate('[1, 2].contains("1")', ctx({}))).toBe(true);
  });
});

describe("formulas (Obsidian parity)", () => {
  // bug: resolveBasesEntries evaluates formulas once, in the order they are written, so a
  // formula that uses one written after it sees null. Obsidian evaluates them on demand.
  it.fails("a formula can use a formula defined after it", () => {
    const { entries } = resolveBasesEntries(
      { formulas: { a: "formula.b + 1", b: "2" } },
      chapters.slice(0, 1),
    );
    expect(entries[0]?.formulaValues.a).toBe(3);
  });

  it("a formula can use a formula defined before it", () => {
    const { entries } = resolveBasesEntries(
      { formulas: { b: "2", a: "formula.b + 1" } },
      chapters.slice(0, 1),
    );
    expect(entries[0]?.formulaValues.a).toBe(3);
  });

  const host = note("Host.md", { hostprop: "yes" });
  const alpha = note("Notes/Alpha.md", { status: "open", tags: ["proj/a"] });
  const formula = (expression: string) =>
    resolveBasesEntries({ formulas: { f: expression } }, [alpha], undefined, buildSelfContext(host))
      .entries[0]?.formulaValues.f;

  // bug: hasProperty (src/compiler/functions.ts) ignores its target and reads the row's note
  it.fails("this.file.hasProperty() looks at the embedding note's properties", () => {
    expect(formula('this.file.hasProperty("hostprop")')).toBe(true);
    expect(formula('this.file.hasProperty("status")')).toBe(false);
  });

  // bug: file() builds a bare file value from the path without looking the file up, so it has
  // no tags, links or properties
  it.fails("file(path) is the vault's file, with its tags", () => {
    expect(formula('file("Notes/Alpha.md").hasTag("proj")')).toBe(true);
  });

  it("file(path).name is the note's name", () => {
    expect(formula('file("Notes/Alpha.md").name')).toBe("Alpha");
  });
});

describe("values (Obsidian parity)", () => {
  const ctx: EvalContext = { note: {}, file: {} as never, formula: {} };

  it.fails("date.millisecond is the date's milliseconds", () => {
    expect(evaluate('date("2024-03-05 14:30:15.250").millisecond', ctx)).toBe(250);
  });

  // bug: applyBinary returns 0 for x / 0 and x % 0
  it.fails("division by zero is Infinity and modulo by zero NaN", () => {
    expect(evaluate("1 / 0", ctx)).toBe(Infinity);
    expect(evaluate("5 % 0", ctx)).toBeNaN();
  });

  it.fails("title() capitalises words separated by spaces and lowercases the rest", () => {
    expect(evaluate('"hello WORLD foo-bar".title()', ctx)).toBe("Hello World Foo-bar");
  });

  it.fails("list == list compares the items", () => {
    expect(evaluate("[1, 2] == [1, 2]", ctx)).toBe(true);
  });

  // Obsidian's sum(), mean() and max() skip strings, also numeric ones (mean counts them as 0)
  it.fails("sum(), mean() and max() use only numbers", () => {
    expect(evaluate('["1", 2, "x"].sum()', ctx)).toBe(2);
    expect(evaluate('["2", 4].mean()', ctx)).toBe(2);
    expect(evaluate('["9", 4].max()', ctx)).toBe(4);
  });

  it.fails("list + list concatenates", () => {
    expect(evaluate("[1] + [2]", ctx)).toEqual([1, 2]);
  });

  it.fails('a string does not contain "" (Obsidian: false)', () => {
    expect(evaluate('"abc".contains("")', ctx)).toBe(false);
  });

  it.fails("unique() removes equal dates", () => {
    expect(evaluate('[date("2024-01-01"), date("2024-01-01")].unique().length', ctx)).toBe(1);
  });

  // Obsidian's number() reads a leading number, like parseFloat
  it.fails('number("12abc") is 12, number("0x10") is 0', () => {
    expect(evaluate('number("12abc")', ctx)).toBe(12);
    expect(evaluate('number("0x10")', ctx)).toBe(0);
  });

  it("number() reads a number with surrounding spaces", () => {
    expect(evaluate('number(" 12 ")', ctx)).toBe(12);
  });
});

describe("group headings (Obsidian parity)", () => {
  const files = [note("G/A.md", { owner: "[[B]]" }), note("G/B.md", { owner: "[[A]]" })];
  const formulas = {
    d: 'date("2024-03-05")',
    dur: 'date("2024-03-05") - date("2024-03-01")',
    dt: 'date("2024-03-05 14:30")',
  };
  const headings = (property: string) => {
    const view = {
      type: "cards",
      name: "v",
      order: ["file.name"],
      groupBy: { property, direction: "ASC" },
    } as unknown as BasesView;
    const { entries, total } = resolveBasesEntries({ formulas }, files, view);
    const html = render(
      h(CardsView as never, {
        entries,
        view,
        basesData: { formulas },
        total,
        locale: "en-US",
        slug: "index",
        allSlugs: ["G/A", "G/B"],
        linkResolution: "shortest",
      }),
    );
    return [...html.matchAll(/class="bases-group-value">(.*?)<\/span>/g)].map((m) =>
      m[1]!.replace(/<[^>]+>/g, ""),
    );
  };

  it("a text group is headed by its value", () => {
    expect(headings("file.name")).toEqual(["A", "B"]);
  });

  // bug: groupViewEntries (src/components/shared/group.ts) labels a group with formatValue(),
  // the sortable form: a date shows as a UTC ISO timestamp (here the day before, in
  // Europe/Amsterdam), a duration as milliseconds, a link as its wikilink source. Obsidian shows
  // the value as its cells do.
  it.fails("a date group is headed by the date as Obsidian shows it", () => {
    expect(headings("formula.d")).toEqual(["03/05/2024"]);
    expect(headings("formula.dt")).toEqual(["03/05/2024 2:30 PM"]);
  });

  it.fails("a duration group is headed by the humanized duration", () => {
    expect(headings("formula.dur")).toEqual(["4 days"]);
  });

  it.fails("a link group is headed by the linked note's name", () => {
    expect(headings("owner")).toEqual(["A", "B"]);
  });
});
