
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ParsedIR, IRPass } from './types';
import { parseSlangIR, parsePasses } from './services/irParser';
import { analyzeFlow } from './services/geminiService';
import CodeEditor from './components/CodeEditor';
import DependencyGraph from './components/DependencyGraph';
import InfoPanel from './components/InfoPanel';
import { Layout, MessageSquare, Sparkles, Layers, FileText, ChevronLeft, ChevronRight, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Code2, Info } from 'lucide-react';

// Updated Sample data with multiple passes
const SAMPLE_IR = `###
### AFTER-VECTOR-LEGALIZATION:
Poison
let  %1	: Void	= varLayout(%2, %3)
let  %3	: Void	= offset(9 : Int, 0 : Int)
let  %2	: Void	= structuredBufferTypeLayout(%4, %5)
let  %5	: Void	= size(9 : Int, 1 : Int)
let  %4	: Void	= typeLayout(%6)
let  %6	: Void	= size(8 : Int, 4 : Int)
let  %7	: Vec(UInt, 2 : Int)	= makeVector(0 : UInt, 0 : UInt)
let  %8	: Void	= EntryPointLayout(%9, %10)
let  %10	: Void	= varLayout(%11)
let  %9	: Void	= varLayout(%12)
let  %12	: Void	= structTypeLayout(%13)
let  %13	: Void	= structFieldLayout(%14, %15)
let  %15	: Void	= varLayout(%11, %16, %17)
let  %17	: Void	= stage(6 : Int)
let  %16	: Void	= systemValueSemantic("SV_DispatchThreadID", 0 : Int)
let  %11	: Void	= typeLayout
let  %14	: _	= key
[export("_SV10enum_repro13genericStructg1T7channel")]
[nameHint("channel")]
let  %channel	: _	= key
[export("_ST10enum_repro13genericStructg1TG03int")]
[nameHint("genericStruct")]
struct %genericStruct	: Type
{
	field(%channel, Int)
}

[nameHint("outputBuffer")]
[export("_SV10enum_repro12outputBuffer")]
[layout(%1)]
let  %outputBuffer	: RWStructuredBuffer(Int, DefaultLayout, %7)	= global_param
[entryPoint(6 : Int, "computeMain", "enum_repro")]
[keepAlive]
[numThreads(4 : Int, 1 : Int, 1 : Int)]
[export("_S10enum_repro11computeMainp1pi_v3uV")]
[nameHint("computeMain")]
[layout(%8)]
func %computeMain	: Func(Void, BorrowInParam(Vec(UInt, 3 : Int), 1 : UInt64, 2147483647 : UInt64))
{
block %18(
		[layout(%15)]
		[nameHint("dispatchThreadID")]
		[semantic("SV_DispatchThreadID", 0 : Int)]
		param %dispatchThreadID	: BorrowInParam(Vec(UInt, 3 : Int), 1 : UInt64, 2147483647 : UInt64)):
	let  %19	: Vec(UInt, 3 : Int)	= load(%dispatchThreadID)
	[nameHint("obj")]
	let  %obj	: Ptr(%genericStruct)	= var
	let  %20	: Ptr(Int)	= get_field_addr(%obj, %channel)
	let  %21	: UInt	= swizzle(%19, 0 : Int)
	let  %22	: UInt	= irem(%21, 4 : UInt)
	let  %23	: Int	= intCast(%22)
	store(%20, %23)
	let  %24	: UInt	= swizzle(%19, 0 : Int)
	let  %25	: Ptr(Int)	= rwstructuredBufferGetElementPtr(%outputBuffer, %24)
	let  %26	: Ptr(Int)	= get_field_addr(%obj, %channel)
	let  %27	: Int	= load(%26)
	store(%25, %27)
	return_val(void_constant)
}
###
### POST LINK AND OPTIMIZE:
let  %1	: Void	= varLayout(%2, %3, %4, %5)
let  %3	: Void	= offset(5 : Int, 0 : Int)
Poison
let  %6	: Void	= varLayout(%7, %8)
let  %8	: Void	= offset(9 : Int, 0 : Int)
let  %7	: Void	= structuredBufferTypeLayout(%9, %10)
let  %10	: Void	= size(9 : Int, 1 : Int)
let  %9	: Void	= typeLayout(%11)
let  %11	: Void	= size(8 : Int, 4 : Int)
let  %12	: Vec(UInt, 2 : Int)	= makeVector(0 : UInt, 0 : UInt)
let  %13	: Void	= EntryPointLayout(%14, %15)
let  %15	: Void	= varLayout(%2)
let  %14	: Void	= varLayout(%16)
let  %16	: Void	= structTypeLayout(%17)
let  %17	: Void	= structFieldLayout(%18, %19)
let  %19	: Void	= varLayout(%2, %4, %5)
let  %5	: Void	= stage(6 : Int)
let  %4	: Void	= systemValueSemantic("SV_DispatchThreadID", 0 : Int)
let  %2	: Void	= typeLayout
let  %18	: _	= key
[nameHint("outputBuffer")]
[export("_SV10enum_repro12outputBuffer")]
[layout(%6)]
let  %outputBuffer	: RWStructuredBuffer(Int, DefaultLayout, %12)	= global_param
[import("gl_GlobalInvocationID")]
[layout(%1)]
let  %20	: BorrowInParam(Vec(UInt, 3 : Int), 0 : UInt64, 7 : UInt64)	= global_param
[entryPoint(6 : Int, "main", "enum_repro")]
[keepAlive]
[numThreads(4 : Int, 1 : Int, 1 : Int)]
[export("_S10enum_repro11computeMainp1pi_v3uV")]
[nameHint("computeMain")]
[layout(%13)]
func %computeMain	: Func(Void)
{
block %21:
	let  %22	: Vec(UInt, 3 : Int)	= load(%20)
	let  %23	: UInt	= swizzle(%22, 0 : Int)
	let  %24	: UInt	= irem(%23, 4 : UInt)
	let  %25	: Int	= intCast(%24)
	let  %26	: Ptr(Int)	= rwstructuredBufferGetElementPtr(%outputBuffer, %23)
	store(%26, %25)
	return_val(void_constant)
}
###`;

const App: React.FC = () => {
  // State for Pass Management
  const [passes, setPasses] = useState<IRPass[]>([]);
  const [selectedPassIndex, setSelectedPassIndex] = useState(0);
  
  // Parsing and Selection
  const [parsedData, setParsedData] = useState<ParsedIR | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [globalAnalysis, setGlobalAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Layout State
  const [passesWidth, setPassesWidth] = useState(250);
  const [sourceWidth, setSourceWidth] = useState(400);
  const [detailWidth, setDetailWidth] = useState(350);
  
  const [isPassesCollapsed, setIsPassesCollapsed] = useState(false);
  const [isSourceCollapsed, setIsSourceCollapsed] = useState(false);
  const [isDetailCollapsed, setIsDetailCollapsed] = useState(false);
  
  const [isResizing, setIsResizing] = useState<'passes' | 'source' | 'detail' | null>(null);

  // Initialize passes from SAMPLE_IR on mount
  useEffect(() => {
    const initialPasses = parsePasses(SAMPLE_IR);
    setPasses(initialPasses);
  }, []);

  const currentPass = useMemo(() => passes[selectedPassIndex], [passes, selectedPassIndex]);

  // Debounce parsing of the CURRENT pass content
  useEffect(() => {
    if (!currentPass) return;

    const timer = setTimeout(() => {
      const data = parseSlangIR(currentPass.content);
      setParsedData(data);
    }, 800); // 800ms debounce

    return () => clearTimeout(timer);
  }, [currentPass]);

  // Update pass content when code is edited
  const handleCodeChange = (newCode: string) => {
    // Detect if the user pasted a new multi-pass dump
    const isMultiPassDump = newCode.includes('###') && /###\s*\n\s*###/.test(newCode);
    
    if (isMultiPassDump) {
        const newPasses = parsePasses(newCode);
        setPasses(newPasses);
        setSelectedPassIndex(0);
        setGlobalAnalysis(null); // Reset analysis on full reload
    } else {
        // Just updating current pass content
        const updatedPasses = [...passes];
        updatedPasses[selectedPassIndex] = { 
            ...updatedPasses[selectedPassIndex], 
            content: newCode 
        };
        setPasses(updatedPasses);
    }
  };

  const handleNodeSelect = useCallback((id: string) => {
    setSelectedNodeId(id);
    if (isDetailCollapsed) {
        setIsDetailCollapsed(false); // Auto-expand when selecting a node
    }
  }, [isDetailCollapsed]);

  const handleAnalyzeGlobal = async () => {
    if (!currentPass) return;
    setIsAnalyzing(true);
    const result = await analyzeFlow(currentPass.content);
    setGlobalAnalysis(result);
    setIsAnalyzing(false);
  };

  const selectedNode = useMemo(() => {
    if (!parsedData || !selectedNodeId) return null;
    return parsedData.nodes.get(selectedNodeId) || null;
  }, [parsedData, selectedNodeId]);

  // Resizing Logic
  const startResizing = (type: 'passes' | 'source' | 'detail') => (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(type);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      if (isResizing === 'passes') {
         // Constrain width between 150px and 500px
         const newWidth = Math.max(150, Math.min(e.clientX, 500));
         setPassesWidth(newWidth);
      } else if (isResizing === 'source') {
         // Calculate offset based on previous panels
         const passesPanelWidth = (!isPassesCollapsed && passes.length > 1) ? passesWidth : (passes.length > 1 ? 48 : 0);
         const newWidth = Math.max(200, Math.min(e.clientX - passesPanelWidth, 800));
         setSourceWidth(newWidth);
      } else if (isResizing === 'detail') {
         // Resize from right side (dragging left border increases width)
         const newWidth = Math.max(250, Math.min(window.innerWidth - e.clientX, 800));
         setDetailWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(null);
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };
  }, [isResizing, isPassesCollapsed, passesWidth, passes.length]);

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-200 font-sans">
      {/* Header */}
      <header className="h-14 border-b border-slate-800 bg-slate-900 flex items-center px-6 justify-between shadow-sm z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-1.5 rounded text-white">
             <Layout size={20} />
          </div>
          <h1 className="font-bold text-lg tracking-tight text-slate-100">Slang IR <span className="text-indigo-400 font-light">Visualizer</span></h1>
        </div>
        <div>
           <button 
            onClick={handleAnalyzeGlobal}
            disabled={isAnalyzing || !currentPass}
            className="text-sm px-3 py-1.5 rounded bg-emerald-600 border border-emerald-500 text-white hover:bg-emerald-500 flex items-center gap-2 transition-all shadow-[0_0_10px_rgba(16,185,129,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
             {isAnalyzing ? <span className="animate-spin">⏳</span> : <MessageSquare size={14} />}
             Analyze Flow
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* Pass Selection Sidebar */}
        {passes.length > 1 && (
          <>
            <div 
              style={{ width: isPassesCollapsed ? 48 : passesWidth, transition: isResizing ? 'none' : 'width 0.3s ease' }}
              className="bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 relative"
            >
              {/* Sidebar Header */}
              <div className={`h-10 border-b border-slate-800 flex items-center ${isPassesCollapsed ? 'justify-center' : 'justify-between px-4'} transition-all overflow-hidden`}>
                 {!isPassesCollapsed && (
                    <div className="flex items-center gap-2 text-slate-400 uppercase tracking-wider text-xs font-bold whitespace-nowrap">
                       <Layers size={14} />
                       Passes
                    </div>
                 )}
                 <button 
                   onClick={() => setIsPassesCollapsed(!isPassesCollapsed)}
                   className="text-slate-500 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors"
                   title={isPassesCollapsed ? "Expand Passes" : "Collapse Passes"}
                 >
                    {isPassesCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
                 </button>
              </div>

              {/* List Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar overflow-x-hidden">
                 {!isPassesCollapsed ? (
                    passes.map((pass, idx) => (
                        <button
                          key={idx}
                          onClick={() => { setSelectedPassIndex(idx); setSelectedNodeId(null); }}
                          className={`w-full text-left px-4 py-3 border-b border-slate-800/50 text-sm flex items-center gap-2 transition-colors ${
                              selectedPassIndex === idx 
                              ? 'bg-indigo-900/30 text-white border-l-4 border-l-indigo-500' 
                              : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border-l-4 border-l-transparent'
                          }`}
                        >
                            <FileText size={14} className={`shrink-0 ${selectedPassIndex === idx ? 'text-indigo-400' : 'opacity-50'}`}/>
                            <span className="truncate">{pass.name}</span>
                        </button>
                    ))
                 ) : (
                    /* Collapsed Vertical Icons */
                    passes.map((pass, idx) => (
                       <button
                         key={idx}
                         onClick={() => { setSelectedPassIndex(idx); setSelectedNodeId(null); }}
                         className={`w-full aspect-square flex items-center justify-center border-b border-slate-800/50 transition-colors ${
                            selectedPassIndex === idx ? 'bg-indigo-900/30 text-indigo-400' : 'text-slate-500 hover:text-slate-200'
                         }`}
                         title={pass.name}
                       >
                          <FileText size={16} />
                       </button>
                    ))
                 )}
              </div>
            </div>

            {/* Resizer for Passes */}
            {!isPassesCollapsed && (
               <div 
                 className="w-1 bg-slate-950 hover:bg-indigo-500 cursor-col-resize transition-colors z-20 flex-shrink-0 border-r border-slate-800"
                 onMouseDown={startResizing('passes')}
               />
            )}
          </>
        )}

        {/* Code View */}
        <div 
          style={{ width: isSourceCollapsed ? 48 : sourceWidth, transition: isResizing ? 'none' : 'width 0.3s ease' }}
          className="flex flex-col z-10 border-r border-slate-800 shrink-0 bg-slate-950 relative"
        >
           {/* Custom Collapsed Header for Code View */}
           {isSourceCollapsed && (
             <div className="h-full flex flex-col items-center py-2 gap-4 border-r border-slate-800 bg-slate-900">
                <button 
                   onClick={() => setIsSourceCollapsed(false)}
                   className="p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded"
                   title="Expand Source"
                >
                   <PanelLeftOpen size={18} />
                </button>
                <div className="h-px w-6 bg-slate-800"></div>
                <div className="vertical-rl text-slate-500 text-xs font-bold tracking-wider uppercase flex items-center gap-2" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
                   <Code2 size={14} className="rotate-90 mb-2"/>
                   Source Code
                </div>
             </div>
           )}

           {/* Standard Code Editor (Hidden when collapsed to avoid rendering cost/layout issues) */}
           <div className={`flex-1 flex flex-col min-w-0 ${isSourceCollapsed ? 'hidden' : ''}`}>
              {/* Add collapse button to CodeEditor header area implicitly by wrapping */}
              <div className="relative flex-1 h-full">
                 <CodeEditor 
                   code={currentPass?.content || ''} 
                   onChange={handleCodeChange} 
                   selectedNodeId={selectedNodeId}
                   onNodeSelect={handleNodeSelect}
                   nodeCount={parsedData?.nodes.size || 0}
                   title={currentPass?.name}
                   selectedLineIndex={selectedNode?.lineIndex ?? null}
                 />
                 {/* Absolute Collapse Button for Source */}
                 <button 
                    onClick={() => setIsSourceCollapsed(true)}
                    className="absolute top-3 right-2 z-20 p-1 text-slate-500 hover:text-white hover:bg-slate-700/50 rounded"
                    title="Collapse Source"
                 >
                   <PanelLeftClose size={14} />
                 </button>
              </div>
           </div>
        </div>

        {/* Resizer for Source */}
        {!isSourceCollapsed && (
            <div 
              className="w-1 bg-slate-950 hover:bg-indigo-500 cursor-col-resize transition-colors z-20 flex-shrink-0 border-r border-slate-800"
              onMouseDown={startResizing('source')}
            />
        )}

        {/* Middle: Graph View */}
        <div className="flex-1 flex flex-col bg-slate-950 relative shadow-inner min-w-0">
           <div className="absolute top-4 left-4 z-10 pointer-events-none">
               {globalAnalysis && (
                   <div className="bg-emerald-900/90 border border-emerald-700 text-emerald-100 p-4 rounded-lg shadow-xl max-w-md text-sm backdrop-blur-sm animate-in fade-in slide-in-from-top-4 pointer-events-auto">
                       <div className="flex justify-between items-start mb-2">
                           <h3 className="font-bold flex items-center gap-2"><Sparkles size={14}/> AI Analysis</h3>
                           <button onClick={() => setGlobalAnalysis(null)} className="text-emerald-400 hover:text-white">&times;</button>
                       </div>
                       <p className="leading-relaxed opacity-90 max-h-[300px] overflow-y-auto custom-scrollbar">{globalAnalysis}</p>
                   </div>
               )}
           </div>
           <div className="flex-1 h-full w-full overflow-hidden">
             {parsedData && (
               <DependencyGraph 
                 parsedData={parsedData} 
                 onNodeClick={handleNodeSelect}
                 selectedNodeId={selectedNodeId}
               />
             )}
           </div>
        </div>
        
        {/* Resizer for Detail */}
        {!isDetailCollapsed && (
            <div 
              className="w-1 bg-slate-950 hover:bg-indigo-500 cursor-col-resize transition-colors z-20 flex-shrink-0 border-l border-slate-800"
              onMouseDown={startResizing('detail')}
            />
        )}

        {/* Right: Details Panel */}
        <div 
          style={{ width: isDetailCollapsed ? 48 : detailWidth, transition: isResizing ? 'none' : 'width 0.3s ease' }}
          className="border-l border-slate-800 bg-slate-900/50 backdrop-blur-sm shrink-0 z-10 flex flex-col relative"
        >
           {/* Collapsed State */}
           {isDetailCollapsed && (
             <div className="h-full flex flex-col items-center py-2 gap-4 bg-slate-900">
                <button 
                   onClick={() => setIsDetailCollapsed(false)}
                   className="p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded"
                   title="Expand Details"
                >
                   <PanelRightOpen size={18} />
                </button>
                <div className="h-px w-6 bg-slate-800"></div>
                <div className="vertical-rl text-slate-500 text-xs font-bold tracking-wider uppercase flex items-center gap-2" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
                   <Info size={14} className="rotate-90 mb-2"/>
                   Details
                </div>
             </div>
           )}

           {/* Expanded State */}
           <div className={`flex-1 h-full overflow-hidden relative ${isDetailCollapsed ? 'hidden' : ''}`}>
               <InfoPanel 
                 selectedNode={selectedNode} 
                 contextCode={parsedData?.rawLines || []}
               />
               {/* Collapse Button */}
               <button 
                  onClick={() => setIsDetailCollapsed(true)}
                  className="absolute top-3 right-2 z-20 p-1 text-slate-500 hover:text-white hover:bg-slate-700/50 rounded"
                  title="Collapse Details"
               >
                 <PanelRightClose size={14} />
               </button>
           </div>
        </div>

      </main>
    </div>
  );
};

// Add custom scrollbar styles via a style tag for simplicity
const style = document.createElement('style');
style.innerHTML = `
  .custom-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: #334155 #0f172a;
  }
  .custom-scrollbar::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: #0f172a; 
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #334155; 
    border-radius: 5px;
    border: 2px solid #0f172a; 
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #475569; 
  }
`;
document.head.appendChild(style);

export default App;
