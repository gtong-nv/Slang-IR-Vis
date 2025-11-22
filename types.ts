
export enum IRNodeType {
  Instruction = 'Instruction',
  Block = 'Block',
  Function = 'Function',
  Metadata = 'Metadata',
  Variable = 'Variable',
  Literal = 'Literal',
  Unknown = 'Unknown',
  Struct = 'Struct',
  Parameter = 'Parameter'
}

export interface IROperand {
  raw: string;
  refId?: string; // if it references another %id
}

export interface IRAttribute {
  name: string;
  args: string;
  raw: string;
  operands: IROperand[];
}

export interface IRNode {
  id: string;
  originalLine: string;
  type: IRNodeType;
  opcode?: string;
  dataType?: string;
  operands: IROperand[];
  lineIndex: number;
  description?: string;
  attributes?: IRAttribute[];
  parentBlockId?: string;
}

export interface IRGraphNode {
  id: string;
  label: string;
  type: IRNodeType;
  details: IRNode;
  group?: number;
  radius?: number;
  parentBlockId?: string;
  // d3.SimulationNodeDatum properties
  index?: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface IRGraphLink {
  source: string | IRGraphNode;
  target: string | IRGraphNode;
  index?: number;
  kind?: 'dependency' | 'structural';
}

export interface ParsedIR {
  nodes: Map<string, IRNode>;
  edges: { from: string; to: string }[]; // Dependency edges (from Definition to Usage)
  functions: string[];
  rawLines: string[];
}

export interface IRPass {
  name: string;
  content: string;
}
