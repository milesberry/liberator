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
    // mul with only arg0 connected → partial fn Int->Int
    e('e3', 'mul', 'result', 'mp',  'fn'),
    e('e4', 'rng', 'result', 'mp',  'list'),
    e('e5', 'mp',  'result', 'out', 'value'),
  ],
};

// ─── Example 4: filter even [1..10] ──────────────────────────────────────

const ex_filterEven: SavedGraph = {
  version: 1,
  name: 'filter even [1..10]',
  savedAt: '',
  nodes: [
    n('n', 'value', 80, 300, { kind: 'value', valueType: 'Int', literal: '10',
      ports: [port('result', 'value', 'output', TI)] }),
    n('rng', 'listop', 260, 300, { kind: 'listop', op: 'range',
      ports: [port('n', 'n', 'input', TI), port('result', 'result', 'output', TLI)] }),
    // even x = mod x 2 == 0  — built as: two → mod (partially applied) → == → 0
    n('two',  'value', 80,  80, { kind: 'value', valueType: 'Int', literal: '2',
      ports: [port('result', 'value', 'output', TI)] }),
    n('zero', 'value', 80,  180, { kind: 'value', valueType: 'Int', literal: '0',
      ports: [port('result', 'value', 'output', TI)] }),
    n('md',  'primop', 260, 80, { kind: 'primop', op: 'mod',
      ports: [port('arg0', 'x', 'input', TI), port('arg1', 'y', 'input', TI), port('result', 'result', 'output', TI)] }),
    n('eq',  'primop', 440, 130, { kind: 'primop', op: '==',
      ports: [port('arg0', 'x', 'input', TI), port('arg1', 'y', 'input', TI), port('result', 'result', 'output', TB)] }),
    n('flt', 'hof', 620, 230, { kind: 'hof', op: 'filter',
      ports: [port('fn', 'p', 'input', TFun(TI, TB)), port('list', 'xs', 'input', TLI), port('result', 'result', 'output', TLI)] }),
    n('out', 'output', 840, 230, { kind: 'output', label: 'even numbers', lastValue: null,
      ports: [port('value', 'value', 'input', TLI)] }),
  ],
  edges: [
    e('e1', 'n',    'result', 'rng', 'n'),
    e('e2', 'two',  'result', 'md',  'arg1'),   // mod _ 2  (arg0 unconnected → partial)
    e('e3', 'zero', 'result', 'eq',  'arg1'),   // == _ 0   (arg0 unconnected → partial)
    e('e4', 'md',   'result', 'eq',  'arg0'),   // (mod _ 2) applied to result of mod
    // eq with only arg1 connected is a partial fn  Int -> Bool  — the "even" predicate
    e('e5', 'eq',   'result', 'flt', 'fn'),
    e('e6', 'rng',  'result', 'flt', 'list'),
    e('e7', 'flt',  'result', 'out', 'value'),
  ],
};

// ─── Example 5: Project Euler #1 — multiples of 3 or 5 below 1000 ─────────
// sum (filter (\x -> x `mod` 3 == 0 || x `mod` 5 == 0) [1..999])

const ex_euler1: SavedGraph = {
  version: 1,
  name: 'Project Euler #1 — multiples of 3 or 5',
  savedAt: '',
  nodes: [
    // range 999
    n('n999',  'value',   60, 400, { kind: 'value', valueType: 'Int', literal: '999',
      ports: [port('result', 'value', 'output', TI)] }),
    n('rng',   'listop', 240, 400, { kind: 'listop', op: 'range',
      ports: [port('n', 'n', 'input', TI), port('result', 'result', 'output', TLI)] }),
    // divisible-by-3 predicate: mod _ 3 == 0
    n('t3',    'value',   60, 100, { kind: 'value', valueType: 'Int', literal: '3',
      ports: [port('result', 'value', 'output', TI)] }),
    n('mod3',  'primop', 240, 100, { kind: 'primop', op: 'mod',
      ports: [port('arg0', 'x', 'input', TI), port('arg1', 'y', 'input', TI), port('result', 'result', 'output', TI)] }),
    n('z1',    'value',   60, 190, { kind: 'value', valueType: 'Int', literal: '0',
      ports: [port('result', 'value', 'output', TI)] }),
    n('eq3',   'primop', 420, 100, { kind: 'primop', op: '==',
      ports: [port('arg0', 'x', 'input', TI), port('arg1', 'y', 'input', TI), port('result', 'result', 'output', TB)] }),
    // divisible-by-5 predicate: mod _ 5 == 0
    n('t5',    'value',   60, 280, { kind: 'value', valueType: 'Int', literal: '5',
      ports: [port('result', 'value', 'output', TI)] }),
    n('mod5',  'primop', 240, 260, { kind: 'primop', op: 'mod',
      ports: [port('arg0', 'x', 'input', TI), port('arg1', 'y', 'input', TI), port('result', 'result', 'output', TI)] }),
    n('z2',    'value',   60, 340, { kind: 'value', valueType: 'Int', literal: '0',
      ports: [port('result', 'value', 'output', TI)] }),
    n('eq5',   'primop', 420, 260, { kind: 'primop', op: '==',
      ports: [port('arg0', 'x', 'input', TI), port('arg1', 'y', 'input', TI), port('result', 'result', 'output', TB)] }),
    // or the two predicates
    n('or1',   'primop', 600, 180, { kind: 'primop', op: '||',
      ports: [port('arg0', 'p', 'input', TB), port('arg1', 'q', 'input', TB), port('result', 'result', 'output', TB)] }),
    // filter then sum
    n('flt',   'hof',   780, 300, { kind: 'hof', op: 'filter',
      ports: [port('fn', 'p', 'input', TFun(TI, TB)), port('list', 'xs', 'input', TLI), port('result', 'result', 'output', TLI)] }),
    n('sm',    'listop', 980, 300, { kind: 'listop', op: 'sum',
      ports: [port('list', 'xs', 'input', TLI), port('result', 'result', 'output', TI)] }),
    n('out',   'output', 1180, 300, { kind: 'output', label: 'Euler #1 answer', lastValue: null,
      ports: [port('value', 'value', 'input', TI)] }),
  ],
  edges: [
    e('e1',  'n999', 'result', 'rng',  'n'),
    e('e2',  't3',   'result', 'mod3', 'arg1'),
    e('e3',  'z1',   'result', 'eq3',  'arg1'),
    e('e4',  'mod3', 'result', 'eq3',  'arg0'),
    e('e5',  't5',   'result', 'mod5', 'arg1'),
    e('e6',  'z2',   'result', 'eq5',  'arg1'),
    e('e7',  'mod5', 'result', 'eq5',  'arg0'),
    e('e8',  'eq3',  'result', 'or1',  'arg0'),
    e('e9',  'eq5',  'result', 'or1',  'arg1'),
    e('e10', 'or1',  'result', 'flt',  'fn'),
    e('e11', 'rng',  'result', 'flt',  'list'),
    e('e12', 'flt',  'result', 'sm',   'list'),
    e('e13', 'sm',   'result', 'out',  'value'),
  ],
};

// ─── Example 6: foldr to sum (shows HOF composition) ─────────────────────

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
    e('e2', 'add',  'result', 'fr',  'fn'),    // bare (+) is Int->Int->Int
    e('e3', 'zero', 'result', 'fr',  'init'),
    e('e4', 'rng',  'result', 'fr',  'list'),
    e('e5', 'fr',   'result', 'out', 'value'),
  ],
};

// ─── Registry ─────────────────────────────────────────────────────────────

export const EXAMPLES: SavedGraph[] = [
  ex_arithmetic,
  ex_sumRange,
  ex_mapDouble,
  ex_filterEven,
  ex_foldrSum,
  ex_euler1,
];
