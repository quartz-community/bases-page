import { describe, it, expect } from "vitest";
import { evaluate, Duration, ErrorValue } from "../src/compiler";
import type { EvalContext } from "../src/compiler";
import { resolveBasesEntries } from "../src/resolver";
import type { QuartzPluginData } from "../src/types";

// Expected values come from Obsidian 1.15.0 (dev-mode obsidian-bases-probe, vault q1-durations).
const context: EvalContext = {
  note: { due: "2024-03-05", dt: "2024-03-05T14:30:00", dtext: "2024-03-05" },
  file: {
    name: "probe",
    basename: "probe",
    path: "probe.md",
    folder: "",
    ext: "md",
    tags: [],
    links: [],
  },
  formula: {},
};

const ev = (expression: string) => evaluate(expression, context);
const str = (expression: string) => String(ev(expression));
const A = 'date("2024-03-10 12:30:00")';
const B = 'date("2024-03-01")';

describe("durations", () => {
  it("date - date is a Duration, shown humanized and unsigned", () => {
    expect(ev('date("2024-03-10") - date("2024-03-01")')).toBeInstanceOf(Duration);
    expect(str('date("2024-03-10") - date("2024-03-01")')).toBe("9 days");
    expect(str(`${A} - ${B}`)).toBe("10 days");
    expect(str(`${B} - ${A}`)).toBe("10 days");
    expect(str('date("2024-03-02 12:00:00") - date("2024-03-01")')).toBe("2 days");
    expect(str('date("2024-03-01 01:00:00") - date("2024-03-01")')).toBe("an hour");
    expect(str('date("2024-03-01 00:01:30") - date("2024-03-01")')).toBe("2 minutes");
    expect(str('date("2024-03-01") - date("2024-03-01")')).toBe("a few seconds");
    expect(str('date("2024-03-30") - date("2024-03-01")')).toBe("a month");
    expect(str('date("2025-02-04") - date("2024-01-01")')).toBe("a year");
    expect(str('duration("1d")')).toBe("a day");
    expect(str('duration("1 week")')).toBe("7 days");
    expect(str('duration("90m")')).toBe("2 hours");
    expect(str('duration("25h")')).toBe("a day");
    expect(str('duration("10 years")')).toBe("10 years");
    expect(str('duration("1d") - duration("12h")')).toBe("2 days");
  });

  it("unit fields are fractional and keep the sign", () => {
    // A - B = 822 600 000 ms; no DST change between the two dates
    expect(ev(`(${A} - ${B}).days`)).toBe(9.520833333333334);
    expect(ev(`(${B} - ${A}).days`)).toBe(-9.520833333333334);
    expect(ev(`(${A} - ${B}).hours`)).toBeCloseTo(228.5, 9);
    expect(ev(`(${A} - ${B}).minutes`)).toBeCloseTo(13710, 9);
    expect(ev(`(${A} - ${B}).seconds`)).toBeCloseTo(822600, 6);
    expect(ev(`(${A} - ${B}).milliseconds`)).toBeCloseTo(822600000, 3);
    expect(ev(`(${A} - ${B}).weeks`)).toBeCloseTo(1.3601190476190477, 12);
    expect(ev(`(${A} - ${B}).days.round(0)`)).toBe(10);
    expect(ev(`(${B} - ${A}).days.round(0)`)).toBe(-10);
    expect(ev(`(${B} - ${A}).days.floor()`)).toBe(-10);
    expect(ev('(date("2024-03-01") - date("2024-03-03 12:00:00")).days.round()')).toBe(-2);
  });

  it("parsed durations: months and years are calendar units", () => {
    expect(ev('duration("1M").months')).toBe(1);
    expect(ev('duration("1y").years')).toBe(1);
    expect(ev('duration("1y").months')).toBe(12);
    expect(ev('duration("36h").days')).toBe(1.5);
    expect(ev('duration("90m").hours')).toBe(1.5);
    expect(ev('duration("1w").days')).toBe(7);
    expect(ev(`(${A} - ${B}).months`)).toBeGreaterThan(0.3);
    expect(ev(`(${A} - ${B}).months`)).toBeLessThan(0.32);
  });

  it("parses one whole number with one unit, else null", () => {
    for (const ok of ["1d", "-1d", "1 day", "2 weeks", "1 hours", "90 seconds", "1 month", "1s"]) {
      expect(ev(`duration("${ok}")`), ok).toBeInstanceOf(Duration);
    }
    for (const bad of ["1y 2M", "abc", "1.5h", "1mo", "1Y", "1D", "1H", "1ms", " 1d", "1d "]) {
      expect(ev(`duration("${bad}")`), bad).toBeUndefined();
    }
    expect(ev("duration(1000)")).toEqual(
      new ErrorValue('Type error in "duration", parameter "input". Expected String, given Number.'),
    );
  });

  it("multiplies and divides with the duration on the left; errors otherwise", () => {
    expect(str('duration("1 week") / 2')).toBe("4 days");
    expect(ev('(duration("1 week") / 2).days')).toBe(3.5);
    expect(str('duration("5h") * 2')).toBe("10 hours");
    expect(str('duration("1d") * 1.5')).toBe("2 days");
    expect(str(`(${A} - ${B}) * 2`)).toBe("19 days");
    expect(ev(`(${A} - ${B}) / 86400000`)).toBeInstanceOf(Duration);
    expect(ev('2 * duration("5h")')).toEqual(
      new ErrorValue("Invalid operator between Number and Duration"),
    );
    expect(ev(`((${A} - ${B}) / 86400000).round()`)).toEqual(
      new ErrorValue('Cannot find function "round" on type Duration'),
    );
    expect(ev(`(${B} - ${A}).abs()`)).toEqual(
      new ErrorValue('Cannot find function "abs" on type Duration'),
    );
    expect(ev(`number(${A} - ${B})`)).toEqual(
      new ErrorValue('Unable to convert "Duration" to a number.'),
    );
    expect(ev('duration("1d") - 3600000')).toEqual(
      new ErrorValue("Invalid operator between Duration and Number"),
    );
    expect(ev('-duration("1d")')).toEqual(new ErrorValue("Unable to negate a day"));
    expect(ev(`(${A} - ${B}).milliseconds / 86400000`)).toBeCloseTo(9.520833333333334, 12);
  });

  it("adds durations and duration strings to dates", () => {
    const iso = (expression: string) => String(ev(expression));
    expect(iso('date("2024-03-01") + "1d"')).toBe("2024-03-02");
    expect(iso('date("2024-03-01") + "1 day"')).toBe("2024-03-02");
    expect(iso('date("2024-03-01 10:00:00") - "2h"')).toBe("2024-03-01T08:00:00");
    expect(iso('date("2024-03-01") + duration("1 week")')).toBe("2024-03-08");
    expect(iso('date("2024-03-01") - duration("1M")')).toBe("2024-02-01");
    expect(iso('date("2024-12-01") + "1M" + "4h" + "3m"')).toBe("2025-01-01T04:03:00");
    expect(iso('date("2024-01-31") + "1M"')).toBe("2024-03-02");
    expect(iso('date("2024-02-29") + "1y"')).toBe("2025-03-01");
    expect(iso('date("2024-03-01") + "-1d"')).toBe("2024-02-29");
    expect(iso('date("2024-03-01") + "90 seconds"')).toBe("2024-03-01T00:01:30");
    expect(iso(`date("2024-03-01") + (${A} - ${B})`)).toBe("2024-03-10T12:30:00");
    expect(ev('date("2024-03-01") + "1d 2h"')).toBe("2024-03-011d 2h");
    expect(ev('duration("1d") + "12h"')).toBe("a day12h");
    expect(ev(`"x" + (${A} - ${B})`)).toBe("x10 days");
    expect(ev('date("2024-03-01") + 1')).toEqual(
      new ErrorValue("Invalid operator between Date and Number"),
    );
    expect(ev(`${A} - 86400000`)).toEqual(
      new ErrorValue("Invalid operator between Date and Number"),
    );
    expect(ev('(duration("1d") + duration("12h")).days')).toBe(1.5);
  });

  it("compares durations with durations, duration strings and milliseconds", () => {
    expect(ev(`(${A} - ${B}) > duration("1 week")`)).toBe(true);
    expect(ev(`(${B} - ${A}) < duration("0d")`)).toBe(true);
    expect(ev(`(${A} - ${B}) > "1w"`)).toBe(true);
    expect(ev(`(${A} - ${B}) > 86400000`)).toBe(true);
    expect(ev('date("2024-03-10") - date("2024-03-01") == duration("9d")')).toBe(true);
    expect(ev(`(${A} - ${B}) == "9d"`)).toBe(false);
    expect(ev('duration("1d") == 86400000')).toBe(false);
    expect(ev(`(${A} - ${B}).isType("duration")`)).toBe(true);
    expect(ev(`(${A} - ${B}).isType("number")`)).toBe(false);
  });

  it("date properties work in date arithmetic", () => {
    expect(ev("today() - due")).toBeInstanceOf(Duration);
    expect(ev("today() - dtext")).toBeInstanceOf(Duration);
    expect(String(ev('due - "1d"'))).toBe("2024-03-04");
    expect(ev("(dt - due).hours")).toBeCloseTo(14.5, 9);
  });

  it("date() reads date-only strings and datetimes both as local time", () => {
    // was UTC midnight vs local time, one hour short in Europe/Amsterdam
    expect(ev(`(${A} - ${B}).milliseconds`)).toBeCloseTo(822_600_000, 3);
    const d = ev('date("2024-03-05")') as Date;
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2024, 2, 5, 0]);
  });

  it("a formula error stays an error in the formulas using it, and fails filters", () => {
    const files = [
      {
        slug: "probe",
        filePath: "probe.md",
        relativePath: "probe.md",
        frontmatter: {},
      } as unknown as QuartzPluginData,
    ];
    const { entries } = resolveBasesEntries(
      { formulas: { bad: '2 * duration("1d")', uses: "formula.bad" } },
      files,
    );
    expect(entries[0]?.formulaValues.bad).toBeInstanceOf(ErrorValue);
    expect(entries[0]?.formulaValues.uses).toBeInstanceOf(ErrorValue);
    expect(resolveBasesEntries({ filters: '2 * duration("1d")' }, files).entries).toEqual([]);
  });
});
