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

// ─── Example 6b: Project Euler #2 — even Fibonacci numbers below 4,000,000 ─
// Even-valued terms in the Fibonacci sequence whose values do not exceed 4M.
// Strategy: recursive module fibs(a,b) = if b >= 4000000 then []
//                                        else a : fibs b (a+b)
// Outer: fibs 1 2 → filter (\x→x mod 2==0) → sum
// Answer: 4613732

const E2_SUB = 'euler2-fibs-sub-v1';
const E2_ANC_A   = 'e2-anc-a';
const E2_ANC_B   = 'e2-anc-b';
const E2_ANC_OUT = 'e2-anc-out';
const E2_PORT_A   = 'in_a';
const E2_PORT_B   = 'in_b';
const E2_PORT_OUT = 'out_list';
const TLI2 = { tag: 'List' as const, elem: TI };

const ex_euler2: SavedGraph = {
  version: 1,
  name: 'Project Euler #2 — even Fibonacci sum',
  savedAt: '',
  nodes: [
    // Outer: fibs 1 2 → filter even → sum
    n('e2_one',  'value',   60, 160, { kind: 'value', valueType: 'Int', literal: '1',
      ports: [port('result', 'value', 'output', TI)] }),
    n('e2_two',  'value',   60, 260, { kind: 'value', valueType: 'Int', literal: '2',
      ports: [port('result', 'value', 'output', TI)] }),
    n('e2_mod',  'module',  260, 200, {
      kind: 'module', name: 'fibs', description: 'Fibonacci list up to limit',
      subgraphId: E2_SUB,
      inputPorts:  [port(E2_PORT_A, 'a', 'input', TI), port(E2_PORT_B, 'b', 'input', TI)],
      outputPorts: [port(E2_PORT_OUT, 'list', 'output', TLI2)],
      ports:       [port(E2_PORT_A, 'a', 'input', TI), port(E2_PORT_B, 'b', 'input', TI),
                    port(E2_PORT_OUT, 'list', 'output', TLI2)],
    }),
    // filter: \x -> x mod 2 == 0
    n('e2_lam',  'lambda',  480, 80, { kind: 'lambda', paramName: 'x',
      ports: [port('param', 'x →', 'output', TI),
              port('body',  '→ result', 'input', TB),
              port('result','λ', 'output', TFun(TI, TB))] }),
    n('e2_m2',   'value',   480, 180, { kind: 'value', valueType: 'Int', literal: '2',
      ports: [port('result', 'value', 'output', TI)] }),
    n('e2_mod2', 'primop',  640, 80, { kind: 'primop', op: 'mod',
      ports: [port('arg0','x','input',TI), port('arg1','y','input',TI), port('result','result','output',TI)] }),
    n('e2_z',    'value',   640, 180, { kind: 'value', valueType: 'Int', literal: '0',
      ports: [port('result', 'value', 'output', TI)] }),
    n('e2_eq',   'primop',  800, 120, { kind: 'primop', op: '==',
      ports: [port('arg0','x','input',TI), port('arg1','y','input',TI), port('result','result','output',TB)] }),
    n('e2_flt',  'hof',     980, 200, { kind: 'hof', op: 'filter',
      ports: [port('fn','p','input',TFun(TI,TB)), port('list','xs','input',TLI2), port('result','result','output',TLI2)] }),
    n('e2_sum',  'listop', 1160, 200, { kind: 'listop', op: 'sum',
      ports: [port('list','xs','input',TLI2), port('result','result','output',TI)] }),
    n('e2_out',  'output', 1340, 200, { kind: 'output', label: 'Euler #2 answer', lastValue: null,
      ports: [port('value', 'value', 'input', TI)] }),
  ],
  edges: [
    e('e2e1', 'e2_one',  'result',     'e2_mod',  E2_PORT_A),
    e('e2e2', 'e2_two',  'result',     'e2_mod',  E2_PORT_B),
    e('e2e3', 'e2_mod',  E2_PORT_OUT,  'e2_flt',  'list'),
    // λx → x mod 2 == 0
    e('e2e4', 'e2_lam',  'param',      'e2_mod2', 'arg0'),
    e('e2e5', 'e2_m2',   'result',     'e2_mod2', 'arg1'),
    e('e2e6', 'e2_mod2', 'result',     'e2_eq',   'arg0'),
    e('e2e7', 'e2_z',    'result',     'e2_eq',   'arg1'),
    e('e2e8', 'e2_eq',   'result',     'e2_lam',  'body'),
    e('e2e9', 'e2_lam',  'result',     'e2_flt',  'fn'),
    e('e2ea', 'e2_flt',  'result',     'e2_sum',  'list'),
    e('e2eb', 'e2_sum',  'result',     'e2_out',  'value'),
  ],
  subgraphs: {
    [E2_SUB]: {
      nodes: [
        // Input anchors
        n(E2_ANC_A, 'value', -80, 140, {
          kind: 'value', valueType: 'Int', literal: '0',
          ports: [port('result', 'a', 'output', TI)],
          _modulePortId: E2_PORT_A,
        } as any),
        n(E2_ANC_B, 'value', -80, 280, {
          kind: 'value', valueType: 'Int', literal: '0',
          ports: [port('result', 'b', 'output', TI)],
          _modulePortId: E2_PORT_B,
        } as any),
        // limit: 4000000
        n('e2i_lim',  'value',   80, 400, { kind: 'value', valueType: 'Int', literal: '4000000',
          ports: [port('result', 'value', 'output', TI)] }),
        // b >= 4000000
        n('e2i_ge',   'primop',  260, 340, { kind: 'primop', op: '>=',
          ports: [port('arg0','x','input',TI), port('arg1','y','input',TI), port('result','result','output',TB)] }),
        // a + b
        n('e2i_add',  'primop',  260, 180, { kind: 'primop', op: '+',
          ports: [port('arg0','x','input',TI), port('arg1','y','input',TI), port('result','result','output',TI)] }),
        // recursive call: fibs b (a+b)
        n('e2i_call', 'call',    460, 260, {
          kind: 'call', targetName: 'fibs',
          ports: [port(E2_PORT_A, 'a', 'input', TI),
                  port(E2_PORT_B, 'b', 'input', TI),
                  port(E2_PORT_OUT, 'list', 'output', TLI2)],
        }),
        // cons a (fibs b (a+b))
        n('e2i_cons', 'listop',  680, 200, { kind: 'listop', op: 'cons',
          ports: [port('elem','x','input',TI), port('list','xs','input',TLI2), port('result','result','output',TLI2)] }),
        // empty list for base case
        n('e2i_nil',  'value',   460, 440, { kind: 'value', valueType: 'List', literal: '[]',
          ports: [port('result', 'value', 'output', TLI2)] }),
        // if b>=limit then [] else a:fibs b (a+b)
        n('e2i_if',   'if',      860, 280, { kind: 'if',
          ports: [port('cond','if','input',TB), port('then','then','input',TLI2),
                  port('else','else','input',TLI2), port('result','result','output',TLI2)] }),
        // output anchor
        n(E2_ANC_OUT, 'output', 1060, 280, {
          kind: 'output', label: 'list', lastValue: null,
          ports: [port('value', 'value', 'input', TLI2)],
          _modulePortId: E2_PORT_OUT,
        } as any),
      ],
      edges: [
        // b >= 4000000
        e('e2i1', E2_ANC_A,    'result',    'e2i_ge',   'arg0'),
        e('e2i2', 'e2i_lim',   'result',    'e2i_ge',   'arg1'),
        // a + b
        e('e2i3', E2_ANC_A,    'result',    'e2i_add',  'arg0'),
        e('e2i4', E2_ANC_B,    'result',    'e2i_add',  'arg1'),
        // fibs b (a+b)
        e('e2i5', E2_ANC_B,    'result',    'e2i_call', E2_PORT_A),
        e('e2i6', 'e2i_add',   'result',    'e2i_call', E2_PORT_B),
        // a : fibs b (a+b)
        e('e2i7', E2_ANC_A,    'result',    'e2i_cons', 'elem'),
        e('e2i8', 'e2i_call',  E2_PORT_OUT, 'e2i_cons', 'list'),
        // if
        e('e2i9', 'e2i_ge',    'result',    'e2i_if',   'cond'),
        e('e2ia', 'e2i_nil',   'result',    'e2i_if',   'then'),
        e('e2ib', 'e2i_cons',  'result',    'e2i_if',   'else'),
        // output
        e('e2ic', 'e2i_if',    'result',    E2_ANC_OUT, 'value'),
      ],
    },
  } as any,
};

// ─── Example 6c: Project Euler #3 — largest prime factor of 600851475143 ──
// Recursive trial division:
//   lpf n d = if d*d > n  then n          -- n itself is prime
//             else if n mod d == 0 then lpf (n div d) d  -- d divides n
//             else lpf n (d+1)             -- try next divisor
// Start: lpf 600851475143 2
// Answer: 6857

const E3_SUB     = 'euler3-lpf-sub-v1';
const E3_ANC_N   = 'e3-anc-n';
const E3_ANC_D   = 'e3-anc-d';
const E3_ANC_OUT = 'e3-anc-out';
const E3_PORT_N   = 'in_n';
const E3_PORT_D   = 'in_d';
const E3_PORT_OUT = 'out_lpf';

const ex_euler3: SavedGraph = {
  version: 1,
  name: 'Project Euler #3 — largest prime factor',
  savedAt: '',
  nodes: [
    n('e3_n',   'value',  60, 160, { kind: 'value', valueType: 'Int', literal: '600851475143',
      ports: [port('result', 'value', 'output', TI)] }),
    n('e3_d',   'value',  60, 260, { kind: 'value', valueType: 'Int', literal: '2',
      ports: [port('result', 'value', 'output', TI)] }),
    n('e3_mod', 'module', 280, 200, {
      kind: 'module', name: 'lpf', description: 'Largest prime factor',
      subgraphId: E3_SUB,
      inputPorts:  [port(E3_PORT_N, 'n', 'input', TI), port(E3_PORT_D, 'd', 'input', TI)],
      outputPorts: [port(E3_PORT_OUT, 'result', 'output', TI)],
      ports:       [port(E3_PORT_N, 'n', 'input', TI), port(E3_PORT_D, 'd', 'input', TI),
                    port(E3_PORT_OUT, 'result', 'output', TI)],
    }),
    n('e3_out', 'output', 500, 200, { kind: 'output', label: 'Euler #3 answer', lastValue: null,
      ports: [port('value', 'value', 'input', TI)] }),
  ],
  edges: [
    e('e3e1', 'e3_n',   'result',     'e3_mod', E3_PORT_N),
    e('e3e2', 'e3_d',   'result',     'e3_mod', E3_PORT_D),
    e('e3e3', 'e3_mod', E3_PORT_OUT,  'e3_out', 'value'),
  ],
  subgraphs: {
    [E3_SUB]: {
      nodes: [
        // Input anchors: n and d
        n(E3_ANC_N, 'value', -80, 160, {
          kind: 'value', valueType: 'Int', literal: '0',
          ports: [port('result', 'n', 'output', TI)],
          _modulePortId: E3_PORT_N,
        } as any),
        n(E3_ANC_D, 'value', -80, 320, {
          kind: 'value', valueType: 'Int', literal: '0',
          ports: [port('result', 'd', 'output', TI)],
          _modulePortId: E3_PORT_D,
        } as any),
        // d * d
        n('e3i_dd',   'primop',  120, 320, { kind: 'primop', op: '*',
          ports: [port('arg0','x','input',TI), port('arg1','y','input',TI), port('result','result','output',TI)] }),
        // d*d > n
        n('e3i_gt',   'primop',  300, 220, { kind: 'primop', op: '>',
          ports: [port('arg0','x','input',TI), port('arg1','y','input',TI), port('result','result','output',TB)] }),
        // n mod d
        n('e3i_modn', 'primop',  120, 480, { kind: 'primop', op: 'mod',
          ports: [port('arg0','x','input',TI), port('arg1','y','input',TI), port('result','result','output',TI)] }),
        n('e3i_z',    'value',   120, 580, { kind: 'value', valueType: 'Int', literal: '0',
          ports: [port('result', 'value', 'output', TI)] }),
        // n mod d == 0
        n('e3i_eq',   'primop',  300, 520, { kind: 'primop', op: '==',
          ports: [port('arg0','x','input',TI), port('arg1','y','input',TI), port('result','result','output',TB)] }),
        // n div d
        n('e3i_divn', 'primop',  300, 640, { kind: 'primop', op: 'div',
          ports: [port('arg0','x','input',TI), port('arg1','y','input',TI), port('result','result','output',TI)] }),
        // d + 1
        n('e3i_d1',   'primop',  120, 700, { kind: 'primop', op: '+',
          ports: [port('arg0','x','input',TI), port('arg1','y','input',TI), port('result','result','output',TI)] }),
        n('e3i_one',  'value',   120, 780, { kind: 'value', valueType: 'Int', literal: '1',
          ports: [port('result', 'value', 'output', TI)] }),
        // recursive calls
        n('e3i_rec1', 'call',    500, 580, {
          kind: 'call', targetName: 'lpf',
          ports: [port(E3_PORT_N, 'n', 'input', TI), port(E3_PORT_D, 'd', 'input', TI),
                  port(E3_PORT_OUT, 'result', 'output', TI)],
        }),
        n('e3i_rec2', 'call',    500, 720, {
          kind: 'call', targetName: 'lpf',
          ports: [port(E3_PORT_N, 'n', 'input', TI), port(E3_PORT_D, 'd', 'input', TI),
                  port(E3_PORT_OUT, 'result', 'output', TI)],
        }),
        // inner if: n mod d==0 → lpf (n div d) d  else lpf n (d+1)
        n('e3i_if2',  'if',      720, 640, { kind: 'if',
          ports: [port('cond','if','input',TB), port('then','then','input',TI),
                  port('else','else','input',TI), port('result','result','output',TI)] }),
        // outer if: d*d > n → n  else inner-if
        n('e3i_if1',  'if',      940, 300, { kind: 'if',
          ports: [port('cond','if','input',TB), port('then','then','input',TI),
                  port('else','else','input',TI), port('result','result','output',TI)] }),
        // output anchor
        n(E3_ANC_OUT, 'output', 1160, 300, {
          kind: 'output', label: 'result', lastValue: null,
          ports: [port('value', 'value', 'input', TI)],
          _modulePortId: E3_PORT_OUT,
        } as any),
      ],
      edges: [
        // d * d
        e('e3i1',  E3_ANC_D,    'result',    'e3i_dd',   'arg0'),
        e('e3i2',  E3_ANC_D,    'result',    'e3i_dd',   'arg1'),
        // d*d > n
        e('e3i3',  'e3i_dd',    'result',    'e3i_gt',   'arg0'),
        e('e3i4',  E3_ANC_N,    'result',    'e3i_gt',   'arg1'),
        // n mod d
        e('e3i5',  E3_ANC_N,    'result',    'e3i_modn', 'arg0'),
        e('e3i6',  E3_ANC_D,    'result',    'e3i_modn', 'arg1'),
        // n mod d == 0
        e('e3i7',  'e3i_modn',  'result',    'e3i_eq',   'arg0'),
        e('e3i8',  'e3i_z',     'result',    'e3i_eq',   'arg1'),
        // n div d
        e('e3i9',  E3_ANC_N,    'result',    'e3i_divn', 'arg0'),
        e('e3ia',  E3_ANC_D,    'result',    'e3i_divn', 'arg1'),
        // d + 1
        e('e3ib',  E3_ANC_D,    'result',    'e3i_d1',   'arg0'),
        e('e3ic',  'e3i_one',   'result',    'e3i_d1',   'arg1'),
        // lpf (n div d) d
        e('e3id',  'e3i_divn',  'result',    'e3i_rec1', E3_PORT_N),
        e('e3ie',  E3_ANC_D,    'result',    'e3i_rec1', E3_PORT_D),
        // lpf n (d+1)
        e('e3if',  E3_ANC_N,    'result',    'e3i_rec2', E3_PORT_N),
        e('e3ig',  'e3i_d1',    'result',    'e3i_rec2', E3_PORT_D),
        // inner if: n mod d == 0
        e('e3ih',  'e3i_eq',    'result',    'e3i_if2',  'cond'),
        e('e3ii',  'e3i_rec1',  E3_PORT_OUT, 'e3i_if2',  'then'),
        e('e3ij',  'e3i_rec2',  E3_PORT_OUT, 'e3i_if2',  'else'),
        // outer if: d*d > n
        e('e3ik',  'e3i_gt',    'result',    'e3i_if1',  'cond'),
        e('e3il',  E3_ANC_N,    'result',    'e3i_if1',  'then'),
        e('e3im',  'e3i_if2',   'result',    'e3i_if1',  'else'),
        // output
        e('e3in',  'e3i_if1',   'result',    E3_ANC_OUT, 'value'),
      ],
    },
  } as any,
};

// ─── Example 6d: Project Euler #5 — smallest multiple of 1 to 20 ──────────
// Smallest positive number evenly divisible by all of 1..20.
// = lcm 1 2 3 … 20   where lcm a b = (a*b) `div` gcd a b
// Two recursive modules: gcd and lcm_pair; outer: foldr lcm_pair 1 [1..20]
// Answer: 232792560

const E5_GCD_SUB  = 'euler5-gcd-sub-v1';
const E5_LCM_SUB  = 'euler5-lcm-sub-v1';
const E5_GCD_ANC_A   = 'e5g-anc-a';
const E5_GCD_ANC_B   = 'e5g-anc-b';
const E5_GCD_ANC_OUT = 'e5g-anc-out';
const E5_GCD_PORT_A   = 'in_a';
const E5_GCD_PORT_B   = 'in_b';
const E5_GCD_PORT_OUT = 'out_g';
const E5_LCM_ANC_A   = 'e5l-anc-a';
const E5_LCM_ANC_B   = 'e5l-anc-b';
const E5_LCM_ANC_OUT = 'e5l-anc-out';
const E5_LCM_PORT_A   = 'in_a';
const E5_LCM_PORT_B   = 'in_b';
const E5_LCM_PORT_OUT = 'out_l';

const ex_euler5: SavedGraph = {
  version: 1,
  name: 'Project Euler #5 — smallest multiple of 1–20',
  savedAt: '',
  nodes: [
    // range 20 → [1..20]
    n('e5_n20',  'value',   60, 200, { kind: 'value', valueType: 'Int', literal: '20',
      ports: [port('result', 'value', 'output', TI)] }),
    n('e5_rng',  'listop',  240, 200, { kind: 'listop', op: 'range',
      ports: [port('n','n','input',TI), port('result','result','output',TLI)] }),
    // lcm_pair module node (used as fn for foldr)
    n('e5_lmod', 'module',  440, 120, {
      kind: 'module', name: 'lcmPair', description: 'LCM of two numbers',
      subgraphId: E5_LCM_SUB,
      inputPorts:  [port(E5_LCM_PORT_A, 'a', 'input', TI), port(E5_LCM_PORT_B, 'b', 'input', TI)],
      outputPorts: [port(E5_LCM_PORT_OUT, 'lcm', 'output', TI)],
      ports:       [port(E5_LCM_PORT_A, 'a', 'input', TI), port(E5_LCM_PORT_B, 'b', 'input', TI),
                    port(E5_LCM_PORT_OUT, 'lcm', 'output', TI)],
    }),
    // gcd module node (lives on canvas so lcmPair's subgraph can call it)
    n('e5_gmod', 'module',  440, 320, {
      kind: 'module', name: 'myGcd', description: 'GCD via Euclidean algorithm',
      subgraphId: E5_GCD_SUB,
      inputPorts:  [port(E5_GCD_PORT_A, 'a', 'input', TI), port(E5_GCD_PORT_B, 'b', 'input', TI)],
      outputPorts: [port(E5_GCD_PORT_OUT, 'gcd', 'output', TI)],
      ports:       [port(E5_GCD_PORT_A, 'a', 'input', TI), port(E5_GCD_PORT_B, 'b', 'input', TI),
                    port(E5_GCD_PORT_OUT, 'gcd', 'output', TI)],
    }),
    // init value 1 for foldr
    n('e5_one',  'value',   640, 320, { kind: 'value', valueType: 'Int', literal: '1',
      ports: [port('result', 'value', 'output', TI)] }),
    // foldr lcmPair 1 [1..20]
    n('e5_fr',   'hof',     820, 200, { kind: 'hof', op: 'foldr',
      ports: [port('fn','f','input',TFun(TI,TFun(TI,TI))), port('init','z','input',TI),
              port('list','xs','input',TLI), port('result','result','output',TI)] }),
    n('e5_out',  'output', 1060, 200, { kind: 'output', label: 'Euler #5 answer', lastValue: null,
      ports: [port('value', 'value', 'input', TI)] }),
  ],
  edges: [
    e('e5e1', 'e5_n20',  'result',      'e5_rng',  'n'),
    e('e5e2', 'e5_rng',  'result',      'e5_fr',   'list'),
    e('e5e3', 'e5_lmod', E5_LCM_PORT_OUT, 'e5_fr', 'fn'),
    e('e5e4', 'e5_one',  'result',      'e5_fr',   'init'),
    e('e5e5', 'e5_fr',   'result',      'e5_out',  'value'),
  ],
  subgraphs: {
    // ── gcd subgraph: gcd a b = if b==0 then a else gcd b (a mod b) ────────
    [E5_GCD_SUB]: {
      nodes: [
        n(E5_GCD_ANC_A, 'value', -80, 140, {
          kind: 'value', valueType: 'Int', literal: '0',
          ports: [port('result', 'a', 'output', TI)],
          _modulePortId: E5_GCD_PORT_A,
        } as any),
        n(E5_GCD_ANC_B, 'value', -80, 280, {
          kind: 'value', valueType: 'Int', literal: '0',
          ports: [port('result', 'b', 'output', TI)],
          _modulePortId: E5_GCD_PORT_B,
        } as any),
        n('e5g_z',    'value',   100, 360, { kind: 'value', valueType: 'Int', literal: '0',
          ports: [port('result', 'value', 'output', TI)] }),
        // b == 0
        n('e5g_eq',   'primop',  280, 200, { kind: 'primop', op: '==',
          ports: [port('arg0','x','input',TI), port('arg1','y','input',TI), port('result','result','output',TB)] }),
        // a mod b
        n('e5g_mod',  'primop',  280, 360, { kind: 'primop', op: 'mod',
          ports: [port('arg0','x','input',TI), port('arg1','y','input',TI), port('result','result','output',TI)] }),
        // recursive call: gcd b (a mod b)
        n('e5g_rec',  'call',    480, 300, {
          kind: 'call', targetName: 'myGcd',
          ports: [port(E5_GCD_PORT_A, 'a', 'input', TI), port(E5_GCD_PORT_B, 'b', 'input', TI),
                  port(E5_GCD_PORT_OUT, 'gcd', 'output', TI)],
        }),
        // if b==0 then a else gcd b (a mod b)
        n('e5g_if',   'if',      700, 220, { kind: 'if',
          ports: [port('cond','if','input',TB), port('then','then','input',TI),
                  port('else','else','input',TI), port('result','result','output',TI)] }),
        n(E5_GCD_ANC_OUT, 'output', 900, 220, {
          kind: 'output', label: 'gcd', lastValue: null,
          ports: [port('value', 'value', 'input', TI)],
          _modulePortId: E5_GCD_PORT_OUT,
        } as any),
      ],
      edges: [
        e('e5g1', E5_GCD_ANC_B, 'result',        'e5g_eq',  'arg0'),
        e('e5g2', 'e5g_z',      'result',        'e5g_eq',  'arg1'),
        e('e5g3', E5_GCD_ANC_A, 'result',        'e5g_mod', 'arg0'),
        e('e5g4', E5_GCD_ANC_B, 'result',        'e5g_mod', 'arg1'),
        e('e5g5', E5_GCD_ANC_B, 'result',        'e5g_rec', E5_GCD_PORT_A),
        e('e5g6', 'e5g_mod',    'result',        'e5g_rec', E5_GCD_PORT_B),
        e('e5g7', 'e5g_eq',     'result',        'e5g_if',  'cond'),
        e('e5g8', E5_GCD_ANC_A, 'result',        'e5g_if',  'then'),
        e('e5g9', 'e5g_rec',    E5_GCD_PORT_OUT, 'e5g_if',  'else'),
        e('e5ga', 'e5g_if',     'result',        E5_GCD_ANC_OUT, 'value'),
      ],
    },
    // ── lcmPair subgraph: lcmPair a b = (a*b) `div` gcd a b ───────────────
    [E5_LCM_SUB]: {
      nodes: [
        n(E5_LCM_ANC_A, 'value', -80, 140, {
          kind: 'value', valueType: 'Int', literal: '0',
          ports: [port('result', 'a', 'output', TI)],
          _modulePortId: E5_LCM_PORT_A,
        } as any),
        n(E5_LCM_ANC_B, 'value', -80, 280, {
          kind: 'value', valueType: 'Int', literal: '0',
          ports: [port('result', 'b', 'output', TI)],
          _modulePortId: E5_LCM_PORT_B,
        } as any),
        // a * b
        n('e5l_mul',  'primop',  120, 200, { kind: 'primop', op: '*',
          ports: [port('arg0','x','input',TI), port('arg1','y','input',TI), port('result','result','output',TI)] }),
        // call gcd a b
        n('e5l_gcd',  'call',    120, 360, {
          kind: 'call', targetName: 'myGcd',
          ports: [port(E5_GCD_PORT_A, 'a', 'input', TI), port(E5_GCD_PORT_B, 'b', 'input', TI),
                  port(E5_GCD_PORT_OUT, 'gcd', 'output', TI)],
        }),
        // (a*b) div gcd
        n('e5l_div',  'primop',  340, 280, { kind: 'primop', op: 'div',
          ports: [port('arg0','x','input',TI), port('arg1','y','input',TI), port('result','result','output',TI)] }),
        n(E5_LCM_ANC_OUT, 'output', 560, 280, {
          kind: 'output', label: 'lcm', lastValue: null,
          ports: [port('value', 'value', 'input', TI)],
          _modulePortId: E5_LCM_PORT_OUT,
        } as any),
      ],
      edges: [
        e('e5l1', E5_LCM_ANC_A, 'result',        'e5l_mul', 'arg0'),
        e('e5l2', E5_LCM_ANC_B, 'result',        'e5l_mul', 'arg1'),
        e('e5l3', E5_LCM_ANC_A, 'result',        'e5l_gcd', E5_GCD_PORT_A),
        e('e5l4', E5_LCM_ANC_B, 'result',        'e5l_gcd', E5_GCD_PORT_B),
        e('e5l5', 'e5l_mul',    'result',        'e5l_div', 'arg0'),
        e('e5l6', 'e5l_gcd',    E5_GCD_PORT_OUT, 'e5l_div', 'arg1'),
        e('e5l7', 'e5l_div',    'result',        E5_LCM_ANC_OUT, 'value'),
      ],
    },
  } as any,
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

// ─── Example 8: Recursive factorial using Call Function ───────────────────
// Demonstrates true recursion: the Function calls itself via a Call node.
//
// The "factR" Function contains:
//   if (n == 0) then 1 else n * Call(factR)(n - 1)
//
// Subgraph layout:
//   anchor_n → if.cond (via ==0)
//   anchor_n → mul.arg0
//   anchor_n → sub.arg0  (n - 1)
//   literal_0 → if.then (base case = 1)
//   call_self → if.else (recursive case)
//   sub → call_self.n_port
//   mul (n * call_self result) → output anchor
//
// The Letrec wrapper in buildModuleExpr makes the self-call work correctly.

const RFACT_SUBGRAPH_ID = 'rfactorial-subgraph-v1';
const RFACT_ANCHOR_IN   = 'rfact-anchor-in';
const RFACT_ANCHOR_OUT  = 'rfact-anchor-out';
const RFACT_PORT_IN     = 'in_n';
const RFACT_PORT_OUT    = 'out_r';

// The Call node's input port must mirror the Function's input port id
const RFACT_CALL_INPUT  = RFACT_PORT_IN;   // same id as module input port

const ex_recursiveFactorial: SavedGraph = {
  version: 1,
  name: 'Recursive factorial — factR 7 = 5040',
  savedAt: '',
  nodes: [
    // ── Outer graph ─────────────────────────────────────────────────────
    n('rn7',  'value',  80, 200, { kind: 'value', valueType: 'Int', literal: '7',
      ports: [port('result', 'value', 'output', TI)] }),
    n('rfmod', 'module', 290, 200, {
      kind: 'module',
      name: 'factR',
      description: 'Recursive factorial',
      subgraphId: RFACT_SUBGRAPH_ID,
      inputPorts:  [port(RFACT_PORT_IN,  'n',  'input',  TI)],
      outputPorts: [port(RFACT_PORT_OUT, 'n!', 'output', TI)],
      ports:       [port(RFACT_PORT_IN,  'n',  'input',  TI),
                    port(RFACT_PORT_OUT, 'n!', 'output', TI)],
    }),
    n('rfout', 'output', 520, 200, { kind: 'output', label: 'factR 7', lastValue: null,
      ports: [port('value', 'value', 'input', TI)] }),
  ],
  edges: [
    e('rfe1', 'rn7',   'result',       'rfmod', RFACT_PORT_IN),
    e('rfe2', 'rfmod', RFACT_PORT_OUT, 'rfout', 'value'),
  ],
  subgraphs: {
    [RFACT_SUBGRAPH_ID]: {
      nodes: [
        // Input anchor (n)
        n(RFACT_ANCHOR_IN, 'value', -80, 200, {
          kind: 'value', valueType: 'Int', literal: '0',
          ports: [port('result', 'n', 'output', TI)],
          _modulePortId: RFACT_PORT_IN,
        } as any),
        // Literal 0 for base-case comparison and then-branch
        n('rf_zero_cmp', 'value', 80, 80, { kind: 'value', valueType: 'Int', literal: '0',
          ports: [port('result', 'value', 'output', TI)] }),
        n('rf_one',      'value', 80, 360, { kind: 'value', valueType: 'Int', literal: '1',
          ports: [port('result', 'value', 'output', TI)] }),
        n('rf_one_sub',  'value', 80, 500, { kind: 'value', valueType: 'Int', literal: '1',
          ports: [port('result', 'value', 'output', TI)] }),
        // n == 0
        n('rf_eq', 'primop', 260, 80, { kind: 'primop', op: '==',
          ports: [port('arg0', 'x', 'input', TI), port('arg1', 'y', 'input', TI), port('result', 'result', 'output', TB)] }),
        // n - 1
        n('rf_sub', 'primop', 260, 420, { kind: 'primop', op: '-',
          ports: [port('arg0', 'x', 'input', TI), port('arg1', 'y', 'input', TI), port('result', 'result', 'output', TI)] }),
        // Call factR (n-1)
        n('rf_call', 'call', 460, 360, {
          kind: 'call', targetName: 'factR',
          ports: [
            port(RFACT_CALL_INPUT, 'n',  'input',  TI),
            port(RFACT_PORT_OUT,   'n!', 'output', TI),
          ],
        }),
        // n * factR(n-1)
        n('rf_mul', 'primop', 680, 240, { kind: 'primop', op: '*',
          ports: [port('arg0', 'x', 'input', TI), port('arg1', 'y', 'input', TI), port('result', 'result', 'output', TI)] }),
        // if (n==0) then 1 else n * factR(n-1)
        n('rf_if', 'if', 860, 200, { kind: 'if',
          ports: [
            port('cond',   'if',   'input',  TB),
            port('then',   'then', 'input',  TI),
            port('else',   'else', 'input',  TI),
            port('result', 'result', 'output', TI),
          ],
        }),
        // Output anchor
        n(RFACT_ANCHOR_OUT, 'output', 1060, 200, {
          kind: 'output', label: 'n!', lastValue: null,
          ports: [port('value', 'value', 'input', TI)],
          _modulePortId: RFACT_PORT_OUT,
        } as any),
      ],
      edges: [
        // n == 0
        e('rfi1',  RFACT_ANCHOR_IN, 'result', 'rf_eq',   'arg0'),
        e('rfi2',  'rf_zero_cmp',   'result', 'rf_eq',   'arg1'),
        // n - 1
        e('rfi3',  RFACT_ANCHOR_IN, 'result', 'rf_sub',  'arg0'),
        e('rfi4',  'rf_one_sub',    'result', 'rf_sub',  'arg1'),
        // Call factR (n - 1)
        e('rfi5',  'rf_sub',        'result', 'rf_call', RFACT_CALL_INPUT),
        // n * factR(n-1)
        e('rfi6',  RFACT_ANCHOR_IN, 'result', 'rf_mul',  'arg0'),
        e('rfi7',  'rf_call',       RFACT_PORT_OUT, 'rf_mul', 'arg1'),
        // if (n==0) then 1 else n*factR(n-1)
        e('rfi8',  'rf_eq',         'result', 'rf_if',   'cond'),
        e('rfi9',  'rf_one',        'result', 'rf_if',   'then'),
        e('rfi10', 'rf_mul',        'result', 'rf_if',   'else'),
        // output
        e('rfi11', 'rf_if',         'result', RFACT_ANCHOR_OUT, 'value'),
      ],
    },
  } as any,
};

// ─── Example 9: Let binding ───────────────────────────────────────────────
// let sq = (*x) in sq + sq   where x is connected externally
// Simpler readable demo: let double = x*2 in double + 1
//
// Layout:
//   Value(3) → Let(x).value
//   Let(x).param → Multiply.arg0
//   Value(2) → Multiply.arg1
//   Multiply.result → Let(x).body
//   Let(x).result → Add.arg0
//   Value(1) → Add.arg1
//   Add.result → Output
//
// Evaluates as:  let x=3 in (x*2) + 1  =  7

const ex_letBinding: SavedGraph = {
  version: 1,
  name: 'Let binding: let x=3 in x*2 + 1 = 7',
  savedAt: '',
  nodes: [
    n('lv3',  'value',   80, 200, { kind: 'value', valueType: 'Int', literal: '3',
      ports: [port('result', 'value', 'output', TI)] }),
    n('lt',   'let',    280, 200, {
      kind: 'let', varName: 'x',
      ports: [
        port('value',  '= value', 'input',  TI),
        port('param',  'x →',     'output', TI),
        port('body',   'in →',    'input',  TI),
        port('result', 'result',  'output', TI),
      ],
    }),
    n('lv2',  'value',  280, 80, { kind: 'value', valueType: 'Int', literal: '2',
      ports: [port('result', 'value', 'output', TI)] }),
    n('lmul', 'primop', 500, 130, { kind: 'primop', op: '*',
      ports: [port('arg0', 'x', 'input', TI), port('arg1', 'y', 'input', TI), port('result', 'result', 'output', TI)] }),
    n('lv1',  'value',  500, 300, { kind: 'value', valueType: 'Int', literal: '1',
      ports: [port('result', 'value', 'output', TI)] }),
    n('ladd', 'primop', 700, 200, { kind: 'primop', op: '+',
      ports: [port('arg0', 'x', 'input', TI), port('arg1', 'y', 'input', TI), port('result', 'result', 'output', TI)] }),
    n('lout', 'output', 900, 200, { kind: 'output', label: 'let x=3 in x*2+1', lastValue: null,
      ports: [port('value', 'value', 'input', TI)] }),
  ],
  edges: [
    e('le1', 'lv3',  'result', 'lt',   'value'),   // 3 → let.value (x=3)
    e('le2', 'lt',   'param',  'lmul', 'arg0'),    // let.param (x) → mul.arg0
    e('le3', 'lv2',  'result', 'lmul', 'arg1'),    // 2 → mul.arg1
    e('le4', 'lmul', 'result', 'lt',   'body'),    // x*2 → let.body
    e('le5', 'lt',   'result', 'ladd', 'arg0'),    // let result → add.arg0
    e('le6', 'lv1',  'result', 'ladd', 'arg1'),    // 1 → add.arg1
    e('le7', 'ladd', 'result', 'lout', 'value'),
  ],
};

// ─── Example 10: Caesar cipher ────────────────────────────────────────────
// Shifts each character code by a fixed amount (3), wrapping a–z.
//
// caesarChar shift c = chr ((ord c - 97 + shift) `mod` 26 + 97)
// caesar shift s     = charsToStr (map (caesarChar shift) (strToChars s))
//
// Flat layout (no module needed — shows HOF + char ops):
//   Input string "hello" → strToChars → map (caesarChar) → charsToStr → Output
//   caesarChar: λc → chr ((ord c - 97 + 3) `mod` 26 + 97)

const ex_caesar: SavedGraph = {
  version: 1,
  name: 'Caesar cipher — shift "hello" by 3',
  savedAt: '',
  nodes: [
    // The input string
    n('cs_str',   'value',    40, 300, { kind: 'value', valueType: 'String', literal: '"hello"',
      ports: [port('result', 'value', 'output', { tag: 'String' as const })] }),

    // strToChars: String → [Int]
    n('cs_s2c',   'hof',     240, 300, { kind: 'hof', op: 'strToChars',
      ports: [port('arg0', 's', 'input', { tag: 'String' as const }),
              port('result', 'result', 'output', { tag: 'List' as const, elem: TI })] }),

    // shift amount: 3
    n('cs_shift', 'value',    40, 100, { kind: 'value', valueType: 'Int', literal: '3',
      ports: [port('result', 'value', 'output', TI)] }),

    // Constants used in the lambda body
    n('cs_97a',   'value',   240,  40, { kind: 'value', valueType: 'Int', literal: '97',
      ports: [port('result', 'value', 'output', TI)] }),
    n('cs_26',    'value',   240, 160, { kind: 'value', valueType: 'Int', literal: '26',
      ports: [port('result', 'value', 'output', TI)] }),
    n('cs_97b',   'value',   600, 160, { kind: 'value', valueType: 'Int', literal: '97',
      ports: [port('result', 'value', 'output', TI)] }),

    // Lambda: \n -> (n - 97 + 3) `mod` 26 + 97   (returns shifted Int code point)
    // strToChars gives [Int], map gives [Int], charsToStr converts the whole list
    n('cs_lam',   'lambda',   40, 200, { kind: 'lambda', paramName: 'n',
      ports: [port('param',  'n →',     'output', TI),
              port('body',   '→ result','input',  TI),
              port('result', 'λ',       'output', { tag: 'Fun' as const, from: TI, to: TI })] }),

    // (n) - 97
    n('cs_sub97', 'primop',  240, 100, { kind: 'primop', op: '-',
      ports: [port('arg0', 'x', 'input', TI), port('arg1', 'y', 'input', TI),
              port('result', 'result', 'output', TI)] }),

    // (n - 97) + shift
    n('cs_adds',  'primop',  400,  60, { kind: 'primop', op: '+',
      ports: [port('arg0', 'x', 'input', TI), port('arg1', 'y', 'input', TI),
              port('result', 'result', 'output', TI)] }),

    // `mod` 26
    n('cs_mod',   'primop',  560, 100, { kind: 'primop', op: 'mod',
      ports: [port('arg0', 'x', 'input', TI), port('arg1', 'y', 'input', TI),
              port('result', 'result', 'output', TI)] }),

    // + 97 (back to code point)
    n('cs_add97', 'primop',  720,  60, { kind: 'primop', op: '+',
      ports: [port('arg0', 'x', 'input', TI), port('arg1', 'y', 'input', TI),
              port('result', 'result', 'output', TI)] }),

    // map (λn → shifted code point) over [Int] from strToChars → [Int]
    n('cs_map',   'hof',     560, 300, { kind: 'hof', op: 'map',
      ports: [port('fn',   'f',  'input', { tag: 'Fun' as const, from: TI, to: TI }),
              port('list', 'xs', 'input', { tag: 'List' as const, elem: TI }),
              port('result', 'result', 'output', { tag: 'List' as const, elem: TI })] }),

    // charsToStr: [Int] → String
    n('cs_c2s',   'hof',     760, 300, { kind: 'hof', op: 'charsToStr',
      ports: [port('arg0', 'ns', 'input', { tag: 'List' as const, elem: TI }),
              port('result', 'result', 'output', { tag: 'String' as const })] }),

    n('cs_out',   'output',  960, 300, { kind: 'output', label: 'Caesar "hello"+3', lastValue: null,
      ports: [port('value', 'value', 'input', { tag: 'String' as const })] }),
  ],
  edges: [
    // λn: param → (n - 97)
    e('ce1',  'cs_lam',   'param',  'cs_sub97', 'arg0'),
    e('ce3',  'cs_97a',   'result', 'cs_sub97', 'arg1'),
    // (n - 97) + shift
    e('ce4',  'cs_sub97', 'result', 'cs_adds',  'arg0'),
    e('ce5',  'cs_shift', 'result', 'cs_adds',  'arg1'),
    // mod 26
    e('ce6',  'cs_adds',  'result', 'cs_mod',   'arg0'),
    e('ce7',  'cs_26',    'result', 'cs_mod',   'arg1'),
    // + 97  → lambda body returns the shifted Int code point
    e('ce8',  'cs_mod',   'result', 'cs_add97', 'arg0'),
    e('ce9',  'cs_97b',   'result', 'cs_add97', 'arg1'),
    e('ce11', 'cs_add97', 'result', 'cs_lam',   'body'),

    // strToChars str → [Int]
    e('ce13', 'cs_str',   'result', 'cs_s2c',   'arg0'),
    // map (λn→shifted Int) over [Int] → [Int]
    e('ce12', 'cs_lam',   'result', 'cs_map',   'fn'),
    e('ce14', 'cs_s2c',   'result', 'cs_map',   'list'),
    // charsToStr [Int] → String → output
    e('ce15', 'cs_map',   'result', 'cs_c2s',   'arg0'),
    e('ce16', 'cs_c2s',   'result', 'cs_out',   'value'),
  ],
};

// ─── Example 11: Binary search ────────────────────────────────────────────
// bsearch xs target =
//   if null xs then False
//   else if head xs == target then True
//   else if head xs < target then bsearch (tail xs) target
//   else False
//
// Uses a recursive Module with two input ports: list and target.
// Outside: search for 7 in [1,3,5,7,9,11]

const BS_SUBGRAPH = 'bsearch-subgraph-v1';
const BS_ANC_LIST = 'bs-anc-list';
const BS_ANC_TGT  = 'bs-anc-tgt';
const BS_ANC_OUT  = 'bs-anc-out';
const BS_PORT_LIST = 'in_list';
const BS_PORT_TGT  = 'in_target';
const BS_PORT_OUT  = 'out_found';

const ex_binarySearch: SavedGraph = {
  version: 1,
  name: 'Binary search — find 7 in [1,3,5,7,9,11]',
  savedAt: '',
  nodes: [
    n('bs_list', 'value',   80, 150, { kind: 'value', valueType: 'List', literal: '[1,3,5,7,9,11]',
      ports: [port('result', 'value', 'output', { tag: 'List' as const, elem: TI })] }),
    n('bs_tgt',  'value',   80, 280, { kind: 'value', valueType: 'Int', literal: '7',
      ports: [port('result', 'value', 'output', TI)] }),
    n('bs_mod',  'module',  300, 200, {
      kind: 'module', name: 'bsearch', description: 'Binary search on a sorted list',
      subgraphId: BS_SUBGRAPH,
      inputPorts:  [port(BS_PORT_LIST, 'xs',     'input',  { tag: 'List' as const, elem: TI }),
                    port(BS_PORT_TGT,  'target', 'input',  TI)],
      outputPorts: [port(BS_PORT_OUT,  'found',  'output', TB)],
      ports:       [port(BS_PORT_LIST, 'xs',     'input',  { tag: 'List' as const, elem: TI }),
                    port(BS_PORT_TGT,  'target', 'input',  TI),
                    port(BS_PORT_OUT,  'found',  'output', TB)],
    }),
    n('bs_out',  'output',  540, 200, { kind: 'output', label: 'found?', lastValue: null,
      ports: [port('value', 'value', 'input', TB)] }),
  ],
  edges: [
    e('bse1', 'bs_list', 'result',    'bs_mod', BS_PORT_LIST),
    e('bse2', 'bs_tgt',  'result',    'bs_mod', BS_PORT_TGT),
    e('bse3', 'bs_mod',  BS_PORT_OUT, 'bs_out', 'value'),
  ],
  subgraphs: {
    [BS_SUBGRAPH]: {
      nodes: [
        // Input anchors
        n(BS_ANC_LIST, 'value', -100, 200, {
          kind: 'value', valueType: 'List', literal: '[]',
          ports: [port('result', 'xs', 'output', { tag: 'List' as const, elem: TI })],
          _modulePortId: BS_PORT_LIST,
        } as any),
        n(BS_ANC_TGT,  'value', -100, 350, {
          kind: 'value', valueType: 'Int', literal: '0',
          ports: [port('result', 'target', 'output', TI)],
          _modulePortId: BS_PORT_TGT,
        } as any),

        // null xs
        n('bs_null', 'listop', 120, 100, { kind: 'listop', op: 'null',
          ports: [port('list', 'xs', 'input', { tag: 'List' as const, elem: TI }),
                  port('result', 'result', 'output', TB)] }),

        // head xs
        n('bs_head', 'listop', 120, 260, { kind: 'listop', op: 'head',
          ports: [port('list', 'xs', 'input', { tag: 'List' as const, elem: TI }),
                  port('result', 'result', 'output', TI)] }),

        // tail xs
        n('bs_tail', 'listop', 120, 400, { kind: 'listop', op: 'tail',
          ports: [port('list', 'xs', 'input', { tag: 'List' as const, elem: TI }),
                  port('result', 'result', 'output', { tag: 'List' as const, elem: TI })] }),

        // head xs == target
        n('bs_eq',   'primop', 340, 260, { kind: 'primop', op: '==',
          ports: [port('arg0', 'x', 'input', TI), port('arg1', 'y', 'input', TI),
                  port('result', 'result', 'output', TB)] }),

        // head xs < target
        n('bs_lt',   'primop', 340, 400, { kind: 'primop', op: '<',
          ports: [port('arg0', 'x', 'input', TI), port('arg1', 'y', 'input', TI),
                  port('result', 'result', 'output', TB)] }),

        // Literal False (null xs branch and head > target branch)
        n('bs_false','value',  340, 100, { kind: 'value', valueType: 'Bool', literal: 'False',
          ports: [port('result', 'value', 'output', TB)] }),

        // Recursive call: bsearch (tail xs) target
        n('bs_call', 'call',   340, 540, {
          kind: 'call', targetName: 'bsearch',
          ports: [port(BS_PORT_LIST, 'xs',     'input',  { tag: 'List' as const, elem: TI }),
                  port(BS_PORT_TGT,  'target', 'input',  TI),
                  port(BS_PORT_OUT,  'found',  'output', TB)],
        }),

        // if (head < target) then recurse else False
        n('bs_if2',  'if',     580, 460, { kind: 'if',
          ports: [port('cond',   'if',   'input',  TB),
                  port('then',   'then', 'input',  TB),
                  port('else',   'else', 'input',  TB),
                  port('result', 'result', 'output', TB)] }),

        // if (head == target) then True else (if2)
        n('bs_true', 'value',  580, 260, { kind: 'value', valueType: 'Bool', literal: 'True',
          ports: [port('result', 'value', 'output', TB)] }),
        n('bs_if1',  'if',     780, 300, { kind: 'if',
          ports: [port('cond',   'if',   'input',  TB),
                  port('then',   'then', 'input',  TB),
                  port('else',   'else', 'input',  TB),
                  port('result', 'result', 'output', TB)] }),

        // if (null xs) then False else if1
        n('bs_if0',  'if',     980, 200, { kind: 'if',
          ports: [port('cond',   'if',   'input',  TB),
                  port('then',   'then', 'input',  TB),
                  port('else',   'else', 'input',  TB),
                  port('result', 'result', 'output', TB)] }),

        // Output anchor
        n(BS_ANC_OUT, 'output', 1180, 200, {
          kind: 'output', label: 'found', lastValue: null,
          ports: [port('value', 'value', 'input', TB)],
          _modulePortId: BS_PORT_OUT,
        } as any),
      ],
      edges: [
        // null xs
        e('bsi1',  BS_ANC_LIST, 'result', 'bs_null', 'list'),
        // head xs, tail xs
        e('bsi2',  BS_ANC_LIST, 'result', 'bs_head', 'list'),
        e('bsi3',  BS_ANC_LIST, 'result', 'bs_tail', 'list'),
        // head == target
        e('bsi4',  'bs_head',   'result', 'bs_eq',   'arg0'),
        e('bsi5',  BS_ANC_TGT,  'result', 'bs_eq',   'arg1'),
        // head < target
        e('bsi6',  'bs_head',   'result', 'bs_lt',   'arg0'),
        e('bsi7',  BS_ANC_TGT,  'result', 'bs_lt',   'arg1'),
        // recursive call
        e('bsi8',  'bs_tail',   'result', 'bs_call', BS_PORT_LIST),
        e('bsi9',  BS_ANC_TGT,  'result', 'bs_call', BS_PORT_TGT),
        // if (head < target) then recurse else False
        e('bsi10', 'bs_lt',     'result', 'bs_if2',  'cond'),
        e('bsi11', 'bs_call',   BS_PORT_OUT, 'bs_if2', 'then'),
        e('bsi12', 'bs_false',  'result', 'bs_if2',  'else'),
        // if (head == target) then True else if2
        e('bsi13', 'bs_eq',     'result', 'bs_if1',  'cond'),
        e('bsi14', 'bs_true',   'result', 'bs_if1',  'then'),
        e('bsi15', 'bs_if2',    'result', 'bs_if1',  'else'),
        // if (null xs) then False else if1
        e('bsi16', 'bs_null',   'result', 'bs_if0',  'cond'),
        e('bsi17', 'bs_false',  'result', 'bs_if0',  'then'),
        e('bsi18', 'bs_if1',    'result', 'bs_if0',  'else'),
        // output
        e('bsi19', 'bs_if0',    'result', BS_ANC_OUT, 'value'),
      ],
    },
  } as any,
};

// ─── Example 12: Quicksort ────────────────────────────────────────────────
// qsort [] = []
// qsort (x:xs) = qsort smaller ++ [x] ++ qsort bigger
//   where smaller = filter (< x) xs
//         bigger  = filter (>= x) xs
//
// In the subgraph:
//   null xs → base case []
//   else: pivot = head xs, rest = tail xs
//         smaller = filter (\y -> y < pivot) rest
//         bigger  = filter (\y -> y >= pivot) rest
//         result  = qsort(smaller) ++ [pivot] ++ qsort(bigger)
//
// We need two lambdas (lt-pivot and gte-pivot) and two recursive calls.

const QS_SUBGRAPH = 'qsort-subgraph-v1';
const QS_ANC_IN   = 'qs-anc-in';
const QS_ANC_OUT  = 'qs-anc-out';
const QS_PORT_IN  = 'in_xs';
const QS_PORT_OUT = 'out_sorted';
const QS_CALL_PORT_IN  = QS_PORT_IN;
const QS_CALL_PORT_OUT = QS_PORT_OUT;

const ex_quicksort: SavedGraph = {
  version: 1,
  name: 'Quicksort — qsort [3,1,4,1,5,9,2,6]',
  savedAt: '',
  nodes: [
    n('qs_list', 'value',   80, 200, { kind: 'value', valueType: 'List', literal: '[3,1,4,1,5,9,2,6]',
      ports: [port('result', 'value', 'output', { tag: 'List' as const, elem: TI })] }),
    n('qs_mod',  'module',  300, 200, {
      kind: 'module', name: 'qsort', description: 'Quicksort — divide by pivot',
      subgraphId: QS_SUBGRAPH,
      inputPorts:  [port(QS_PORT_IN,  'xs',     'input',  { tag: 'List' as const, elem: TI })],
      outputPorts: [port(QS_PORT_OUT, 'sorted', 'output', { tag: 'List' as const, elem: TI })],
      ports:       [port(QS_PORT_IN,  'xs',     'input',  { tag: 'List' as const, elem: TI }),
                    port(QS_PORT_OUT, 'sorted', 'output', { tag: 'List' as const, elem: TI })],
    }),
    n('qs_out',  'output',  540, 200, { kind: 'output', label: 'sorted', lastValue: null,
      ports: [port('value', 'value', 'input', { tag: 'List' as const, elem: TI })] }),
  ],
  edges: [
    e('qse1', 'qs_list', 'result',    'qs_mod', QS_PORT_IN),
    e('qse2', 'qs_mod',  QS_PORT_OUT, 'qs_out', 'value'),
  ],
  subgraphs: {
    [QS_SUBGRAPH]: {
      nodes: [
        // Input anchor
        n(QS_ANC_IN, 'value', -120, 300, {
          kind: 'value', valueType: 'List', literal: '[]',
          ports: [port('result', 'xs', 'output', { tag: 'List' as const, elem: TI })],
          _modulePortId: QS_PORT_IN,
        } as any),

        // null xs (base case check)
        n('qs_null',   'listop',  80, 80,  { kind: 'listop', op: 'null',
          ports: [port('list',   'xs',     'input',  { tag: 'List' as const, elem: TI }),
                  port('result', 'result', 'output', TB)] }),

        // [] base case
        n('qs_empty',  'value',   80, 200, { kind: 'value', valueType: 'List', literal: '[]',
          ports: [port('result', 'value', 'output', { tag: 'List' as const, elem: TI })] }),

        // pivot = head xs
        n('qs_pivot',  'listop',  80, 380, { kind: 'listop', op: 'head',
          ports: [port('list',   'xs',     'input',  { tag: 'List' as const, elem: TI }),
                  port('result', 'result', 'output', TI)] }),

        // rest = tail xs
        n('qs_rest',   'listop',  80, 500, { kind: 'listop', op: 'tail',
          ports: [port('list',   'xs',     'input',  { tag: 'List' as const, elem: TI }),
                  port('result', 'result', 'output', { tag: 'List' as const, elem: TI })] }),

        // Lambda: \y -> y < pivot
        n('qs_llt',    'lambda', 280, 280, { kind: 'lambda', paramName: 'y',
          ports: [port('param',  'y →',      'output', TI),
                  port('body',   '→ result', 'input',  TB),
                  port('result', 'λ',        'output', { tag: 'Fun' as const, from: TI, to: TB })] }),
        n('qs_cmplt',  'primop', 480, 280, { kind: 'primop', op: '<',
          ports: [port('arg0', 'y',      'input',  TI),
                  port('arg1', 'pivot',  'input',  TI),
                  port('result', 'result', 'output', TB)] }),

        // Lambda: \y -> y >= pivot
        n('qs_lgte',   'lambda', 280, 480, { kind: 'lambda', paramName: 'y',
          ports: [port('param',  'y →',      'output', TI),
                  port('body',   '→ result', 'input',  TB),
                  port('result', 'λ',        'output', { tag: 'Fun' as const, from: TI, to: TB })] }),
        n('qs_cmpgte', 'primop', 480, 480, { kind: 'primop', op: '>=',
          ports: [port('arg0', 'y',      'input',  TI),
                  port('arg1', 'pivot',  'input',  TI),
                  port('result', 'result', 'output', TB)] }),

        // filter (< pivot) rest  → smaller
        n('qs_flt_s',  'hof',   680, 280, { kind: 'hof', op: 'filter',
          ports: [port('fn',   'p',  'input',  { tag: 'Fun' as const, from: TI, to: TB }),
                  port('list', 'xs', 'input',  { tag: 'List' as const, elem: TI }),
                  port('result', 'result', 'output', { tag: 'List' as const, elem: TI })] }),

        // filter (>= pivot) rest → bigger
        n('qs_flt_b',  'hof',   680, 480, { kind: 'hof', op: 'filter',
          ports: [port('fn',   'p',  'input',  { tag: 'Fun' as const, from: TI, to: TB }),
                  port('list', 'xs', 'input',  { tag: 'List' as const, elem: TI }),
                  port('result', 'result', 'output', { tag: 'List' as const, elem: TI })] }),

        // qsort smaller
        n('qs_call_s', 'call',  880, 280, {
          kind: 'call', targetName: 'qsort',
          ports: [port(QS_CALL_PORT_IN,  'xs',     'input',  { tag: 'List' as const, elem: TI }),
                  port(QS_CALL_PORT_OUT, 'sorted', 'output', { tag: 'List' as const, elem: TI })],
        }),

        // qsort bigger
        n('qs_call_b', 'call',  880, 480, {
          kind: 'call', targetName: 'qsort',
          ports: [port(QS_CALL_PORT_IN,  'xs',     'input',  { tag: 'List' as const, elem: TI }),
                  port(QS_CALL_PORT_OUT, 'sorted', 'output', { tag: 'List' as const, elem: TI })],
        }),

        // [pivot] — wrap pivot in singleton list using cons + []
        n('qs_emp2',   'value', 880, 380, { kind: 'value', valueType: 'List', literal: '[]',
          ports: [port('result', 'value', 'output', { tag: 'List' as const, elem: TI })] }),
        n('qs_wrap',   'listop',1060, 360, { kind: 'listop', op: 'cons',
          ports: [port('elem',   'x',  'input',  TI),
                  port('list',   'xs', 'input',  { tag: 'List' as const, elem: TI }),
                  port('result', 'result', 'output', { tag: 'List' as const, elem: TI })] }),

        // qsort_smaller ++ [pivot]
        n('qs_app1',   'listop',1200, 300, { kind: 'listop', op: '++',
          ports: [port('list0',  'xs', 'input',  { tag: 'List' as const, elem: TI }),
                  port('list1',  'ys', 'input',  { tag: 'List' as const, elem: TI }),
                  port('result', 'result', 'output', { tag: 'List' as const, elem: TI })] }),

        // (...) ++ qsort_bigger
        n('qs_app2',   'listop',1380, 380, { kind: 'listop', op: '++',
          ports: [port('list0',  'xs', 'input',  { tag: 'List' as const, elem: TI }),
                  port('list1',  'ys', 'input',  { tag: 'List' as const, elem: TI }),
                  port('result', 'result', 'output', { tag: 'List' as const, elem: TI })] }),

        // if null then [] else (qsort smaller ++ [pivot] ++ qsort bigger)
        n('qs_if',     'if',   1560, 280, { kind: 'if',
          ports: [port('cond',   'if',   'input',  TB),
                  port('then',   'then', 'input',  { tag: 'List' as const, elem: TI }),
                  port('else',   'else', 'input',  { tag: 'List' as const, elem: TI }),
                  port('result', 'result', 'output', { tag: 'List' as const, elem: TI })] }),

        // Output anchor
        n(QS_ANC_OUT, 'output', 1760, 280, {
          kind: 'output', label: 'sorted', lastValue: null,
          ports: [port('value', 'value', 'input', { tag: 'List' as const, elem: TI })],
          _modulePortId: QS_PORT_OUT,
        } as any),
      ],
      edges: [
        // Feed input to null, head, tail
        e('qsi1',  QS_ANC_IN,   'result', 'qs_null',   'list'),
        e('qsi2',  QS_ANC_IN,   'result', 'qs_pivot',  'list'),
        e('qsi3',  QS_ANC_IN,   'result', 'qs_rest',   'list'),

        // Lambda lt: \y -> y < pivot
        e('qsi4',  'qs_llt',    'param',  'qs_cmplt',  'arg0'),
        e('qsi5',  'qs_pivot',  'result', 'qs_cmplt',  'arg1'),
        e('qsi6',  'qs_cmplt',  'result', 'qs_llt',    'body'),

        // Lambda gte: \y -> y >= pivot
        e('qsi7',  'qs_lgte',   'param',  'qs_cmpgte', 'arg0'),
        e('qsi8',  'qs_pivot',  'result', 'qs_cmpgte', 'arg1'),
        e('qsi9',  'qs_cmpgte', 'result', 'qs_lgte',   'body'),

        // filter smaller / bigger
        e('qsi10', 'qs_llt',    'result', 'qs_flt_s',  'fn'),
        e('qsi11', 'qs_rest',   'result', 'qs_flt_s',  'list'),
        e('qsi12', 'qs_lgte',   'result', 'qs_flt_b',  'fn'),
        e('qsi13', 'qs_rest',   'result', 'qs_flt_b',  'list'),

        // recursive calls
        e('qsi14', 'qs_flt_s',  'result', 'qs_call_s', QS_CALL_PORT_IN),
        e('qsi15', 'qs_flt_b',  'result', 'qs_call_b', QS_CALL_PORT_IN),

        // [pivot]
        e('qsi16', 'qs_pivot',  'result', 'qs_wrap',   'elem'),
        e('qsi17', 'qs_emp2',   'result', 'qs_wrap',   'list'),

        // qsort_smaller ++ [pivot]
        e('qsi18', 'qs_call_s', QS_CALL_PORT_OUT, 'qs_app1', 'list0'),
        e('qsi19', 'qs_wrap',   'result',          'qs_app1', 'list1'),

        // ++ qsort_bigger
        e('qsi20', 'qs_app1',   'result', 'qs_app2', 'list0'),
        e('qsi21', 'qs_call_b', QS_CALL_PORT_OUT, 'qs_app2', 'list1'),

        // if null then [] else full result
        e('qsi22', 'qs_null',   'result', 'qs_if', 'cond'),
        e('qsi23', 'qs_empty',  'result', 'qs_if', 'then'),
        e('qsi24', 'qs_app2',   'result', 'qs_if', 'else'),

        // output
        e('qsi25', 'qs_if',     'result', QS_ANC_OUT, 'value'),
      ],
    },
  } as any,
};

// ─── Example 13: Merge sort ───────────────────────────────────────────────
// msort xs =
//   if length xs <= 1 then xs
//   else merge (msort (take half xs)) (msort (drop half xs))
//     where half = length xs `div` 2
//
// merge [] ys = ys
// merge xs [] = xs
// merge (x:xs) (y:ys) = if x <= y then x : merge xs (y:ys)
//                                  else y : merge (x:xs) ys
//
// We model this as a single msort module that uses take/drop/length/div,
// with two recursive calls. The merge step is modelled inline using
// foldr-based merging (simpler to wire: merge two sorted halves).
//
// Simplified: use the built-in sort for the merge step is cheating.
// Instead, implement as: msort uses filter (<= median) and filter (> median).
// That's actually just quicksort-style.
//
// True merge sort in the graph is complex because merge itself is recursive.
// We implement: halve with take/drop, recurse, then merge via foldr insert.
// "insert x sorted = foldr (\y acc -> if x <= y then x:y:acc else y:acc) [x] sorted"
// "msort = foldr insert []"
// This is actually insertion sort! But it's O(n²) and looks nice visually.
//
// For a genuine merge sort we'd need a separate merge module, making the
// graph very large. We implement it as two modules: msort and merge.

const MS_SUBGRAPH  = 'msort-subgraph-v1';
const MG_SUBGRAPH  = 'merge-subgraph-v1';

const MS_ANC_IN    = 'ms-anc-in';
const MS_ANC_OUT   = 'ms-anc-out';
const MS_PORT_IN   = 'in_xs';
const MS_PORT_OUT  = 'out_sorted';

const MG_ANC_XS    = 'mg-anc-xs';
const MG_ANC_YS    = 'mg-anc-ys';
const MG_ANC_OUT   = 'mg-anc-out';
const MG_PORT_XS   = 'in_xs';
const MG_PORT_YS   = 'in_ys';
const MG_PORT_OUT  = 'out_merged';

const ex_mergesort: SavedGraph = {
  version: 1,
  name: 'Merge sort — msort [5,3,8,1,9,2,7,4]',
  savedAt: '',
  nodes: [
    n('ms_list',  'value',   80, 200, { kind: 'value', valueType: 'List', literal: '[5,3,8,1,9,2,7,4]',
      ports: [port('result', 'value', 'output', { tag: 'List' as const, elem: TI })] }),
    // msort module
    n('ms_mod',   'module',  300, 200, {
      kind: 'module', name: 'msort', description: 'Merge sort — split, recurse, merge',
      subgraphId: MS_SUBGRAPH,
      inputPorts:  [port(MS_PORT_IN,  'xs',     'input',  { tag: 'List' as const, elem: TI })],
      outputPorts: [port(MS_PORT_OUT, 'sorted', 'output', { tag: 'List' as const, elem: TI })],
      ports:       [port(MS_PORT_IN,  'xs',     'input',  { tag: 'List' as const, elem: TI }),
                    port(MS_PORT_OUT, 'sorted', 'output', { tag: 'List' as const, elem: TI })],
    }),
    // merge module (used inside msort's subgraph — also exposed at top level for clarity)
    n('mg_mod',   'module',  300, 380, {
      kind: 'module', name: 'merge', description: 'Merge two sorted lists',
      subgraphId: MG_SUBGRAPH,
      inputPorts:  [port(MG_PORT_XS,  'xs',     'input',  { tag: 'List' as const, elem: TI }),
                    port(MG_PORT_YS,  'ys',     'input',  { tag: 'List' as const, elem: TI })],
      outputPorts: [port(MG_PORT_OUT, 'merged', 'output', { tag: 'List' as const, elem: TI })],
      ports:       [port(MG_PORT_XS,  'xs',     'input',  { tag: 'List' as const, elem: TI }),
                    port(MG_PORT_YS,  'ys',     'input',  { tag: 'List' as const, elem: TI }),
                    port(MG_PORT_OUT, 'merged', 'output', { tag: 'List' as const, elem: TI })],
    }),
    n('ms_out',   'output',  540, 200, { kind: 'output', label: 'sorted', lastValue: null,
      ports: [port('value', 'value', 'input', { tag: 'List' as const, elem: TI })] }),
  ],
  edges: [
    e('mse1', 'ms_list', 'result',    'ms_mod', MS_PORT_IN),
    e('mse2', 'ms_mod',  MS_PORT_OUT, 'ms_out', 'value'),
  ],
  subgraphs: {
    // ── msort subgraph ─────────────────────────────────────────────────────
    [MS_SUBGRAPH]: {
      nodes: [
        n(MS_ANC_IN, 'value', -140, 300, {
          kind: 'value', valueType: 'List', literal: '[]',
          ports: [port('result', 'xs', 'output', { tag: 'List' as const, elem: TI })],
          _modulePortId: MS_PORT_IN,
        } as any),

        // length xs
        n('ms_len',   'listop',   80, 200, { kind: 'listop', op: 'length',
          ports: [port('list',   'xs', 'input',  { tag: 'List' as const, elem: TI }),
                  port('result', 'n',  'output', TI)] }),

        // length xs `div` 2  = half
        n('ms_two',   'value',    80,  80, { kind: 'value', valueType: 'Int', literal: '2',
          ports: [port('result', 'value', 'output', TI)] }),
        n('ms_div',   'primop',  280,  80, { kind: 'primop', op: 'div',
          ports: [port('arg0', 'x', 'input', TI), port('arg1', 'y', 'input', TI),
                  port('result', 'result', 'output', TI)] }),

        // length xs <= 1  (base case)
        n('ms_one',   'value',    80, 380, { kind: 'value', valueType: 'Int', literal: '1',
          ports: [port('result', 'value', 'output', TI)] }),
        n('ms_le',    'primop',  280, 300, { kind: 'primop', op: '<=',
          ports: [port('arg0', 'x', 'input', TI), port('arg1', 'y', 'input', TI),
                  port('result', 'result', 'output', TB)] }),

        // take half xs  (left half)
        n('ms_take',  'listop',  460, 100, { kind: 'listop', op: 'take',
          ports: [port('n',    'n',  'input',  TI),
                  port('list', 'xs', 'input',  { tag: 'List' as const, elem: TI }),
                  port('result', 'result', 'output', { tag: 'List' as const, elem: TI })] }),

        // drop half xs  (right half)
        n('ms_drop',  'listop',  460, 300, { kind: 'listop', op: 'drop',
          ports: [port('n',    'n',  'input',  TI),
                  port('list', 'xs', 'input',  { tag: 'List' as const, elem: TI }),
                  port('result', 'result', 'output', { tag: 'List' as const, elem: TI })] }),

        // msort (take half xs)
        n('ms_call_l','call',    680, 100, {
          kind: 'call', targetName: 'msort',
          ports: [port(MS_PORT_IN,  'xs',     'input',  { tag: 'List' as const, elem: TI }),
                  port(MS_PORT_OUT, 'sorted', 'output', { tag: 'List' as const, elem: TI })],
        }),

        // msort (drop half xs)
        n('ms_call_r','call',    680, 300, {
          kind: 'call', targetName: 'msort',
          ports: [port(MS_PORT_IN,  'xs',     'input',  { tag: 'List' as const, elem: TI }),
                  port(MS_PORT_OUT, 'sorted', 'output', { tag: 'List' as const, elem: TI })],
        }),

        // merge (msort left) (msort right)
        n('ms_merge', 'call',    900, 200, {
          kind: 'call', targetName: 'merge',
          ports: [port(MG_PORT_XS,  'xs',     'input',  { tag: 'List' as const, elem: TI }),
                  port(MG_PORT_YS,  'ys',     'input',  { tag: 'List' as const, elem: TI }),
                  port(MG_PORT_OUT, 'merged', 'output', { tag: 'List' as const, elem: TI })],
        }),

        // if (length <= 1) then xs else merge result
        n('ms_if',    'if',     1100, 200, { kind: 'if',
          ports: [port('cond',   'if',   'input',  TB),
                  port('then',   'then', 'input',  { tag: 'List' as const, elem: TI }),
                  port('else',   'else', 'input',  { tag: 'List' as const, elem: TI }),
                  port('result', 'result', 'output', { tag: 'List' as const, elem: TI })] }),

        n(MS_ANC_OUT, 'output', 1300, 200, {
          kind: 'output', label: 'sorted', lastValue: null,
          ports: [port('value', 'value', 'input', { tag: 'List' as const, elem: TI })],
          _modulePortId: MS_PORT_OUT,
        } as any),
      ],
      edges: [
        // length xs
        e('msi1',  MS_ANC_IN,   'result', 'ms_len',    'list'),
        // half = length `div` 2
        e('msi2',  'ms_len',    'result', 'ms_div',    'arg0'),
        e('msi3',  'ms_two',    'result', 'ms_div',    'arg1'),
        // length <= 1
        e('msi4',  'ms_len',    'result', 'ms_le',     'arg0'),
        e('msi5',  'ms_one',    'result', 'ms_le',     'arg1'),
        // take half xs / drop half xs
        e('msi6',  'ms_div',    'result', 'ms_take',   'n'),
        e('msi7',  MS_ANC_IN,   'result', 'ms_take',   'list'),
        e('msi8',  'ms_div',    'result', 'ms_drop',   'n'),
        e('msi9',  MS_ANC_IN,   'result', 'ms_drop',   'list'),
        // recursive msort calls
        e('msi10', 'ms_take',   'result', 'ms_call_l', MS_PORT_IN),
        e('msi11', 'ms_drop',   'result', 'ms_call_r', MS_PORT_IN),
        // merge
        e('msi12', 'ms_call_l', MS_PORT_OUT, 'ms_merge', MG_PORT_XS),
        e('msi13', 'ms_call_r', MS_PORT_OUT, 'ms_merge', MG_PORT_YS),
        // if
        e('msi14', 'ms_le',     'result', 'ms_if',     'cond'),
        e('msi15', MS_ANC_IN,   'result', 'ms_if',     'then'),
        e('msi16', 'ms_merge',  MG_PORT_OUT, 'ms_if',  'else'),
        // output
        e('msi17', 'ms_if',     'result', MS_ANC_OUT,  'value'),
      ],
    },

    // ── merge subgraph ──────────────────────────────────────────────────────
    // merge xs ys =
    //   if null xs then ys
    //   else if null ys then xs
    //   else if head xs <= head ys
    //        then head xs : merge (tail xs) ys
    //        else head ys : merge xs (tail ys)
    [MG_SUBGRAPH]: {
      nodes: [
        n(MG_ANC_XS, 'value', -140, 200, {
          kind: 'value', valueType: 'List', literal: '[]',
          ports: [port('result', 'xs', 'output', { tag: 'List' as const, elem: TI })],
          _modulePortId: MG_PORT_XS,
        } as any),
        n(MG_ANC_YS, 'value', -140, 400, {
          kind: 'value', valueType: 'List', literal: '[]',
          ports: [port('result', 'ys', 'output', { tag: 'List' as const, elem: TI })],
          _modulePortId: MG_PORT_YS,
        } as any),

        // null xs, null ys
        n('mg_nxs',   'listop',  80, 100, { kind: 'listop', op: 'null',
          ports: [port('list', 'xs', 'input', { tag: 'List' as const, elem: TI }),
                  port('result', 'result', 'output', TB)] }),
        n('mg_nys',   'listop',  80, 300, { kind: 'listop', op: 'null',
          ports: [port('list', 'xs', 'input', { tag: 'List' as const, elem: TI }),
                  port('result', 'result', 'output', TB)] }),

        // head xs, tail xs, head ys, tail ys
        n('mg_hx',    'listop', 280, 100, { kind: 'listop', op: 'head',
          ports: [port('list', 'xs', 'input', { tag: 'List' as const, elem: TI }),
                  port('result', 'result', 'output', TI)] }),
        n('mg_tx',    'listop', 280, 200, { kind: 'listop', op: 'tail',
          ports: [port('list', 'xs', 'input', { tag: 'List' as const, elem: TI }),
                  port('result', 'result', 'output', { tag: 'List' as const, elem: TI })] }),
        n('mg_hy',    'listop', 280, 340, { kind: 'listop', op: 'head',
          ports: [port('list', 'xs', 'input', { tag: 'List' as const, elem: TI }),
                  port('result', 'result', 'output', TI)] }),
        n('mg_ty',    'listop', 280, 460, { kind: 'listop', op: 'tail',
          ports: [port('list', 'xs', 'input', { tag: 'List' as const, elem: TI }),
                  port('result', 'result', 'output', { tag: 'List' as const, elem: TI })] }),

        // head xs <= head ys
        n('mg_le',    'primop', 480, 220, { kind: 'primop', op: '<=',
          ports: [port('arg0', 'x', 'input', TI), port('arg1', 'y', 'input', TI),
                  port('result', 'result', 'output', TB)] }),

        // merge (tail xs) ys
        n('mg_rec_tx','call',   480, 100, {
          kind: 'call', targetName: 'merge',
          ports: [port(MG_PORT_XS,  'xs',     'input',  { tag: 'List' as const, elem: TI }),
                  port(MG_PORT_YS,  'ys',     'input',  { tag: 'List' as const, elem: TI }),
                  port(MG_PORT_OUT, 'merged', 'output', { tag: 'List' as const, elem: TI })],
        }),

        // merge xs (tail ys)
        n('mg_rec_ty','call',   480, 460, {
          kind: 'call', targetName: 'merge',
          ports: [port(MG_PORT_XS,  'xs',     'input',  { tag: 'List' as const, elem: TI }),
                  port(MG_PORT_YS,  'ys',     'input',  { tag: 'List' as const, elem: TI }),
                  port(MG_PORT_OUT, 'merged', 'output', { tag: 'List' as const, elem: TI })],
        }),

        // hx : merge (tx) ys
        n('mg_cons_x','listop', 700, 100, { kind: 'listop', op: 'cons',
          ports: [port('elem', 'x',  'input',  TI),
                  port('list', 'xs', 'input',  { tag: 'List' as const, elem: TI }),
                  port('result', 'result', 'output', { tag: 'List' as const, elem: TI })] }),

        // hy : merge xs (ty)
        n('mg_cons_y','listop', 700, 460, { kind: 'listop', op: 'cons',
          ports: [port('elem', 'x',  'input',  TI),
                  port('list', 'xs', 'input',  { tag: 'List' as const, elem: TI }),
                  port('result', 'result', 'output', { tag: 'List' as const, elem: TI })] }),

        // if hx <= hy then cons_x else cons_y
        n('mg_if_le', 'if',    900, 280, { kind: 'if',
          ports: [port('cond',   'if',   'input',  TB),
                  port('then',   'then', 'input',  { tag: 'List' as const, elem: TI }),
                  port('else',   'else', 'input',  { tag: 'List' as const, elem: TI }),
                  port('result', 'result', 'output', { tag: 'List' as const, elem: TI })] }),

        // if null ys then xs else if_le
        n('mg_if_ny', 'if',   1100, 200, { kind: 'if',
          ports: [port('cond',   'if',   'input',  TB),
                  port('then',   'then', 'input',  { tag: 'List' as const, elem: TI }),
                  port('else',   'else', 'input',  { tag: 'List' as const, elem: TI }),
                  port('result', 'result', 'output', { tag: 'List' as const, elem: TI })] }),

        // if null xs then ys else if_ny
        n('mg_if_nx', 'if',   1300, 150, { kind: 'if',
          ports: [port('cond',   'if',   'input',  TB),
                  port('then',   'then', 'input',  { tag: 'List' as const, elem: TI }),
                  port('else',   'else', 'input',  { tag: 'List' as const, elem: TI }),
                  port('result', 'result', 'output', { tag: 'List' as const, elem: TI })] }),

        n(MG_ANC_OUT, 'output', 1500, 150, {
          kind: 'output', label: 'merged', lastValue: null,
          ports: [port('value', 'value', 'input', { tag: 'List' as const, elem: TI })],
          _modulePortId: MG_PORT_OUT,
        } as any),
      ],
      edges: [
        // null xs / null ys
        e('mgi1',  MG_ANC_XS,   'result', 'mg_nxs',    'list'),
        e('mgi2',  MG_ANC_YS,   'result', 'mg_nys',    'list'),
        // head/tail xs
        e('mgi3',  MG_ANC_XS,   'result', 'mg_hx',     'list'),
        e('mgi4',  MG_ANC_XS,   'result', 'mg_tx',     'list'),
        // head/tail ys
        e('mgi5',  MG_ANC_YS,   'result', 'mg_hy',     'list'),
        e('mgi6',  MG_ANC_YS,   'result', 'mg_ty',     'list'),
        // hx <= hy
        e('mgi7',  'mg_hx',     'result', 'mg_le',     'arg0'),
        e('mgi8',  'mg_hy',     'result', 'mg_le',     'arg1'),
        // merge (tx) ys
        e('mgi9',  'mg_tx',     'result', 'mg_rec_tx', MG_PORT_XS),
        e('mgi10', MG_ANC_YS,   'result', 'mg_rec_tx', MG_PORT_YS),
        // merge xs (ty)
        e('mgi11', MG_ANC_XS,   'result', 'mg_rec_ty', MG_PORT_XS),
        e('mgi12', 'mg_ty',     'result', 'mg_rec_ty', MG_PORT_YS),
        // cons_x: hx : merge(tx, ys)
        e('mgi13', 'mg_hx',     'result', 'mg_cons_x', 'elem'),
        e('mgi14', 'mg_rec_tx', MG_PORT_OUT, 'mg_cons_x', 'list'),
        // cons_y: hy : merge(xs, ty)
        e('mgi15', 'mg_hy',     'result', 'mg_cons_y', 'elem'),
        e('mgi16', 'mg_rec_ty', MG_PORT_OUT, 'mg_cons_y', 'list'),
        // if hx <= hy
        e('mgi17', 'mg_le',     'result', 'mg_if_le',  'cond'),
        e('mgi18', 'mg_cons_x', 'result', 'mg_if_le',  'then'),
        e('mgi19', 'mg_cons_y', 'result', 'mg_if_le',  'else'),
        // if null ys then xs else if_le
        e('mgi20', 'mg_nys',    'result', 'mg_if_ny',  'cond'),
        e('mgi21', MG_ANC_XS,   'result', 'mg_if_ny',  'then'),
        e('mgi22', 'mg_if_le',  'result', 'mg_if_ny',  'else'),
        // if null xs then ys else if_ny
        e('mgi23', 'mg_nxs',    'result', 'mg_if_nx',  'cond'),
        e('mgi24', MG_ANC_YS,   'result', 'mg_if_nx',  'then'),
        e('mgi25', 'mg_if_ny',  'result', 'mg_if_nx',  'else'),
        // output
        e('mgi26', 'mg_if_nx',  'result', MG_ANC_OUT,  'value'),
      ],
    },
  } as any,
};

// ─── Example 14: Bubble sort ──────────────────────────────────────────────
// Bubble sort: repeatedly apply a single-pass "bubble" function until sorted.
// bubble [] = []
// bubble [x] = [x]
// bubble (x:y:rest) = if x <= y then x : bubble (y:rest)
//                               else y : bubble (x:rest)
//
// bsort xs = if bubble xs == xs then xs else bsort (bubble xs)
//
// We implement bubble as a recursive module, then bsort calls it.
// Note: == on lists uses deep equality (supported by the evaluator).

const BB_SUBGRAPH  = 'bubble-subgraph-v1';
const BST_SUBGRAPH = 'bsort-subgraph-v1';

const BB_ANC_IN   = 'bb-anc-in';
const BB_ANC_OUT  = 'bb-anc-out';
const BB_PORT_IN  = 'in_xs';
const BB_PORT_OUT = 'out_bubbled';

const BST_ANC_IN  = 'bst-anc-in';
const BST_ANC_OUT = 'bst-anc-out';
const BST_PORT_IN  = 'in_xs';
const BST_PORT_OUT = 'out_sorted';

const ex_bubbleSort: SavedGraph = {
  version: 1,
  name: 'Bubble sort — bsort [5,3,8,1,9,2]',
  savedAt: '',
  nodes: [
    n('bb_list',  'value',   80, 200, { kind: 'value', valueType: 'List', literal: '[5,3,8,1,9,2]',
      ports: [port('result', 'value', 'output', { tag: 'List' as const, elem: TI })] }),
    // bubble module (one pass)
    n('bb_mod',   'module',  300, 340, {
      kind: 'module', name: 'bubble', description: 'Single bubble pass',
      subgraphId: BB_SUBGRAPH,
      inputPorts:  [port(BB_PORT_IN,  'xs',      'input',  { tag: 'List' as const, elem: TI })],
      outputPorts: [port(BB_PORT_OUT, 'bubbled', 'output', { tag: 'List' as const, elem: TI })],
      ports:       [port(BB_PORT_IN,  'xs',      'input',  { tag: 'List' as const, elem: TI }),
                    port(BB_PORT_OUT, 'bubbled', 'output', { tag: 'List' as const, elem: TI })],
    }),
    // bsort module (repeat until stable)
    n('bst_mod',  'module',  300, 200, {
      kind: 'module', name: 'bsort', description: 'Bubble sort — repeat until stable',
      subgraphId: BST_SUBGRAPH,
      inputPorts:  [port(BST_PORT_IN,  'xs',     'input',  { tag: 'List' as const, elem: TI })],
      outputPorts: [port(BST_PORT_OUT, 'sorted', 'output', { tag: 'List' as const, elem: TI })],
      ports:       [port(BST_PORT_IN,  'xs',     'input',  { tag: 'List' as const, elem: TI }),
                    port(BST_PORT_OUT, 'sorted', 'output', { tag: 'List' as const, elem: TI })],
    }),
    n('bst_out',  'output',  540, 200, { kind: 'output', label: 'sorted', lastValue: null,
      ports: [port('value', 'value', 'input', { tag: 'List' as const, elem: TI })] }),
  ],
  edges: [
    e('bbe1', 'bb_list', 'result',     'bst_mod', BST_PORT_IN),
    e('bbe2', 'bst_mod', BST_PORT_OUT, 'bst_out', 'value'),
  ],
  subgraphs: {
    // ── bubble subgraph: one pass ─────────────────────────────────────────
    // bubble [] = []
    // bubble [x] = [x]
    // bubble (x:y:rest) = if x<=y then x : bubble(y:rest) else y : bubble(x:rest)
    //
    // Graph encoding:
    //   null xs → []  (base case 1)
    //   null (tail xs) → xs  (single element)
    //   else: x=head, y=head(tail), rest=tail(tail)
    //         if x<=y: x : bubble(y:rest)
    //         else:    y : bubble(x:rest)
    [BB_SUBGRAPH]: {
      nodes: [
        n(BB_ANC_IN,   'value', -140, 300, {
          kind: 'value', valueType: 'List', literal: '[]',
          ports: [port('result', 'xs', 'output', { tag: 'List' as const, elem: TI })],
          _modulePortId: BB_PORT_IN,
        } as any),

        // null xs
        n('bb_null',   'listop',  80, 100, { kind: 'listop', op: 'null',
          ports: [port('list', 'xs', 'input', { tag: 'List' as const, elem: TI }),
                  port('result', 'result', 'output', TB)] }),
        n('bb_emp',    'value',   80, 200, { kind: 'value', valueType: 'List', literal: '[]',
          ports: [port('result', 'value', 'output', { tag: 'List' as const, elem: TI })] }),

        // head xs = x,  tail xs = rest1
        n('bb_hx',     'listop', 280, 200, { kind: 'listop', op: 'head',
          ports: [port('list', 'xs', 'input', { tag: 'List' as const, elem: TI }),
                  port('result', 'result', 'output', TI)] }),
        n('bb_tx',     'listop', 280, 340, { kind: 'listop', op: 'tail',
          ports: [port('list', 'xs', 'input', { tag: 'List' as const, elem: TI }),
                  port('result', 'result', 'output', { tag: 'List' as const, elem: TI })] }),

        // null (tail xs)  — single element check
        n('bb_nt',     'listop', 480, 100, { kind: 'listop', op: 'null',
          ports: [port('list', 'xs', 'input', { tag: 'List' as const, elem: TI }),
                  port('result', 'result', 'output', TB)] }),

        // head(tail xs) = y,  tail(tail xs) = rest
        n('bb_hy',     'listop', 480, 280, { kind: 'listop', op: 'head',
          ports: [port('list', 'xs', 'input', { tag: 'List' as const, elem: TI }),
                  port('result', 'result', 'output', TI)] }),
        n('bb_trest',  'listop', 480, 420, { kind: 'listop', op: 'tail',
          ports: [port('list', 'xs', 'input', { tag: 'List' as const, elem: TI }),
                  port('result', 'result', 'output', { tag: 'List' as const, elem: TI })] }),

        // x <= y
        n('bb_le',     'primop', 680, 200, { kind: 'primop', op: '<=',
          ports: [port('arg0', 'x', 'input', TI), port('arg1', 'y', 'input', TI),
                  port('result', 'result', 'output', TB)] }),

        // y:rest → bubble(y:rest)
        n('bb_cons_yr','listop', 680, 340, { kind: 'listop', op: 'cons',
          ports: [port('elem', 'x', 'input', TI),
                  port('list', 'xs', 'input', { tag: 'List' as const, elem: TI }),
                  port('result', 'result', 'output', { tag: 'List' as const, elem: TI })] }),
        // x:rest → bubble(x:rest)
        n('bb_cons_xr','listop', 680, 500, { kind: 'listop', op: 'cons',
          ports: [port('elem', 'x', 'input', TI),
                  port('list', 'xs', 'input', { tag: 'List' as const, elem: TI }),
                  port('result', 'result', 'output', { tag: 'List' as const, elem: TI })] }),

        // bubble(y:rest)
        n('bb_rec_yr', 'call',   880, 300, {
          kind: 'call', targetName: 'bubble',
          ports: [port(BB_PORT_IN,  'xs',      'input',  { tag: 'List' as const, elem: TI }),
                  port(BB_PORT_OUT, 'bubbled', 'output', { tag: 'List' as const, elem: TI })],
        }),
        // bubble(x:rest)
        n('bb_rec_xr', 'call',   880, 480, {
          kind: 'call', targetName: 'bubble',
          ports: [port(BB_PORT_IN,  'xs',      'input',  { tag: 'List' as const, elem: TI }),
                  port(BB_PORT_OUT, 'bubbled', 'output', { tag: 'List' as const, elem: TI })],
        }),

        // x : bubble(y:rest)
        n('bb_cx',     'listop',1080, 300, { kind: 'listop', op: 'cons',
          ports: [port('elem', 'x', 'input', TI),
                  port('list', 'xs', 'input', { tag: 'List' as const, elem: TI }),
                  port('result', 'result', 'output', { tag: 'List' as const, elem: TI })] }),
        // y : bubble(x:rest)
        n('bb_cy',     'listop',1080, 480, { kind: 'listop', op: 'cons',
          ports: [port('elem', 'x', 'input', TI),
                  port('list', 'xs', 'input', { tag: 'List' as const, elem: TI }),
                  port('result', 'result', 'output', { tag: 'List' as const, elem: TI })] }),

        // if x<=y then (x:bubble(y:rest)) else (y:bubble(x:rest))
        n('bb_if2',    'if',    1260, 380, { kind: 'if',
          ports: [port('cond',   'if',   'input',  TB),
                  port('then',   'then', 'input',  { tag: 'List' as const, elem: TI }),
                  port('else',   'else', 'input',  { tag: 'List' as const, elem: TI }),
                  port('result', 'result', 'output', { tag: 'List' as const, elem: TI })] }),

        // if null(tail) then xs else if2
        n('bb_if1',    'if',    1440, 220, { kind: 'if',
          ports: [port('cond',   'if',   'input',  TB),
                  port('then',   'then', 'input',  { tag: 'List' as const, elem: TI }),
                  port('else',   'else', 'input',  { tag: 'List' as const, elem: TI }),
                  port('result', 'result', 'output', { tag: 'List' as const, elem: TI })] }),

        // if null xs then [] else if1
        n('bb_if0',    'if',    1620, 150, { kind: 'if',
          ports: [port('cond',   'if',   'input',  TB),
                  port('then',   'then', 'input',  { tag: 'List' as const, elem: TI }),
                  port('else',   'else', 'input',  { tag: 'List' as const, elem: TI }),
                  port('result', 'result', 'output', { tag: 'List' as const, elem: TI })] }),

        n(BB_ANC_OUT,  'output',1820, 150, {
          kind: 'output', label: 'bubbled', lastValue: null,
          ports: [port('value', 'value', 'input', { tag: 'List' as const, elem: TI })],
          _modulePortId: BB_PORT_OUT,
        } as any),
      ],
      edges: [
        // null xs
        e('bbi1',  BB_ANC_IN,   'result', 'bb_null',   'list'),
        // head/tail xs
        e('bbi2',  BB_ANC_IN,   'result', 'bb_hx',     'list'),
        e('bbi3',  BB_ANC_IN,   'result', 'bb_tx',     'list'),
        // null (tail xs)
        e('bbi4',  'bb_tx',     'result', 'bb_nt',     'list'),
        // head(tail)/tail(tail)
        e('bbi5',  'bb_tx',     'result', 'bb_hy',     'list'),
        e('bbi6',  'bb_tx',     'result', 'bb_trest',  'list'),
        // x <= y
        e('bbi7',  'bb_hx',     'result', 'bb_le',     'arg0'),
        e('bbi8',  'bb_hy',     'result', 'bb_le',     'arg1'),
        // y:rest and x:rest
        e('bbi9',  'bb_hy',     'result', 'bb_cons_yr','elem'),
        e('bbi10', 'bb_trest',  'result', 'bb_cons_yr','list'),
        e('bbi11', 'bb_hx',     'result', 'bb_cons_xr','elem'),
        e('bbi12', 'bb_trest',  'result', 'bb_cons_xr','list'),
        // bubble calls
        e('bbi13', 'bb_cons_yr','result', 'bb_rec_yr', BB_PORT_IN),
        e('bbi14', 'bb_cons_xr','result', 'bb_rec_xr', BB_PORT_IN),
        // x:bubble(y:rest) and y:bubble(x:rest)
        e('bbi15', 'bb_hx',     'result', 'bb_cx',     'elem'),
        e('bbi16', 'bb_rec_yr', BB_PORT_OUT, 'bb_cx',  'list'),
        e('bbi17', 'bb_hy',     'result', 'bb_cy',     'elem'),
        e('bbi18', 'bb_rec_xr', BB_PORT_OUT, 'bb_cy',  'list'),
        // if x<=y
        e('bbi19', 'bb_le',     'result', 'bb_if2',    'cond'),
        e('bbi20', 'bb_cx',     'result', 'bb_if2',    'then'),
        e('bbi21', 'bb_cy',     'result', 'bb_if2',    'else'),
        // if null(tail) then xs else if2
        e('bbi22', 'bb_nt',     'result', 'bb_if1',    'cond'),
        e('bbi23', BB_ANC_IN,   'result', 'bb_if1',    'then'),
        e('bbi24', 'bb_if2',    'result', 'bb_if1',    'else'),
        // if null xs then [] else if1
        e('bbi25', 'bb_null',   'result', 'bb_if0',    'cond'),
        e('bbi26', 'bb_emp',    'result', 'bb_if0',    'then'),
        e('bbi27', 'bb_if1',    'result', 'bb_if0',    'else'),
        // output
        e('bbi28', 'bb_if0',    'result', BB_ANC_OUT,  'value'),
      ],
    },

    // ── bsort subgraph: repeat bubble until stable ────────────────────────
    // bsort xs = if bubble(xs) == xs then xs else bsort(bubble(xs))
    [BST_SUBGRAPH]: {
      nodes: [
        n(BST_ANC_IN, 'value', -140, 200, {
          kind: 'value', valueType: 'List', literal: '[]',
          ports: [port('result', 'xs', 'output', { tag: 'List' as const, elem: TI })],
          _modulePortId: BST_PORT_IN,
        } as any),

        // bubble xs
        n('bst_bub',   'call',   80, 200, {
          kind: 'call', targetName: 'bubble',
          ports: [port(BB_PORT_IN,  'xs',      'input',  { tag: 'List' as const, elem: TI }),
                  port(BB_PORT_OUT, 'bubbled', 'output', { tag: 'List' as const, elem: TI })],
        }),

        // bubble(xs) == xs  (deep equality on int lists)
        n('bst_eq',    'primop', 340, 200, { kind: 'primop', op: '==',
          ports: [port('arg0', 'x', 'input', { tag: 'List' as const, elem: TI }),
                  port('arg1', 'y', 'input', { tag: 'List' as const, elem: TI }),
                  port('result', 'result', 'output', TB)] }),

        // bsort(bubble xs)
        n('bst_rec',   'call',   340, 360, {
          kind: 'call', targetName: 'bsort',
          ports: [port(BST_PORT_IN,  'xs',     'input',  { tag: 'List' as const, elem: TI }),
                  port(BST_PORT_OUT, 'sorted', 'output', { tag: 'List' as const, elem: TI })],
        }),

        // if stable then xs else bsort(bubble xs)
        n('bst_if',    'if',     600, 250, { kind: 'if',
          ports: [port('cond',   'if',   'input',  TB),
                  port('then',   'then', 'input',  { tag: 'List' as const, elem: TI }),
                  port('else',   'else', 'input',  { tag: 'List' as const, elem: TI }),
                  port('result', 'result', 'output', { tag: 'List' as const, elem: TI })] }),

        n(BST_ANC_OUT, 'output', 820, 250, {
          kind: 'output', label: 'sorted', lastValue: null,
          ports: [port('value', 'value', 'input', { tag: 'List' as const, elem: TI })],
          _modulePortId: BST_PORT_OUT,
        } as any),
      ],
      edges: [
        // bubble xs
        e('bsti1', BST_ANC_IN, 'result',    'bst_bub', BB_PORT_IN),
        // bubble(xs) == xs
        e('bsti2', 'bst_bub',  BB_PORT_OUT, 'bst_eq',  'arg0'),
        e('bsti3', BST_ANC_IN, 'result',    'bst_eq',  'arg1'),
        // bsort(bubble xs)
        e('bsti4', 'bst_bub',  BB_PORT_OUT, 'bst_rec', BST_PORT_IN),
        // if
        e('bsti5', 'bst_eq',   'result',    'bst_if',  'cond'),
        e('bsti6', BST_ANC_IN, 'result',    'bst_if',  'then'),
        e('bsti7', 'bst_rec',  BST_PORT_OUT,'bst_if',  'else'),
        // output
        e('bsti8', 'bst_if',   'result',    BST_ANC_OUT,'value'),
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
  ex_euler2,
  ex_euler3,
  ex_euler5,
  ex_factorial,
  ex_recursiveFactorial,
  ex_letBinding,
  ex_caesar,
  ex_binarySearch,
  ex_quicksort,
  ex_mergesort,
  ex_bubbleSort,
];
