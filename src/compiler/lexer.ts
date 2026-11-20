import { CompilerError } from "./errors";
import { TokenType } from "./tokens";
import type { Span, Token } from "./tokens";

const KEYWORDS = new Map<string, TokenType>([
  ["true", TokenType.True],
  ["false", TokenType.False],
  ["null", TokenType.Null],
  ["and", TokenType.And],
  ["or", TokenType.Or],
  ["not", TokenType.Not],
]);

function isWhitespace(ch: string): boolean {
  return ch === " " || ch === "\t" || ch === "\n" || ch === "\r";
}

function isDigit(ch: string): boolean {
  if (!ch) return false;
  const code = ch.charCodeAt(0);
  return code >= 48 && code <= 57;
}

function isAlpha(ch: string): boolean {
  if (!ch) return false;
  const code = ch.charCodeAt(0);
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

function isIdentifierStart(ch: string): boolean {
  return isAlpha(ch) || ch === "_" || ch === "$";
}

function isIdentifierPart(ch: string): boolean {
  return isIdentifierStart(ch) || isDigit(ch);
}

const VALUE_END = new Set<TokenType>([
  TokenType.Number,
  TokenType.String,
  TokenType.Regex,
  TokenType.Identifier,
  TokenType.True,
  TokenType.False,
  TokenType.Null,
  TokenType.RightParen,
  TokenType.RightBracket,
]);

function regexAllowedAfter(previous: Token | undefined): boolean {
  return !previous || !VALUE_END.has(previous.type);
}

class Lexer {
  private readonly input: string;
  private index = 0;

  constructor(input: string) {
    this.input = input;
  }

  public tokenize(): Token[] {
    const tokens: Token[] = [];

    while (!this.isAtEnd()) {
      const ch = this.peek();
      if (isWhitespace(ch)) {
        this.advance();
        continue;
      }

      if (isDigit(ch)) {
        tokens.push(this.readNumber());
        continue;
      }

      if (isIdentifierStart(ch)) {
        tokens.push(this.readIdentifier());
        continue;
      }

      if (ch === '"' || ch === "'") {
        tokens.push(this.readString());
        continue;
      }

      // as in Obsidian, /pattern/flags is a regular expression where a value is expected (and
      // a division after a value)
      if (ch === "/" && regexAllowedAfter(tokens[tokens.length - 1])) {
        tokens.push(this.readRegex());
        continue;
      }

      tokens.push(this.readSymbol());
    }

    tokens.push({
      type: TokenType.EOF,
      value: "",
      span: { start: this.index, end: this.index },
    });

    return tokens;
  }

  private readNumber(): Token {
    const start = this.index;

    while (isDigit(this.peek())) {
      this.advance();
    }

    if (this.peek() === "." && isDigit(this.peekNext())) {
      this.advance();
      while (isDigit(this.peek())) {
        this.advance();
      }
    }

    const value = this.input.slice(start, this.index);
    return this.makeToken(TokenType.Number, value, start, this.index);
  }

  private readIdentifier(): Token {
    const start = this.index;
    while (isIdentifierPart(this.peek())) {
      this.advance();
    }

    const value = this.input.slice(start, this.index);
    const keyword = KEYWORDS.get(value);
    if (keyword) {
      return this.makeToken(keyword, value, start, this.index);
    }

    return this.makeToken(TokenType.Identifier, value, start, this.index);
  }

  private readString(): Token {
    const start = this.index;
    const quote = this.advance();
    let value = "";

    while (!this.isAtEnd()) {
      const ch = this.advance();
      if (ch === quote) {
        return this.makeToken(TokenType.String, value, start, this.index);
      }

      if (ch === "\\") {
        if (this.isAtEnd()) break;
        const escaped = this.advance();
        value += this.decodeEscape(escaped);
        continue;
      }

      value += ch;
    }

    throw new CompilerError("Unterminated string literal", { start, end: this.index });
  }

  /** `/pattern/flags`; the token's value is `flags/pattern`. */
  private readRegex(): Token {
    const start = this.index;
    this.advance(); // the opening /
    let pattern = "";
    let inClass = false;
    while (!this.isAtEnd()) {
      const ch = this.advance();
      if (ch === "\\") {
        if (this.isAtEnd()) break;
        pattern += ch + this.advance();
        continue;
      }
      if (ch === "[") inClass = true;
      else if (ch === "]") inClass = false;
      else if (ch === "/" && !inClass) {
        let flags = "";
        while (!this.isAtEnd() && /[a-z]/i.test(this.peek())) flags += this.advance();
        try {
          new RegExp(pattern, flags);
        } catch {
          throw new CompilerError("Invalid regular expression", { start, end: this.index });
        }
        return this.makeToken(TokenType.Regex, `${flags}/${pattern}`, start, this.index);
      }
      pattern += ch;
    }
    throw new CompilerError("Unterminated regular expression", { start, end: this.index });
  }

  private readSymbol(): Token {
    const start = this.index;
    const ch = this.advance();

    if (ch === "+") return this.makeToken(TokenType.Plus, ch, start, this.index);
    if (ch === "-") return this.makeToken(TokenType.Minus, ch, start, this.index);
    if (ch === "*") return this.makeToken(TokenType.Star, ch, start, this.index);
    if (ch === "/") return this.makeToken(TokenType.Slash, ch, start, this.index);
    if (ch === "%") return this.makeToken(TokenType.Percent, ch, start, this.index);
    if (ch === "(") return this.makeToken(TokenType.LeftParen, ch, start, this.index);
    if (ch === ")") return this.makeToken(TokenType.RightParen, ch, start, this.index);
    if (ch === "[") return this.makeToken(TokenType.LeftBracket, ch, start, this.index);
    if (ch === "]") return this.makeToken(TokenType.RightBracket, ch, start, this.index);
    if (ch === ",") return this.makeToken(TokenType.Comma, ch, start, this.index);
    if (ch === ".") return this.makeToken(TokenType.Dot, ch, start, this.index);

    if (ch === "!") {
      if (this.match("=")) {
        return this.makeToken(TokenType.BangEquals, "!=", start, this.index);
      }
      return this.makeToken(TokenType.Bang, ch, start, this.index);
    }

    if (ch === "=") {
      if (this.match("=")) {
        return this.makeToken(TokenType.EqualsEquals, "==", start, this.index);
      }
      throw new CompilerError("Unexpected '='", { start, end: this.index });
    }

    if (ch === ">") {
      if (this.match("=")) {
        return this.makeToken(TokenType.GreaterEqual, ">=", start, this.index);
      }
      return this.makeToken(TokenType.Greater, ch, start, this.index);
    }

    if (ch === "<") {
      if (this.match("=")) {
        return this.makeToken(TokenType.LessEqual, "<=", start, this.index);
      }
      return this.makeToken(TokenType.Less, ch, start, this.index);
    }

    if (ch === "&") {
      if (this.match("&")) {
        return this.makeToken(TokenType.AndAnd, "&&", start, this.index);
      }
      throw new CompilerError("Unexpected '&'", { start, end: this.index });
    }

    if (ch === "|") {
      if (this.match("|")) {
        return this.makeToken(TokenType.OrOr, "||", start, this.index);
      }
      throw new CompilerError("Unexpected '|'", { start, end: this.index });
    }

    throw new CompilerError(`Unexpected character '${ch}'`, { start, end: this.index });
  }

  private decodeEscape(ch: string): string {
    if (ch === "n") return "\n";
    if (ch === "r") return "\r";
    if (ch === "t") return "\t";
    if (ch === "\\") return "\\";
    if (ch === '"') return '"';
    if (ch === "'") return "'";
    return ch;
  }

  private makeToken(type: TokenType, value: string, start: number, end: number): Token {
    const span: Span = { start, end };
    return { type, value, span };
  }

  private match(expected: string): boolean {
    if (this.peek() !== expected) return false;
    this.advance();
    return true;
  }

  private peek(): string {
    return this.input[this.index] ?? "";
  }

  private peekNext(): string {
    return this.input[this.index + 1] ?? "";
  }

  private advance(): string {
    const ch = this.input[this.index] ?? "";
    this.index += 1;
    return ch;
  }

  private isAtEnd(): boolean {
    return this.index >= this.input.length;
  }
}

export function lex(input: string): Token[] {
  const lexer = new Lexer(input);
  return lexer.tokenize();
}
