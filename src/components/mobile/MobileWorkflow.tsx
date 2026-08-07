// ═══════════════════════════════════════════════════════════════════════════
// MOBILE WORKFLOW — Horizontal Pipeline
// Dashboard-safe horizontal auto-centering.
// IMPORTANT: Never use scrollIntoView() here.
// ═══════════════════════════════════════════════════════════════════════════

import React, {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  LazyMotion,
  domAnimation,
  m,
} from 'motion/react';

import {
  Play,
  CheckCircle,
  Loader2,
  Clock,
  AlertCircle,
} from 'lucide-react';

import { cn } from '../../lib/utils';

interface PipelineStage {
  label: string;
  status:
    | 'completed'
    | 'active'
    | 'waiting'
    | 'failed';
  progress?: number;
}

interface MobileWorkflowProps {
  stages?: PipelineStage[];
}

const DEFAULT_STAGES: PipelineStage[] = [
  {
    label: 'Planner',
    status: 'completed',
  },
  {
    label: 'Research',
    status: 'completed',
  },
  {
    label: 'Knowledge',
    status: 'active',
    progress: 72,
  },
  {
    label: 'Prompt',
    status: 'waiting',
  },
  {
    label: 'LLM',
    status: 'waiting',
  },
  {
    label: 'Validator',
    status: 'waiting',
  },
  {
    label: 'Reviewer',
    status: 'waiting',
  },
  {
    label: 'Renderer',
    status: 'waiting',
  },
  {
    label: 'Publisher',
    status: 'waiting',
  },
  {
    label: 'Analytics',
    status: 'waiting',
  },
];

const STATUS_ICONS: Record<
  PipelineStage['status'],
  React.ComponentType<{
    className?: string;
    style?: React.CSSProperties;
  }>
> = {
  completed: CheckCircle,
  active: Loader2,
  waiting: Clock,
  failed: AlertCircle,
};

const STATUS_COLORS: Record<
  PipelineStage['status'],
  string
> = {
  completed: '#22c55e',
  active: '#818cf8',
  waiting: '#52525b',
  failed: '#ef4444',
};

export default function MobileWorkflow({
  stages = DEFAULT_STAGES,
}: MobileWorkflowProps) {
  const scrollRef =
    useRef<HTMLDivElement>(null);

  const hasInitializedRef =
    useRef(false);

  const previousActiveIndexRef =
    useRef<number>(-1);

  const [activeIndex, setActiveIndex] =
    useState(() =>
      stages.findIndex(
        stage =>
          stage.status ===
          'active',
      ),
    );

  // ─────────────────────────────────────────────
  // Keep active index synchronized with incoming data
  // ─────────────────────────────────────────────

  useEffect(() => {
    const nextActiveIndex =
      stages.findIndex(
        stage =>
          stage.status ===
          'active',
      );

    setActiveIndex(
      nextActiveIndex,
    );
  }, [stages]);

  // ─────────────────────────────────────────────
  // Dashboard-safe horizontal auto-scroll
  //
  // NEVER use scrollIntoView().
  // ─────────────────────────────────────────────

  useEffect(() => {
    const container =
      scrollRef.current;

    if (
      !container ||
      activeIndex < 0
    ) {
      return;
    }

    // Do NOT auto-scroll during initial dashboard mount.
    //
    // This is important because the workflow component may
    // mount while the dashboard is still establishing its
    // initial scroll position.
    if (!hasInitializedRef.current) {
      hasInitializedRef.current =
        true;

      previousActiveIndexRef.current =
        activeIndex;

      return;
    }

    // Only scroll when the active stage actually changes.
    if (
      previousActiveIndexRef.current ===
      activeIndex
    ) {
      return;
    }

    previousActiveIndexRef.current =
      activeIndex;

    const child =
      container.children[
        activeIndex
      ] as HTMLElement | undefined;

    if (!child) return;

    // Calculate horizontal position ourselves.
    //
    // This ONLY changes scrollLeft on this element.
    // It cannot scroll the dashboard vertically.
    const targetLeft =
      child.offsetLeft -
      container.clientWidth / 2 +
      child.offsetWidth / 2;

    const maxScroll =
      container.scrollWidth -
      container.clientWidth;

    const nextLeft =
      Math.max(
        0,
        Math.min(
          targetLeft,
          maxScroll,
        ),
      );

    container.scrollTo({
      left: nextLeft,
      behavior: 'smooth',
    });
  }, [activeIndex]);

  const completedCount =
    stages.filter(
      stage =>
        stage.status ===
        'completed',
    ).length;

  return (
    <LazyMotion
      features={domAnimation}
      strict
    >
      <section className="
        flex
        flex-col
        h-full
        min-h-0
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
            <Play
              className="
                w-3
                h-3
                shrink-0
                text-indigo-400
              "
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
              Pipeline
            </span>
          </div>

          <span className="
            shrink-0
            ml-2
            text-[8px]
            font-mono
            text-zinc-600
          ">
            {completedCount}/
            {stages.length} complete
          </span>
        </header>

        {/* Horizontal pipeline */}
        <div
          ref={scrollRef}
          className="
            flex
            flex-1
            min-h-0
            gap-3
            overflow-x-auto
            overflow-y-hidden
            overscroll-x-contain
            overscroll-y-none
            px-3
            py-4
            scrollbar-none
            snap-x
            snap-mandatory
            touch-pan-x
          "
          style={{
            scrollbarWidth: 'none',
            WebkitOverflowScrolling:
              'touch',
          }}
        >
          {/* Left spacer */}
          <div
            aria-hidden="true"
            className="w-0 shrink-0"
          />

          {stages.map(
            (stage, index) => {
              const Icon =
                STATUS_ICONS[
                  stage.status
                ] || Clock;

              const color =
                STATUS_COLORS[
                  stage.status
                ] || '#52525b';

              const isActive =
                stage.status ===
                'active';

              const isCompleted =
                stage.status ===
                'completed';

              return (
                <m.div
                  key={`${stage.label}-${index}`}
                  initial={{
                    opacity: 0,
                    scale: 0.94,
                  }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                  }}
                  transition={{
                    delay: Math.min(
                      index * 0.035,
                      0.25,
                    ),
                    duration: 0.22,
                  }}
                  className={cn(
                    `
                      relative
                      flex
                      flex-shrink-0
                      w-28
                      snap-center
                      rounded-2xl
                      p-3
                      flex-col
                      items-center
                      gap-2
                      border
                      transition-colors
                    `,

                    isActive &&
                      `
                        border-indigo-500/40
                        bg-indigo-500/5
                      `,

                    isCompleted &&
                      `
                        border-emerald-500/20
                        bg-emerald-500/[0.03]
                      `,

                    !isActive &&
                      !isCompleted &&
                      `
                        border-zinc-800/50
                        bg-[#0a0a14]/40
                      `,
                  )}
                >
                  {/* Stage number */}
                  <span
                    className="
                      w-7
                      h-7
                      shrink-0
                      rounded-full
                      flex
                      items-center
                      justify-center
                      text-[10px]
                      font-mono
                      font-bold
                    "
                    style={{
                      backgroundColor:
                        `${color}20`,

                      color,

                      border:
                        `1.5px solid ${color}40`,
                    }}
                  >
                    {index + 1}
                  </span>

                  {/* Status icon */}
                  <Icon
                    className={cn(
                      'w-5 h-5 shrink-0',
                      isActive &&
                        'animate-spin',
                    )}
                    style={{
                      color,
                      animationDuration:
                        '3s',
                    }}
                  />

                  {/* Label */}
                  <span className="
                    min-h-[24px]
                    flex
                    items-center
                    text-[9px]
                    font-mono
                    font-bold
                    text-zinc-400
                    text-center
                  ">
                    {stage.label}
                  </span>

                  {/* Status */}
                  <span
                    className="
                      text-[7px]
                      font-mono
                      uppercase
                      tracking-wider
                      px-1.5
                      py-0.5
                      rounded-full
                    "
                    style={{
                      backgroundColor:
                        `${color}15`,
                      color,
                    }}
                  >
                    {stage.status}
                  </span>

                  {/* Progress */}
                  {isActive &&
                    stage.progress !==
                      undefined && (
                      <div className="
                        w-full
                        h-1
                        bg-zinc-900
                        rounded-full
                        overflow-hidden
                        mt-1
                      ">
                        <m.div
                          initial={{
                            width: 0,
                          }}
                          animate={{
                            width: `${Math.min(
                              100,
                              Math.max(
                                0,
                                stage.progress,
                              ),
                            )}%`,
                          }}
                          transition={{
                            duration: 0.7,
                            ease: 'easeOut',
                          }}
                          className="
                            h-full
                            rounded-full
                          "
                          style={{
                            backgroundColor:
                              color,
                          }}
                        />
                      </div>
                    )}
                </m.div>
              );
            },
          )}

          {/* Right breathing room */}
          <div
            aria-hidden="true"
            className="
              w-1
              shrink-0
            "
          />
        </div>

        {/* Progress indicators */}
        <div className="
          flex
          justify-center
          gap-1
          pb-2
          shrink-0
        ">
          {stages.map(
            (stage, index) => (
              <m.div
                key={index}
                animate={
                  stage.status ===
                  'active'
                    ? {
                        scale: [
                          1,
                          1.5,
                          1,
                        ],
                      }
                    : {
                        scale: 1,
                      }
                }
                transition={{
                  repeat:
                    stage.status ===
                    'active'
                      ? Infinity
                      : 0,
                  duration: 1.5,
                }}
                className="
                  w-1.5
                  h-1.5
                  shrink-0
                  rounded-full
                "
                style={{
                  backgroundColor:
                    STATUS_COLORS[
                      stage.status
                    ] || '#52525b',

                  opacity:
                    stage.status ===
                    'waiting'
                      ? 0.3
                      : 1,
                }}
              />
            ),
          )}
        </div>
      </section>
    </LazyMotion>
  );
}
