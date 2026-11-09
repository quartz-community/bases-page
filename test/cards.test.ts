import { describe, it, expect } from "vitest";
import { resolveImageSrc, type ResolveImageOpts } from "../src/components/views/cards";

describe("resolveImageSrc", () => {
  const slug = "plugins/index";
  const defaultOpts: ResolveImageOpts = { slug, allSlugs: [], linkResolution: "shortest" };

  describe("empty / falsy input", () => {
    it("returns empty src for empty string", () => {
      expect(resolveImageSrc("", defaultOpts)).toEqual({ src: "", isColor: false });
    });
  });

  describe("hex color detection", () => {
    it("detects 6-digit hex color", () => {
      expect(resolveImageSrc("#ff0000", defaultOpts)).toEqual({ src: "#ff0000", isColor: true });
    });

    it("detects 3-digit hex color", () => {
      expect(resolveImageSrc("#abc", defaultOpts)).toEqual({ src: "#abc", isColor: true });
    });

    it("is case-insensitive", () => {
      expect(resolveImageSrc("#AABBCC", defaultOpts)).toEqual({ src: "#AABBCC", isColor: true });
    });

    it("rejects invalid hex (too many digits)", () => {
      const result = resolveImageSrc("#1234567", defaultOpts);
      expect(result.isColor).toBe(false);
    });

    it("rejects non-hex strings starting with #", () => {
      const result = resolveImageSrc("#xyz", defaultOpts);
      expect(result.isColor).toBe(false);
    });
  });

  describe("wikilink resolution", () => {
    it("resolves simple wikilink", () => {
      const result = resolveImageSrc("[[giscus-results.png]]", defaultOpts);
      expect(result.isColor).toBe(false);
      expect(result.src).not.toContain("[[");
      expect(result.src).not.toContain("]]");
      expect(result.src).toContain("giscus-results.png");
    });

    it("resolves wikilink with path", () => {
      const result = resolveImageSrc("[[images/photo.png]]", defaultOpts);
      expect(result.isColor).toBe(false);
      expect(result.src).not.toContain("[[");
      expect(result.src).toContain("photo.png");
    });

    it("strips alias from wikilink", () => {
      const result = resolveImageSrc("[[my-image.png|My Image]]", defaultOpts);
      expect(result.isColor).toBe(false);
      expect(result.src).not.toContain("My Image");
      expect(result.src).toContain("my-image.png");
    });

    it("handles wikilink with spaces in path", () => {
      const result = resolveImageSrc("[[social image preview.png]]", defaultOpts);
      expect(result.isColor).toBe(false);
      expect(result.src).not.toContain("[[");
      expect(result.src).toContain("social-image-preview.png");
    });

    it("resolves wikilink via shortest-path with allSlugs", () => {
      const opts: ResolveImageOpts = {
        slug: "Base",
        allSlugs: ["images/giscus-results.png"],
        linkResolution: "shortest",
      };
      const result = resolveImageSrc("[[giscus-results.png]]", opts);
      expect(result.isColor).toBe(false);
      expect(result.src).toContain("images/giscus-results");
    });

    it("resolves wikilink via shortest-path with nested allSlugs", () => {
      const opts: ResolveImageOpts = {
        slug: "docs/plugins/index",
        allSlugs: ["assets/photos/vacation.jpg", "other/file"],
        linkResolution: "shortest",
      };
      const result = resolveImageSrc("[[vacation.jpg]]", opts);
      expect(result.isColor).toBe(false);
      expect(result.src).toContain("vacation");
    });
  });

  describe("external URLs", () => {
    it("passes through https URLs unchanged", () => {
      const url = "https://images.unsplash.com/photo-123?w=400";
      const result = resolveImageSrc(url, defaultOpts);
      expect(result).toEqual({ src: url, isColor: false });
    });

    it("passes through http URLs unchanged", () => {
      const url = "http://example.com/image.jpg";
      const result = resolveImageSrc(url, defaultOpts);
      expect(result).toEqual({ src: url, isColor: false });
    });

    it("passes through data URIs unchanged", () => {
      const dataUri = "data:image/png;base64,iVBORw0KGgo=";
      const result = resolveImageSrc(dataUri, defaultOpts);
      expect(result).toEqual({ src: dataUri, isColor: false });
    });
  });

  describe("plain relative paths", () => {
    it("passes through relative path as-is", () => {
      const result = resolveImageSrc("images/photo.png", defaultOpts);
      expect(result).toEqual({ src: "images/photo.png", isColor: false });
    });
  });
});

describe("cards view (bases-page#3, #10)", async () => {
  const { render } = await import("preact-render-to-string");
  const { h } = await import("preact");
  const { CardsView, coverAspectRatio } = await import("../src/components/views/cards");
  const entry = (slug: string, properties: Record<string, unknown>) => ({
    slug,
    title: slug,
    properties,
    fileProperties: {
      name: slug,
      basename: slug,
      path: `${slug}.md`,
      folder: "",
      ext: "md",
      tags: [],
      links: [],
    },
    formulaValues: {},
  });
  const renderCards = (view: Record<string, unknown>) =>
    render(
      h(CardsView as never, {
        entries: [
          entry("c-land", { cover: "#ff8800", related: "[[c-sq]]" }),
          entry("c-none", { related: "[[c-sq]]" }),
        ],
        view: { type: "cards", ...view },
        basesData: {},
        total: 2,
        locale: "en-US",
        slug: "index",
        allSlugs: ["c-land", "c-none", "c-sq"],
        linkResolution: "shortest",
      }),
    );

  it("imageAspectRatio is height / width, default 1", () => {
    expect(coverAspectRatio({ imageAspectRatio: 0.5 })).toBe(0.5);
    expect(coverAspectRatio({})).toBe(1);
    const html = renderCards({ image: "note.cover", imageAspectRatio: 0.5, order: ["file.name"] });
    expect(html).toContain("aspect-ratio:1 / 0.5");
  });

  it("a card is not a link around other links", () => {
    const html = renderCards({ image: "note.cover", order: ["file.name", "note.related"] });
    expect(html).not.toMatch(/<a [^>]*class="[^"]*bases-card"/);
    expect(html.match(/class="bases-card"/g)).toHaveLength(2);
    // a cover for every card when the view has an image, empty without one
    expect(html.match(/bases-card-cover/g)).toHaveLength(2);
    expect(html).toContain("bases-card-cover is-empty");
    expect(html).toContain("background-color:#ff8800");
  });

  it("order: [] shows the cover alone, with a link over the card", () => {
    const html = renderCards({ image: "note.cover", order: [] });
    expect(html).not.toContain("bases-card-title");
    expect(html).toContain('aria-label="c-land"');
  });
});
