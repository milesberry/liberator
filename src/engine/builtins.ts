// ─── Built-in functions ────────────────────────────────────────────────────
// Every builtin is a curried HaskellValue so the evaluator can apply them
// one argument at a time, enabling partial application naturally.

import { VInt, VFloat, VBool, VString, VList, VFun, VError, showValue, toNumber, isNumeric } from '../types/values';
import type { HaskellValue } from '../types/values';

// ─── Helpers ───────────────────────────────────────────────────────────────

const numOp = (
  op: (a: number, b: number) => number,
  intOnly = false,
) => VFun(a => VFun(b => {
  if (!isNumeric(a) || !isNumeric(b)) return VError(`Expected numbers, got ${showValue(a)} and ${showValue(b)}`);
  if (intOnly) {
    if (a.tag !== 'VInt' || b.tag !== 'VInt') return VError('Expected Int');
    return VInt(op(a.value, b.value) | 0); // |0 truncates to Int
  }
  const result = op(toNumber(a), toNumber(b));
  return (a.tag === 'VFloat' || b.tag === 'VFloat') ? VFloat(result) : VInt(result);
}));

const cmpOp = (op: (a: number | string | boolean, b: number | string | boolean) => boolean) =>
  VFun(a => VFun(b => {
    const av = a.tag === 'VInt' || a.tag === 'VFloat' ? a.value
             : a.tag === 'VBool' ? a.value
             : a.tag === 'VString' ? a.value : null;
    const bv = b.tag === 'VInt' || b.tag === 'VFloat' ? b.value
             : b.tag === 'VBool' ? b.value
             : b.tag === 'VString' ? b.value : null;
    if (av === null || bv === null) return VError(`Cannot compare ${showValue(a)} and ${showValue(b)}`);
    return VBool(op(av, bv));
  }));

// Deep equality for == and /=
function deepEq(a: HaskellValue, b: HaskellValue): boolean {
  if (a.tag !== b.tag) return false;
  switch (a.tag) {
    case 'VInt':    return a.value === (b as typeof a).value;
    case 'VFloat':  return a.value === (b as typeof a).value;
    case 'VBool':   return a.value === (b as typeof a).value;
    case 'VString': return a.value === (b as typeof a).value;
    case 'VList':   return a.elements.length === (b as typeof a).elements.length
                        && a.elements.every((e, i) => deepEq(e, (b as typeof a).elements[i]));
    default: return false;
  }
}

// ─── The builtins map ─────────────────────────────────────────────────────

export const builtins: Record<string, HaskellValue> = {
  // Arithmetic
  '+':      numOp((a, b) => a + b),
  '-':      numOp((a, b) => a - b),
  '*':      numOp((a, b) => a * b),
  'div':    VFun(a => VFun(b => {
    if (a.tag !== 'VInt' || b.tag !== 'VInt') return VError('div requires Int');
    if (b.value === 0) return VError('divide by zero');
    return VInt(Math.floor(a.value / b.value));
  })),
  'mod':    VFun(a => VFun(b => {
    if (a.tag !== 'VInt' || b.tag !== 'VInt') return VError('mod requires Int');
    if (b.value === 0) return VError('mod by zero');
    // Haskell mod matches sign of divisor
    const r = a.value % b.value;
    return VInt(r < 0 && b.value > 0 ? r + b.value : r > 0 && b.value < 0 ? r + b.value : r);
  })),
  'negate': VFun(a => isNumeric(a) ? (a.tag === 'VFloat' ? VFloat(-a.value) : VInt(-a.value)) : VError('negate: not a number')),
  'abs':    VFun(a => isNumeric(a) ? (a.tag === 'VFloat' ? VFloat(Math.abs(a.value)) : VInt(Math.abs(a.value))) : VError('abs: not a number')),

  // Comparison
  '==':  VFun(a => VFun(b => VBool(deepEq(a, b)))),
  '/=':  VFun(a => VFun(b => VBool(!deepEq(a, b)))),
  '<':   cmpOp((a, b) => a < b),
  '>':   cmpOp((a, b) => a > b),
  '<=':  cmpOp((a, b) => a <= b),
  '>=':  cmpOp((a, b) => a >= b),

  // Logic
  '&&':  VFun(a => VFun(b => {
    if (a.tag !== 'VBool' || b.tag !== 'VBool') return VError('(&&) requires Bool');
    return VBool(a.value && b.value);
  })),
  '||':  VFun(a => VFun(b => {
    if (a.tag !== 'VBool' || b.tag !== 'VBool') return VError('(||) requires Bool');
    return VBool(a.value || b.value);
  })),
  'not': VFun(a => a.tag === 'VBool' ? VBool(!a.value) : VError('not: expected Bool')),

  // List operations
  'head': VFun(xs => {
    if (xs.tag !== 'VList') return VError('head: not a list');
    if (xs.elements.length === 0) return VError('head: empty list');
    return xs.elements[0];
  }),
  'tail': VFun(xs => {
    if (xs.tag !== 'VList') return VError('tail: not a list');
    if (xs.elements.length === 0) return VError('tail: empty list');
    return VList(xs.elements.slice(1));
  }),
  'cons': VFun(x => VFun(xs => {
    if (xs.tag !== 'VList') return VError('cons: second arg must be a list');
    return VList([x, ...xs.elements]);
  })),
  'null': VFun(xs => {
    if (xs.tag !== 'VList') return VError('null: not a list');
    return VBool(xs.elements.length === 0);
  }),
  'length': VFun(xs => {
    if (xs.tag !== 'VList') return VError('length: not a list');
    return VInt(xs.elements.length);
  }),
  '++': VFun(xs => VFun(ys => {
    if (xs.tag !== 'VList' || ys.tag !== 'VList') return VError('(++): both args must be lists');
    return VList([...xs.elements, ...ys.elements]);
  })),
  'reverse': VFun(xs => {
    if (xs.tag !== 'VList') return VError('reverse: not a list');
    return VList([...xs.elements].reverse());
  }),
  'take': VFun(n => VFun(xs => {
    if (n.tag !== 'VInt') return VError('take: first arg must be Int');
    if (xs.tag !== 'VList') return VError('take: second arg must be a list');
    return VList(xs.elements.slice(0, n.value));
  })),
  'drop': VFun(n => VFun(xs => {
    if (n.tag !== 'VInt') return VError('drop: first arg must be Int');
    if (xs.tag !== 'VList') return VError('drop: second arg must be a list');
    return VList(xs.elements.slice(n.value));
  })),
  'elem': VFun(x => VFun(xs => {
    if (xs.tag !== 'VList') return VError('elem: second arg must be a list');
    return VBool(xs.elements.some(e => deepEq(e, x)));
  })),
  'last': VFun(xs => {
    if (xs.tag !== 'VList') return VError('last: not a list');
    if (xs.elements.length === 0) return VError('last: empty list');
    return xs.elements[xs.elements.length - 1];
  }),
  'init': VFun(xs => {
    if (xs.tag !== 'VList') return VError('init: not a list');
    if (xs.elements.length === 0) return VError('init: empty list');
    return VList(xs.elements.slice(0, -1));
  }),

  // Higher-order functions
  'map': VFun(f => VFun(xs => {
    if (f.tag !== 'VFun') return VError('map: first arg must be a function');
    if (xs.tag !== 'VList') return VError('map: second arg must be a list');
    const results = xs.elements.map(x => f.fn(x));
    const err = results.find(r => r.tag === 'VError');
    return err ?? VList(results);
  })),
  'filter': VFun(p => VFun(xs => {
    if (p.tag !== 'VFun') return VError('filter: first arg must be a function');
    if (xs.tag !== 'VList') return VError('filter: second arg must be a list');
    const kept: HaskellValue[] = [];
    for (const x of xs.elements) {
      const test = p.fn(x);
      if (test.tag === 'VError') return test;
      if (test.tag !== 'VBool') return VError('filter: predicate must return Bool');
      if (test.value) kept.push(x);
    }
    return VList(kept);
  })),
  'foldr': VFun(f => VFun(z => VFun(xs => {
    if (f.tag !== 'VFun') return VError('foldr: first arg must be a function');
    if (xs.tag !== 'VList') return VError('foldr: third arg must be a list');
    let acc = z;
    for (let i = xs.elements.length - 1; i >= 0; i--) {
      const step = f.fn(xs.elements[i]);
      if (step.tag === 'VError') return step;
      if (step.tag !== 'VFun') return VError('foldr: function must be curried (a -> b -> b)');
      acc = step.fn(acc);
      if (acc.tag === 'VError') return acc;
    }
    return acc;
  }))),
  'foldl': VFun(f => VFun(z => VFun(xs => {
    if (f.tag !== 'VFun') return VError('foldl: first arg must be a function');
    if (xs.tag !== 'VList') return VError('foldl: third arg must be a list');
    let acc = z;
    for (const x of xs.elements) {
      const step = f.fn(acc);
      if (step.tag === 'VError') return step;
      if (step.tag !== 'VFun') return VError('foldl: function must be curried (b -> a -> b)');
      acc = step.fn(x);
      if (acc.tag === 'VError') return acc;
    }
    return acc;
  }))),
  'zipWith': VFun(f => VFun(xs => VFun(ys => {
    if (f.tag !== 'VFun') return VError('zipWith: first arg must be a function');
    if (xs.tag !== 'VList' || ys.tag !== 'VList') return VError('zipWith: args 2 and 3 must be lists');
    const len = Math.min(xs.elements.length, ys.elements.length);
    const results: HaskellValue[] = [];
    for (let i = 0; i < len; i++) {
      const step = f.fn(xs.elements[i]);
      if (step.tag === 'VError') return step;
      if (step.tag !== 'VFun') return VError('zipWith: function must be curried');
      const r = step.fn(ys.elements[i]);
      if (r.tag === 'VError') return r;
      results.push(r);
    }
    return VList(results);
  }))),

  // Extra utilities useful for Project Euler
  'sum':     VFun(xs => {
    if (xs.tag !== 'VList') return VError('sum: not a list');
    if (xs.elements.length === 0) return VInt(0);
    const hasFloat = xs.elements.some(e => e.tag === 'VFloat');
    const total = xs.elements.reduce((acc, e) => {
      if (!isNumeric(e)) return NaN;
      return acc + e.value;
    }, 0);
    return isNaN(total) ? VError('sum: non-numeric element') : hasFloat ? VFloat(total) : VInt(total);
  }),
  'product': VFun(xs => {
    if (xs.tag !== 'VList') return VError('product: not a list');
    if (xs.elements.length === 0) return VInt(1);
    const hasFloat = xs.elements.some(e => e.tag === 'VFloat');
    const total = xs.elements.reduce((acc, e) => {
      if (!isNumeric(e)) return NaN;
      return acc * e.value;
    }, 1);
    return isNaN(total) ? VError('product: non-numeric element') : hasFloat ? VFloat(total) : VInt(total);
  }),
  'maximum': VFun(xs => {
    if (xs.tag !== 'VList' || xs.elements.length === 0) return VError('maximum: empty list');
    return xs.elements.reduce((a, b) => {
      if (!isNumeric(a) || !isNumeric(b)) return VError('maximum: non-numeric');
      return a.value >= b.value ? a : b;
    });
  }),
  'minimum': VFun(xs => {
    if (xs.tag !== 'VList' || xs.elements.length === 0) return VError('minimum: empty list');
    return xs.elements.reduce((a, b) => {
      if (!isNumeric(a) || !isNumeric(b)) return VError('minimum: non-numeric');
      return a.value <= b.value ? a : b;
    });
  }),
};
