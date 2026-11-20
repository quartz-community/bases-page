export type Span = {
  start: number;
  end: number;
};

export enum TokenType {
  Number = "Number",
  String = "String",
  Regex = "Regex",
  Identifier = "Identifier",
  True = "True",
  False = "False",
  Null = "Null",
  And = "And",
  Or = "Or",
  Not = "Not",
  Plus = "Plus",
  Minus = "Minus",
  Star = "Star",
  Slash = "Slash",
  Percent = "Percent",
  Bang = "Bang",
  EqualsEquals = "EqualsEquals",
  BangEquals = "BangEquals",
  Greater = "Greater",
  GreaterEqual = "GreaterEqual",
  Less = "Less",
  LessEqual = "LessEqual",
  AndAnd = "AndAnd",
  OrOr = "OrOr",
  LeftParen = "LeftParen",
  RightParen = "RightParen",
  LeftBracket = "LeftBracket",
  RightBracket = "RightBracket",
  Comma = "Comma",
  Dot = "Dot",
  EOF = "EOF",
}

export type Token = {
  type: TokenType;
  value: string;
  span: Span;
};
