// ═══════════════════════════════════════════════════════════════════════════
// MOBILE SECURITY — Radial Pulse Security Ring
// DPR-aware canvas + ResizeObserver + reduced-motion support.
// ═══════════════════════════════════════════════════════════════════════════

import React, {
  useEffect,
  useRef,
} from 'react';

import {
  LazyMotion,
  domAnimation,
  m,
  useReducedMotion,
} from 'motion/react';

import {
  Shield,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';

import { cn } from '../../lib/utils';

interface MobileSecurityProps {
  criticalCount?: number;
  totalAlerts?: number;
  systemHealthy?: boolean;
}

export default function MobileSecurity({
  criticalCount = 0,
  totalAlerts = 0,
  systemHealthy = true,
}: MobileSecurityProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);

  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;

    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    let width = 1;
    let height = 1;
    let dpr = 1;
    let stopped = false;

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();

      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));

      dpr = Math.min(
        window.devicePixelRatio || 1,
        2,
      );

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);

      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0,
      );
    };

    resizeCanvas();

    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(container);

    const draw = (time: number) => {
      if (stopped) return;

      frameRef.current =
        requestAnimationFrame(draw);

      ctx.clearRect(
        0,
        0,
        width,
        height,
      );

      const cx = width / 2;
      const cy = height / 2;

      const maxRadius = Math.max(
        20,
        Math.min(cx, cy) - 12,
      );

      const animationTime = reducedMotion
        ? 0
        : time;

      // ─────────────────────────────────────────────
      // OUTER RING — ALERTS
      // ─────────────────────────────────────────────

      const outerBase = Math.max(
        12,
        maxRadius - 8,
      );

      const outerPulse =
        totalAlerts > 0 && !reducedMotion
          ? Math.sin(animationTime * 0.003) * 4
          : 0;

      const outerRadius =
        outerBase + outerPulse;

      ctx.save();

      ctx.strokeStyle =
        totalAlerts > 0
          ? '#f59e0b'
          : '#27272a';

      ctx.lineWidth = 2;
      ctx.globalAlpha =
        totalAlerts > 0 ? 0.65 : 0.45;

      ctx.beginPath();

      ctx.arc(
        cx,
        cy,
        outerRadius,
        0,
        Math.PI * 2,
      );

      ctx.stroke();

      if (totalAlerts > 0) {
        ctx.globalAlpha = 0.12;
        ctx.lineWidth = 8;
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 20;

        ctx.beginPath();

        ctx.arc(
          cx,
          cy,
          outerRadius,
          0,
          Math.PI * 2,
        );

        ctx.stroke();
      }

      ctx.restore();

      // ─────────────────────────────────────────────
      // MIDDLE RING — CRITICAL
      // ─────────────────────────────────────────────

      const middleBase =
        Math.max(10, maxRadius * 0.55);

      const middlePulse =
        criticalCount > 0 && !reducedMotion
          ? Math.sin(animationTime * 0.005) * 6
          : 0;

      const middleRadius =
        middleBase + middlePulse;

      ctx.save();

      ctx.strokeStyle =
        criticalCount > 0
          ? '#ef4444'
          : '#27272a';

      ctx.lineWidth = 2.5;

      ctx.globalAlpha =
        criticalCount > 0
          ? 0.8
          : 0.4;

      ctx.beginPath();

      ctx.arc(
        cx,
        cy,
        middleRadius,
        0,
        Math.PI * 2,
      );

      ctx.stroke();

      if (criticalCount > 0) {
        ctx.globalAlpha = 0.22;
        ctx.lineWidth = 10;
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 28;

        ctx.beginPath();

        ctx.arc(
          cx,
          cy,
          middleRadius,
          0,
          Math.PI * 2,
        );

        ctx.stroke();
      }

      ctx.restore();

      // ─────────────────────────────────────────────
      // INNER RING — SYSTEM STATUS
      // ─────────────────────────────────────────────

      const innerBase =
        Math.max(8, maxRadius * 0.2);

      const innerPulse =
        systemHealthy && !reducedMotion
          ? Math.sin(animationTime * 0.002) * 3
          : 0;

      const innerRadius =
        innerBase + innerPulse;

      const statusColor =
        systemHealthy
          ? '#22c55e'
          : '#ef4444';

      ctx.save();

      ctx.strokeStyle = statusColor;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.9;

      ctx.beginPath();

      ctx.arc(
        cx,
        cy,
        innerRadius,
        0,
        Math.PI * 2,
      );

      ctx.stroke();

      ctx.globalAlpha = 0.25;
      ctx.lineWidth = 8;
      ctx.shadowColor = statusColor;
      ctx.shadowBlur = 15;

      ctx.beginPath();

      ctx.arc(
        cx,
        cy,
        innerRadius,
        0,
        Math.PI * 2,
      );

      ctx.stroke();

      ctx.restore();

      // ─────────────────────────────────────────────
      // ALERT PARTICLES
      // ─────────────────────────────────────────────

      if (totalAlerts > 0) {
        const particleCount = Math.min(
          Math.max(totalAlerts, 0),
          32,
        );

        for (let i = 0; i < particleCount; i++) {
          const angle =
            reducedMotion
              ? (i * Math.PI * 2) /
                Math.max(particleCount, 1)
              : (
                  animationTime * 0.001 +
                  (i * Math.PI * 2) /
                    Math.max(particleCount, 1)
                ) % (Math.PI * 2);

          const px =
            cx +
            Math.cos(angle) *
              outerRadius;

          const py =
            cy +
            Math.sin(angle) *
              outerRadius;

          const color =
            i < criticalCount
              ? '#ef4444'
              : '#f59e0b';

          ctx.save();

          ctx.fillStyle = color;
          ctx.globalAlpha = 0.8;
          ctx.shadowColor = color;
          ctx.shadowBlur = 6;

          ctx.beginPath();

          ctx.arc(
            px,
            py,
            2.5,
            0,
            Math.PI * 2,
          );

          ctx.fill();

          ctx.restore();
        }
      }
    };

    frameRef.current =
      requestAnimationFrame(draw);

    return () => {
      stopped = true;

      observer.disconnect();

      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [
    criticalCount,
    totalAlerts,
    systemHealthy,
    reducedMotion,
  ]);

  return (
    <LazyMotion features={domAnimation} strict>
      <section className="
        flex
        flex-col
        min-h-0
        h-full
        bg-[#060610]
        overflow-hidden
      ">
        {/* Header */}
        <header className="
          flex
          items-center
          justify-between
          px-3
          py-2
          border-b
          border-zinc-800/50
          shrink-0
        ">
          <div className="
            flex
            items-center
            gap-2
            min-w-0
          ">
            <Shield
              className="w-3 h-3 shrink-0 text-indigo-400"
              aria-hidden="true"
            />

            <span className="
              truncate
              text-[9px]
              font-mono
              font-bold
              uppercase
              tracking-wider
              text-zinc-500
            ">
              Security Fabric
            </span>
          </div>

          <span
            className={cn(
              'shrink-0 ml-2 text-[8px] font-mono font-bold uppercase',
              systemHealthy
                ? 'text-emerald-400'
                : 'text-red-400',
            )}
          >
            {systemHealthy
              ? 'NOMINAL'
              : 'THREAT DETECTED'}
          </span>
        </header>

        {/* Visualization */}
        <div
          ref={containerRef}
          className="
            flex-1
            min-h-0
            relative
            flex
            items-center
            justify-center
            overflow-hidden
          "
        >
          <canvas
            ref={canvasRef}
            className="
              absolute
              inset-0
              w-full
              h-full
              pointer-events-none
            "
          />

          {/* Center */}
          <div className="
            relative
            z-10
            text-center
            pointer-events-none
          ">
            <m.div
              animate={
                reducedMotion
                  ? undefined
                  : systemHealthy
                    ? {
                        scale: [1, 1.05, 1],
                      }
                    : {
                        scale: [1, 1.1, 1],
                      }
              }
              transition={{
                repeat: Infinity,
                duration:
                  systemHealthy ? 3 : 0.8,
              }}
            >
              {systemHealthy ? (
                <CheckCircle
                  className="
                    w-10
                    h-10
                    text-emerald-400
                    mx-auto
                  "
                />
              ) : (
                <AlertTriangle
                  className="
                    w-10
                    h-10
                    text-red-400
                    mx-auto
                  "
                />
              )}
            </m.div>

            <p
              className={cn(
                'text-[10px] font-mono font-bold mt-2',
                systemHealthy
                  ? 'text-emerald-400'
                  : 'text-red-400',
              )}
            >
              {systemHealthy
                ? 'ALL CLEAR'
                : `${criticalCount} CRITICAL`}
            </p>

            <p className="
              text-[8px]
              font-mono
              text-zinc-600
              mt-0.5
            ">
              {totalAlerts} active alerts
            </p>
          </div>
        </div>
      </section>
    </LazyMotion>
  );
}
