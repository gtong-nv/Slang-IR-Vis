import { IRNode, IRNodeType, ParsedIR, IROperand } from '../types';

export const parseSlangIR = (input: string): ParsedIR => {
  const lines = input.split('\n');
  const nodes = new Map<string, IRNode>();
  const edges: { from: string; to: string }[] = [];
  const functions: string[] = [];

  // Regex patterns
  // let %1 : Type = opcode(operands)
  const instructionRegex = /let\s+(%\w+)\s*:\s*(.+?)\s*=\s*(\w+)\((.*)\)/;
  
  // block %21:
  const blockRegex = /block\s+(%\w+):/;

  // func %computeMain : Func(Void)
  const funcRegex = /func\s+(%\w+)\s*:\s*(.+)/;

  // %outputBuffer : RWStructuredBuffer(...) = global_param
  const globalParamRegex = /(%\w+)\s*:\s*(.+?)\s*=\s*global_param/;

  // Simple store: store(%26, %25) - this is an instruction without return value usually, but in IR often looks like op call
  // Some IR instructions don't return a value (void), e.g. store(%ptr, %val)
  // The provided sample shows `let` for almost everything, but `store` might be standalone
  const voidOpRegex = /^\s*(\w+)\((.*)\)/; 

  lines.forEach((line, index) => {
    const cleanLine = line.trim();
    if (!cleanLine || cleanLine.startsWith('//')) return;

    // 1. Match LET instructions
    const letMatch = cleanLine.match(instructionRegex);
    if (letMatch) {
      const [, id, type, opcode, argsRaw] = letMatch;
      const operands = parseOperands(argsRaw);
      
      const node: IRNode = {
        id,
        originalLine: line,
        type: IRNodeType.Instruction,
        dataType: type,
        opcode,
        operands,
        lineIndex: index
      };
      
      nodes.set(id, node);
      
      // Create edges from operands (dependencies) to this node
      operands.forEach(op => {
        if (op.refId) {
           // Dependency: op.refId must exist before node.id
           // Edge direction: op.refId -> node.id (Data flows from definition to usage)
           edges.push({ from: op.refId, to: id });
        }
      });
      return;
    }

    // 2. Match Block definitions
    const blockMatch = cleanLine.match(blockRegex);
    if (blockMatch) {
      const [, id] = blockMatch;
      nodes.set(id, {
        id,
        originalLine: line,
        type: IRNodeType.Block,
        operands: [],
        lineIndex: index,
        opcode: 'block'
      });
      return;
    }

    // 3. Match Function definitions
    const funcMatch = cleanLine.match(funcRegex);
    if (funcMatch) {
      const [, id, type] = funcMatch;
      functions.push(id);
      nodes.set(id, {
        id,
        originalLine: line,
        type: IRNodeType.Function,
        dataType: type,
        operands: [],
        lineIndex: index,
        opcode: 'func'
      });
      return;
    }

    // 4. Global Params
    const globalMatch = cleanLine.match(globalParamRegex);
    if (globalMatch) {
      const [, id, type] = globalMatch;
      nodes.set(id, {
        id,
        originalLine: line,
        type: IRNodeType.Variable,
        dataType: type,
        opcode: 'global_param',
        operands: [],
        lineIndex: index
      });
      return;
    }

    // 5. Standalone/Void Ops (like store)
    // These don't produce a %id result in the line itself usually, but they are nodes in execution
    // We assign a synthetic ID for visualization
    const voidMatch = cleanLine.match(voidOpRegex);
    if (voidMatch && !line.includes('=')) {
       // Exclude attributes like [entryPoint...]
       if (cleanLine.startsWith('[')) return;
       // Exclude labels
       if (cleanLine.endsWith(':')) return;

       const [, opcode, argsRaw] = voidMatch;
       const operands = parseOperands(argsRaw);
       const syntheticId = `op_${index}`; // synthetic ID

       const node: IRNode = {
         id: syntheticId,
         originalLine: line,
         type: IRNodeType.Instruction,
         opcode,
         operands,
         lineIndex: index,
         description: 'Void Instruction'
       };
       nodes.set(syntheticId, node);

       operands.forEach(op => {
        if (op.refId) {
           edges.push({ from: op.refId, to: syntheticId });
        }
      });
    }
  });

  return {
    nodes,
    edges,
    functions,
    rawLines: lines
  };
};

const parseOperands = (rawArgs: string): IROperand[] => {
  if (!rawArgs.trim()) return [];
  // Split by comma, but be careful about nested parens (simple split for now as Slang IR is usually flat-ish in args)
  // A better parser would handle nested structures, but for this viz, comma split is a 90% solution.
  // Slang IR vectors: makeVector(0 : UInt, 0 : UInt) -> contains commas inside.
  
  const operands: IROperand[] = [];
  let current = '';
  let depth = 0;

  for (let i = 0; i < rawArgs.length; i++) {
    const char = rawArgs[i];
    if (char === '(') depth++;
    if (char === ')') depth--;
    
    if (char === ',' && depth === 0) {
      operands.push(processOperand(current.trim()));
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    operands.push(processOperand(current.trim()));
  }
  
  return operands;
};

const processOperand = (raw: string): IROperand => {
  // Check for %id
  const idMatch = raw.match(/%(?:[\w\d]+)/);
  if (idMatch) {
    return { raw, refId: idMatch[0] };
  }
  return { raw };
};
