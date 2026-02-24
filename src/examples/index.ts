// ─── Built-in example programs ────────────────────────────────────────────
// Each example is a SavedGraph that can be loaded via the toolbar menu.
// Node positions are laid out so the graph reads left-to-right.

import type { SavedGraph } from '../utils/serialise';

// ─── Helper to make nodes/edges with stable IDs ───────────────────────────

type RawNode = SavedGraph['nodes'][0];
type RawEdge = SavedGraph['edges'][0];

function n(id: string, type: string, x: number, y: number, data: Record<string, unknown>): RawNode {
  return { id, type, position: { x, y }, data } as RawNode;
}

function e(id: string, src: string, srcPort: string, tgt: string, tgtPort: string): RawEdge {
  return {
    id,
    source: src, sourceHandle: `${src}__${srcPort}`,
    target: tgt, targetHandle: `${tgt}__${tgtPort}`,
    type: 'lib',
  } as RawEdge;
}

// Shared unknown type sentinel
const U = { tag: 'Unknown' as const };
const TI = { tag: 'Int' as const };
const TB = { tag: 'Bool' as const };
const TLI = { tag: 'List' as const, elem: TI };
const TFun = (from: unknown, to: unknown) => ({ tag: 'Fun' as const, from, to });

function port(id: string, label: string, dir: 'input' | 'output', type = U) {
  return { id, label, direction: dir, type, connected: false };
}

// ─── Example 1: Simple arithmetic (3 + 4) ────────────────────────────────

const ex_arithmetic: SavedGraph = {
  version: 1,
  name: 'Simple arithmetic: 3 + 4',
  savedAt: '',
  nodes: [
    n('v1', 'value', 100, 150, { kind: 'value', valueType: 'Int', literal: '3',
      ports: [port('result', 'value', 'output', TI)] }),
    n('v2', 'value', 100, 250, { kind: 'value', valueType: 'Int', literal: '4',
      ports: [port('result', 'value', 'output', TI)] }),
    n('add', 'primop', 320, 200, { kind: 'primop', op: '+',
      ports: [port('arg0', 'x', 'input', TI), port('arg1', 'y', 'input', TI), port('result', 'result', 'output', TI)] }),
    n('out', 'output', 540, 200, { kind: 'output', label: '3 + 4',  lastValue: null,
      ports: [port('value', 'value', 'input', TI)] }),
  ],
  edges: [
    e('e1', 'v1', 'result', 'add', 'arg0'),
    e('e2', 'v2', 'result', 'add', 'arg1'),
    e('e3', 'add', 'result', 'out', 'value'),
  ],
};

// ─── Example 2: sum [1..10] ───────────────────────────────────────────────

const ex_sumRange: SavedGraph = {
  version: 1,
  name: 'sum [1..10]',
  savedAt: '',
  nodes: [
    n('n', 'value', 80, 200, { kind: 'value', valueType: 'Int', literal: '10',
      ports: [port('result', 'value', 'output', TI)] }),
    n('rng', 'listop', 280, 200, { kind: 'listop', op: 'range',
      ports: [port('n', 'n', 'input', TI), port('result', 'result', 'output', TLI)] }),
    n('sm', 'listop', 480, 200, { kind: 'listop', op: 'sum',
      ports: [port('list', 'xs', 'input', TLI), port('result', 'result', 'output', TI)] }),
    n('out', 'output', 680, 200, { kind: 'output', label: 'sum [1..10]', lastValue: null,
      ports: [port('value', 'value', 'input', TI)] }),
  ],
  edges: [
    e('e1', 'n',   'result', 'rng', 'n'),
    e('e2', 'rng', 'result', 'sm',  'list'),
    e('e3', 'sm',  'result', 'out', 'value'),
  ],
};

// ─── Example 3: map (*2) [1..5] ──────────────────────────────────────────
// (*2) = partial application: multiply node with arg0=2 connected, arg1 free.
// buildPartialExpr('*', [Lit(2), null]) → Lam("__p1", App(App(*,2),Var("__p1")))
// = \y -> 2 * y

const ex_mapDouble: SavedGraph = {
  version: 1,
  name: 'map (*2) [1..5]',
  savedAt: '',
  nodes: [
    n('n', 'value', 80, 300, { kind: 'value', valueType: 'Int', literal: '5',
      ports: [port('result', 'value', 'output', TI)] }),
    n('rng', 'listop', 260, 300, { kind: 'listop', op: 'range',
      ports: [port('n', 'n', 'input', TI), port('result', 'result', 'output', TLI)] }),
    n('two', 'value', 80, 150, { kind: 'value', valueType: 'Int', literal: '2',
      ports: [port('result', 'value', 'output', TI)] }),
    // mul with arg0=2 connected, arg1 unconnected → partial fn \y -> 2*y
    n('mul', 'primop', 260, 150, { kind: 'primop', op: '*',
      ports: [port('arg0', 'x', 'input', TI), port('arg1', 'y', 'input', TI), port('result', 'result', 'output', TI)] }),
    n('mp',  'hof', 480, 230, { kind: 'hof', op: 'map',
      ports: [port('fn', 'f', 'input', TFun(TI, TI)), port('list', 'xs', 'input', TLI), port('result', 'result', 'output', TLI)] }),
    n('out', 'output', 700, 230, { kind: 'output', label: 'doubled list', lastValue: null,
      ports: [port('value', 'value', 'input', TLI)] }),
  ],
  edges: [
    e('e1', 'n',   'result', 'rng', 'n'),
    e('e2', 'two', 'result', 'mul', 'arg0'),
    // mul with only arg0=2 connected → partial fn \y -> 2*y  (Int → Int)
    e('e3', 'mul', 'result', 'mp',  'fn'),
    e('e4', 'rng', 'result', 'mp',  'list'),
    e('e5', 'mp',  'result', 'out', 'value'),
  ],
};

// ─── Example 4: filter even [1..10] ──────────────────────────────────────
// even x = x `mod` 2 == 0
// We model this with a lambda node:  λx → (x `mod` 2) == 0
// The lambda's param wire feeds into mod.arg0 and eq's result is wired back.

const ex_filterEven: SavedGraph = {
  version: 1,
  name: 'filter even [1..10]',
  savedAt: '',
  nodes: [
    n('n',    'value',   80, 400, { kind: 'value', valueType: 'Int', literal: '10',
      ports: [port('result', 'value', 'output', TI)] }),
    n('rng',  'listop', 260, 400, { kind: 'listop', op: 'range',
      ports: [port('n', 'n', 'input', TI), port('result', 'result', 'output', TLI)] }),

    // even = \x -> (x `mod` 2) == 0
    // Lambda node provides the free variable x
    n('lam',  'lambda', 80, 200, { kind: 'lambda', paramName: 'x', paramType: TI,
      ports: [
        port('param', 'x →', 'output', TI),
        port('body',  '→ result', 'input', TB),
        port('result','result', 'output', TFun(TI, TB)),
      ] }),
    n('two',  'value',  80,  80, { kind: 'value', valueType: 'Int', literal: '2',
      ports: [port('result', 'value', 'output', TI)] }),
    n('zero', 'value',  80, 300, { kind: 'value', valueType: 'Int', literal: '0',
      ports: [port('result', 'value', 'output', TI)] }),
    // mod x 2  — both inputs connected
    n('md',   'primop', 300, 130, { kind: 'primop', op: 'mod',
      ports: [port('arg0', 'x', 'input', TI), port('arg1', 'y', 'input', TI), port('result', 'result', 'output', TI)] }),
    // (mod x 2) == 0  — both inputs connected
    n('eq',   'primop', 500, 200, { kind: 'primop', op: '==',
      ports: [port('arg0', 'x', 'input', TI), port('arg1', 'y', 'input', TI), port('result', 'result', 'output', TB)] }),

    n('flt',  'hof',   720, 310, { kind: 'hof', op: 'filter',
      ports: [port('fn', 'p', 'input', TFun(TI, TB)), port('list', 'xs', 'input', TLI), port('result', 'result', 'output', TLI)] }),
    n('out',  'output', 940, 310, { kind: 'output', label: 'even numbers', lastValue: null,
      ports: [port('value', 'value', 'input', TLI)] }),
  ],
  edges: [
    e('e1', 'n',    'result', 'rng',  'n'),
    // lambda param (x) → mod.arg0
    e('e2', 'lam',  'param',  'md',   'arg0'),
    // two → mod.arg1
    e('e3', 'two',  'result', 'md',   'arg1'),
    // mod result → eq.arg0
    e('e4', 'md',   'result', 'eq',   'arg0'),
    // zero → eq.arg1
    e('e5', 'zero', 'result', 'eq',   'arg1'),
    // eq result → lambda body
    e('e6', 'eq',   'result', 'lam',  'body'),
    // lambda result (Int → Bool) → filter predicate
    e('e7', 'lam',  'result', 'flt',  'fn'),
    e('e8', 'rng',  'result', 'flt',  'list'),
    e('e9', 'flt',  'result', 'out',  'value'),
  ],
};

// ─── Example 5: foldr to sum (shows HOF composition) ─────────────────────

const ex_foldrSum: SavedGraph = {
  version: 1,
  name: 'foldr (+) 0 [1..10]',
  savedAt: '',
  nodes: [
    n('n',    'value',   80, 300, { kind: 'value', valueType: 'Int', literal: '10',
      ports: [port('result', 'value', 'output', TI)] }),
    n('rng',  'listop', 260, 300, { kind: 'listop', op: 'range',
      ports: [port('n', 'n', 'input', TI), port('result', 'result', 'output', TLI)] }),
    n('zero', 'value',   80, 180, { kind: 'value', valueType: 'Int', literal: '0',
      ports: [port('result', 'value', 'output', TI)] }),
    // bare (+) node with no inputs → pure function Int→Int→Int
    n('add',  'primop',  80, 80, { kind: 'primop', op: '+',
      ports: [port('arg0', 'x', 'input', TI), port('arg1', 'y', 'input', TI), port('result', 'result', 'output', TI)] }),
    n('fr',   'hof',    480, 210, { kind: 'hof', op: 'foldr',
      ports: [
        port('fn',   'f',  'input', TFun(TI, TFun(TI, TI))),
        port('init', 'z',  'input', TI),
        port('list', 'xs', 'input', TLI),
        port('result', 'result', 'output', TI),
      ] }),
    n('out',  'output', 700, 210, { kind: 'output', label: 'sum via foldr', lastValue: null,
      ports: [port('value', 'value', 'input', TI)] }),
  ],
  edges: [
    e('e1', 'n',    'result', 'rng', 'n'),
    e('e2', 'add',  'result', 'fr',  'fn'),    // bare (+) → Int→Int→Int
    e('e3', 'zero', 'result', 'fr',  'init'),
    e('e4', 'rng',  'result', 'fr',  'list'),
    e('e5', 'fr',   'result', 'out', 'value'),
  ],
};

// ─── Example 6: Project Euler #1 — multiples of 3 or 5 below 1000 ─────────
// sum (filter (\x -> x `mod` 3 == 0 || x `mod` 5 == 0) [1..999])
// Answer: 233168
//
// Two lambda nodes build the predicates:
//   lam3:  \x -> x `mod` 3 == 0
//   lam5:  \x -> x `mod` 5 == 0
// Then an OR node combines the results, wrapped in lam_or: \x -> pred3 x || pred5 x
// Finally: filter lam_or [1..999] → sum → output

const ex_euler1: SavedGraph = {
  version: 1,
  name: 'Project Euler #1 — multiples of 3 or 5',
  savedAt: '',
  nodes: [
    // range 999
    n('n999',  'value',   40, 500, { kind: 'value', valueType: 'Int', literal: '999',
      ports: [port('result', 'value', 'output', TI)] }),
    n('rng',   'listop', 220, 500, { kind: 'listop', op: 'range',
      ports: [port('n', 'n', 'input', TI), port('result', 'result', 'output', TLI)] }),

    // ── Predicate: divisible by 3 ──────────────────────────────────────────
    // lam3: \x -> x `mod` 3 == 0
    n('lam3',  'lambda', 40,  80, { kind: 'lambda', paramName: 'x', paramType: TI,
      ports: [
        port('param', 'x →', 'output', TI),
        port('body',  '→ result', 'input', TB),
        port('result','result', 'output', TFun(TI, TB)),
      ] }),
    n('t3',    'value',   40, 200, { kind: 'value', valueType: 'Int', literal: '3',
      ports: [port('result', 'value', 'output', TI)] }),
    n('mod3',  'primop', 220, 130, { kind: 'primop', op: 'mod',
      ports: [port('arg0', 'x', 'input', TI), port('arg1', 'y', 'input', TI), port('result', 'result', 'output', TI)] }),
    n('z1',    'value',   40, 280, { kind: 'value', valueType: 'Int', literal: '0',
      ports: [port('result', 'value', 'output', TI)] }),
    n('eq3',   'primop', 400, 160, { kind: 'primop', op: '==',
      ports: [port('arg0', 'x', 'input', TI), port('arg1', 'y', 'input', TI), port('result', 'result', 'output', TB)] }),

    // ── Predicate: divisible by 5 ──────────────────────────────────────────
    // lam5: \x -> x `mod` 5 == 0
    n('lam5',  'lambda', 40, 340, { kind: 'lambda', paramName: 'x', paramType: TI,
      ports: [
        port('param', 'x →', 'output', TI),
        port('body',  '→ result', 'input', TB),
        port('result','result', 'output', TFun(TI, TB)),
      ] }),
    n('t5',    'value',   40, 460, { kind: 'value', valueType: 'Int', literal: '5',
      ports: [port('result', 'value', 'output', TI)] }),
    n('mod5',  'primop', 220, 390, { kind: 'primop', op: 'mod',
      ports: [port('arg0', 'x', 'input', TI), port('arg1', 'y', 'input', TI), port('result', 'result', 'output', TI)] }),
    n('z2',    'value',   40, 560, { kind: 'value', valueType: 'Int', literal: '0',
      ports: [port('result', 'value', 'output', TI)] }),
    n('eq5',   'primop', 400, 420, { kind: 'primop', op: '==',
      ports: [port('arg0', 'x', 'input', TI), port('arg1', 'y', 'input', TI), port('result', 'result', 'output', TB)] }),

    // OR combinator: lam_or: \x -> (lam3 x) || (lam5 x)
    // Uses two Apply nodes to apply each predicate to x, then ORs the results
    n('lamOr', 'lambda', 600, 320, { kind: 'lambda', paramName: 'x', paramType: TI,
      ports: [
        port('param', 'x →', 'output', TI),
        port('body',  '→ result', 'input', TB),
        port('result','result', 'output', TFun(TI, TB)),
      ] }),
    n('apl3',  'apply', 780, 200, { kind: 'apply',
      ports: [port('fn', 'f', 'input', TFun(TI, TB)), port('arg', 'x', 'input', TI), port('result', 'result', 'output', TB)] }),
    n('apl5',  'apply', 780, 440, { kind: 'apply',
      ports: [port('fn', 'f', 'input', TFun(TI, TB)), port('arg', 'x', 'input', TI), port('result', 'result', 'output', TB)] }),
    n('or1',   'primop', 960, 320, { kind: 'primop', op: '||',
      ports: [port('arg0', 'p', 'input', TB), port('arg1', 'q', 'input', TB), port('result', 'result', 'output', TB)] }),

    // filter then sum
    n('flt',   'hof',   1160, 400, { kind: 'hof', op: 'filter',
      ports: [port('fn', 'p', 'input', TFun(TI, TB)), port('list', 'xs', 'input', TLI), port('result', 'result', 'output', TLI)] }),
    n('sm',    'listop', 1380, 400, { kind: 'listop', op: 'sum',
      ports: [port('list', 'xs', 'input', TLI), port('result', 'result', 'output', TI)] }),
    n('out',   'output', 1580, 400, { kind: 'output', label: 'Euler #1 answer', lastValue: null,
      ports: [port('value', 'value', 'input', TI)] }),
  ],
  edges: [
    e('e1',  'n999',  'result', 'rng',  'n'),

    // lam3: \x -> x `mod` 3 == 0
    e('e2',  'lam3',  'param',  'mod3', 'arg0'),   // x → mod3.arg0
    e('e3',  't3',    'result', 'mod3', 'arg1'),   // 3 → mod3.arg1
    e('e4',  'mod3',  'result', 'eq3',  'arg0'),   // mod3 result → eq3.arg0
    e('e5',  'z1',    'result', 'eq3',  'arg1'),   // 0 → eq3.arg1
    e('e6',  'eq3',   'result', 'lam3', 'body'),   // eq3 result → lam3 body

    // lam5: \x -> x `mod` 5 == 0
    e('e7',  'lam5',  'param',  'mod5', 'arg0'),   // x → mod5.arg0
    e('e8',  't5',    'result', 'mod5', 'arg1'),   // 5 → mod5.arg1
    e('e9',  'mod5',  'result', 'eq5',  'arg0'),   // mod5 result → eq5.arg0
    e('e10', 'z2',    'result', 'eq5',  'arg1'),   // 0 → eq5.arg1
    e('e11', 'eq5',   'result', 'lam5', 'body'),   // eq5 result → lam5 body

    // lamOr: \x -> (lam3 x) || (lam5 x)
    e('e12', 'lamOr', 'param',  'apl3', 'arg'),    // x → apl3.arg
    e('e13', 'lamOr', 'param',  'apl5', 'arg'),    // x → apl5.arg
    e('e14', 'lam3',  'result', 'apl3', 'fn'),     // lam3 → apl3.fn
    e('e15', 'lam5',  'result', 'apl5', 'fn'),     // lam5 → apl5.fn
    e('e16', 'apl3',  'result', 'or1',  'arg0'),   // apl3 result → or.arg0
    e('e17', 'apl5',  'result', 'or1',  'arg1'),   // apl5 result → or.arg1
    e('e18', 'or1',   'result', 'lamOr','body'),   // or result → lamOr body

    // filter [1..999] with combined predicate, then sum
    e('e19', 'lamOr', 'result', 'flt',  'fn'),
    e('e20', 'rng',   'result', 'flt',  'list'),
    e('e21', 'flt',   'result', 'sm',   'list'),
    e('e22', 'sm',    'result', 'out',  'value'),
  ],
};

// ─── Example 7: factorial using a module ──────────────────────────────────
// Demonstrates the Module system.
// The "Factorial" module contains:  product (range n)  ≡  n!
// Outside: n=7 → Factorial module → Output (answer: 5040)
//
// The module has:
//   - one subgraph with: input anchor → range → product → output anchor
//   - one input port  (in_n)
//   - one output port (out_r)
//
// We hardcode the subgraph ID so the SavedGraph includes both outer and inner nodes.

const FACT_SUBGRAPH_ID = 'factorial-subgraph-v1';
const FACT_ANCHOR_IN   = 'fact-anchor-in';
const FACT_ANCHOR_OUT  = 'fact-anchor-out';
const FACT_PORT_IN     = 'in_n';
const FACT_PORT_OUT    = 'out_r';

const ex_factorial: SavedGraph = {
  version: 1,
  name: 'factorial via Function (7! = 5040)',
  savedAt: '',
  nodes: [
    // ── Outer graph ─────────────────────────────────────────────────────
    n('fn7',   'value',  80, 200, { kind: 'value', valueType: 'Int', literal: '7',
      ports: [port('result', 'value', 'output', TI)] }),
    n('fmod',  'module', 280, 200, {
      kind: 'module',
      name: 'Factorial',
      description: 'n! = product [1..n]',
      subgraphId: FACT_SUBGRAPH_ID,
      inputPorts:  [port(FACT_PORT_IN,  'n',      'input',  TI)],
      outputPorts: [port(FACT_PORT_OUT, 'n!',     'output', TI)],
      ports:       [port(FACT_PORT_IN,  'n',      'input',  TI),
                    port(FACT_PORT_OUT, 'n!',     'output', TI)],
    }),
    n('fout',  'output', 500, 200, { kind: 'output', label: '7!', lastValue: null,
      ports: [port('value', 'value', 'input', TI)] }),
  ],
  edges: [
    e('fe1', 'fn7',  'result',      'fmod', FACT_PORT_IN),
    e('fe2', 'fmod', FACT_PORT_OUT, 'fout', 'value'),
  ],
  // ── Subgraphs ────────────────────────────────────────────────────────
  subgraphs: {
    [FACT_SUBGRAPH_ID]: {
      nodes: [
        // Input anchor: placeholder for the n value passed from outside
        n(FACT_ANCHOR_IN,  'value', -60, 150, {
          kind: 'value', valueType: 'Int', literal: '0',
          ports: [port('result', 'n', 'output', TI)],
          _modulePortId: FACT_PORT_IN,
        } as any),
        // range [1..n]
        n('frng', 'listop', 140, 150, { kind: 'listop', op: 'range',
          ports: [port('n', 'n', 'input', TI), port('result', 'result', 'output', TLI)] }),
        // product [1..n]
        n('fprd', 'listop', 340, 150, { kind: 'listop', op: 'product',
          ports: [port('list', 'xs', 'input', TLI), port('result', 'result', 'output', TI)] }),
        // Output anchor
        n(FACT_ANCHOR_OUT, 'output', 540, 150, {
          kind: 'output', label: 'n!', lastValue: null,
          ports: [port('value', 'value', 'input', TI)],
          _modulePortId: FACT_PORT_OUT,
        } as any),
      ],
      edges: [
        e('fi1', FACT_ANCHOR_IN,  'result', 'frng', 'n'),
        e('fi2', 'frng',          'result', 'fprd', 'list'),
        e('fi3', 'fprd',          'result', FACT_ANCHOR_OUT, 'value'),
      ],
    },
  } as any,
};

// ─── Registry ─────────────────────────────────────────────────────────────

export const EXAMPLES: SavedGraph[] = [
  ex_arithmetic,
  ex_sumRange,
  ex_mapDouble,
  ex_filterEven,
  ex_foldrSum,
  ex_euler1,
  ex_factorial,
];
