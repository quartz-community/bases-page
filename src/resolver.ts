import type { BasesData, BasesEntry, BasesView, QuartzPluginData, SortEntry } from "./types";
import { evaluate, evaluateFilter, resolvePropertyValue } from "./compiler";
import type { EvalContext } from "./compiler";
import { TagValue, compareForSort, isEmptySortValue } from "./compiler/values";
import { statSync } from "fs";
import { slugTag } from "@quartz-community/utils";
import { withHash } from "./tags";
import type { NoteTags } from "./tags";

function normalizeStringArray(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values.filter((value): value is string => typeof value === "string");
}

// Files carry a source `filePath`: Quartz's parser sets it on notes, and page
// types that render source files (canvas-page, obsidian-plugin-excalidraw, and
// this plugin for .base pages) set it, with the real relativePath, on the
// virtual page that stands for the file. Other virtual pages (404, tag and
// folder listings, …) only get a synthetic `<slug>.md` relativePath; they are
// not files, and Obsidian never lists them. .base pages are left out below.
function isSourceFile(fileData: QuartzPluginData): boolean {
  return typeof fileData.filePath === "string" && fileData.filePath !== "";
}

function getFilePath(fileData: QuartzPluginData, slug: string): string {
  // Prefer relativePath (relative to content dir) over filePath (absolute).
  // Self-context paths from .base files use ctx.allFiles which are relative,
  // so note paths must also be relative for inFolder() comparisons to work.
  if (typeof fileData.relativePath === "string") return fileData.relativePath;
  if (typeof fileData.filePath === "string") return fileData.filePath;
  return slug ? `${slug}.md` : "";
}

function getFileName(path: string): string {
  const lastSlash = path.lastIndexOf("/");
  return lastSlash >= 0 ? path.slice(lastSlash + 1) : path;
}

function getBaseName(path: string): string {
  const fileName = getFileName(path);
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

/**
 * `file.name` as Obsidian's Bases gives it: a Markdown note's name has no extension
 * (`Note`, `Drawing.excalidraw`), every other file keeps it (`Plan.canvas`, `X.base`).
 * `file.basename` never has the extension, `file.fullname` always does.
 */
export function fileNameFor(fullname: string, basename: string, ext: string): string {
  return ext === "md" ? basename : fullname;
}

function toDate(value: unknown): Date | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return new Date(parsed);
  }
  return undefined;
}

/** file.size: the source file's size in bytes, as in Obsidian. */
function fileSize(fileData: QuartzPluginData): number | undefined {
  const source = fileData.filePath;
  if (typeof source !== "string" || !source) return undefined;
  try {
    return statSync(source).size;
  } catch {
    return undefined;
  }
}

function buildFileProperties(
  fileData: QuartzPluginData,
  slug: string,
  frontmatter: Record<string, unknown>,
): BasesEntry["fileProperties"] {
  const filePath = getFilePath(fileData, slug);
  const baseName = filePath ? getBaseName(filePath) : getBaseName(slug);
  const basename = baseName || slug.split("/").pop() || "Untitled";
  const fullname = (filePath ? getFileName(filePath) : "") || basename;
  const lastSlash = filePath.lastIndexOf("/");
  // as in Obsidian, the root folder is "/"
  const folder = lastSlash >= 0 ? filePath.slice(0, lastSlash) : "/";
  const lastDot = fullname.lastIndexOf(".");
  const ext = lastDot > 0 ? fullname.slice(lastDot + 1) : "";
  const name = fileNameFor(fullname, basename, ext);
  const tags = noteTags(fileData)?.file ?? normalizeStringArray(frontmatter.tags).map(withHash);
  // Quartz lists a note's tags among its links (to their tag pages); Obsidian doesn't
  const tagPages = new Set(tags.map((tag) => `tags/${slugTag(tag.replace(/^#/, ""))}`));
  const links = normalizeStringArray(fileData.links ?? fileData.outgoingLinks).filter(
    (link) => !tagPages.has(link),
  );
  const embeds = normalizeStringArray(fileData.embeds);

  const dates = fileData.dates as Record<string, unknown> | undefined;
  const ctime = toDate(dates?.created);
  const mtime = toDate(dates?.modified);

  return {
    name,
    basename,
    fullname,
    path: filePath,
    folder,
    ext,
    tags,
    links,
    embeds,
    created: ctime?.toISOString(),
    modified: mtime?.toISOString(),
    ctime,
    mtime,
    size: fileSize(fileData),
  };
}

function noteTags(fileData: QuartzPluginData): NoteTags | undefined {
  const tags = (fileData as { basesTags?: unknown }).basesTags;
  if (!tags || typeof tags !== "object" || !Array.isArray((tags as NoteTags).file))
    return undefined;
  return tags as NoteTags;
}

/**
 * A note's properties as Obsidian's Bases reads them: `tags` holds the frontmatter tags as
 * written (with `#`), not Quartz's slugged list with the inline tags merged in.
 */
export function noteProperties(fileData: QuartzPluginData): Record<string, unknown> {
  const frontmatter = (fileData.frontmatter ?? {}) as Record<string, unknown>;
  // only the properties the note's frontmatter has: Quartz adds `title` and dates
  const keys = (fileData as { basesPropertyKeys?: unknown }).basesPropertyKeys;
  const written = Array.isArray(keys)
    ? Object.fromEntries(Object.entries(frontmatter).filter(([key]) => keys.includes(key)))
    : frontmatter;
  const tags = noteTags(fileData);
  if (!tags) return written;
  const properties: Record<string, unknown> = { ...written };
  if (tags.note) properties.tags = tags.note;
  else delete properties.tags;
  return properties;
}

/** The file and note values formulas see: tags are tag values (nested-tag aware). */
export function evalFile(
  fileProperties: BasesEntry["fileProperties"],
  properties: Record<string, unknown>,
): EvalContext["file"] {
  return {
    ...fileProperties,
    tags: fileProperties.tags.map((tag) => new TagValue(tag)) as unknown as string[],
    properties: evalNote(properties),
  };
}

export function evalNote(properties: Record<string, unknown>): Record<string, unknown> {
  const tags = properties.tags;
  if (!Array.isArray(tags) && typeof tags !== "string") return properties;
  const list = Array.isArray(tags) ? tags : [tags];
  return {
    ...properties,
    tags: list.map((tag) => (typeof tag === "string" ? new TagValue(withHash(tag)) : tag)),
  };
}

/** `this` for a file value: its properties as `this.<key>`, then `this.file` and `this.note`. */
export function selfContextFor(file: EvalContext["file"]): NonNullable<EvalContext["self"]> {
  const note = file.properties ?? {};
  return { ...note, file, note };
}

/**
 * The `this` context for a base rendered inside a note: `this.file` is the
 * embedding note's full file value (as `file` is for each entry), so methods
 * such as `this.file.asLink()` and `this.file.inFolder()` work.
 */
export function buildSelfContext(fileData: QuartzPluginData): NonNullable<EvalContext["self"]> {
  const slug = typeof fileData.slug === "string" ? fileData.slug : "";
  const frontmatter = (fileData.frontmatter ?? {}) as Record<string, unknown>;
  const properties = noteProperties(fileData);
  return selfContextFor(evalFile(buildFileProperties(fileData, slug, frontmatter), properties));
}

/**
 * One sort key: empty values last in either direction (as in Obsidian), the others by
 * compareForSort, reversed for DESC.
 */
function compareSort(a: unknown, b: unknown, descending: boolean, locale: string): number {
  const emptyA = isEmptySortValue(a);
  const emptyB = isEmptySortValue(b);
  if (emptyA || emptyB) return emptyA === emptyB ? 0 : emptyA ? 1 : -1;
  const cmp = compareForSort(a, b, locale);
  return descending ? -cmp : cmp;
}

// As in Obsidian, entries without a sort are in file name order. `order` only lists the
// columns: it doesn't sort.
const BY_FILE_NAME: SortEntry[] = [
  { property: "file.name", direction: "ASC" },
  { property: "file.path", direction: "ASC" },
];

function buildSortKeys(view?: BasesView): SortEntry[] {
  if (view?.sort && view.sort.length > 0) return [...view.sort, ...BY_FILE_NAME];
  if (view?.groupBy?.property) {
    return [
      { property: view.groupBy.property, direction: view.groupBy.direction ?? "ASC" },
      ...BY_FILE_NAME,
    ];
  }
  return BY_FILE_NAME;
}

function sortEntries(entries: BasesEntry[], view?: BasesView, locale = "en"): BasesEntry[] {
  const sortKeys = buildSortKeys(view);

  return [...entries].sort((left, right) => {
    for (const key of sortKeys) {
      const leftValue = resolvePropertyValue(key.property, {
        note: left.properties,
        file: left.fileProperties,
        formula: left.formulaValues,
      });
      const rightValue = resolvePropertyValue(key.property, {
        note: right.properties,
        file: right.fileProperties,
        formula: right.formulaValues,
      });
      const cmp = compareSort(leftValue, rightValue, key.direction === "DESC", locale);
      if (cmp !== 0) return cmp;
    }
    return 0;
  });
}

export function resolveBasesEntries(
  basesData: BasesData,
  allFiles: QuartzPluginData[],
  view?: BasesView,
  selfContext?: EvalContext["self"],
  locale?: string,
): { entries: BasesEntry[]; total: number } {
  const entries: BasesEntry[] = [];
  const formulas = basesData.formulas ?? {};

  // file.backlinks: the notes linking to each slug
  const backlinks = new Map<string, string[]>();
  for (const fd of allFiles) {
    if ((fd as { unlisted?: unknown }).unlisted === true) continue;
    const source = typeof fd.slug === "string" ? fd.slug : "";
    // a base's page links to its entries, but a .base file links nothing (in Obsidian)
    if (!source || source.endsWith(".base")) continue;
    for (const target of new Set(normalizeStringArray(fd.links))) {
      const list = backlinks.get(target) ?? [];
      list.push(source);
      backlinks.set(target, list);
    }
  }

  const fileLookup = new Map<string, EvalContext["file"]>();
  for (const fd of allFiles) {
    if ((fd as { unlisted?: unknown }).unlisted === true) continue;
    if (!isSourceFile(fd)) continue;
    const fdSlug = typeof fd.slug === "string" ? fd.slug : "";
    if (!fdSlug) continue;
    const fdPath = getFilePath(fd, fdSlug);
    const fm = (fd.frontmatter ?? {}) as Record<string, unknown>;
    const fp = buildFileProperties(fd, fdSlug, fm);
    fp.backlinks = backlinks.get(fdSlug) ?? [];
    const fileValue: EvalContext["file"] = evalFile(fp, noteProperties(fd));

    fileLookup.set(fdPath, fileValue);
    const withoutExt = fdPath.replace(/\.md$/, "");
    if (withoutExt !== fdPath) fileLookup.set(withoutExt, fileValue);

    // Register by slug and basename so OFM's short embed names (e.g. "Apple"
    // from ![[Apple]]) resolve. First-registered wins to avoid ambiguous overwrites.
    if (fdSlug && !fileLookup.has(fdSlug)) {
      fileLookup.set(fdSlug, fileValue);
    }
    const base = getBaseName(fdPath);
    if (base && !fileLookup.has(base)) {
      fileLookup.set(base, fileValue);
    }
  }

  for (const fileData of allFiles) {
    if ((fileData as { unlisted?: unknown }).unlisted === true) continue;
    if (!isSourceFile(fileData)) continue;
    const slug = typeof fileData.slug === "string" ? fileData.slug : "";
    if (!slug) continue;

    // As in Obsidian, .base files are files too: an unfiltered base lists them.

    const frontmatter = (fileData.frontmatter ?? {}) as Record<string, unknown>;
    const fileProperties = buildFileProperties(fileData, slug, frontmatter);
    fileProperties.backlinks = backlinks.get(slug) ?? [];
    const properties = noteProperties(fileData);
    const file = evalFile(fileProperties, properties);
    const context = {
      note: file.properties ?? properties,
      file,
      formula: {} as Record<string, unknown>,
      self: selfContext,
      locale,
      _fileLookup: fileLookup,
    };

    // Evaluate formulas
    for (const [name, expr] of Object.entries(formulas)) {
      context.formula[name] = evaluate(expr, context);
    }

    // Apply global filters
    if (!evaluateFilter(basesData.filters, context)) continue;
    // Apply view-specific filters
    if (view?.filters && !evaluateFilter(view.filters, context)) continue;

    const title =
      typeof frontmatter.title === "string"
        ? frontmatter.title
        : fileProperties.basename || slug.split("/").pop() || "Untitled";

    // as files, for display (by name, as in Obsidian): the file.links, file.backlinks and
    // file.embeds columns, and formulas that are one of those lists
    const asFiles = (slugs: string[] | undefined) =>
      (slugs ?? []).map((target) => fileLookup.get(target) ?? target);
    const linkedFiles: Record<string, unknown[]> = {};
    for (const key of ["links", "backlinks", "embeds"] as const) {
      const list = file[key];
      if (!Array.isArray(list)) continue;
      linkedFiles[`file.${key}`] = asFiles(list);
      for (const [name, value] of Object.entries(context.formula)) {
        if (value === list) linkedFiles[`formula.${name}`] = linkedFiles[`file.${key}`]!;
      }
    }
    entries.push({
      slug,
      title,
      properties,
      fileProperties,
      formulaValues: context.formula,
      linkedFiles,
    });
  }

  const total = entries.length;
  const sorted = sortEntries(entries, view, locale);
  const limited = view?.limit ? sorted.slice(0, view.limit) : sorted;
  return { entries: limited, total };
}
