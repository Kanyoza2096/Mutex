import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sphere } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';

function OrbitingParticles({ count = 12, radius = 2.2, speed = 0.3, color }: {
  count?: number; radius?: number; speed?: number; color: string;
}) {
  const groupRef = useRef<THREE.Group>(null);

  const particles = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      angle: (i / count) * Math.PI * 2,
      y: (Math.random() - 0.5) * 1.5,
      size: Math.random() * 0.06 + 0.03,
      speedOffset: Math.random() * 0.5,
    }));
  }, [count]);

  useFrame((state) => {
    if (!groupRef.current) return;
    const time = state.clock.elapsedTime;
    groupRef.current.children.forEach((child, i) => {
      const p = particles[i];
      const angle = p.angle + time * (speed + p.speedOffset);
      child.position.x = Math.cos(angle) * radius;
      child.position.z = Math.sin(angle) * radius;
      child.position.y = Math.sin(time * 1.3 + i) * 0.8;
    });
  });

  return (
    <group ref={groupRef}>
      {particles.map((p, i) => (
        <mesh key={i}>
          <sphereGeometry args={[p.size, 8, 8]} />
          <meshBasicMaterial color={color} transparent opacity={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function OuterRing({ radius = 2.6, color, speed = 0.15 }: { radius?: number; color: string; speed?: number }) {
  const ringRef = useRef<THREE.Line>(null);

  useFrame((state) => {
    if (!ringRef.current) return;
    ringRef.current.rotation.x = Math.sin(state.clock.elapsedTime * speed) * 0.3;
    ringRef.current.rotation.y += speed * 0.02;
  });

  const geometry = useMemo(() => {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= 128; i++) {
      const angle = (i / 128) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
    }
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [radius]);

  // Cast to any so TypeScript doesn't confuse R3F's <line> with SVG's <line>
  const R3FLine = 'line' as unknown as React.ComponentType<{ ref?: any; geometry?: THREE.BufferGeometry; children?: React.ReactNode }>;
  return (
    <R3FLine ref={ringRef} geometry={geometry}>
      <lineBasicMaterial color={color} transparent opacity={0.3} />
    </R3FLine>
  );
}

function CoreSphere({ color, isActive }: { color: string; isActive: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    if (isActive) {
      meshRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 3) * 0.08);
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1, 64, 64]} />
      <meshBasicMaterial color={color} transparent opacity={0.9} toneMapped={false} />
    </mesh>
  );
}

const COLORS = { online: '#22c55e', degraded: '#f59e0b', offline: '#ef4444', thinking: '#818cf8', connecting: '#a78bfa' };

function OrbScene() {
  const { aiProviderHealth, workflowMetrics, socketConnected } = useStore();

  const availableCount = aiProviderHealth.filter(p => p.available).length;
  const totalCount = aiProviderHealth.length || 1;
  const isActive = workflowMetrics.running > 0;

  let state: keyof typeof COLORS = 'offline';
  if (!socketConnected) state = 'offline';
  else if (isActive) state = 'thinking';
  else if (availableCount === totalCount && totalCount > 0) state = 'online';
  else if (availableCount > 0) state = 'degraded';

  const color = COLORS[state];
  const particleCount = state === 'thinking' ? 18 : state === 'online' ? 12 : 6;
  const ringSpeed = state === 'thinking' ? 0.25 : 0.15;

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[0, 3, 3]} intensity={0.5} color={color} />

      <CoreSphere color={color} isActive={isActive} />

      <Sphere args={[1.5, 32, 32]}>
        <meshBasicMaterial color={color} transparent opacity={state === 'thinking' ? 0.2 : 0.08} />
      </Sphere>
      <Sphere args={[1.3, 32, 32]}>
        <meshBasicMaterial color={color} transparent opacity={0.04} />
      </Sphere>

      <OrbitingParticles count={particleCount} color={color} speed={state === 'thinking' ? 0.5 : 0.3} radius={2.2} />
      <OuterRing color={color} speed={ringSpeed} />
      <OuterRing color={color} speed={-ringSpeed * 0.7} radius={3.0} />
    </>
  );
}

interface AIOrbProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showLabel?: boolean;
}

export default function AIOrb({ size = 'lg', className, showLabel = true }: AIOrbProps) {
  const { aiProviderHealth, workflowMetrics } = useStore();

  const sizeMap = { sm: 80, md: 140, lg: 200 };
  const pixelSize = sizeMap[size];

  const availableCount = aiProviderHealth.filter(p => p.available).length;
  const totalCount = aiProviderHealth.length || 1;
  const activeModel = aiProviderHealth.find(p => p.available)?.model || 'Standby';
  const isRunning = workflowMetrics.running > 0;

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <div className="relative rounded-full overflow-hidden" style={{ width: pixelSize, height: pixelSize }}>
        <Canvas camera={{ position: [0, 0, 6], fov: 45 }} gl={{ alpha: true, antialias: true }} style={{ background: 'transparent' }}>
          <OrbScene />
        </Canvas>
      </div>
      {showLabel && (
        <div className="text-center">
          <p className="text-[10px] font-mono font-bold text-brand-text-muted uppercase tracking-wider">
            {isRunning ? 'Generating' : availableCount > 0 ? `${availableCount}/${totalCount} Online` : 'Offline'}
          </p>
          <p className="text-[9px] text-brand-text-muted/60 font-mono">{activeModel}</p>
        </div>
      )}
    </div>
  );
}
