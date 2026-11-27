import { describe, it, expect } from "vitest";
import { evaluate, ErrorValue } from "../src/compiler";
import type { EvalContext } from "../src/compiler";
import { resolveBasesEntries } from "../src/resolver";
import type { QuartzPluginData } from "../src/types";

const ctx = (
  note: Record<string, unknown> = {},
  extra: Partial<EvalContext> = {},
): EvalContext => ({
  note,
  file: {
    name: "n",
    basename: "n",
    path: "f/n.md",
    folder: "f",
    ext: "md",
    tags: [],
    links: [],
  },
  formula: {},
  ...extra,
});
const ev = (expression: string, note: Record<string, unknown> = {}, extra?: Partial<EvalContext>) =>
  evaluate(expression, ctx(note, extra));
const error = (expression: string, note: Record<string, unknown> = {}) => {
  const value = ev(expression, note);
  expect(value).toBeInstanceOf(ErrorValue);
  return (value as ErrorValue).message;
};

describe("comparison operators", () => {
  it.each([
    ["a > b", false],
    ["a < b", true],
    ["a >= b", false],
    ["a <= b", true],
    ["a == b", false],
    ["a != b", true],
    ["b >= b", true],
    ["b <= b", true],
    ["b > b", false],
    ["b < b", false],
  ])("numbers: %s is %s", (expression, expected) => {
    expect(ev(expression, { a: 2, b: 10 })).toBe(expected);
  });

  it.each([
    ["s > t", false],
    ["s < t", true],
    ["s >= t", false],
    ["s <= t", true],
    ["s >= s", true],
    ["t <= t", true],
  ])("text compares as text: %s is %s", (expression, expected) => {
    expect(ev(expression, { s: "apple", t: "banana" })).toBe(expected);
  });

  it("a numeric string property compares with a number as a number", () => {
    expect(ev("n < 9", { n: "10" })).toBe(false);
    expect(ev("n <= 10", { n: "10" })).toBe(true);
    expect(ev("n >= 11", { n: "10" })).toBe(false);
  });

  it("ordering against an empty value is empty, as in Obsidian", () => {
    expect(ev("missing > 1")).toBeUndefined();
    expect(ev("1 <= missing")).toBeUndefined();
  });

  it("dates compare with dates and with date strings", () => {
    const d = { d: new Date(2024, 2, 5) };
    expect(ev('d > "2024-03-01"', d)).toBe(true);
    expect(ev('d < "2024-03-01"', d)).toBe(false);
    expect(ev('d >= "2024-03-05"', d)).toBe(true);
    expect(ev('d <= "2024-03-04"', d)).toBe(false);
    expect(ev('"2024-03-06" > d', d)).toBe(true);
    expect(ev('d == date("2024-03-05")', d)).toBe(true);
    expect(ev('d != date("2024-03-05")', d)).toBe(false);
    expect(ev('d != date("2024-03-06")', d)).toBe(true);
  });

  it("durations: == only with durations; <, > also with duration strings and milliseconds", () => {
    expect(ev('duration("1d") == duration("24h")')).toBe(true);
    expect(ev('duration("1d") != duration("2d")')).toBe(true);
    expect(ev('duration("1d") == "1d"')).toBe(false);
    expect(ev('duration("1d") != "1d"')).toBe(true);
    expect(ev('duration("1d") > "1h"')).toBe(true);
    expect(ev('duration("1d") < 1000')).toBe(false);
    expect(ev('duration("1s") <= 1000')).toBe(true);
    expect(ev('duration("1d") > "soon"')).toBe(false);
    expect(ev('duration("1d") > true')).toBe(false);
  });

  it("tags compare as their text", () => {
    const { entries } = resolveBasesEntries(
      { formulas: { a: 'file.tags[0] == "#x"', b: 'file.tags[0] != "#x"' } },
      [
        {
          slug: "n",
          filePath: "n.md",
          relativePath: "n.md",
          frontmatter: { tags: ["x"] },
        } as unknown as QuartzPluginData,
      ],
    );
    expect(entries[0]?.formulaValues).toMatchObject({ a: true, b: false });
  });
});

describe("arithmetic", () => {
  it("negates a property, and an empty or text value is empty", () => {
    expect(ev("-n", { n: 5 })).toBe(-5);
    expect(ev("-n + 1", { n: "2" })).toBe(-1);
    expect(ev("-missing")).toBeUndefined();
    expect(ev('-"abc"')).toBeUndefined();
    expect(ev("!n", { n: 0 })).toBe(true);
  });

  it("an operation with an empty value is empty", () => {
    for (const op of ["-", "*", "/", "%"]) expect(ev(`missing ${op} 2`)).toBeUndefined();
    expect(ev("missing + 2")).toBeUndefined();
    expect(ev("7 % 4")).toBe(3);
    expect(ev("7 / 2")).toBe(3.5);
    expect(ev("3 * n", { n: "2" })).toBe(6);
  });

  it("a date minus a date string, and a date string minus a date, is a duration", () => {
    const d = { d: new Date(2024, 2, 5) };
    expect(String(ev('d - "2024-03-01"', d))).toBe("4 days");
    expect(String(ev('"2024-03-09" - d', d))).toBe("4 days");
  });

  it("a duration plus a date is a date, and text joins a duration or a date", () => {
    expect(String(ev('duration("1d") + date("2024-03-05")'))).toBe("2024-03-06");
    expect(ev('"in " + duration("2d")')).toBe("in 2 days");
    expect(ev('duration("2d") + " left"')).toBe("2 days left");
    expect(ev('"on " + date("2024-03-05")')).toBe("on 2024-03-05");
  });

  it("names both types when an operator doesn't apply", () => {
    // Obsidian 1.15.1: "Invalid operator between Date and Number"
    expect(error('date("2024-03-05") + 1')).toBe("Invalid operator between Date and Number");
    expect(error('duration("1d") - "x"')).toBe("Invalid operator between Duration and String");
    expect(error('5 - duration("1d")')).toBe("Invalid operator between Number and Duration");
    expect(error('"x" - date("2024-03-05")')).toBe("Invalid operator between String and Date");
    expect(error('duration("1d") * "2"')).toBe("Invalid operator between Duration and String");
    expect(error('[1] - date("2024-03-05")')).toBe("Invalid operator between List and Date");
    expect(error('true - duration("1d")')).toBe("Invalid operator between Boolean and Duration");
    expect(error('missing - duration("1d")')).toBe("Invalid operator between Null and Duration");
    expect(error('date("2024-03-05") - x', { x: { a: 1 } })).toBe(
      "Invalid operator between Date and Object",
    );
  });

  it("scales a duration", () => {
    expect(String(ev('duration("1d") * 3'))).toBe("3 days");
    expect(String(ev('duration("4d") / 2'))).toBe("2 days");
  });
});

describe("logical operators", () => {
  it("|| is true when either side is", () => {
    expect(ev("a || b", { a: 0, b: 1 })).toBe(true);
    expect(ev("a || b", { a: 1, b: 0 })).toBe(true);
    expect(ev("a || b", { a: 0, b: 0 })).toBe(false);
    expect(ev("a && b", { a: 1, b: 0 })).toBe(false);
    expect(ev("a && b", { a: 1, b: 1 })).toBe(true);
  });
});

describe("property paths", () => {
  const formula = { f: 42, nested: { x: 1 } };
  const self = {
    file: { name: "Host", path: "Host.md", folder: "/", ext: "md" },
    note: { k: "v" },
    k: "v",
  };

  it("note., formula., this. and file. prefixes", () => {
    expect(ev("note.k", { k: "v" })).toBe("v");
    expect(ev("note.when", { when: "2024-03-05" })).toBeInstanceOf(Date);
    expect(ev("formula.f", {}, { formula })).toBe(42);
    expect(ev("formula.nested.x", {}, { formula })).toBe(1);
    expect(ev("this.k", {}, { self })).toBe("v");
    expect(ev("this.file.name", {}, { self })).toBe("Host");
    expect(ev("file.file.name")).toBe("n");
    expect(ev("file.folder")).toBe("f");
  });

  it("a list has a length, and no named members", () => {
    expect(ev("list.x", { list: ["a", "b"] })).toBeUndefined();
    expect(ev("list.length", { list: ["a", "b"] })).toBe(2);
  });

  it("text has a length and characters", () => {
    expect(ev("s.length", { s: "abc" })).toBe(3);
    expect(ev("s[1]", { s: "abc" })).toBe("b");
    expect(ev("s[1.7]", { s: "abc" })).toBe("b");
    expect(ev('s["x"]', { s: "abc" })).toBeUndefined();
    expect(ev("s[missing]", { s: "abc" })).toBeUndefined();
  });

  it("objects are indexed by key, lists by number", () => {
    expect(ev('o["a b"]', { o: { "a b": 1 } })).toBe(1);
    expect(ev("o[1]", { o: { 1: "one" } })).toBe("one");
    expect(ev("o[k]", { o: { a: 1 }, k: ["a"] })).toBeUndefined();
    expect(ev("l[1]", { l: [5, 6] })).toBe(6);
    expect(ev("l[missing]", { l: [5, 6] })).toBeUndefined();
    expect(ev("missing[0]")).toBeUndefined();
  });

  it("a record with a file's shape is its own .file; others are not", () => {
    const f = { path: "a.md", basename: "a", ext: "md", name: "a" };
    expect(ev("f.file.name", { f })).toBe("a");
    expect(ev("o.file", { o: { path: "a.md", basename: "a" } })).toBeUndefined();
    expect(ev("o.file", { o: { path: "a.md", ext: "md" } })).toBeUndefined();
    expect(ev("o.file", { o: { basename: "a", ext: "md" } })).toBeUndefined();
  });

  it("date fields", () => {
    const d = { d: new Date(2024, 2, 5, 14, 30, 15) };
    expect(ev("d.hour", d)).toBe(14);
    expect(ev("d.minute", d)).toBe(30);
    expect(ev("d.second", d)).toBe(15);
    expect(ev("d.nope", d)).toBeUndefined();
  });
});

describe("methods on empty values", () => {
  it("give null, except isEmpty() and isType('null')", () => {
    expect(ev("missing.lower()")).toBeUndefined();
    expect(ev("missing.isEmpty()")).toBe(true);
    expect(ev('missing.isType("null")')).toBe(true);
    expect(ev('missing.isType("string")')).toBe(false);
  });
});

describe("formula errors", () => {
  it("a formula using a failed formula shows the same error", () => {
    const { entries } = resolveBasesEntries(
      { formulas: { bad: 'date("2024-03-05") + 1', uses: "formula.bad + 1" } },
      [{ slug: "n", filePath: "n.md", relativePath: "n.md", frontmatter: {} } as never],
    );
    const uses = entries[0]?.formulaValues.uses;
    expect(uses).toBeInstanceOf(ErrorValue);
    expect((uses as ErrorValue).message).toBe("Invalid operator between Date and Number");
  });

  it("an unknown function and an unknown method are errors", () => {
    expect(error("nope(1)")).toBe('Cannot find function "nope"');
    expect(error('"x".nope()')).toBe('Cannot find function "nope" on type String');
  });
});

describe("lazy list methods", () => {
  it("only work on lists", () => {
    expect(ev("s.map(value)", { s: "abc" })).toBeUndefined();
    expect(ev("l.flatMap([value, value])", { l: [1, 2] })).toEqual([1, 1, 2, 2]);
    expect(ev("l.reduce(acc + value, 10)", { l: [1, 2] })).toBe(13);
    expect(ev("l.find(value > 1)", { l: [1, 2, 3] })).toBe(2);
    expect(ev("l.some(value > 2)", { l: [1, 2, 3] })).toBe(true);
    expect(ev("l.every(value > 2)", { l: [1, 2, 3] })).toBe(false);
  });
});
