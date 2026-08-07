import React, { useRef, useMemo, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Sphere, Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';
import { Shield, AlertTriangle, CheckCircle2, Maximize2, Minimize2, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// ═══════════════════════════════════════════════════════════════════════════
// STARFIELD
// ═══════════════════════════════════════════════════════════════════════════

function Starfield() {
  const stars = useMemo(() => {
    return Array.from({ length: 1500 }, () => ({
      position: [(Math.random() - 0.5) * 40, (Math.random() - 0.5) * 25, (Math.random() - 0.5) * 30 - 5] as [number, number, number],
      size: Math.random() * 1.2 + 0.2,
      speed: Math.random() * 0.3 + 0.1,
    }));
  }, []);

  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += 0.0001;
    groupRef.current.children.forEach((child, i) => {
      const star = stars[i];
      child.position.y += Math.sin(state.clock.elapsedTime * star.speed) * 0.001;
    });
  });

  return (
    <group ref={groupRef}>
      {stars.map((star, i) => (
        <mesh key={i} position={star.position}>
          <sphereGeometry args={[star.size, 4, 4]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.3 + Math.random() * 0.5} />
        </mesh>
      ))}
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// GLOBE WITH LAYERS
// ═══════════════════════════════════════════════════════════════════════════

function Globe({ hasThreats, isInteracting }: { hasThreats: boolean; isInteracting: boolean }) {
  const earthRef = useRef<THREE.Mesh>(null);
  const wireframeRef = useRef<THREE.Mesh>(null);
  const cloudRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (isInteracting) return;
    const speed = 0.0006;
    if (earthRef.current) earthRef.current.rotation.y += speed;
    if (wireframeRef.current) wireframeRef.current.rotation.y += speed * 1.01;
    if (cloudRef.current) cloudRef.current.rotation.y += speed * 1.15;
    if (glowRef.current) glowRef.current.rotation.y += speed * 0.2;
  });

  return (
    <group>
      {/* Ocean base */}
      <mesh ref={earthRef}>
        <sphereGeometry args={[2, 64, 64]} />
        <meshStandardMaterial
          color={hasThreats ? '#1a0a0a' : '#0a1628'}
          roughness={0.4}
          metalness={0.3}
        />
      </mesh>

      {/* Continents wireframe */}
      <mesh ref={wireframeRef}>
        <sphereGeometry args={[2.02, 32, 32]} />
        <meshStandardMaterial
          color={hasThreats ? '#3a1a1a' : '#1a3a5c'}
          roughness={0.7}
          metalness={0.1}
          wireframe
          transparent
          opacity={hasThreats ? 0.15 : 0.1}
        />
      </mesh>

      {/* Cloud layer */}
      <mesh ref={cloudRef}>
        <sphereGeometry args={[2.12, 32, 32]} />
        <meshStandardMaterial
          color="#ffffff"
          transparent
          opacity={0.05}
          roughness={1}
        />
      </mesh>

      {/* Atmosphere glow */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[2.35, 32, 32]} />
        <meshBasicMaterial
          color={hasThreats ? '#ef4444' : '#4F46E5'}
          transparent
          opacity={hasThreats ? 0.06 : 0.03}
        />
      </mesh>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COUNTRY MARKERS
// ═══════════════════════════════════════════════════════════════════════════

const COUNTRIES = [
  { name: 'US', lat: 37.09, lng: -95.71 }, { name: 'CN', lat: 35.86, lng: 104.19 },
  { name: 'RU', lat: 61.52, lng: 105.31 }, { name: 'IR', lat: 32.42, lng: 53.68 },
  { name: 'KP', lat: 40.33, lng: 127.51 }, { name: 'NG', lat: 9.08, lng: 8.67 },
  { name: 'BR', lat: -14.23, lng: -51.92 }, { name: 'IN', lat: 20.59, lng: 78.96 },
  { name: 'GB', lat: 55.37, lng: -3.43 }, { name: 'DE', lat: 51.16, lng: 10.45 },
];

function latLngToVec3(lat: number, lng: number, radius: number): [number, number, number] {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return [
    -(radius * Math.sin(phi) * Math.cos(theta)),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  ];
}

function CountryMarkers() {
  return (
    <group>
      {COUNTRIES.map(country => {
        const pos = latLngToVec3(country.lat, country.lng, 2.1);
        return (
          <mesh key={country.name} position={pos}>
            <sphereGeometry args={[0.03, 4, 4]} />
            <meshBasicMaterial color="#64748b" transparent opacity={0.6} />
          </mesh>
        );
      })}
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ANIMATED ATTACK PACKET
// ═══════════════════════════════════════════════════════════════════════════

function AnimatedAttackArc({ from, to, severity, onClick }: {
  from: [number, number, number]; to: [number, number, number]; severity: string; onClick?: () => void;
}) {
  const packetRef = useRef<THREE.Mesh>(null);
  const midPoint: [number, number, number] = [
    (from[0] + to[0]) / 2, (from[1] + to[1]) / 2 + 2.5, (from[2] + to[2]) / 2,
  ];

  const curve = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 50; i++) {
      const t = i / 50;
      pts.push(new THREE.Vector3(
        (1 - t) * (1 - t) * from[0] + 2 * (1 - t) * t * midPoint[0] + t * t * to[0],
        (1 - t) * (1 - t) * from[1] + 2 * (1 - t) * t * midPoint[1] + t * t * to[1],
        (1 - t) * (1 - t) * from[2] + 2 * (1 - t) * t * midPoint[2] + t * t * to[2],
      ));
    }
    return pts;
  }, [from, to, midPoint]);

  const color = severity === 'CRITICAL' ? '#ef4444' : severity === 'HIGH' ? '#f59e0b' : '#a78bfa';

  // Animate packet along curve
  useFrame((state) => {
    if (!packetRef.current) return;
    const t = (state.clock.elapsedTime * 0.3) % 1;
    const idx = Math.floor(t * 50);
    const pt = curve[Math.min(idx, 49)];
    packetRef.current.position.copy(pt);
    packetRef.current.scale.setScalar(0.8 + Math.sin(state.clock.elapsedTime * 8) * 0.3);
  });

  return (
    <group onClick={onClick}>
      {/* Static arc line */}
      <Line points={curve} color={color} lineWidth={1.5} transparent opacity={0.5} />
      {/* Moving packet */}
      <mesh ref={packetRef}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {/* Source dot */}
      <mesh position={from}>
        <sphereGeometry args={[0.06, 6, 6]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {/* Target pulse ring */}
      <PulseRing position={to} color={color} />
    </group>
  );
}

function PulseRing({ position, color }: { position: [number, number, number]; color: string }) {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!ringRef.current) return;
    const s = 1 + Math.sin(state.clock.elapsedTime * 2.5) * 0.4;
    ringRef.current.scale.setScalar(s);
    (ringRef.current.material as THREE.MeshBasicMaterial).opacity = 0.2 + Math.sin(state.clock.elapsedTime * 2.5) * 0.15;
  });

  return (
    <mesh ref={ringRef} position={position}>
      <torusGeometry args={[0.2, 0.015, 8, 16]} />
      <meshBasicMaterial color={color} transparent opacity={0.3} />
    </mesh>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENE
// ═══════════════════════════════════════════════════════════════════════════

function Scene({ onAttackClick }: { onAttackClick: (alertId: string) => void }) {
  const { guardianAlerts } = useStore();
  const [isInteracting, setIsInteracting] = useState(false);

  const attacks = useRef<{ id: string; from: [number, number, number]; to: [number, number, number]; severity: string }[]>([]);

  // Generate stable attack positions once
  if (attacks.current.length === 0 && guardianAlerts.length > 0) {
    attacks.current = guardianAlerts.slice(0, 8).map((alert, i) => {
      const country = COUNTRIES[i % COUNTRIES.length];
      const from = latLngToVec3(country.lat + (Math.random() - 0.5) * 8, country.lng + (Math.random() - 0.5) * 12, 3.5);
      const to = latLngToVec3((Math.random() - 0.5) * 15, (Math.random() - 0.5) * 25, 2.12);
      return { id: alert.id, from, to, severity: alert.severity };
    });
  }

  if (guardianAlerts.length === 0 && attacks.current.length > 0) {
    attacks.current = [];
  }

  const hasThreats = guardianAlerts.length > 0;
  const criticalCount = guardianAlerts.filter(a => a.severity === 'CRITICAL').length;

  return (
    <>
      <ambientLight intensity={0.25} />
      <pointLight position={[5, 5, 5]} intensity={0.6} color={hasThreats ? '#ef4444' : '#4F46E5'} />
      <pointLight position={[-3, -2, -3]} intensity={0.25} color="#06B6D4" />

      <Starfield />
      <Globe hasThreats={hasThreats} isInteracting={isInteracting} />
      <CountryMarkers />

      {attacks.current.map((attack) => (
        <AnimatedAttackArc key={attack.id} from={attack.from} to={attack.to} severity={attack.severity} onClick={() => onAttackClick(attack.id)} />
      ))}

      <Html position={[0, -3.5, 0]} center>
        <div className="flex flex-col items-center gap-1">
          {hasThreats ? (
            <>
              <AlertTriangle className="w-5 h-5 text-red-400 animate-pulse" />
              <span className="text-[10px] font-mono font-bold text-red-400 uppercase tracking-wider">{criticalCount} Critical · {guardianAlerts.length} Active</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider">All Clear</span>
            </>
          )}
        </div>
      </Html>

      <OrbitControls enableDamping dampingFactor={0.08} minDistance={3} maxDistance={15}
        autoRotate={!isInteracting} autoRotateSpeed={0.4}
        onStart={() => setIsInteracting(true)} onEnd={() => setIsInteracting(false)} />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function SecurityGlobe() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { guardianAlerts } = useStore();
  const navigate = useNavigate();
  const hasThreats = guardianAlerts.length > 0;

  const handleAttackClick = useCallback((alertId: string) => {
    navigate(`/guardian?alert=${alertId}`);
  }, [navigate]);

  return (
    <div className={cn('relative rounded-2xl border overflow-hidden',
      hasThreats ? 'border-red-500/30' : 'border-brand-border/50',
      isFullscreen ? 'fixed inset-0 z-50' : 'w-full h-full min-h-[400px]')}
      style={{ background: '#080C14' }}>

      {hasThreats && <div className="absolute top-0 left-0 right-0 h-0.5 bg-red-400 animate-pulse z-20" />}

      <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5">
        <button onClick={() => navigate('/guardian')}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#0F1629]/90 border border-[#1E2942]/60 text-[#64748B] hover:text-white text-[9px] font-mono transition-colors">
          <ExternalLink className="w-3 h-3" /> Logs
        </button>
        <button onClick={() => setIsFullscreen(!isFullscreen)}
          className="p-1.5 rounded-lg bg-[#0F1629]/90 border border-[#1E2942]/60 text-[#64748B] hover:text-white transition-colors">
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      <Canvas camera={{ position: [0, 0, 7], fov: 45 }} gl={{ alpha: false, antialias: true }}>
        <color attach="background" args={['#080C14']} />
        <Scene onAttackClick={handleAttackClick} />
      </Canvas>

      <div className="absolute bottom-3 left-3 z-20 flex items-center gap-3 text-[9px] font-mono text-[#64748B] bg-[#0F1629]/95 border border-[#1E2942]/60 rounded-lg px-3 py-1.5">
        <span className="flex items-center gap-1"><Shield className="w-3 h-3 text-brand-primary" /> Guardian Live</span>
        <span className="text-[#1E2942]">|</span>
        <span>{guardianAlerts.length} alerts</span>
        {hasThreats && <><span className="text-[#1E2942]">|</span><span className="text-red-400">{guardianAlerts.filter(a => a.severity === 'CRITICAL').length} critical</span></>}
      </div>
    </div>
  );
}
