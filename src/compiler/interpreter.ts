import { getGlobalFunction, getMethodFunction } from "./functions";
import type { Instruction } from "./ir";
import {
  BasesDate,
  Duration,
  ErrorValue,
  FormulaError,
  coerceDateString,
  dateHasTime,
  dateToString,
  isDuration,
  parseDuration,
  parseIsoDate,
} from "./values";

export type EvalContext = {
  note: Record<string, unknown>;
  file: {
    name: string;
    basename: string;
    fullname?: string;
    path: string;
    folder: string;
    ext: string;
    tags: string[];
    links: string[];
    embeds?: string[];
    properties?: Record<string, unknown>;
    created?: string | Date;
    modified?: string | Date;
    ctime?: Date;
    mtime?: Date;
    size?: number;
  };
  formula: Record<string, unknown>;
  self?: {
    // The note (or .base file) the base is rendered in. A full file value, so
    // this.file.asLink(), this.file.inFolder(...) etc. work like file.*.
    file: Partial<EvalContext["file"]> & {
      name: string;
      path: string;
      folder: string;
      ext: string;
    };
  };
  _lambdaValue?: unknown;
  _fileLookup?: Map<string, EvalContext["file"]>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toBoolean(value: unknown): boolean {
  return Boolean(value);
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof value === "boolean") return value ? 1 : 0;
  return null;
}

function toStringValue(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (value instanceof Date) return dateToString(value);
  return String(value);
}

/** The type name Obsidian uses in its error messages. */
export function typeName(value: unknown): string {
  if (value === undefined || value === null) return "Null";
  if (isDuration(value)) return "Duration";
  if (value instanceof Date) return "Date";
  if (typeof value === "number") return "Number";
  if (typeof value === "string") return "String";
  if (typeof value === "boolean") return "Boolean";
  if (Array.isArray(value)) return "List";
  return "Object";
}

function invalidOperator(left: unknown, right: unknown): never {
  throw new FormulaError(`Invalid operator between ${typeName(left)} and ${typeName(right)}`);
}

// A string next to a date compares as a date when it holds one ("2024-01-01").
function asDate(value: unknown): Date | undefined {
  if (isDateValue(value)) return value;
  if (typeof value === "string") return parseIsoDate(value);
  return undefined;
}

// What a duration compares with: another duration, a duration string ("1w") or milliseconds.
function durationMs(value: unknown): number | undefined {
  if (isDuration(value)) return value.totalMilliseconds();
  if (typeof value === "number") return value;
  if (typeof value === "string") return parseDuration(value)?.totalMilliseconds();
  return undefined;
}

function compareNumbers(left: number, right: number, operator: string): boolean {
  if (operator === ">") return left > right;
  if (operator === "<") return left < right;
  if (operator === ">=") return left >= right;
  if (operator === "<=") return left <= right;
  if (operator === "==") return left === right;
  if (operator === "!=") return left !== right;
  return false;
}

function addDuration(date: Date, duration: Duration, sign: number): BasesDate {
  const hasTime = dateHasTime(date) || duration.ms % 86_400_000 !== 0;
  return new BasesDate(duration.addTo(date, sign), hasTime);
}

function compareValues(left: unknown, right: unknown, operator: string): boolean {
  if (isDuration(left) || isDuration(right)) {
    // == only holds between two durations; <, > also take "1w" or milliseconds
    if ((operator === "==" || operator === "!=") && !(isDuration(left) && isDuration(right))) {
      return operator === "!=";
    }
    const l = durationMs(left);
    const r = durationMs(right);
    if (l === undefined || r === undefined) return operator === "!=";
    return compareNumbers(l, r, operator);
  }
  if (isDateValue(left) || isDateValue(right)) {
    const l = asDate(left);
    const r = asDate(right);
    if (l && r) return compareNumbers(l.getTime(), r.getTime(), operator);
  }
  if (operator === "==") {
    if (isDateValue(left) && isDateValue(right)) return left.getTime() === right.getTime();
    return left === right;
  }
  if (operator === "!=") {
    if (isDateValue(left) && isDateValue(right)) return left.getTime() !== right.getTime();
    return left !== right;
  }

  if (isDateValue(left) && isDateValue(right)) {
    const leftMs = left.getTime();
    const rightMs = right.getTime();
    if (operator === ">") return leftMs > rightMs;
    if (operator === "<") return leftMs < rightMs;
    if (operator === ">=") return leftMs >= rightMs;
    if (operator === "<=") return leftMs <= rightMs;
  }

  const leftNum = toNumber(left);
  const rightNum = toNumber(right);
  if (leftNum !== null && rightNum !== null) {
    if (operator === ">") return leftNum > rightNum;
    if (operator === "<") return leftNum < rightNum;
    if (operator === ">=") return leftNum >= rightNum;
    if (operator === "<=") return leftNum <= rightNum;
  }

  const leftStr = toStringValue(left);
  const rightStr = toStringValue(right);
  if (operator === ">") return leftStr > rightStr;
  if (operator === "<") return leftStr < rightStr;
  if (operator === ">=") return leftStr >= rightStr;
  if (operator === "<=") return leftStr <= rightStr;
  return false;
}

function isDateValue(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function applyBinary(operator: string, left: unknown, right: unknown): unknown {
  if (operator === "+" || operator === "-") {
    const sign = operator === "+" ? 1 : -1;
    if (isDateValue(left)) {
      if (isDuration(right)) return addDuration(left, right, sign);
      if (typeof right === "string") {
        // date + "1d" adds a duration; any other string is concatenated
        const duration = parseDuration(right);
        if (duration) return addDuration(left, duration, sign);
        if (operator === "+") return `${toStringValue(left)}${right}`;
      }
      if (operator === "-" && isDateValue(right)) {
        return Duration.fromMilliseconds(left.getTime() - right.getTime());
      }
      if (operator === "-" && typeof right === "string" && asDate(right)) {
        return Duration.fromMilliseconds(left.getTime() - asDate(right)!.getTime());
      }
      invalidOperator(left, right);
    }
    if (isDuration(left)) {
      if (isDuration(right)) return left.plus(right, sign);
      if (operator === "+" && typeof right === "string") return `${left.toString()}${right}`;
      if (isDateValue(right) && operator === "+") return addDuration(right, left, 1);
      invalidOperator(left, right);
    }
    if (isDuration(right)) {
      if (operator === "+" && typeof left === "string") return `${left}${right.toString()}`;
      invalidOperator(left, right);
    }
    if (isDateValue(right)) {
      if (operator === "+" && typeof left === "string") return `${left}${toStringValue(right)}`;
      if (operator === "-" && typeof left === "string" && asDate(left)) {
        return Duration.fromMilliseconds(asDate(left)!.getTime() - right.getTime());
      }
      invalidOperator(left, right);
    }
  }

  if (operator === "*" || operator === "/") {
    if (isDuration(left)) {
      const factor = typeof right === "number" ? right : undefined;
      if (factor === undefined) invalidOperator(left, right);
      return left.scale(operator === "*" ? factor : 1 / factor);
    }
    if (isDuration(right)) invalidOperator(left, right);
  }

  if (operator === "+") {
    if (typeof left === "string" || typeof right === "string") {
      return `${toStringValue(left)}${toStringValue(right)}`;
    }
    const leftNum = toNumber(left);
    const rightNum = toNumber(right);
    if (leftNum === null || rightNum === null) return undefined;
    return leftNum + rightNum;
  }

  if (operator === "-") {
    const leftNum = toNumber(left);
    const rightNum = toNumber(right);
    if (leftNum === null || rightNum === null) return undefined;
    return leftNum - rightNum;
  }

  if (operator === "*") {
    const leftNum = toNumber(left);
    const rightNum = toNumber(right);
    if (leftNum === null || rightNum === null) return undefined;
    return leftNum * rightNum;
  }

  if (operator === "/") {
    const leftNum = toNumber(left);
    const rightNum = toNumber(right);
    if (leftNum === null || rightNum === null) return undefined;
    return rightNum === 0 ? 0 : leftNum / rightNum;
  }

  if (operator === "%") {
    const leftNum = toNumber(left);
    const rightNum = toNumber(right);
    if (leftNum === null || rightNum === null) return undefined;
    return rightNum === 0 ? 0 : leftNum % rightNum;
  }

  return compareValues(left, right, operator);
}

function getNestedValue(target: unknown, path: string[]): unknown {
  let current: unknown = target;
  for (const part of path) {
    if (!part) continue;
    if (Array.isArray(current)) {
      const index = Number(part);
      if (Number.isNaN(index)) return undefined;
      current = current[index];
      continue;
    }
    if (!isRecord(current)) return undefined;
    current = current[part];
  }
  return current;
}

export function resolvePropertyValue(path: string, context: EvalContext): unknown {
  if (typeof path !== "string") return undefined;
  const trimmed = path.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("this.")) {
    return coerceDateString(getNestedValue(context.self ?? {}, trimmed.slice(5).split(".")));
  }
  if (trimmed.startsWith("note.")) {
    return coerceDateString(getNestedValue(context.note, trimmed.slice(5).split(".")));
  }
  if (trimmed.startsWith("file.")) {
    return getNestedValue(context.file, trimmed.slice(5).split("."));
  }
  if (trimmed.startsWith("formula.")) {
    return getNestedValue(context.formula, trimmed.slice(8).split("."));
  }
  return coerceDateString(getNestedValue(context.note, trimmed.split(".")));
}

function resolveIdentifier(name: string, context: EvalContext): unknown {
  if (name.includes(".")) return resolvePropertyValue(name, context);
  if (name === "this") return context.self ?? {};
  if (name === "note") return context.note;
  if (name === "file") return context.file;
  if (name === "formula") return context.formula;
  if (name === "value") return context._lambdaValue;
  return coerceDateString(context.note[name]);
}

function resolveMember(target: unknown, name: string): unknown {
  if (target === undefined || target === null) return undefined;
  if (isDuration(target)) return target.fields[name];
  if (isDateValue(target)) {
    switch (name) {
      case "year":
        return target.getFullYear();
      case "month":
        return target.getMonth() + 1;
      case "day":
        return target.getDate();
      case "hour":
        return target.getHours();
      case "minute":
        return target.getMinutes();
      case "second":
        return target.getSeconds();
      default:
        return undefined;
    }
  }
  if (Array.isArray(target)) {
    if (name === "length") return target.length;
    const index = Number(name);
    if (Number.isNaN(index)) return undefined;
    return target[index];
  }
  if (typeof target === "string") {
    if (name === "length") return target.length;
    const index = Number(name);
    if (Number.isNaN(index)) return undefined;
    return target.charAt(index);
  }
  if (isRecord(target)) return coerceDateString(target[name]);
  return undefined;
}

function resolveIndex(target: unknown, indexValue: unknown): unknown {
  if (target === undefined || target === null) return undefined;
  if (Array.isArray(target)) {
    const index = toNumber(indexValue);
    if (index === null) return undefined;
    return target[Math.trunc(index)];
  }
  if (typeof target === "string") {
    const index = toNumber(indexValue);
    if (index === null) return undefined;
    return target.charAt(Math.trunc(index));
  }
  if (isRecord(target)) {
    if (typeof indexValue === "string" || typeof indexValue === "number") {
      return target[String(indexValue)];
    }
  }
  return undefined;
}

function popArgs(stack: unknown[], count: number): unknown[] {
  const args = new Array<unknown>(count);
  for (let i = count - 1; i >= 0; i -= 1) {
    args[i] = stack.pop();
  }
  return args;
}

function evaluateLambda(
  program: Instruction[],
  elementValue: unknown,
  context: EvalContext,
): unknown {
  const lambdaContext: EvalContext = { ...context, _lambdaValue: elementValue };
  return interpret(program, lambdaContext);
}

function executeLazyMethod(
  name: string,
  target: unknown,
  argPrograms: Instruction[][],
  context: EvalContext,
): unknown {
  if (!Array.isArray(target)) return undefined;
  const body = argPrograms[0];
  if (!body) return undefined;

  switch (name) {
    case "filter":
      return target.filter((element) => {
        const result = evaluateLambda(body, element, context);
        return Boolean(result);
      });
    case "map":
      return target.map((element) => evaluateLambda(body, element, context));
    case "flatMap": {
      const mapped = target.map((element) => evaluateLambda(body, element, context));
      return mapped.flat();
    }
    case "find":
      return target.find((element) => {
        const result = evaluateLambda(body, element, context);
        return Boolean(result);
      });
    case "some":
      return target.some((element) => {
        const result = evaluateLambda(body, element, context);
        return Boolean(result);
      });
    case "every":
      return target.every((element) => {
        const result = evaluateLambda(body, element, context);
        return Boolean(result);
      });
    default:
      return undefined;
  }
}

export function interpret(instructions: Instruction[], context: EvalContext): unknown {
  const stack: unknown[] = [];
  let ip = 0;

  while (ip < instructions.length) {
    const instruction = instructions[ip];
    if (!instruction) break;

    switch (instruction.type) {
      case "Const":
        stack.push(instruction.value);
        ip += 1;
        break;
      case "Ident":
        stack.push(resolveIdentifier(instruction.name, context));
        ip += 1;
        break;
      case "LoadFormula": {
        const value = context.formula[instruction.name];
        // a formula using a failed formula fails with the same error
        if (value instanceof ErrorValue) throw new FormulaError(value.message);
        stack.push(value);
        ip += 1;
        break;
      }
      case "Member": {
        const target = stack.pop();
        stack.push(resolveMember(target, instruction.name));
        ip += 1;
        break;
      }
      case "Index": {
        const indexValue = stack.pop();
        const target = stack.pop();
        stack.push(resolveIndex(target, indexValue));
        ip += 1;
        break;
      }
      case "List": {
        const items = popArgs(stack, instruction.count);
        stack.push(items);
        ip += 1;
        break;
      }
      case "Unary": {
        const value = stack.pop();
        if (instruction.operator === "!") {
          stack.push(!toBoolean(value));
        } else if (instruction.operator === "-") {
          if (isDuration(value)) throw new FormulaError(`Unable to negate ${value.toString()}`);
          const numberValue = toNumber(value);
          stack.push(numberValue === null ? undefined : -numberValue);
        } else {
          stack.push(undefined);
        }
        ip += 1;
        break;
      }
      case "Binary": {
        const right = stack.pop();
        const left = stack.pop();
        stack.push(applyBinary(instruction.operator, left, right));
        ip += 1;
        break;
      }
      case "ToBool": {
        const value = stack.pop();
        stack.push(toBoolean(value));
        ip += 1;
        break;
      }
      case "CallGlobal": {
        const args = popArgs(stack, instruction.argc);
        const fn = getGlobalFunction(instruction.name);
        if (!fn) {
          stack.push(undefined);
          ip += 1;
          break;
        }
        try {
          stack.push(fn(args, context));
        } catch (error) {
          if (error instanceof FormulaError) throw error;
          stack.push(undefined);
        }
        ip += 1;
        break;
      }
      case "CallMethod": {
        const args = popArgs(stack, instruction.argc);
        const target = stack.pop();
        if ((target === null || target === undefined) && instruction.name === "isEmpty") {
          stack.push(true);
          ip += 1;
          break;
        }
        const fn = getMethodFunction(instruction.name, target);
        if (!fn) {
          if (isDuration(target)) {
            throw new FormulaError(`Cannot find function "${instruction.name}" on type Duration`);
          }
          stack.push(undefined);
          ip += 1;
          break;
        }
        try {
          stack.push(fn(target, args, context));
        } catch (error) {
          if (error instanceof FormulaError) throw error;
          stack.push(undefined);
        }
        ip += 1;
        break;
      }
      case "CallMethodLazy": {
        const target = stack.pop();
        const result = executeLazyMethod(
          instruction.name,
          target,
          instruction.argPrograms,
          context,
        );
        stack.push(result);
        ip += 1;
        break;
      }
      case "Jump":
        ip += instruction.offset;
        break;
      case "JumpIfFalse": {
        const value = stack.pop();
        if (!toBoolean(value)) {
          ip += instruction.offset;
        } else {
          ip += 1;
        }
        break;
      }
      case "JumpIfTrue": {
        const value = stack.pop();
        if (toBoolean(value)) {
          ip += instruction.offset;
        } else {
          ip += 1;
        }
        break;
      }
      default:
        ip += 1;
        break;
    }
  }

  return stack.pop();
}
