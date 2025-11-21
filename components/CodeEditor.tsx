import React, { useRef, useEffect } from 'react';

interface CodeEditorProps {
  code: string;
  onChange: (newCode: string) => void;
  selectedNodeId: string | null;
  onNodeSelect: (id: string) => void;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ code, onChange, selectedNodeId, onNodeSelect }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Scroll to selected line
  useEffect(() => {
    if (selectedNodeId) {
      // We need to map ID to line index. This is a bit expensive to do every render if we parse every time
      // For this component, we rely on the parent to pass line index or we just scan.
      // To keep it simple: scan for the ID in the line.
      const lines = code.split('\n');
      const index = lines.findIndex(line => line.includes(`${selectedNodeId} `) || line.includes(`${selectedNodeId}:`));
      
      if (index >= 0 && lineRefs.current[index]) {
        lineRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [selectedNodeId, code]);

  const handleTokenClick = (token: string) => {
    if (token.startsWith('%')) {
      onNodeSelect(token);
    }
  };

  const renderLine = (line: string, index: number) => {
    const isSelected = selectedNodeId && (line.includes(`let ${selectedNodeId} `) || line.includes(`block ${selectedNodeId}`) || line.startsWith(selectedNodeId));
    
    // Basic tokenizer
    const parts = line.split(/([%]\w+|\[.*?\]|\s+|[:=(),])/);
    
    return (
      <div 
        key={index} 
        ref={el => { lineRefs.current[index] = el; }}
        className={`font-mono text-sm whitespace-pre px-2 py-0.5 flex hover:bg-slate-800 ${isSelected ? 'bg-slate-800/80 border-l-2 border-amber-500' : ''}`}
      >
        <span className="text-slate-600 select-none w-8 text-right mr-4">{index + 1}</span>
        <span>
          {parts.map((part, i) => {
            let color = "text-slate-300";
            let cursor = "cursor-text";
            let onClick = undefined;

            if (part.startsWith('%')) {
              color = part === selectedNodeId ? "text-amber-400 font-bold" : "text-blue-400 hover:text-blue-300 hover:underline";
              cursor = "cursor-pointer";
              onClick = () => handleTokenClick(part);
            } else if (part.match(/^let|varLayout|typeLayout|func|block|return_val/)) {
              color = "text-purple-400";
            } else if (part.match(/^\d+$/)) {
              color = "text-emerald-400";
            } else if (part.startsWith('[')) {
              color = "text-slate-500 italic";
            }

            return (
              <span 
                key={i} 
                className={`${color} ${cursor}`} 
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
    <div className="h-full flex flex-col bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
      <div className="flex-1 overflow-auto custom-scrollbar relative">
        {/* Textarea for editing - overlaid invisibly or toggled? 
            For this visualizer, read-only interactive view is primary. 
            Let's make a small edit button to toggle, but default to interactive view.
            Actually, we can just use a ContentEditable or simple overlay.
            For simplicity and robustness:
            We render the interactive lines. If the user wants to EDIT, they paste into a hidden textarea 
            that updates the state, or we provide a dedicated 'Edit Source' modal.
            Let's stick to a simple approach: The user can paste into a textarea at the top or load sample.
            The main view is the highlighted div.
         */}
         
        <div className="absolute inset-0 p-2">
            {code.split('\n').map((line, i) => renderLine(line, i))}
        </div>
      </div>
    </div>
  );
};

export default CodeEditor;