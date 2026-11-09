import type { ComponentChild } from "preact";
import type { FullSlug } from "@quartz-community/types";

import type { BasesData, BasesEntry, BasesView } from "../../types";
import { isResolvedLink, renderExternalLink, renderTextWithLinks } from "./links";
import { transformLink, slugifyPath, slugTag } from "@quartz-community/utils";
import {
  Duration,
  ErrorValue,
  TagValue,
  UrlValue,
  coerceDateString,
  displayDate,
  humanizeDuration,
} from "../../compiler/values";

type RenderCtx = {
  slug: string;
  allSlugs: string[];
  linkResolution: "absolute" | "relative" | "shortest";
  /** The site's locale, for dates and durations */
  locale?: string;
  /** Whether the site has tag pages; unset, a tag links when its page is in allSlugs */
  tagPages?: boolean;
};

/**
 * Detect file objects returned by asFile() in the expression engine.
 * These have a specific shape: {name, basename, path, folder, ext, tags, links}.
 */
function isFileValue(
  value: unknown,
): value is { name: string; basename: string; path: string; folder: string; ext: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.name === "string" &&
    typeof record.basename === "string" &&
    typeof record.path === "string" &&
    typeof record.folder === "string" &&
    typeof record.ext === "string"
  );
}

export function formatValue(value: unknown): string {
  if (value === undefined || value === null) return "";
  // sortable: a duration sorts by its length
  if (value instanceof Duration) return String(value.totalMilliseconds());
  if (value instanceof ErrorValue) return "";
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  if (Array.isArray(value)) return value.map((item) => String(item)).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

const TAG_PROPERTIES = new Set(["tags", "note.tags", "file.tags"]);

/** `tags`, `note.tags` and `file.tags` hold tags (community PR #18). */
export function isTagProperty(column: string | undefined): boolean {
  return column !== undefined && TAG_PROPERTIES.has(column);
}

function asTags(value: unknown): unknown {
  const toTag = (item: unknown) =>
    typeof item === "string" && item.trim()
      ? new TagValue(item.trim().startsWith("#") ? item.trim() : `#${item.trim()}`)
      : item;
  if (Array.isArray(value)) return value.map(toTag);
  return toTag(value);
}

/**
 * A tag shows as a link to its tag page, without `#` and in its own case: the static
 * equivalent of Obsidian's tag pill, which opens a search for the tag.
 */
export function renderTag(tag: TagValue, ctx: RenderCtx): ComponentChild {
  const target = `tags/${slugTag(tag.name)}`;
  const href = transformLink(ctx.slug as FullSlug, target, {
    strategy: "absolute",
    allSlugs: ctx.allSlugs as FullSlug[],
  });
  // a value that isn't a valid tag (`a, b`) has no tag page
  const valid = /^[\p{L}\p{N}\p{M}_\-/]+$/u.test(tag.name);
  if (
    !valid ||
    ctx.tagPages === false ||
    (ctx.tagPages === undefined && !isResolvedLink(href, ctx))
  ) {
    return <span class="tag-link">{tag.name}</span>;
  }
  return (
    <a href={href} class="internal tag-link" data-slug={target}>
      {tag.name}
    </a>
  );
}

export function renderCellValue(
  rawValue: unknown,
  ctx: RenderCtx,
  column?: string,
): ComponentChild {
  // a property holding an ISO date is a date, as in Obsidian
  const value = isTagProperty(column) ? asTags(rawValue) : coerceDateString(rawValue);
  // as in Obsidian, an empty value is a blank cell
  if (value === null || value === undefined) {
    return <span class="bases-empty-value" />;
  }

  if (value instanceof ErrorValue) {
    // as in Obsidian: the cell shows the formula's error
    return (
      <span class="bases-formula-error" title={value.message}>
        <span class="bases-formula-error-icon" aria-hidden="true" />
        <span class="bases-formula-error-message">{value.message}</span>
      </span>
    );
  }

  if (value instanceof UrlValue) {
    return renderExternalLink(value.url, value.display);
  }

  if (value instanceof TagValue) return renderTag(value, ctx);

  if (value instanceof Duration) {
    return <span class="bases-duration">{humanizeDuration(value, ctx.locale)}</span>;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return <span class="bases-empty">—</span>;
    // moment's `L` / `L LT` in the site's locale, as Obsidian shows dates
    return (
      <time class="bases-date" datetime={value.toISOString()}>
        {displayDate(value, ctx.locale)}
      </time>
    );
  }

  if (typeof value === "boolean") {
    return <input type="checkbox" checked={value} disabled />;
  }

  if (typeof value === "number") {
    return <span class="bases-number">{value}</span>;
  }

  if (typeof value === "string") {
    const parts = renderTextWithLinks(value, ctx);
    return <span class="bases-text">{parts}</span>;
  }

  if (Array.isArray(value)) {
    const items = value.map((item, index) => (
      <>
        {index > 0 && <span class="bases-separator">, </span>}
        {renderCellValue(item, ctx)}
      </>
    ));
    return <span class="bases-list">{items}</span>;
  }

  if (typeof value === "object") {
    // `this` shows as its file
    const self = value as Record<string, unknown>;
    if (!isFileValue(value) && isFileValue(self.file) && "note" in self) {
      return renderCellValue(self.file, ctx);
    }
    if (isFileValue(value)) {
      const href = transformLink(
        ctx.slug as FullSlug,
        slugifyPath(value.path.replace(/\.md$/, "")),
        {
          strategy: ctx.linkResolution,
          allSlugs: ctx.allSlugs as FullSlug[],
        },
      );
      return (
        <a href={href} class="internal internal-link">
          {value.name || value.basename}
        </a>
      );
    }
    return <code>{JSON.stringify(value)}</code>;
  }

  return String(value);
}

export function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

export function getColumnLabel(column: string, basesData: BasesData): string {
  const config = basesData.properties?.[column];
  if (config?.displayName) return config.displayName;
  const segment = column.split(".").pop() ?? column;
  return segment
    .split("_")
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join(" ");
}

export function getColumns(view: BasesView, basesData: BasesData, entries: BasesEntry[]): string[] {
  if (view.order && view.order.length > 0) return view.order;
  const columns = new Set<string>();
  columns.add("file.name");
  const propertyKeys = basesData.properties ? Object.keys(basesData.properties) : [];
  if (propertyKeys.length > 0) {
    propertyKeys.forEach((key) => {
      columns.add(key);
    });
  } else if (entries.length > 0) {
    const firstEntry = entries[0];
    if (firstEntry) {
      Object.keys(firstEntry.properties).forEach((key) => {
        columns.add(key);
      });
    }
  }
  return Array.from(columns);
}

function getNestedValue(value: unknown, path: string[]): unknown {
  let current: unknown = value;
  for (const segment of path) {
    if (segment === "") continue;
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (Number.isNaN(index)) return undefined;
      current = current[index];
      continue;
    }
    if (current && typeof current === "object") {
      const record = current as Record<string, unknown>;
      current = record[segment];
      continue;
    }
    return undefined;
  }
  return current;
}

export function resolveEntryPropertyValue(column: string, entry: BasesEntry): unknown {
  if (column.startsWith("note.")) {
    return getNestedValue(entry.properties, column.slice(5).split("."));
  }
  if (column.startsWith("file.")) {
    return getNestedValue(entry.fileProperties, column.slice(5).split("."));
  }
  if (column.startsWith("formula.")) {
    return getNestedValue(entry.formulaValues, column.slice(8).split("."));
  }
  return getNestedValue(entry.properties, column.split("."));
}
