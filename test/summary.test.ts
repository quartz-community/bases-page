import { describe, it, expect } from "vitest";
import { computeSummary } from "../src/components/shared/summary";
import { evaluate } from "../src/compiler";
import { Duration, ErrorValue, parseIsoDate } from "../src/compiler/values";

// Expected values: Obsidian 1.15.1 (e2e/repros/bases-custom-summaries, obsidian-bases-probe).
const pages = [80, 96, 64, 64, 111, null];
const ratings = [4, 3, 5, 2.5, 4, null];
const authors = ["Orwell", "Swift", "Orwell", "Swift", "Doyle", "Doyle"];
const date = (text: string) => parseIsoDate(text)!;
const finished = [
  date("2024-03-05"),
  date("2023-11-20"),
  date("2025-01-15"),
  null,
  date("2024-07-01"),
  null,
];

const custom = {
  "total pages": "values.reduce(acc + value, 0)",
  "first plus rest": "values.reduce(if(index == 0, value * 100, acc + value), 0)",
  "long books": "values.filter(value > 70).length",
  "raw mean": "values.mean()",
  broken: "values.nope()",
  sorted: "values.sort()",
};

describe("custom summaries", () => {
  it("evaluate the base's formula over the column's values", () => {
    expect(computeSummary([80, 96, 64, 64, 111], "total pages", custom)).toBe(415);
    expect(computeSummary(pages, "long books", custom)).toBe(3);
  });

  it("an empty value makes acc + value empty, as in Obsidian", () => {
    expect(computeSummary(pages, "total pages", custom)).toBeNull();
  });

  it("reduce's index is 0-based and acc starts at the initial value", () => {
    expect(computeSummary([4, 3, 5, 2.5, 4], "first plus rest", custom)).toBe(414.5);
  });

  it("numbers are not rounded, and mean() counts empty values", () => {
    expect(computeSummary(pages, "raw mean", custom)).toBeCloseTo(69.16666666666667, 12);
  });

  it("a failing formula is an error; an unknown or lowercase name is empty", () => {
    const error = computeSummary(pages, "broken", custom);
    expect(error).toBeInstanceOf(ErrorValue);
    expect((error as ErrorValue).message).toBe('Cannot find function "nope" on type List');
    expect(computeSummary(pages, "undefined name", custom)).toBeNull();
    expect(computeSummary(authors, "unique", custom)).toBeNull();
  });
});

describe("built-in summaries", () => {
  it.each([
    [pages, "Sum", 415],
    [ratings, "Average", 3.08],
    [[4, 3, 5, 2.5, 4], "Average", 3.7],
    [pages, "Median", 80],
    [ratings, "Stddev", 0.87],
    [pages, "Stddev", 18.35],
    [pages, "Min", 64],
    [ratings, "Max", 5],
    [pages, "Range", 47],
    [[true, false, true, false, true, null], "Checked", 3],
    [[true, false, true, false, true, null], "Unchecked", 2],
    [authors, "Unique", 3],
    [finished, "Unique", 5],
    [authors, "Filled", 6],
    [ratings, "Empty", 1],
  ])("%j %s is %j", (values, summary, expected) => {
    expect(computeSummary(values as unknown[], summary as string)).toBe(expected);
  });

  it("dates: Earliest and Latest with a time, Range as a duration", () => {
    expect(computeSummary(finished, "Earliest")).toBe("2023-11-20T00:00:00");
    expect(computeSummary(finished, "Latest")).toBe("2025-01-15T00:00:00");
    expect(computeSummary(finished, "Range")).toBeInstanceOf(Duration);
  });

  it("nothing to summarise is empty", () => {
    const none = [null, null];
    expect(computeSummary(none, "Sum")).toBeNull();
    expect(computeSummary(none, "Earliest")).toBeNull();
    expect(computeSummary(none, "Filled")).toBeNull();
    expect(computeSummary(authors, "Average")).toBeNull();
    expect(computeSummary(authors, "Max")).toBeNull();
  });
});

describe("index and reduce in formulas", () => {
  const ctx = { note: {}, file: {} as never, formula: {} };
  it("map and filter see index", () => {
    expect(evaluate("[10, 20].map(value + index)", ctx)).toEqual([10, 21]);
    expect(evaluate("[1, 2, 3].filter(index > 0)", ctx)).toEqual([2, 3]);
  });
  it("reduce", () => {
    expect(evaluate("[1, 2, 3].reduce(acc + value, 0)", ctx)).toBe(6);
    expect(evaluate('["a", "b"].reduce(acc + value, "")', ctx)).toBe("ab");
  });
  it("outside a lambda, index and acc are note properties", () => {
    expect(evaluate("index", { ...ctx, note: { index: 7 } })).toBe(7);
  });
});
