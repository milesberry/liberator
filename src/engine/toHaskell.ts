// ─── Graph → Haskell source ────────────────────────────────────────────────
// Converts the Liberator graph into syntactically valid Haskell source that
// can be pasted into GHCi or a .hs file.
//
// Strategy:
//  1. Build ExprTree via existing buildOutputExprs()
//  2. Collect Letrec nodes (= Module/named functions) → top-level definitions
//  3. Detect which custom builtins are used → prepend helper defs
//  4. Detect required imports (Data.Char, Data.List)
//  5. Pretty-print each output expression into main

import type { LibNode } from '../types/nodes';
import type { CommentNodeData } from '../types/nodes';
import type { LibEdge } from '../types/edges';
import type { SubgraphState } from '../store/graphStore';
import type { ExprTree } from './toExprTree';
import { buildOutputExprs } from './toExprTree';
import type { HaskellValue } from '../types/values';

// ─── Infix operators ───────────────────────────────────────────────────────
// Maps builtin name → { display symbol, precedence }
// Precedence mirrors standard Haskell fixity (approx).

interface InfixInfo { sym: string; prec: number; rightAssoc?: boolean }

const INFIX_OPS: Record<string, InfixInfo> = {
  '+':    { sym: '+',      prec: 6 },
  '-':    { sym: '-',      prec: 6 },
  '*':    { sym: '*',      prec: 7 },
  '/':    { sym: '/',      prec: 7 },
  'div':  { sym: '`div`',  prec: 7 },
  'mod':  { sym: '`mod`',  prec: 7 },
  '==':   { sym: '==',     prec: 4 },
  '/=':   { sym: '/=',     prec: 4 },
  '<':    { sym: '<',      prec: 4 },
  '>':    { sym: '>',      prec: 4 },
  '<=':   { sym: '<=',     prec: 4 },
  '>=':   { sym: '>=',     prec: 4 },
  '&&':   { sym: '&&',     prec: 3, rightAssoc: true },
  '||':   { sym: '||',     prec: 2, rightAssoc: true },
  '++':   { sym: '++',     prec: 5, rightAssoc: true },
  'cons': { sym: ':',      prec: 5, rightAssoc: true },
  'elem': { sym: '`elem`', prec: 4 },
};

// Builtins that render as prefix operator sections when partially applied
// e.g. (+) (*2) etc.
const OPERATOR_SYMS = new Set(['+','-','*','/','==','/=','<','>','<=','>=','&&','||','++']);

// ─── Custom builtins not in standard Haskell ──────────────────────────────

interface CustomBuiltin {
  helper: string;   // Haskell source for the helper definition
  needsOrd?: boolean;   // requires import Data.Char (ord, chr)
}

const CUSTOM_BUILTINS: Record<string, CustomBuiltin> = {
  range: {
    helper: 'range :: Int -> [Int]\nrange n = [1..n]',
  },
  strLength: {
    helper: 'strLength :: String -> Int\nstrLength = length',
  },
  strReverse: {
    helper: 'strReverse :: String -> String\nstrReverse = reverse',
  },
  strConcat: {
    helper: 'strConcat :: String -> String -> String\nstrConcat a b = a ++ b',
  },
  strToChars: {
    helper: 'strToChars :: String -> [Int]\nstrToChars s = map ord s',
    needsOrd: true,
  },
  charsToStr: {
    helper: 'charsToStr :: [Int] -> String\ncharsToStr ns = map chr ns',
    needsOrd: true,
  },
};

// ─── Var name sanitisation ─────────────────────────────────────────────────
// Internal param names look like __fn_factorial_in_abc123 or __p0.
// Strip the __fn_<name>_ prefix and use the port label part, or fall back to p0/p1.

function sanitiseVar(name: string): string {
  // __p0 __p1 etc. (from buildPartialExpr / PartialApp holes)
  if (name.startsWith('__p')) return name.slice(2); // p0, p1, …
  // All other names are already valid Haskell identifiers (labelToParamName
  // guarantees this for module parameters; builtins/user vars are already clean)
  return name;
}

// ─── Literal pretty-printer ───────────────────────────────────────────────

function ppLit(v: HaskellValue): string {
  switch (v.tag) {
    case 'VInt':    return v.value.toString();
    case 'VFloat': {
      // Ensure at least one decimal point so Haskell treats it as Float
      const s = v.value.toString();
      return s.includes('.') ? s : s + '.0';
    }
    case 'VBool':   return v.value ? 'True' : 'False';
    case 'VString': return JSON.stringify(v.value); // adds surrounding quotes + escaping
    case 'VList':
      return `[${v.elements.map(ppLit).join(', ')}]`;
    case 'VTuple':
      return `(${v.elements.map(ppLit).join(', ')})`;
    case 'VFun':    return '(\\_ -> undefined)';
    case 'VError':  return `undefined {- ${v.message} -}`;
    case 'VBottom': return 'undefined {- ⊥ -}';
  }
}

// ─── Collect Letrec bindings ──────────────────────────────────────────────
// Walk tree and return all unique Letrec { name, body } encountered.

function collectLetrecs(expr: ExprTree, seen: Set<string> = new Set()): Array<{ name: string; body: ExprTree }> {
  switch (expr.tag) {
    case 'Letrec': {
      const result: Array<{ name: string; body: ExprTree }> = [];
      if (!seen.has(expr.name)) {
        seen.add(expr.name);
        result.push({ name: expr.name, body: expr.body });
        // Also collect any nested letrecs inside the body
        result.push(...collectLetrecs(expr.body, seen));
      }
      return result;
    }
    case 'App':      return [...collectLetrecs(expr.fn, seen), ...collectLetrecs(expr.arg, seen)];
    case 'Lam':      return collectLetrecs(expr.body, seen);
    case 'If':       return [...collectLetrecs(expr.cond, seen), ...collectLetrecs(expr.thenE, seen), ...collectLetrecs(expr.elseE, seen)];
    case 'PartialApp': return expr.args.flatMap(a => a ? collectLetrecs(a, seen) : []);
    case 'CaseList': return [
      ...collectLetrecs(expr.scrutinee, seen),
      ...collectLetrecs(expr.nilCase, seen),
      ...collectLetrecs(expr.consCase, seen),
    ];
    default:         return [];
  }
}

// ─── Collect used builtin names ───────────────────────────────────────────

function collectBuiltins(expr: ExprTree, acc: Set<string> = new Set()): Set<string> {
  switch (expr.tag) {
    case 'Builtin':  acc.add(expr.name); break;
    case 'App':      collectBuiltins(expr.fn, acc); collectBuiltins(expr.arg, acc); break;
    case 'Lam':      collectBuiltins(expr.body, acc); break;
    case 'If':       collectBuiltins(expr.cond, acc); collectBuiltins(expr.thenE, acc); collectBuiltins(expr.elseE, acc); break;
    case 'Letrec':   collectBuiltins(expr.body, acc); break;
    case 'PartialApp': expr.args.forEach(a => a && collectBuiltins(a, acc)); break;
    case 'CaseList': collectBuiltins(expr.scrutinee, acc); collectBuiltins(expr.nilCase, acc); collectBuiltins(expr.consCase, acc); break;
    default: break;
  }
  return acc;
}

// ─── Main pretty-printer ──────────────────────────────────────────────────
// prec: minimum precedence at call site — wrap in parens if our prec is lower.

function ppExpr(expr: ExprTree, prec: number, letrecNames: Set<string>): string {
  switch (expr.tag) {
    case 'Lit':
      return ppLit(expr.value);

    case 'Err':
      return `undefined {- ${expr.message} -}`;

    case 'Var':
      return sanitiseVar(expr.name);

    case 'Builtin': {
      const name = expr.name;
      // Operators become sections: (+), (*), etc.
      if (OPERATOR_SYMS.has(name)) return `(${name})`;
      return name;
    }

    case 'Lam': {
      // Collapse nested lambdas: \x y z -> body
      const params: string[] = [];
      let cur: ExprTree = expr;
      while (cur.tag === 'Lam') {
        params.push(sanitiseVar(cur.param));
        cur = cur.body;
      }
      const body = ppExpr(cur, 0, letrecNames);
      const s = `\\${params.join(' ')} -> ${body}`;
      return prec > 0 ? `(${s})` : s;
    }

    case 'If': {
      const c = ppExpr(expr.cond,  0, letrecNames);
      const t = ppExpr(expr.thenE, 0, letrecNames);
      const e = ppExpr(expr.elseE, 0, letrecNames);
      const s = `if ${c} then ${t} else ${e}`;
      return prec > 1 ? `(${s})` : s;
    }

    case 'App': {
      // ── Detect let-desugaring: App(Lam(x, body), val) ──────────────────
      if (expr.fn.tag === 'Lam' && !letrecNames.has('')) {
        const lam = expr.fn;
        const varName = sanitiseVar(lam.param);
        const val  = ppExpr(expr.arg,  0, letrecNames);
        const body = ppExpr(lam.body, 0, letrecNames);
        const s = `let ${varName} = ${val} in ${body}`;
        return prec > 1 ? `(${s})` : s;
      }

      // ── Detect infix: App(App(Builtin(op), left), right) ────────────────
      if (expr.fn.tag === 'App' && expr.fn.fn.tag === 'Builtin') {
        const opName = expr.fn.fn.name;
        const info = INFIX_OPS[opName];
        if (info) {
          const leftPrec  = info.rightAssoc ? info.prec + 1 : info.prec;
          const rightPrec = info.rightAssoc ? info.prec     : info.prec + 1;
          const left  = ppExpr(expr.fn.arg, leftPrec,  letrecNames);
          const right = ppExpr(expr.arg,    rightPrec, letrecNames);
          const s = `${left} ${info.sym} ${right}`;
          return prec > info.prec ? `(${s})` : s;
        }
      }

      // ── Detect negate (unary minus) ─────────────────────────────────────
      if (expr.fn.tag === 'Builtin' && expr.fn.name === 'negate') {
        const arg = ppExpr(expr.arg, 7, letrecNames);
        const s = `negate ${arg}`;
        return prec >= 10 ? `(${s})` : s;
      }

      // ── Letrec at call site: just use the function name ─────────────────
      if (expr.fn.tag === 'Letrec') {
        const fnName = expr.fn.name;
        const arg = ppExpr(expr.arg, 10, letrecNames);
        const s = `${fnName} ${arg}`;
        return prec >= 10 ? `(${s})` : s;
      }

      // ── Regular application ──────────────────────────────────────────────
      const fn  = ppExpr(expr.fn,  9,  letrecNames);
      const arg = ppExpr(expr.arg, 10, letrecNames);
      const s = `${fn} ${arg}`;
      return prec >= 10 ? `(${s})` : s;
    }

    case 'Letrec': {
      // At an inline Letrec site (after top-level extraction), just use the name
      return expr.name;
    }

    case 'PartialApp': {
      // Reconstruct: partially applied builtin with some holes filled
      // Rebuild as a lambda over the null slots
      const params: string[] = expr.args.map((a, i) => a === null ? `p${i}` : '');
      let result: string = ppExpr(expr.fn, 9, letrecNames);
      expr.args.forEach((a, i) => {
        const argStr = a !== null ? ppExpr(a, 10, letrecNames) : params[i];
        result = `${result} ${argStr}`;
      });
      const nullParams = params.filter(Boolean);
      if (nullParams.length > 0) {
        const s = `\\${nullParams.join(' ')} -> ${result}`;
        return prec > 0 ? `(${s})` : s;
      }
      return prec >= 10 ? `(${result})` : result;
    }

    case 'CaseList': {
      // Emit: case <scrutinee> of { [] -> <nil>; (<h>:<t>) -> <cons> }
      // Using explicit braces/semicolons so the expression is valid whether
      // it appears inline (e.g. inside `print (...)`) or at the top level.
      const scr  = ppExpr(expr.scrutinee, 0, letrecNames);
      const nil  = ppExpr(expr.nilCase,   0, letrecNames);
      const cons = ppExpr(expr.consCase,  0, letrecNames);
      const s = `case ${scr} of { [] -> ${nil}; (${expr.headVar}:${expr.tailVar}) -> ${cons} }`;
      return prec > 1 ? `(${s})` : s;
    }
  }
}

// ─── Top-level function def from Letrec + body Lam chain ──────────────────
// factorial = \n -> if n == 0 then 1 else n * factorial (n-1)
// becomes:
// factorial n = if n == 0 then 1 else n * factorial (n-1)

function ppTopLevelDef(name: string, body: ExprTree, letrecNames: Set<string>): string {
  const params: string[] = [];
  let cur = body;
  while (cur.tag === 'Lam') {
    params.push(sanitiseVar(cur.param));
    cur = cur.body;
  }
  const bodyStr = ppExpr(cur, 0, letrecNames);
  const lhs = params.length > 0 ? `${name} ${params.join(' ')}` : name;
  return `${lhs} = ${bodyStr}`;
}

// ─── Public API ───────────────────────────────────────────────────────────

export function graphToHaskell(
  nodes: LibNode[],
  edges: LibEdge[],
  subgraphs: Record<string, SubgraphState>,
): string {
  const outputs = buildOutputExprs(nodes, edges, subgraphs);

  if (outputs.length === 0) {
    return '-- No Output nodes on the canvas.\n-- Add an Output node and connect it to see Haskell code here.';
  }

  // ── Collect all Letrec bindings (= named functions) ───────────────────
  const allLetrecs: Array<{ name: string; body: ExprTree }> = [];
  const seenLetrec = new Set<string>();
  for (const out of outputs) {
    allLetrecs.push(...collectLetrecs(out.expr, seenLetrec));
  }
  const letrecNames = new Set(allLetrecs.map(l => l.name));

  // ── Collect all used builtins ──────────────────────────────────────────
  const usedBuiltins = new Set<string>();
  for (const out of outputs) collectBuiltins(out.expr, usedBuiltins);
  for (const { body } of allLetrecs) collectBuiltins(body, usedBuiltins);

  // ── Determine imports needed ───────────────────────────────────────────
  const needsOrd  = ['ord','chr','strToChars','charsToStr'].some(b => usedBuiltins.has(b));
  const needsSort = usedBuiltins.has('sort');

  // ── Build output sections ──────────────────────────────────────────────
  const lines: string[] = [];

  // Imports
  if (needsOrd)  lines.push('import Data.Char (ord, chr)');
  if (needsSort) lines.push('import Data.List (sort)');
  if (needsOrd || needsSort) lines.push('');

  // Custom builtin helpers
  const customHelpers: string[] = [];
  for (const bName of usedBuiltins) {
    if (CUSTOM_BUILTINS[bName]) {
      customHelpers.push(CUSTOM_BUILTINS[bName].helper);
    }
  }
  if (customHelpers.length > 0) {
    lines.push('-- Helper definitions');
    lines.push(...customHelpers.flatMap(h => [h, '']));
  }

  // Named function top-level definitions
  if (allLetrecs.length > 0) {
    lines.push('-- Named functions');
    for (const { name, body } of allLetrecs) {
      lines.push(ppTopLevelDef(name, body, letrecNames));
      lines.push('');
    }
  }

  // Comments from Comment nodes on the canvas
  const commentLines = nodes
    .filter(n => n.data.kind === 'comment')
    .flatMap(n => (n.data as CommentNodeData).text.split('\n'))
    .filter(l => l.trim().length > 0)
    .map(l => `-- ${l}`);
  if (commentLines.length > 0) {
    lines.push(...commentLines);
    lines.push('');
  }

  // main
  lines.push('main :: IO ()');
  if (outputs.length === 1) {
    const expr = ppExpr(outputs[0].expr, 0, letrecNames);
    const label = outputs[0].label !== 'Output' ? `  -- ${outputs[0].label}` : '';
    lines.push(`main = print (${expr})${label}`);
  } else {
    lines.push('main = do');
    for (const out of outputs) {
      const expr = ppExpr(out.expr, 0, letrecNames);
      const label = out.label !== 'Output' ? `  -- ${out.label}` : '';
      lines.push(`  print (${expr})${label}`);
    }
  }

  return lines.join('\n');
}
