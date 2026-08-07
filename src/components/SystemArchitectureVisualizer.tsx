import React, { useCallback, useMemo, useEffect, useState } from 'react';
import ReactFlow, { 
  Background, Controls,
  applyNodeChanges, applyEdgeChanges, 
  BackgroundVariant, Handle, Position,
  NodeProps, Edge, Node
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { 
  Network, Server, Database, BrainCircuit, Shield, Monitor, 
  Workflow, Box, Globe, MessageSquare, Briefcase, Activity
} from 'lucide-react';
import { cn } from '../lib/utils';

// --- CUSTOM NODES ---

const ServiceNode = ({ data, isConnectable }: NodeProps) => {
  const isOffline = data.status === 'offline';
  const isDegraded = data.status === 'degraded';
  const Icon = data.icon;
  
  return (
    <button
      type="button"
      onClick={() => data.onOpen?.(data.serviceId)}
      className={cn(
        "px-3 py-2 rounded-xl border flex flex-col items-center justify-center relative backdrop-blur-md shadow-xl transition-all duration-300 min-w-[120px] text-left hover:-translate-y-0.5 hover:shadow-2xl focus:outline-none focus:ring-2 focus:ring-brand-primary/40",
        isOffline 
          ? "bg-brand-danger/10 border-brand-danger text-brand-danger" 
          : isDegraded 
            ? "bg-brand-warning/10 border-brand-warning text-brand-warning"
            : "bg-brand-elevated/80 border-brand-primary/40 text-brand-primary"
      )}
    >
      <Handle type="target" position={Position.Top} className="opacity-0" isConnectable={isConnectable} />
      <Handle type="source" position={Position.Bottom} className="opacity-0" isConnectable={isConnectable} />
      
      {/* Pulse effect */}
      <div className={cn(
        "absolute inset-0 blur-md rounded-xl opacity-20",
        isOffline ? "bg-brand-danger animate-pulse" : isDegraded ? "bg-brand-warning" : "bg-brand-primary"
      )} />
      
      <div className="relative z-10 flex flex-col items-center gap-1">
        <Icon className={cn("w-5 h-5", data.isAnimating ? "animate-pulse" : "")} />
        <span className={cn(
          "text-[10px] font-mono font-bold px-1.5 py-0.5 rounded",
          isOffline ? "text-brand-danger bg-brand-danger/20" : 
          isDegraded ? "text-brand-warning bg-brand-warning/20" : "text-white bg-black/40"
        )}>
          {data.label}
        </span>
        <span className="text-[9px] text-brand-text-muted">Open details</span>
      </div>
    </button>
  );
};

const nodeTypes = {
  service: ServiceNode,
};

export default function SystemArchitectureVisualizer() {
  const { healthMatrix } = useStore();
  const navigate = useNavigate();
  
  const getHealth = (id: string) => healthMatrix.find(h => h.id === id);
  const getStatus = (id: string, defaultStatus: 'online'|'degraded'|'offline' = 'online') => getHealth(id)?.status || defaultStatus;

  // Track recent activity to animate nodes
  const [activeNodes, setActiveNodes] = useState<Record<string, boolean>>({});

  // Drive node animation from real health matrix instead of random simulation
  useEffect(() => {
    if (!healthMatrix.length) return;
    const active: Record<string, boolean> = {};
    // Mark nodes as "active" (animated) only if their corresponding service is online per real health data
    healthMatrix.forEach(h => {
      if (h.status === 'online') {
        // Map health IDs to node IDs
        if (h.id === 'flask' || h.id === 'api') active['api'] = true;
        if (h.id === 'gemini') active['ai'] = true;
        if (h.id === 'supabase' || h.id === 'supa') active['supabase'] = true;
        if (h.id === 'redis') active['redis'] = true;
        if (h.id === 'socket') active['socket'] = true;
        if (h.id === 'facebook' || h.id === 'fb') active['fb'] = true;
        if (h.id === 'workers') active['workflow'] = true;
        if (h.id === 'play' || h.id === 'browser') active['browser'] = true;
        if (h.id === 'auth') active['auth'] = true;
        if (h.id === 'plugins') active['plugins'] = true;
        if (h.id === 'kb') active['kb'] = true;
      }
    });
    setActiveNodes(active);
  }, [healthMatrix]);

  const initialNodes: Node[] = useMemo(() => [
    { id: 'frontend', type: 'service', position: { x: 350, y: 50 }, data: { label: 'Frontend', icon: Monitor, status: 'online', isAnimating: activeNodes['frontend'], serviceId: 'frontend', onOpen: (serviceId: string) => navigate(`/services/${serviceId}`) } },
    
    { id: 'auth', type: 'service', position: { x: 150, y: 150 }, data: { label: 'Authentication', icon: Shield, status: getStatus('auth'), isAnimating: activeNodes['auth'], serviceId: 'auth', onOpen: (serviceId: string) => navigate(`/services/${serviceId}`) } },
    { id: 'api', type: 'service', position: { x: 350, y: 150 }, data: { label: 'API Gateway', icon: Network, status: getStatus('flask'), isAnimating: activeNodes['api'], serviceId: 'api', onOpen: (serviceId: string) => navigate(`/services/${serviceId}`) } },
    { id: 'socket', type: 'service', position: { x: 550, y: 150 }, data: { label: 'Socket.IO', icon: Activity, status: getStatus('socket'), isAnimating: activeNodes['socket'], serviceId: 'socket', onOpen: (serviceId: string) => navigate(`/services/${serviceId}`) } },
    
    { id: 'workflow', type: 'service', position: { x: 100, y: 280 }, data: { label: 'Workflow Engine', icon: Workflow, status: getStatus('workers'), isAnimating: activeNodes['workflow'], serviceId: 'workflow', onOpen: (serviceId: string) => navigate(`/services/${serviceId}`) } },
    { id: 'ai', type: 'service', position: { x: 350, y: 280 }, data: { label: 'AI Engine', icon: BrainCircuit, status: getStatus('gemini'), isAnimating: activeNodes['ai'], serviceId: 'ai', onOpen: (serviceId: string) => navigate(`/services/${serviceId}`) } },
    { id: 'plugins', type: 'service', position: { x: 600, y: 280 }, data: { label: 'Plugin Manager', icon: Box, status: getStatus('plugins'), isAnimating: activeNodes['plugins'], serviceId: 'plugins', onOpen: (serviceId: string) => navigate(`/services/${serviceId}`) } },
    
    { id: 'browser', type: 'service', position: { x: 50, y: 400 }, data: { label: 'Browser Pool', icon: Globe, status: getStatus('play'), isAnimating: activeNodes['browser'], serviceId: 'browser', onOpen: (serviceId: string) => navigate(`/services/${serviceId}`) } },
    { id: 'redis', type: 'service', position: { x: 200, y: 400 }, data: { label: 'Redis Cache', icon: Database, status: getStatus('redis'), isAnimating: activeNodes['redis'], serviceId: 'redis', onOpen: (serviceId: string) => navigate(`/services/${serviceId}`) } },
    { id: 'supabase', type: 'service', position: { x: 350, y: 400 }, data: { label: 'Supabase DB', icon: Server, status: getStatus('supa'), isAnimating: activeNodes['supabase'], serviceId: 'supabase', onOpen: (serviceId: string) => navigate(`/services/${serviceId}`) } },
    { id: 'kb', type: 'service', position: { x: 500, y: 400 }, data: { label: 'Knowledge Base', icon: Briefcase, status: getStatus('kb'), isAnimating: activeNodes['kb'], serviceId: 'kb', onOpen: (serviceId: string) => navigate(`/services/${serviceId}`) } },
    
    { id: 'fb', type: 'service', position: { x: 650, y: 400 }, data: { label: 'Facebook', icon: MessageSquare, status: getStatus('fb'), isAnimating: activeNodes['fb'], serviceId: 'fb', onOpen: (serviceId: string) => navigate(`/services/${serviceId}`) } },
    { id: 'tw', type: 'service', position: { x: 800, y: 400 }, data: { label: 'Twitter', icon: MessageSquare, status: 'online', isAnimating: activeNodes['tw'], serviceId: 'tw', onOpen: (serviceId: string) => navigate(`/services/${serviceId}`) } },
    { id: 'wa', type: 'service', position: { x: 950, y: 400 }, data: { label: 'WhatsApp', icon: MessageSquare, status: 'online', isAnimating: activeNodes['wa'], serviceId: 'wa', onOpen: (serviceId: string) => navigate(`/services/${serviceId}`) } },
  ], [healthMatrix, activeNodes, navigate]);

  const initialEdges: Edge[] = useMemo(() => [
    { id: 'e-front-api', source: 'frontend', target: 'api', animated: activeNodes['api'], style: { stroke: '#4F46E5', strokeWidth: 2 } },
    { id: 'e-front-auth', source: 'frontend', target: 'auth', animated: activeNodes['auth'], style: { stroke: '#4F46E5', strokeWidth: 2 } },
    { id: 'e-front-socket', source: 'frontend', target: 'socket', animated: activeNodes['socket'], style: { stroke: '#4F46E5', strokeWidth: 2 } },
    
    { id: 'e-api-wf', source: 'api', target: 'workflow', animated: activeNodes['workflow'], style: { stroke: '#1E293B', strokeWidth: 2 } },
    { id: 'e-api-ai', source: 'api', target: 'ai', animated: activeNodes['ai'], style: { stroke: '#1E293B', strokeWidth: 2 } },
    { id: 'e-api-pl', source: 'api', target: 'plugins', animated: activeNodes['plugins'], style: { stroke: '#1E293B', strokeWidth: 2 } },
    
    { id: 'e-wf-ai', source: 'workflow', target: 'ai', animated: activeNodes['ai'], style: { stroke: '#1E293B', strokeWidth: 1.5, strokeDasharray: '5 5' } },
    { id: 'e-wf-db', source: 'workflow', target: 'supabase', animated: activeNodes['supabase'], style: { stroke: '#1E293B', strokeWidth: 1.5 } },
    { id: 'e-wf-redis', source: 'workflow', target: 'redis', animated: activeNodes['redis'], style: { stroke: '#1E293B', strokeWidth: 1.5 } },
    { id: 'e-wf-browser', source: 'workflow', target: 'browser', animated: activeNodes['browser'], style: { stroke: '#1E293B', strokeWidth: 1.5 } },
    
    { id: 'e-ai-kb', source: 'ai', target: 'kb', animated: activeNodes['kb'], style: { stroke: '#1E293B', strokeWidth: 1.5 } },
    { id: 'e-ai-redis', source: 'ai', target: 'redis', animated: activeNodes['redis'], style: { stroke: '#1E293B', strokeWidth: 1.5 } },
    
    { id: 'e-pl-db', source: 'plugins', target: 'supabase', animated: activeNodes['supabase'], style: { stroke: '#1E293B', strokeWidth: 1.5 } },
    { id: 'e-pl-fb', source: 'plugins', target: 'fb', animated: activeNodes['fb'], style: { stroke: '#10B981', strokeWidth: 1.5 } },
    { id: 'e-pl-tw', source: 'plugins', target: 'tw', animated: activeNodes['tw'], style: { stroke: '#10B981', strokeWidth: 1.5 } },
    { id: 'e-pl-wa', source: 'socket', target: 'wa', animated: activeNodes['wa'], style: { stroke: '#10B981', strokeWidth: 1.5 } },
  ], [activeNodes]);

  const [nodes, setNodes] = useState<Node[]>(initialNodes as Node[]);
  const [edges, setEdges] = useState<Edge[]>(initialEdges as Edge[]);

  // Update nodes and edges when activeNodes or health changes
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges]);

  const onNodesChange = useCallback((changes: any) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes: any) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);

  return (
    <div className="bg-brand-surface rounded-2xl border border-brand-border flex flex-col relative overflow-hidden group h-full">
      <div className="flex-1 w-full h-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.5}
          maxZoom={1.5}
          className="bg-brand-surface"
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#1E293B" gap={20} variant={BackgroundVariant.Dots} size={2} />
          <Controls className="bg-brand-surface border-brand-border fill-white text-white opacity-50 hover:opacity-100" />
        </ReactFlow>
      </div>
    </div>
  );
}
