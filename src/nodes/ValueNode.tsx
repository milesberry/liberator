import { type NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import type { LibNode } from '../types/nodes';
import type { ValueNodeData } from '../types/nodes';
import { useGraphStore, parameterAnchors } from '../store/graphStore';
import { literalProblem } from '../engine/toExprTree';

const VALUE_TYPE_LABELS: Record<string, string> = {
  Int: '123', Float: '1.0', Bool: 'T/F', String: '"…"', List: '[…]',
};

const INPUT_STYLE = {
  background: 'var(--bg-node-input)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-input)',
};

// A value node standing for a function parameter (created by wrapAsModule, or
// hand-written in the built-in examples). Recognised by _modulePortId, as the
// evaluator does; its literal is never shown or edited.
function isParamAnchor(d: ValueNodeData): boolean {
  return Boolean((d as { _modulePortId?: string })._modulePortId);
}

export function ValueNode({ id, data, selected }: NodeProps<LibNode>) {
  const d = data as ValueNodeData;
  const updateNodeData = useGraphStore(s => s.updateNodeData);
  const syncModuleNode = useGraphStore(s => s.syncModuleNode);
  const activeSubgraphId = useGraphStore(s => s.activeSubgraphId);
  // Parameters are numbered in order (top to bottom), which is the order the
  // function takes them in
  const paramNumber = useGraphStore(s => {
    const sub = s.subgraphs[s.activeSubgraphId];
    return sub ? parameterAnchors(sub.nodes).findIndex(n => n.id === id) + 1 : 0;
  });

  if (isParamAnchor(d)) {
    // Parameter anchor: the box edits the parameter's name, not the marker literal
    const handleRename = (e: React.ChangeEvent<HTMLInputElement>) => {
      const name = e.target.value;
      updateNodeData(id, (nd) => {
        const port = nd.ports.find(p => p.direction === 'output');
        if (port) port.label = name;
      });
      // Keep the function's ports (and any Call nodes) in step with the new name
      if (activeSubgraphId) syncModuleNode(activeSubgraphId);
    };
    const name = d.ports.find(p => p.direction === 'output')?.label ?? '';

    return (
      <BaseNode kind="param" label={paramNumber > 0 ? `Parameter ${paramNumber}` : 'Parameter'}
                ports={d.ports} selected={selected} minWidth={120}>
        <input
          value={name}
          onChange={handleRename}
          title="Parameter name"
          placeholder="name"
          className="w-16 text-xs font-mono rounded px-1 py-0.5 text-center nodrag outline-none focus:border-blue-400"
          style={INPUT_STYLE}
          onClick={e => e.stopPropagation()}
        />
      </BaseNode>
    );
  }

  // Flag a literal that doesn't fit the node's type, e.g. 2.5 in an Integer
  const problem = literalProblem(d.valueType, d.literal);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, (nd) => {
      (nd as ValueNodeData).literal = e.target.value;
    });
  };

  return (
    <BaseNode kind="value" label={`${VALUE_TYPE_LABELS[d.valueType]} ${d.valueType}`} ports={d.ports} selected={selected} minWidth={120}>
      <input
        value={d.literal}
        onChange={handleChange}
        title={problem}
        aria-invalid={problem ? true : undefined}
        className="w-16 text-xs font-mono rounded px-1 py-0.5 text-center nodrag outline-none focus:border-blue-400"
        style={problem ? { ...INPUT_STYLE, border: '2px solid var(--color-wire-error)' } : INPUT_STYLE}
        onClick={e => e.stopPropagation()}
      />
    </BaseNode>
  );
}
