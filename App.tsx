import React, { useState, useEffect, useMemo } from 'react';
import { ParsedIR } from './types';
import { parseSlangIR } from './services/irParser';
import { analyzeFlow } from './services/geminiService';
import CodeEditor from './components/CodeEditor';
import DependencyGraph from './components/DependencyGraph';
import InfoPanel from './components/InfoPanel';
import { Layout, Play, FileText, MessageSquare, Sparkles } from 'lucide-react';

// Sample data from prompt
const SAMPLE_IR = `let  %1	: Void	= varLayout(%2, %3, %4, %5)
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
}`;

const App: React.FC = () => {
  const [irCode, setIrCode] = useState(SAMPLE_IR);
  const [parsedData, setParsedData] = useState<ParsedIR | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [globalAnalysis, setGlobalAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    const data = parseSlangIR(irCode);
    setParsedData(data);
  }, [irCode]);

  const handleNodeSelect = (id: string) => {
    setSelectedNodeId(id);
  };

  const handleAnalyzeGlobal = async () => {
    setIsAnalyzing(true);
    const result = await analyzeFlow(irCode);
    setGlobalAnalysis(result);
    setIsAnalyzing(false);
  };

  const selectedNode = useMemo(() => {
    if (!parsedData || !selectedNodeId) return null;
    return parsedData.nodes.get(selectedNodeId) || null;
  }, [parsedData, selectedNodeId]);

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-200 font-sans">
      {/* Header */}
      <header className="h-14 border-b border-slate-800 bg-slate-900 flex items-center px-6 justify-between shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-1.5 rounded text-white">
             <Layout size={20} />
          </div>
          <h1 className="font-bold text-lg tracking-tight text-slate-100">Slang IR <span className="text-indigo-400 font-light">Visualizer</span></h1>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsEditing(!isEditing)}
            className={`text-sm px-3 py-1.5 rounded border transition-colors flex items-center gap-2 ${isEditing ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}
          >
             <FileText size={14} />
             {isEditing ? 'Done Editing' : 'Edit Source'}
          </button>
           <button 
            onClick={handleAnalyzeGlobal}
            disabled={isAnalyzing}
            className="text-sm px-3 py-1.5 rounded bg-emerald-600 border border-emerald-500 text-white hover:bg-emerald-500 flex items-center gap-2 transition-all shadow-[0_0_10px_rgba(16,185,129,0.2)]"
          >
             {isAnalyzing ? <span className="animate-spin">⏳</span> : <MessageSquare size={14} />}
             Analyze Flow
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* Left: Code View */}
        <div className="w-1/3 min-w-[350px] border-r border-slate-800 flex flex-col">
          <div className="p-2 bg-slate-900/50 border-b border-slate-800 text-xs font-semibold text-slate-500 uppercase tracking-wider flex justify-between">
             <span>Source Code</span>
             <span className="text-indigo-400">{parsedData?.nodes.size || 0} Nodes Parsed</span>
          </div>
          <div className="flex-1 overflow-hidden p-2 relative">
             {isEditing ? (
               <textarea 
                 className="w-full h-full bg-slate-900 text-slate-300 p-4 font-mono text-sm rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                 value={irCode}
                 onChange={(e) => setIrCode(e.target.value)}
                 spellCheck={false}
               />
             ) : (
               <CodeEditor 
                 code={irCode} 
                 onChange={setIrCode} 
                 selectedNodeId={selectedNodeId}
                 onNodeSelect={handleNodeSelect}
               />
             )}
          </div>
        </div>

        {/* Middle: Graph View */}
        <div className="flex-1 flex flex-col bg-slate-950 relative">
           <div className="absolute top-4 left-4 z-10">
               {globalAnalysis && (
                   <div className="bg-emerald-900/90 border border-emerald-700 text-emerald-100 p-4 rounded-lg shadow-xl max-w-md text-sm backdrop-blur-sm animate-in fade-in slide-in-from-top-4">
                       <div className="flex justify-between items-start mb-2">
                           <h3 className="font-bold flex items-center gap-2"><Sparkles size={14}/> AI Analysis</h3>
                           <button onClick={() => setGlobalAnalysis(null)} className="text-emerald-400 hover:text-white">&times;</button>
                       </div>
                       <p className="leading-relaxed opacity-90">{globalAnalysis}</p>
                   </div>
               )}
           </div>
           <div className="flex-1 p-4">
             {parsedData && (
               <DependencyGraph 
                 parsedData={parsedData} 
                 onNodeClick={handleNodeSelect}
                 selectedNodeId={selectedNodeId}
               />
             )}
           </div>
        </div>

        {/* Right: Details Panel */}
        <div className="w-80 border-l border-slate-800 bg-slate-900/30">
           <InfoPanel 
             selectedNode={selectedNode} 
             contextCode={parsedData?.rawLines || []}
           />
        </div>

      </main>
    </div>
  );
};

// Add custom scrollbar styles via a style tag for simplicity
const style = document.createElement('style');
style.innerHTML = `
  .custom-scrollbar::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: #0f172a; 
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #334155; 
    border-radius: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #475569; 
  }
`;
document.head.appendChild(style);

export default App;