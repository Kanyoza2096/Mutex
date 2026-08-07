import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ReactFlow, {
  Background, Controls, MiniMap,
  applyNodeChanges, applyEdgeChanges,
  addEdge, BackgroundVariant, Handle, Position,
  Node, Edge, Connection, NodeProps
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  GitBranch, Play, Pause, RefreshCcw, Activity,
  BrainCircuit, Database, Globe, Clock, AlertCircle,
  Zap, CheckCircle2, XCircle, Hourglass, History,
  Cpu, Radio,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useStore } from '../store/useStore';
import { fetchWorkflowStatus, pauseWorkflow, resumeWorkflow, triggerPost } from '../lib/api';
import { toast } from 'sonner';

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM NODES
// ═══════════════════════════════════════════════════════════════════════════

const STATUS_META: Record<string, { icon: React.ComponentType<any>; color: string; bg: string; border: string }> = {
  running: { icon: Activity, color: '#818cf8', bg: 'bg-violet-500/10', border: 'border-violet-500/40' },
  success: { icon: CheckCircle2, color: '#34d399', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  error: { icon: XCircle, color: '#ef4444', bg: 'bg-red-500/10', border: 'border-red-500/40' },
  idle: { icon: Hourglass, color: '#71717a', bg: 'bg-zinc-500/5', border: 'border-zinc-700/30' },
  paused: { icon: Pause, color: '#f59e0b', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
};

const TYPE_META: Record<string, { icon: React.ComponentType<any>; color: string; ring: string }> = {
  trigger: { icon: Clock, color: '#f59e0b', ring: 'ring-amber-500/10' },
  ai: { icon: BrainCircuit, color: '#818cf8', ring: 'ring-violet-500/20' },
  db: { icon: Database, color: '#06b6d4', ring: 'ring-cyan-500/10' },
  social: { icon: Globe, color: '#34d399', ring: 'ring-emerald-500/10' },
};

function CustomNode({ data, type }: { data: any; type: string }) {
  const meta = STATUS_META[data.status] || STATUS_META.idle;
  const typeMeta = TYPE_META[type] || TYPE_META.trigger;
  const StatusIcon = meta.icon;
  const TypeIcon = typeMeta.icon;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      whileHover={{ scale: 1.03, y: -2 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'relative px-4 py-3.5 rounded-xl border bg-brand-surface/95 backdrop-blur-xl min-w-[220px] transition-all duration-200',
        meta.border, typeMeta.ring,
        'hover:border-brand-primary/30 hover:shadow-xl'
      )}
    >
      {data.status === 'running' && (
        <div className="absolute inset-0 rounded-xl pointer-events-none animate-pulse" style={{ boxShadow: '0 0 20px rgba(129,140,248,0.12)' }} />
      )}

      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-brand-surface !border-2 !border-brand-text-muted hover:!border-brand-primary transition-colors" />

      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2.5">
          <div className={cn('p-1.5 rounded-lg', meta.bg)}>
            <TypeIcon className="w-4 h-4" style={{ color: typeMeta.color }} />
          </div>
          <span className="text-xs font-bold text-white uppercase tracking-wider">{data.label}</span>
        </div>
        <StatusIcon className="w-3.5 h-3.5" style={{ color: meta.color }} />
      </div>

      <p className="text-[10px] text-brand-text-muted font-mono leading-relaxed">{data.subLabel || 'Configure node properties'}</p>

      {data.status === 'running' && data.progress !== undefined && (
        <div className="mt-2.5 w-full bg-brand-elevated rounded-full h-1 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ backgroundColor: meta.color, width: `${Math.min(100, data.progress)}%` }} />
        </div>
      )}

      {data.status === 'error' && data.error && (
        <p className="mt-2 text-[9px] text-red-400 font-mono truncate max-w-[200px]">{data.error}</p>
      )}

      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-brand-surface !border-2 !border-brand-primary hover:!border-brand-accent transition-colors" />
    </motion.div>
  );
}

const TriggerNode = (props: NodeProps) => <CustomNode {...props} type="trigger" />;
const AINode = (props: NodeProps) => <CustomNode {...props} type="ai" />;
const DBNode = (props: NodeProps) => <CustomNode {...props} type="db" />;
const SocialNode = (props: NodeProps) => <CustomNode {...props} type="social" />;

const nodeTypes = { trigger: TriggerNode, ai: AINode, db: DBNode, social: SocialNode };

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function applyWorkflowStatus(nodes: Node[], wf: { status: string; current_step?: string; progress?: number } | undefined): Node[] {
  if (!wf) return nodes;
  const { status, current_step, progress } = wf;
  const step = (current_step || '').toLowerCase();

  return nodes.map(node => {
    let nodeStatus: string = 'idle';
    let nodeProgress: number | undefined;

    if (status === 'running') {
      const matches =
        node.data.label.toLowerCase().includes(step) ||
        node.id === step ||
        (step.includes('trigger') && node.id === '1') ||
        ((step.includes('ai') || step.includes('gemini')) && node.id === '2') ||
        ((step.includes('supabase') || step.includes('db') || step.includes('sync')) && node.id === '3') ||
        ((step.includes('publish') || step.includes('facebook') || step.includes('social')) && node.id === '4');

      if (matches) {
        nodeStatus = 'running';
        nodeProgress = progress;
      } else {
        const stepNodeMap: Record<string, string> = { trigger: '1', ai: '2', gemini: '2', supabase: '3', db: '3', sync: '3', publish: '4', facebook: '4', social: '4' };
        const currentStepNode = stepNodeMap[step] || '0';
        nodeStatus = parseInt(node.id) < parseInt(currentStepNode) ? 'success' : 'idle';
      }
    } else if (status === 'paused') {
      nodeStatus = 'paused';
    } else if (status === 'error') {
      nodeStatus = 'error';
    }

    // Only update if status changed to avoid unnecessary re-renders
    if (node.data.status === nodeStatus && node.data.progress === nodeProgress) return node;
    return { ...node, data: { ...node.data, status: nodeStatus, progress: nodeProgress } };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function Workflows() {
  const { restEndpoint, masterToken, selectedBrandId, workflowMetrics, aiProviderHealth } = useStore();
  const cfg = { restEndpoint, masterToken };

  // Base topology — stable reference
  const baseNodes = useMemo<Node[]>(() => [
    { id: '1', type: 'trigger', position: { x: 50, y: 150 }, data: { label: 'CRON Trigger', subLabel: 'Scheduled content posting', status: 'idle' } },
    { id: '2', type: 'ai', position: { x: 380, y: 150 }, data: { label: 'Gemini AI', subLabel: 'Generate engaging content', status: 'idle' } },
    { id: '3', type: 'db', position: { x: 730, y: 40 }, data: { label: 'Supabase Sync', subLabel: 'Store generation history', status: 'idle' } },
    { id: '4', type: 'social', position: { x: 730, y: 260 }, data: { label: 'Publish', subLabel: 'Post to configured pages', status: 'idle' } },
  ], []);

  const baseEdges = useMemo<Edge[]>(() => [
    { id: 'e1-2', source: '1', target: '2', animated: false, style: { stroke: '#27272a', strokeWidth: 2 }, type: 'smoothstep' },
    { id: 'e2-3', source: '2', target: '3', animated: false, style: { stroke: '#27272a', strokeWidth: 2 }, type: 'smoothstep' },
    { id: 'e2-4', source: '2', target: '4', animated: false, style: { stroke: '#27272a', strokeWidth: 2 }, type: 'smoothstep' },
  ], []);

  const [userEdges, setUserEdges] = useState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const onNodesChange = useCallback((changes: any) => setNodes(nds => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes: any) => setEdges(eds => applyEdgeChanges(changes, eds)), []);
  const onConnect = useCallback((params: Connection) => {
    setUserEdges(eds => addEdge({ ...params, type: 'smoothstep', style: { stroke: '#4F46E5', strokeWidth: 2 } }, eds));
  }, []);

  // ── Workflow status query ────────────────────────────────────────────────
  const { data: wfStatus, isError: wfError, refetch, isFetching } = useQuery({
    queryKey: ['workflow-status', restEndpoint],
    queryFn: () => fetchWorkflowStatus(cfg),
    retry: 2,
    staleTime: 8_000,
    refetchInterval: 8_000,
  });

  const isRunning = wfStatus?.status === 'running';
  const isPaused = wfStatus?.status === 'paused';

  // Derive nodes/edges from status — no useEffect, no state replacement
  const derivedNodes = useMemo(() => applyWorkflowStatus(baseNodes, wfStatus), [baseNodes, wfStatus]);
  const derivedEdges = useMemo(() => {
    const statusEdges = baseEdges.map(e => ({
      ...e,
      animated: isRunning,
      style: { ...e.style, stroke: isRunning ? '#4F46E5' : '#27272a', strokeWidth: isRunning ? 2.5 : 2 },
    }));
    return [...statusEdges, ...userEdges];
  }, [baseEdges, isRunning, userEdges]);

  // Use state for nodes so ReactFlow can manage internal positions
  const [nodes, setNodes] = useState<Node[]>(derivedNodes);
  const [edges, setEdges] = useState<Edge[]>(derivedEdges);

  // Sync derived nodes into ReactFlow state without resetting positions
  React.useEffect(() => {
    setNodes(prev => {
      return derivedNodes.map(dn => {
        const existing = prev.find(p => p.id === dn.id);
        if (existing) {
          // Preserve user-moved position, only update data
          return { ...existing, data: dn.data };
        }
        return dn;
      });
    });
  }, [derivedNodes]);

  React.useEffect(() => {
    setEdges(prev => {
      const baseIds = new Set(baseEdges.map(e => e.id));
      const userOnes = prev.filter(e => !baseIds.has(e.id));
      return [...derivedEdges.filter(e => baseIds.has(e.id)), ...userOnes];
    });
  }, [derivedEdges, baseEdges]);

  // ── Mutations ────────────────────────────────────────────────────────────
  const triggerMut = useMutation({
    mutationFn: () => {
      if (!selectedBrandId) return Promise.reject(new Error('Select a brand before triggering'));
      return triggerPost(cfg, selectedBrandId);
    },
    onSuccess: () => { toast.success('Pipeline triggered'); refetch(); },
    onError: (err: any) => toast.error('Trigger failed', { description: err?.message }),
  });

  const pauseMut = useMutation({
    mutationFn: () => pauseWorkflow(cfg),
    onSuccess: () => { toast.info('Workflow paused'); refetch(); },
    onError: (err: any) => toast.error('Pause failed', { description: err?.message }),
  });

  const resumeMut = useMutation({
    mutationFn: () => resumeWorkflow(cfg),
    onSuccess: () => { toast.success('Workflow resumed'); refetch(); },
    onError: (err: any) => toast.error('Resume failed', { description: err?.message }),
  });

  const isBusy = triggerMut.isPending || pauseMut.isPending || resumeMut.isPending;

  const stats = useMemo(() => ({
    totalRuns: wfStatus?.total_runs || workflowMetrics.completed_today || 0,
    successRate: wfStatus?.success_rate || 0,
    avgDuration: wfStatus?.avg_duration_ms || 0,
    lastRun: wfStatus?.last_run || null,
  }), [wfStatus, workflowMetrics]);

  const aiOnline = aiProviderHealth.filter(p => p.available).length;
  const aiTotal = aiProviderHealth.length || 1;

  // ═════════════════════════════════════════════════════════════════════════

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col pb-20 md:pb-0">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-brand-primary/10 rounded-xl border border-brand-primary/20">
            <GitBranch className="w-5 h-5 text-brand-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Workflow Studio</h1>
            <div className="flex items-center gap-2 mt-0.5">
              {wfStatus ? (
                <span className={cn(
                  'text-[10px] font-mono font-bold uppercase tracking-wider',
                  wfStatus.status === 'running' ? 'text-violet-400' :
                  wfStatus.status === 'paused' ? 'text-amber-400' :
                  wfStatus.status === 'error' ? 'text-red-400' : 'text-brand-text-muted'
                )}>
                  {wfStatus.status}{wfStatus.current_step ? ` · ${wfStatus.current_step}` : ''}
                </span>
              ) : wfError ? (
                <span className="text-[10px] font-mono text-red-400">CONNECTION ERROR</span>
              ) : (
                <span className="text-[10px] font-mono text-brand-text-muted">CONNECTING…</span>
              )}
              {isFetching && !isBusy && <RefreshCcw className="w-3 h-3 text-brand-text-muted animate-spin" />}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {!isRunning && !isPaused && (
            <button
              onClick={() => triggerMut.mutate()}
              disabled={isBusy}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold font-mono uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 disabled:opacity-50 transition-all"
            >
              <Play className="w-4 h-4" />
              {triggerMut.isPending ? 'Starting…' : 'Run Pipeline'}
            </button>
          )}

          {isRunning && (
            <button
              onClick={() => pauseMut.mutate()}
              disabled={isBusy}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold font-mono uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 disabled:opacity-50 transition-all"
            >
              <Pause className="w-4 h-4" />
              {pauseMut.isPending ? 'Pausing…' : 'Pause'}
            </button>
          )}

          {isPaused && (
            <button
              onClick={() => resumeMut.mutate()}
              disabled={isBusy}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold font-mono uppercase tracking-wider bg-violet-500/15 text-violet-400 border border-violet-500/30 hover:bg-violet-500/25 disabled:opacity-50 transition-all"
            >
              <Play className="w-4 h-4" />
              {resumeMut.isPending ? 'Resuming…' : 'Resume'}
            </button>
          )}

          <button
            onClick={() => refetch()}
            className="p-2.5 rounded-xl bg-brand-surface border border-brand-border hover:border-brand-primary/30 text-brand-text-muted hover:text-white transition-all"
            title="Refresh"
          >
            <RefreshCcw className={cn('w-4 h-4', isFetching && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Enterprise metrics bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4 shrink-0">
        {[
          { label: 'AI Providers', value: `${aiOnline}/${aiTotal} online`, icon: BrainCircuit, color: aiOnline === aiTotal ? 'text-emerald-400' : 'text-amber-400' },
          { label: 'Workflows', value: `${workflowMetrics.running || 0} running`, icon: Activity, color: (workflowMetrics.running || 0) > 0 ? 'text-violet-400' : 'text-brand-text-muted' },
          { label: 'Queue', value: workflowMetrics.queued || 0, icon: Hourglass, color: 'text-brand-text-muted' },
          { label: 'Failed Today', value: workflowMetrics.failed_today || 0, icon: AlertCircle, color: (workflowMetrics.failed_today || 0) > 0 ? 'text-red-400' : 'text-emerald-400' },
        ].map(m => (
          <div key={m.label} className="bg-brand-surface/50 border border-brand-border/50 rounded-xl p-2.5 flex items-center gap-2">
            <m.icon className={cn('w-4 h-4 flex-shrink-0', m.color)} />
            <div className="min-w-0">
              <p className="text-[8px] text-brand-text-muted uppercase font-mono">{m.label}</p>
              <p className="text-xs font-bold text-white">{m.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-2 mb-4 shrink-0">
        {[
          { label: 'Total Runs', value: stats.totalRuns.toLocaleString(), icon: Zap },
          { label: 'Success Rate', value: `${stats.successRate}%`, icon: CheckCircle2 },
          { label: 'Avg Duration', value: `${stats.avgDuration}ms`, icon: Clock },
          { label: 'Last Run', value: stats.lastRun ? new Date(stats.lastRun).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—', icon: History },
        ].map(stat => (
          <div key={stat.label} className="bg-brand-surface/50 border border-brand-border/50 rounded-xl p-2.5 hover:border-brand-border transition-colors">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] text-brand-text-muted uppercase font-mono tracking-wider">{stat.label}</span>
              <stat.icon className="w-3 h-3 text-brand-text-muted" />
            </div>
            <div className="text-sm font-mono font-bold text-white">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Canvas */}
      <div className="flex-1 bg-brand-bg border border-brand-border/50 rounded-2xl overflow-hidden relative shadow-2xl min-h-[400px]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.3}
          maxZoom={2}
          defaultEdgeOptions={{ type: 'smoothstep' }}
          className="bg-brand-bg"
          onNodeClick={(_, node) => setSelectedNode(node.id)}
          onPaneClick={() => setSelectedNode(null)}
        >
          <Background color="#27272a" gap={24} variant={BackgroundVariant.Dots} size={2} />
          <Controls className="!bg-brand-surface !border-brand-border !fill-white [&>button]:!bg-brand-surface [&>button]:!border-brand-border [&>button]:!text-white hover:[&>button]:!bg-brand-elevated" />
          <MiniMap
            nodeColor={(n: any) => TYPE_META[n.type]?.color || '#71717a'}
            maskColor="rgba(5, 8, 22, 0.75)"
            className="!bg-brand-surface !border !border-brand-border !rounded-xl !shadow-xl"
          />
        </ReactFlow>

        {/* Live status panel */}
        <AnimatePresence>
          {wfStatus && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="absolute right-4 top-4 w-60 bg-brand-surface/95 backdrop-blur-xl border border-brand-border/60 rounded-2xl shadow-2xl overflow-hidden font-mono z-10"
            >
              <div className="p-3.5 border-b border-brand-border/50 bg-brand-elevated/30 flex justify-between items-center">
                <span className="text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-brand-primary" /> Live Status
                </span>
                <div className={cn(
                  'w-2 h-2 rounded-full',
                  wfStatus.status === 'running' ? 'bg-violet-400 animate-pulse' :
                  wfStatus.status === 'paused' ? 'bg-amber-400' :
                  wfStatus.status === 'error' ? 'bg-red-400 animate-pulse' : 'bg-zinc-500'
                )} />
              </div>
              <div className="p-3.5 text-[10px] text-brand-text-muted space-y-2">
                <div className="flex justify-between">
                  <span>Status</span>
                  <span className={cn('font-bold uppercase',
                    wfStatus.status === 'running' ? 'text-violet-400' :
                    wfStatus.status === 'paused' ? 'text-amber-400' :
                    wfStatus.status === 'error' ? 'text-red-400' : 'text-brand-text'
                  )}>{wfStatus.status}</span>
                </div>
                {wfStatus.current_step && (
                  <div className="flex justify-between">
                    <span>Step</span>
                    <span className="text-white truncate max-w-[130px]">{wfStatus.current_step}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Progress</span>
                  <span className="text-brand-primary font-bold">{wfStatus.progress ?? 0}%</span>
                </div>
                {typeof wfStatus.progress === 'number' && (
                  <div className="w-full bg-brand-elevated rounded-full h-1.5 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-brand-primary to-brand-accent rounded-full transition-all duration-500" style={{ width: `${Math.min(100, wfStatus.progress)}%` }} />
                  </div>
                )}
                {wfStatus.last_error && (
                  <p className="text-[9px] text-red-400 leading-relaxed mt-1">{wfStatus.last_error}</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {wfError && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3 opacity-50" />
              <p className="text-sm text-brand-text-muted font-mono">Unable to connect to workflow engine</p>
              <button onClick={() => refetch()} className="mt-3 pointer-events-auto text-xs text-brand-primary hover:underline">Retry</button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
