import { type NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import type { LibNode } from '../types/nodes';
import type { ValueNodeData } from '../types/nodes';
import { useGraphStore } from '../store/graphStore';

const VALUE_TYPE_LABELS: Record<string, string> = {
  Int: '123', Float: '1.0', Bool: 'T/F', String: '"…"', List: '[…]',
};

const INPUT_STYLE = {
  background: 'var(--bg-node-input)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-input)',
};

// A value node created by wrapAsModule to stand for a function parameter.
// Its literal is a marker and must never be edited by the user.
function isParamAnchor(d: ValueNodeData): boolean {
  return d.literal === '__module_input__' && Boolean((d as { _modulePortId?: string })._modulePortId);
}

export function ValueNode({ id, data, selected }: NodeProps<LibNode>) {
  const d = data as ValueNodeData;
  const updateNodeData = useGraphStore(s => s.updateNodeData);
  const syncModuleNode = useGraphStore(s => s.syncModuleNode);
  const activeSubgraphId = useGraphStore(s => s.activeSubgraphId);

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
      <BaseNode kind="param" label="Parameter" ports={d.ports} selected={selected} minWidth={120}>
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
        className="w-16 text-xs font-mono rounded px-1 py-0.5 text-center nodrag outline-none focus:border-blue-400"
        style={INPUT_STYLE}
        onClick={e => e.stopPropagation()}
      />
    </BaseNode>
  );
}
