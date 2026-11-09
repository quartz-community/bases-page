import { describe, it, expect } from "vitest";
import { evaluate, ErrorValue } from "../src/compiler";
import type { EvalContext } from "../src/compiler";

// Obsidian 1.15.0, ad hoc obsidian-bases-probe runs (eval --formulas).
const context: EvalContext = {
  note: {},
  file: {
    name: "probe",
    basename: "probe",
    path: "probe.md",
    folder: "/",
    ext: "md",
    tags: [],
    links: [],
  },
  formula: {},
};
const ev = (expression: string) => evaluate(expression, context);

describe("other Obsidian behaviour", () => {
  it("string contains, containsAny and containsAll ignore case; startsWith/endsWith don't", () => {
    expect(ev('"ABC".contains("b")')).toBe(true);
    expect(ev('"ABC".containsAny("x", "b")')).toBe(true);
    expect(ev('"ABC".containsAll("a", "b")')).toBe(true);
    expect(ev('"abc".startsWith("A")')).toBe(false);
    expect(ev('"ABC".endsWith("c")')).toBe(false);
    expect(ev('["Ab"].contains("ab")')).toBe(false);
    expect(ev('"ABC" == "abc"')).toBe(false);
  });

  it("unknown functions and methods are errors", () => {
    expect(ev("nonexistentfn(1)")).toEqual(new ErrorValue('Cannot find function "nonexistentfn"'));
    expect(ev('"x".nosuchmethod()')).toEqual(
      new ErrorValue('Cannot find function "nosuchmethod" on type String'),
    );
  });

  it("null.isType() and null.isEmpty()", () => {
    expect(ev('null.isType("null")')).toBe(true);
    expect(ev('null.isType("string")')).toBe(false);
    expect(ev("missing.isEmpty()")).toBe(true);
  });
});
