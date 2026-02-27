// ─── Node data types ───────────────────────────────────────────────────────
// LibNodeData is a discriminated union over all node kinds.
// Each node carries typed input/output ports.

import type { Node } from '@xyflow/react';
import type { HaskellType } from './haskell';

// Every port on a node
export interface Port {
  id: string;                    // unique within node, e.g. 'arg0', 'result'
  label: string;                 // shown in UI, e.g. 'x', 'f', 'result'
  direction: 'input' | 'output';
  type: HaskellType;             // inferred or declared
  connected: boolean;            // drives partial-application logic
}

// ─── Primitive operation types ─────────────────────────────────────────────
export type PrimOp =
  | '+' | '-' | '*' | 'div' | 'mod'
  | '==' | '/=' | '<' | '>' | '<=' | '>='
  | '&&' | '||' | 'not'
  | 'negate' | 'abs';

export type ListOp =
  | 'head' | 'tail' | 'cons' | 'uncons' | 'null' | 'length' | '++' | 'reverse'
  | 'take' | 'drop' | 'elem' | 'last' | 'init';

export type HofOp = 'map' | 'filter' | 'foldr' | 'foldl' | 'foldl1' | 'foldr1' | 'zipWith';

// ─── Node data variants ────────────────────────────────────────────────────

export interface ValueNodeData {
  kind: 'value';
  valueType: 'Int' | 'Float' | 'Bool' | 'String' | 'List';
  literal: string;       // raw user-entered string, parsed at eval time
  ports: Port[];         // single output port
  [key: string]: unknown;
}

export interface PrimOpNodeData {
  kind: 'primop';
  op: PrimOp;
  ports: Port[];
  [key: string]: unknown;
}

export interface ListOpNodeData {
  kind: 'listop';
  op: ListOp;
  ports: Port[];
  [key: string]: unknown;
}

export interface HofNodeData {
  kind: 'hof';
  op: HofOp;
  ports: Port[];
  [key: string]: unknown;
}

export interface LambdaNodeData {
  kind: 'lambda';
  paramName: string;      // bound variable name, shown on input port
  ports: Port[];          // 'param' input + 'body' input + 'result' output (Fun type)
  [key: string]: unknown;
}

export interface IfNodeData {
  kind: 'if';
  ports: Port[];          // 'cond' (Bool), 'then' (a), 'else' (a), 'result' (a)
  [key: string]: unknown;
}

export interface ApplyNodeData {
  kind: 'apply';
  ports: Port[];          // 'fn' (a->b), 'arg' (a), 'result' (b)
  [key: string]: unknown;
}

export interface OutputNodeData {
  kind: 'output';
  label: string;          // user-editable display name
  lastValue: string | null; // rendered result string (set by evaluator)
  ports: Port[];          // single input
  [key: string]: unknown;
}

export interface ModuleNodeData {
  kind: 'module';
  name: string;
  description: string;
  subgraphId: string;     // UUID key into graphStore.subgraphs
  inputPorts: Port[];
  outputPorts: Port[];
  ports: Port[];          // inputPorts ++ outputPorts
  [key: string]: unknown;
}

export interface CallNodeData {
  kind: 'call';
  targetName: string;     // name of the Function to call ('' = unset)
  ports: Port[];          // mirrors target function's inputPorts + outputPorts
  [key: string]: unknown;
}

export interface LetNodeData {
  kind: 'let';
  varName: string;        // the bound variable name, default 'x'
  ports: Port[];          // 'value' input, 'param' output (Var), 'body' input, 'result' output
  [key: string]: unknown;
}

export interface ListCompNodeData {
  kind: 'listcomp';
  // [ transform x | x <- list, pred x ]
  // Desugars to: map transform (filter pred list)
  // If pred port is unconnected, desugars to: map transform list
  ports: Port[];   // 'list' input, 'transform' input, 'pred' input (optional), 'result' output
  [key: string]: unknown;
}

// ─── Discriminated union ───────────────────────────────────────────────────

export type LibNodeData =
  | ValueNodeData
  | PrimOpNodeData
  | ListOpNodeData
  | HofNodeData
  | LambdaNodeData
  | IfNodeData
  | ApplyNodeData
  | OutputNodeData
  | ModuleNodeData
  | CallNodeData
  | LetNodeData
  | ListCompNodeData;

// React Flow typed node
export type LibNode = Node<LibNodeData>;

// ─── Port helpers ──────────────────────────────────────────────────────────

export function getPorts(data: LibNodeData): Port[] {
  return data.ports;
}

export function getInputPorts(data: LibNodeData): Port[] {
  return data.ports.filter(p => p.direction === 'input');
}

export function getOutputPorts(data: LibNodeData): Port[] {
  return data.ports.filter(p => p.direction === 'output');
}

// Handle ID used by React Flow: must be unique across all nodes
export function handleId(nodeId: string, portId: string): string {
  return `${nodeId}__${portId}`;
}
