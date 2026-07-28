import type {
  QuartzComponent,
  QuartzComponentConstructor,
  QuartzComponentProps,
} from "@quartz-community/types";
import type { BasesData, BasesPageOptions } from "../types";
import { resolveBasesEntries } from "../resolver";
import type { EvalContext } from "../compiler";
import { i18n } from "../i18n";
import { registerCustomViews, viewRegistry } from "../registry";
import { ViewSelector } from "./ViewSelector";
import { registerBuiltinViews } from "./views";
import style from "./styles/bases.scss";
// @ts-expect-error inline script import handled by esbuild plugin
import script from "./scripts/bases.inline.ts";

let builtinViewsRegistered = false;

export default ((opts?: BasesPageOptions) => {
  const Component: QuartzComponent = (props: QuartzComponentProps) => {
    const locale = props.cfg?.locale ?? "en-US";
    const localeStrings = i18n(locale).components.bases;
    const fileData = props.fileData as {
      basesData?: BasesData;
      basesOptions?: BasesPageOptions;
      basesSelfContext?: EvalContext["self"];
    };
    const basesData = fileData.basesData;
    const basesOptions = fileData.basesOptions ?? opts;
    const basesSelfContext = fileData.basesSelfContext;
    const slug = (props.fileData.slug as string) ?? "";
    const rawSlugs = ((props.ctx as Record<string, unknown>)?.allSlugs as string[]) ?? [];
    const baseSlugs = new Set(rawSlugs.filter((s) => s.endsWith(".base")));
    const baseAliases = new Set([...baseSlugs].map((s) => s.replace(/\.base$/, "")));
    const allSlugs = rawSlugs.filter((s) => !baseSlugs.has(s) && !baseAliases.has(s));
    const linkResolution = basesOptions?.linkResolution ?? "shortest";

    if (!basesData) {
      return <div class="bases-page bases-empty">{localeStrings.noData}</div>;
    }

    const views = basesData.views ?? [];
    if (views.length === 0) {
      return <div class="bases-page bases-empty">{localeStrings.noViews}</div>;
    }

    // Resolve entries once up front (rather than per-view during render) so
    // the default-view choice below can inspect them too.
    const viewEntries = views.map((view) =>
      resolveBasesEntries(basesData, props.allFiles, view, basesSelfContext),
    );

    const hasLeafletPins = (entries: (typeof viewEntries)[number]["entries"]) =>
      entries.some((entry) => {
        const markers = (entry.properties as Record<string, unknown> | undefined)?.marker;
        return (
          Array.isArray(markers) &&
          markers.some(
            (marker) =>
              typeof marker === "object" &&
              marker !== null &&
              typeof (marker as Record<string, unknown>).coordinates === "string",
          )
        );
      });

    // A leaflet-map view with at least one pin is a more useful default
    // than an empty/generic table, so prefer it — unless the site owner
    // explicitly configured a defaultViewType, which always wins.
    const explicitPreferredType = basesOptions?.defaultViewType;
    const leafletIndexWithPins = explicitPreferredType
      ? -1
      : views.findIndex(
          (view, index) =>
            view.type === "leaflet-map" && hasLeafletPins(viewEntries[index]?.entries ?? []),
        );

    const preferredType = explicitPreferredType ?? "table";
    const initialIndex =
      leafletIndexWithPins >= 0
        ? leafletIndexWithPins
        : Math.max(
            0,
            views.findIndex((view) => view.type === preferredType),
          );
    if (!builtinViewsRegistered) {
      registerBuiltinViews();
      builtinViewsRegistered = true;
    }

    if (basesOptions?.customViews) {
      registerCustomViews(basesOptions.customViews);
    }

    // Collect CSS from custom view registrations (deduplicated by type)
    const activeTypes = new Set(views.map((v) => v.type));
    const viewCssChunks: string[] = [];
    for (const typeId of activeTypes) {
      const reg = viewRegistry.get(typeId);
      if (reg?.css) viewCssChunks.push(reg.css);
    }

    return (
      <div class="bases-page" data-initial-view={initialIndex}>
        {viewCssChunks.length > 0 && (
          <style dangerouslySetInnerHTML={{ __html: viewCssChunks.join("\n") }} />
        )}
        <ViewSelector views={views} activeIndex={initialIndex} locale={locale} />
        <div class="bases-view-container">
          {views.map((view, index) => {
            const { entries, total } = viewEntries[index] ?? { entries: [], total: 0 };
            const registration = viewRegistry.get(view.type);
            const Renderer = registration?.render;
            return (
              <div
                class={`bases-view ${index === initialIndex ? "is-active" : ""}`}
                data-view-index={index}
                data-view-type={view.type}
              >
                {entries.length === 0 ? (
                  <div class="bases-empty">{localeStrings.noData}</div>
                ) : Renderer ? (
                  <Renderer
                    entries={entries}
                    view={view}
                    basesData={basesData}
                    total={total}
                    locale={locale}
                    slug={slug}
                    allSlugs={allSlugs}
                    linkResolution={linkResolution}
                    options={registration.options}
                  />
                ) : (
                  <div class="bases-empty">Unknown view type: {view.type}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  Component.css = style;
  // Collect afterDOMLoaded scripts from all registered views so they get
  // bundled into postscript.js (SPA-compatible) instead of inline <script> tags.
  const viewScripts = viewRegistry
    .getAll()
    .map((reg) => reg.afterDOMLoaded)
    .filter((s): s is string => typeof s === "string" && s.length > 0);
  Component.afterDOMLoaded = [script, ...viewScripts];

  return Component;
}) satisfies QuartzComponentConstructor<BasesPageOptions>;
