import { IRNode, IRNodeType, ParsedIR, IROperand, IRPass } from '../types';

export const parsePasses = (input: string): IRPass[] => {
  // Normalize line endings
  const lines = input.replace(/\r\n/g, '\n').split('\n');
  const passes: IRPass[] = [];
  
  let currentBuffer: string[] = [];
  let currentName = "Source";
  let foundAnyPass = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Check for start of a pass delimiter sequence:
    // ###
    // ### <PASS NAME>
    if (line === '###') {
      // Look ahead for name line
      if (i + 1 < lines.length && lines[i+1].trim().startsWith('###')) {
        // Found a pass transition
        
        // Save previous pass if it exists and isn't just empty preamble
        if (foundAnyPass || currentBuffer.some(l => l.trim() !== '')) {
             // If it's the very first block and completely empty, ignore it (preamble)
             if (passes.length === 0 && !foundAnyPass && currentBuffer.every(l => l.trim() === '')) {
                 // ignore
             } else {
                 passes.push({
                     name: currentName,
                     content: currentBuffer.join('\n')
                 });
             }
        }
        
        // Start new pass
        const nameLine = lines[i+1].trim();
        // Remove '###' prefix and optional colon suffix
        let name = nameLine.replace(/^###/, '').trim();
        if (name.endsWith(':')) name = name.slice(0, -1);
        
        currentName = name || "Unnamed Pass";
        currentBuffer = [];
        foundAnyPass = true;
        
        // Skip the name line too
        i++; 
        continue;
      } else {
          // It's a ### but not followed by ### Name. Could be end delimiter.
          // We skip this line effectively acting as a separator.
          continue;
      }
    }
    
    currentBuffer.push(lines[i]);
  }
  
  // Flush final buffer
  if (currentBuffer.length > 0) {
      // If it was empty but we had passes, don't push empty at end
      if (foundAnyPass && currentBuffer.every(l => l.trim() === '')) {
          // ignore trailing empty
      } else {
        passes.push({
            name: currentName,
            content: currentBuffer.join('\n')
        });
      }
  }
  
  // Fallback for simple files without delimiters
  if (passes.length === 0) {
      return [{ name: 'Source', content: input }];
  }
  
  return passes;
};

export const parseSlangIR = (input: string): ParsedIR => {
  const lines = input.split('\n');
  const nodes = new Map<string, IRNode>();
  const edges: { from: string; to: string }[] = [];
  const functions: string[] = [];

  // Regex patterns
  // let %1 : Type = opcode(operands)
  const instructionRegex = /let\s+(%\w+)\s*:\s*(.+?)\s*=\s*(\w+)\((.*)\)/;
  
  // block %21:
  const blockRegex = /block\s+(%\w+)(?::|\()/; // Updated to handle optional params (

  // func %computeMain : Func(Void)
  const funcRegex = /func\s+(%\w+)\s*:\s*(.+)/;

  // %outputBuffer : RWStructuredBuffer(...) = global_param
  const globalParamRegex = /(%\w+)\s*:\s*(.+?)\s*=\s*global_param/;

  // Simple store: store(%26, %25)
  const voidOpRegex = /^\s*(\w+)\((.*)\)/; 

  lines.forEach((line, index) => {
    const cleanLine = line.trim();
    if (!cleanLine || cleanLine.startsWith('//')) return;
    if (cleanLine.startsWith('###')) return; // Ignore pass delimiters if any leak through

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
      
      operands.forEach(op => {
        if (op.refId) {
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

    // 5. Standalone/Void Ops
    const voidMatch = cleanLine.match(voidOpRegex);
    if (voidMatch && !line.includes('=')) {
       if (cleanLine.startsWith('[')) return;
       if (cleanLine.endsWith(':')) return;

       const [, opcode, argsRaw] = voidMatch;
       const operands = parseOperands(argsRaw);
       const syntheticId = `op_${index}`;

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
  const idMatch = raw.match(/%(?:[\w\d]+)/);
  if (idMatch) {
    return { raw, refId: idMatch[0] };
  }
  return { raw };
};
