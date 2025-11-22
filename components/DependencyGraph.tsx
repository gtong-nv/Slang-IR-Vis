
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { ParsedIR, IRGraphNode, IRGraphLink, IRNodeType, IRNode } from '../types';

interface DependencyGraphProps {
  parsedData: ParsedIR;
  onNodeClick: (nodeId: string) => void;
  selectedNodeId: string | null;
}

const DependencyGraph: React.FC<DependencyGraphProps> = ({ parsedData, onNodeClick, selectedNodeId }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Refs to access simulation state and D3 objects inside effects without creating dependencies
  const nodesRef = useRef<IRGraphNode[]>([]);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const svgSelectionRef = useRef<d3.Selection<SVGSVGElement, unknown, null, undefined> | null>(null);

  // Initialize simulation and graph structure
  useEffect(() => {
    if (!parsedData || !svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // Clear previous
    d3.select(svgRef.current).selectAll("*").remove();

    // Prepare Data
    const nodes: IRGraphNode[] = Array.from(parsedData.nodes.values()).map((n: IRNode) => ({
      id: n.id,
      label: n.opcode || n.id,
      type: n.type,
      details: n,
      radius: n.type === IRNodeType.Variable || n.type === IRNodeType.Function ? 25 : 15,
      group: n.type === IRNodeType.Block ? 1 : (n.opcode === 'varLayout' ? 2 : 3),
      parentBlockId: n.parentBlockId
    }));
    
    // Update Ref
    nodesRef.current = nodes;

    const nodeIds = new Set(nodes.map(n => n.id));
    
    // Standard dependency links
    const dependencyLinks: IRGraphLink[] = parsedData.edges
      .filter(e => nodeIds.has(e.from) && nodeIds.has(e.to))
      .map(e => ({
        source: e.from,
        target: e.to,
        kind: 'dependency'
      }));
      
    // Structural links (Child -> Block) to keep them grouped via forces (invisible)
    const structuralLinks: IRGraphLink[] = nodes
      .filter(n => n.parentBlockId && nodeIds.has(n.parentBlockId))
      .map(n => ({
          source: n.id,
          target: n.parentBlockId!,
          kind: 'structural'
      }));

    const allLinks = [...dependencyLinks, ...structuralLinks];

    const svg = d3.select(svgRef.current)
      .attr("viewBox", [0, 0, width, height])
      .style("font-family", "sans-serif");
      
    svgSelectionRef.current = svg;

    // Create a container group for zoom
    const g = svg.append("g").attr("class", "zoom-container");

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });
    
    zoomRef.current = zoom;
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
      .force("link", d3.forceLink<IRGraphNode, IRGraphLink>(allLinks)
            .id(d => d.id)
            .distance(d => d.kind === 'structural' ? 40 : 100) // Tighter for structure
            .strength(d => d.kind === 'structural' ? 0.05 : 1) // Weak pull for structure, just a suggestion
      )
      .force("charge", d3.forceManyBody<IRGraphNode>().strength(d => d.type === IRNodeType.Block ? -800 : -400))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide<IRGraphNode>().radius(d => (d.radius || 20) + 20)); 

    // Layer for Block Group Rectangles (Behind everything)
    const groupLayer = g.append("g").attr("class", "groups");
    const groupRects = groupLayer.selectAll("rect")
        .data(nodes.filter(n => n.type === IRNodeType.Block))
        .join("rect")
        .attr("rx", 8)
        .attr("ry", 8)
        .attr("fill", "rgba(139, 92, 246, 0.05)") // Light purple background
        .attr("stroke", "#8b5cf6") // Purple border
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "4,4")
        .attr("opacity", 0.8);

    // Separate group for links
    const linkGroup = g.append("g").attr("class", "links");
    
    const link = linkGroup
      .attr("stroke", "#475569")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(dependencyLinks) // Only visualize dependency links
      .join("line")
      .attr("stroke-width", 1.5)
      .attr("marker-end", "url(#arrow)");

    // Separate group for nodes
    const nodeGroup = g.append("g").attr("class", "nodes");

    const node = nodeGroup
      .selectAll<SVGGElement, IRGraphNode>("g")
      .data(nodes)
      .join("g")
      .attr("class", "node-group") 
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
        event.stopPropagation();
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

    // Opcode labels
    node.append("text")
      .text(d => d.details.opcode ? d.details.opcode : '')
      .attr("x", 0)
      .attr("y", d => (d.radius || 15) + 12)
      .attr("text-anchor", "middle")
      .attr("font-size", "9px")
      .attr("fill", "#cbd5e1")
      .attr("pointer-events", "none")
      .style("text-shadow", "2px 2px 4px #000000"); 

    simulation.on("tick", () => {
      link
        .attr("x1", d => (d.source as IRGraphNode).x!)
        .attr("y1", d => (d.source as IRGraphNode).y!)
        .attr("x2", d => (d.target as IRGraphNode).x!)
        .attr("y2", d => (d.target as IRGraphNode).y!);

      node
        .attr("transform", d => `translate(${d.x},${d.y})`);

      // Update Group Rects
      groupRects.each(function(d) {
          // Find all nodes that belong to this block + the block node itself
          const children = nodes.filter(n => n.parentBlockId === d.id || n.id === d.id);
          
          if (children.length > 0) {
              const xCoords = children.map(c => c.x!).filter(x => x !== undefined);
              const yCoords = children.map(c => c.y!).filter(y => y !== undefined);
              
              if (xCoords.length > 0 && yCoords.length > 0) {
                  const x0 = Math.min(...xCoords);
                  const x1 = Math.max(...xCoords);
                  const y0 = Math.min(...yCoords);
                  const y1 = Math.max(...yCoords);
                  const padding = 30;

                  d3.select(this)
                    .attr("x", x0 - padding)
                    .attr("y", y0 - padding)
                    .attr("width", x1 - x0 + padding * 2)
                    .attr("height", y1 - y0 + padding * 2);
              }
          }
      });
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
      if (d.type === IRNodeType.Struct) return "#ec4899";
      if (d.type === IRNodeType.Parameter) return "#f97316";
      if (d.details.opcode === 'varLayout') return "#334155";
      return "#3b82f6";
    }

    return () => {
      simulation.stop();
    };
  }, [parsedData, onNodeClick]); 

  // Handle Node Selection (Highlight + Zoom)
  useEffect(() => {
    if (!svgRef.current || !zoomRef.current || !svgSelectionRef.current) return;
    
    const svg = d3.select(svgRef.current);

    // 1. Visual Highlight
    svg.selectAll<SVGCircleElement, IRGraphNode>("circle")
      .attr("fill", d => {
          if (d.id === selectedNodeId) return "#f59e0b"; // Selected Color
          if (d.type === IRNodeType.Function) return "#ef4444";
          if (d.type === IRNodeType.Block) return "#8b5cf6";
          if (d.type === IRNodeType.Struct) return "#ec4899";
          if (d.type === IRNodeType.Parameter) return "#f97316";
          if (d.details.opcode === 'varLayout') return "#334155";
          return "#3b82f6";
      })
      .attr("stroke", d => d.id === selectedNodeId ? "#fcd34d" : "#fff")
      .attr("stroke-width", d => d.id === selectedNodeId ? 3 : 1.5);

    // Raise selected node group
    if (selectedNodeId) {
      svg.selectAll(".node-group")
         .filter((d: any) => d.id === selectedNodeId)
         .raise();
    }

    // 2. Zoom to Center Logic
    if (selectedNodeId && containerRef.current) {
      const node = nodesRef.current.find(n => n.id === selectedNodeId);
      
      if (node && typeof node.x === 'number' && typeof node.y === 'number') {
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;
        const scale = 1.5; 
        
        const tx = width / 2 - node.x * scale;
        const ty = height / 2 - node.y * scale;

        const transform = d3.zoomIdentity.translate(tx, ty).scale(scale);

        svgSelectionRef.current.transition()
          .duration(750) 
          .call(zoomRef.current.transform, transform);
      }
    }

  }, [selectedNodeId]); 

  return (
    <div ref={containerRef} className="w-full h-full relative bg-slate-900 overflow-hidden rounded-lg shadow-inner border border-slate-800">
      <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      <div className="absolute bottom-4 left-4 pointer-events-none bg-slate-950/80 p-2 rounded text-xs text-slate-400 border border-slate-800 z-20">
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-500"></span> Instruction</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-slate-600"></span> Layout/Meta</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-purple-500"></span> Block</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500"></span> Function</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-pink-500"></span> Struct</div>
      </div>
    </div>
  );
};

export default DependencyGraph;
