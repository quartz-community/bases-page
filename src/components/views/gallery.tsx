import type { ViewRenderer, ViewTypeRegistration } from "../../types";
import type { FullSlug } from "@quartz-community/types";
import { i18n } from "../../i18n";
import { resolveEntryPropertyValue } from "../shared/cell";
import { transformLink } from "@quartz-community/utils";
import { resolveImageSrc } from "./cards";
import type { ResolveImageOpts } from "./cards";

function formatMessage(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, String(value)),
    template,
  );
}

const GalleryView: ViewRenderer = ({
  entries,
  view,
  total,
  locale,
  slug,
  allSlugs,
  linkResolution,
}) => {
  const imageProperty = typeof view.image === "string" ? view.image : undefined;
  const localeStrings = i18n(locale).components.bases;
  const columns =
    typeof view.cardSize === "number" && view.cardSize > 0 ? Math.round(view.cardSize) : 3;
  const gridStyle = { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` };
  const imageOpts: ResolveImageOpts = { slug, allSlugs, linkResolution };
  const transformOpts = { strategy: linkResolution, allSlugs: allSlugs as FullSlug[] };

  return (
    <div class="bases-gallery-wrapper">
      {entries.length < total && (
        <div class="bases-view-meta">
          {formatMessage(localeStrings.showingCount, {
            count: entries.length,
            total,
          })}
        </div>
      )}
      <div class="bases-gallery" style={gridStyle}>
        {entries.map((entry) => {
          const imageValue = imageProperty
            ? resolveEntryPropertyValue(imageProperty, entry)
            : undefined;
          const rawImage = imageValue ? String(imageValue) : "";
          const { src: imageSrc, isColor } = resolveImageSrc(rawImage, imageOpts);
          return (
            <div class="bases-gallery-item">
              <div class="bases-gallery-image">
                {imageSrc && !isColor ? (
                  <img src={imageSrc} alt={entry.title} loading="lazy" />
                ) : imageSrc && isColor ? (
                  <span class="bases-gallery-placeholder" style={{ background: imageSrc }} />
                ) : (
                  <span
                    class="bases-gallery-placeholder"
                    role="img"
                    aria-label={localeStrings.noImage}
                  />
                )}
              </div>
              <div class="bases-gallery-title">
                <a
                  href={transformLink(slug as FullSlug, entry.slug, transformOpts)}
                  class="internal internal-link"
                  data-slug={entry.slug}
                >
                  {entry.title}
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const galleryViewRegistration: ViewTypeRegistration = {
  id: "gallery",
  name: "Gallery",
  icon: "image",
  render: GalleryView,
};

export { GalleryView };
