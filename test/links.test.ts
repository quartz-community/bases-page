import { describe, it, expect } from "vitest";
import { render } from "preact-render-to-string";
import { h, Fragment } from "preact";
import { evaluate, TagValue } from "../src/compiler";
import type { EvalContext } from "../src/compiler";
import { renderCellValue } from "../src/components/shared/cell";

// Obsidian 1.15.0 (obsidian-bases-probe vault q6-link; community PR #17).
const context: EvalContext = {
  note: {},
  file: {
    name: "probe",
    basename: "probe",
    path: "probe.md",
    folder: "",
    ext: "md",
    tags: [],
    links: [],
  },
  formula: {},
};
const html = (value: unknown) =>
  render(
    h(
      Fragment,
      null,
      renderCellValue(value, {
        slug: "probe",
        allSlugs: ["probe", "note-a", "sub/note-b"],
        linkResolution: "shortest",
      }),
    ),
  );
const cell = (expression: string) => html(evaluate(expression, context));

describe("link() and link values", () => {
  it("a URL with any scheme is an external link with the real href", () => {
    expect(cell('link("https://example.com", "Label")')).toBe(
      '<a href="https://example.com" class="external external-link" target="_blank" rel="noopener noreferrer">Label</a>',
    );
    expect(cell('link("mailto:a@example.com")')).toContain('href="mailto:a@example.com"');
    expect(cell('link("obsidian://open?vault=x")')).toContain('href="obsidian://open?vault=x"');
    expect(cell('link("https://" + "example.com", "example.com")')).toContain(">example.com</a>");
  });

  it("other targets are internal links; a heading link shows `note > Heading`", () => {
    expect(cell('link("note-a")')).toMatch(/class="internal internal-link">note-a<\/a>/);
    expect(cell('link("note-a", "Alias")')).toContain(">Alias</a>");
    expect(cell('link("note-a#Heading")')).toContain(">note-a > Heading</a>");
    expect(cell('link("note-b")')).not.toContain("broken");
    expect(cell('link("missing-note")')).toContain("internal internal-link broken");
  });

  it("file.asLink() shows the file's path as Obsidian does", () => {
    expect(cell("file.asLink()")).toContain(">probe.md</a>");
    expect(cell('file.asLink("Display")')).toContain(">Display</a>");
  });

  it("a Markdown link string stays text; a string that is a URL is a link", () => {
    expect(html("[x](https://example.com/md)")).not.toContain("<a");
    expect(html("https://example.com/prop")).toContain('href="https://example.com/prop"');
  });
});

describe("tags in views (community PR #18)", () => {
  const tagHtml = (value: unknown, column?: string, tagPages = true) =>
    render(
      h(
        Fragment,
        null,
        renderCellValue(
          value,
          { slug: "notes/probe", allSlugs: [], linkResolution: "shortest", tagPages },
          column,
        ),
      ),
    );

  it("tag columns render tag-page links, text without # in its own case", () => {
    const out = tagHtml(["#Src/OSE/cc", "alpha"], "file.tags");
    expect(out).toContain('<a href="../tags/src/ose/cc" class="internal tag-link"');
    expect(out).toContain(">Src/OSE/cc</a>");
    expect(out).toContain('href="../tags/alpha"');
    expect(out).not.toContain("#");
    expect(tagHtml("#x", "note.tags")).toContain(">x</a>");
    expect(tagHtml(["#x"], "status")).toContain("#x");
  });

  it("a tag value from a formula renders as a tag", () => {
    expect(tagHtml(new TagValue("#beta/gamma"))).toContain(
      '<a href="../tags/beta/gamma" class="internal tag-link" data-slug="tags/beta/gamma">beta/gamma</a>',
    );
  });

  it("without tag pages, or for an invalid tag, a tag is text", () => {
    expect(tagHtml(["#x"], "tags", false)).toBe(
      '<span class="bases-list"><span class="tag-link">x</span></span>',
    );
    expect(tagHtml(["#a, b"], "tags")).not.toContain("<a");
  });
});
