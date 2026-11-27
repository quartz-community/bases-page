import type { EvalContext } from "./interpreter";
import { slugifyFilePath, slugifyPath } from "@quartz-community/utils";
import type { FilePath } from "@quartz-community/utils";
import {
  BasesDate,
  FormulaError,
  dateToString,
  isDuration,
  isTagValue,
  formatMoment,
  parseDuration,
  parseIsoDate,
  relativeFromNow,
  URL_SCHEME_RE,
  UrlValue,
  isUrlValue,
  HtmlValue,
  IconValue,
  ImageValue,
  compareForSort,
  isEmptySortValue,
  isTruthy,
  looseEquals,
} from "./values";
import { tagMatches } from "../tags";

export type GlobalFunction = (args: unknown[], context: EvalContext) => unknown;
export type MethodFunction = (target: unknown, args: unknown[], context: EvalContext) => unknown;
export type MethodTarget =
  "string" | "number" | "date" | "duration" | "list" | "file" | "object" | "regex";

export const globalFunctions = new Map<string, GlobalFunction>();
export const methodFunctions = new Map<MethodTarget, Map<string, MethodFunction>>();

export function getGlobalFunction(name: string): GlobalFunction | undefined {
  return globalFunctions.get(name);
}

/** The type name Obsidian uses in "Cannot find function" errors. */
export function methodTypeName(value: unknown): string {
  if (isDuration(value)) return "Duration";
  if (isTagValue(value) || typeof value === "string") return "String";
  if (isUrlValue(value)) return "Url";
  if (value instanceof RegExp) return "Regexp";
  if (typeof value === "number") return "Number";
  if (typeof value === "boolean") return "Boolean";
  if (value instanceof Date) return "Date";
  if (Array.isArray(value)) return "List";
  if (isFileValue(value)) return "File";
  return "Object";
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
  if (value instanceof Date) return dateToString(value);
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

/**
 * The numbers among the values for sum/mean/min/max: as in Obsidian, text is skipped, also
 * numeric text (["9", 4].max() is 4), and so are booleans ([true, 0].max() is 0).
 */
function collectNumericArgs(args: unknown[]): number[] {
  const values = flattenArgs(args);
  const numbers: number[] = [];
  for (const value of values) {
    if (typeof value === "string" || typeof value === "boolean") continue;
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
  return list.some((value) => {
    if (typeof value !== "string") return false;
    // A wikilink's target is matched like a bare name, so case and slug differences resolve too.
    const item = parseWikilink(value)?.target.replace(/\.md$/, "") ?? value;
    // a plain path such as "Templates.base" names the file (Obsidian: ["Templates.base"].contains(this))
    if (selfPath && item === selfPath) return true;
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

// As in Obsidian, date() reads ISO-style strings (`2024-03-05`, `2024-03-05 14:30`,
// `2024-03-05T14:30:00Z`) and compact `20240305`, in local time; anything else is null
// (`05/03/2024`, `March 5, 2024`), whatever the locale.
function parseDate(value: unknown): Date | undefined {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value;
  if (typeof value === "string") return parseIsoDate(value);
  if (value === undefined || value === null) return undefined;
  throw new FormulaError(
    `Type error in "date", parameter "input". Expected String, given ${typeNameOf(value)}.`,
  );
}

// Obsidian keeps wikilink syntax in link-valued frontmatter ("[[Apple]]", "[[Apple|alias]]",
// "[[Apple#heading]]"). Splits a value that is exactly one wikilink into target and #heading.
function parseWikilink(value: string): { target: string; subpath: string } | null {
  const match = /^\[\[([^|#\]]+)(#[^|\]]*)?(?:\|[^\]]*)?\]\]$/.exec(value.trim());
  const target = match?.[1]?.trim();
  if (!match || !target) return null;
  return { target, subpath: match[2] ?? "" };
}

// The link target for a file value, a path, or an existing wikilink (keeping its #heading;
// like Obsidian, a wikilink's alias is dropped).
/** A copy, so a /g regex's lastIndex never carries over between uses. */
function freshRegex(regex: RegExp): RegExp {
  return new RegExp(regex.source, regex.flags);
}

function linkTarget(value: unknown): string {
  if (isFileValue(value)) return value.path.replace(/\.md$/, "");
  const raw = toStringValue(value);
  const wikilink = parseWikilink(raw);
  return wikilink ? `${wikilink.target}${wikilink.subpath}` : raw;
}

function buildFileValue(path: string): EvalContext["file"] {
  const normalized = path.trim();
  const lastSlash = normalized.lastIndexOf("/");
  const fileName = lastSlash >= 0 ? normalized.slice(lastSlash + 1) : normalized;
  const lastDot = fileName.lastIndexOf(".");
  const basename = lastDot > 0 ? fileName.slice(0, lastDot) : fileName;
  const ext = lastDot > 0 ? fileName.slice(lastDot + 1) : "";
  const folder = lastSlash >= 0 ? normalized.slice(0, lastSlash) : "/";
  const fullname = fileName || normalized;
  const base = basename || fullname;

  return {
    // as in Obsidian: a Markdown note's name has no extension, other files keep it
    name: ext === "md" ? base : fullname,
    basename: base,
    fullname,
    path: normalized,
    folder,
    ext,
    tags: [],
    links: [],
  };
}

// Looks a path, slug or bare name up in the file index (as asFile() does).
function lookupFile(path: string, context: EvalContext): EvalContext["file"] | undefined {
  const lookup = context._fileLookup;
  if (!lookup) return undefined;
  const normalized = path.trim();
  if (!normalized) return undefined;
  const found =
    lookup.get(normalized) ??
    lookup.get(normalized.replace(/\.md$/, "")) ??
    (!normalized.endsWith(".md") ? lookup.get(`${normalized}.md`) : undefined);
  if (found) return found;

  // Fallback: match by path suffix (e.g. "Apple" matches "Compendium/Species/Dryad/Apple")
  const suffix = `/${normalized}`;
  const suffixMd = `/${normalized}.md`;
  for (const [key, value] of lookup) {
    if (key.endsWith(suffix) || key.endsWith(suffixMd)) return value;
  }
  return undefined;
}

// A wikilink string such as this.file.asLink() returns ("[[people/Alice]]"), resolved to the
// file it points at, so it can be compared like a link rather than as text.
function resolveLink(value: unknown, context: EvalContext): { name: string; path: string } | null {
  if (typeof value !== "string") return null;
  const wikilink = parseWikilink(value);
  if (!wikilink) return null;
  const path = lookupFile(wikilink.target, context)?.path ?? wikilink.target;
  const fileName = path.slice(path.lastIndexOf("/") + 1);
  return { name: fileName.replace(/\.md$/, ""), path };
}

function sameLinkTarget(left: { path: string }, right: { path: string }): boolean {
  return (
    slugifyFilePath(left.path.trim() as FilePath) === slugifyFilePath(right.path.trim() as FilePath)
  );
}

// list.contains(needle) / contains(list, needle): matches values, `this` / file values, and
// wikilinks (e.g. this.file.asLink()) against list items that are links, slugs or names.
function listContains(list: unknown[], needle: unknown, context: EvalContext): boolean {
  // as == does: [1, 2].contains("1") (Obsidian: true)
  if (list.some((item) => looseEquals(item, needle))) return true;
  // a list of tags (file.tags, the tags property) contains a tag and its nested tags
  if (list.some(isTagValue)) {
    if (needle === undefined || needle === null) return false;
    const query = String(needle);
    return list.some((item) => (isTagValue(item) ? tagMatches(item.tag, query) : item === needle));
  }
  if (needle === undefined || needle === null) return false;
  const link = resolveLink(needle, context);
  if (link) return listContainsName(list, link.name, link.path);
  // paths compare as slugs ("people/Alice" and "people/alice"); other text is exact, as in
  // Obsidian (["Ab"].contains("ab") is false)
  if (typeof needle === "string" && needle.includes("/")) {
    const slugNeedle = slugifyPath(needle);
    if (list.some((item) => typeof item === "string" && slugifyPath(item) === slugNeedle))
      return true;
  }
  const name = resolveSelfName(needle);
  return name ? listContainsName(list, name, resolveSelfPath(needle)) : false;
}

function typeNameOf(value: unknown): string {
  if (isDuration(value)) return "Duration";
  if (value instanceof Date) return "Date";
  if (typeof value === "number") return "Number";
  if (typeof value === "boolean") return "Boolean";
  if (Array.isArray(value)) return "List";
  return "Object";
}

function getMethodTarget(value: unknown): MethodTarget | undefined {
  if (isDuration(value)) return "duration";
  if (value instanceof RegExp) return "regex";
  if (isTagValue(value)) return "string";
  if (typeof value === "string") return "string";
  if (typeof value === "number" && !Number.isNaN(value)) return "number";
  if (isDateValue(value)) return "date";
  if (Array.isArray(value)) return "list";
  if (isFileValue(value)) return "file";
  if (isRecord(value)) return "object";
  return undefined;
}

registerGlobalFunction("if", ([cond, whenTrue, whenFalse]) => {
  return isTruthy(cond) ? whenTrue : whenFalse;
});

registerGlobalFunction("contains", ([haystack, needle], context) => {
  if (Array.isArray(haystack)) return listContains(haystack, needle, context);
  if (typeof haystack === "string") return stringContains(haystack, needle, context);
  return false;
});

registerGlobalFunction("date", ([value]) => parseDate(value));

registerGlobalFunction("duration", ([value]) => {
  if (isDuration(value)) return value;
  if (typeof value === "string") return parseDuration(value);
  if (value === undefined || value === null) return undefined;
  throw new FormulaError(
    `Type error in "duration", parameter "input". Expected String, given ${typeNameOf(value)}.`,
  );
});

registerGlobalFunction("now", () => new BasesDate(Date.now(), true));

registerGlobalFunction("today", () => {
  const now = new Date();
  return new BasesDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()), false);
});

registerGlobalFunction("number", ([value]) => {
  if (isDuration(value)) throw new FormulaError('Unable to convert "Duration" to a number.');
  if (Array.isArray(value)) throw new FormulaError('Unable to convert "List" to a number.');
  // as in Obsidian: a date is its epoch milliseconds
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") {
    // as in Obsidian: the leading number ("12abc" is 12, "0x10" is 0); "" and "abc" are errors
    const parsed = parseFloat(value);
    if (Number.isNaN(parsed)) throw new FormulaError(`Unable to parse "${value}" as a number.`);
    return parsed;
  }
  const numberValue = toNumber(value);
  return numberValue === null ? undefined : numberValue;
});

/** As in Obsidian, the global min()/max() take numbers only: a boolean or a date is a type error. */
function checkNumberInputs(name: string, args: unknown[]): void {
  for (const value of flattenArgs(args)) {
    if (typeof value === "boolean" || value instanceof Date) {
      throw new FormulaError(
        `Type error in "${name}", parameter "inputs". Expected Number, given ${typeNameOf(value)}.`,
      );
    }
  }
}

registerGlobalFunction("min", (args) => {
  checkNumberInputs("min", args);
  const numbers = collectNumericArgs(args);
  if (numbers.length === 0) return undefined;
  return Math.min(...numbers);
});

registerGlobalFunction("max", (args) => {
  checkNumberInputs("max", args);
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
  const target = linkTarget(path);
  if (!target) return "";
  const label = isFileValue(display) ? display.basename : toStringValue(display);
  // As in Obsidian, a target with a URL scheme (https:, mailto:, obsidian:, …) is an external
  // link with that exact href; anything else is a link to a note.
  if (URL_SCHEME_RE.test(target)) return new UrlValue(target, label || undefined);
  return label ? `[[${target}|${label}]]` : `[[${target}]]`;
});

registerGlobalFunction("image", ([path]) => {
  const target = isFileValue(path) ? path.path : linkTarget(path);
  if (!target) return null;
  return new ImageValue(target);
});

registerGlobalFunction("icon", ([name]) => {
  const value = toStringValue(name).trim();
  if (!value) return null;
  return new IconValue(value);
});

registerGlobalFunction("html", ([value]) => new HtmlValue(toStringValue(value)));

registerGlobalFunction("random", () => Math.random());

registerGlobalFunction("escapeHTML", ([value]) => {
  const text = toStringValue(value);
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
});

// the vault's file at that path (with its tags, links and properties), as in Obsidian
registerGlobalFunction("file", ([path], context) => {
  if (typeof path !== "string") return undefined;
  if (!path.trim()) return undefined;
  const found = lookupFile(path, context);
  return found ? { ...found } : buildFileValue(path);
});

// As in Obsidian: true if the file has any of the tags or one of their nested tags,
// ignoring case and a leading `#`.
registerMethodFunction("file", "hasTag", (target, args) => {
  if (!isFileValue(target)) return false;
  return args.some((tag) => {
    const query = toStringValue(tag);
    if (!query) return false;
    return target.tags.some((t) => tagMatches(String(t), query));
  });
});

// The slug a link points at, for comparing links written in different forms ("people/Alice",
// "people/Alice.md", a folder note's "topic/index" and its link "topic").
function linkSlug(path: string): string {
  // a link to a heading or block (#…) is a link to the file
  const file = path.trim().replace(/#.*$/, "").replace(/\/+$/, "");
  return slugifyFilePath(file as FilePath)
    .replace(/(^|\/)index$/, "")
    .toLowerCase();
}

// file.hasLink(x): x is `this`, a file value (this.file), a wikilink ("[[Alice]]",
// link("Alice")), or a path or name. As in Obsidian, the file links to that file.
registerMethodFunction("file", "hasLink", (target, [link], context) => {
  if (!isFileValue(target)) return false;
  let value: unknown = link;
  if (isRecord(value) && isFileValue(value.file)) value = value.file;
  let path: string;
  if (isFileValue(value)) path = value.path;
  else {
    const raw = toStringValue(value);
    if (!raw) return false;
    path = resolveLink(raw, context)?.path ?? lookupFile(raw, context)?.path ?? raw;
  }
  const wanted = linkSlug(path);
  // an embed (![[Tasks.base]]) is a link too
  return [...target.links, ...(target.embeds ?? [])].some((l) => linkSlug(l) === wanted);
});

registerMethodFunction("file", "inFolder", (target, [folder]) => {
  if (!isFileValue(target)) return false;
  if (typeof folder !== "string") return false;
  const normalized = folder.trim().replace(/^\/+|\/+$/g, "");
  // The content root ("" here, "/" in Obsidian) contains every file.
  if (normalized === "") return true;
  return target.folder === normalized || target.folder.startsWith(`${normalized}/`);
});

registerMethodFunction("file", "hasProperty", (file, [prop], context) => {
  const value = toStringValue(prop);
  if (!value) return false;
  // Obsidian treats hasProperty as "does the key exist in frontmatter?" regardless
  // of whether the value is null/undefined/falsy. The file's own properties: this.file's are
  // the embedding note's.
  const parts = value.split(".");
  // (a file not in the vault has none)
  const own = isRecord(file) ? file.properties : undefined;
  let target: unknown = isRecord(own) ? own : file === context.file ? context.note : {};
  for (const part of parts) {
    if (!isRecord(target)) return false;
    if (!Object.hasOwn(target, part)) return false;
    target = target[part];
  }
  return true;
});

// A missing needle (e.g. an unresolved property) matches nothing rather than "" matching all.
// A link-valued string ("[[Alice]]") contains a link to the same file ("[[people/Alice]]").
function stringContains(target: unknown, needle: unknown, context: EvalContext): boolean {
  if (needle === undefined || needle === null) return false;
  const value = toStringValue(target);
  const needleLink = resolveLink(needle, context);
  const valueLink = needleLink ? resolveLink(value, context) : null;
  if (needleLink && valueLink && sameLinkTarget(valueLink, needleLink)) return true;
  // as in Obsidian, a string contains a text ignoring case; it never contains ""
  const text = toStringValue(needle);
  if (!text) return false;
  return value.toLowerCase().includes(text.toLowerCase());
}

registerMethodFunction("string", "contains", (target, [needle], context) =>
  stringContains(target, needle, context),
);

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
  const replacementText = toStringValue(replacement);
  // a regular expression replaces its first match (every match with the g flag), and $1 etc.
  // refer to its groups, as in JavaScript
  if (search instanceof RegExp) return source.replace(freshRegex(search), replacementText);
  const needle = toStringValue(search);
  if (!needle) return source;
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

registerMethodFunction("date", "format", (target, [format], context) => {
  if (!isDateValue(target)) return undefined;
  if (Number.isNaN(target.getTime())) return "";
  const pattern = typeof format === "string" && format ? format : "YYYY-MM-DDTHH:mm:ssZ";
  return formatMoment(target, pattern, context.locale);
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

// the date without its time, as a date value
registerMethodFunction("date", "date", (target) => {
  if (!isDateValue(target)) return undefined;
  return new BasesDate(new Date(target.getFullYear(), target.getMonth(), target.getDate()), false);
});

registerMethodFunction("date", "time", (target) => {
  if (!isDateValue(target)) return undefined;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(target.getHours())}:${pad(target.getMinutes())}:${pad(target.getSeconds())}`;
});

// moment's fromNow(): "3 years ago", "in 2 days", in the site's locale
registerMethodFunction("date", "relative", (target, _args, context) => {
  if (!isDateValue(target)) return undefined;
  if (Number.isNaN(target.getTime())) return "";
  return relativeFromNow(target, context.locale);
});

registerMethodFunction("duration", "isEmpty", () => false);

registerMethodFunction("date", "isEmpty", (target) => {
  if (!isDateValue(target)) return true;
  return Number.isNaN(target.getTime());
});

registerMethodFunction("list", "sum", (target) => {
  if (!Array.isArray(target)) return undefined;
  // as in Obsidian, text and booleans are skipped (["1", 2, "x"].sum() is 2, [true, 1, 2].sum()
  // is 3), and a list without numbers has no sum
  const numbers = collectNumericArgs(target);
  if (numbers.length === 0) return undefined;
  return numbers.reduce((total, value) => total + value, 0);
});

registerMethodFunction("list", "mean", (target) => {
  if (!Array.isArray(target)) return undefined;
  const numbers = collectNumericArgs(target);
  if (numbers.length === 0) return undefined;
  const sum = numbers.reduce((total, value) => total + value, 0);
  // as in Obsidian, an empty value, text or a boolean counts as 0: [80, null].mean() is 40,
  // ["2", 4].mean() is 2, [true, 4].mean() is 2
  return sum / target.length;
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

// As in Obsidian, the link is to the file's full path, shown as written (`folder/Note.md`).
registerMethodFunction("file", "asLink", (target, args) => {
  if (!isFileValue(target)) return "";
  const path = target.path;
  const display = args.length > 0 ? toStringValue(args[0]) : "";
  return display ? `[[${path}|${display}]]` : `[[${path}]]`;
});

registerMethodFunction("string", "containsAll", (target, args) => {
  const value = toStringValue(target).toLowerCase();
  return args.every((needle) => value.includes(toStringValue(needle).toLowerCase()));
});

registerMethodFunction("string", "containsAny", (target, args) => {
  const value = toStringValue(target).toLowerCase();
  return args.some((needle) => value.includes(toStringValue(needle).toLowerCase()));
});

registerMethodFunction("string", "split", (target, [separator, limit]) => {
  const value = toStringValue(target);
  const sep = separator instanceof RegExp ? freshRegex(separator) : toStringValue(separator);
  // split(separator, n): at most n parts
  const n = typeof limit === "number" && limit >= 0 ? Math.floor(limit) : undefined;
  return value.split(sep, n);
});

// /pattern/.matches(text)
registerMethodFunction("regex", "matches", (target, [text]) => {
  if (!(target instanceof RegExp)) return false;
  return freshRegex(target).test(toStringValue(text));
});

// link.linksTo(file): whether the link points to that file
registerMethodFunction("string", "linksTo", (target, [file], context) => {
  const link = parseWikilink(toStringValue(target));
  if (!link) return false;
  const linked = lookupFile(link.target, context);
  const other = isFileValue(file) ? file : lookupFile(linkTarget(file), context);
  if (!linked || !other) return false;
  return linked.path === other.path;
});

registerMethodFunction("string", "title", (target) => {
  // as in Obsidian: each space-separated word capitalised, the rest lowercase
  // ("hello WORLD foo-bar" is "Hello World Foo-bar")
  return toStringValue(target)
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
});

registerMethodFunction("string", "asFile", (target, _args, context) => {
  const raw = toStringValue(target);
  const path = parseWikilink(raw)?.target ?? raw;
  if (!path) return undefined;
  const found = lookupFile(path, context);
  return found ? { ...found } : buildFileValue(path);
});

registerMethodFunction("list", "contains", (target, [needle], context) => {
  if (!Array.isArray(target)) return false;
  return listContains(target, needle, context);
});

registerMethodFunction("list", "containsAll", (target, args, context) => {
  if (!Array.isArray(target)) return false;
  return args.every((needle) => listContains(target, needle, context));
});

registerMethodFunction("list", "containsAny", (target, args, context) => {
  if (!Array.isArray(target)) return false;
  return args.some((needle) => listContains(target, needle, context));
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

registerMethodFunction("list", "sort", (target, _args, context) => {
  if (!Array.isArray(target)) return undefined;
  // as in Obsidian: [10, 9, "b", "A", 2].sort() is 2, 9, 10, A, b
  return [...target].sort((a, b) => {
    const emptyA = isEmptySortValue(a);
    const emptyB = isEmptySortValue(b);
    if (emptyA || emptyB) return emptyA === emptyB ? 0 : emptyA ? 1 : -1;
    return compareForSort(a, b, context.locale);
  });
});

registerMethodFunction("list", "unique", (target) => {
  if (!Array.isArray(target)) return undefined;
  // as in Obsidian: equal dates are one; 1 and "1" are not ([1, "1", 1].unique() is 1, "1")
  const seen = new Set<unknown>();
  return target.filter((item) => {
    const key = item instanceof Date ? `date:${item.getTime()}` : item;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
  const targets: MethodTarget[] = [
    "string",
    "number",
    "date",
    "duration",
    "list",
    "file",
    "object",
  ];
  for (const target of targets) {
    registerMethodFunction(target, name, fn);
  }
}

registerAnyMethod("isTruthy", (target) => isTruthy(target));

registerAnyMethod("isType", (target, [typeName]) => {
  const expected = toStringValue(typeName).toLowerCase();
  if (isDuration(target)) return expected === "duration";
  if (isTagValue(target)) return expected === "string";
  if (isUrlValue(target)) return expected === "url";
  if (typeof target === "string") return expected === "string";
  if (typeof target === "number") return expected === "number";
  if (isDateValue(target)) return expected === "date";
  if (Array.isArray(target)) return expected === "list" || expected === "array";
  if (isFileValue(target)) return expected === "file";
  if (isRecord(target)) return expected === "object";
  return false;
});

registerAnyMethod("toString", (target) => {
  if (isDateValue(target)) return dateToString(target);
  if (isDuration(target)) return target.toString();
  if (Array.isArray(target)) return target.map((item) => toStringValue(item)).join(", ");
  if (isRecord(target)) return JSON.stringify(target);
  return toStringValue(target);
});
