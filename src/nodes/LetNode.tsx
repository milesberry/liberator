// ─── LetNode ─────────────────────────────────────────────────────────────────
// Represents  let x = value in body
// Visually: 4 ports —
//   • 'value'  input  — the expression bound to x
//   • 'param'  output — emits Var(varName), wires into the body sub-expression
//   • 'body'   input  — the result expression that may use x
//   • 'result' output — the fully applied (λx.body) value
//
// This is identical to Lambda + Apply fused into one node, but labelled as
// a local variable binding, which maps directly to AQA's "local variables"
// concept in functional programming.

import { type NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import type { LibNode, LetNodeData } from '../types/nodes';
import { useGraphStore } from '../store/graphStore';

export function LetNode({ id, data, selected }: NodeProps<LibNode>) {
  const d = data as LetNodeData;
  const updateNodeData = useGraphStore(s => s.updateNodeData);

  return (
    <BaseNode kind="let" label="let … in …" ports={d.ports} selected={selected} minWidth={150}>
      <div className="flex items-center gap-1 text-xs nodrag">
        <span className="text-teal-300">let</span>
        <input
          value={d.varName}
          onChange={e => updateNodeData(id, nd => { (nd as LetNodeData).varName = e.target.value; })}
          className="w-10 text-center font-mono rounded px-1 py-0.5 outline-none"
          style={{ background: 'var(--bg-node-input)', color: 'var(--text-primary)', border: '1px solid var(--border-input)' }}
          onClick={e => e.stopPropagation()}
        />
        <span className="text-teal-300">=</span>
      </div>
    </BaseNode>
  );
}
