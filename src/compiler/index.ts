import type { FilterNode } from "../types";
import { compileAst } from "./compiler";
import { lex } from "./lexer";
import { parse } from "./parser";
import { interpret, resolvePropertyValue } from "./interpreter";
import type { CompiledExpression } from "./compiler";
import type { EvalContext } from "./interpreter";
import { ErrorValue, FormulaError } from "./values";

export function compile(expression: string): CompiledExpression {
  const tokens = lex(expression);
  const ast = parse(tokens);
  return compileAst(ast);
}

export function evaluate(expression: string, context: EvalContext): unknown {
  try {
    const compiled = compile(expression);
    return interpret(compiled.instructions, context);
  } catch (error) {
    // Obsidian shows a formula's error in place of its value
    if (error instanceof FormulaError) return new ErrorValue(error.message);
    return undefined;
  }
}

export function evaluateFilter(node: FilterNode | undefined, context: EvalContext): boolean {
  if (!node) return true;
  if (typeof node === "string") {
    const result = evaluate(node, context);
    return !(result instanceof ErrorValue) && Boolean(result);
  }
  if ("and" in node) {
    return node.and.every((child) => evaluateFilter(child, context));
  }
  if ("or" in node) {
    return node.or.some((child) => evaluateFilter(child, context));
  }
  if ("not" in node) {
    return !node.not.every((child) => evaluateFilter(child, context));
  }
  return true;
}

export { resolvePropertyValue };
export {
  BasesDate,
  Duration,
  ErrorValue,
  FormulaError,
  humanizeDuration,
  isDuration,
  isErrorValue,
  parseDuration,
  parseIsoDate,
  relativeFromNow,
} from "./values";
export type { EvalContext, CompiledExpression };
