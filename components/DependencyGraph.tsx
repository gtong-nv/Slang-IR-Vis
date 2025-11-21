import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { IRNode, ParsedIR, IRGraphNode, IRGraphLink, IRNodeType } from '../types';

interface DependencyGraphProps {
  parsedData: ParsedIR;
  onNodeClick: (nodeId: string) => void;
  selectedNodeId: string | null;
}

const DependencyGraph: React.FC<DependencyGraphProps> = ({ parsedData, onNodeClick, selectedNodeId }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize simulation and graph structure
  useEffect(() => {
    if (!parsedData || !svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // Clear previous
    d3.select(svgRef.current).selectAll("*").remove();

    // Prepare Data
    const nodes: IRGraphNode[] = Array.from(parsedData.nodes.values()).map(n => ({
      id: n.id,
      label: n.opcode || n.id,
      type: n.type,
      details: n,
      radius: n.type === IRNodeType.Variable || n.type === IRNodeType.Function ? 25 : 15,
      group: n.type === IRNodeType.Block ? 1 : (n.opcode === 'varLayout' ? 2 : 3) 
    }));

    const nodeIds = new Set(nodes.map(n => n.id));
    const links: IRGraphLink[] = parsedData.edges
      .filter(e => nodeIds.has(e.from) && nodeIds.has(e.to))
      .map(e => ({
        source: e.from,
        target: e.to
      }));

    const svg = d3.select(svgRef.current)
      .attr("viewBox", [0, 0, width, height])
      .style("font-family", "sans-serif");

    // Create a container group for zoom
    const g = svg.append("g");

    // Zoom behavior applied to the main SVG, transforming the container 'g'
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });
    
    svg.call(zoom);

    // Arrow marker
    svg.append("defs").selectAll("marker")
      .data(["arrow"])
      .join("marker")
      .attr("id", d => d)
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 22) 
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("fill", "#94a3b8")
      .attr("d", "M0,-5L10,0L0,5");

    const simulation = d3.forceSimulation<IRGraphNode>(nodes)
      .force("link", d3.forceLink<IRGraphNode, IRGraphLink>(links).id(d => d.id).distance(80))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(d => (d.radius || 20) + 5));

    const link = g.append("g")
      .attr("stroke", "#475569")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", 1.5)
      .attr("marker-end", "url(#arrow)");

    // Create a group for each node to hold circle and text
    const node = g.append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .call(d3.drag<SVGGElement, IRGraphNode>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    // Node Circles
    node.append("circle")
      .attr("r", d => d.radius || 15)
      .attr("fill", getColor)
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .attr("cursor", "pointer")
      .on("click", (event, d) => {
        event.stopPropagation(); // Prevent drag/zoom interference
        onNodeClick(d.id);
      });

    // Labels (ID)
    node.append("text")
      .text(d => d.id.replace('%', ''))
      .attr("x", 0)
      .attr("y", 4)
      .attr("text-anchor", "middle")
      .attr("font-size", "10px")
      .attr("font-weight", "bold")
      .attr("fill", "white")
      .attr("pointer-events", "none");

    // Opcode labels (small below)
    node.append("text")
      .text(d => d.details.opcode ? d.details.opcode.slice(0, 8) : '')
      .attr("x", 0)
      .attr("y", d => (d.radius || 15) + 12)
      .attr("text-anchor", "middle")
      .attr("font-size", "9px")
      .attr("fill", "#cbd5e1")
      .attr("pointer-events", "none");

    simulation.on("tick", () => {
      link
        .attr("x1", d => (d.source as IRGraphNode).x!)
        .attr("y1", d => (d.source as IRGraphNode).y!)
        .attr("x2", d => (d.target as IRGraphNode).x!)
        .attr("y2", d => (d.target as IRGraphNode).y!);

      // Move the entire node group (circle + text)
      node
        .attr("transform", d => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event: d3.D3DragEvent<SVGGElement, IRGraphNode, unknown>, d: IRGraphNode) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: d3.D3DragEvent<SVGGElement, IRGraphNode, unknown>, d: IRGraphNode) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: d3.D3DragEvent<SVGGElement, IRGraphNode, unknown>, d: IRGraphNode) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    function getColor(d: IRGraphNode) {
      if (d.type === IRNodeType.Function) return "#ef4444";
      if (d.type === IRNodeType.Block) return "#8b5cf6";
      if (d.details.opcode === 'varLayout') return "#334155";
      return "#3b82f6";
    }

    return () => {
      simulation.stop();
    };
  }, [parsedData, onNodeClick]); // IMPORTANT: selectedNodeId is NOT here to avoid re-init

  // Separate effect for Selection Highlight
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);

    // Reset styles
    svg.selectAll<SVGCircleElement, IRGraphNode>("circle")
      .attr("fill", d => {
          if (d.id === selectedNodeId) return "#f59e0b"; // Amber for selected
          if (d.type === IRNodeType.Function) return "#ef4444";
          if (d.type === IRNodeType.Block) return "#8b5cf6";
          if (d.details.opcode === 'varLayout') return "#334155";
          return "#3b82f6";
      })
      .attr("stroke", d => d.id === selectedNodeId ? "#fcd34d" : "#fff")
      .attr("stroke-width", d => d.id === selectedNodeId ? 3 : 1.5);
      
      // Optional: Bring selected to front
      if (selectedNodeId) {
          svg.selectAll<SVGGElement, IRGraphNode>("g")
             .filter(d => d && d.id === selectedNodeId)
             .raise();
      }

  }, [selectedNodeId, parsedData]);

  return (
    <div ref={containerRef} className="w-full h-full relative bg-slate-900 overflow-hidden rounded-lg shadow-inner border border-slate-800">
      <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      <div className="absolute bottom-4 left-4 pointer-events-none bg-slate-950/80 p-2 rounded text-xs text-slate-400 border border-slate-800">
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-500"></span> Instruction</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-slate-600"></span> Layout/Meta</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-purple-500"></span> Block</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500"></span> Function</div>
      </div>
    </div>
  );
};

export default DependencyGraph;
