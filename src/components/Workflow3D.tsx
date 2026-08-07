import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sphere, Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';
import { Play, Pause, RefreshCw, Maximize2, Minimize2 } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { fetchWorkflowStatus, pauseWorkflow, resumeWorkflow, triggerPost } from '../lib/api';
import { toast } from 'sonner';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface PipelineNode {
  id: string;
  label: string;
  position: [number, number, number];
  status: 'idle' | 'running' | 'success' | 'error';
  progress?: number;
  color: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// NODE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

const PIPELINE_NODES: PipelineNode[] = [
  { id: 'trigger',  label: 'Trigger',         position: [-4, 2, 0],  status: 'idle', color: '#f59e0b' },
  { id: 'ai',       label: 'AI Generation',   position: [0, 2, 0],   status: 'idle', color: '#818cf8' },
  { id: 'render',   label: 'Card Renderer',   position: [4, 0, 0],   status: 'idle', color: '#06b6d4' },
  { id: 'publish',  label: 'Publish',         position: [4, -3, 0],  status: 'idle', color: '#34d399' },
  { id: 'analytics',label: 'Analytics',       position: [0, -3, 0],  status: 'idle', color: '#a78bfa' },
];

const EDGES = [
  ['trigger', 'ai'],
  ['ai', 'render'],
  ['render', 'publish'],
  ['publish', 'analytics'],
];

const STATUS_COLORS: Record<string, string> = {
  idle: '#71717a',
  running: '#818cf8',
  success: '#22c55e',
  error: '#ef4444',
};

// ═══════════════════════════════════════════════════════════════════════════
// NODE
// ═══════════════════════════════════════════════════════════════════════════

function PipelineNodeSphere({ node, isActive }: { node: PipelineNode; isActive: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const color = STATUS_COLORS[node.status] || node.color;

  useFrame((state) => {
    if (!meshRef.current) return;
    if (isActive) {
      meshRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 4) * 0.1);
    } else {
      meshRef.current.scale.setScalar(1);
    }
  });

  return (
    <group>
      {/* Core */}
      <mesh ref={meshRef} position={node.position}>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={isActive ? 0.6 : 0.2} roughness={0.3} />
      </mesh>

      {/* Ring */}
      <mesh position={node.position}>
        <torusGeometry args={[0.65, 0.04, 16, 32]} />
        <meshBasicMaterial color={color} transparent opacity={isActive ? 0.6 : 0.2} />
      </mesh>

      {/* Glow when active */}
      {isActive && (
        <mesh position={node.position}>
          <sphereGeometry args={[0.8, 16, 16]} />
          <meshBasicMaterial color={color} transparent opacity={0.1} />
        </mesh>
      )}

      {/* Label */}
      <Html position={[node.position[0], node.position[1] + 0.9, node.position[2]]} center>
        <span className="text-[9px] font-mono font-bold text-white whitespace-nowrap pointer-events-none select-none bg-[#0F1629]/90 px-2 py-0.5 rounded border border-[#1E2942]/50">
          {node.label}
        </span>
      </Html>

      {/* Progress bar when running */}
      {isActive && node.progress !== undefined && (
        <Html position={[node.position[0], node.position[1] - 0.9, node.position[2]]} center>
          <div className="bg-[#0F1629]/90 border border-[#1E2942]/50 rounded-full px-2 py-0.5 flex items-center gap-1.5">
            <div className="w-12 h-1.5 bg-[#1E2942] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-300" style={{ width: `${Math.min(100, node.progress)}%`, backgroundColor: color }} />
            </div>
            <span className="text-[8px] font-mono text-white tabular-nums">{node.progress}%</span>
          </div>
        </Html>
      )}

      {/* Status dot */}
      <Html position={[node.position[0] + 0.7, node.position[1] + 0.3, node.position[2]]} center>
        <span className={cn(
          'w-2 h-2 rounded-full block border',
          node.status === 'success' ? 'bg-emerald-400 border-emerald-500/30' :
          node.status === 'error' ? 'bg-red-400 border-red-500/30' :
          node.status === 'running' ? 'bg-violet-400 border-violet-500/30 animate-pulse' :
          'bg-zinc-500 border-zinc-600/30'
        )} />
      </Html>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CONNECTION PIPE
// ═══════════════════════════════════════════════════════════════════════════

function ConnectionPipe({ from, to, active }: { from: [number, number, number]; to: [number, number, number]; active: boolean }) {
  const points = useMemo(() => [new THREE.Vector3(...from), new THREE.Vector3(...to)], [from, to]);
  const color = active ? '#818cf8' : '#1E2942';
  const opacity = active ? 0.6 : 0.2;

  return (
    <>
      <Line points={points} color={color} lineWidth={2} transparent opacity={opacity} />
      {active && (
        <Line points={points} color="#a78bfa" lineWidth={0.5} transparent opacity={0.3} />
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FLOW PARTICLES
// ═══════════════════════════════════════════════════════════════════════════

function FlowParticles({ nodes, activeEdges }: { nodes: PipelineNode[]; activeEdges: string[] }) {
  const particlesRef = useRef<THREE.Group>(null);
  const particles = useRef<{ from: [number, number, number]; to: [number, number, number]; progress: number; speed: number }[]>([]);

  useEffect(() => {
    particles.current = activeEdges.flatMap(() => 
      Array.from({ length: 3 }, () => {
        const edge = activeEdges[Math.floor(Math.random() * activeEdges.length)];
        const [fromId, toId] = edge.split('-');
        const from = nodes.find(n => n.id === fromId);
        const to = nodes.find(n => n.id === toId);
        if (!from || !to) return null;
        return {
          from: from.position,
          to: to.position,
          progress: Math.random(),
          speed: 0.3 + Math.random() * 0.5,
        };
      }).filter(Boolean) as any
    );
  }, [activeEdges, nodes]);

  useFrame((state, delta) => {
    if (!particlesRef.current) return;
    particles.current = particles.current.map(p => ({
      ...p,
      progress: (p.progress + delta * p.speed) % 1,
    }));
    particlesRef.current.children.forEach((child, i) => {
      const p = particles.current[i];
      if (!p) return;
      child.position.set(
        p.from[0] + (p.to[0] - p.from[0]) * p.progress,
        p.from[1] + (p.to[1] - p.from[1]) * p.progress,
        p.from[2] + (p.to[2] - p.from[2]) * p.progress,
      );
    });
  });

  if (activeEdges.length === 0) return null;

  return (
    <group ref={particlesRef}>
      {Array.from({ length: activeEdges.length * 3 }).map((_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.06, 4, 4]} />
          <meshBasicMaterial color="#a78bfa" transparent opacity={0.8} />
        </mesh>
      ))}
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENE
// ═══════════════════════════════════════════════════════════════════════════

function Scene({ wfStatus }: { wfStatus: any }) {
  const nodes = useMemo(() => {
    if (!wfStatus) return PIPELINE_NODES;
    const step = (wfStatus.current_step || '').toLowerCase();
    const isRunning = wfStatus.status === 'running';

    return PIPELINE_NODES.map(node => {
      let status: PipelineNode['status'] = 'idle';
      let progress: number | undefined;

      if (isRunning) {
        const matches = node.label.toLowerCase().includes(step) || node.id === step;
        if (matches) {
          status = 'running';
          progress = wfStatus.progress || 0;
        } else {
          const stepOrder = ['trigger', 'ai', 'render', 'publish', 'analytics'];
          const currentIdx = stepOrder.findIndex(s => step.includes(s));
          const nodeIdx = stepOrder.indexOf(node.id);
          status = nodeIdx < currentIdx ? 'success' : 'idle';
        }
      } else if (wfStatus.status === 'paused') {
        status = 'idle';
      } else if (wfStatus.status === 'error') {
        status = 'error';
      }

      return { ...node, status, progress };
    });
  }, [wfStatus]);

  const activeEdges = useMemo(() => {
    if (!wfStatus || wfStatus.status !== 'running') return [];
    const step = (wfStatus.current_step || '').toLowerCase();
    return EDGES.filter(([from]) => {
      const node = nodes.find(n => n.id === from);
      return node?.status === 'running' || node?.status === 'success';
    }).map(([from, to]) => `${from}-${to}`);
  }, [wfStatus, nodes]);

  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[0, 4, 3]} intensity={0.8} color="#4F46E5" />
      <pointLight position={[0, -2, -2]} intensity={0.4} color="#06B6D4" />

      <gridHelper args={[12, 16, '#1E2942', '#0F1629']} position={[0, -4.5, 0]} />

      {EDGES.map(([from, to]) => {
        const fn = nodes.find(n => n.id === from);
        const tn = nodes.find(n => n.id === to);
        if (!fn || !tn) return null;
        const isActive = fn.status === 'success' || fn.status === 'running';
        return <ConnectionPipe key={`${from}-${to}`} from={fn.position} to={tn.position} active={isActive} />;
      })}

      {nodes.map(node => (
        <PipelineNodeSphere key={node.id} node={node} isActive={node.status === 'running'} />
      ))}

      <FlowParticles nodes={nodes} activeEdges={activeEdges} />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function Workflow3D() {
  const { restEndpoint, masterToken, selectedBrandId } = useStore();
  const cfg = { restEndpoint, masterToken };
  const [isFullscreen, setIsFullscreen] = useState(false);

  const { data: wfStatus, refetch, isFetching } = useQuery({
    queryKey: ['workflow-status', restEndpoint],
    queryFn: () => fetchWorkflowStatus(cfg),
    retry: 2,
    staleTime: 8_000,
    refetchInterval: 8_000,
  });

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

  const isRunning = wfStatus?.status === 'running';
  const isPaused = wfStatus?.status === 'paused';
  const isBusy = triggerMut.isPending || pauseMut.isPending || resumeMut.isPending;

  return (
    <div className={cn(
      'relative rounded-2xl border border-brand-border/50 overflow-hidden',
      isFullscreen ? 'fixed inset-0 z-50' : 'w-full h-full min-h-[500px]',
    )} style={{ background: '#0F1629' }}>
      
      {/* Toolbar */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5">
        {!isRunning && !isPaused && (
          <button onClick={() => triggerMut.mutate()} disabled={isBusy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 text-[10px] font-bold font-mono uppercase transition-all disabled:opacity-50">
            <Play className="w-3.5 h-3.5" /> Run
          </button>
        )}
        {isRunning && (
          <button onClick={() => pauseMut.mutate()} disabled={isBusy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 text-[10px] font-bold font-mono uppercase transition-all disabled:opacity-50">
            <Pause className="w-3.5 h-3.5" /> Pause
          </button>
        )}
        {isPaused && (
          <button onClick={() => resumeMut.mutate()} disabled={isBusy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/15 text-violet-400 border border-violet-500/30 hover:bg-violet-500/25 text-[10px] font-bold font-mono uppercase transition-all disabled:opacity-50">
            <Play className="w-3.5 h-3.5" /> Resume
          </button>
        )}
        <button onClick={() => refetch()} className="p-1.5 rounded-lg bg-[#0F1629]/90 border border-[#1E2942]/60 text-[#64748B] hover:text-white transition-colors">
          <RefreshCw className={cn('w-3.5 h-3.5', isFetching && 'animate-spin')} />
        </button>
        <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-1.5 rounded-lg bg-[#0F1629]/90 border border-[#1E2942]/60 text-[#64748B] hover:text-white transition-colors">
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Status badge */}
      {wfStatus && (
        <div className="absolute top-3 left-3 z-20">
          <span className={cn(
            'px-2.5 py-1 rounded-full text-[9px] font-mono font-bold uppercase border',
            wfStatus.status === 'running' ? 'bg-violet-500/10 text-violet-400 border-violet-500/30' :
            wfStatus.status === 'paused' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
            wfStatus.status === 'error' ? 'bg-red-500/10 text-red-400 border-red-500/30' :
            'bg-zinc-500/10 text-zinc-400 border-zinc-500/30'
          )}>
            {wfStatus.status}{wfStatus.current_step ? ` · ${wfStatus.current_step}` : ''}
          </span>
        </div>
      )}

      <Canvas camera={{ position: [0, 0, 10], fov: 50 }} gl={{ alpha: false, antialias: true }}>
        <color attach="background" args={['#0F1629']} />
        <Scene wfStatus={wfStatus} />
        <OrbitControls enableDamping dampingFactor={0.1} minDistance={4} maxDistance={20} maxPolarAngle={Math.PI / 1.5} />
      </Canvas>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-20 flex items-center gap-3 text-[9px] font-mono text-[#64748B] bg-[#0F1629]/95 border border-[#1E2942]/60 rounded-lg px-3 py-1.5">
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-zinc-500" /> Idle</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" /> Running</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Success</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-400" /> Error</span>
      </div>
    </div>
  );
}
