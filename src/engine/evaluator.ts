// ─── Evaluator ────────────────────────────────────────────────────────────
// Reduces an ExprTree to a HaskellValue.
// Includes a step budget to prevent infinite recursion from hanging the tab.

import type { ExprTree } from './toExprTree';
import type { HaskellValue } from '../types/values';
import { VError, VBottom, VList, showValue } from '../types/values';
import { builtins } from './builtins';

type Env = Map<string, HaskellValue>;

const MAX_STEPS = 50_000;

// A recursive function such as lpf n d, which calls itself as the very last
// thing it does, would otherwise nest one JavaScript call per step and run out
// of stack after a few thousand. Calls in tail position (the branches of an if,
// the body of a function, a case alternative) therefore loop instead of
// recursing. Recursion that isn't in tail position (n * fact (n - 1)) still
// nests; evaluateSafely turns running out of stack into a readable error.
export function evaluate(expr: ExprTree, env: Env = new Map(), steps = { n: 0 }): HaskellValue {
  for (;;) {
    steps.n++;
    if (steps.n > MAX_STEPS) return VBottom;

    switch (expr.tag) {
      case 'Lit':
        return expr.value;

      case 'Builtin': {
        const b = builtins[expr.name];
        return b ?? VError(`Unknown builtin: ${expr.name}`);
      }

      case 'Var': {
        const v = env.get(expr.name);
        return v ?? VError(`Unbound variable: ${expr.name}`);
      }

      case 'Err':
        return VError(expr.message);

      case 'Lam': {
        // Capture current env in closure
        const closedEnv = new Map(env);
        const body = expr.body, param = expr.param;
        const bind = (arg: HaskellValue) => new Map([...closedEnv, [param, arg]]);
        return {
          tag: 'VFun',
          fn: arg => evaluate(body, bind(arg), steps),
          tail: arg => ({ expr: body, env: bind(arg) }),
        };
      }

      case 'App': {
        const fn  = evaluate(expr.fn,  env, steps);
        if (fn.tag  === 'VError') return fn;
        if (fn.tag  === 'VBottom') return VBottom;
        const arg = evaluate(expr.arg, env, steps);
        if (arg.tag === 'VError') return arg;
        if (arg.tag === 'VBottom') return VBottom;
        if (fn.tag !== 'VFun') return VError(`Applied non-function: ${showValue(fn)}`);
        // Tail call: carry on with the function's body here rather than nesting
        let f: HaskellValue = fn;
        while (f.tag === 'VFun' && f.deref) f = f.deref();
        if (f.tag === 'VFun' && f.tail) {
          const next = f.tail(arg);
          expr = next.expr as ExprTree;
          env = next.env;
          continue;
        }
        return fn.fn(arg);
      }

      case 'If': {
        const cond = evaluate(expr.cond, env, steps);
        if (cond.tag === 'VError')  return cond;
        if (cond.tag === 'VBottom') return VBottom;
        if (cond.tag !== 'VBool')   return VError(`if: condition must be Bool, got ${showValue(cond)}`);
        expr = cond.value ? expr.thenE : expr.elseE;
        continue;
      }

      case 'PartialApp': {
        // Apply as many connected args as we have; wrap remaining in VFun
        const fn = evaluate(expr.fn, env, steps);
        if (fn.tag === 'VError' || fn.tag === 'VBottom') return fn;

        let current: HaskellValue = fn;
        for (const arg of expr.args) {
          if (arg === null) {
            // Remaining args: return current as a partial function
            return current;
          }
          const argVal = evaluate(arg, env, steps);
          if (argVal.tag === 'VError' || argVal.tag === 'VBottom') return argVal;
          if (current.tag !== 'VFun') return VError(`Too many arguments: ${showValue(current)} is not a function`);
          current = current.fn(argVal);
        }
        return current;
      }

      case 'Letrec': {
        // Recursive binding: bind name to a self-referential closure.
        // Uses a mutable cell so the closure can refer to itself before
        // its own value is fully computed — i.e. the JS-level fixed point.
        // Safety: the existing MAX_STEPS budget prevents infinite loops.
        const cell: { val: HaskellValue } = { val: VBottom };
        const name = expr.name;
        const recEnv = new Map([
          ...env,
          [name, {
            tag: 'VFun' as const,
            fn: (arg: HaskellValue) => {
              if (cell.val.tag !== 'VFun') return VError(`Letrec "${name}": not a function`);
              return cell.val.fn(arg);
            },
            // Lets a call to the name loop as a tail call, like the function itself
            deref: () => cell.val,
          }],
        ]);
        cell.val = evaluate(expr.body, recEnv, steps);
        return cell.val;
      }

      case 'CaseList': {
        // case xs of { [] -> nilCase; (headVar:tailVar) -> consCase }
        const xs = evaluate(expr.scrutinee, env, steps);
        if (xs.tag === 'VError')  return xs;
        if (xs.tag === 'VBottom') return VBottom;
        if (xs.tag !== 'VList') return VError(`case: expected a list, got ${showValue(xs)}`);
        if (xs.elements.length === 0) {
          expr = expr.nilCase;
          continue;
        }
        const consEnv = new Map(env);
        consEnv.set(expr.headVar, xs.elements[0]);
        consEnv.set(expr.tailVar, VList(xs.elements.slice(1)));
        expr = expr.consCase;
        env = consEnv;
        continue;
      }
    }
  }
}

// evaluate, but running out of JavaScript stack (deep recursion that isn't a
// tail call) gives an explanation rather than a crash
export function evaluateSafely(expr: ExprTree, env: Env = new Map()): HaskellValue {
  try {
    return evaluate(expr, env);
  } catch (e) {
    if (e instanceof RangeError) {
      return VError('the recursion went too deep for the browser. Each call waits for the next ' +
        'one to finish, and they ran out of room; try a smaller input');
    }
    throw e;
  }
}
