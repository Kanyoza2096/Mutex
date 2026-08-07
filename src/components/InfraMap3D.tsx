import React, { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';
import { Maximize2, Minimize2, Server, Cpu } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// STARFIELD
// ═══════════════════════════════════════════════════════════════════════════

function Starfield() {
  const stars = useMemo(() => Array.from({ length: 800 }, () => ({
    position: [(Math.random() - 0.5) * 30, (Math.random() - 0.5) * 18, (Math.random() - 0.5) * 25 - 8] as [number, number, number],
    size: Math.random() * 1 + 0.2,
  })), []);
  return (
    <group>
      {stars.map((star, i) => (
        <mesh key={i} position={star.position}>
          <sphereGeometry args={[star.size, 4, 4]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.3 + Math.random() * 0.4} />
        </mesh>
      ))}
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// INFRA BLOCK
// ═══════════════════════════════════════════════════════════════════════════

interface InfraBlock {
  id: string; label: string; sublabel: string;
  position: [number, number, number]; size: [number, number, number];
  color: string; status: 'online' | 'degraded' | 'offline'; load?: number;
}

function Block({ block }: { block: InfraBlock }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const color = block.status === 'online' ? block.color : block.status === 'degraded' ? '#f59e0b' : '#ef4444';
  const loadHeight = block.load ? (block.load / 100) * 2 : 0;

  useFrame((state) => {
    if (!meshRef.current || !block.load || block.load < 70) return;
    meshRef.current.position.y = block.position[1] + Math.sin(state.clock.elapsedTime * 2) * 0.06;
  });

  return (
    <group>
      <mesh ref={meshRef} position={block.position}>
        <boxGeometry args={block.size} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={block.status === 'online' ? 0.15 : 0.3} roughness={0.3} metalness={0.5} transparent opacity={0.9} />
      </mesh>
      <mesh position={block.position}>
        <boxGeometry args={block.size.map(s => s + 0.02) as [number, number, number]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.12} />
      </mesh>
      {block.load !== undefined && (
        <mesh position={[block.position[0], block.position[1] + block.size[1] / 2 + loadHeight / 2, block.position[2]]}>
          <boxGeometry args={[block.size[0] * 0.6, loadHeight, block.size[2] * 0.6]} />
          <meshBasicMaterial color={block.load > 80 ? '#ef4444' : block.load > 60 ? '#f59e0b' : '#22c55e'} transparent opacity={0.7} />
        </mesh>
      )}
      <Html position={[block.position[0], block.position[1] + block.size[1] / 2 + loadHeight + 0.3, block.position[2]]} center>
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[8px] font-mono font-bold text-white whitespace-nowrap bg-[#0F1629]/90 px-1.5 py-0.5 rounded border border-[#1E2942]/50">{block.label}</span>
          <span className="text-[6px] font-mono text-[#64748B] whitespace-nowrap">{block.sublabel}</span>
          {block.load !== undefined && (
            <span className={cn('text-[7px] font-mono font-bold', block.load > 80 ? 'text-red-400' : block.load > 60 ? 'text-amber-400' : 'text-emerald-400')}>{block.load}%</span>
          )}
        </div>
      </Html>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ANIMATED CONNECTION PACKET
// ═══════════════════════════════════════════════════════════════════════════

function ConnectionPacket({ from, to }: { from: [number, number, number]; to: [number, number, number] }) {
  const packetRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!packetRef.current) return;
    const t = (state.clock.elapsedTime * 0.5) % 1;
    packetRef.current.position.lerpVectors(new THREE.Vector3(...from), new THREE.Vector3(...to), t);
    packetRef.current.scale.setScalar(0.6 + Math.sin(state.clock.elapsedTime * 6) * 0.3);
  });

  return (
    <mesh ref={packetRef}>
      <sphereGeometry args={[0.08, 6, 6]} />
      <meshBasicMaterial color="#818cf8" transparent opacity={0.8} />
    </mesh>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENE
// ═══════════════════════════════════════════════════════════════════════════

function Scene() {
  const { systemResources, socketConnected } = useStore();

  const blocks: InfraBlock[] = useMemo(() => [
    { id: 'render', label: 'Render.com', sublabel: 'Web Service', position: [0, 1.5, 0], size: [3, 3, 2], color: '#4F46E5', status: socketConnected ? 'online' : 'offline', load: systemResources.cpu_percent || 0 },
    { id: 'redis', label: 'Redis', sublabel: 'Upstash', position: [-3, 0.6, -1], size: [1.5, 1.2, 1.5], color: '#06b6d4', status: 'online', load: systemResources.memory_percent || 0 },
    { id: 'supabase', label: 'Supabase', sublabel: 'Postgres', position: [3, 0.8, -1], size: [2, 1.6, 1.8], color: '#22c55e', status: 'online', load: systemResources.disk_percent || 0 },
    { id: 'api', label: 'REST API', sublabel: 'FastAPI v12', position: [0, -0.3, 1.5], size: [2.5, 0.8, 1.2], color: '#818cf8', status: socketConnected ? 'online' : 'offline', load: Math.round((systemResources.cpu_percent || 0) * 0.7) },
    { id: 'socketio', label: 'Socket.IO', sublabel: 'WebSocket', position: [0, -1.5, 1.5], size: [2, 0.7, 1], color: '#a78bfa', status: socketConnected ? 'online' : 'offline', load: socketConnected ? 20 : 0 },
    { id: 'guardian', label: 'Guardian', sublabel: 'Security', position: [-2.5, -0.5, -2], size: [1.2, 1, 1], color: '#f472b6', status: 'online', load: 15 },
    { id: 'scheduler', label: 'Scheduler', sublabel: 'Cron Jobs', position: [2.5, -0.5, -2], size: [1.2, 1, 1], color: '#fbbf24', status: 'online', load: 10 },
  ], [systemResources.cpu_percent, systemResources.memory_percent, systemResources.disk_percent, socketConnected]);

  const connections = useMemo(() => [
    [blocks[0].position, blocks[1].position], [blocks[0].position, blocks[2].position],
    [blocks[0].position, blocks[3].position], [blocks[3].position, blocks[4].position],
    [blocks[0].position, blocks[5].position], [blocks[0].position, blocks[6].position],
  ], [blocks]);

  const onlineCount = blocks.filter(b => b.status === 'online').length;

  return (
    <>
      <ambientLight intensity={0.35} />
      <pointLight position={[0, 5, 4]} intensity={0.7} color="#4F46E5" />
      <pointLight position={[-4, -2, -3]} intensity={0.25} color="#06B6D4" />
      <pointLight position={[4, -2, -3]} intensity={0.25} color="#22c55e" />

      <Starfield />
      <gridHelper args={[12, 16, '#1E2942', '#0F1629']} position={[0, -3, 0]} />

      {connections.map(([from, to], i) => (
        <React.Fragment key={i}>
          <Line points={[new THREE.Vector3(...from), new THREE.Vector3(...to)]} color="#1E2942" lineWidth={1} transparent opacity={0.4} />
          <ConnectionPacket from={from} to={to} />
        </React.Fragment>
      ))}

      {blocks.map(block => <Block key={block.id} block={block} />)}

      <Html position={[0, -3.5, 0]} center>
        <div className="flex items-center gap-2 bg-[#0F1629]/90 border border-[#1E2942]/50 rounded-lg px-3 py-1.5">
          <Server className="w-3 h-3 text-brand-primary" />
          <span className="text-[9px] font-mono text-[#64748B]">{onlineCount}/{blocks.length} Services Online</span>
        </div>
      </Html>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function InfraMap3D() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { systemResources } = useStore();

  return (
    <div className={cn('relative rounded-2xl border border-brand-border/50 overflow-hidden',
      isFullscreen ? 'fixed inset-0 z-50' : 'w-full h-full min-h-[400px]')}
      style={{ background: '#080C14' }}>

      <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5">
        <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded bg-[#0F1629]/90 border border-[#1E2942]/60 text-[8px] font-mono text-[#64748B]">
          <Cpu className="w-2.5 h-2.5" /> CPU {systemResources.cpu_percent?.toFixed(0) || 0}%
        </div>
        <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-1.5 rounded-lg bg-[#0F1629]/90 border border-[#1E2942]/60 text-[#64748B] hover:text-white transition-colors">
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      <Canvas camera={{ position: [0, 3, 10], fov: 50 }} gl={{ alpha: false, antialias: true }}>
        <color attach="background" args={['#080C14']} />
        <Scene />
        <OrbitControls enableDamping dampingFactor={0.1} minDistance={4} maxDistance={20} maxPolarAngle={Math.PI / 2.2} target={[0, 0, 0]} />
      </Canvas>

      <div className="absolute bottom-3 left-3 z-20 flex items-center gap-3 text-[8px] font-mono text-[#64748B] bg-[#0F1629]/95 border border-[#1E2942]/60 rounded-lg px-3 py-1.5">
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm bg-violet-500" /> Render</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm bg-cyan-500" /> Redis</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm bg-emerald-500" /> Supabase</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm bg-indigo-400" /> API</span>
        <span className="text-[#1E2942]">|</span>
        <span>🖱 Drag · Scroll</span>
      </div>
    </div>
  );
}
