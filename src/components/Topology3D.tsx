import React, { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sphere, Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';
import { Maximize2, Minimize2, RotateCcw, Eye, EyeOff } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface TopoNode {
  id: string;
  label: string;
  position: [number, number, number];
  status: 'online' | 'degraded' | 'offline' | 'active';
  latency?: number;
  connections: string[];
}

interface TrafficPacket {
  id: string;
  fromId: string;
  toId: string;
  progress: number;
  color: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// NODE LAYOUT
// ═══════════════════════════════════════════════════════════════════════════

const TOPO_NODES: TopoNode[] = [
  { id: 'frontend',   label: 'Frontend',         position: [0, 3, 0],    status: 'online', connections: ['gemini', 'scheduler', 'supabase', 'connectors', 'command', 'socketio'] },
  { id: 'gemini',     label: 'Gemini AI',        position: [0, 1.5, 0],  status: 'online', connections: ['pipeline'] },
  { id: 'pipeline',   label: 'Pipeline',         position: [0, 0, 0],    status: 'online', connections: ['render', 'scheduler'] },
  { id: 'render',     label: 'Card Renderer',    position: [2, 0, 0],    status: 'online', connections: ['connectors'] },
  { id: 'command',    label: 'Command Executor', position: [-2.5, -1.5, 0], status: 'online', connections: ['connectors'] },
  { id: 'scheduler',  label: 'Scheduler',        position: [0, -1.5, 0], status: 'online', connections: ['connectors'] },
  { id: 'connectors', label: 'Connectors',       position: [0, -3, 0],   status: 'online', connections: ['supabase', 'redis', 'socketio', 'facebook'] },
  { id: 'supabase',   label: 'Supabase',         position: [-2, -4.5, 0], status: 'online', connections: ['socketio'] },
  { id: 'redis',      label: 'Redis',            position: [2, -4.5, 0], status: 'online', connections: ['socketio'] },
  { id: 'socketio',   label: 'Socket.IO',        position: [0, -6, 0],   status: 'online', connections: [] },
  { id: 'facebook',   label: 'Facebook',         position: [-3, -3, 0],  status: 'online', connections: ['connectors'] },
];

const STATUS_COLORS: Record<string, string> = {
  online: '#22c55e',
  degraded: '#f59e0b',
  offline: '#ef4444',
  active: '#3b82f6',
};

// ═══════════════════════════════════════════════════════════════════════════
// NODE SPHERE
// ═══════════════════════════════════════════════════════════════════════════

function NodeSphere({ node, onClick, showLabels }: { node: TopoNode; onClick: (id: string) => void; showLabels: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const color = STATUS_COLORS[node.status] || '#71717a';
  const isActive = node.status === 'active';

  useFrame((state) => {
    if (!meshRef.current) return;
    
    // Core pulse when active
    if (isActive) {
      meshRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 3) * 0.08);
    }
    
    // 🌀 Ring 1 spins around Y axis
    if (ringRef.current) {
      ringRef.current.rotation.z += 0.01;
      ringRef.current.rotation.x += 0.005;
    }
    
    // 🌀 Ring 2 spins opposite direction
    if (ring2Ref.current) {
      ring2Ref.current.rotation.z -= 0.015;
      ring2Ref.current.rotation.y += 0.008;
    }
  });

  return (
    <group>
      {/* Core sphere */}
      <mesh
        ref={meshRef}
        position={node.position}
        onClick={(e) => { e.stopPropagation(); onClick(node.id); }}
      >
        <sphereGeometry args={[0.35, 32, 32]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} roughness={0.3} />
      </mesh>

      {/* 🌀 Spinning Ring 1 — equatorial */}
      <mesh ref={ringRef} position={node.position}>
        <torusGeometry args={[0.5, 0.03, 16, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.4} />
      </mesh>

      {/* 🌀 Spinning Ring 2 — polar, spins opposite direction */}
      <mesh ref={ring2Ref} position={node.position} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.5, 0.025, 16, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} />
      </mesh>

      {showLabels && (
        <>
          <Html position={[node.position[0], node.position[1] + 0.6, node.position[2]]} center>
            <span className="text-[8px] font-mono font-bold text-white whitespace-nowrap pointer-events-none select-none bg-[#0F1629]/90 px-1.5 py-0.5 rounded border border-[#1E2942]/50">
              {node.label}
            </span>
          </Html>
          {node.latency !== undefined && (
            <Html position={[node.position[0], node.position[1] - 0.6, node.position[2]]} center>
              <span className="text-[7px] font-mono text-[#64748B] whitespace-nowrap pointer-events-none select-none">
                {node.latency}ms
              </span>
            </Html>
          )}
        </>
      )}
    </group>
  );
    }

// ═══════════════════════════════════════════════════════════════════════════
// CONNECTION EDGE
// ═══════════════════════════════════════════════════════════════════════════

function ConnectionEdge({ from, to, hasTraffic }: { from: [number, number, number]; to: [number, number, number]; hasTraffic: boolean }) {
  const points = useMemo(() => [new THREE.Vector3(...from), new THREE.Vector3(...to)], [from, to]);
  const color = hasTraffic ? '#818cf8' : '#1E2942';
  const opacity = hasTraffic ? 0.5 : 0.2;

  return <Line points={points} color={color} lineWidth={hasTraffic ? 1.5 : 0.5} transparent opacity={opacity} />;
}

// ═══════════════════════════════════════════════════════════════════════════
// TRAFFIC PARTICLES
// ═══════════════════════════════════════════════════════════════════════════

function TrafficParticles({ nodes, packets }: { nodes: TopoNode[]; packets: TrafficPacket[] }) {
  const nodeMap = useMemo(() => {
    const map = new Map<string, [number, number, number]>();
    nodes.forEach(n => map.set(n.id, n.position));
    return map;
  }, [nodes]);

  return (
    <group>
      {packets.map(pkt => {
        const fromPos = nodeMap.get(pkt.fromId);
        const toPos = nodeMap.get(pkt.toId);
        if (!fromPos || !toPos) return null;

        const x = fromPos[0] + (toPos[0] - fromPos[0]) * pkt.progress;
        const y = fromPos[1] + (toPos[1] - fromPos[1]) * pkt.progress;
        const z = fromPos[2] + (toPos[2] - fromPos[2]) * pkt.progress;

        return (
          <mesh key={pkt.id} position={[x, y, z]}>
            <sphereGeometry args={[0.06, 6, 6]} />
            <meshBasicMaterial color={pkt.color} transparent opacity={1 - pkt.progress * 0.7} />
          </mesh>
        );
      })}
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// GRID FLOOR
// ═══════════════════════════════════════════════════════════════════════════

function GridFloor() {
  return (
    <group>
      <gridHelper args={[16, 20, '#1E2942', '#0F1629']} position={[0, -7.5, 0]} />
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENE
// ═══════════════════════════════════════════════════════════════════════════

function Scene({ onNodeClick, showLabels }: { onNodeClick: (id: string) => void; showLabels: boolean }) {
  const { healthMatrix, socketConnected, socket } = useStore();
  const [packets, setPackets] = useState<TrafficPacket[]>([]);
  const packetIdRef = useRef(0);

  // Update node statuses from health matrix
  const nodes = useMemo(() => {
    return TOPO_NODES.map(node => {
      const match = healthMatrix.find(h => {
        const n = (h.name || '').toLowerCase();
        return n.includes(node.id) || node.id.includes(n);
      });
      if (!match) return node;
      return {
        ...node,
        status: match.status === 'online' ? 'online' as const : match.status === 'degraded' ? 'degraded' as const : 'offline' as const,
        latency: match.latency,
      };
    });
  }, [healthMatrix]);

  // Listen for REAL traffic events from SocketIO
  useEffect(() => {
    if (!socket) return;

    const spawnPacket = (fromId: string, toId: string, isError = false) => {
      setPackets(prev => [...prev.slice(-40), {
        id: `pkt_${packetIdRef.current++}`,
        fromId, toId,
        progress: 0,
        color: isError ? '#ef4444' : '#818cf8',
      }]);
    };

    const handleTraffic = (data: any) => {
      const { from_service, to_service, status, error } = data;
      if (!from_service || !to_service) return;
      const isError = (status && status >= 400) || !!error;
      spawnPacket(from_service, to_service, isError);
    };

    socket.on('traffic_packet', handleTraffic);
    socket.on('new_message', () => spawnPacket('connectors', 'socketio'));
    socket.on('post_published', () => spawnPacket('scheduler', 'connectors'));
    socket.on('worker_error', () => spawnPacket('render', 'connectors', true));
    socket.on('provider_failed', () => spawnPacket('connectors', 'socketio', true));

    return () => {
      socket.off('traffic_packet', handleTraffic);
      socket.off('new_message');
      socket.off('post_published');
      socket.off('worker_error');
      socket.off('provider_failed');
    };
  }, [socket]);

  // Also spawn random packets when socket is connected for ambient traffic
  useFrame((state, delta) => {
    if (socketConnected && Math.random() < delta * 2) {
      const node = nodes[Math.floor(Math.random() * nodes.length)];
      if (node.connections.length > 0) {
        const toId = node.connections[Math.floor(Math.random() * node.connections.length)];
        setPackets(prev => [...prev.slice(-40), {
          id: `pkt_ambient_${packetIdRef.current++}`,
          fromId: node.id, toId,
          progress: 0,
          color: '#818cf8',
        }]);
      }
    }

    // Move all packets
    setPackets(prev =>
      prev
        .map(p => ({ ...p, progress: p.progress + delta * 0.8 }))
        .filter(p => p.progress < 1)
    );
  });

  const edges = useMemo(() => {
    const result: { from: [number, number, number]; to: [number, number, number]; hasTraffic: boolean }[] = [];
    nodes.forEach(node => {
      node.connections.forEach(toId => {
        const to = nodes.find(n => n.id === toId);
        if (to) {
          const hasTraffic = packets.some(p => p.fromId === node.id && p.toId === toId);
          result.push({ from: node.position, to: to.position, hasTraffic });
        }
      });
    });
    return result;
  }, [nodes, packets]);

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[0, 5, 5]} intensity={1} color="#4F46E5" />
      <pointLight position={[0, -5, -3]} intensity={0.5} color="#06B6D4" />

      <GridFloor />

      {edges.map((edge, i) => (
        <ConnectionEdge key={i} {...edge} />
      ))}

      {nodes.map(node => (
        <NodeSphere key={node.id} node={node} onClick={onNodeClick} showLabels={showLabels} />
      ))}

      <TrafficParticles nodes={nodes} packets={packets} />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface Topology3DProps {
  className?: string;
  onNodeClick?: (nodeId: string) => void;
}

export default function Topology3D({ className, onNodeClick }: Topology3DProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [showLegend, setShowLegend] = useState(false);
  const controlsRef = useRef<any>(null);
  const legendTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const resetCamera = useCallback(() => {
    if (controlsRef.current) controlsRef.current.reset();
  }, []);

  // Show legend on hover, hide after 3 seconds
  const handleMouseEnter = () => {
    setShowLegend(true);
    if (legendTimer.current) clearTimeout(legendTimer.current);
  };
  const handleMouseMove = () => {
    setShowLegend(true);
    if (legendTimer.current) clearTimeout(legendTimer.current);
    legendTimer.current = setTimeout(() => setShowLegend(false), 3000);
  };

  return (
    <div
      className={cn(
        'relative rounded-2xl border border-brand-border/50 overflow-hidden',
        isFullscreen ? 'fixed inset-0 z-50' : 'w-full h-full min-h-[400px]',
        className
      )}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setShowLegend(false)}
      style={{ background: '#0F1629' }}
    >
      {/* Toolbar */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5">
        <button
          onClick={() => setShowLabels(!showLabels)}
          className="p-1.5 rounded-lg bg-[#0F1629]/90 border border-[#1E2942]/60 text-[#64748B] hover:text-white transition-colors"
          title="Toggle labels"
        >
          {showLabels ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={resetCamera}
          className="p-1.5 rounded-lg bg-[#0F1629]/90 border border-[#1E2942]/60 text-[#64748B] hover:text-white transition-colors"
          title="Reset view"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="p-1.5 rounded-lg bg-[#0F1629]/90 border border-[#1E2942]/60 text-[#64748B] hover:text-white transition-colors"
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      <Canvas
        camera={{ position: [0, 0, 12], fov: 50 }}
        gl={{ alpha: false, antialias: true }}
      >
        <color attach="background" args={['#0F1629']} />
        <Scene onNodeClick={onNodeClick || (() => {})} showLabels={showLabels} />
        <OrbitControls
          ref={controlsRef}
          enableDamping
          dampingFactor={0.1}
          minDistance={5}
          maxDistance={25}
          maxPolarAngle={Math.PI / 1.8}
        />
      </Canvas>

      {/* Auto-hide legend */}
      <div className={cn(
        'absolute bottom-3 left-3 z-20 flex items-center gap-3 text-[9px] font-mono text-[#64748B] bg-[#0F1629]/95 border border-[#1E2942]/60 rounded-lg px-3 py-1.5 transition-opacity duration-300',
        showLegend ? 'opacity-100' : 'opacity-0 pointer-events-none'
      )}>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />Online</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />Degraded</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-400" />Offline</span>
        <span className="text-[#1E2942]">|</span>
        <span>Drag to rotate · Scroll to zoom</span>
      </div>
    </div>
  );
}
