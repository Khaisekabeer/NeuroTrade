'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

// Shared panel wrapper used by every dashboard card. Gives consistent dark
// styling, a subtle framer-motion fade-in, and an optional title/subtitle row.
export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: React.ReactNode
  subtitle?: React.ReactNode
  icon?: React.ReactNode
  actions?: React.ReactNode
  bodyClassName?: string
  noPad?: boolean
}

export function Panel({
  title,
  subtitle,
  icon,
  actions,
  bodyClassName,
  noPad,
  className,
  children,
  ...rest
}: PanelProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={cn(
        'relative flex flex-col rounded-xl border border-zinc-800/80 bg-zinc-900/70 backdrop-blur-sm shadow-lg shadow-black/20 overflow-hidden',
        className,
      )}
      {...(rest as any)}
    >
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-zinc-800/80 px-4 py-3 bg-zinc-900/60">
          <div className="flex items-center gap-2 min-w-0">
            {icon && <span className="text-zinc-400 shrink-0">{icon}</span>}
            <div className="min-w-0">
              {title && (
                <h3 className="text-[13px] font-semibold tracking-wide text-zinc-100 uppercase truncate">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-[11px] text-zinc-500 truncate">{subtitle}</p>
              )}
            </div>
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </header>
      )}
      <div className={cn(noPad ? '' : 'p-4', 'flex-1 min-w-0', bodyClassName)}>
        {children}
      </div>
    </motion.section>
  )
}

// Small stat tile used in many panels.
export function StatTile({
  label,
  value,
  hint,
  valueClassName,
}: {
  label: React.ReactNode
  value: React.ReactNode
  hint?: React.ReactNode
  valueClassName?: string
}) {
  return (
    <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/50 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={cn('text-sm font-semibold tabular-nums text-zinc-100 mt-0.5', valueClassName)}>
        {value}
      </div>
      {hint && <div className="text-[10px] text-zinc-500 mt-0.5">{hint}</div>}
    </div>
  )
}

// Live pulsing dot.
export function LiveDot({
  color = 'emerald',
  pulse = true,
  className,
}: {
  color?: 'emerald' | 'rose' | 'amber' | 'zinc' | 'sky'
  pulse?: boolean
  className?: string
}) {
  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-500',
    rose: 'bg-rose-500',
    amber: 'bg-amber-500',
    zinc: 'bg-zinc-500',
    sky: 'bg-sky-500',
  }
  return (
    <span className={cn('relative inline-flex h-2 w-2', className)}>
      {pulse && (
        <span
          className={cn(
            'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
            colorMap[color],
          )}
        />
      )}
      <span className={cn('relative inline-flex h-2 w-2 rounded-full', colorMap[color])} />
    </span>
  )
}
