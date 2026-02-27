// ─── Evaluator ────────────────────────────────────────────────────────────
// Reduces an ExprTree to a HaskellValue.
// Includes a step budget to prevent infinite recursion from hanging the tab.

import type { ExprTree } from './toExprTree';
import type { HaskellValue } from '../types/values';
import { VFun, VError, VBottom, showValue } from '../types/values';
import { builtins } from './builtins';

type Env = Map<string, HaskellValue>;

const MAX_STEPS = 50_000;

export function evaluate(expr: ExprTree, env: Env = new Map(), steps = { n: 0 }): HaskellValue {
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
      return VFun(arg => evaluate(expr.body, new Map([...closedEnv, [expr.param, arg]]), steps));
    }

    case 'App': {
      const fn  = evaluate(expr.fn,  env, steps);
      if (fn.tag  === 'VError') return fn;
      if (fn.tag  === 'VBottom') return VBottom;
      const arg = evaluate(expr.arg, env, steps);
      if (arg.tag === 'VError') return arg;
      if (arg.tag === 'VBottom') return VBottom;
      if (fn.tag !== 'VFun') return VError(`Applied non-function: ${showValue(fn)}`);
      return fn.fn(arg);
    }

    case 'If': {
      const cond = evaluate(expr.cond, env, steps);
      if (cond.tag === 'VError')  return cond;
      if (cond.tag === 'VBottom') return VBottom;
      if (cond.tag !== 'VBool')   return VError(`if: condition must be Bool, got ${showValue(cond)}`);
      return evaluate(cond.value ? expr.thenE : expr.elseE, env, steps);
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
      const recEnv = new Map([
        ...env,
        [expr.name, VFun(arg => {
          if (cell.val.tag !== 'VFun') return VError(`Letrec "${expr.name}": not a function`);
          return cell.val.fn(arg);
        })],
      ]);
      cell.val = evaluate(expr.body, recEnv, steps);
      return cell.val;
    }
  }
}
