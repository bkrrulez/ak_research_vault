import React, { useEffect, useRef } from "react";
import * as d3 from "d3";

interface Node extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  type?: string;
}

interface Edge extends d3.SimulationLinkDatum<Node> {
  source: string | Node;
  target: string | Node;
  relation: string;
}

interface KnowledgeGraphProps {
  nodes: Node[];
  edges: Edge[];
}

export const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({ nodes, edges }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || nodes.length === 0) {
      console.log("[KnowledgeGraph] No data or refs missing", { nodes: nodes.length, svg: !!svgRef.current, container: !!containerRef.current });
      return;
    }

    console.log("[KnowledgeGraph] Initializing with data:", { nodesCount: nodes.length, edgesCount: edges.length });
    
    // Clear previous graph
    d3.select(svgRef.current).selectAll("*").remove();

    const width = containerRef.current.clientWidth || 800;
    const height = 800;

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height]);

    // Graph elements groups
    const g = svg.append("g");

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .extent([[0, 0], [width, height]])
      .scaleExtent([0.1, 8])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });
    
    svg.call(zoom);

    // Initial positioning - optional but helpful
    // svg.call(zoom.transform, d3.zoomIdentity.translate(width/2, height/2).scale(0.8).translate(-width/2, -height/2));

    // Resize handling
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width: newWidth } = entries[0].contentRect;
      if (newWidth > 0) {
        window.requestAnimationFrame(() => {
          if (!svgRef.current) return;
          svg.attr("width", newWidth);
          simulation.force("center", d3.forceCenter(newWidth / 2, height / 2));
          simulation.alpha(0.3).restart();
        });
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Clone data to avoid mutating original arrays
    const dataNodes = nodes.map(d => ({ ...d }));
    const nodeIds = new Set(dataNodes.map(d => d.id));
    
    // Filter out links that reference non-existent nodes
    const links = edges
      .filter(d => {
        const sourceId = typeof d.source === 'string' ? d.source : (d.source as any).id;
        const targetId = typeof d.target === 'string' ? d.target : (d.target as any).id;
        return nodeIds.has(sourceId) && nodeIds.has(targetId);
      })
      .map(d => ({ ...d }));

    // Simulation setup
    const simulation = d3.forceSimulation<Node>(dataNodes)
      .force("link", d3.forceLink<Node, Edge>(links).id(d => d.id).distance(150))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("x", d3.forceX(width / 2).strength(0.1))
      .force("y", d3.forceY(height / 2).strength(0.1));

    // Arrow marker for links
    svg.append("defs").append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "-0 -5 10 10")
      .attr("refX", 20)
      .attr("refY", 0)
      .attr("orient", "auto")
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("xalign", "center")
      .append("path")
      .attr("d", "M 0,-5 L 10 ,0 L 0,5")
      .attr("fill", "#94a3b8")
      .style("stroke", "none");

    // Link lines
    const link = g.append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "#e2e8f0")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", 2)
      .attr("marker-end", "url(#arrowhead)");

    // Link labels with improved visibility
    const linkText = g.append("g")
      .selectAll("text")
      .data(links)
      .join("text")
      .attr("font-size", "8px")
      .attr("fill", "#60a5fa") // Visible Blue
      .attr("text-anchor", "middle")
      .attr("font-weight", "bold")
      .attr("pointer-events", "none")
      .style("text-shadow", "0 0 4px rgba(0,0,0,0.5)") // Add depth
      .text(d => d.relation?.toUpperCase() || "");

    // Node circles
    const node = g.append("g")
      .selectAll<SVGCircleElement, Node>("circle")
      .data(dataNodes)
      .join("circle")
      .attr("r", 12)
      .attr("fill", d => {
        const type = d.type?.toLowerCase() || "";
        if (type.includes("person") || type.includes("individual")) return "#fbbf24"; // Amber
        if (type.includes("org") || type.includes("company") || type.includes("group") || type.includes("party")) return "#6366f1"; // Indigo
        if (type.includes("tech") || type.includes("concept") || type.includes("event") || type.includes("loc") || type.includes("country") || type.includes("city")) return "#10b981"; // Emerald/Green
        return "#94a3b8"; // Slate
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .call(drag(simulation));

    // Node labels
    const label = g.append("g")
      .selectAll("text")
      .data(dataNodes)
      .join("text")
      .attr("dx", 15)
      .attr("dy", 4)
      .attr("font-size", "10px")
      .attr("font-weight", "600")
      .attr("fill", "#f8fafc") // Visible white/slate-50
      .style("text-shadow", "0 1px 2px rgba(0,0,0,0.8)")
      .text(d => d.label);

    // Hover interactions
    node.on("mouseover", function(event, d) {
      d3.select(this).transition().duration(200).attr("r", 16).attr("stroke", "#4f46e5");
      
      // Highlight connected links
      link.attr("stroke", l => (l.source === d || l.target === d) ? "#4f46e5" : "#e2e8f0")
          .attr("stroke-opacity", l => (l.source === d || l.target === d) ? 1 : 0.2);
    })
    .on("mouseout", function() {
      d3.select(this).transition().duration(200).attr("r", 12).attr("stroke", "#fff");
      link.attr("stroke", "#e2e8f0").attr("stroke-opacity", 0.6);
    });

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      linkText
        .attr("x", (d: any) => (d.source.x + d.target.x) / 2)
        .attr("y", (d: any) => (d.source.y + d.target.y) / 2);

      node
        .attr("cx", (d: any) => d.x)
        .attr("cy", (d: any) => d.y);

      label
        .attr("x", (d: any) => d.x)
        .attr("y", (d: any) => d.y);
    });

    function drag(simulation: d3.Simulation<Node, Edge>) {
      function dragstarted(event: any) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      }
      
      function dragged(event: any) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      }
      
      function dragended(event: any) {
        if (!event.active) simulation.alphaTarget(0);
        // We do NOT set fx/fy to null to make the nodes "sticky"
      }
      
      return d3.drag<SVGCircleElement, Node>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
    }

    return () => {
      simulation.stop();
      resizeObserver.disconnect();
    };
  }, [nodes, edges]);

  return (
    <div ref={containerRef} className="w-full min-h-[800px] bg-transparent overflow-hidden">
      <svg ref={svgRef} className="w-full h-full cursor-move" style={{ minHeight: "800px" }} />
    </div>
  );
};
