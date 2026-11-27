import { describe, it, expect } from "vitest";
import { evaluate, ErrorValue, UrlValue } from "../src/compiler";
import type { EvalContext } from "../src/compiler";

type File = EvalContext["file"];
const file = (path: string, extra: Partial<File> = {}): File => {
  const name = path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/, "");
  const folder = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "/";
  return { name, basename: name, path, folder, ext: "md", tags: [], links: [], ...extra };
};
const alice = file("people/Alice.md");
const bob = file("people/Bob.md");
const lookup = new Map<string, File>([
  ["people/Alice.md", alice],
  ["people/Alice", alice],
  ["Alice", alice],
  ["people/Bob.md", bob],
]);
const ctx = (
  note: Record<string, unknown> = {},
  extra: Partial<EvalContext> = {},
): EvalContext => ({
  note,
  file: file("notes/test.md", { links: ["people/alice", "topic/index"] }),
  formula: {},
  _fileLookup: lookup,
  ...extra,
});
const ev = (expression: string, note?: Record<string, unknown>, extra?: Partial<EvalContext>) =>
  evaluate(expression, ctx(note, extra));
const message = (expression: string, note?: Record<string, unknown>) =>
  (ev(expression, note) as ErrorValue).message;

describe("unknown methods name the value's type, as Obsidian does", () => {
  it.each([
    ["(5).nope()", "Number"],
    ["true.nope()", "Boolean"],
    ['date("2024-03-05").nope()', "Date"],
    ["[1].nope()", "List"],
    ["file.nope()", "File"],
    ["o.nope()", "Object"],
    ['duration("1d").nope()', "Duration"],
    ['link("https://x.org").nope()', "Url"],
    ["/a/.nope()", "Regexp"],
  ])("%s → type %s", (expression, type) => {
    expect(message(expression, { o: { a: 1 } })).toBe(
      `Cannot find function "nope" on type ${type}`,
    );
  });

  it("type errors in date() and duration() name the argument's type", () => {
    expect(message("date(5)")).toBe(
      'Type error in "date", parameter "input". Expected String, given Number.',
    );
    expect(message("date(true)")).toBe(
      'Type error in "date", parameter "input". Expected String, given Boolean.',
    );
    expect(message("date([1])")).toBe(
      'Type error in "date", parameter "input". Expected String, given List.',
    );
    expect(message("duration(o)", { o: { a: 1 } })).toBe(
      'Type error in "duration", parameter "input". Expected String, given Object.',
    );
    expect(message('duration(date("2024-03-05"))')).toBe(
      'Type error in "duration", parameter "input". Expected String, given Date.',
    );
    expect(message('date(duration("1d"))')).toBe(
      'Type error in "date", parameter "input". Expected String, given Duration.',
    );
    expect(ev("date(missing)")).toBeUndefined();
    expect(ev("duration(missing)")).toBeUndefined();
    expect(String(ev('duration(duration("2d"))'))).toBe("2 days");
  });
});

describe("global functions", () => {
  it("min() and max() take numbers or one list", () => {
    expect(ev("max([1, 5, 3])")).toBe(5);
    expect(ev("max(1, 5, 3)")).toBe(5);
    expect(ev("min([4, 2])")).toBe(2);
    expect(ev("max([1], [9])")).toBeUndefined();
    expect(ev("min([])")).toBeUndefined();
  });

  it("list() wraps a value; an empty value is an empty list", () => {
    expect(ev("list(missing)")).toEqual([]);
    expect(ev('list("a")')).toEqual(["a"]);
    expect(ev("list([1, 2])")).toEqual([1, 2]);
  });

  it("escapeHTML() escapes the five special characters", () => {
    expect(ev(`escapeHTML("<a href='x'>\\"&\\"</a>")`)).toBe(
      "&lt;a href=&#39;x&#39;&gt;&quot;&amp;&quot;&lt;/a&gt;",
    );
    expect(ev("escapeHTML(missing)")).toBe("");
  });

  it("link() to a note, with a label; to a URL; nothing for nothing", () => {
    expect(ev('link("people/Alice")')).toBe("[[people/Alice]]");
    expect(ev('link("people/Alice", "Al")')).toBe("[[people/Alice|Al]]");
    expect(ev('link("[[Alice#Bio|x]]")')).toBe("[[Alice#Bio]]");
    expect(ev("link(file)")).toBe("[[notes/test]]");
    expect(ev('link("people/Alice", file)')).toBe("[[people/Alice|test]]");
    expect(ev("link(missing)")).toBe("");
    const url = ev('link("https://example.com", "Site")') as UrlValue;
    expect(url).toBeInstanceOf(UrlValue);
    expect([url.url, url.display]).toEqual(["https://example.com", "Site"]);
    expect((ev('link("mailto:a@b.c")') as UrlValue).display).toBeUndefined();
  });

  it("file(path) names the file", () => {
    expect(ev('file("a/b.c.pdf")')).toMatchObject({
      name: "b.c.pdf",
      basename: "b.c",
      fullname: "b.c.pdf",
      ext: "pdf",
      folder: "a",
      path: "a/b.c.pdf",
    });
    expect(ev('file(" notes/x.md ")')).toMatchObject({ name: "x", path: "notes/x.md" });
    expect(ev('file("top")')).toMatchObject({ name: "top", ext: "", folder: "/" });
    expect(ev('file(".hidden")')).toMatchObject({ basename: ".hidden", ext: "" });
    expect(ev('file("  ")')).toBeUndefined();
    expect(ev("file(5)")).toBeUndefined();
  });

  it("if() without an else is empty", () => {
    expect(ev("if(false, 1)")).toBeUndefined();
    expect(ev("if(1, 2, 3)")).toBe(2);
  });

  it("contains() on something that is neither a list nor text is false", () => {
    expect(ev("contains(5, 5)")).toBe(false);
    expect(ev('contains("Hello", "ell")')).toBe(true);
  });
});

describe("file methods", () => {
  it("hasTag ignores an empty tag", () => {
    const tagged = ctx({}, { file: file("n.md", { tags: ["#a/b"] }) });
    expect(evaluate('file.hasTag("")', tagged)).toBe(false);
    expect(evaluate('file.hasTag("", "a")', tagged)).toBe(true);
  });

  it("hasLink: a file, a wikilink, a name, a folder note, or a heading link", () => {
    expect(ev("file.hasLink(f)", { f: alice })).toBe(true);
    expect(ev('file.hasLink("[[Alice]]")')).toBe(true);
    expect(ev('file.hasLink("Alice")')).toBe(true);
    expect(ev('file.hasLink("people/Alice.md#Bio")')).toBe(true);
    expect(ev('file.hasLink("topic")')).toBe(true);
    expect(ev('file.hasLink("Bob")')).toBe(false);
    expect(ev("file.hasLink(missing)")).toBe(false);
    expect(ev("file.hasLink(t)", { t: { file: alice } })).toBe(true);
  });

  it("inFolder only takes text", () => {
    expect(ev("file.inFolder(5)")).toBe(false);
    expect(ev('file.inFolder("/notes/")')).toBe(true);
    expect(ev('file.inFolder("note")')).toBe(false);
  });

  it("hasProperty follows a dotted path", () => {
    expect(ev('file.hasProperty("a.b")', { a: { b: null } })).toBe(true);
    expect(ev('file.hasProperty("a.c")', { a: { b: 1 } })).toBe(false);
    expect(ev('file.hasProperty("a.b")', { a: 1 })).toBe(false);
    expect(ev('file.hasProperty("")', { a: 1 })).toBe(false);
  });

  it("asLink links the full path, with a label", () => {
    expect(ev("file.asLink()")).toBe("[[notes/test.md]]");
    expect(ev('file.asLink("T")')).toBe("[[notes/test.md|T]]");
  });
});

describe("link and lookup methods", () => {
  it("linksTo: whether a wikilink points to a file", () => {
    expect(ev('"[[Alice]]".linksTo(f)', { f: alice })).toBe(true);
    expect(ev('"[[Alice]]".linksTo("people/Alice.md")')).toBe(true);
    expect(ev('"[[Alice]]".linksTo(f)', { f: bob })).toBe(false);
    expect(ev('"Alice".linksTo(f)', { f: alice })).toBe(false);
    expect(ev('"[[Nobody]]".linksTo(f)', { f: alice })).toBe(false);
  });

  it("asFile finds a file by path, without .md, by name or by path suffix", () => {
    expect((ev('"people/Alice.md".asFile()') as File).path).toBe("people/Alice.md");
    expect((ev('"people/Bob".asFile()') as File).path).toBe("people/Bob.md");
    expect((ev('"[[Alice]]".asFile()') as File).path).toBe("people/Alice.md");
    expect((ev('"Bob".asFile()') as File).path).toBe("people/Bob.md");
    expect(ev('"Carol.md".asFile()')).toMatchObject({ path: "Carol.md", name: "Carol" });
    expect(ev('"".asFile()')).toBeUndefined();
  });

  it("list.contains() matches links, names and paths against this or a file", () => {
    const self = { file: alice };
    expect(ev("people.contains(this)", { people: ["[[Alice]]"] }, { self })).toBe(true);
    expect(ev("people.contains(this)", { people: ["people/Alice.md"] }, { self })).toBe(true);
    expect(ev("people.contains(this)", { people: ["Alice"] }, { self })).toBe(true);
    expect(ev("people.contains(this)", { people: ["people/alice"] }, { self })).toBe(true);
    expect(ev("people.contains(this)", { people: ["[[Bob]]", 5] }, { self })).toBe(false);
    expect(ev('people.contains("[[people/Alice]]")', { people: ["[[Alice|Al]]"] })).toBe(true);
    expect(ev('people.contains("[[Alice]]")', { people: ["[[Bob]]"] })).toBe(false);
    expect(ev("people.contains(missing)", { people: ["a"] })).toBe(false);
  });

  it("containsAll and containsAny on lists", () => {
    expect(ev("l.containsAll(1, 2)", { l: [1, 2, 3] })).toBe(true);
    expect(ev("l.containsAll(1, 4)", { l: [1, 2, 3] })).toBe(false);
    expect(ev("l.containsAny(4, 3)", { l: [1, 2, 3] })).toBe(true);
    expect(ev("l.containsAny(4, 5)", { l: [1, 2, 3] })).toBe(false);
  });
});

describe("value methods", () => {
  it("list.round rounds the numbers in a list", () => {
    expect(ev('[1.26, "x", 2.5].round(1)')).toEqual([1.3, "x", 2.5]);
    expect(ev("[1.6, 2.4].round()")).toEqual([2, 2]);
  });

  it("numeric arguments that aren't numbers fall back", () => {
    expect(ev('"abcdef".slice("x")')).toBe("abcdef");
    expect(ev('"abcdef".slice(1, "x")')).toBe("bcdef");
    expect(ev('"ab".repeat("x")')).toBe("");
    expect(ev('[true, 1, "2"].sum()')).toBe(4);
  });

  it("dates: isEmpty, format() with the default pattern, date() and time()", () => {
    const d = { d: new Date(2024, 2, 5, 14, 7, 9) };
    expect(ev("d.isEmpty()", d)).toBe(false);
    expect(ev('duration("1d").isEmpty()')).toBe(false);
    expect(ev("d.format()", d)).toBe("2024-03-05T14:07:09+01:00");
    expect(ev('d.format("")', d)).toBe("2024-03-05T14:07:09+01:00");
    expect(String(ev("d.date()", d))).toBe("2024-03-05");
    expect(ev("d.time()", d)).toBe("14:07:09");
    expect(ev("[d].join()", d)).toBe("2024-03-05T14:07:09");
  });

  it("an invalid date is empty, formats and reads as nothing", () => {
    const bad = { d: new Date(NaN) };
    expect(ev("d.isEmpty()", bad)).toBe(true);
    expect(ev("d.format()", bad)).toBe("");
    expect(ev("d.relative()", bad)).toBe("");
  });

  it("isType", () => {
    expect(ev('l.isType("array")', { l: [] })).toBe(true);
    expect(ev('l.isType("list")', { l: [] })).toBe(true);
    expect(ev('o.isType("object")', { o: { a: 1 } })).toBe(true);
    expect(ev('o.isType("list")', { o: { a: 1 } })).toBe(false);
    expect(ev('file.isType("file")')).toBe(true);
    expect(ev('link("https://x.org").isType("url")')).toBe(true);
    expect(ev('link("https://x.org").isType("string")')).toBe(false);
    expect(ev('(5).isType("number")')).toBe(true);
    expect(ev('duration("1d").isType("duration")')).toBe(true);
  });

  it("objects: isEmpty, keys, values, toString", () => {
    expect(ev("o.isEmpty()", { o: {} })).toBe(true);
    expect(ev("o.isEmpty()", { o: { a: 1 } })).toBe(false);
    expect(ev("o.keys()", { o: { a: 1, b: 2 } })).toEqual(["a", "b"]);
    expect(ev("o.values()", { o: { a: 1, b: 2 } })).toEqual([1, 2]);
    expect(ev("o.toString()", { o: { a: 1 } })).toBe('{"a":1}');
    expect(ev("[1, 2].toString()")).toBe("1, 2");
    expect(ev('duration("2d").toString()')).toBe("2 days");
  });

  it("regex matches text, a fresh copy each time", () => {
    expect(ev('/a+/g.matches("baa")')).toBe(true);
    expect(ev('/^a/.matches("ba")')).toBe(false);
    expect(ev('["xa", "ya"].filter(/a$/g.matches(value)).length')).toBe(2);
  });
});
