import { useState, useRef, useCallback } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { parseExcelFile } from '../utils/parseExcel';

/**
 * ModelNode – represents a single Excel model file on the canvas.
 *
 * data shape:
 *   label:   string         – display name / filename
 *   order:   number | null  – execution order badge (topological sort)
 *   inputs:  string[]       – variable names from INPUTS sheet
 *   outputs: string[]       – variable names from OUTPUTS sheet
 *   error:   string | null  – set when a file fails validation
 */
export default function ModelNode({ id, data }) {
  const { setNodes } = useReactFlow();
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Counter-based approach: dragEnter/Leave both bubble from child elements,
  // so we track depth to know when the cursor truly leaves the node.
  const dragDepth = useRef(0);

  const { label, order, inputs = [], outputs = [], error } = data;

  // Patch this node's data without replacing the whole nodes array item.
  const patchData = useCallback(
    (updates) =>
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, ...updates } } : n
        )
      ),
    [id, setNodes]
  );

  // ── Drag handlers ────────────────────────────────────────────────────────

  const onDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current += 1;
    if (dragDepth.current === 1) setIsDragOver(true);
  };

  const onDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current -= 1;
    if (dragDepth.current === 0) setIsDragOver(false);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const onDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Reset drag state immediately
    dragDepth.current = 0;
    setIsDragOver(false);

    // Accept only the first .xlsx / .xls file in the drop
    const file = Array.from(e.dataTransfer.files ?? []).find((f) =>
      /\.(xlsx|xls)$/i.test(f.name)
    );

    if (!file) {
      patchData({ error: 'Only .xlsx / .xls files are accepted.' });
      return;
    }

    setIsLoading(true);
    const result = await parseExcelFile(file);
    setIsLoading(false);

    patchData({
      label: result.filename,
      inputs: result.inputs,
      outputs: result.outputs,
      error: result.error,
    });
  };

  // ── Derived display flags ────────────────────────────────────────────────

  const hasPorts = inputs.length > 0 || outputs.length > 0;
  const showDropHint = !hasPorts && !error && !isLoading;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={[
        'relative bg-white border-2 rounded-xl shadow-lg min-w-[260px] text-sm',
        'font-sans select-none transition-colors duration-150',
        isDragOver
          ? 'border-indigo-400 ring-2 ring-indigo-200'
          : error
          ? 'border-red-300'
          : 'border-slate-300',
      ].join(' ')}
    >
      {/* ── Drag-over overlay ─────────────────────────────────────────── */}
      {isDragOver && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-indigo-50/80 pointer-events-none">
          <span className="text-indigo-600 font-semibold text-sm">
            Drop to load
          </span>
        </div>
      )}

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div
        className={[
          'flex items-center gap-2 px-3 py-2 rounded-t-xl',
          error && !isLoading ? 'bg-red-700' : 'bg-slate-700',
        ].join(' ')}
      >
        {order != null && (
          <span className="flex shrink-0 items-center justify-center w-6 h-6 rounded-full bg-indigo-500 text-white text-xs font-bold">
            {order}
          </span>
        )}

        {isLoading ? (
          <span className="text-slate-300 text-xs italic animate-pulse">
            Parsing…
          </span>
        ) : (
          <span className="text-white font-semibold truncate" title={label}>
            {label}
          </span>
        )}
      </div>

      {/* ── Error banner ──────────────────────────────────────────────── */}
      {error && !isLoading && (
        <div className="flex items-start gap-2 px-3 py-2 bg-red-50 border-b border-red-200">
          <svg
            className="shrink-0 mt-0.5 w-4 h-4 text-red-500"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
          <p className="flex-1 text-red-700 text-xs leading-snug">{error}</p>
          <button
            onClick={() => patchData({ error: null })}
            title="Dismiss"
            className="shrink-0 text-red-400 hover:text-red-700 font-bold text-base leading-none mt-0.5 cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* ── Port columns ──────────────────────────────────────────────── */}
      <div className="flex divide-x divide-slate-200">
        {/* INPUTS */}
        <div className="flex-1 py-1">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold px-3 pb-1">
            Inputs
          </p>
          {inputs.length === 0 ? (
            <p className="text-slate-300 italic text-xs px-3 pb-2">none</p>
          ) : (
            inputs.map((name) => (
              <div key={name} className="relative flex items-center h-7">
                <Handle
                  type="target"
                  position={Position.Left}
                  id={`in-${name}`}
                  style={{ top: '50%', left: -8 }}
                  className="!w-3 !h-3 !bg-indigo-400 !border-2 !border-white"
                />
                <span
                  className="pl-3 pr-2 text-slate-700 truncate"
                  title={name}
                >
                  {name}
                </span>
              </div>
            ))
          )}
        </div>

        {/* OUTPUTS */}
        <div className="flex-1 py-1">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold px-3 pb-1 text-right">
            Outputs
          </p>
          {outputs.length === 0 ? (
            <p className="text-slate-300 italic text-xs px-3 pb-2 text-right">
              none
            </p>
          ) : (
            outputs.map((name) => (
              <div
                key={name}
                className="relative flex items-center justify-end h-7"
              >
                <span
                  className="pl-2 pr-3 text-slate-700 truncate"
                  title={name}
                >
                  {name}
                </span>
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`out-${name}`}
                  style={{ top: '50%', right: -8 }}
                  className="!w-3 !h-3 !bg-emerald-400 !border-2 !border-white"
                />
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Drop-zone hint ────────────────────────────────────────────── */}
      {showDropHint && (
        <div className="border-t border-slate-200 rounded-b-xl bg-slate-50 py-2 px-3 text-center text-slate-400 text-xs">
          Drop an .xlsx file here
        </div>
      )}
    </div>
  );
}
