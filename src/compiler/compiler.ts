import type {
  BinaryExpression,
  CallExpression,
  Expression,
  IdentifierExpression,
  IndexExpression,
  ListExpression,
  LiteralExpression,
  MemberExpression,
  UnaryExpression,
} from "./ast";
import { CompilerError } from "./errors";
import type { Instruction } from "./ir";

const LAZY_METHODS = new Set(["filter", "map", "find", "some", "every", "flatMap", "reduce"]);

export type CompiledExpression = {
  ast: Expression;
  instructions: Instruction[];
};

class Compiler {
  private readonly instructions: Instruction[] = [];

  public compile(expression: Expression): Instruction[] {
    this.compileExpression(expression);
    return this.instructions;
  }

  private compileExpression(expression: Expression): void {
    switch (expression.type) {
      case "Literal":
        this.compileLiteral(expression);
        return;
      case "Identifier":
        this.compileIdentifier(expression);
        return;
      case "List":
        this.compileList(expression);
        return;
      case "Unary":
        this.compileUnary(expression);
        return;
      case "Binary":
        this.compileBinary(expression);
        return;
      case "Member":
        this.compileMember(expression);
        return;
      case "Index":
        this.compileIndex(expression);
        return;
      case "Call":
        this.compileCall(expression);
        return;
    }
  }

  private compileLiteral(expression: LiteralExpression): void {
    this.emit({ type: "Const", value: expression.value });
  }

  private compileIdentifier(expression: IdentifierExpression): void {
    this.emit({ type: "Ident", name: expression.name });
  }

  private compileList(expression: ListExpression): void {
    for (const element of expression.elements) {
      this.compileExpression(element);
    }
    this.emit({ type: "List", count: expression.elements.length });
  }

  private compileUnary(expression: UnaryExpression): void {
    this.compileExpression(expression.argument);
    this.emit({ type: "Unary", operator: expression.operator });
  }

  private compileBinary(expression: BinaryExpression): void {
    if (expression.operator === "&&" || expression.operator === "||") {
      this.compileLogical(expression);
      return;
    }

    this.compileExpression(expression.left);
    this.compileExpression(expression.right);
    this.emit({ type: "Binary", operator: expression.operator });
  }

  private compileLogical(expression: BinaryExpression): void {
    const operator = expression.operator;
    this.compileExpression(expression.left);
    this.emit({ type: "ToBool" });

    if (operator === "&&") {
      const jumpFalse = this.emit({ type: "JumpIfFalse", offset: 0 });
      this.compileExpression(expression.right);
      this.emit({ type: "ToBool" });
      const jumpEnd = this.emit({ type: "Jump", offset: 0 });
      const falseIndex = this.instructions.length;
      this.emit({ type: "Const", value: false });
      const endIndex = this.instructions.length;
      this.patchJump(jumpFalse, falseIndex);
      this.patchJump(jumpEnd, endIndex);
      return;
    }

    const jumpTrue = this.emit({ type: "JumpIfTrue", offset: 0 });
    this.compileExpression(expression.right);
    this.emit({ type: "ToBool" });
    const jumpEnd = this.emit({ type: "Jump", offset: 0 });
    const trueIndex = this.instructions.length;
    this.emit({ type: "Const", value: true });
    const endIndex = this.instructions.length;
    this.patchJump(jumpTrue, trueIndex);
    this.patchJump(jumpEnd, endIndex);
  }

  private compileMember(expression: MemberExpression): void {
    if (
      expression.object.type === "Identifier" &&
      expression.object.name === "formula" &&
      expression.property
    ) {
      this.emit({ type: "LoadFormula", name: expression.property });
      return;
    }

    this.compileExpression(expression.object);
    this.emit({ type: "Member", name: expression.property });
  }

  private compileIndex(expression: IndexExpression): void {
    this.compileExpression(expression.object);
    this.compileExpression(expression.index);
    this.emit({ type: "Index" });
  }

  private compileCall(expression: CallExpression): void {
    if (expression.callee.type === "Identifier" && expression.callee.name === "if") {
      this.compileIfExpression(expression.args);
      return;
    }

    if (expression.callee.type === "Identifier") {
      for (const arg of expression.args) {
        this.compileExpression(arg);
      }
      this.emit({
        type: "CallGlobal",
        name: expression.callee.name,
        argc: expression.args.length,
      });
      return;
    }

    if (expression.callee.type === "Member") {
      if (LAZY_METHODS.has(expression.callee.property)) {
        this.compileExpression(expression.callee.object);
        const argPrograms: Instruction[][] = [];
        for (const arg of expression.args) {
          const subCompiler = new Compiler();
          argPrograms.push(subCompiler.compile(arg));
        }
        this.emit({
          type: "CallMethodLazy",
          name: expression.callee.property,
          argPrograms,
        });
        return;
      }

      this.compileExpression(expression.callee.object);
      for (const arg of expression.args) {
        this.compileExpression(arg);
      }
      this.emit({
        type: "CallMethod",
        name: expression.callee.property,
        argc: expression.args.length,
      });
      return;
    }

    throw new CompilerError("Unsupported call target", expression.span);
  }

  private compileIfExpression(args: Expression[]): void {
    const condition = args[0];
    const whenTrue = args[1];
    const whenFalse = args[2];

    if (!condition) {
      this.emit({ type: "Const", value: undefined });
      return;
    }

    this.compileExpression(condition);
    this.emit({ type: "ToBool" });
    const jumpFalse = this.emit({ type: "JumpIfFalse", offset: 0 });

    if (whenTrue) {
      this.compileExpression(whenTrue);
    } else {
      this.emit({ type: "Const", value: undefined });
    }

    const jumpEnd = this.emit({ type: "Jump", offset: 0 });
    const falseIndex = this.instructions.length;

    if (whenFalse) {
      this.compileExpression(whenFalse);
    } else {
      this.emit({ type: "Const", value: undefined });
    }

    const endIndex = this.instructions.length;
    this.patchJump(jumpFalse, falseIndex);
    this.patchJump(jumpEnd, endIndex);
  }

  private emit(instruction: Instruction): number {
    this.instructions.push(instruction);
    return this.instructions.length - 1;
  }

  private patchJump(index: number, target: number): void {
    const instruction = this.instructions[index];
    if (!instruction) {
      throw new CompilerError("Invalid jump patch", { start: 0, end: 0 });
    }

    if (instruction.type === "Jump") {
      this.instructions[index] = { ...instruction, offset: target - index };
      return;
    }

    if (instruction.type === "JumpIfFalse") {
      this.instructions[index] = { ...instruction, offset: target - index };
      return;
    }

    if (instruction.type === "JumpIfTrue") {
      this.instructions[index] = { ...instruction, offset: target - index };
      return;
    }

    throw new CompilerError("Cannot patch non-jump instruction", { start: 0, end: 0 });
  }
}

export function compileAst(expression: Expression): CompiledExpression {
  const compiler = new Compiler();
  const instructions = compiler.compile(expression);
  return { ast: expression, instructions };
}
