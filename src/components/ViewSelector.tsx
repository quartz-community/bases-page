import type { ComponentChild } from "preact";

import type { BasesView } from "../types";

export interface ViewSelectorProps {
  views: BasesView[];
  activeIndex: number;
  locale: string;
}

export function ViewSelector({ views, activeIndex }: ViewSelectorProps): ComponentChild {
  if (views.length <= 1) return null;

  return (
    <div class="bases-view-tabs" role="tablist">
      {views.map((view, index) => (
        <button
          type="button"
          role="tab"
          aria-selected={index === activeIndex ? "true" : "false"}
          class={index === activeIndex ? "is-active" : ""}
          data-view-index={index}
        >
          {view.name ?? view.type}
        </button>
      ))}
    </div>
  );
}
