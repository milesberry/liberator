// ─── Comment Node ───────────────────────────────────────────────────────────
// A free-text annotation block with no dataflow ports.
// Text is emitted as -- comment lines in the Haskell panel.

import type { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import { useGraphStore } from '../store/graphStore';
import type { LibNode } from '../types/nodes';
import type { CommentNodeData } from '../types/nodes';

export function CommentNode({ id, data, selected }: NodeProps<LibNode>) {
  const d = data as CommentNodeData;
  const updateNodeData = useGraphStore(s => s.updateNodeData);

  return (
    <BaseNode kind="comment" label="Comment" ports={[]} selected={selected} minWidth={200}>
      <textarea
        value={d.text}
        onChange={e => updateNodeData(id, nd => { (nd as CommentNodeData).text = e.target.value; })}
        placeholder="Add a note…"
        rows={3}
        className="nodrag w-full text-xs rounded px-2 py-1 resize-none outline-none leading-relaxed"
        style={{
          background: 'var(--bg-node-input)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-input)',
        }}
        onClick={e => e.stopPropagation()}
      />
    </BaseNode>
  );
}
