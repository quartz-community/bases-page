import { describe, it, expect } from "vitest";
import { evaluate } from "../src/compiler";
import type { EvalContext } from "../src/compiler";

const eventDate = new Date(2024, 0, 15, 12, 0, 0);

const context = {
  note: {
    title: "Test Note",
    status: "done",
    numbers: [1, 2, 3],
    nested: [
      [1, 2],
      [3, 4],
    ],
    mixed: [3, 1, 2],
    dupes: [1, 2, 2, 3, 3],
    meta: { key: "value", count: 5 },
    eventDate,
  },
  file: {
    name: "test.md",
    basename: "test",
    path: "notes/test.md",
    folder: "notes",
    ext: "md",
    tags: ["todo", "important", "work/project"],
    links: ["other-note"],
    created: "2024-01-01T00:00:00Z",
    modified: "2024-06-15T00:00:00Z",
  },
  formula: {},
};

describe("string methods", () => {
  it("handles string operations", () => {
    expect(evaluate('"hello".contains("ell")', context)).toBe(true);
    expect(evaluate('"hello".startsWith("he")', context)).toBe(true);
    expect(evaluate('"hello".endsWith("lo")', context)).toBe(true);
    expect(evaluate('"Hello".lower()', context)).toBe("hello");
    expect(evaluate('"hello".upper()', context)).toBe("HELLO");
    expect(evaluate('"  trim  ".trim()', context)).toBe("trim");
    expect(evaluate('"hello".replace("l", "x")', context)).toBe("hexxo");
    expect(evaluate('"hello".slice(1, 4)', context)).toBe("ell");
    expect(evaluate('"".isEmpty()', context)).toBe(true);
    expect(evaluate('"ha".repeat(3)', context)).toBe("hahaha");
    expect(evaluate('"abc".reverse()', context)).toBe("cba");
  });

  it("handles containsAll and containsAny", () => {
    expect(evaluate('"hello world".containsAll("hello", "world")', context)).toBe(true);
    expect(evaluate('"hello world".containsAll("hello", "missing")', context)).toBe(false);
    expect(evaluate('"hello world".containsAny("missing", "world")', context)).toBe(true);
    expect(evaluate('"hello world".containsAny("missing", "nope")', context)).toBe(false);
  });

  it("handles split", () => {
    expect(evaluate('"a,b,c".split(",")', context)).toEqual(["a", "b", "c"]);
    expect(evaluate('"hello".split("")', context)).toEqual(["h", "e", "l", "l", "o"]);
  });

  it("handles title case", () => {
    expect(evaluate('"hello world".title()', context)).toBe("Hello World");
    expect(evaluate('"the quick brown fox".title()', context)).toBe("The Quick Brown Fox");
  });

  it("converts string to file value with asFile", () => {
    const result = evaluate('"notes/example.md".asFile()', context);
    expect(result).toEqual({
      name: "example.md",
      basename: "example",
      path: "notes/example.md",
      folder: "notes",
      ext: "md",
      tags: [],
      links: [],
    });
  });

  it("handles asFile on filename without folder", () => {
    const result = evaluate('"readme.md".asFile()', context);
    expect(result).toEqual({
      name: "readme.md",
      basename: "readme",
      path: "readme.md",
      folder: "",
      ext: "md",
      tags: [],
      links: [],
    });
  });

  it("resolves file metadata from _fileLookup", () => {
    const lookup = new Map<string, EvalContext["file"]>();
    lookup.set("notes/example.md", {
      name: "example.md",
      basename: "example",
      path: "notes/example.md",
      folder: "notes",
      ext: "md",
      tags: ["species", "lineage"],
      links: ["other"],
      embeds: ["image.png"],
    });
    const ctx = { ...context, _fileLookup: lookup };
    const result = evaluate('"notes/example.md".asFile()', ctx) as Record<string, unknown>;
    expect(result).toBeDefined();
    expect(result.tags).toEqual(["species", "lineage"]);
    expect(result.links).toEqual(["other"]);
    expect(result.embeds).toEqual(["image.png"]);
  });

  it("resolves _fileLookup without .md extension", () => {
    const lookup = new Map<string, EvalContext["file"]>();
    lookup.set("notes/example.md", {
      name: "example.md",
      basename: "example",
      path: "notes/example.md",
      folder: "notes",
      ext: "md",
      tags: ["tagged"],
      links: [],
    });
    const ctx = { ...context, _fileLookup: lookup };
    const result = evaluate('"notes/example".asFile()', ctx) as Record<string, unknown>;
    expect(result).toBeDefined();
    expect(result.tags).toEqual(["tagged"]);
    expect(result.path).toBe("notes/example.md");
  });

  it("falls back to skeleton when path not in _fileLookup", () => {
    const lookup = new Map<string, EvalContext["file"]>();
    const ctx = { ...context, _fileLookup: lookup };
    const result = evaluate('"unknown/file.md".asFile()', ctx) as Record<string, unknown>;
    expect(result).toBeDefined();
    expect(result.tags).toEqual([]);
    expect(result.path).toBe("unknown/file.md");
  });

  it("resolves short basename via _fileLookup", () => {
    const lookup = new Map<string, EvalContext["file"]>();
    lookup.set("Compendium/Species/Dryad/Apple.md", {
      name: "Apple.md",
      basename: "Apple",
      path: "Compendium/Species/Dryad/Apple.md",
      folder: "Compendium/Species/Dryad",
      ext: "md",
      tags: ["lineage", "dryad"],
      links: [],
    });
    const ctx = { ...context, _fileLookup: lookup };
    const result = evaluate('"Apple".asFile()', ctx) as Record<string, unknown>;
    expect(result).toBeDefined();
    expect(result.basename).toBe("Apple");
    expect(result.tags).toEqual(["lineage", "dryad"]);
    expect(result.path).toBe("Compendium/Species/Dryad/Apple.md");
  });

  it("resolves path suffix via _fileLookup", () => {
    const lookup = new Map<string, EvalContext["file"]>();
    lookup.set("Compendium/Species/Dryad/Apple.md", {
      name: "Apple.md",
      basename: "Apple",
      path: "Compendium/Species/Dryad/Apple.md",
      folder: "Compendium/Species/Dryad",
      ext: "md",
      tags: ["lineage"],
      links: [],
    });
    const ctx = { ...context, _fileLookup: lookup };
    const result = evaluate('"Dryad/Apple".asFile()', ctx) as Record<string, unknown>;
    expect(result).toBeDefined();
    expect(result.basename).toBe("Apple");
    expect(result.path).toBe("Compendium/Species/Dryad/Apple.md");
  });

  it.each([
    "[[Apple]]",
    "[[Apple|Red Apple]]",
    "[[Apple#Lineage]]",
    "[[Apple#Lineage|Red Apple]]",
    " [[Apple]] ",
  ])("resolves wikilink-wrapped value %s via _fileLookup", (link) => {
    const lookup = new Map<string, EvalContext["file"]>();
    lookup.set("Compendium/Species/Dryad/Apple.md", {
      name: "Apple.md",
      basename: "Apple",
      path: "Compendium/Species/Dryad/Apple.md",
      folder: "Compendium/Species/Dryad",
      ext: "md",
      tags: ["lineage"],
      links: [],
    });
    const ctx = { ...context, _fileLookup: lookup };
    const result = evaluate(`"${link}".asFile()`, ctx) as Record<string, unknown>;
    expect(result.path).toBe("Compendium/Species/Dryad/Apple.md");
  });

  it("matches wikilink frontmatter against this.file via asFile()", () => {
    const lookup = new Map<string, EvalContext["file"]>();
    lookup.set("places/tavern.md", {
      name: "tavern.md",
      basename: "tavern",
      path: "places/tavern.md",
      folder: "places",
      ext: "md",
      tags: [],
      links: [],
    });
    const ctx = {
      ...context,
      _fileLookup: lookup,
      self: { file: { name: "tavern", path: "places/tavern.md", folder: "places", ext: "md" } },
      note: { ...context.note, location: "[[tavern]]" },
    };
    expect(evaluate("location.asFile().path == this.file.path", ctx)).toBe(true);
    expect(evaluate("location.asFile().asLink()", ctx)).toBe("[[places/tavern]]");
  });

  it.each([
    ["[[Apple]] and [[Pear]]", "[[Apple]] and [[Pear]]"],
    ["[[missing#h]]", "missing"],
    ["[[missing|x]]", "missing"],
    ["[[ ]]", "[[ ]]"],
  ])("falls back to a skeleton for unresolvable %s with path %s", (value, path) => {
    const ctx = { ...context, _fileLookup: new Map<string, EvalContext["file"]>() };
    const result = evaluate(`"${value}".asFile()`, ctx) as Record<string, unknown>;
    expect(result.path).toBe(path);
  });
});

describe("number methods", () => {
  it("handles numeric operations", () => {
    expect(evaluate("3.1415.toFixed(2)", context)).toBe("3.14");
    expect(evaluate("3.6.round()", context)).toBe(4);
    expect(evaluate("3.2.floor()", context)).toBe(3);
    expect(evaluate("3.2.ceil()", context)).toBe(4);
    expect(evaluate("(-3).abs()", context)).toBe(3);
  });

  it("supports round with digits", () => {
    expect(evaluate("3.14159.round(2)", context)).toBe(3.14);
    expect(evaluate("3.14159.round(4)", context)).toBe(3.1416);
  });

  it("reports isEmpty for numbers", () => {
    expect(evaluate("42 .isEmpty()", context)).toBe(false);
  });
});

describe("date functions", () => {
  it("creates dates", () => {
    expect(evaluate('date("2024-01-15")', context)).toBeInstanceOf(Date);
    expect(evaluate("now()", context)).toBeInstanceOf(Date);
  });

  it("provides date methods", () => {
    expect(evaluate("eventDate.year()", context)).toBe(2024);
    expect(evaluate("eventDate.month()", context)).toBe(1);
    expect(evaluate("eventDate.day()", context)).toBe(15);
    expect(evaluate("eventDate.time()", context)).toBe("12:00:00");
  });

  it("provides date.date() method", () => {
    expect(evaluate("eventDate.date()", context)).toBe("2024-01-15");
  });

  it("formats dates with tokens", () => {
    expect(evaluate('eventDate.format("YYYY-MM-DD")', context)).toBe("2024-01-15");
    expect(evaluate('eventDate.format("HH:mm")', context)).toBe("12:00");
    expect(evaluate('eventDate.format("M/D/YY")', context)).toBe("1/15/24");
  });

  it("supports date field access as properties", () => {
    expect(evaluate("eventDate.year", context)).toBe(2024);
    expect(evaluate("eventDate.month", context)).toBe(1);
    expect(evaluate("eventDate.day", context)).toBe(15);
    expect(evaluate("eventDate.hour", context)).toBe(12);
    expect(evaluate("eventDate.minute", context)).toBe(0);
    expect(evaluate("eventDate.second", context)).toBe(0);
  });

  it("supports date arithmetic", () => {
    const oneDay = 86_400_000;
    const result = evaluate(`eventDate + ${oneDay}`, context);
    expect(result).toBeInstanceOf(Date);
    expect((result as Date).getDate()).toBe(16);
  });

  it("supports date subtraction", () => {
    const result = evaluate('date("2024-01-15") - date("2024-01-10")', context);
    expect(result).toBe(5 * 86_400_000);
  });

  it("compares dates", () => {
    expect(evaluate('date("2024-01-15") > date("2024-01-10")', context)).toBe(true);
    expect(evaluate('date("2024-01-15") == date("2024-01-15")', context)).toBe(true);
    expect(evaluate('date("2024-01-10") < date("2024-01-15")', context)).toBe(true);
  });
});

describe("list functions and methods", () => {
  it("creates lists", () => {
    expect(evaluate("list(42)", context)).toEqual([42]);
    expect(evaluate("list([1, 2])", context)).toEqual([1, 2]);
  });

  it("supports list methods on context values", () => {
    expect(evaluate("numbers.sum()", context)).toBe(6);
    expect(evaluate("numbers.mean()", context)).toBe(2);
    expect(evaluate("numbers.count()", context)).toBe(3);
    expect(evaluate("numbers.min()", context)).toBe(1);
    expect(evaluate("numbers.max()", context)).toBe(3);
  });

  it("supports contains", () => {
    expect(evaluate("numbers.contains(2)", context)).toBe(true);
    expect(evaluate("numbers.contains(99)", context)).toBe(false);
  });

  it("matches self-context wikilinks in list.contains", () => {
    const ctx = {
      ...context,
      self: {
        file: {
          name: "Paul Chambers",
          path: "artists/Paul Chambers.md",
          folder: "artists",
          ext: "md",
        },
      },
      note: { ...context.note, list: ["[[Paul Chambers]]"] },
    };
    expect(evaluate("list.contains(this)", ctx)).toBe(true);
  });

  it("matches self-context heading wikilinks in list.contains", () => {
    const ctx = {
      ...context,
      self: {
        file: {
          name: "Paul Chambers",
          path: "artists/Paul Chambers.md",
          folder: "artists",
          ext: "md",
        },
      },
      note: {
        ...context.note,
        list: ["[[Paul Chambers#Bio|Paul]]"],
        padded: ["[[ Paul Chambers.md ]]"],
        lowercase: ["[[paul chambers]]"],
        other: ["[[Paul Simon]]", "[[Chambers]]"],
      },
    };
    expect(evaluate("list.contains(this)", ctx)).toBe(true);
    expect(evaluate("padded.contains(this)", ctx)).toBe(true);
    expect(evaluate("lowercase.contains(this)", ctx)).toBe(true);
    expect(evaluate("other.contains(this)", ctx)).toBe(false);
  });

  it("matches self-context bare names and path-qualified wikilinks", () => {
    const self = {
      file: {
        name: "Paul Chambers",
        path: "artists/Paul Chambers.md",
        folder: "artists",
        ext: "md",
      },
    };
    const bareCtx = { ...context, self, note: { ...context.note, list: ["Paul Chambers"] } };
    expect(evaluate("list.contains(this)", bareCtx)).toBe(true);
    const pathCtx = {
      ...context,
      self,
      note: { ...context.note, list: ["[[jazz/Paul Chambers]]"] },
    };
    expect(evaluate("list.contains(this)", pathCtx)).toBe(true);
  });

  it("matches self-context in global contains", () => {
    const ctx = {
      ...context,
      self: {
        file: {
          name: "Paul Chambers",
          path: "artists/Paul Chambers.md",
          folder: "artists",
          ext: "md",
        },
      },
      note: { ...context.note, list: ["[[Paul Chambers]]"] },
    };
    expect(evaluate("contains(list, this)", ctx)).toBe(true);
  });

  it("matches self-context against slug-format links (Quartz crawl-links compat)", () => {
    const self = {
      file: {
        name: "Paul Chambers",
        path: "artists/Paul Chambers.md",
        folder: "artists",
        ext: "md",
      },
    };
    const slugCtx = {
      ...context,
      self,
      note: { ...context.note, list: ["artists/paul-chambers"] },
    };
    expect(evaluate("list.contains(this)", slugCtx)).toBe(true);

    const shortSlugCtx = {
      ...context,
      self,
      note: { ...context.note, list: ["paul-chambers"] },
    };
    expect(evaluate("list.contains(this)", shortSlugCtx)).toBe(true);

    const globalCtx = {
      ...context,
      self,
      note: { ...context.note, list: ["artists/paul-chambers"] },
    };
    expect(evaluate("contains(list, this)", globalCtx)).toBe(true);
  });

  it("resolves self names from wrapper and file values", () => {
    const wrapperCtx = {
      ...context,
      note: {
        ...context.note,
        list: ["[[Miles Davis]]"],
        wrapper: { file: { name: "Miles Davis" } },
      },
    };
    expect(evaluate("list.contains(wrapper)", wrapperCtx)).toBe(true);

    const fileValue = {
      name: "Ella Fitzgerald",
      basename: "Ella Fitzgerald",
      path: "singers/Ella Fitzgerald.md",
      folder: "singers",
      ext: "md",
      tags: [],
      links: [],
    };
    const fileCtx = {
      ...context,
      note: { ...context.note, list: ["[[Ella Fitzgerald]]"], fileValue },
    };
    expect(evaluate("list.contains(fileValue)", fileCtx)).toBe(true);
  });

  it("preserves normal contains behavior for string and number values", () => {
    const ctx = {
      ...context,
      note: { ...context.note, list: ["alpha", "beta"], numericList: [1, 2, 3] },
    };
    expect(evaluate('list.contains("alpha")', ctx)).toBe(true);
    expect(evaluate("numericList.contains(2)", ctx)).toBe(true);
  });

  it("supports containsAll and containsAny", () => {
    expect(evaluate("numbers.containsAll(1, 3)", context)).toBe(true);
    expect(evaluate("numbers.containsAll(1, 99)", context)).toBe(false);
    expect(evaluate("numbers.containsAny(99, 2)", context)).toBe(true);
    expect(evaluate("numbers.containsAny(98, 99)", context)).toBe(false);
  });

  it("supports flat", () => {
    expect(evaluate("nested.flat()", context)).toEqual([1, 2, 3, 4]);
  });

  it("supports isEmpty", () => {
    expect(evaluate("[].isEmpty()", context)).toBe(true);
    expect(evaluate("numbers.isEmpty()", context)).toBe(false);
  });

  it("supports join", () => {
    expect(evaluate('numbers.join(", ")', context)).toBe("1, 2, 3");
    expect(evaluate('numbers.join("-")', context)).toBe("1-2-3");
    expect(evaluate("numbers.join()", context)).toBe("1, 2, 3");
  });

  it("supports reverse", () => {
    expect(evaluate("numbers.reverse()", context)).toEqual([3, 2, 1]);
  });

  it("supports slice", () => {
    expect(evaluate("numbers.slice(1)", context)).toEqual([2, 3]);
    expect(evaluate("numbers.slice(0, 2)", context)).toEqual([1, 2]);
  });

  it("supports sort", () => {
    expect(evaluate("mixed.sort()", context)).toEqual([1, 2, 3]);
  });

  it("supports unique", () => {
    expect(evaluate("dupes.unique()", context)).toEqual([1, 2, 3]);
  });
});

describe("duration and file helpers", () => {
  it("parses durations with short units", () => {
    expect(evaluate('duration("1h")', context)).toBe(3_600_000);
    expect(evaluate('duration("30m")', context)).toBe(1_800_000);
  });

  it("parses durations with long-form units", () => {
    expect(evaluate('duration("1 hour")', context)).toBe(3_600_000);
    expect(evaluate('duration("2 hours")', context)).toBe(7_200_000);
    expect(evaluate('duration("1 day")', context)).toBe(86_400_000);
    expect(evaluate('duration("3 days")', context)).toBe(3 * 86_400_000);
    expect(evaluate('duration("1 week")', context)).toBe(604_800_000);
    expect(evaluate('duration("2 weeks")', context)).toBe(2 * 604_800_000);
    expect(evaluate('duration("1 month")', context)).toBe(2_592_000_000);
    expect(evaluate('duration("1 year")', context)).toBe(31_536_000_000);
    expect(evaluate('duration("30 seconds")', context)).toBe(30_000);
    expect(evaluate('duration("5 minutes")', context)).toBe(300_000);
  });

  it("builds file objects", () => {
    expect(evaluate('file("notes/test.md")', context)).toEqual({
      name: "test.md",
      basename: "test",
      path: "notes/test.md",
      folder: "notes",
      ext: "md",
      tags: [],
      links: [],
    });
  });

  it("supports file methods", () => {
    expect(evaluate('file("notes/test.md").inFolder("notes")', context)).toBe(true);
    expect(evaluate('file.hasTag("todo")', context)).toBe(true);
    expect(evaluate('file.hasLink("other-note")', context)).toBe(true);
    expect(evaluate('file.inFolder("notes/archive")', context)).toBe(false);
    expect(evaluate('file.hasProperty("status")', context)).toBe(true);
  });

  it("hasProperty returns true for null/falsy values (Obsidian compat)", () => {
    const ctx = {
      ...context,
      note: { ...context.note, nullProp: null, falseProp: false, zeroProp: 0, emptyProp: "" },
    };
    expect(evaluate('file.hasProperty("nullProp")', ctx)).toBe(true);
    expect(evaluate('file.hasProperty("falseProp")', ctx)).toBe(true);
    expect(evaluate('file.hasProperty("zeroProp")', ctx)).toBe(true);
    expect(evaluate('file.hasProperty("emptyProp")', ctx)).toBe(true);
    expect(evaluate('file.hasProperty("nonExistent")', ctx)).toBe(false);
  });

  it("supports file.asLink()", () => {
    expect(evaluate("file.asLink()", context)).toBe("[[notes/test]]");
  });

  it("supports file.asLink() with display text", () => {
    expect(evaluate('file.asLink("My Note")', context)).toBe("[[notes/test|My Note]]");
    expect(evaluate('file.asLink("Custom")', context)).toBe("[[notes/test|Custom]]");
  });

  it("supports hasTag with nested tag matching", () => {
    expect(evaluate('file.hasTag("work")', context)).toBe(true);
    expect(evaluate('file.hasTag("work/project")', context)).toBe(true);
    expect(evaluate('file.hasTag("missing")', context)).toBe(false);
  });

  it("supports hasTag with variadic args", () => {
    expect(evaluate('file.hasTag("todo", "important")', context)).toBe(true);
    expect(evaluate('file.hasTag("todo", "missing")', context)).toBe(false);
  });

  it("hasTag is case-insensitive", () => {
    expect(evaluate('file.hasTag("TODO")', context)).toBe(true);
    expect(evaluate('file.hasTag("Important")', context)).toBe(true);
    expect(evaluate('file.hasTag("WORK/PROJECT")', context)).toBe(true);
    expect(evaluate('file.hasTag("Work")', context)).toBe(true);
    expect(evaluate('file.hasTag("MISSING")', context)).toBe(false);
  });
});

describe("link helpers", () => {
  it("formats links and media", () => {
    expect(evaluate('link("page")', context)).toBe("[[page]]");
    expect(evaluate('link("page", "display")', context)).toBe("[[page|display]]");
    expect(evaluate('image("photo.png")', context)).toBe("![[photo.png]]");
    expect(evaluate('icon("star")', context)).toBe(":star:");
  });

  it("extracts path from file objects in link()", () => {
    expect(evaluate("link(file)", context)).toBe("[[notes/test]]");
    expect(evaluate('link(file, "Custom")', context)).toBe("[[notes/test|Custom]]");
  });

  it("extracts basename from file object used as display in link()", () => {
    expect(evaluate('link("other/page", file)', context)).toBe("[[other/page|test]]");
  });

  it("handles file object in both arguments of link()", () => {
    expect(evaluate("link(file, file)", context)).toBe("[[notes/test|test]]");
  });

  it("extracts path from file objects in image()", () => {
    expect(evaluate("image(file)", context)).toBe("![[notes/test]]");
  });

  it("strips .md extension from file object path in link()", () => {
    const fileWithMd = evaluate('link(file("notes/doc.md"))', context);
    expect(fileWithMd).toBe("[[notes/doc]]");
  });

  // Obsidian renders link("[[page#h|alias]]") as a link to page#h, without the alias.
  it("keeps an existing wikilink's target and heading in link()", () => {
    expect(evaluate('link("[[page]]")', context)).toBe("[[page]]");
    expect(evaluate('link("[[page|alias]]")', context)).toBe("[[page]]");
    expect(evaluate('link("[[page#Heading|alias]]")', context)).toBe("[[page#Heading]]");
    expect(evaluate('link("[[page]]", "shown")', context)).toBe("[[page|shown]]");
    expect(evaluate('"[[missing|x]]".asFile().asLink()', context)).toBe("[[missing]]");
  });

  it("strips .md extension from file object path in image()", () => {
    const fileWithMd = evaluate('image(file("notes/doc.md"))', context);
    expect(fileWithMd).toBe("![[notes/doc]]");
  });
});

describe("any-target methods", () => {
  it("evaluates isTruthy", () => {
    expect(evaluate('"hello".isTruthy()', context)).toBe(true);
    expect(evaluate('"".isTruthy()', context)).toBe(false);
    expect(evaluate("42 .isTruthy()", context)).toBe(true);
    expect(evaluate("0 .isTruthy()", context)).toBe(false);
    expect(evaluate("numbers.isTruthy()", context)).toBe(true);
  });

  it("evaluates isType", () => {
    expect(evaluate('"hello".isType("string")', context)).toBe(true);
    expect(evaluate('"hello".isType("number")', context)).toBe(false);
    expect(evaluate('42 .isType("number")', context)).toBe(true);
    expect(evaluate('numbers.isType("list")', context)).toBe(true);
    expect(evaluate('eventDate.isType("date")', context)).toBe(true);
    expect(evaluate('file.isType("file")', context)).toBe(true);
  });

  it("evaluates toString", () => {
    expect(evaluate('"hello".toString()', context)).toBe("hello");
    expect(evaluate("42 .toString()", context)).toBe("42");
    expect(evaluate("numbers.toString()", context)).toBe("1, 2, 3");
  });
});

describe("object methods", () => {
  it("supports isEmpty", () => {
    expect(evaluate("meta.isEmpty()", context)).toBe(false);
  });

  it("supports keys", () => {
    expect(evaluate("meta.keys()", context)).toEqual(["key", "count"]);
  });

  it("supports values", () => {
    expect(evaluate("meta.values()", context)).toEqual(["value", 5]);
  });
});
