import type { Element, Root } from "hast";
import { visit } from "unist-util-visit";

/**
 * The site's link settings (Quartz's `configuration.links`), as the links built-in applies them
 * to a note's links. Bases render their links when the page is rendered, after that built-in ran,
 * so {@link decorateLinks} applies the same settings to them.
 */
export interface LinkSettings {
  openLinksInNewTab: boolean;
  externalLinkIcon: boolean;
  lazyLoad: boolean;
}

/** Quartz's `configuration.links` (true or an object: enabled; false: disabled) as settings. */
export function linkSettings(links: unknown): LinkSettings {
  if (links === false) {
    return { openLinksInNewTab: false, externalLinkIcon: false, lazyLoad: false };
  }
  const config = (links && typeof links === "object" ? links : {}) as Record<string, unknown>;
  if (config.enabled === false) {
    return { openLinksInNewTab: false, externalLinkIcon: false, lazyLoad: false };
  }
  return {
    openLinksInNewTab: config.openLinksInNewTab === true,
    externalLinkIcon: config.externalLinkIcon !== false,
    lazyLoad: config.lazyLoad === true,
  };
}

// the links built-in's external-link icon
const EXTERNAL_ICON_PATH =
  "M320 0H288V64h32 82.7L201.4 265.4 178.7 288 224 333.3l22.6-22.6L448 109.3V192v32h64V192 32 0H480 320zM32 32H0V64 480v32H32 456h32V480 352 320H424v32 96H64V96h96 32V32H160 32z";

function externalIcon(): Element {
  return {
    type: "element",
    tagName: "svg",
    properties: {
      ariaHidden: "true",
      className: ["external-icon"],
      style: "max-width:0.8em;max-height:0.8em",
      viewBox: "0 0 512 512",
    },
    children: [
      { type: "element", tagName: "path", properties: { d: EXTERNAL_ICON_PATH }, children: [] },
    ],
  };
}

const classesOf = (node: Element) => {
  const value: unknown = node.properties?.className;
  return Array.isArray(value)
    ? value.map(String)
    : typeof value === "string"
      ? value.split(" ")
      : [];
};

/** The page a relative href on page `slug` points to (as Quartz's `data-slug`). */
function targetSlug(href: string, slug: string): string | undefined {
  try {
    const url = new URL(href, `https://base.com/${slug.replace(/^\/+/, "")}`);
    let path = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    if (path === "" || path.endsWith("/")) path += "index";
    return path;
  } catch {
    return undefined;
  }
}

/**
 * Applies the site's link settings to bases output on page `slug`: external links get the
 * external-link icon and open in a new tab as configured, internal links get `data-slug` (for
 * popovers and SPA navigation), and images load lazily as configured.
 */
export function decorateLinks(tree: Root | Element, settings: LinkSettings, slug: string): void {
  visit(tree, "element", (node: Element) => {
    const props = (node.properties ??= {});
    if (node.tagName === "a" && typeof props.href === "string") {
      const classes = classesOf(node);
      if (classes.includes("external")) {
        if (settings.openLinksInNewTab) props.target = "_blank";
        else delete props.target;
        const hasIcon = node.children.some(
          (child) => child.type === "element" && classesOf(child).includes("external-icon"),
        );
        if (settings.externalLinkIcon && !hasIcon) node.children.push(externalIcon());
      } else if (classes.includes("internal") && props.dataSlug === undefined) {
        const href = props.href;
        if (!href.startsWith("#")) {
          const target = targetSlug(href, slug);
          if (target) props.dataSlug = target;
        }
      }
    }
    if (node.tagName === "img") {
      if (settings.lazyLoad) props.loading = "lazy";
      else delete props.loading;
    }
  });
}
