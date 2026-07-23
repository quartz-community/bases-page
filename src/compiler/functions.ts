import type { EvalContext } from "./interpreter";
import { slugifyFilePath, slugifyPath } from "@quartz-community/utils";
import type { FilePath } from "@quartz-community/utils";

export type GlobalFunction = (args: unknown[], context: EvalContext) => unknown;
export type MethodFunction = (target: unknown, args: unknown[], context: EvalContext) => unknown;
export type MethodTarget = "string" | "number" | "date" | "list" | "file" | "object";

export const globalFunctions = new Map<string, GlobalFunction>();
export const methodFunctions = new Map<MethodTarget, Map<string, MethodFunction>>();

export function getGlobalFunction(name: string): GlobalFunction | undefined {
  return globalFunctions.get(name);
}

export function getMethodFunction(name: string, target: unknown): MethodFunction | undefined {
  const category = getMethodTarget(target);
  if (!category) return undefined;
  return methodFunctions.get(category)?.get(name);
}

function registerGlobalFunction(name: string, fn: GlobalFunction): void {
  globalFunctions.set(name, fn);
}

function registerMethodFunction(target: MethodTarget, name: string, fn: MethodFunction): void {
  const group = methodFunctions.get(target) ?? new Map<string, MethodFunction>();
  group.set(name, fn);
  methodFunctions.set(target, group);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toStringValue(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value);
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof value === "boolean") return value ? 1 : 0;
  return null;
}

function toInteger(value: unknown, fallback: number): number {
  const numberValue = toNumber(value);
  if (numberValue === null) return fallback;
  return Math.trunc(numberValue);
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function flattenArgs(args: unknown[]): unknown[] {
  if (args.length === 1 && Array.isArray(args[0])) return args[0];
  return args;
}

function collectNumericArgs(args: unknown[]): number[] {
  const values = flattenArgs(args);
  const numbers: number[] = [];
  for (const value of values) {
    const numberValue = toNumber(value);
    if (numberValue !== null) numbers.push(numberValue);
  }
  return numbers;
}

function isFileValue(value: unknown): value is EvalContext["file"] {
  if (!isRecord(value)) return false;
  return (
    typeof value.name === "string" &&
    typeof value.path === "string" &&
    typeof value.folder === "string" &&
    typeof value.ext === "string" &&
    Array.isArray(value.tags) &&
    Array.isArray(value.links) &&
    typeof value.basename === "string"
  );
}

function resolveSelfName(value: unknown): string | null {
  if (!isRecord(value)) return null;
  if (isRecord(value.file) && typeof (value.file as Record<string, unknown>).name === "string") {
    return (value.file as Record<string, unknown>).name as string;
  }
  if (typeof value.name === "string" && typeof value.path === "string") {
    return (value.basename as string) || value.name;
  }
  return null;
}

function resolveSelfPath(value: unknown): string | null {
  if (!isRecord(value)) return null;
  if (isRecord(value.file) && typeof (value.file as Record<string, unknown>).path === "string") {
    return (value.file as Record<string, unknown>).path as string;
  }
  if (typeof value.path === "string") {
    return value.path as string;
  }
  return null;
}

function listContainsName(list: unknown[], name: string, selfPath?: string | null): boolean {
  const slugName = slugifyPath(name);
  const selfSlug = selfPath ? slugifyFilePath(selfPath as FilePath) : null;
  return list.some((item) => {
    if (typeof item !== "string") return false;
    const match = item.match(/^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/);
    if (match?.[1]) {
      return match[1] === name || match[1].endsWith(`/${name}`);
    }
    if (item === name) return true;
    const slugItem = slugifyPath(item);
    if (slugItem === slugName || slugItem.endsWith(`/${slugName}`)) return true;
    if (item === slugName || item.endsWith(`/${slugName}`)) return true;
    if (
      selfSlug &&
      (item === selfSlug || selfSlug.endsWith(`/${item}`) || item.endsWith(`/${selfSlug}`))
    )
      return true;
    return false;
  });
}

function isDateValue(value: unknown): value is Date {
  return value instanceof Date;
}

function isAlpha(ch: string): boolean {
  if (!ch) return false;
  const code = ch.charCodeAt(0);
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

function isDigit(ch: string): boolean {
  if (!ch) return false;
  const code = ch.charCodeAt(0);
  return code >= 48 && code <= 57;
}

function parseDuration(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const multipliers: Record<string, number> = {
    ms: 1,
    millisecond: 1,
    milliseconds: 1,
    s: 1000,
    sec: 1000,
    second: 1000,
    seconds: 1000,
    m: 60_000,
    min: 60_000,
    minute: 60_000,
    minutes: 60_000,
    h: 3_600_000,
    hr: 3_600_000,
    hour: 3_600_000,
    hours: 3_600_000,
    d: 86_400_000,
    day: 86_400_000,
    days: 86_400_000,
    w: 604_800_000,
    week: 604_800_000,
    weeks: 604_800_000,
    mo: 2_592_000_000,
    month: 2_592_000_000,
    months: 2_592_000_000,
    y: 31_536_000_000,
    year: 31_536_000_000,
    years: 31_536_000_000,
  };

  let index = 0;
  let total = 0;

  while (index < trimmed.length) {
    while (trimmed[index] === " " || trimmed[index] === "\t") {
      index += 1;
    }
    if (index >= trimmed.length) break;

    const start = index;
    let hasDot = false;
    while (index < trimmed.length) {
      const ch = trimmed[index] ?? "";
      if (isDigit(ch)) {
        index += 1;
        continue;
      }
      if (ch === "." && !hasDot) {
        hasDot = true;
        index += 1;
        continue;
      }
      break;
    }

    if (start === index) return undefined;
    const amount = Number(trimmed.slice(start, index));
    if (Number.isNaN(amount)) return undefined;

    while (index < trimmed.length && (trimmed[index] === " " || trimmed[index] === "\t")) {
      index += 1;
    }

    const unitStart = index;
    while (index < trimmed.length && isAlpha(trimmed[index] ?? "")) {
      index += 1;
    }
    const unit = trimmed.slice(unitStart, index).toLowerCase();
    const multiplier = unit ? multipliers[unit] : 1;
    if (unit && multiplier === undefined) return undefined;

    total += amount * (multiplier ?? 1);
  }

  return total;
}

function parseDate(value: unknown): Date | undefined {
  if (value instanceof Date) return value;
  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) return undefined;
    return new Date(parsed);
  }
  return undefined;
}

function buildFileValue(path: string): EvalContext["file"] {
  const normalized = path.trim();
  const lastSlash = normalized.lastIndexOf("/");
  const fileName = lastSlash >= 0 ? normalized.slice(lastSlash + 1) : normalized;
  const lastDot = fileName.lastIndexOf(".");
  const basename = lastDot > 0 ? fileName.slice(0, lastDot) : fileName;
  const ext = lastDot > 0 ? fileName.slice(lastDot + 1) : "";
  const folder = lastSlash >= 0 ? normalized.slice(0, lastSlash) : "";

  return {
    name: fileName || normalized,
    basename: basename || fileName || normalized,
    path: normalized,
    folder,
    ext,
    tags: [],
    links: [],
  };
}

function getMethodTarget(value: unknown): MethodTarget | undefined {
  if (typeof value === "string") return "string";
  if (typeof value === "number" && !Number.isNaN(value)) return "number";
  if (isDateValue(value)) return "date";
  if (Array.isArray(value)) return "list";
  if (isFileValue(value)) return "file";
  if (isRecord(value)) return "object";
  return undefined;
}

registerGlobalFunction("if", ([cond, whenTrue, whenFalse]) => {
  return cond ? whenTrue : whenFalse;
});

registerGlobalFunction("contains", ([haystack, needle]) => {
  if (Array.isArray(haystack)) {
    if (haystack.includes(needle)) return true;
    const name = resolveSelfName(needle);
    return name ? listContainsName(haystack, name, resolveSelfPath(needle)) : false;
  }
  if (typeof haystack === "string") return haystack.includes(toStringValue(needle));
  return false;
});

registerGlobalFunction("date", ([value]) => parseDate(value));

registerGlobalFunction("duration", ([value]) => {
  if (typeof value === "number") return value;
  if (typeof value === "string") return parseDuration(value);
  return undefined;
});

registerGlobalFunction("now", () => new Date());

registerGlobalFunction("today", () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
});

registerGlobalFunction("number", ([value]) => {
  const numberValue = toNumber(value);
  return numberValue === null ? undefined : numberValue;
});

registerGlobalFunction("min", (args) => {
  const numbers = collectNumericArgs(args);
  if (numbers.length === 0) return undefined;
  return Math.min(...numbers);
});

registerGlobalFunction("max", (args) => {
  const numbers = collectNumericArgs(args);
  if (numbers.length === 0) return undefined;
  return Math.max(...numbers);
});

registerGlobalFunction("list", ([value]) => {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) return value;
  return [value];
});

registerGlobalFunction("link", ([path, display]) => {
  const target = isFileValue(path) ? path.path.replace(/\.md$/, "") : toStringValue(path);
  if (!target) return "";
  const label = isFileValue(display) ? display.basename : toStringValue(display);
  return label ? `[[${target}|${label}]]` : `[[${target}]]`;
});

registerGlobalFunction("image", ([path]) => {
  const target = isFileValue(path) ? path.path.replace(/\.md$/, "") : toStringValue(path);
  if (!target) return "";
  return `![[${target}]]`;
});

registerGlobalFunction("icon", ([name]) => {
  const value = toStringValue(name);
  if (!value) return "";
  return `:${value}:`;
});

registerGlobalFunction("html", ([value]) => toStringValue(value));

registerGlobalFunction("escapeHTML", ([value]) => {
  const text = toStringValue(value);
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
});

registerGlobalFunction("file", ([path]) => {
  if (typeof path !== "string") return undefined;
  if (!path.trim()) return undefined;
  return buildFileValue(path);
});

registerMethodFunction("file", "hasTag", (target, args) => {
  if (!isFileValue(target)) return false;
  if (args.length === 0) return false;
  return args.every((tag) => {
    const value = toStringValue(tag)?.toLowerCase();
    if (!value) return false;
    const prefix = value.endsWith("/") ? value : `${value}/`;
    return target.tags.some((t) => {
      const lower = t.toLowerCase();
      return lower === value || lower.startsWith(prefix);
    });
  });
});

registerMethodFunction("file", "hasLink", (target, [link]) => {
  if (!isFileValue(target)) return false;
  const value = toStringValue(link);
  if (!value) return false;
  return target.links.includes(value);
});

registerMethodFunction("file", "inFolder", (target, [folder]) => {
  if (!isFileValue(target)) return false;
  const value = toStringValue(folder);
  if (!value) return false;
  const normalized = value.endsWith("/") ? value.slice(0, -1) : value;
  return target.folder === normalized || target.folder.startsWith(`${normalized}/`);
});

registerMethodFunction("file", "hasProperty", (_target, [prop], context) => {
  const value = toStringValue(prop);
  if (!value) return false;
  // Obsidian treats hasProperty as "does the key exist in frontmatter?" regardless
  // of whether the value is null/undefined/falsy.
  const parts = value.split(".");
  let target: unknown = context.note;
  for (const part of parts) {
    if (!isRecord(target)) return false;
    if (!Object.hasOwn(target, part)) return false;
    target = target[part];
  }
  return true;
});

registerMethodFunction("string", "contains", (target, [needle]) => {
  const value = toStringValue(target);
  return value.includes(toStringValue(needle));
});

registerMethodFunction("string", "startsWith", (target, [prefix]) => {
  const value = toStringValue(target);
  return value.startsWith(toStringValue(prefix));
});

registerMethodFunction("string", "endsWith", (target, [suffix]) => {
  const value = toStringValue(target);
  return value.endsWith(toStringValue(suffix));
});

registerMethodFunction("string", "lower", (target) => toStringValue(target).toLowerCase());

registerMethodFunction("string", "upper", (target) => toStringValue(target).toUpperCase());

registerMethodFunction("string", "trim", (target) => toStringValue(target).trim());

registerMethodFunction("string", "replace", (target, [search, replacement]) => {
  const source = toStringValue(target);
  const needle = toStringValue(search);
  if (!needle) return source;
  const replacementText = toStringValue(replacement);
  return source.split(needle).join(replacementText);
});

registerMethodFunction("string", "slice", (target, [start, end]) => {
  const source = toStringValue(target);
  const startIndex = toInteger(start, 0);
  if (end === undefined) return source.slice(startIndex);
  const endIndex = toInteger(end, source.length);
  return source.slice(startIndex, endIndex);
});

registerMethodFunction("string", "isEmpty", (target) => toStringValue(target).length === 0);

registerMethodFunction("string", "repeat", (target, [count]) => {
  const source = toStringValue(target);
  const times = toInteger(count, 0);
  if (times <= 0) return "";
  return source.repeat(times);
});

registerMethodFunction("string", "reverse", (target) =>
  toStringValue(target).split("").reverse().join(""),
);

registerMethodFunction("number", "toFixed", (target, [digits]) => {
  const value = toNumber(target);
  if (value === null) return undefined;
  const decimals = toInteger(digits, 0);
  return value.toFixed(decimals);
});

registerMethodFunction("number", "round", (target, [digits]) => {
  const value = toNumber(target);
  if (value === null) return undefined;
  const decimals = toInteger(digits, 0);
  return roundTo(value, decimals);
});

registerMethodFunction("number", "floor", (target) => {
  const value = toNumber(target);
  if (value === null) return undefined;
  return Math.floor(value);
});

registerMethodFunction("number", "ceil", (target) => {
  const value = toNumber(target);
  if (value === null) return undefined;
  return Math.ceil(value);
});

registerMethodFunction("number", "abs", (target) => {
  const value = toNumber(target);
  if (value === null) return undefined;
  return Math.abs(value);
});

const MONTH_NAMES_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const MONTH_NAMES_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatDateToken(date: Date, token: string): string {
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  const y = date.getFullYear();
  const M = date.getMonth() + 1;
  const d = date.getDate();
  const H = date.getHours();
  const h = H % 12 || 12;
  const m = date.getMinutes();
  const s = date.getSeconds();
  const A = H < 12 ? "AM" : "PM";

  switch (token) {
    case "YYYY":
      return String(y);
    case "YY":
      return String(y).slice(-2);
    case "MMMM":
      return MONTH_NAMES_FULL[date.getMonth()]!;
    case "MMM":
      return MONTH_NAMES_SHORT[date.getMonth()]!;
    case "MM":
      return pad(M);
    case "M":
      return String(M);
    case "DD":
      return pad(d);
    case "D":
      return String(d);
    case "HH":
      return pad(H);
    case "H":
      return String(H);
    case "hh":
      return pad(h);
    case "h":
      return String(h);
    case "mm":
      return pad(m);
    case "m":
      return String(m);
    case "ss":
      return pad(s);
    case "s":
      return String(s);
    case "A":
      return A;
    case "a":
      return A.toLowerCase();
    default:
      return token;
  }
}

function formatDate(date: Date, format: string): string {
  const tokenPattern = /YYYY|YY|MMMM|MMM|MM|M|DD|D|HH|H|hh|h|mm|m|ss|s|A|a/g;
  let result = "";
  let lastIndex = 0;
  let match = tokenPattern.exec(format);

  while (match !== null) {
    result += format.slice(lastIndex, match.index);
    result += formatDateToken(date, match[0]);
    lastIndex = tokenPattern.lastIndex;
    match = tokenPattern.exec(format);
  }
  result += format.slice(lastIndex);
  return result;
}

registerMethodFunction("date", "format", (target, [format]) => {
  if (!isDateValue(target)) return undefined;
  const timestamp = target.getTime();
  if (Number.isNaN(timestamp)) return "";
  if (typeof format === "string" && format) {
    return formatDate(target, format);
  }
  return target.toISOString();
});

registerMethodFunction("date", "year", (target) =>
  isDateValue(target) ? target.getFullYear() : undefined,
);

registerMethodFunction("date", "month", (target) =>
  isDateValue(target) ? target.getMonth() + 1 : undefined,
);

registerMethodFunction("date", "day", (target) =>
  isDateValue(target) ? target.getDate() : undefined,
);

registerMethodFunction("date", "date", (target) => {
  if (!isDateValue(target)) return undefined;
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`;
});

registerMethodFunction("date", "time", (target) => {
  if (!isDateValue(target)) return undefined;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(target.getHours())}:${pad(target.getMinutes())}:${pad(target.getSeconds())}`;
});

registerMethodFunction("date", "relative", (target) => {
  if (!isDateValue(target)) return undefined;
  const time = target.getTime();
  if (Number.isNaN(time)) return "";
  const diff = time - Date.now();
  const abs = Math.abs(diff);
  const minutes = Math.round(abs / 60_000);
  const hours = Math.round(abs / 3_600_000);
  const days = Math.round(abs / 86_400_000);

  if (days >= 1) return diff < 0 ? `${days}d ago` : `in ${days}d`;
  if (hours >= 1) return diff < 0 ? `${hours}h ago` : `in ${hours}h`;
  if (minutes >= 1) return diff < 0 ? `${minutes}m ago` : `in ${minutes}m`;
  return diff < 0 ? "just now" : "soon";
});

registerMethodFunction("date", "isEmpty", (target) => {
  if (!isDateValue(target)) return true;
  return Number.isNaN(target.getTime());
});

registerMethodFunction("list", "sum", (target) => {
  if (!Array.isArray(target)) return undefined;
  return target.reduce((total, item) => {
    const value = toNumber(item);
    return value === null ? total : total + value;
  }, 0);
});

registerMethodFunction("list", "mean", (target) => {
  if (!Array.isArray(target)) return undefined;
  const numbers = collectNumericArgs(target);
  if (numbers.length === 0) return undefined;
  const sum = numbers.reduce((total, value) => total + value, 0);
  return sum / numbers.length;
});

registerMethodFunction("list", "count", (target) => (Array.isArray(target) ? target.length : 0));

registerMethodFunction("list", "min", (target) => {
  if (!Array.isArray(target)) return undefined;
  const numbers = collectNumericArgs(target);
  if (numbers.length === 0) return undefined;
  return Math.min(...numbers);
});

registerMethodFunction("list", "max", (target) => {
  if (!Array.isArray(target)) return undefined;
  const numbers = collectNumericArgs(target);
  if (numbers.length === 0) return undefined;
  return Math.max(...numbers);
});

registerMethodFunction("list", "round", (target, [digits]) => {
  if (!Array.isArray(target)) return undefined;
  const decimals = toInteger(digits, 0);
  return target.map((item) => {
    const numberValue = toNumber(item);
    if (numberValue === null) return item;
    return roundTo(numberValue, decimals);
  });
});

registerMethodFunction("file", "asLink", (target, args) => {
  if (!isFileValue(target)) return "";
  const path = target.path.replace(/\.md$/, "");
  const display = args.length > 0 ? toStringValue(args[0]) : "";
  return display ? `[[${path}|${display}]]` : `[[${path}]]`;
});

registerMethodFunction("string", "containsAll", (target, args) => {
  const value = toStringValue(target);
  return args.every((needle) => value.includes(toStringValue(needle)));
});

registerMethodFunction("string", "containsAny", (target, args) => {
  const value = toStringValue(target);
  return args.some((needle) => value.includes(toStringValue(needle)));
});

registerMethodFunction("string", "split", (target, [separator]) => {
  const value = toStringValue(target);
  const sep = toStringValue(separator);
  return value.split(sep);
});

registerMethodFunction("string", "title", (target) => {
  const value = toStringValue(target);
  return value.replace(/\b\w/g, (ch) => ch.toUpperCase());
});

registerMethodFunction("string", "asFile", (target, _args, context) => {
  const path = toStringValue(target);
  if (!path) return undefined;
  const lookup = context._fileLookup;
  if (lookup) {
    const normalized = path.trim();
    const found =
      lookup.get(normalized) ??
      lookup.get(normalized.replace(/\.md$/, "")) ??
      (!normalized.endsWith(".md") ? lookup.get(`${normalized}.md`) : undefined);
    if (found) return { ...found };

    // Fallback: match by path suffix (e.g. "Apple" matches "Compendium/Species/Dryad/Apple")
    const suffix = `/${normalized}`;
    const suffixMd = `/${normalized}.md`;
    for (const [key, value] of lookup) {
      if (key.endsWith(suffix) || key.endsWith(suffixMd)) {
        return { ...value };
      }
    }
  }
  return buildFileValue(path);
});

registerMethodFunction("list", "contains", (target, [needle]) => {
  if (!Array.isArray(target)) return false;
  if (target.includes(needle)) return true;
  if (typeof needle === "string") {
    const slugNeedle = slugifyPath(needle);
    if (target.some((item) => typeof item === "string" && slugifyPath(item) === slugNeedle))
      return true;
  }
  const name = resolveSelfName(needle);
  return name ? listContainsName(target, name, resolveSelfPath(needle)) : false;
});

registerMethodFunction("list", "containsAll", (target, args) => {
  if (!Array.isArray(target)) return false;
  return args.every((needle) => target.includes(needle));
});

registerMethodFunction("list", "containsAny", (target, args) => {
  if (!Array.isArray(target)) return false;
  return args.some((needle) => target.includes(needle));
});

registerMethodFunction("list", "flat", (target) => {
  if (!Array.isArray(target)) return undefined;
  return target.flat();
});

registerMethodFunction("list", "isEmpty", (target) => {
  if (!Array.isArray(target)) return true;
  return target.length === 0;
});

registerMethodFunction("list", "join", (target, [separator]) => {
  if (!Array.isArray(target)) return "";
  const sep = separator === undefined ? ", " : toStringValue(separator);
  return target.map((item) => toStringValue(item)).join(sep);
});

registerMethodFunction("list", "reverse", (target) => {
  if (!Array.isArray(target)) return undefined;
  return [...target].reverse();
});

registerMethodFunction("list", "slice", (target, [start, end]) => {
  if (!Array.isArray(target)) return undefined;
  const startIndex = toInteger(start, 0);
  if (end === undefined) return target.slice(startIndex);
  const endIndex = toInteger(end, target.length);
  return target.slice(startIndex, endIndex);
});

registerMethodFunction("list", "sort", (target) => {
  if (!Array.isArray(target)) return undefined;
  return [...target].sort((a, b) => {
    if (typeof a === "number" && typeof b === "number") return a - b;
    return String(a).localeCompare(String(b));
  });
});

registerMethodFunction("list", "unique", (target) => {
  if (!Array.isArray(target)) return undefined;
  return [...new Set(target)];
});

registerMethodFunction("number", "isEmpty", (target) => {
  const value = toNumber(target);
  return value === null || Number.isNaN(value);
});

registerMethodFunction("object", "isEmpty", (target) => {
  if (!isRecord(target)) return true;
  return Object.keys(target).length === 0;
});

registerMethodFunction("object", "keys", (target) => {
  if (!isRecord(target)) return [];
  return Object.keys(target);
});

registerMethodFunction("object", "values", (target) => {
  if (!isRecord(target)) return [];
  return Object.values(target);
});

function registerAnyMethod(name: string, fn: MethodFunction): void {
  const targets: MethodTarget[] = ["string", "number", "date", "list", "file", "object"];
  for (const target of targets) {
    registerMethodFunction(target, name, fn);
  }
}

registerAnyMethod("isTruthy", (target) => Boolean(target));

registerAnyMethod("isType", (target, [typeName]) => {
  const expected = toStringValue(typeName).toLowerCase();
  if (typeof target === "string") return expected === "string";
  if (typeof target === "number") return expected === "number";
  if (isDateValue(target)) return expected === "date";
  if (Array.isArray(target)) return expected === "list" || expected === "array";
  if (isFileValue(target)) return expected === "file";
  if (isRecord(target)) return expected === "object";
  return false;
});

registerAnyMethod("toString", (target) => {
  if (isDateValue(target)) return target.toISOString();
  if (Array.isArray(target)) return target.map((item) => toStringValue(item)).join(", ");
  if (isRecord(target)) return JSON.stringify(target);
  return toStringValue(target);
});
