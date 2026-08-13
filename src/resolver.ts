import type { BasesData, BasesEntry, BasesView, QuartzPluginData, SortEntry } from "./types";
import { evaluate, evaluateFilter, resolvePropertyValue } from "./compiler";
import type { EvalContext } from "./compiler";

function normalizeStringArray(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values.filter((value): value is string => typeof value === "string");
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

function toDate(value: unknown): Date | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return new Date(parsed);
  }
  return undefined;
}

function buildFileProperties(
  fileData: QuartzPluginData,
  slug: string,
  frontmatter: Record<string, unknown>,
): BasesEntry["fileProperties"] {
  const filePath = getFilePath(fileData, slug);
  const baseName = filePath ? getBaseName(filePath) : getBaseName(slug);
  const name = baseName || slug.split("/").pop() || "Untitled";
  const basename = baseName || slug.split("/").pop() || "Untitled";
  const lastSlash = filePath.lastIndexOf("/");
  const folder = lastSlash >= 0 ? filePath.slice(0, lastSlash) : "";
  const lastDot = filePath.lastIndexOf(".");
  const ext = lastDot >= 0 ? filePath.slice(lastDot + 1) : "";
  const tags = normalizeStringArray(frontmatter.tags);
  const links = normalizeStringArray(fileData.links ?? fileData.outgoingLinks);
  const embeds = normalizeStringArray(fileData.embeds);

  const dates = fileData.dates as Record<string, unknown> | undefined;
  const ctime = toDate(dates?.created);
  const mtime = toDate(dates?.modified);

  return {
    name,
    basename,
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
  };
}

function compareSort(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === undefined || a === null) return 1;
  if (b === undefined || b === null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  const dateA = typeof a === "string" ? Date.parse(a) : NaN;
  const dateB = typeof b === "string" ? Date.parse(b) : NaN;
  if (!Number.isNaN(dateA) && !Number.isNaN(dateB)) return dateA - dateB;
  return String(a).localeCompare(String(b));
}

function buildSortKeys(view?: BasesView): SortEntry[] {
  if (view?.sort && view.sort.length > 0) return view.sort;
  if (view?.groupBy?.property) {
    return [{ property: view.groupBy.property, direction: view.groupBy.direction ?? "ASC" }];
  }
  if (view?.order && view.order.length > 0) {
    return view.order.map((property) => ({ property, direction: "ASC" as const }));
  }
  return [];
}

function sortEntries(entries: BasesEntry[], view?: BasesView): BasesEntry[] {
  const sortKeys = buildSortKeys(view);
  if (sortKeys.length === 0) return entries;

  return [...entries].sort((left, right) => {
    for (const key of sortKeys) {
      const sign = key.direction === "DESC" ? -1 : 1;
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
      const cmp = compareSort(leftValue, rightValue);
      if (cmp !== 0) return sign * cmp;
    }
    return 0;
  });
}

export function resolveBasesEntries(
  basesData: BasesData,
  allFiles: QuartzPluginData[],
  view?: BasesView,
  selfContext?: EvalContext["self"],
): { entries: BasesEntry[]; total: number } {
  const entries: BasesEntry[] = [];
  const formulas = basesData.formulas ?? {};

  const fileLookup = new Map<string, EvalContext["file"]>();
  for (const fd of allFiles) {
    if ((fd as { unlisted?: unknown }).unlisted === true) continue;
    const fdSlug = typeof fd.slug === "string" ? fd.slug : "";
    if (!fdSlug) continue;
    const fdPath = getFilePath(fd, fdSlug);
    const fm = (fd.frontmatter ?? {}) as Record<string, unknown>;
    const fp = buildFileProperties(fd, fdSlug, fm);
    const fileValue: EvalContext["file"] = { ...fp, properties: fm };

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
    const slug = typeof fileData.slug === "string" ? fileData.slug : "";
    if (!slug) continue;

    const filePath = typeof fileData.filePath === "string" ? fileData.filePath : "";
    if (filePath.endsWith(".base") || slug.endsWith(".base")) continue;

    const frontmatter = (fileData.frontmatter ?? {}) as Record<string, unknown>;
    const fileProperties = buildFileProperties(fileData, slug, frontmatter);
    const context = {
      note: frontmatter,
      file: { ...fileProperties, properties: frontmatter },
      formula: {} as Record<string, unknown>,
      self: selfContext,
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

    entries.push({
      slug,
      title,
      properties: frontmatter,
      fileProperties,
      formulaValues: context.formula,
    });
  }

  const total = entries.length;
  const sorted = sortEntries(entries, view);
  const limited = view?.limit ? sorted.slice(0, view.limit) : sorted;
  return { entries: limited, total };
}
