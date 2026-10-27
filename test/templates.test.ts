import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { parseBasesData } from "../src/parser";
import { resolveBasesEntries } from "../src/resolver";

import type { EvalContext } from "../src/compiler";
import type { BasesData, BasesView, FilePath, FullSlug, QuartzPluginData } from "../src/types";

const fixturePath = fileURLToPath(new URL("./fixtures/Templates.base", import.meta.url));

const raw = readFileSync(fixturePath, "utf8");
const parsed = parseBasesData(raw);

if (!parsed) {
  throw new Error("Could not parse Templates.base");
}

const bases: BasesData = parsed;

function note(
  path: string,
  type: string,
  properties: Record<string, unknown> = {},
  links: string[] = [],
): QuartzPluginData {
  const slug = path.replace(/\.md$/, "");

  return {
    slug: slug as FullSlug,
    filePath: path as FilePath,
    relativePath: path,
    frontmatter: {
      type,
      ...properties,
    },
    links,
  } as unknown as QuartzPluginData;
}

function self(path: string): NonNullable<EvalContext["self"]> {
  const filename = path.split("/").pop()!;
  const basename = filename.replace(/\.[^.]+$/, "");
  const folder = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";

  return {
    file: {
      name: basename,
      basename,
      path,
      folder,
      ext: filename.split(".").pop() ?? "",
      tags: [],
      links: [],
    },
  };
}

function getView(name: string): BasesView {
  const view = bases.views?.find((v) => v.name === name);

  if (!view) {
    throw new Error(`Missing view: ${name}`);
  }

  return view;
}

function query(
  viewName: string,
  files: QuartzPluginData[],
  context: NonNullable<EvalContext["self"]>,
): string[] {
  return resolveBasesEntries(bases, files, getView(viewName), context).entries.map(
    (entry) => entry.slug,
  );
}

describe("Templates.base compatibility", () => {
  it("parses all 19 views", () => {
    expect(bases.views).toHaveLength(19);
  });

  it("resolves list(lob).contains(this)", () => {
    const files = [
      note("Brands/Alpha.md", "brand", {
        lob: ["[[LOB/Industrial]]"],
      }),
      note("Brands/Beta.md", "brand", {
        lob: ["[[LOB/Consumer]]"],
      }),
      note("Categories/Category.md", "category", {
        lob: ["[[LOB/Industrial]]"],
      }),
    ];

    const context = self("LOB/Industrial.md");

    expect(query("lob-brands", files, context)).toEqual(["Brands/Alpha"]);

    expect(query("lob-categories", files, context)).toEqual(["Categories/Category"]);
  });

  it("resolves company-related property links", () => {
    const files = [
      note("Brands/Alpha.md", "brand", {
        parent: "[[Companies/Acme]]",
      }),
      note("Sites/Factory.md", "site", {
        parent: "[[Companies/Acme]]",
      }),
      note("Contacts/Alice.md", "contact", {
        company: "[[Companies/Acme]]",
      }),
      note("Brands/Other.md", "brand", {
        parent: "[[Companies/Other]]",
      }),
    ];

    const context = self("Companies/Acme.md");

    expect(query("company-brands", files, context)).toEqual(["Brands/Alpha"]);

    expect(query("company-sites", files, context)).toEqual(["Sites/Factory"]);

    expect(query("company-contacts", files, context)).toEqual(["Contacts/Alice"]);
  });

  it("resolves brand-related property links", () => {
    const files = [
      note("Products/Widget.md", "product", {
        brand: "[[Brands/Alpha]]",
      }),
      note("Contacts/Alice.md", "contact", {
        brands: ["[[Brands/Alpha]]"],
      }),
      note("Products/Other.md", "product", {
        brand: "[[Brands/Beta]]",
      }),
    ];

    const context = self("Brands/Alpha.md");

    expect(query("brand-products", files, context)).toEqual(["Products/Widget"]);

    expect(query("brand-contacts", files, context)).toEqual(["Contacts/Alice"]);
  });

  it("resolves site-related property links", () => {
    const files = [
      note("Contacts/Alice.md", "contact", {
        site: "[[Sites/Factory]]",
      }),
      note("FieldNotes/Visit.md", "field-note", {
        site: "[[Sites/Factory]]",
      }),
      note("Contacts/Bob.md", "contact", {
        site: "[[Sites/Other]]",
      }),
    ];

    const context = self("Sites/Factory.md");

    expect(query("site-contacts", files, context)).toEqual(["Contacts/Alice"]);

    expect(query("site-field-notes", files, context)).toEqual(["FieldNotes/Visit"]);
  });

  it("resolves linked views and excludes self", () => {
    const files = [
      note("Companies/Acme.md", "company", {}, ["Companies/Acme"]),
      note("Notes/Meeting.md", "meeting", {}, ["Companies/Acme"]),
      note("Contacts/Alice.md", "contact", {}, ["Companies/Acme"]),
      note("Brands/Alpha.md", "brand", {}, ["Companies/Acme"]),
      note("Sites/Factory.md", "site", {}, ["Companies/Acme"]),
      note("Notes/Unrelated.md", "note", {}, ["Companies/Other"]),
    ];

    const context = self("Companies/Acme.md");

    expect(query("company-linked", files, context)).toEqual(["Notes/Meeting"]);
  });

  it("resolves brand-field-notes", () => {
    const files = [
      note("FieldNotes/Visit.md", "field-note", {}, ["Brands/Alpha"]),
      note("FieldNotes/Other.md", "field-note", {}, ["Brands/Beta"]),
    ];

    expect(query("brand-field-notes", files, self("Brands/Alpha.md"))).toEqual([
      "FieldNotes/Visit",
    ]);
  });

  it("resolves contact-field-notes", () => {
    const files = [
      note("FieldNotes/Visit.md", "field-note", {}, ["Contacts/Alice"]),
      note("FieldNotes/Other.md", "field-note", {}, ["Contacts/Bob"]),
    ];

    expect(query("contact-field-notes", files, self("Contacts/Alice.md"))).toEqual([
      "FieldNotes/Visit",
    ]);
  });

  it("resolves site-linked", () => {
    const files = [
      note("Notes/Meeting.md", "meeting", {}, ["Sites/Factory"]),
      note("Contacts/Alice.md", "contact", {}, ["Sites/Factory"]),
      note("FieldNotes/Visit.md", "field-note", {}, ["Sites/Factory"]),
    ];

    expect(query("site-linked", files, self("Sites/Factory.md"))).toEqual(["Notes/Meeting"]);
  });

  it("resolves product and unit linked views", () => {
    const files = [
      note("Notes/ProductReview.md", "review", {}, ["Products/Widget"]),
      note("Units/Unit1.md", "unit", {}, ["Categories/Industrial"]),
      note("Notes/Other.md", "note", {}, ["Categories/Industrial"]),
    ];

    expect(query("products-linked", files, self("Products/Widget.md"))).toEqual([
      "Notes/ProductReview",
    ]);

    expect(query("unit-category", files, self("Categories/Industrial.md"))).toEqual([
      "Units/Unit1",
    ]);

    expect(query("units-linked", files, self("Units/Unit1.md"))).toEqual([]);
  });
});
