import type { BasesEntry, ViewRenderer, ViewTypeRegistration } from "../../types";
import type { FullSlug } from "@quartz-community/types";
import { i18n } from "../../i18n";
import {
  formatValue,
  getColumnLabel,
  getColumns,
  isEmptyValue,
  isNoteProperty,
  renderCellValue,
  resolveEntryPropertyValue,
} from "../shared/cell";
import { computeSummary, renderSummary } from "../shared/summary";
import { groupViewEntries } from "../shared/group";
import { coerceDateString } from "../../compiler/values";
import { transformLink } from "@quartz-community/utils";

function formatMessage(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, String(value)),
    template,
  );
}

function renderRow(
  entry: BasesEntry,
  columns: string[],
  view: Parameters<ViewRenderer>[0]["view"],
  slug: string,
  allSlugs: string[],
  linkResolution: "absolute" | "relative" | "shortest",
  locale?: string,
  tagPages?: boolean,
) {
  const transformOpts = { strategy: linkResolution, allSlugs: allSlugs as FullSlug[] };
  const ctx = { slug, allSlugs, linkResolution, locale, tagPages };
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
              renderCellValue(value, ctx, column)
            )}
          </td>
        );
      })}
    </tr>
  );
}

const ROW_HEIGHTS: Record<string, string> = { medium: "60px", tall: "120px", extra: "240px" };

const TableView: ViewRenderer = ({
  entries,
  view,
  basesData,
  total,
  locale,
  slug,
  allSlugs,
  linkResolution,
  tagPages,
}) => {
  const columns = getColumns(view, basesData, entries);
  const summaries = view.summaries ?? {};
  const hasSummary = columns.some((column) => summaries[column]);
  const localeStrings = i18n(locale).components.bases;
  const ctx = { slug, allSlugs, linkResolution, locale, tagPages };
  // one cell per column: the column's summary over `rows`, as Obsidian shows it
  const summaryCells = (rows: BasesEntry[]) =>
    columns.map((column) => {
      const summary = summaries[column];
      if (!summary) return <td />;
      const values = rows.map((entry) => {
        const value = resolveEntryPropertyValue(column, entry);
        // a note property holding an ISO date is a date, as in a cell
        return isNoteProperty(column) ? coerceDateString(value) : value;
      });
      const value = computeSummary(values, summary, basesData.summaries, locale);
      return (
        <td>
          {renderSummary(summary, value, localeStrings.summaryEmpty, (shown) =>
            renderCellValue(shown, ctx),
          )}
        </td>
      );
    });
  const groupProperty = view.groupBy?.property;
  const groupPropertyLabel = groupProperty ? getColumnLabel(groupProperty, basesData) : "";
  const groups = groupViewEntries(entries, view, localeStrings.uncategorized);
  // rowHeight: Obsidian's row heights (short, the default, is one line)
  const rowHeight = ROW_HEIGHTS[String(view.rowHeight ?? "")];

  return (
    <div class="bases-table-wrapper">
      <div class="bases-view-meta">
        {formatMessage(localeStrings.showingCount, {
          count: entries.length,
          total,
        })}
      </div>
      <table
        class="bases-table"
        data-view-type="table"
        data-row-height={rowHeight ? String(view.rowHeight) : undefined}
        style={rowHeight ? { "--bases-table-row-height": rowHeight } : undefined}
      >
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
            ? groups.map(({ label, entries: groupEntries }) => (
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
                  {hasSummary && (
                    // as in Obsidian: each group's summaries, under its heading
                    <tr class="bases-summary-row bases-group-summary-row">
                      {summaryCells(groupEntries)}
                    </tr>
                  )}
                  {groupEntries.map((entry) =>
                    renderRow(
                      entry,
                      columns,
                      view,
                      slug,
                      allSlugs,
                      linkResolution,
                      locale,
                      tagPages,
                    ),
                  )}
                </>
              ))
            : entries.map((entry) =>
                renderRow(entry, columns, view, slug, allSlugs, linkResolution, locale, tagPages),
              )}
        </tbody>
        {hasSummary && (
          <tfoot>
            <tr class="bases-summary-row">{summaryCells(entries)}</tr>
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
