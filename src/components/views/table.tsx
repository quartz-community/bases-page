import type { BasesEntry, ViewRenderer, ViewTypeRegistration } from "../../types";
import type { FullSlug } from "@quartz-community/types";
import { i18n } from "../../i18n";
import {
  formatValue,
  getColumnLabel,
  getColumns,
  isEmptyValue,
  renderCellValue,
  resolveEntryPropertyValue,
} from "../shared/cell";
import { computeSummary } from "../shared/summary";
import { transformLink } from "@quartz-community/utils";

function formatMessage(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, String(value)),
    template,
  );
}

function groupEntries(
  entries: BasesEntry[],
  groupProperty: string | undefined,
  emptyLabel: string,
): Map<string, BasesEntry[]> | null {
  if (!groupProperty) return null;
  const groups = new Map<string, BasesEntry[]>();
  for (const entry of entries) {
    const rawValue = resolveEntryPropertyValue(groupProperty, entry);
    const label = isEmptyValue(rawValue) ? emptyLabel : formatValue(rawValue);
    const key = label || emptyLabel;
    const existing = groups.get(key);
    if (existing) {
      existing.push(entry);
    } else {
      groups.set(key, [entry]);
    }
  }
  return groups.size > 0 ? groups : null;
}

function renderRow(
  entry: BasesEntry,
  columns: string[],
  view: Parameters<ViewRenderer>[0]["view"],
  slug: string,
  allSlugs: string[],
  linkResolution: "absolute" | "relative" | "shortest",
) {
  const transformOpts = { strategy: linkResolution, allSlugs: allSlugs as FullSlug[] };
  const ctx = { slug, allSlugs, linkResolution };
  return (
    <tr>
      {columns.map((column) => {
        const value = resolveEntryPropertyValue(column, entry);
        const display = formatValue(value);
        const isPrimary = column === "file.name" || column === "title";
        const columnWidth = view.columnSize?.[column];
        const style = columnWidth
          ? { width: `${columnWidth}px`, minWidth: `${columnWidth}px` }
          : undefined;
        return (
          <td data-value={display} style={style}>
            {isPrimary ? (
              <a
                href={transformLink(slug as FullSlug, entry.slug, transformOpts)}
                class="internal internal-link"
                data-slug={entry.slug}
              >
                {display || entry.title}
              </a>
            ) : (
              renderCellValue(value, ctx)
            )}
          </td>
        );
      })}
    </tr>
  );
}

const TableView: ViewRenderer = ({
  entries,
  view,
  basesData,
  total,
  locale,
  slug,
  allSlugs,
  linkResolution,
}) => {
  const columns = getColumns(view, basesData, entries);
  const summaries = view.summaries ?? {};
  const hasSummary = Object.keys(summaries).length > 0;
  const localeStrings = i18n(locale).components.bases;
  const groupProperty = view.groupBy?.property;
  const groupPropertyLabel = groupProperty ? getColumnLabel(groupProperty, basesData) : "";
  const groups = groupEntries(entries, groupProperty, localeStrings.uncategorized);

  return (
    <div class="bases-table-wrapper">
      <div class="bases-view-meta">
        {formatMessage(localeStrings.showingCount, {
          count: entries.length,
          total,
        })}
      </div>
      <table class="bases-table" data-view-type="table">
        <thead>
          <tr>
            {columns.map((column) => {
              const columnWidth = view.columnSize?.[column];
              const style = columnWidth
                ? { width: `${columnWidth}px`, minWidth: `${columnWidth}px` }
                : undefined;
              return (
                <th data-column={column} data-sortable="true" style={style}>
                  <span class="bases-table-header">{getColumnLabel(column, basesData)}</span>
                  <span class="bases-table-header-sort" aria-hidden="true" />
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {groups
            ? Array.from(groups.entries()).map(([label, groupEntries]) => (
                <>
                  <tr class="bases-table-group-header">
                    <td colSpan={columns.length}>
                      {groupPropertyLabel && (
                        <span class="bases-table-group-property">{groupPropertyLabel} </span>
                      )}
                      <span class="bases-table-group-label">{label}</span>
                      <span class="bases-table-group-count">{groupEntries.length}</span>
                    </td>
                  </tr>
                  {groupEntries.map((entry) =>
                    renderRow(entry, columns, view, slug, allSlugs, linkResolution),
                  )}
                </>
              ))
            : entries.map((entry) =>
                renderRow(entry, columns, view, slug, allSlugs, linkResolution),
              )}
        </tbody>
        {hasSummary && (
          <tfoot>
            <tr class="bases-summary-row">
              {columns.map((column) => {
                const summary = summaries[column];
                if (!summary) return <td />;
                const values = entries.map((entry) => resolveEntryPropertyValue(column, entry));
                return <td>{computeSummary(values, summary)}</td>;
              })}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
};

export const tableViewRegistration: ViewTypeRegistration = {
  id: "table",
  name: "Table",
  icon: "table",
  render: TableView,
};

export { TableView };
