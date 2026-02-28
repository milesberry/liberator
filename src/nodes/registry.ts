// ─── Node registry ─────────────────────────────────────────────────────────
// Single source of truth for all node types, their signatures (port types),
// display labels, and factory functions for creating fresh node data.

import type { XYPosition } from '@xyflow/react';
import {
  TInt, TFloat, TBool, TString, TList, TFun, TVar, TUnknown, TTuple,
} from '../types/haskell';
import type { LibNodeData, Port, PrimOp, ListOp, HofOp } from '../types/nodes';
import { newId } from '../utils/idGen';

// ─── Palette categories ────────────────────────────────────────────────────

export type PaletteCategory =
  | 'values'
  | 'arithmetic'
  | 'comparison'
  | 'logic'
  | 'lists'
  | 'higher-order'
  | 'utilities'
  | 'tuples'
  | 'strings'
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
    kind: 'primop', subtype: '/', label: 'Divide (/)', category: 'arithmetic',
    description: '(/) :: Fractional a => a → a → Float  — works with Int or Float; always returns Float',
    makeData: (id) => {
      const a = freshVar('a', id);
      return {
        kind: 'primop', op: '/' as PrimOp,
        ports: [inp('arg0', 'x', a), inp('arg1', 'y', a), out('result', 'result', TFloat)],
      };
    },
  },
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
  listOp('uncons', 'x:xs (uncons)', 'Split a list into head and tail.\nhead :: a,  tail :: [a]', (id) => {
    const a = freshVar('a', id);
    return [inp('list', 'xs', TList(a)), out('head', 'head', a), out('tail', 'tail', TList(a))];
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
  // ── List pattern match ────────────────────────────────────────────────────
  {
    kind: 'matchlist', label: 'case [ ] of', category: 'control',
    description: 'List pattern match: [] base case and (x:xs) recursive case.\n' +
      'Connect xs → the list to inspect.\n' +
      'Connect [] → the value to return when the list is empty.\n' +
      'Connect x:xs → the value to return for a non-empty list;\n' +
      '  wire the head and tail outputs into that expression.',
    makeData: (id) => {
      const a = freshVar('a', id);
      const b = freshVar('b', id);
      return {
        kind: 'matchlist',
        headVar: 'x',
        tailVar: "xs'",
        ports: [
          inp('xs',     'xs',    TList(a)),   // the list to match on
          inp('nil',    '[]',    b),           // result when list is empty
          inp('cons',   'x:xs',  b),           // result for non-empty list
          out('head',   'head',  a),           // bound head variable
          out('tail',   'tail',  TList(a)),    // bound tail variable
          out('result', 'result', b),          // the case expression result
        ],
      };
    },
  },
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

// ─── Tuple nodes ───────────────────────────────────────────────────────────

const tupleNodes: NodeDefinition[] = [
  {
    kind: 'hof', subtype: 'pair', label: 'pair', category: 'tuples',
    description: 'pair :: a → b → (a, b)  — creates a 2-tuple',
    makeData: (id) => {
      const a = freshVar('a', id), b = freshVar('b', id);
      return {
        kind: 'hof', op: 'pair' as HofOp,
        ports: [inp('arg0', 'x', a), inp('arg1', 'y', b), out('result', 'result', TTuple([a, b]))],
      };
    },
  },
  {
    kind: 'hof', subtype: 'fst', label: 'fst', category: 'tuples',
    description: 'fst :: (a, b) → a  — first element of a pair',
    makeData: (id) => {
      const a = freshVar('a', id), b = freshVar('b', id);
      return {
        kind: 'hof', op: 'fst' as HofOp,
        ports: [inp('arg0', '(a,b)', TTuple([a, b])), out('result', 'result', a)],
      };
    },
  },
  {
    kind: 'hof', subtype: 'snd', label: 'snd', category: 'tuples',
    description: 'snd :: (a, b) → b  — second element of a pair',
    makeData: (id) => {
      const a = freshVar('a', id), b = freshVar('b', id);
      return {
        kind: 'hof', op: 'snd' as HofOp,
        ports: [inp('arg0', '(a,b)', TTuple([a, b])), out('result', 'result', b)],
      };
    },
  },
];

// ─── String nodes ──────────────────────────────────────────────────────────

type StringOp = 'concat' | 'show' | 'words' | 'unwords' | 'lines' | 'unlines' | 'strLength' | 'strReverse' | 'strConcat' | 'ord' | 'chr' | 'strToChars' | 'charsToStr';

function stringNode(op: StringOp, label: string, desc: string, makePorts: (id: string) => Port[]): NodeDefinition {
  return {
    kind: 'hof', subtype: op, label, category: 'strings', description: desc,
    makeData: (id) => ({ kind: 'hof', op: op as HofOp, ports: makePorts(id) }),
  };
}

const stringNodes: NodeDefinition[] = [
  stringNode('show', 'show', 'show :: a → String  — convert value to string', (id) => {
    const a = freshVar('a', id);
    return [inp('arg0', 'x', a), out('result', 'result', TString)];
  }),
  stringNode('strConcat', 'strConcat (++)', 'strConcat :: String → String → String', () =>
    [inp('arg0', 's1', TString), inp('arg1', 's2', TString), out('result', 'result', TString)]),
  stringNode('concat', 'concat', 'concat :: [String] → String  — join list of strings', () =>
    [inp('arg0', 'xss', TList(TString)), out('result', 'result', TString)]),
  stringNode('words', 'words', 'words :: String → [String]  — split on whitespace', () =>
    [inp('arg0', 's', TString), out('result', 'result', TList(TString))]),
  stringNode('unwords', 'unwords', 'unwords :: [String] → String  — join with spaces', () =>
    [inp('arg0', 'xs', TList(TString)), out('result', 'result', TString)]),
  stringNode('lines', 'lines', 'lines :: String → [String]  — split on newlines', () =>
    [inp('arg0', 's', TString), out('result', 'result', TList(TString))]),
  stringNode('unlines', 'unlines', 'unlines :: [String] → String  — join with newlines', () =>
    [inp('arg0', 'xs', TList(TString)), out('result', 'result', TString)]),
  stringNode('strLength', 'strLength', 'strLength :: String → Int', () =>
    [inp('arg0', 's', TString), out('result', 'result', TInt)]),
  stringNode('strReverse', 'strReverse', 'strReverse :: String → String', () =>
    [inp('arg0', 's', TString), out('result', 'result', TString)]),
  // Character / code-point
  stringNode('ord', 'ord', 'ord :: String → Int  — Unicode code point of the first character', () =>
    [inp('arg0', 'c', TString), out('result', 'result', TInt)]),
  stringNode('chr', 'chr', 'chr :: Int → String  — single-character string for a code point', () =>
    [inp('arg0', 'n', TInt), out('result', 'result', TString)]),
  stringNode('strToChars', 'strToChars', 'strToChars :: String → [Int]  — explode string into list of code points', () =>
    [inp('arg0', 's', TString), out('result', 'result', TList(TInt))]),
  stringNode('charsToStr', 'charsToStr', 'charsToStr :: [Int] → String  — collapse code points back into a string', () =>
    [inp('arg0', 'ns', TList(TInt)), out('result', 'result', TString)]),
];

// ─── List comprehension node ───────────────────────────────────────────────

const listCompNodes: NodeDefinition[] = [
  {
    kind: 'listcomp', label: 'List Comprehension', category: 'control',
    description: '[ f x | x ← xs, p x ]  — map f over xs, optionally filtering by p. Desugars to map f (filter p xs).',
    makeData: (id) => {
      const a = freshVar('a', id), b = freshVar('b', id);
      return {
        kind: 'listcomp',
        ports: [
          inp('list',      'xs',    TList(a)),
          inp('transform', 'f',     TFun(a, b)),
          inp('pred',      'p (opt)', TFun(a, TBool)),
          out('result',    'result', TList(b)),
        ],
      };
    },
  },
];

// ─── Control nodes ─────────────────────────────────────────────────────────

const controlNodes: NodeDefinition[] = [
  {
    kind: 'lambda', label: 'Lambda (λ)', category: 'control',
    description: 'Creates an anonymous function \\x -> body. Connect param → to inner nodes; wire their result → body.',
    makeData: (id) => {
      const a = freshVar('a', id), b = freshVar('b', id);
      return {
        kind: 'lambda', paramName: 'x',
        ports: [
          out('param',  'x →',      a),           // param output: the bound variable x
          inp('body',   '→ result', b),           // body input: the result expression
          out('result', 'λ',        TFun(a, b)), // result output: the whole λx.body
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
  {
    kind: 'let', label: 'Let (local variable)', category: 'control',
    description: 'let x = value in body — binds a local name. Wire the "= value" input and "x →" output into your expression, then connect the expression result to "in →".',
    makeData: (id) => {
      const a = freshVar('a', id), b = freshVar('b', id);
      return {
        kind: 'let', varName: 'x',
        ports: [
          inp('value',  '= value', a),   // the expression bound to x
          out('param',  'x →',     a),   // emits Var(varName), same pattern as lambda param
          inp('body',   'in →',    b),   // body expression that uses x
          out('result', 'result',  b),   // (λx.body) value
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

// ─── Function / module-call nodes ─────────────────────────────────────────

const moduleNodes: NodeDefinition[] = [
  {
    kind: 'call', label: 'Call Function', category: 'modules',
    description: 'Call a named Function by selecting it from the dropdown. Ports update to match the selected function\'s signature.',
    makeData: () => ({ kind: 'call', targetName: '', ports: [] }),
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
  ...tupleNodes,
  ...stringNodes,
  ...listCompNodes,
  ...controlNodes,
  ...ioNodes,
  ...moduleNodes,
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
  io:             'Output',
  arithmetic:     'Arithmetic',
  comparison:     'Comparison',
  control:        'Control',
  logic:          'Logic',
  lists:          'Lists',
  'higher-order': 'Higher-Order',
  utilities:      'Utilities',
  tuples:         'Tuples',
  strings:        'Strings',
  modules:        'Functions',
};

// Explicit display order for the palette
export const CATEGORY_ORDER: PaletteCategory[] = [
  'values',
  'io',
  'arithmetic',
  'comparison',
  'control',
  'logic',
  'lists',
  'higher-order',
  'utilities',
  'tuples',
  'strings',
  'modules',
];
