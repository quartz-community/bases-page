import { describe, it, expect } from "vitest";
import { render } from "preact-render-to-string";
import { h, Fragment } from "preact";
import { evaluate } from "../src/compiler";
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
