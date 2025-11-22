
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Edit2, Eye, Copy, Check, Terminal, Search, ArrowUp, ArrowDown, X } from 'lucide-react';

interface CodeEditorProps {
  code: string;
  onChange: (newCode: string) => void;
  selectedNodeId: string | null;
  onNodeSelect: (id: string) => void;
  nodeCount: number;
  title?: string;
  selectedLineIndex?: number | null;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ 
  code, 
  onChange, 
  selectedNodeId, 
  onNodeSelect,
  nodeCount,
  title,
  selectedLineIndex
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // Calculate matches
  const matches = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const results: number[] = [];
    const lines = code.split('\n');
    const lowerTerm = searchTerm.toLowerCase();
    lines.forEach((line, idx) => {
        if (line.toLowerCase().includes(lowerTerm)) {
            results.push(idx);
        }
    });
    return results;
  }, [code, searchTerm]);

  // Reset match index when search term changes
  useEffect(() => {
    setCurrentMatchIndex(0);
  }, [searchTerm]);

  // Scroll to selected line in View mode (External Selection)
  useEffect(() => {
    if (!isEditing && !searchTerm) {
      let index = -1;

      // Priority: Use explicit line index if available (handles void ops like 'store' correctly)
      if (selectedLineIndex !== undefined && selectedLineIndex !== null) {
          index = selectedLineIndex;
      } else if (selectedNodeId) {
          // Fallback: Search for ID in text
          const lines = code.split('\n');
          index = lines.findIndex(line => line.includes(`${selectedNodeId} `) || line.includes(`${selectedNodeId}:`) || line.startsWith(selectedNodeId));
      }
      
      if (index >= 0 && lineRefs.current[index]) {
        lineRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [selectedNodeId, selectedLineIndex, code, isEditing, searchTerm]);

  // Scroll to current search match
  useEffect(() => {
    if (matches.length > 0 && lineRefs.current[matches[currentMatchIndex]]) {
      lineRefs.current[matches[currentMatchIndex]]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentMatchIndex, matches]);

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

  const nextMatch = () => {
    setCurrentMatchIndex(prev => (prev + 1) % matches.length);
  };

  const prevMatch = () => {
    setCurrentMatchIndex(prev => (prev - 1 + matches.length) % matches.length);
  };

  const clearSearch = () => {
    setSearchTerm('');
  };

  // Helper to highlight search term within a string
  const highlightText = (text: string) => {
    if (!searchTerm.trim() || !text.toLowerCase().includes(searchTerm.toLowerCase())) return text;
    
    // Escape special regex chars
    const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escapedTerm})`, 'gi'));
    
    return parts.map((part, i) => 
      part.toLowerCase() === searchTerm.toLowerCase() 
        ? <mark key={i} className="bg-yellow-500/40 text-inherit rounded-[1px] px-0 mx-0">{part}</mark> 
        : part
    );
  };

  const renderLine = (line: string, index: number) => {
    // Check for match by Line Index first, then fallback to ID text match
    const isSelected = (selectedLineIndex !== undefined && selectedLineIndex !== null && index === selectedLineIndex) || 
                       (selectedNodeId && (line.includes(`let ${selectedNodeId} `) || line.includes(`block ${selectedNodeId}`) || line.startsWith(selectedNodeId)));

    const isSearchMatch = matches.includes(index);
    const isCurrentMatch = matches.length > 0 && matches[currentMatchIndex] === index;

    // Basic tokenizer for display
    const parts = line.split(/([%]\w+|\[.*?\]|\s+|[:=(),])/);
    
    return (
      <div 
        key={index} 
        ref={el => { lineRefs.current[index] = el; }}
        className={`font-mono text-sm whitespace-pre px-4 py-0.5 flex hover:bg-slate-800/50 transition-colors 
          ${isCurrentMatch ? 'bg-yellow-900/30 border-l-2 border-yellow-500' : 
            isSelected ? 'bg-slate-800 border-l-2 border-amber-500' : 'border-l-2 border-transparent'}`}
      >
        <span className={`select-none w-8 text-right mr-4 text-xs pt-0.5 opacity-50 ${isCurrentMatch ? 'text-yellow-500 font-bold' : 'text-slate-600'}`}>
          {index + 1}
        </span>
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
                {highlightText(part)}
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
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm gap-2 shrink-0">
         <div className="flex items-center gap-3 overflow-hidden shrink-0">
            <div className="p-1 bg-slate-800 rounded text-slate-400 shrink-0">
                <Terminal size={14} />
            </div>
            <div className="flex flex-col overflow-hidden">
               <span className="text-xs font-bold text-slate-300 uppercase tracking-wider truncate max-w-[150px]" title={title || "Source IR"}>
                 {title || "Source IR"}
               </span>
               <span className="text-[10px] font-mono text-slate-500">
                   {nodeCount} Nodes
               </span>
            </div>
         </div>
         
         {/* Search Box - Only visible in View mode */}
         {!isEditing && (
           <div className="flex-1 flex justify-center max-w-[250px] mx-2">
             <div className="relative w-full group">
               <div className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500">
                 <Search size={12} />
               </div>
               <input 
                 type="text"
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 placeholder="Search code..."
                 className="w-full bg-slate-900 border border-slate-700 rounded-md pl-8 pr-16 py-1 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all"
               />
               {searchTerm && (
                 <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 bg-slate-900 rounded border border-slate-700 shadow-sm">
                    <span className="text-[10px] text-slate-500 px-1 border-r border-slate-800">
                      {matches.length > 0 ? currentMatchIndex + 1 : 0}/{matches.length}
                    </span>
                    <button onClick={prevMatch} className="p-0.5 hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30">
                      <ArrowUp size={10} />
                    </button>
                    <button onClick={nextMatch} className="p-0.5 hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30">
                      <ArrowDown size={10} />
                    </button>
                    <button onClick={clearSearch} className="p-0.5 hover:bg-slate-800 text-slate-400 hover:text-red-400 ml-0.5">
                      <X size={10} />
                    </button>
                 </div>
               )}
             </div>
           </div>
         )}

         <div className="flex items-center gap-1 shrink-0">
            <button 
              onClick={handleCopy}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
              title="Copy Code"
            >
               {copied ? <Check size={14} className="text-emerald-500"/> : <Copy size={14}/>}
            </button>
            <div className="h-4 w-px bg-slate-700 mx-1"></div>
            <button 
              onClick={() => { setIsEditing(!isEditing); setSearchTerm(''); }}
              className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded border transition-all ${isEditing 
                ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/20' 
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}
            >
              {isEditing ? (
                <>
                  <Eye size={12}/>
                  <span>View</span>
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
      <div className="flex-1 relative bg-slate-950">
        {isEditing ? (
           <textarea 
             ref={textAreaRef}
             className="absolute inset-0 w-full h-full bg-slate-950 text-slate-300 p-4 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none custom-scrollbar leading-relaxed"
             value={code}
             onChange={(e) => onChange(e.target.value)}
             spellCheck={false}
             placeholder="// Paste your Slang IR code here..."
           />
        ) : (
           <div className="absolute inset-0 overflow-auto custom-scrollbar py-2">
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
