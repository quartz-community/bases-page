/**
 * Value types of Obsidian's Bases formula language that have no plain JavaScript
 * equivalent: durations, dates that know whether they carry a time, and formula
 * errors. Their behaviour follows real Obsidian (1.15.0), as recorded with
 * dev-mode's `obsidian-bases-probe`.
 */

/** A formula error, shown in the cell instead of a value (as Obsidian does). */
export class FormulaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FormulaError";
  }
}

/** The result of a formula that failed: carries the message Obsidian would show. */
export class ErrorValue {
  constructor(public readonly message: string) {}
  toString(): string {
    return `Error: ${this.message}`;
  }
}

export function isErrorValue(value: unknown): value is ErrorValue {
  return value instanceof ErrorValue;
}

// ---------------------------------------------------------------------------- tags

/**
 * A tag in `file.tags` or the `tags` property: `#Src/OSE/cc`, with `#` and its original case.
 * It behaves as a string (`toString()`, string methods, `isType("string")`), and lists of tags
 * match nested tags in `contains()`.
 */
export class TagValue {
  constructor(public readonly tag: string) {}
  /** The tag without `#`, as Obsidian displays it */
  get name(): string {
    return this.tag.replace(/^#/, "");
  }
  toString(): string {
    return this.tag;
  }
  valueOf(): string {
    return this.tag;
  }
}

export function isTagValue(value: unknown): value is TagValue {
  return value instanceof TagValue;
}

// ---------------------------------------------------------------------------- dates

/**
 * A date value. Like Obsidian's DateValue it knows whether it has a time: `date("2024-03-05")`
 * and `today()` are dates, `date("2024-03-05 14:30")` and `now()` are datetimes. It is a real
 * `Date` (local time), so code that handles dates keeps working.
 */
export class BasesDate extends Date {
  public readonly hasTime: boolean;
  constructor(time: number | Date, hasTime: boolean) {
    super(typeof time === "number" ? time : time.getTime());
    this.hasTime = hasTime;
  }
  /** As in Obsidian: `2024-03-05` for a date, `2024-03-05T14:30:00` for a datetime (local). */
  override toString(): string {
    return dateToString(this, this.hasTime);
  }
}

export function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

export function dateHasTime(value: Date): boolean {
  if (value instanceof BasesDate) return value.hasTime;
  return (
    value.getHours() !== 0 ||
    value.getMinutes() !== 0 ||
    value.getSeconds() !== 0 ||
    value.getMilliseconds() !== 0
  );
}

const pad = (n: number, len = 2) => String(Math.trunc(n)).padStart(len, "0");

export function dateToString(date: Date, hasTime = dateHasTime(date)): string {
  const day = `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  if (!hasTime) return day;
  return `${day}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// ISO-style dates, as Obsidian's date() accepts them: `YYYY-MM-DD`, an optional time
// (` ` or `T`, `HH:mm`, `:ss`, `.SSS`) with an optional `Z` / `±hh:mm`, or compact `YYYYMMDD`.
const ISO_DATE_RE =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:?\d{2})?)?$/;
const COMPACT_DATE_RE = /^(\d{4})(\d{2})(\d{2})$/;

/**
 * Parses a date string the way Obsidian's `date()` does: date-only strings are local midnight,
 * datetimes are local unless they carry a zone. Returns undefined for anything else.
 */
export function parseIsoDate(input: string): BasesDate | undefined {
  const match = ISO_DATE_RE.exec(input) ?? COMPACT_DATE_RE.exec(input);
  if (!match) return undefined;
  const [, y, mo, d, h, mi, s, ms, zone] = match;
  const year = Number(y);
  const month = Number(mo) - 1;
  const day = Number(d);
  if (month < 0 || month > 11 || day < 1 || day > 31) return undefined;
  const hasTime = h !== undefined;
  const hours = Number(h ?? 0);
  const minutes = Number(mi ?? 0);
  const seconds = Number(s ?? 0);
  const millis = ms ? Number(ms.padEnd(3, "0")) : 0;
  if (hours > 23 || minutes > 59 || seconds > 59) return undefined;
  let time: number;
  if (zone) {
    let offset = 0;
    if (zone !== "Z") {
      const sign = zone.startsWith("-") ? -1 : 1;
      const digits = zone.slice(1).replace(":", "");
      offset = sign * (Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2)));
    }
    time = Date.UTC(year, month, day, hours, minutes, seconds, millis) - offset * 60_000;
  } else {
    const local = new Date(year, month, day, hours, minutes, seconds, millis);
    local.setFullYear(year); // years 0-99
    time = local.getTime();
  }
  return new BasesDate(time, hasTime);
}

/** Frontmatter strings that hold an ISO date are dates in Obsidian's formulas. */
export function coerceDateString(value: unknown): unknown {
  if (typeof value !== "string" || value.length < 10 || value.length > 29) return value;
  if (!/^\d{4}-\d{2}-\d{2}/.test(value)) return value;
  return parseIsoDate(value) ?? value;
}

// ---------------------------------------------------------------------------- durations

const MS = { second: 1000, minute: 60_000, hour: 3_600_000, day: 86_400_000 };

export interface DurationParts {
  /** calendar months (a year is 12) */
  months: number;
  /** calendar days (a week is 7) */
  days: number;
  /** hours, minutes, seconds and milliseconds */
  ms: number;
}

/**
 * Obsidian's DurationValue: the difference of two dates, or `duration("1 week")`.
 * Stored like a moment duration (months, days, milliseconds), each with its own sign.
 */
export class Duration {
  public readonly months: number;
  public readonly days: number;
  public readonly ms: number;

  constructor(parts: Partial<DurationParts>) {
    this.months = parts.months ?? 0;
    this.days = parts.days ?? 0;
    this.ms = parts.ms ?? 0;
  }

  static fromMilliseconds(ms: number): Duration {
    return new Duration({ ms });
  }

  scale(factor: number): Duration {
    return new Duration({
      months: this.months * factor,
      days: this.days * factor,
      ms: this.ms * factor,
    });
  }

  plus(other: Duration, sign = 1): Duration {
    return new Duration({
      months: this.months + sign * other.months,
      days: this.days + sign * other.days,
      ms: this.ms + sign * other.ms,
    });
  }

  /** The date this duration after `date` (JS calendar arithmetic, like Obsidian: Jan 31 + 1M = Mar 2). */
  addTo(date: Date, sign = 1): Date {
    const result = new Date(date.getTime());
    if (this.months) {
      const whole = Math.trunc(this.months);
      result.setMonth(result.getMonth() + sign * whole);
      const rest = this.months - whole;
      if (rest) result.setTime(result.getTime() + sign * rest * 30 * MS.day);
    }
    if (this.days) {
      const whole = Math.trunc(this.days);
      result.setDate(result.getDate() + sign * whole);
      const rest = this.days - whole;
      if (rest) result.setTime(result.getTime() + sign * rest * MS.day);
    }
    if (this.ms) result.setTime(result.getTime() + sign * this.ms);
    return result;
  }

  /** Elapsed milliseconds, with months and years counted from now as calendar months. */
  totalMilliseconds(now = new Date()): number {
    if (!this.months && !this.days) return this.ms;
    return this.addTo(now).getTime() - now.getTime();
  }

  get fields(): Record<string, number> {
    const now = new Date();
    const total = this.totalMilliseconds(now);
    // whole calendar days from now, without the DST hour of a local-time day count
    const days = this.months || this.days ? calendarDays(this, now) : total / MS.day;
    const months = this.ms === 0 && this.days === 0 ? this.months : monthDiff(this.addTo(now), now);
    return {
      days,
      weeks: days / 7,
      hours: days * 24,
      minutes: days * 1440,
      seconds: days * 86_400,
      milliseconds: days * MS.day,
      months,
      years: months / 12,
    };
  }

  /** As Obsidian shows a duration: moment's `humanize()` without a suffix, unsigned. */
  toString(): string {
    return humanizeDuration(this);
  }
}

export function isDuration(value: unknown): value is Duration {
  return value instanceof Duration;
}

function calendarDays(duration: Duration, now: Date): number {
  const start = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const months = Math.trunc(duration.months);
  const days = Math.trunc(duration.days);
  const shifted = new Duration({ months, days }).addTo(now);
  const end = Date.UTC(shifted.getFullYear(), shifted.getMonth(), shifted.getDate());
  const rest = (duration.months - months) * 30 + (duration.days - days);
  return (end - start) / MS.day + rest + duration.ms / MS.day;
}

// moment's monthDiff: fractional months between two dates
function addMonthsClamped(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const daysInMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, daysInMonth));
  return result;
}

export function monthDiff(a: Date, b: Date): number {
  if (a.getDate() < b.getDate()) return -monthDiff(b, a);
  const whole = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  const anchor = addMonthsClamped(a, whole);
  let adjust: number;
  if (b.getTime() - anchor.getTime() < 0) {
    const anchor2 = addMonthsClamped(a, whole - 1);
    adjust = (b.getTime() - anchor.getTime()) / (anchor.getTime() - anchor2.getTime());
  } else {
    const anchor2 = addMonthsClamped(a, whole + 1);
    adjust = (b.getTime() - anchor.getTime()) / (anchor2.getTime() - anchor.getTime());
  }
  return -(whole + adjust) || 0;
}

const DURATION_UNITS: Record<string, keyof DurationParts | "year" | "week"> = {
  y: "year",
  year: "year",
  years: "year",
  M: "months",
  month: "months",
  months: "months",
  w: "week",
  week: "week",
  weeks: "week",
  d: "days",
  day: "days",
  days: "days",
  h: "ms",
  hour: "ms",
  hours: "ms",
  m: "ms",
  minute: "ms",
  minutes: "ms",
  s: "ms",
  second: "ms",
  seconds: "ms",
};

const UNIT_MS: Record<string, number> = {
  h: MS.hour,
  hour: MS.hour,
  hours: MS.hour,
  m: MS.minute,
  minute: MS.minute,
  minutes: MS.minute,
  s: MS.second,
  second: MS.second,
  seconds: MS.second,
};

/**
 * Parses a duration string as Obsidian does: one whole number and one unit
 * (`1d`, `-1d`, `1 week`, `90 seconds`, `1M`), else undefined (`1.5h`, `1y 2M`, ` 1d`).
 */
export function parseDuration(input: string): Duration | undefined {
  const match = /^(-?\d+) ?([a-zA-Z]+)$/.exec(input);
  if (!match) return undefined;
  const amount = Number(match[1]);
  const unit = match[2] ?? "";
  const kind = DURATION_UNITS[unit];
  if (!kind) return undefined;
  switch (kind) {
    case "year":
      return new Duration({ months: amount * 12 });
    case "months":
      return new Duration({ months: amount });
    case "week":
      return new Duration({ days: amount * 7 });
    case "days":
      return new Duration({ days: amount });
    default:
      return new Duration({ ms: amount * (UNIT_MS[unit] ?? 0) });
  }
}

// moment's relativeTime thresholds and English strings
const DAYS_PER_MONTH = 146097 / 4800;

function humanizeUnits(duration: Duration): {
  s: number;
  m: number;
  h: number;
  d: number;
  M: number;
  y: number;
} {
  // moment's duration.abs() takes each component's absolute value
  const months = Math.abs(duration.months);
  const days = Math.abs(duration.days);
  const ms = Math.abs(duration.ms);
  const totalDays = days + months * DAYS_PER_MONTH + ms / MS.day;
  const totalMonths = months + (days + ms / MS.day) / DAYS_PER_MONTH;
  return {
    s: Math.round(totalDays * 86_400),
    m: Math.round(totalDays * 1440),
    h: Math.round(totalDays * 24),
    d: Math.round(totalDays),
    M: Math.round(totalMonths),
    y: Math.round(totalMonths / 12),
  };
}

type RelUnit = "s" | "ss" | "m" | "mm" | "h" | "hh" | "d" | "dd" | "M" | "MM" | "y" | "yy";

export function relativeUnit(duration: Duration): [RelUnit, number] {
  const { s, m, h, d, M, y } = humanizeUnits(duration);
  if (s <= 44) return ["s", s];
  if (s < 45) return ["ss", s];
  if (m <= 1) return ["m", 1];
  if (m < 45) return ["mm", m];
  if (h <= 1) return ["h", 1];
  if (h < 22) return ["hh", h];
  if (d <= 1) return ["d", 1];
  if (d < 26) return ["dd", d];
  if (M <= 1) return ["M", 1];
  if (M < 11) return ["MM", M];
  if (y <= 1) return ["y", 1];
  return ["yy", y];
}

const EN_RELATIVE: Record<RelUnit, string> = {
  s: "a few seconds",
  ss: "%d seconds",
  m: "a minute",
  mm: "%d minutes",
  h: "an hour",
  hh: "%d hours",
  d: "a day",
  dd: "%d days",
  M: "a month",
  MM: "%d months",
  y: "a year",
  yy: "%d years",
};

const INTL_UNIT: Record<RelUnit, Intl.RelativeTimeFormatUnit> = {
  s: "second",
  ss: "second",
  m: "minute",
  mm: "minute",
  h: "hour",
  hh: "hour",
  d: "day",
  dd: "day",
  M: "month",
  MM: "month",
  y: "year",
  yy: "year",
};

function isEnglish(locale: string): boolean {
  return locale.toLowerCase().startsWith("en");
}

/** moment's `humanize()` without suffix: `9 days`, `an hour`, `a few seconds`. */
export function humanizeDuration(duration: Duration, locale = "en"): string {
  const [unit, count] = relativeUnit(duration);
  if (isEnglish(locale)) return EN_RELATIVE[unit].replace("%d", String(count));
  try {
    return new Intl.NumberFormat(locale, {
      style: "unit",
      unit: INTL_UNIT[unit],
      unitDisplay: "long",
    }).format(unit === "s" ? count || 1 : count);
  } catch {
    return EN_RELATIVE[unit].replace("%d", String(count));
  }
}

/** moment's `fromNow()`: `3 years ago`, `in 2 days`. */
export function relativeFromNow(date: Date, locale = "en", now = new Date()): string {
  const diff = date.getTime() - now.getTime();
  const [unit, count] = relativeUnit(Duration.fromMilliseconds(diff));
  if (isEnglish(locale)) {
    const text = EN_RELATIVE[unit].replace("%d", String(count));
    return diff < 0 || (diff === 0 && unit === "s") ? `${text} ago` : `in ${text}`;
  }
  try {
    const sign = diff < 0 ? -1 : 1;
    return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
      sign * count,
      INTL_UNIT[unit],
    );
  } catch {
    const text = EN_RELATIVE[unit].replace("%d", String(count));
    return diff < 0 ? `${text} ago` : `in ${text}`;
  }
}

// ---------------------------------------------------------------------------- date display

function safeLocale(locale: string | undefined): string {
  if (!locale) return "en-US";
  try {
    return Intl.DateTimeFormat.supportedLocalesOf([locale]).length > 0 ? locale : "en-US";
  } catch {
    return "en-US";
  }
}

function intl(date: Date, locale: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(safeLocale(locale), options).format(date);
}

/** moment's `L` in the locale: `03/05/2024` (en-US), `05.03.2024` (de), `2024/03/05` (zh). */
export function formatDateShort(date: Date, locale = "en-US"): string {
  return intl(date, locale, { year: "numeric", month: "2-digit", day: "2-digit" });
}

/** moment's `LT`: `2:30 PM` (en-US), `14:30` (de). */
export function formatTimeShort(date: Date, locale = "en-US"): string {
  return intl(date, locale, { hour: "numeric", minute: "2-digit" });
}

/** How Obsidian shows a date value: `L` for a date, `L LT` for a datetime, in the site's locale. */
export function displayDate(date: Date, locale = "en-US"): string {
  const day = formatDateShort(date, locale);
  return dateHasTime(date) ? `${day} ${formatTimeShort(date, locale)}` : day;
}

const FORMAT_TOKEN_RE =
  /\[([^\]]*)\]|LLLL|LLL|LL|LTS|LT|L|YYYY|YY|MMMM|MMM|MM|Mo|M|Do|DDDD|DD|D|dddd|ddd|dd|d|HH|H|hh|h|mm|m|ss|s|SSS|A|a|ZZ|Z|X|x/g;

function ordinal(n: number, locale: string): string {
  if (!locale.toLowerCase().startsWith("en")) return `${n}.`;
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

function zoneOffset(date: Date, separator: string): string {
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  return `${sign}${pad(Math.floor(abs / 60))}${separator}${pad(abs % 60)}`;
}

/** moment's `format()` with the common tokens, month and day names in the site's locale. */
export function formatMoment(date: Date, format: string, locale = "en-US"): string {
  const H = date.getHours();
  return format.replace(FORMAT_TOKEN_RE, (token, escaped?: string) => {
    if (escaped !== undefined) return escaped;
    switch (token) {
      case "LLLL":
        return `${intl(date, locale, { weekday: "long", year: "numeric", month: "long", day: "numeric" })} ${formatTimeShort(date, locale)}`;
      case "LLL":
        return `${intl(date, locale, { dateStyle: "long" })} ${formatTimeShort(date, locale)}`;
      case "LL":
        return intl(date, locale, { dateStyle: "long" });
      case "LTS":
        return intl(date, locale, { hour: "numeric", minute: "2-digit", second: "2-digit" });
      case "LT":
        return formatTimeShort(date, locale);
      case "L":
        return formatDateShort(date, locale);
      case "YYYY":
        return pad(date.getFullYear(), 4);
      case "YY":
        return pad(date.getFullYear() % 100);
      case "MMMM":
        return intl(date, locale, { month: "long" });
      case "MMM":
        return intl(date, locale, { month: "short" });
      case "MM":
        return pad(date.getMonth() + 1);
      case "Mo":
        return ordinal(date.getMonth() + 1, locale);
      case "M":
        return String(date.getMonth() + 1);
      case "Do":
        return ordinal(date.getDate(), locale);
      case "DDDD": {
        const start = new Date(date.getFullYear(), 0, 1);
        return pad(Math.round((date.getTime() - start.getTime()) / 86_400_000) + 1, 3);
      }
      case "DD":
        return pad(date.getDate());
      case "D":
        return String(date.getDate());
      case "dddd":
        return intl(date, locale, { weekday: "long" });
      case "ddd":
        return intl(date, locale, { weekday: "short" });
      case "dd":
        return intl(date, locale, { weekday: "narrow" });
      case "d":
        return String(date.getDay());
      case "HH":
        return pad(H);
      case "H":
        return String(H);
      case "hh":
        return pad(H % 12 || 12);
      case "h":
        return String(H % 12 || 12);
      case "mm":
        return pad(date.getMinutes());
      case "m":
        return String(date.getMinutes());
      case "ss":
        return pad(date.getSeconds());
      case "s":
        return String(date.getSeconds());
      case "SSS":
        return pad(date.getMilliseconds(), 3);
      case "A":
        return H < 12 ? "AM" : "PM";
      case "a":
        return H < 12 ? "am" : "pm";
      case "ZZ":
        return zoneOffset(date, "");
      case "Z":
        return zoneOffset(date, ":");
      case "X":
        return String(Math.floor(date.getTime() / 1000));
      case "x":
        return String(date.getTime());
      default:
        return token;
    }
  });
}

// ---------------------------------------------------------------------------- links

/** A URL with a scheme (`https:`, `mailto:`, `obsidian:` …), as `link()` treats it. */
export const URL_SCHEME_RE = /^[a-z][a-z0-9+.-]*:[^\s]+$/i;

/** `link("https://…", "Label")`: Obsidian's UrlValue, an external link with the real href. */
export class UrlValue {
  constructor(
    public readonly url: string,
    public readonly display?: string,
  ) {}
  toString(): string {
    return this.url;
  }
}

export function isUrlValue(value: unknown): value is UrlValue {
  return value instanceof UrlValue;
}
