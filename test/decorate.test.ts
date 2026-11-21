import { describe, it, expect } from "vitest";
import type { Element, Root } from "hast";
import { fromHtml } from "hast-util-from-html";
import { visit } from "unist-util-visit";
import { decorateLinks, linkSettings } from "../src/components/shared/decorate";

const elements = (tree: Root, tagName: string) => {
  const found: Element[] = [];
  visit(tree, "element", (node: Element) => {
    if (node.tagName === tagName) found.push(node);
  });
  return found;
};
const run = (html: string, links: unknown, slug = "notes/host") => {
  const tree = fromHtml(html, { fragment: true });
  decorateLinks(tree, linkSettings(links), slug);
  return tree;
};
const external =
  '<a href="https://example.com" class="external external-link" target="_blank" rel="noopener noreferrer">example</a>';
const icons = (tree: Root) =>
  elements(tree, "svg").filter((svg) =>
    (svg.properties.className as string[]).includes("external-icon"),
  );

describe("bases links follow the site's link settings (configuration.links)", () => {
  it("defaults: external icon, same tab, no lazy loading", () => {
    const tree = run(`${external}<img src="./a.png" loading="lazy">`, undefined);
    expect(icons(tree)).toHaveLength(1);
    expect(elements(tree, "a")[0]!.properties.target).toBeUndefined();
    expect(elements(tree, "img")[0]!.properties.loading).toBeUndefined();
  });

  it("openLinksInNewTab, externalLinkIcon: false, lazyLoad", () => {
    const tree = run(`${external}<img src="./a.png">`, {
      openLinksInNewTab: true,
      externalLinkIcon: false,
      lazyLoad: true,
    });
    expect(elements(tree, "a")[0]!.properties.target).toBe("_blank");
    expect(icons(tree)).toHaveLength(0);
    expect(elements(tree, "img")[0]!.properties.loading).toBe("lazy");
  });

  it("the icon is added once", () => {
    const tree = fromHtml(external, { fragment: true });
    decorateLinks(tree, linkSettings(true), "x");
    decorateLinks(tree, linkSettings(true), "x");
    expect(icons(tree)).toHaveLength(1);
  });

  it("internal links get data-slug, relative to the page", () => {
    const tree = run(
      '<a href="../books/one" class="internal internal-link">one</a><a href="./" class="internal">home</a><a href="#x" class="internal">x</a>',
      true,
    );
    expect(elements(tree, "a").map((a) => a.properties.dataSlug)).toEqual([
      "books/one",
      "notes/index",
      undefined,
    ]);
  });

  it("links disabled: no decoration", () => {
    expect(icons(run(external, false))).toHaveLength(0);
  });
});
