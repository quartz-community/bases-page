import type { ComponentChild } from "preact";

import type { BasesView } from "../types";

export interface ViewSelectorProps {
  views: BasesView[];
  activeIndex: number;
  locale: string;
  /** Prefix of the tabs' and views' ids ({@link viewTabId}, {@link viewPanelId}). */
  idPrefix?: string;
}

/** The id of the tab of view `index`. */
export function viewTabId(idPrefix: string, index: number): string {
  return `${idPrefix}-tab-${index}`;
}

/** The id of view `index` (the tab's panel). */
export function viewPanelId(idPrefix: string, index: number): string {
  return `${idPrefix}-view-${index}`;
}

/**
 * The view tabs, as WAI-ARIA tabs: each tab controls its view (`role="tabpanel"`, rendered by
 * the caller with {@link viewPanelAttributes}); only the selected tab is in the tab order, and the
 * arrow keys, Home and End move between tabs (`bases.inline.ts`).
 */
export function ViewSelector({
  views,
  activeIndex,
  idPrefix = "bases",
}: ViewSelectorProps): ComponentChild {
  if (views.length <= 1) return null;

  return (
    <div class="bases-view-tabs" role="tablist" aria-orientation="horizontal">
      {views.map((view, index) => (
        <button
          type="button"
          role="tab"
          id={viewTabId(idPrefix, index)}
          aria-controls={viewPanelId(idPrefix, index)}
          aria-selected={index === activeIndex ? "true" : "false"}
          tabindex={index === activeIndex ? 0 : -1}
          class={index === activeIndex ? "is-active" : ""}
          data-view-index={index}
        >
          {view.name ?? view.type}
        </button>
      ))}
    </div>
  );
}

/**
 * The ARIA attributes of view `index`: a tab panel labelled by its tab, when there are tabs (more
 * than one view).
 */
export function viewPanelAttributes(
  idPrefix: string,
  index: number,
  viewCount: number,
): Record<string, string | number> {
  if (viewCount <= 1) return {};
  return {
    id: viewPanelId(idPrefix, index),
    role: "tabpanel",
    "aria-labelledby": viewTabId(idPrefix, index),
    tabindex: 0,
  };
}
