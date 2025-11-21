import React, { useRef, useEffect, useState } from 'react';
import { Edit2, Eye, Copy, Check, Terminal } from 'lucide-react';

interface CodeEditorProps {
  code: string;
  onChange: (newCode: string) => void;
  selectedNodeId: string | null;
  onNodeSelect: (id: string) => void;
  nodeCount: number;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ 
  code, 
  onChange, 
  selectedNodeId, 
  onNodeSelect,
  nodeCount 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to selected line in View mode
  useEffect(() => {
    if (selectedNodeId && !isEditing) {
      const lines = code.split('\n');
      const index = lines.findIndex(line => line.includes(`${selectedNodeId} `) || line.includes(`${selectedNodeId}:`));
      
      if (index >= 0 && lineRefs.current[index]) {
        lineRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [selectedNodeId, code, isEditing]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTokenClick = (token: string) => {
    if (token.startsWith('%')) {
      onNodeSelect(token);
    }
  };

  const renderLine = (line: string, index: number) => {
    const isSelected = selectedNodeId && (line.includes(`let ${selectedNodeId} `) || line.includes(`block ${selectedNodeId}`) || line.startsWith(selectedNodeId));
    
    // Basic tokenizer for display
    const parts = line.split(/([%]\w+|\[.*?\]|\s+|[:=(),])/);
    
    return (
      <div 
        key={index} 
        ref={el => { lineRefs.current[index] = el; }}
        className={`font-mono text-sm whitespace-pre px-4 py-0.5 flex hover:bg-slate-800/50 transition-colors ${isSelected ? 'bg-slate-800 border-l-2 border-amber-500' : 'border-l-2 border-transparent'}`}
      >
        <span className="text-slate-700 select-none w-6 text-right mr-4 text-xs pt-0.5">{index + 1}</span>
        <span className="flex-1">
          {parts.map((part, i) => {
            let color = "text-slate-400";
            let cursor = "cursor-default";
            let onClick = undefined;
            let hover = "";

            if (part.startsWith('%')) {
              color = part === selectedNodeId ? "text-amber-400 font-bold" : "text-blue-400";
              cursor = "cursor-pointer";
              hover = "hover:text-blue-300 hover:underline";
              onClick = () => handleTokenClick(part);
            } else if (part.match(/^let|varLayout|typeLayout|func|block|return_val|store|load/)) {
              color = "text-purple-400";
            } else if (part.match(/^\d+$/)) {
              color = "text-emerald-400";
            } else if (part.startsWith('[')) {
              color = "text-slate-500 italic";
            } else if (part.match(/^[:=(),]$/)) {
               color = "text-slate-600";
            }

            return (
              <span 
                key={i} 
                className={`${color} ${cursor} ${hover}`} 
                onClick={onClick}
              >
                {part}
              </span>
            );
          })}
        </span>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 border-r border-slate-800">
      {/* Toolbar / Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm">
         <div className="flex items-center gap-3">
            <div className="p-1 bg-slate-800 rounded text-slate-400">
                <Terminal size={14} />
            </div>
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Source IR</span>
            <span className="text-[10px] font-mono text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                {nodeCount} Nodes
            </span>
         </div>
         
         <div className="flex items-center gap-1">
            <button 
              onClick={handleCopy}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
              title="Copy Code"
            >
               {copied ? <Check size={14} className="text-emerald-500"/> : <Copy size={14}/>}
            </button>
            <div className="h-4 w-px bg-slate-700 mx-1"></div>
            <button 
              onClick={() => setIsEditing(!isEditing)}
              className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded border transition-all ${isEditing 
                ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/20' 
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}
            >
              {isEditing ? (
                <>
                  <Eye size={12}/>
                  <span>Preview</span>
                </>
              ) : (
                <>
                  <Edit2 size={12}/>
                  <span>Edit</span>
                </>
              )}
            </button>
         </div>
      </div>

      {/* Editor Body */}
      <div className="flex-1 overflow-hidden relative bg-slate-950">
        {isEditing ? (
           <textarea 
             ref={textAreaRef}
             className="w-full h-full bg-slate-950 text-slate-300 p-4 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none custom-scrollbar leading-relaxed"
             value={code}
             onChange={(e) => onChange(e.target.value)}
             spellCheck={false}
             placeholder="// Paste your Slang IR code here..."
           />
        ) : (
           <div className="overflow-auto h-full custom-scrollbar py-2">
              {code.trim() ? (
                  code.split('\n').map((line, i) => renderLine(line, i))
              ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-2">
                      <p>No code to display.</p>
                      <button onClick={() => setIsEditing(true)} className="text-indigo-400 hover:underline text-sm">
                          Click to edit
                      </button>
                  </div>
              )}
           </div>
        )}
      </div>
    </div>
  );
};

export default CodeEditor;