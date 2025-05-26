"use client";

import {
  useState, useEffect, useMemo, useCallback, useRef, memo,
} from "react";
import ReactFlow, {
  Controls,
  Background,
  MarkerType,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
} from "reactflow";
import "reactflow/dist/style.css";
import {
  ArrowRight, GitMerge, Calendar, FileText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Autocomplete, TextField } from "@mui/material";
import axios from "axios";
import CHAT_QNA_URL from "@/lib/constants";

interface Circular {
  circular_id: string;
  title: string;
  tags: string[];
  date: string;
  url: string;
  bookmark: boolean;
  references?: string[];
  versions?: string[];
}

interface GraphResult {
  nodes: Node[];
  edges: Edge[];
}

interface ApiResponse {
  main_node: Circular;
  version_nodes: Circular[];
  refers_nodes: Circular[];
}

interface GraphState {
  allNodes: Node[];
  allEdges: Edge[];
  loading: boolean;
  error: string | null;
}

// Memoized CircularNodeCard component
const CircularNodeCard = memo(({ circular }: { circular: Circular }) => (
  <div className="flex flex-col gap-1 w-auto">
    <div className="flex gap-2">
      <FileText className="h-4 w-4 text-primary flex-shrink-0" />
      <span className="text-left font-medium break-words whitespace-normal">
        {circular.title}
      </span>
    </div>
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <Calendar className="h-3 w-3" />
      <span>{circular.date}</span>
    </div>
  </div>
));

CircularNodeCard.displayName = "CircularNodeCard";

// Custom hook for circular graph management
const useCircularGraph = (currentSourceId: string, setCircularOptions: React.Dispatch<React.SetStateAction<Circular[]>>) => {
  const [graphState, setGraphState] = useState<GraphState>({
    allNodes: [],
    allEdges: [],
    loading: false,
    error: null,
  });

  const cache = useRef(new Map<string, ApiResponse>());

  const fetchCircularGraph = useCallback(
    async (circularId: string): Promise<ApiResponse> => {
      // Check cache first
      if (cache.current.has(circularId)) {
        return cache.current.get(circularId)!;
      }

      try {
        const response = await axios.get(
          `${CHAT_QNA_URL}/api/circular-related`,
          {
            params: { circular_id: circularId },
          },
        );

        // Cache the result
        cache.current.set(circularId, response.data);
        return response.data;
      } catch (fetchError) {
        throw new Error(`Error fetching circular graph: ${fetchError}`);
      }
    },
    [],
  );

  const generateGraphData = useCallback(
    (graphSourceId: string, circularData: Circular[]): GraphResult => {
      const sourceCircular = circularData.find(
        (c) => c.circular_id === graphSourceId,
      );
      if (!sourceCircular) return { nodes: [], edges: [] };

      const nodes: Node[] = [];
      const edges: Edge[] = [];
      const relatedIds = [
        ...(sourceCircular.references || []),
        ...(sourceCircular.versions || []),
      ];

      const nodeStyle = {
        border: "1px solid #000000",
        maxWidth: "320px",
        width: "auto",
        borderRadius: "0.5rem",
        padding: "0.5rem",
        whiteSpace: "normal" as const,
        wordWrap: "break-word" as const,
      };

      // Source node
      nodes.push({
        id: sourceCircular.circular_id,
        data: {
          label: <CircularNodeCard circular={sourceCircular} />,
          circular: sourceCircular,
          type: "source",
        },
        position: { x: 450, y: 50 },
        className: "bg-white rounded-lg p-2 w-auto",
        style: nodeStyle,
        type: "default",
      });

      const relatedCirculars = circularData.filter((c) => relatedIds.includes(c.circular_id));
      const versionCirculars = relatedCirculars.filter((c) => (sourceCircular.versions
        || []).includes(c.circular_id));
      const referenceCirculars = relatedCirculars.filter((c) => (sourceCircular.references
        || []).includes(c.circular_id));

      const horizontalSpacing = 350;
      const versionStartX = Math.max(
        50,
        300 - (versionCirculars.length * horizontalSpacing) / 2,
      );
      const referenceStartX = Math.max(
        50,
        300 - (referenceCirculars.length * horizontalSpacing) / 2,
      );

      // Version nodes
      versionCirculars.forEach((c, i) => {
        nodes.push({
          id: c.circular_id,
          data: {
            label: <CircularNodeCard circular={c} />,
            circular: c,
            type: "version",
          },
          position: { x: versionStartX + i * horizontalSpacing, y: 250 },
          className: "bg-white rounded-lg p-2 w-auto",
          style: nodeStyle,
          type: "default",
        });

        edges.push({
          id: `e${sourceCircular.circular_id}-${c.circular_id}`,
          source: sourceCircular.circular_id,
          target: c.circular_id,
          label: "Version",
          labelStyle: { fill: "#7c3aed", fontWeight: 700 },
          style: { stroke: "#7c3aed", strokeWidth: 3 },
          animated: true,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 20,
            height: 20,
            color: "#7c3aed",
          },
          data: { type: "version" },
        });
      });

      // Reference nodes
      referenceCirculars.forEach((c, i) => {
        nodes.push({
          id: c.circular_id,
          data: {
            label: <CircularNodeCard circular={c} />,
            circular: c,
            type: "reference",
          },
          position: { x: referenceStartX + i * horizontalSpacing, y: 450 },
          className: "bg-white rounded-lg p-2 w-auto",
          style: nodeStyle,
          type: "default",
        });

        edges.push({
          id: `e${sourceCircular.circular_id}-${c.circular_id}`,
          source: sourceCircular.circular_id,
          target: c.circular_id,
          label: "Refers",
          labelStyle: { fill: "#0ea5e9", fontWeight: 700 },
          style: { stroke: "#0ea5e9", strokeWidth: 3 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 20,
            height: 20,
            color: "#0ea5e9",
          },
          data: { type: "reference" },
        });
      });

      return { nodes, edges };
    },
    [],
  );

  useEffect(() => {
    if (!currentSourceId) return;

    async function loadData() {
      setGraphState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const graphData = await fetchCircularGraph(currentSourceId);

        const enrichedSource = {
          ...graphData.main_node,
          references: (graphData.refers_nodes || []).map(
            (c) => c.circular_id,
          ),
          versions: (graphData.version_nodes || []).map(
            (c) => c.circular_id,
          ),
        };

        const allCirculars = [
          enrichedSource,
          ...(graphData.refers_nodes || []),
          ...(graphData.version_nodes || []),
        ];

        setCircularOptions(prevOptions => {
          const existingIds = new Set(prevOptions.map(c => c.circular_id));
          const filteredNew = allCirculars.filter(c => !existingIds.has(c.circular_id));
          return [...prevOptions, ...filteredNew];
        });

        const {
          nodes: newNodes,
          edges: newEdges,
        } = generateGraphData(currentSourceId, allCirculars);

        setGraphState({
          allNodes: newNodes,
          allEdges: newEdges,
          loading: false,
          error: null,
        });
      } catch (graphError) {
        setGraphState((prev) => ({
          ...prev,
          loading: false,
          error: `Failed to load circular data: ${graphError}`,
        }));
      }
    }

    loadData();
  }, [currentSourceId, fetchCircularGraph, generateGraphData]);

  return graphState;
};

export default function CircularVisualization({ source }: { source: Circular }) {
  const [filter, setFilter] = useState<"all" | "version" | "reference">("all");
  const [currentSourceId, setCurrentSourceId] = useState(source.circular_id);
  const [circularOptions, setCircularOptions] = useState<Circular[]>([source]);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [history, setHistory] = useState<string[]>([
    source.circular_id,
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const {
    allNodes,
    allEdges,
    loading: graphLoading,
    error: graphError,
  } = useCircularGraph(currentSourceId, setCircularOptions);

  // Memoized filter application
  const { filteredNodes, filteredEdges } = useMemo(() => {
    if (filter === "all") {
      return { filteredNodes: allNodes, filteredEdges: allEdges };
    }

    const sourceNode = allNodes.find((node) => node.data.type === "source");
    const edgesByType = allEdges.filter((edge) => edge.data?.type === filter);

    const connectedNodeIds = new Set<string>();
    if (sourceNode) connectedNodeIds.add(sourceNode.id);

    edgesByType.forEach((edge) => {
      connectedNodeIds.add(edge.source);
      connectedNodeIds.add(edge.target);
    });

    const nodesByConnection = allNodes.filter((node) => connectedNodeIds.has(node.id));

    return { filteredNodes: nodesByConnection, filteredEdges: edgesByType };
  }, [allNodes, allEdges, filter]);

  // Update ReactFlow nodes and edges when filtered data changes
  useEffect(() => {
    setNodes(filteredNodes);
    setEdges(filteredEdges);
  }, [filteredNodes, filteredEdges, setNodes, setEdges]);

  const handleNavigate = useCallback(
    (direction: "back" | "forward") => {
      const newIndex = direction === "back" ? historyIndex - 1 : historyIndex + 1;
      if (newIndex >= 0 && newIndex < history.length) {
        setHistoryIndex(newIndex);
        setCurrentSourceId(history[newIndex]);
      }
    },
    [historyIndex, history],
  );

  const getCurrentCircular = useCallback(
    () => circularOptions.find((c) => c.circular_id === currentSourceId)?.title
    || "Unknown Circular",
    [circularOptions, currentSourceId],
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.id !== currentSourceId) {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(node.id);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
        setCurrentSourceId(node.id);
      }
    },
    [currentSourceId, history, historyIndex],
  );

  const handleSourceChange = useCallback(
    (newValue: Circular | null) => {
      if (newValue && newValue.circular_id !== currentSourceId) {
        setCurrentSourceId(newValue.circular_id);
        setHistory([newValue.circular_id]);
        setHistoryIndex(0);
      }
    },
    [currentSourceId],
  );

  const handleClickInside = (event: React.MouseEvent) => {
    event.stopPropagation();
  };

  const combinedError = graphError;
  const loading = graphLoading;

  if (combinedError) {
    return (
      <div className="w-full h-96 flex items-center justify-center border rounded-lg">
        <div className="text-center">
          <p className="text-red-600 mb-2">Error loading visualization</p>
          <p className="text-sm text-gray-600">{combinedError}</p>
        </div>
      </div>
    );
  }

  return (
    <div onClick={handleClickInside} style={{ width: '100%', height: '100%' }}>
      <div className="w-full h-[530px] border rounded-lg relative">
        {loading && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p>Loading visualization...</p>
            </div>
          </div>
        )}

        {/* Top-left: Controls */}
        <div className="absolute top-2 left-2 z-10 flex flex-col gap-2">
          {/* Filter Panel */}
          <div className="bg-white p-2 rounded-md shadow-sm border">
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">Filter Relationships</h3>
              <div className="flex gap-2">
                <Badge
                  onClick={() => setFilter("all")}
                  variant={filter === "all" ? "default" : "outline"}
                  className="cursor-pointer"
                >
                  All
                </Badge>
                <Badge
                  onClick={() => setFilter("version")}
                  variant={filter === "version" ? "default" : "outline"}
                  className="cursor-pointer"
                >
                  <GitMerge className="h-3 w-3 mr-1" /> Versions
                </Badge>
                <Badge
                  onClick={() => setFilter("reference")}
                  variant={filter === "reference" ? "default" : "outline"}
                  className="cursor-pointer"
                >
                  <ArrowRight className="h-3 w-3 mr-1" /> References
                </Badge>
              </div>
            </div>
          </div>

          {/* Navigation Panel */}
          <div className="bg-white p-2 rounded-md shadow-sm border">
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">Navigation History</h3>
              <p className="text-xs text-muted-foreground truncate max-w-xs">
                Currently viewing: {getCurrentCircular()}
              </p>
              <div className="flex gap-2">
                <button
                  disabled={historyIndex === 0}
                  onClick={() => handleNavigate("back")}
                  className="flex items-center gap-1 text-xs border rounded px-3 py-1 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={
                    historyIndex > 0
                      ? `Go back to: ${
                        circularOptions.find(
                          (c) => c.circular_id === history[historyIndex - 1],
                        )?.title
                      }`
                      : "No previous history"
                  }
                >
                  <ArrowRight className="h-3 w-3 rotate-180" /> Back
                </button>
                <button
                  disabled={historyIndex === history.length - 1}
                  onClick={() => handleNavigate("forward")}
                  className="flex items-center gap-1 text-xs border rounded px-3 py-1 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={
                    historyIndex < history.length - 1
                      ? `Go forward to: ${
                        circularOptions.find(
                          (c) => c.circular_id === history[historyIndex + 1],
                        )?.title
                      }`
                      : "No forward history"
                  }
                >
                  Forward <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Top-right: Legend */}
        <div className="absolute top-2 right-2 z-10 bg-white p-2 rounded-md shadow-sm border">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-[#7c3aed]" />
              <span className="text-xs">Version</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-[#0ea5e9]" />
              <span className="text-xs">Reference</span>
            </div>
          </div>
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          fitView
          minZoom={0.5}
          maxZoom={2}
          attributionPosition="bottom-left"
        >
          <Controls />
          <Background color="#f8f8f8" gap={16} />
        </ReactFlow>
      </div>
    </div>
  );
}
