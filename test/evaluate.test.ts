import { describe, it, expect } from "vitest";
import { evaluate, evaluateFilter } from "../src/compiler";

const context = {
  note: {
    title: "Test Note",
    status: "done",
    priority: 5,
    tags: ["todo", "important"],
    score: 42,
  },
  file: {
    name: "test-note.md",
    basename: "test-note",
    path: "notes/test-note.md",
    folder: "notes",
    ext: "md",
    tags: ["todo", "important"],
    links: ["other-note"],
    embeds: ["image.png", "diagram.svg"],
    properties: { title: "Test Note", status: "done", priority: 5 },
    created: "2024-01-01T00:00:00Z",
    modified: "2024-06-15T00:00:00Z",
  },
  formula: {
    doubled: 84,
    label: "high-priority",
  },
};

describe("evaluate", () => {
  it("evaluates arithmetic expressions", () => {
    expect(evaluate("1 + 2", context)).toBe(3);
    expect(evaluate("10 - 3", context)).toBe(7);
    expect(evaluate("2 * 3", context)).toBe(6);
    expect(evaluate("10 / 2", context)).toBe(5);
    expect(evaluate("10 % 3", context)).toBe(1);
    expect(evaluate("7 % 2", context)).toBe(1);
    expect(evaluate("10 % 5", context)).toBe(0);
    // as in Obsidian (probe): x % 0 is NaN, x / 0 Infinity
    expect(evaluate("10 % 0", context)).toBeNaN();
    expect(evaluate("10 / 0", context)).toBe(Infinity);
  });

  it("evaluates string concatenation", () => {
    expect(evaluate('"hello" + " " + "world"', context)).toBe("hello world");
  });

  it("evaluates comparisons", () => {
    expect(evaluate("5 > 3", context)).toBe(true);
    expect(evaluate("2 == 2", context)).toBe(true);
    expect(evaluate("3 != 4", context)).toBe(true);
  });

  it("evaluates logical operators", () => {
    expect(evaluate("true && false", context)).toBe(false);
    expect(evaluate("true || false", context)).toBe(true);
    expect(evaluate("!true", context)).toBe(false);
  });

  it("short-circuits logical expressions", () => {
    expect(evaluate("false && error_func()", context)).toBe(false);
  });

  it("resolves property access", () => {
    expect(evaluate("title", context)).toBe("Test Note");
    expect(evaluate("file.name", context)).toBe("test-note.md");
    expect(evaluate("formula.doubled", context)).toBe(84);
    expect(evaluate("note.status", context)).toBe("done");
  });

  it("evaluates global function calls", () => {
    expect(evaluate('contains(tags, "todo")', context)).toBe(true);
    expect(evaluate('contains(tags, "missing")', context)).toBe(false);
    expect(evaluate('if(true, "yes", "no")', context)).toBe("yes");
    expect(evaluate('if(false, "yes", "no")', context)).toBe("no");
  });

  it("evaluates numeric helpers", () => {
    expect(evaluate('number("42")', context)).toBe(42);
    expect(evaluate("min(1, 2, 3)", context)).toBe(1);
    expect(evaluate("max(1, 2, 3)", context)).toBe(3);
  });

  it("returns Date values for now()", () => {
    const result = evaluate("now()", context);
    expect(result).toBeInstanceOf(Date);
  });

  it("evaluates method calls", () => {
    expect(evaluate('"hello".upper()', context)).toBe("HELLO");
    expect(evaluate('"Hello".lower()', context)).toBe("hello");
  });

  it("returns undefined for invalid expressions", () => {
    expect(evaluate("1 +", context)).toBeUndefined();
  });
});

describe("evaluateFilter", () => {
  it("evaluates string filters", () => {
    expect(evaluateFilter('status == "done"', context)).toBe(true);
  });

  it("evaluates and/or/not filter nodes", () => {
    expect(evaluateFilter({ and: ['status == "done"', "priority > 3"] }, context)).toBe(true);
    expect(evaluateFilter({ or: ["priority > 10", 'status == "done"'] }, context)).toBe(true);
    expect(evaluateFilter({ not: ['status == "done"'] }, context)).toBe(false);
  });

  it("returns true when filter is undefined", () => {
    expect(evaluateFilter(undefined, context)).toBe(true);
  });
});

describe("lambda expressions", () => {
  it("filters a list with value binding", () => {
    expect(evaluate("[1, 2, 3, 4, 5].filter(value > 3)", context)).toEqual([4, 5]);
    expect(evaluate("[1, 2, 3].filter(value == 2)", context)).toEqual([2]);
  });

  it("maps a list with value binding", () => {
    expect(evaluate("[1, 2, 3].map(value * 2)", context)).toEqual([2, 4, 6]);
    expect(evaluate("[1, 2, 3].map(value + 10)", context)).toEqual([11, 12, 13]);
  });

  it("finds first matching element", () => {
    expect(evaluate("[10, 20, 30].find(value > 15)", context)).toBe(20);
    expect(evaluate("[1, 2, 3].find(value > 100)", context)).toBeUndefined();
  });

  it("checks if some elements match", () => {
    expect(evaluate("[1, 2, 3].some(value > 2)", context)).toBe(true);
    expect(evaluate("[1, 2, 3].some(value > 10)", context)).toBe(false);
  });

  it("checks if every element matches", () => {
    expect(evaluate("[2, 4, 6].every(value > 1)", context)).toBe(true);
    expect(evaluate("[2, 4, 6].every(value > 3)", context)).toBe(false);
  });

  it("flatMaps a list", () => {
    expect(evaluate("[[1, 2], [3, 4]].flatMap(value)", context)).toEqual([1, 2, 3, 4]);
  });

  it("chains filter and map", () => {
    expect(evaluate("[1, 2, 3, 4].filter(value > 2).map(value * 10)", context)).toEqual([30, 40]);
  });

  it("returns undefined for non-array targets", () => {
    expect(evaluate('"hello".filter(value == "h")', context)).toBeUndefined();
  });
});

describe("null/undefined isEmpty handling", () => {
  const nullImageContext = {
    note: { title: "No Image", image: null as unknown },
    file: {
      name: "test.md",
      basename: "test",
      path: "test.md",
      folder: "",
      ext: "md",
      tags: [],
      links: [],
    },
    formula: {},
  };

  const missingImageContext = {
    note: { title: "Missing" },
    file: {
      name: "test.md",
      basename: "test",
      path: "test.md",
      folder: "",
      ext: "md",
      tags: [],
      links: [],
    },
    formula: {},
  };

  it("null.isEmpty() returns true", () => {
    expect(evaluate("image.isEmpty()", nullImageContext)).toBe(true);
  });

  it("undefined property.isEmpty() returns true", () => {
    expect(evaluate("image.isEmpty()", missingImageContext)).toBe(true);
  });

  it("!null.isEmpty() returns false (filter rejects null images)", () => {
    expect(evaluate("!image.isEmpty()", nullImageContext)).toBe(false);
  });

  it("!undefined.isEmpty() returns false (filter rejects missing images)", () => {
    expect(evaluate("!image.isEmpty()", missingImageContext)).toBe(false);
  });

  it("non-empty string.isEmpty() returns false", () => {
    const ctx = {
      ...nullImageContext,
      note: { title: "Has Image", image: "photo.png" },
    };
    expect(evaluate("image.isEmpty()", ctx)).toBe(false);
    expect(evaluate("!image.isEmpty()", ctx)).toBe(true);
  });
});

describe("file properties and embeds", () => {
  it("accesses file.properties as frontmatter alias", () => {
    expect(evaluate("file.properties.title", context)).toBe("Test Note");
    expect(evaluate("file.properties.status", context)).toBe("done");
    expect(evaluate("file.properties.priority", context)).toBe(5);
  });

  it("accesses file.embeds", () => {
    expect(evaluate("file.embeds", context)).toEqual(["image.png", "diagram.svg"]);
  });

  it("calls list methods on file.embeds", () => {
    expect(evaluate("file.embeds.count()", context)).toBe(2);
    expect(evaluate('file.embeds.contains("image.png")', context)).toBe(true);
    expect(evaluate('file.embeds.contains("missing.png")', context)).toBe(false);
  });
});
