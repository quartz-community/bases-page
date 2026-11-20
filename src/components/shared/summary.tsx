import type { ComponentChild } from "preact";
import type { SummaryType } from "../../types";
import { evaluate } from "../../compiler";
import type { EvalContext } from "../../compiler/interpreter";
import { Duration, ErrorValue, dateToString } from "../../compiler/values";

/**
 * Obsidian's built-in summaries, by the name a `.base` file stores. Names are case-sensitive:
 * anything else is looked up in the base's top-level `summaries:` (custom summaries), and a name
 * found in neither shows as empty, as in Obsidian.
 */
export const BUILTIN_SUMMARIES = new Set([
  "Average",
  "Min",
  "Max",
  "Sum",
  "Range",
  "Median",
  "Stddev",
  "Earliest",
  "Latest",
  "Checked",
  "Unchecked",
  "Empty",
  "Filled",
  "Unique",
]);

const isEmpty = (value: unknown) =>
  value === undefined ||
  value === null ||
  value === "" ||
  (Array.isArray(value) && value.length === 0);

const toDate = (value: unknown): Date | undefined =>
  value instanceof Date && !Number.isNaN(value.getTime()) ? value : undefined;

// Obsidian shows built-in numeric summaries to at most 2 decimals (custom ones as computed)
const round2 = (value: number) => Math.round(value * 100) / 100;

/** A built-in summary of a column's values; null where Obsidian shows "Empty". */
function builtinSummary(values: unknown[], summary: string): unknown {
  const filled = values.filter((value) => !isEmpty(value));
  switch (summary) {
    case "Empty":
      return values.length - filled.length;
    case "Filled":
      return filled.length || null;
    case "Checked":
      return values.filter((value) => value === true).length;
    case "Unchecked":
      return values.filter((value) => value === false).length;
    case "Unique":
      // an empty value counts as one value
      return new Set(values.map((value) => (isEmpty(value) ? "" : summaryKey(value)))).size;
  }

  if (summary === "Earliest" || summary === "Latest" || summary === "Range") {
    const dates = values.map(toDate).filter((date): date is Date => date !== undefined);
    if (dates.length > 0) {
      const times = dates.map((date) => date.getTime());
      const earliest = new Date(Math.min(...times));
      const latest = new Date(Math.max(...times));
      // Obsidian shows these as a date with a time, e.g. 2023-11-20T00:00:00
      if (summary === "Earliest") return dateToString(earliest, true);
      if (summary === "Latest") return dateToString(latest, true);
      return Duration.fromMilliseconds(latest.getTime() - earliest.getTime());
    }
    if (summary !== "Range") return null;
  }

  const numbers = filled
    .map((value) => (typeof value === "number" ? value : Number.NaN))
    .filter((value) => !Number.isNaN(value));
  if (numbers.length === 0) return null;
  const sum = numbers.reduce((acc, value) => acc + value, 0);
  switch (summary) {
    case "Sum":
      return round2(sum);
    case "Average": {
      // as values.mean(): an empty value counts (as 0)
      const empty = values.filter((value) => value === null || value === undefined).length;
      return round2(sum / (numbers.length + empty));
    }
    case "Min":
      return round2(Math.min(...numbers));
    case "Max":
      return round2(Math.max(...numbers));
    case "Range":
      return round2(Math.max(...numbers) - Math.min(...numbers));
    case "Median": {
      const sorted = [...numbers].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return round2(sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!);
    }
    case "Stddev": {
      // population standard deviation
      const mean = sum / numbers.length;
      const variance =
        numbers.reduce((acc, value) => acc + Math.pow(value - mean, 2), 0) / numbers.length;
      return round2(Math.sqrt(variance));
    }
  }
  return null;
}

function summaryKey(value: unknown): string {
  if (value instanceof Date) return `date:${value.getTime()}`;
  if (Array.isArray(value)) return `list:${value.map(summaryKey).join("\u0000")}`;
  if (value && typeof value === "object") return `object:${JSON.stringify(value)}`;
  return `${typeof value}:${String(value)}`;
}

/**
 * The value of summary `summary` over a column's `values` (one per entry, empty ones
 * included). `customSummaries` is the base's top-level `summaries:` (name → formula), whose
 * formulas see the values as `values`. Returns null where Obsidian shows "Empty", and an
 * ErrorValue for a formula that fails.
 */
export function computeSummary(
  values: unknown[],
  summary: SummaryType,
  customSummaries: Record<string, string> = {},
  locale?: string,
): unknown {
  if (BUILTIN_SUMMARIES.has(summary)) return builtinSummary(values, summary);
  const formula = customSummaries[summary];
  if (typeof formula !== "string") return null;
  const context: EvalContext = {
    note: {},
    file: {} as EvalContext["file"],
    formula: {},
    values,
    locale,
  };
  const result = evaluate(formula, context);
  return result === undefined ? null : result;
}

type ValueRenderer = (value: unknown) => ComponentChild;

/** A summary cell's content as Obsidian shows it: the summary's name, then its value. */
export function renderSummary(
  name: string,
  value: unknown,
  emptyLabel: string,
  renderValue: ValueRenderer,
): ComponentChild {
  return (
    <span class="bases-summary">
      <span class="bases-summary-name">{name}</span>{" "}
      <span class="bases-summary-value">{renderSummaryValue(value, emptyLabel, renderValue)}</span>
    </span>
  );
}

function renderSummaryValue(
  value: unknown,
  emptyLabel: string,
  renderValue: ValueRenderer,
): ComponentChild {
  if (value === null || value === undefined) {
    return <span class="bases-summary-empty">{emptyLabel}</span>;
  }
  if (value instanceof ErrorValue) {
    // Obsidian: "Error: <message>"
    return <span class="bases-formula-error">Error: {value.message}</span>;
  }
  if (Array.isArray(value)) {
    // in a summary, a list shows its empty items as "null"
    return value
      .map((item) =>
        item === null || item === undefined
          ? "null"
          : item instanceof Date
            ? dateToString(item)
            : String(item),
      )
      .join(", ");
  }
  // a date shows as 2024-03-05 (2024-03-05T14:30:00 with a time), not in the locale's format
  if (value instanceof Date) return dateToString(value);
  return renderValue(value);
}
