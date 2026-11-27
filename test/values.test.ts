import { describe, it, expect } from "vitest";
import {
  BasesDate,
  Duration,
  coerceDateString,
  dateHasTime,
  formatMoment,
  humanizeDuration,
  parseIsoDate,
  relativeFromNow,
  TagValue,
} from "../src/compiler/values";

// Expected values are moment 2.31's (the library Obsidian formats and humanizes with), recorded in
// Europe/Amsterdam (vitest.config.ts sets TZ).

describe("formatMoment", () => {
  const d = new Date(2024, 2, 5, 14, 7, 9, 45); // Tue 5 March 2024, 14:07:09.045 CET
  it.each([
    ["YYYY", "2024"],
    ["YY", "24"],
    ["MMMM", "March"],
    ["MMM", "Mar"],
    ["MM", "03"],
    ["Mo", "3rd"],
    ["M", "3"],
    ["Do", "5th"],
    ["DD", "05"],
    ["D", "5"],
    ["dddd", "Tuesday"],
    ["ddd", "Tue"],
    ["d", "2"],
    ["HH", "14"],
    ["H", "14"],
    ["hh", "02"],
    ["h", "2"],
    ["mm", "07"],
    ["m", "7"],
    ["ss", "09"],
    ["s", "9"],
    ["SSS", "045"],
    ["A", "PM"],
    ["a", "pm"],
    ["ZZ", "+0100"],
    ["Z", "+01:00"],
    ["X", "1709644029"],
    ["x", "1709644029045"],
    ["L", "03/05/2024"],
    ["LT", "2:07 PM"],
    ["LTS", "2:07:09 PM"],
    ["LL", "March 5, 2024"],
    ["LLL", "March 5, 2024 2:07 PM"],
    ["LLLL", "Tuesday, March 5, 2024 2:07 PM"],
    ["[at] HH:mm", "at 14:07"],
    ["YYYY-MM-DDTHH:mm:ssZ", "2024-03-05T14:07:09+01:00"],
  ])("%s → %s", (format, expected) => {
    expect(formatMoment(d, format)).toBe(expected);
  });

  it("midnight is 12 AM; summer time has its own offset", () => {
    const midnight = new Date(2024, 0, 1, 0, 0, 0);
    expect(formatMoment(midnight, "hh:mm A")).toBe("12:00 AM");
    expect(formatMoment(midnight, "h a")).toBe("12 am");
    expect(formatMoment(midnight, "DDDD")).toBe("001");
    expect(formatMoment(new Date(2024, 6, 11, 9, 5), "Z")).toBe("+02:00");
    expect(formatMoment(new Date(2024, 6, 11, 9, 5), "A")).toBe("AM");
  });

  it("ordinals: 1st 2nd 3rd 4th, 11th–13th, 21st 22nd 23rd; other languages write 5.", () => {
    const day = (n: number) => formatMoment(new Date(2024, 0, n), "Do");
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 31].map(day)).toEqual([
      "1st",
      "2nd",
      "3rd",
      "4th",
      "11th",
      "12th",
      "13th",
      "21st",
      "22nd",
      "23rd",
      "31st",
    ]);
    expect(formatMoment(new Date(2024, 0, 5), "Do", "de")).toBe("5.");
    expect(formatMoment(new Date(2024, 0, 5), "MMMM", "de")).toBe("Januar");
  });

  // moment: 065 on 5 March 2024, 365 on 31 December 1999 (the time of day doesn't count)
  it("DDDD is the day of the year, whatever the time", () => {
    expect(formatMoment(d, "DDDD")).toBe("065");
    expect(formatMoment(new Date(1999, 11, 31, 23, 59), "DDDD")).toBe("365");
  });

  // moment's dd is the two-letter weekday (Tu), not Intl's narrow one (T)
  it("dd is the two-letter weekday", () => {
    expect(formatMoment(d, "dd")).toBe("Tu");
    expect(formatMoment(d, "dd", "de")).toBe("Di");
    expect(formatMoment(d, "DDD")).toBe("65");
  });
});

describe("humanizeDuration (moment's humanize thresholds)", () => {
  const S = 1000;
  const MIN = 60 * S;
  const H = 60 * MIN;
  const D = 24 * H;
  it.each([
    [0, "a few seconds"],
    [44 * S, "a few seconds"],
    [45 * S, "a minute"],
    [89 * S, "a minute"],
    [90 * S, "2 minutes"],
    [44 * MIN, "44 minutes"],
    [45 * MIN, "an hour"],
    [89 * MIN, "an hour"],
    [90 * MIN, "2 hours"],
    [21 * H, "21 hours"],
    [22 * H, "a day"],
    [35 * H, "a day"],
    [36 * H, "2 days"],
    [25 * D, "25 days"],
    [26 * D, "a month"],
    [45 * D, "a month"],
    [46 * D, "2 months"],
    [319 * D, "10 months"],
    [320 * D, "a year"],
    [547 * D, "a year"],
    [548 * D, "2 years"],
  ])("%d ms → %s, either sign", (ms, expected) => {
    expect(humanizeDuration(Duration.fromMilliseconds(ms))).toBe(expected);
    expect(humanizeDuration(Duration.fromMilliseconds(-ms))).toBe(expected);
  });

  it("calendar months and days", () => {
    expect(humanizeDuration(new Duration({ months: 1 }))).toBe("a month");
    expect(humanizeDuration(new Duration({ months: 11 }))).toBe("a year");
    expect(humanizeDuration(new Duration({ months: 13 }))).toBe("a year");
    expect(humanizeDuration(new Duration({ days: 7 }))).toBe("7 days");
    expect(humanizeDuration(new Duration({ days: 30 }))).toBe("a month");
  });

  it("in the site's language", () => {
    expect(humanizeDuration(Duration.fromMilliseconds(3 * D), "de")).toBe("3 Tage");
    expect(humanizeDuration(Duration.fromMilliseconds(3 * D), "fr-FR")).toMatch(/^3\sjours$/);
    expect(humanizeDuration(Duration.fromMilliseconds(3 * D), "en-GB")).toBe("3 days");
  });
});

describe("relativeFromNow", () => {
  const now = new Date(2024, 2, 5, 12, 0, 0);
  const at = (ms: number) => new Date(now.getTime() + ms);
  const D = 86_400_000;

  it("ago and in, in English and in the site's language", () => {
    expect(relativeFromNow(at(-3 * D), "en", now)).toBe("3 days ago");
    expect(relativeFromNow(at(3 * D), "en", now)).toBe("in 3 days");
    expect(relativeFromNow(at(-5000), "en", now)).toBe("a few seconds ago");
    expect(relativeFromNow(at(0), "en", now)).toBe("a few seconds ago");
    expect(relativeFromNow(at(-3 * D), "de", now)).toBe("vor 3 Tagen");
    expect(relativeFromNow(at(3 * D), "de", now)).toBe("in 3 Tagen");
    expect(relativeFromNow(at(-3 * D), "nl", now)).toBe("3 dagen geleden");
  });

  // moment's fromNow() (Obsidian's date.relative()) counts the calendar months between the two
  // dates: 46 days ago is "a month ago", 320 days ahead "in 10 months"
  it("counts calendar months, as moment's fromNow() does", () => {
    expect(relativeFromNow(at(-46 * D), "en", now)).toBe("a month ago");
    expect(relativeFromNow(at(320 * D), "en", now)).toBe("in 10 months");
  });
});

describe("parseIsoDate", () => {
  it("reads dates, datetimes and zones", () => {
    expect(parseIsoDate("2024-03-05T14:30:00+05:30")?.toISOString()).toBe(
      "2024-03-05T09:00:00.000Z",
    );
    expect(parseIsoDate("2024-03-05T14:30:00-0300")?.toISOString()).toBe(
      "2024-03-05T17:30:00.000Z",
    );
    expect(parseIsoDate("2024-03-05T14:30Z")?.toISOString()).toBe("2024-03-05T14:30:00.000Z");
    expect(parseIsoDate("2024-03-05 14:30:15.5")?.toISOString()).toBe("2024-03-05T13:30:15.500Z");
    expect(parseIsoDate("20240305")?.toISOString()).toBe("2024-03-04T23:00:00.000Z");
    expect(parseIsoDate("0099-01-01")?.getFullYear()).toBe(99);
  });

  it("knows whether it has a time", () => {
    expect(parseIsoDate("2024-03-05")?.hasTime).toBe(false);
    expect(parseIsoDate("2024-03-05 00:00")?.hasTime).toBe(true);
  });

  it("rejects months, days and times out of range", () => {
    for (const s of ["2024-13-01", "2024-00-10", "2024-01-00", "2024-01-32", "2024-03-05T24:00"])
      expect(parseIsoDate(s)).toBeUndefined();
    expect(parseIsoDate("2024-03-05T23:60")).toBeUndefined();
    expect(parseIsoDate("2024-03-05T23:59:60")).toBeUndefined();
    expect(parseIsoDate("2024-03-05T23:59:59")).toBeDefined();
  });

  it("rolls over a day the month doesn't have, as Obsidian does (2024-02-31 is 2 March)", () => {
    expect(String(parseIsoDate("2024-02-31"))).toBe("2024-03-02");
  });
});

describe("coerceDateString", () => {
  it("turns ISO-dated strings into dates, and leaves other values alone", () => {
    expect(coerceDateString("2024-03-05")).toBeInstanceOf(Date);
    expect(coerceDateString("2024-03-05T14:30:00.000+01:00")).toBeInstanceOf(Date);
    expect(coerceDateString("2024-03-05 is a date")).toBe("2024-03-05 is a date");
    expect(coerceDateString("2024-3-5")).toBe("2024-3-5");
    expect(coerceDateString("x2024-03-05")).toBe("x2024-03-05");
    expect(coerceDateString("2024-03-05T14:30:00.000+01:00 and then")).toBe(
      "2024-03-05T14:30:00.000+01:00 and then",
    );
    expect(coerceDateString(20240305)).toBe(20240305);
  });
});

describe("dateHasTime", () => {
  it("a plain Date has a time unless it is midnight", () => {
    expect(dateHasTime(new Date(2024, 2, 5))).toBe(false);
    expect(dateHasTime(new Date(2024, 2, 5, 1))).toBe(true);
    expect(dateHasTime(new Date(2024, 2, 5, 0, 1))).toBe(true);
    expect(dateHasTime(new Date(2024, 2, 5, 0, 0, 1))).toBe(true);
    expect(dateHasTime(new Date(2024, 2, 5, 0, 0, 0, 1))).toBe(true);
    expect(dateHasTime(new BasesDate(new Date(2024, 2, 5, 14), false))).toBe(false);
    expect(dateHasTime(new BasesDate(new Date(2024, 2, 5), true))).toBe(true);
  });
});

describe("Duration arithmetic", () => {
  it("adds, subtracts and scales each part", () => {
    const a = new Duration({ months: 1, days: 2, ms: 3 });
    const b = new Duration({ months: 4, days: 5, ms: 6 });
    expect(a.plus(b)).toMatchObject({ months: 5, days: 7, ms: 9 });
    expect(a.plus(b, -1)).toMatchObject({ months: -3, days: -3, ms: -3 });
    expect(a.scale(2)).toMatchObject({ months: 2, days: 4, ms: 6 });
  });

  it("adds calendar months and days to a date, then time; fractions as 30-day months and days", () => {
    const jan31 = new Date(2024, 0, 31, 10);
    expect(new Duration({ months: 1 }).addTo(jan31).toString()).toBe(
      new Date(2024, 2, 2, 10).toString(),
    );
    expect(new Duration({ months: -1 }).addTo(new Date(2024, 2, 5)).getMonth()).toBe(1);
    expect(new Duration({ days: 1 }).addTo(jan31, -1).getDate()).toBe(30);
    expect(new Duration({ days: 1.5 }).addTo(jan31).getTime()).toBe(
      new Date(2024, 1, 1, 22).getTime(),
    );
    expect(new Duration({ months: 0.5 }).addTo(new Date(2024, 0, 1)).getTime()).toBe(
      new Date(2024, 0, 16).getTime(),
    );
    expect(new Duration({ ms: 3_600_000 }).addTo(jan31).getHours()).toBe(11);
  });

  it("totalMilliseconds counts calendar months from the given date", () => {
    expect(new Duration({ ms: 5 }).totalMilliseconds()).toBe(5);
    expect(new Duration({ months: 1 }).totalMilliseconds(new Date(2024, 1, 1))).toBe(
      29 * 86_400_000,
    );
    expect(new Duration({ days: 2, ms: 1 }).totalMilliseconds(new Date(2024, 1, 1))).toBe(
      2 * 86_400_000 + 1,
    );
  });

  it("fields: a duration of days has no whole months; one of months has", () => {
    expect(new Duration({ days: 14 }).fields.weeks).toBe(2);
    expect(new Duration({ days: 14 }).fields.hours).toBe(336);
    expect(new Duration({ months: 24 }).fields.years).toBe(2);
    expect(Duration.fromMilliseconds(86_400_000 * 3).fields.days).toBe(3);
  });
});

describe("TagValue", () => {
  it("its name drops only a leading #", () => {
    expect(new TagValue("#a#b").name).toBe("a#b");
    expect(`${new TagValue("#x")}`).toBe("#x");
  });
});
