import { describe, it, expect } from "vitest";
import { lex } from "../src/compiler/lexer";
import { CompilerError } from "../src/compiler/errors";
import { TokenType } from "../src/compiler/tokens";

describe("lex", () => {
  it("tokenizes numbers (integers and decimals)", () => {
    const tokens = lex("123 45.67 0.5");
    expect(tokens.map((token) => token.type)).toEqual([
      TokenType.Number,
      TokenType.Number,
      TokenType.Number,
      TokenType.EOF,
    ]);
    expect(tokens[0]?.value).toBe("123");
    expect(tokens[1]?.value).toBe("45.67");
    expect(tokens[2]?.value).toBe("0.5");
  });

  it("tokenizes strings with escapes", () => {
    const tokens = lex(String.raw`"line\nnext" 'it\'s' "quote \"yes\""`);
    expect(tokens.map((token) => token.type)).toEqual([
      TokenType.String,
      TokenType.String,
      TokenType.String,
      TokenType.EOF,
    ]);
    expect(tokens[0]?.value).toBe("line\nnext");
    expect(tokens[1]?.value).toBe("it's");
    expect(tokens[2]?.value).toBe('quote "yes"');
  });

  it("tokenizes identifiers and keywords", () => {
    const tokens = lex("true false null and or not alpha _beta $gamma foo123");
    expect(tokens.map((token) => token.type)).toEqual([
      TokenType.True,
      TokenType.False,
      TokenType.Null,
      TokenType.And,
      TokenType.Or,
      TokenType.Not,
      TokenType.Identifier,
      TokenType.Identifier,
      TokenType.Identifier,
      TokenType.Identifier,
      TokenType.EOF,
    ]);
    expect(tokens[6]?.value).toBe("alpha");
    expect(tokens[7]?.value).toBe("_beta");
    expect(tokens[8]?.value).toBe("$gamma");
    expect(tokens[9]?.value).toBe("foo123");
  });

  it("tokenizes regular expressions where a value is expected", () => {
    const tokens = lex("/a[/]b\\//gi.matches(x) / 2");
    expect(tokens.map((token) => [token.type, token.value])).toEqual([
      [TokenType.Regex, "gi/a[/]b\\/"],
      [TokenType.Dot, "."],
      [TokenType.Identifier, "matches"],
      [TokenType.LeftParen, "("],
      [TokenType.Identifier, "x"],
      [TokenType.RightParen, ")"],
      [TokenType.Slash, "/"],
      [TokenType.Number, "2"],
      [TokenType.EOF, ""],
    ]);
  });

  it("tokenizes operators", () => {
    // after a value, / is division (a regular expression where a value is expected)
    const tokens = lex("+ - * a / % == != > < >= <= && || ! .");
    expect(tokens.map((token) => token.type)).toEqual([
      TokenType.Plus,
      TokenType.Minus,
      TokenType.Star,
      TokenType.Identifier,
      TokenType.Slash,
      TokenType.Percent,
      TokenType.EqualsEquals,
      TokenType.BangEquals,
      TokenType.Greater,
      TokenType.Less,
      TokenType.GreaterEqual,
      TokenType.LessEqual,
      TokenType.AndAnd,
      TokenType.OrOr,
      TokenType.Bang,
      TokenType.Dot,
      TokenType.EOF,
    ]);
  });

  it("tokenizes brackets and parens", () => {
    const tokens = lex("( ) [ ] ,");
    expect(tokens.map((token) => token.type)).toEqual([
      TokenType.LeftParen,
      TokenType.RightParen,
      TokenType.LeftBracket,
      TokenType.RightBracket,
      TokenType.Comma,
      TokenType.EOF,
    ]);
  });

  it("handles whitespace correctly", () => {
    const tokens = lex("  1 \n +\t2  ");
    expect(tokens.map((token) => token.type)).toEqual([
      TokenType.Number,
      TokenType.Plus,
      TokenType.Number,
      TokenType.EOF,
    ]);
  });

  it("throws CompilerError on unterminated strings", () => {
    expect(() => lex("'unterminated")).toThrow(CompilerError);
    expect(() => lex('"unterminated')).toThrow("Unterminated string literal");
  });

  it("throws CompilerError on unexpected characters", () => {
    expect(() => lex("@")).toThrow(CompilerError);
    expect(() => lex("#")).toThrow("Unexpected character '#'");
  });

  it("always ends with EOF token", () => {
    const tokens = lex("1 + 2");
    expect(tokens[tokens.length - 1]?.type).toBe(TokenType.EOF);
  });

  it("returns only EOF for empty input", () => {
    const tokens = lex("");
    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.type).toBe(TokenType.EOF);
  });
});
