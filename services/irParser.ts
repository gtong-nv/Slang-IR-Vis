
import { IRNode, IRNodeType, ParsedIR, IROperand, IRPass, IRAttribute } from '../types';

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

// Helper to find all %ID references in a string
// Used to extract hidden dependencies from types or complex operands
const findAllReferences = (text: string): string[] => {
  if (!text) return [];
  const matches = text.match(/%\w+/g);
  return matches ? Array.from(new Set(matches)) : []; // Unique refs
};

export const parseSlangIR = (input: string): ParsedIR => {
  const lines = input.split('\n');
  const nodes = new Map<string, IRNode>();
  const edges: { from: string; to: string }[] = [];
  const functions: string[] = [];

  // Regex patterns
  // let %1 : Type = opcode(operands) OR let %1 : Type = opcode
  const instructionRegex = /let\s+(%\w+)\s*:\s*(.+?)\s*=\s*(\w+)(?:\((.*)\))?/;
  
  // block %21:
  const blockRegex = /block\s+(%\w+)(?::|\()/; 

  // func %computeMain : Func(Void)
  const funcRegex = /func\s+(%\w+)\s*:\s*(.+)/;

  // %outputBuffer : RWStructuredBuffer(...) = global_param
  const globalParamRegex = /(%\w+)\s*:\s*(.+?)\s*=\s*global_param/;
  
  // witness_table %17 : witness_table_t(%IBufferDataLayout)(DefaultLayout);
  const witnessTableRegex = /witness_table\s+(%\w+)\s*:\s*(.+)/;

  // struct %genericStruct : Type
  const structRegex = /struct\s+(%\w+)\s*:\s*(.+)/;

  // param %dispatchThreadID : Type
  const paramRegex = /param\s+(%\w+)\s*:\s*(.+)/;

  // Attribute: [name(args)] or [name]
  const attributeRegex = /^\[(\w+)(?:\((.*)\))?\]$/;

  // Simple store: store(%26, %25) or Poison
  const voidOpRegex = /^\s*(\w+)(?:\((.*)\))?/; 

  let pendingAttributes: IRAttribute[] = [];
  let currentBlockId: string | null = null;

  // Helper to attach attributes and process their edges
  const attachAttributesAndProcessEdges = (nodeId: string) => {
     const attributes = [...pendingAttributes];
     
     attributes.forEach(attr => {
         // Add explicit operands from attribute
         attr.operands.forEach(op => {
             if (op.refId) {
                 edges.push({ from: op.refId, to: nodeId });
             }
         });
         // Also check raw args for hidden refs (e.g. layout(%1))
         const deepRefs = findAllReferences(attr.args);
         deepRefs.forEach(ref => {
            edges.push({ from: ref, to: nodeId });
         });
     });
     
     pendingAttributes = [];
     return attributes;
  };

  lines.forEach((line, index) => {
    const cleanLine = line.trim();
    if (!cleanLine || cleanLine.startsWith('//')) return;
    if (cleanLine.startsWith('###')) return; 

    // 0. Attributes
    const attrMatch = cleanLine.match(attributeRegex);
    if (attrMatch) {
        const [, name, args] = attrMatch;
        const operands = args ? parseOperands(args) : [];
        pendingAttributes.push({
            name,
            args: args || '',
            raw: cleanLine,
            operands
        });
        return; // Done with this line
    }

    // 1. Match LET instructions
    const letMatch = cleanLine.match(instructionRegex);
    if (letMatch) {
      const [, id, type, opcode, argsRaw] = letMatch;
      const operands = argsRaw ? parseOperands(argsRaw) : [];
      
      const node: IRNode = {
        id,
        originalLine: line,
        type: IRNodeType.Instruction,
        dataType: type,
        opcode,
        operands,
        lineIndex: index,
        attributes: attachAttributesAndProcessEdges(id),
        parentBlockId: currentBlockId || undefined
      };
      
      nodes.set(id, node);
      
      // Process Operands for Edges
      operands.forEach(op => {
        if (op.refId) {
           edges.push({ from: op.refId, to: id });
        }
        // Deep scan for nested refs in complex operands like foo(%1)
        const deepRefs = findAllReferences(op.raw);
        deepRefs.forEach(ref => {
           if (ref !== op.refId) edges.push({ from: ref, to: id });
        });
      });

      // Process Type for Edges (Fixes generic specializations depending on other nodes)
      const typeRefs = findAllReferences(type);
      typeRefs.forEach(ref => {
          edges.push({ from: ref, to: id });
      });

      return;
    }

    // 2. Match Block definitions
    const blockMatch = cleanLine.match(blockRegex);
    if (blockMatch) {
      const [, id] = blockMatch;
      currentBlockId = id; // Set current block
      nodes.set(id, {
        id,
        originalLine: line,
        type: IRNodeType.Block,
        operands: [],
        lineIndex: index,
        opcode: 'block',
        attributes: attachAttributesAndProcessEdges(id)
      });
      return;
    }

    // 3. Match Function definitions
    const funcMatch = cleanLine.match(funcRegex);
    if (funcMatch) {
      const [, id, type] = funcMatch;
      functions.push(id);
      currentBlockId = null; // Reset current block when entering new function
      nodes.set(id, {
        id,
        originalLine: line,
        type: IRNodeType.Function,
        dataType: type,
        operands: [],
        lineIndex: index,
        opcode: 'func',
        attributes: attachAttributesAndProcessEdges(id)
      });
      return;
    }

    // 4. Global Params
    const globalMatch = cleanLine.match(globalParamRegex);
    if (globalMatch) {
      const [, id, type] = globalMatch;
      
      // Extract refs from type (e.g., RWStructuredBuffer<..., %7>)
      const typeRefs = findAllReferences(type);
      const extraOperands = typeRefs.map(ref => ({ raw: ref, refId: ref }));

      nodes.set(id, {
        id,
        originalLine: line,
        type: IRNodeType.Variable,
        dataType: type,
        opcode: 'global_param',
        operands: extraOperands,
        lineIndex: index,
        attributes: attachAttributesAndProcessEdges(id),
        // Global params usually not in a block
        parentBlockId: currentBlockId || undefined 
      });

      // Create edges from type references
      typeRefs.forEach(ref => {
          edges.push({ from: ref, to: id });
      });

      return;
    }

    // 5. Witness Tables (New)
    const witnessMatch = cleanLine.match(witnessTableRegex);
    if (witnessMatch) {
        let [, id, type] = witnessMatch;
        // Remove trailing semicolon if present
        if (type.endsWith(';')) type = type.slice(0, -1);

        // Extract refs from type (e.g., witness_table_t(%IBufferDataLayout)(DefaultLayout))
        const typeRefs = findAllReferences(type);
        const extraOperands = typeRefs.map(ref => ({ raw: ref, refId: ref }));

        nodes.set(id, {
            id,
            originalLine: line,
            type: IRNodeType.Variable, // Use Variable as it acts like a data definition
            dataType: type,
            opcode: 'witness_table',
            operands: extraOperands,
            lineIndex: index,
            attributes: attachAttributesAndProcessEdges(id),
            parentBlockId: currentBlockId || undefined
        });

        typeRefs.forEach(ref => {
            edges.push({ from: ref, to: id });
        });
        return;
    }

    // 6. Struct Definitions
    const structMatch = cleanLine.match(structRegex);
    if (structMatch) {
        const [, id, type] = structMatch;
        nodes.set(id, {
            id,
            originalLine: line,
            type: IRNodeType.Struct,
            dataType: type,
            opcode: 'struct',
            operands: [],
            lineIndex: index,
            attributes: attachAttributesAndProcessEdges(id)
        });
        return;
    }

    // 7. Param Definitions (in blocks)
    const paramMatch = cleanLine.match(paramRegex);
    if (paramMatch) {
        const [, id, type] = paramMatch;
        nodes.set(id, {
            id,
            originalLine: line,
            type: IRNodeType.Parameter,
            dataType: type,
            opcode: 'param',
            operands: [],
            lineIndex: index,
            attributes: attachAttributesAndProcessEdges(id),
            parentBlockId: currentBlockId || undefined
        });
        return;
    }

    // 8. Standalone/Void Ops
    const voidMatch = cleanLine.match(voidOpRegex);
    if (voidMatch && !line.includes('=')) {
       if (cleanLine.startsWith('[')) return; // Handled above
       if (cleanLine.endsWith(':')) return; // Labels/Blocks handled above

       const [, opcode, argsRaw] = voidMatch;
       const operands = argsRaw ? parseOperands(argsRaw) : [];
       const syntheticId = `line_${index}`;

       const node: IRNode = {
         id: syntheticId,
         originalLine: line,
         type: IRNodeType.Instruction,
         opcode,
         operands,
         lineIndex: index,
         description: 'Void Instruction',
         attributes: attachAttributesAndProcessEdges(syntheticId),
         parentBlockId: currentBlockId || undefined
       };
       nodes.set(syntheticId, node);

       operands.forEach(op => {
        if (op.refId) {
           edges.push({ from: op.refId, to: syntheticId });
        }
        // Deep scan for nested refs
        const deepRefs = findAllReferences(op.raw);
        deepRefs.forEach(ref => {
           if (ref !== op.refId) edges.push({ from: ref, to: syntheticId });
        });
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
  if (!rawArgs || !rawArgs.trim()) return [];
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
