import type { Expression } from "./ast";
import { CompilerError } from "./errors";
import { TokenType } from "./tokens";
import type { Span, Token } from "./tokens";
import type { BinaryOperator, UnaryOperator } from "./ast";

enum Precedence {
  Lowest = 0,
  Or = 1,
  And = 2,
  Equality = 3,
  Comparison = 4,
  Term = 5,
  Factor = 6,
  Unary = 7,
  Call = 8,
}

class Parser {
  private readonly tokens: Token[];
  private index = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  public parseExpression(precedence: Precedence = Precedence.Lowest): Expression {
    let left = this.parsePrefix();

    while (!this.isAtEnd() && precedence < this.getPrecedence(this.peek())) {
      left = this.parseInfix(left);
    }

    return left;
  }

  private parsePrefix(): Expression {
    const token = this.advance();

    switch (token.type) {
      case TokenType.Number: {
        const value = Number(token.value);
        if (Number.isNaN(value)) {
          throw new CompilerError("Invalid number literal", token.span);
        }
        return { type: "Literal", value, span: token.span };
      }
      case TokenType.String:
        return { type: "Literal", value: token.value, span: token.span };
      case TokenType.Regex: {
        const slash = token.value.indexOf("/");
        const value = new RegExp(token.value.slice(slash + 1), token.value.slice(0, slash));
        return { type: "Literal", value, span: token.span };
      }
      case TokenType.True:
        return { type: "Literal", value: true, span: token.span };
      case TokenType.False:
        return { type: "Literal", value: false, span: token.span };
      case TokenType.Null:
        return { type: "Literal", value: null, span: token.span };
      case TokenType.Identifier:
        return { type: "Identifier", name: token.value, span: token.span };
      case TokenType.Bang:
      case TokenType.Not:
      case TokenType.Minus: {
        const operator = this.toUnaryOperator(token);
        const argument = this.parseExpression(Precedence.Unary);
        const span = this.mergeSpan(token.span, argument.span);
        return { type: "Unary", operator, argument, span };
      }
      case TokenType.LeftParen: {
        const expression = this.parseExpression();
        this.expect(TokenType.RightParen, "Expected ')' after expression");
        return expression;
      }
      case TokenType.LeftBracket:
        return this.parseList(token.span);
      default:
        throw new CompilerError("Unexpected token", token.span);
    }
  }

  private parseInfix(left: Expression): Expression {
    const token = this.peek();

    if (token.type === TokenType.LeftParen) {
      this.advance();
      return this.parseCall(left);
    }

    if (token.type === TokenType.Dot) {
      this.advance();
      return this.parseMember(left);
    }

    if (token.type === TokenType.LeftBracket) {
      this.advance();
      return this.parseIndex(left);
    }

    const operator = this.toBinaryOperator(token);
    const precedence = this.getPrecedence(token);
    this.advance();
    const right = this.parseExpression(precedence);
    const span = this.mergeSpan(left.span, right.span);
    return { type: "Binary", operator, left, right, span };
  }

  private parseCall(callee: Expression): Expression {
    const args: Expression[] = [];

    if (!this.check(TokenType.RightParen)) {
      do {
        args.push(this.parseExpression());
      } while (this.match(TokenType.Comma));
    }

    const endToken = this.expect(TokenType.RightParen, "Expected ')' after arguments");
    const span = this.mergeSpan(callee.span, endToken.span);
    return { type: "Call", callee, args, span };
  }

  private parseMember(object: Expression): Expression {
    const propertyToken = this.expect(TokenType.Identifier, "Expected property name after '.'");
    const span = this.mergeSpan(object.span, propertyToken.span);
    return { type: "Member", object, property: propertyToken.value, span };
  }

  private parseIndex(object: Expression): Expression {
    const index = this.parseExpression();
    const endToken = this.expect(TokenType.RightBracket, "Expected ']' after index");
    const span = this.mergeSpan(object.span, endToken.span);
    return { type: "Index", object, index, span };
  }

  private parseList(startSpan: Span): Expression {
    const elements: Expression[] = [];

    if (!this.check(TokenType.RightBracket)) {
      do {
        elements.push(this.parseExpression());
      } while (this.match(TokenType.Comma));
    }

    const endToken = this.expect(TokenType.RightBracket, "Expected ']' after list");
    const span = this.mergeSpan(startSpan, endToken.span);
    return { type: "List", elements, span };
  }

  private toUnaryOperator(token: Token): UnaryOperator {
    if (token.type === TokenType.Bang || token.type === TokenType.Not) return "!";
    if (token.type === TokenType.Minus) return "-";
    throw new CompilerError("Unsupported unary operator", token.span);
  }

  private toBinaryOperator(token: Token): BinaryOperator {
    switch (token.type) {
      case TokenType.Plus:
        return "+";
      case TokenType.Minus:
        return "-";
      case TokenType.Star:
        return "*";
      case TokenType.Slash:
        return "/";
      case TokenType.Percent:
        return "%";
      case TokenType.EqualsEquals:
        return "==";
      case TokenType.BangEquals:
        return "!=";
      case TokenType.Greater:
        return ">";
      case TokenType.GreaterEqual:
        return ">=";
      case TokenType.Less:
        return "<";
      case TokenType.LessEqual:
        return "<=";
      case TokenType.AndAnd:
      case TokenType.And:
        return "&&";
      case TokenType.OrOr:
      case TokenType.Or:
        return "||";
      default:
        throw new CompilerError("Unsupported binary operator", token.span);
    }
  }

  private getPrecedence(token: Token): Precedence {
    switch (token.type) {
      case TokenType.OrOr:
      case TokenType.Or:
        return Precedence.Or;
      case TokenType.AndAnd:
      case TokenType.And:
        return Precedence.And;
      case TokenType.EqualsEquals:
      case TokenType.BangEquals:
        return Precedence.Equality;
      case TokenType.Greater:
      case TokenType.GreaterEqual:
      case TokenType.Less:
      case TokenType.LessEqual:
        return Precedence.Comparison;
      case TokenType.Plus:
      case TokenType.Minus:
        return Precedence.Term;
      case TokenType.Star:
      case TokenType.Slash:
      case TokenType.Percent:
        return Precedence.Factor;
      case TokenType.LeftParen:
      case TokenType.LeftBracket:
      case TokenType.Dot:
        return Precedence.Call;
      default:
        return Precedence.Lowest;
    }
  }

  private mergeSpan(start: Span, end: Span): Span {
    return { start: start.start, end: end.end };
  }

  private check(type: TokenType): boolean {
    return this.peek().type === type;
  }

  private match(type: TokenType): boolean {
    if (!this.check(type)) return false;
    this.advance();
    return true;
  }

  private expect(type: TokenType, message: string): Token {
    const token = this.peek();
    if (token.type === type) {
      return this.advance();
    }
    throw new CompilerError(message, token.span);
  }

  private advance(): Token {
    const token = this.peek();
    this.index += 1;
    return token;
  }

  private peek(): Token {
    return (
      this.tokens[this.index] ??
      this.tokens[this.tokens.length - 1] ?? {
        type: TokenType.EOF,
        value: "",
        span: { start: 0, end: 0 },
      }
    );
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  public finish(): void {
    this.expect(TokenType.EOF, "Unexpected token after expression");
  }
}

export function parse(tokens: Token[]): Expression {
  const parser = new Parser(tokens);
  const expression = parser.parseExpression();
  parser.finish();
  return expression;
}
