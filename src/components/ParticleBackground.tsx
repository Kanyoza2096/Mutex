import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  opacitySpeed: number;
}

const PARTICLE_COUNT = 28;
const CONNECTION_DISTANCE = 110;
const PARTICLE_COLOR = '99, 102, 241';

const ParticleBackground = React.memo(function ParticleBackground() {
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const particlesRef  = useRef<Particle[]>([]);
  const animRef       = useRef<number>(0);
  const mouseRef      = useRef({ x: -1000, y: -1000 });
  const skipRef       = useRef(false);

  // Detect Chrome mobile — must happen inside the component body (before hooks is fine
  // as long as we never conditionally call hooks themselves).
  useEffect(() => {
    const isChromeMobile =
      /Chrome/.test(navigator.userAgent) &&
      /Google Inc/.test(navigator.vendor) &&
      window.innerWidth < 768;
    skipRef.current = isChromeMobile;
  }, []);

  useEffect(() => {
    // Re-check on mount (synchronously, after the above effect has run we just rely on
    // the synchronous check here for the canvas setup path).
    const isChromeMobile =
      /Chrome/.test(navigator.userAgent) &&
      /Google Inc/.test(navigator.vendor) &&
      window.innerWidth < 768;

    if (isChromeMobile) return; // Static fallback renders via JSX below

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize, { passive: true });

    particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () => ({
      x:            Math.random() * canvas.width,
      y:            Math.random() * canvas.height,
      vx:           (Math.random() - 0.5) * 0.28,
      vy:           (Math.random() - 0.5) * 0.28,
      size:         Math.random() * 1.8 + 0.4,
      opacity:      Math.random() * 0.35 + 0.05,
      opacitySpeed: (Math.random() - 0.5) * 0.002,
    }));

    const handleMouse = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', handleMouse, { passive: true });

    let frame = 0;
    const animate = () => {
      frame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const particles = particlesRef.current;
      const mouse     = mouseRef.current;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        p.opacity += p.opacitySpeed;
        if (p.opacity > 0.45 || p.opacity < 0.03) p.opacitySpeed *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${PARTICLE_COLOR}, ${p.opacity})`;
        ctx.fill();

        // Draw connections every 5th frame for better performance
        if (frame % 5 === 0) {
          for (let j = i + 1; j < particles.length; j++) {
            const p2  = particles[j];
            const dx  = p.x - p2.x;
            const dy  = p.y - p2.y;
            const d2  = dx * dx + dy * dy;
            if (d2 < CONNECTION_DISTANCE * CONNECTION_DISTANCE) {
              const dist  = Math.sqrt(d2);
              const alpha = (1 - dist / CONNECTION_DISTANCE) * 0.07;
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.strokeStyle = `rgba(${PARTICLE_COLOR}, ${alpha})`;
              ctx.lineWidth   = 0.4;
              ctx.stroke();
            }
          }
        }

        // Gentle mouse repulsion
        const mdx  = mouse.x - p.x;
        const mdy  = mouse.y - p.y;
        const mD2  = mdx * mdx + mdy * mdy;
        if (mD2 < 14400) { // 120^2
          const mDist = Math.sqrt(mD2);
          const force = (120 - mDist) / 120;
          p.vx += (mdx / mDist) * force * 0.008;
          p.vy += (mdy / mDist) * force * 0.008;
        }

        p.vx *= 0.999;
        p.vy *= 0.999;
      }

      animRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouse);
    };
  }, []);

  return (
    <>
      {/* Ambient glow base — always visible */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden" style={{ backgroundColor: 'var(--color-brand-bg)' }}>
        <div className="absolute top-[-15%] left-[-10%] w-[45%] h-[45%] rounded-full bg-brand-primary/4 blur-[140px]" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[55%] h-[55%] rounded-full bg-brand-primary/3 blur-[160px]" />
        <div className="absolute top-[35%] left-[25%] w-[35%] h-[35%] rounded-full bg-brand-accent/2 blur-[120px]" />
      </div>

      {/* Canvas particle layer — particle-canvas class scopes the webkit opacity rule in index.css */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none particle-canvas"
        style={{ zIndex: -5, opacity: 0.5 }}
      />
    </>
  );
});

export default ParticleBackground;
