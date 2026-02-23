// ─── Node registry ─────────────────────────────────────────────────────────
// Single source of truth for all node types, their signatures (port types),
// display labels, and factory functions for creating fresh node data.

import type { XYPosition } from '@xyflow/react';
import {
  TInt, TFloat, TBool, TString, TList, TFun, TVar, TUnknown, TFunChain,
} from '../types/haskell';
import type { LibNodeData, Port, PrimOp, ListOp, HofOp } from '../types/nodes';
import { newId, shortId } from '../utils/idGen';

// ─── Palette categories ────────────────────────────────────────────────────

export type PaletteCategory =
  | 'values'
  | 'arithmetic'
  | 'comparison'
  | 'logic'
  | 'lists'
  | 'higher-order'
  | 'utilities'
  | 'control'
  | 'io'
  | 'modules';

// ─── NodeDefinition ────────────────────────────────────────────────────────

export interface NodeDefinition {
  kind: LibNodeData['kind'];
  subtype?: string;              // op name for primop/listop/hof
  label: string;                 // palette + node header display
  category: PaletteCategory;
  description: string;           // shown in PropertiesPanel
  makeData: (nodeId: string) => LibNodeData;
}

// ─── Port factory helpers ──────────────────────────────────────────────────

const inp = (id: string, label: string, type = TUnknown): Port =>
  ({ id, label, direction: 'input', type, connected: false });

const out = (id: string, label: string, type = TUnknown): Port =>
  ({ id, label, direction: 'output', type, connected: false });

// Fresh TypeVar names scoped to a node instance
const freshVar = (base: string, id: string) => TVar(`${base}_${id}`);

// ─── Value nodes ───────────────────────────────────────────────────────────

const valueNodes: NodeDefinition[] = [
  {
    kind: 'value', subtype: 'Int',
    label: 'Integer',
    category: 'values',
    description: 'A whole number literal, e.g. 42',
    makeData: () => ({
      kind: 'value', valueType: 'Int', literal: '0',
      ports: [out('result', 'value', TInt)],
    }),
  },
  {
    kind: 'value', subtype: 'Float',
    label: 'Float',
    category: 'values',
    description: 'A floating-point number literal, e.g. 3.14',
    makeData: () => ({
      kind: 'value', valueType: 'Float', literal: '0.0',
      ports: [out('result', 'value', TFloat)],
    }),
  },
  {
    kind: 'value', subtype: 'Bool',
    label: 'Bool',
    category: 'values',
    description: 'A boolean literal: True or False',
    makeData: () => ({
      kind: 'value', valueType: 'Bool', literal: 'True',
      ports: [out('result', 'value', TBool)],
    }),
  },
  {
    kind: 'value', subtype: 'String',
    label: 'String',
    category: 'values',
    description: 'A text string literal, e.g. "hello"',
    makeData: () => ({
      kind: 'value', valueType: 'String', literal: '""',
      ports: [out('result', 'value', TString)],
    }),
  },
  {
    kind: 'value', subtype: 'List',
    label: 'List',
    category: 'values',
    description: 'A list literal, e.g. [1,2,3] or [True,False]',
    makeData: () => ({
      kind: 'value', valueType: 'List', literal: '[]',
      ports: [out('result', 'value', TList(TUnknown))],
    }),
  },
];

// ─── Arithmetic nodes ──────────────────────────────────────────────────────

function arithOp(op: PrimOp, label: string, desc: string): NodeDefinition {
  return {
    kind: 'primop', subtype: op, label, category: 'arithmetic', description: desc,
    makeData: (id) => {
      const a = freshVar('a', id);
      return {
        kind: 'primop', op,
        ports: [inp('arg0', 'x', a), inp('arg1', 'y', a), out('result', 'result', a)],
      };
    },
  };
}

function unaryArith(op: PrimOp, label: string, desc: string): NodeDefinition {
  return {
    kind: 'primop', subtype: op, label, category: 'arithmetic', description: desc,
    makeData: (id) => {
      const a = freshVar('a', id);
      return { kind: 'primop', op, ports: [inp('arg0', 'x', a), out('result', 'result', a)] };
    },
  };
}

const arithmeticNodes: NodeDefinition[] = [
  arithOp('+', 'Add (+)', 'x + y :: Num a => a → a → a'),
  arithOp('-', 'Subtract (-)', 'x - y :: Num a => a → a → a'),
  arithOp('*', 'Multiply (*)', 'x * y :: Num a => a → a → a'),
  {
    kind: 'primop', subtype: 'div', label: 'Div (÷)', category: 'arithmetic',
    description: 'Integer division: div x y :: Int → Int → Int',
    makeData: () => ({
      kind: 'primop', op: 'div',
      ports: [inp('arg0', 'x', TInt), inp('arg1', 'y', TInt), out('result', 'result', TInt)],
    }),
  },
  {
    kind: 'primop', subtype: 'mod', label: 'Mod (%)', category: 'arithmetic',
    description: 'Remainder: mod x y :: Int → Int → Int',
    makeData: () => ({
      kind: 'primop', op: 'mod',
      ports: [inp('arg0', 'x', TInt), inp('arg1', 'y', TInt), out('result', 'result', TInt)],
    }),
  },
  unaryArith('negate', 'Negate', 'negate x :: Num a => a → a'),
  unaryArith('abs', 'Abs', 'abs x :: Num a => a → a'),
];

// ─── Comparison nodes ──────────────────────────────────────────────────────

function cmpOp(op: PrimOp, label: string): NodeDefinition {
  return {
    kind: 'primop', subtype: op, label, category: 'comparison',
    description: `(${op}) :: Ord a => a → a → Bool`,
    makeData: (id) => {
      const a = freshVar('a', id);
      return {
        kind: 'primop', op,
        ports: [inp('arg0', 'x', a), inp('arg1', 'y', a), out('result', 'result', TBool)],
      };
    },
  };
}

const comparisonNodes: NodeDefinition[] = [
  cmpOp('==', 'Equal (==)'),
  cmpOp('/=', 'Not Equal (/=)'),
  cmpOp('<',  'Less Than (<)'),
  cmpOp('>',  'Greater Than (>)'),
  cmpOp('<=', 'Less or Equal (<=)'),
  cmpOp('>=', 'Greater or Equal (>=)'),
];

// ─── Logic nodes ───────────────────────────────────────────────────────────

const logicNodes: NodeDefinition[] = [
  {
    kind: 'primop', subtype: '&&', label: 'And (&&)', category: 'logic',
    description: 'Logical AND: (&&) :: Bool → Bool → Bool',
    makeData: () => ({
      kind: 'primop', op: '&&',
      ports: [inp('arg0', 'p', TBool), inp('arg1', 'q', TBool), out('result', 'result', TBool)],
    }),
  },
  {
    kind: 'primop', subtype: '||', label: 'Or (||)', category: 'logic',
    description: 'Logical OR: (||) :: Bool → Bool → Bool',
    makeData: () => ({
      kind: 'primop', op: '||',
      ports: [inp('arg0', 'p', TBool), inp('arg1', 'q', TBool), out('result', 'result', TBool)],
    }),
  },
  {
    kind: 'primop', subtype: 'not', label: 'Not', category: 'logic',
    description: 'Logical NOT: not :: Bool → Bool',
    makeData: () => ({
      kind: 'primop', op: 'not',
      ports: [inp('arg0', 'p', TBool), out('result', 'result', TBool)],
    }),
  },
];

// ─── List nodes ────────────────────────────────────────────────────────────

function listOp(op: ListOp, label: string, desc: string, makePorts: (id: string) => Port[]): NodeDefinition {
  return {
    kind: 'listop', subtype: op, label, category: 'lists', description: desc,
    makeData: (id) => ({ kind: 'listop', op, ports: makePorts(id) }),
  };
}

const listNodes: NodeDefinition[] = [
  listOp('head', 'head', 'head :: [a] → a', (id) => {
    const a = freshVar('a', id);
    return [inp('list', 'xs', TList(a)), out('result', 'result', a)];
  }),
  listOp('tail', 'tail', 'tail :: [a] → [a]', (id) => {
    const a = freshVar('a', id);
    return [inp('list', 'xs', TList(a)), out('result', 'result', TList(a))];
  }),
  listOp('cons', 'cons (:)', 'cons :: a → [a] → [a]', (id) => {
    const a = freshVar('a', id);
    return [inp('elem', 'x', a), inp('list', 'xs', TList(a)), out('result', 'result', TList(a))];
  }),
  listOp('null', 'null (isEmpty)', 'null :: [a] → Bool', (id) => {
    const a = freshVar('a', id);
    return [inp('list', 'xs', TList(a)), out('result', 'result', TBool)];
  }),
  listOp('length', 'length', 'length :: [a] → Int', (id) => {
    const a = freshVar('a', id);
    return [inp('list', 'xs', TList(a)), out('result', 'result', TInt)];
  }),
  listOp('++', 'append (++)', '(++) :: [a] → [a] → [a]', (id) => {
    const a = freshVar('a', id);
    return [inp('list0', 'xs', TList(a)), inp('list1', 'ys', TList(a)), out('result', 'result', TList(a))];
  }),
  listOp('reverse', 'reverse', 'reverse :: [a] → [a]', (id) => {
    const a = freshVar('a', id);
    return [inp('list', 'xs', TList(a)), out('result', 'result', TList(a))];
  }),
  listOp('take', 'take', 'take :: Int → [a] → [a]', (id) => {
    const a = freshVar('a', id);
    return [inp('n', 'n', TInt), inp('list', 'xs', TList(a)), out('result', 'result', TList(a))];
  }),
  listOp('drop', 'drop', 'drop :: Int → [a] → [a]', (id) => {
    const a = freshVar('a', id);
    return [inp('n', 'n', TInt), inp('list', 'xs', TList(a)), out('result', 'result', TList(a))];
  }),
  listOp('elem', 'elem', 'elem :: Eq a => a → [a] → Bool', (id) => {
    const a = freshVar('a', id);
    return [inp('x', 'x', a), inp('list', 'xs', TList(a)), out('result', 'result', TBool)];
  }),
  listOp('last', 'last', 'last :: [a] → a', (id) => {
    const a = freshVar('a', id);
    return [inp('list', 'xs', TList(a)), out('result', 'result', a)];
  }),
  listOp('init', 'init', 'init :: [a] → [a]', (id) => {
    const a = freshVar('a', id);
    return [inp('list', 'xs', TList(a)), out('result', 'result', TList(a))];
  }),
];

// ─── Higher-order function nodes ───────────────────────────────────────────

function hofNode(op: HofOp, label: string, desc: string, makePorts: (id: string) => Port[]): NodeDefinition {
  return {
    kind: 'hof', subtype: op, label, category: 'higher-order', description: desc,
    makeData: (id) => ({ kind: 'hof', op, ports: makePorts(id) }),
  };
}

const hofNodes: NodeDefinition[] = [
  hofNode('map', 'map', 'map :: (a → b) → [a] → [b]', (id) => {
    const a = freshVar('a', id), b = freshVar('b', id);
    return [inp('fn', 'f', TFun(a, b)), inp('list', 'xs', TList(a)), out('result', 'result', TList(b))];
  }),
  hofNode('filter', 'filter', 'filter :: (a → Bool) → [a] → [a]', (id) => {
    const a = freshVar('a', id);
    return [inp('fn', 'p', TFun(a, TBool)), inp('list', 'xs', TList(a)), out('result', 'result', TList(a))];
  }),
  hofNode('foldr', 'foldr', 'foldr :: (a → b → b) → b → [a] → b', (id) => {
    const a = freshVar('a', id), b = freshVar('b', id);
    return [
      inp('fn',   'f',  TFun(a, TFun(b, b))),
      inp('init', 'z',  b),
      inp('list', 'xs', TList(a)),
      out('result', 'result', b),
    ];
  }),
  hofNode('foldl', 'foldl', 'foldl :: (b → a → b) → b → [a] → b', (id) => {
    const a = freshVar('a', id), b = freshVar('b', id);
    return [
      inp('fn',   'f',  TFun(b, TFun(a, b))),
      inp('init', 'z',  b),
      inp('list', 'xs', TList(a)),
      out('result', 'result', b),
    ];
  }),
  hofNode('zipWith', 'zipWith', 'zipWith :: (a → b → c) → [a] → [b] → [c]', (id) => {
    const a = freshVar('a', id), b = freshVar('b', id), c = freshVar('c', id);
    return [
      inp('fn',    'f',  TFun(a, TFun(b, c))),
      inp('list0', 'xs', TList(a)),
      inp('list1', 'ys', TList(b)),
      out('result', 'result', TList(c)),
    ];
  }),
];

// ─── Utility nodes (list aggregates + range) ──────────────────────────────
// These wrap builtins that take a single list and return a scalar/list.

type UtilOp = 'sum' | 'product' | 'maximum' | 'minimum' | 'range';

function utilNode(op: UtilOp, label: string, desc: string, makePorts: (id: string) => Port[]): NodeDefinition {
  return {
    kind: 'listop', subtype: op, label, category: 'utilities', description: desc,
    makeData: (id) => ({ kind: 'listop', op: op as ListOp, ports: makePorts(id) }),
  };
}

const utilityNodes: NodeDefinition[] = [
  utilNode('sum', 'sum', 'sum :: Num a => [a] → a', () =>
    [inp('list', 'xs', TList(TInt)), out('result', 'result', TInt)]),
  utilNode('product', 'product', 'product :: Num a => [a] → a', () =>
    [inp('list', 'xs', TList(TInt)), out('result', 'result', TInt)]),
  utilNode('maximum', 'maximum', 'maximum :: Ord a => [a] → a', (id) => {
    const a = freshVar('a', id);
    return [inp('list', 'xs', TList(a)), out('result', 'result', a)];
  }),
  utilNode('minimum', 'minimum', 'minimum :: Ord a => [a] → a', (id) => {
    const a = freshVar('a', id);
    return [inp('list', 'xs', TList(a)), out('result', 'result', a)];
  }),
  // range n  ≡  [1..n]  (1-based, inclusive)
  {
    kind: 'listop', subtype: 'range', label: 'range [1..n]', category: 'utilities',
    description: 'range n = [1,2,...,n] :: Int → [Int]',
    makeData: () => ({
      kind: 'listop', op: 'range' as ListOp,
      ports: [inp('n', 'n', TInt), out('result', 'result', TList(TInt))],
    }),
  },
  // zip
  {
    kind: 'listop', subtype: 'zip', label: 'zip', category: 'utilities',
    description: 'zip :: [a] → [b] → [(a,b)]',
    makeData: (id) => {
      const a = freshVar('a', id), b = freshVar('b', id);
      return {
        kind: 'listop', op: 'zip' as ListOp,
        ports: [inp('list0', 'xs', TList(a)), inp('list1', 'ys', TList(b)), out('result', 'result', TList(TUnknown))],
      };
    },
  },
];

// ─── Control nodes ─────────────────────────────────────────────────────────

const controlNodes: NodeDefinition[] = [
  {
    kind: 'lambda', label: 'Lambda (λ)', category: 'control',
    description: 'Creates an anonymous function: \\x -> body',
    makeData: (id) => {
      const a = freshVar('a', id), b = freshVar('b', id);
      return {
        kind: 'lambda', paramName: 'x',
        ports: [
          inp('body', 'body', b),
          out('result', 'λ result', TFun(a, b)),
        ],
      };
    },
  },
  {
    kind: 'if', label: 'If / Then / Else', category: 'control',
    description: 'if condition then trueValue else falseValue',
    makeData: (id) => {
      const a = freshVar('a', id);
      return {
        kind: 'if',
        ports: [
          inp('cond', 'if',   TBool),
          inp('then', 'then', a),
          inp('else', 'else', a),
          out('result', 'result', a),
        ],
      };
    },
  },
  {
    kind: 'apply', label: 'Apply ($)', category: 'control',
    description: 'Apply a function to an argument: f $ x',
    makeData: (id) => {
      const a = freshVar('a', id), b = freshVar('b', id);
      return {
        kind: 'apply',
        ports: [
          inp('fn',  'f', TFun(a, b)),
          inp('arg', 'x', a),
          out('result', 'result', b),
        ],
      };
    },
  },
];

// ─── I/O nodes ─────────────────────────────────────────────────────────────

const ioNodes: NodeDefinition[] = [
  {
    kind: 'output', label: 'Output', category: 'io',
    description: 'Displays the result of a computation',
    makeData: (id) => {
      const a = freshVar('a', id);
      return {
        kind: 'output', label: 'Output', lastValue: null,
        ports: [inp('value', 'value', a)],
      };
    },
  },
];

// ─── Full registry ─────────────────────────────────────────────────────────

export const NODE_REGISTRY: NodeDefinition[] = [
  ...valueNodes,
  ...arithmeticNodes,
  ...comparisonNodes,
  ...logicNodes,
  ...listNodes,
  ...hofNodes,
  ...utilityNodes,
  ...controlNodes,
  ...ioNodes,
];

// Look up a definition by kind + optional subtype
export function findDefinition(kind: string, subtype?: string): NodeDefinition | undefined {
  return NODE_REGISTRY.find(d =>
    d.kind === kind && (subtype === undefined || d.subtype === subtype)
  );
}

// Create a fresh LibNode from a definition
export function createNode(def: NodeDefinition, position: XYPosition) {
  const id = newId();
  return {
    id,
    type: def.kind,
    position,
    data: def.makeData(id),
  };
}

// Group definitions by category for the Palette
export function groupByCategory(): Map<PaletteCategory, NodeDefinition[]> {
  const map = new Map<PaletteCategory, NodeDefinition[]>();
  for (const def of NODE_REGISTRY) {
    const group = map.get(def.category) ?? [];
    group.push(def);
    map.set(def.category, group);
  }
  return map;
}

export const CATEGORY_LABELS: Record<PaletteCategory, string> = {
  values:         'Values',
  arithmetic:     'Arithmetic',
  comparison:     'Comparison',
  logic:          'Logic',
  lists:          'Lists',
  'higher-order': 'Higher-Order',
  utilities:      'Utilities',
  control:        'Control',
  io:             'Input / Output',
  modules:        'Modules',
};
