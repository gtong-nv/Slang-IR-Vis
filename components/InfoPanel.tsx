import React, { useState } from 'react';
import { IRNode } from '../types';
import { explainIRNode } from '../services/geminiService';
import { Sparkles, BookOpen, Code, Activity, Tag, Link2 } from 'lucide-react';

interface InfoPanelProps {
  selectedNode: IRNode | null;
  contextCode: string[];
}

const InfoPanel: React.FC<InfoPanelProps> = ({ selectedNode, contextCode }) => {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleExplain = async () => {
    if (!selectedNode) return;
    setLoading(true);
    // Get context: 2 lines before and after
    const start = Math.max(0, selectedNode.lineIndex - 2);
    const end = Math.min(contextCode.length, selectedNode.lineIndex + 3);
    const context = contextCode.slice(start, end);
    
    const result = await explainIRNode(selectedNode, context);
    setExplanation(result);
    setLoading(false);
  };

  // Reset explanation when node changes
  React.useEffect(() => {
    setExplanation(null);
  }, [selectedNode]);

  if (!selectedNode) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500 flex-col gap-2 p-6 text-center">
        <Activity size={48} className="opacity-20" />
        <p>Select a node in the graph or code to view details.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4 bg-slate-900 border-l border-slate-800 overflow-y-auto">
      <div className="mb-6 border-b border-slate-800 pb-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2 break-all">
          <Code className="text-blue-500 shrink-0" size={20}/>
          {selectedNode.id}
        </h2>
        <span className="text-xs font-mono text-slate-500 bg-slate-950 px-2 py-1 rounded mt-2 inline-block border border-slate-800">
          {selectedNode.type}
        </span>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-xs uppercase font-semibold text-slate-500 mb-1">Instruction</h3>
          <div className="font-mono text-sm bg-slate-950 p-3 rounded border border-slate-800 text-emerald-400 break-all whitespace-pre-wrap">
            {selectedNode.originalLine}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
             <h3 className="text-xs uppercase font-semibold text-slate-500 mb-1">Opcode</h3>
             <div className="text-slate-200">{selectedNode.opcode || '-'}</div>
          </div>
          <div>
             <h3 className="text-xs uppercase font-semibold text-slate-500 mb-1">Data Type</h3>
             <div className="text-slate-200">{selectedNode.dataType || '-'}</div>
          </div>
        </div>

        {/* Attributes Section */}
        {selectedNode.attributes && selectedNode.attributes.length > 0 && (
          <div>
            <h3 className="text-xs uppercase font-semibold text-slate-500 mb-2 flex items-center gap-1">
               <Tag size={12} /> Attributes (Metadata)
            </h3>
            <div className="flex flex-col gap-2">
              {selectedNode.attributes.map((attr, i) => (
                <div key={i} className="bg-slate-950/50 border border-slate-800 rounded p-2 text-xs font-mono">
                   <div className="text-purple-400 mb-1 font-semibold">{attr.name}</div>
                   {attr.operands.length > 0 ? (
                      <div className="flex flex-wrap gap-1 items-center text-slate-400">
                         <Link2 size={10} className="mr-1"/>
                         {attr.operands.map((op, j) => (
                            <span key={j} className={op.refId ? "text-blue-400 bg-blue-950/30 px-1 rounded" : ""}>
                               {op.raw}
                            </span>
                         ))}
                      </div>
                   ) : (
                      <div className="text-slate-500">{attr.args || "No arguments"}</div>
                   )}
                   {/* Fallback if operands parsing missed something but text exists */}
                   {!attr.operands.length && attr.args && <div className="text-slate-600 mt-1 truncate">{attr.raw}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h3 className="text-xs uppercase font-semibold text-slate-500 mb-1">Dependencies (Operands)</h3>
          {selectedNode.operands.length > 0 ? (
             <div className="flex flex-wrap gap-2">
               {selectedNode.operands.map((op, i) => (
                 <span key={i} className={`px-2 py-1 rounded text-xs border ${op.refId ? 'bg-blue-950/50 border-blue-900 text-blue-300' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                   {op.raw}
                 </span>
               ))}
             </div>
          ) : (
            <span className="text-slate-600 text-sm italic">No dependencies</span>
          )}
        </div>

        {/* AI Section */}
        <div className="mt-6 pt-6 border-t border-slate-800">
           <button 
             onClick={handleExplain}
             disabled={loading}
             className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white py-2 px-4 rounded transition-all shadow-lg shadow-purple-900/20 disabled:opacity-50"
           >
             {loading ? (
               <span className="animate-pulse">Thinking...</span>
             ) : (
               <>
                 <Sparkles size={16} />
                 Explain with Gemini AI
               </>
             )}
           </button>
           
           {explanation && (
             <div className="mt-4 bg-slate-800/50 p-4 rounded border border-indigo-500/30 text-sm text-indigo-100 leading-relaxed animate-in fade-in slide-in-from-bottom-2">
               <h4 className="flex items-center gap-2 font-bold text-indigo-300 mb-2">
                  <BookOpen size={14} /> Explanation
               </h4>
               {explanation}
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default InfoPanel;