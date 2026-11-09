import type { ComponentChild } from "preact";
import type { FullSlug } from "@quartz-community/types";

import type { BasesData, BasesEntry, BasesView } from "../../types";
import { renderTextWithLinks } from "./links";
import { transformLink, slugifyPath } from "@quartz-community/utils";
import { Duration, ErrorValue } from "../../compiler/values";

type RenderCtx = {
  slug: string;
  allSlugs: string[];
  linkResolution: "absolute" | "relative" | "shortest";
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
  if (Array.isArray(value)) return value.map((item) => String(item)).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function renderCellValue(value: unknown, ctx: RenderCtx): ComponentChild {
  if (value === null || value === undefined) {
    return <span class="bases-empty">—</span>;
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

  if (value instanceof Duration) {
    return <span class="bases-duration">{value.toString()}</span>;
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
          {value.basename}
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
