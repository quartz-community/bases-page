import { describe, it, expect } from "vitest";
import { render } from "preact-render-to-string";
import { h, Fragment } from "preact";
import { evaluate, ErrorValue } from "../src/compiler";
import type { EvalContext } from "../src/compiler";
import { renderCellValue } from "../src/components/shared/cell";

// Expected values come from Obsidian 1.15.0 (obsidian-bases-probe vault q5-dates, runs with the
// app in en / en-GB / de / zh; bases-page#8).
const base: EvalContext = {
  note: { d_iso: "2024-03-05", dt: "2024-03-05T14:30:00", s_dmy: "05/03/2024" },
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
const ev = (expression: string, locale = "en-US") => evaluate(expression, { ...base, locale });
const shown = (value: unknown, locale = "en-US", column?: string) =>
  render(
    h(
      Fragment,
      null,
      renderCellValue(
        value,
        { slug: "x", allSlugs: [], linkResolution: "shortest", locale },
        column,
      ),
    ),
  ).replace(/<[^>]+>/g, "");

describe("date() parsing (bases-page#8)", () => {
  it("accepts ISO-style dates and compact YYYYMMDD, in local time", () => {
    const accepted: Record<string, string> = {
      "2024-03-05": "2024-03-05",
      "2024-03-05 14:30": "2024-03-05T14:30:00",
      "2024-03-05 14:30:15": "2024-03-05T14:30:15",
      "2024-03-05T14:30": "2024-03-05T14:30:00",
      "2024-03-05T14:30:00.250": "2024-03-05T14:30:00",
      "2024-03-05T14:30:00Z": "2024-03-05T15:30:00",
      "2024-03-05T14:30:00+05:00": "2024-03-05T10:30:00",
      "20240305": "2024-03-05",
      "2024-02-30": "2024-03-01",
    };
    for (const [input, expected] of Object.entries(accepted)) {
      expect(String(ev(`date("${input}")`)), input).toBe(expected);
    }
    expect(String(ev('date(date("2024-03-05"))'))).toBe("2024-03-05");
  });

  it("returns null for everything else, whatever the locale", () => {
    for (const input of [
      "05/03/2024",
      "03/05/2024",
      "5 March 2024",
      "March 5, 2024",
      "05.03.2024",
      "2024/03/05",
      "2024年3月5日",
      "2024-03",
      "2024",
      "2024-W10-2",
      "2024-065",
      "2024-03-05T14",
      "2024-03-05t14:30",
      " 2024-03-05",
      "not a date",
    ]) {
      expect(ev(`date("${input}")`, "de-DE"), input).toBeUndefined();
    }
    expect(ev("date(1709596800000)")).toEqual(
      new ErrorValue('Type error in "date", parameter "input". Expected String, given Number.'),
    );
    // ordering against null is null, as in Obsidian
    expect(ev('date(s_dmy) > date("2024-01-01")')).toBeUndefined();
  });

  it("date properties are dates: fields, methods and comparisons", () => {
    expect(ev("dt.year")).toBe(2024);
    expect(ev("dt.month")).toBe(3);
    expect(ev("dt.day")).toBe(5);
    expect(ev("dt.hour")).toBe(14);
    expect(ev("dt.minute")).toBe(30);
    expect(ev("dt.time()")).toBe("14:30:00");
    expect(String(ev("dt.date()"))).toBe("2024-03-05");
    expect(ev('d_iso > "2024-01-01"')).toBe(true);
    expect(ev('d_iso > date("2024-01-01")')).toBe(true);
    expect(ev('"x" + d_iso')).toBe("x2024-03-05");
    expect(ev("d_iso.toString()")).toBe("2024-03-05");
  });
});

describe("date display and format() in the site's locale", () => {
  it("shows dates as moment L and datetimes as L LT", () => {
    const d = ev('date("2024-03-05")');
    const dt = ev('date("2024-03-05 14:30:15")');
    expect(shown(d, "en-US")).toBe("03/05/2024");
    expect(shown(dt, "en-US")).toBe("03/05/2024 2:30 PM");
    expect(shown(d, "en-GB")).toBe("05/03/2024");
    expect(shown(dt, "en-GB")).toBe("05/03/2024 14:30");
    expect(shown(d, "de-DE")).toBe("05.03.2024");
    expect(shown(dt, "de-DE")).toBe("05.03.2024 14:30");
    expect(shown(d, "zh-CN")).toBe("2024/03/05");
    expect(shown(dt, "zh-CN")).toBe("2024/03/05 14:30");
    // a raw property holding an ISO date displays as a date too
    expect(shown("2024-03-05", "de-DE", "note.d")).toBe("05.03.2024");
    expect(shown("2024-03-05", "de-DE", "d")).toBe("05.03.2024");
    // text from a formula, and a daily note's file name, stay text
    expect(shown("2024-03-05", "de-DE", "formula.f_iso")).toBe("2024-03-05");
    expect(shown("2024-03-05", "de-DE", "file.name")).toBe("2024-03-05");
  });

  it("format() uses the locale's month and day names", () => {
    expect(ev('d_iso.format("DD MMMM YYYY")', "en-US")).toBe("05 March 2024");
    expect(ev('d_iso.format("DD MMMM YYYY")', "de-DE")).toBe("05 März 2024");
    expect(ev('d_iso.format("LL")', "en-US")).toBe("March 5, 2024");
    expect(ev('d_iso.format("LL")', "de-DE")).toBe("5. März 2024");
    expect(ev('d_iso.format("LL")', "zh-CN")).toBe("2024年3月5日");
    expect(ev('d_iso.format("dddd")', "en-US")).toBe("Tuesday");
    expect(ev('d_iso.format("dddd")', "de-DE")).toBe("Dienstag");
    expect(ev('d_iso.format("dddd")', "zh-CN")).toBe("星期二");
    expect(ev('d_iso.format("YYYY-MM-DD")', "zh-CN")).toBe("2024-03-05");
    expect(ev('dt.format("[at] HH:mm")')).toBe("at 14:30");
  });

  it("relative() is moment's fromNow in the locale", () => {
    expect(ev('date("2020-01-01").relative()', "en-US")).toMatch(/^\d+ years ago$/);
    expect(ev('date("2020-01-01").relative()', "de-DE")).toMatch(/^vor \d+ Jahren$/);
    expect(ev('(today() + "2d").relative()', "en-US")).toMatch(/^in (2 days|a day)$/);
  });
});
