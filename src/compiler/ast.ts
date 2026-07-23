import type { Span } from "./tokens";

export type LiteralValue = string | number | boolean | null;

export type UnaryOperator = "!" | "-";

export type BinaryOperator =
  "+" | "-" | "*" | "/" | "%" | "==" | "!=" | ">" | "<" | ">=" | "<=" | "&&" | "||";

type BaseNode = {
  type: string;
  span: Span;
};

export type LiteralExpression = BaseNode & {
  type: "Literal";
  value: LiteralValue;
};

export type IdentifierExpression = BaseNode & {
  type: "Identifier";
  name: string;
};

export type UnaryExpression = BaseNode & {
  type: "Unary";
  operator: UnaryOperator;
  argument: Expression;
};

export type BinaryExpression = BaseNode & {
  type: "Binary";
  operator: BinaryOperator;
  left: Expression;
  right: Expression;
};

export type CallExpression = BaseNode & {
  type: "Call";
  callee: Expression;
  args: Expression[];
};

export type MemberExpression = BaseNode & {
  type: "Member";
  object: Expression;
  property: string;
};

export type IndexExpression = BaseNode & {
  type: "Index";
  object: Expression;
  index: Expression;
};

export type ListExpression = BaseNode & {
  type: "List";
  elements: Expression[];
};

export type Expression =
  | LiteralExpression
  | IdentifierExpression
  | UnaryExpression
  | BinaryExpression
  | CallExpression
  | MemberExpression
  | IndexExpression
  | ListExpression;
