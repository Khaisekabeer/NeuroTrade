'use client'

import * as React from 'react'
import { Toaster as SonnerToaster } from 'sonner'
import { DashboardHydrator } from '@/components/dashboard/hydrator'
import { Header } from '@/components/dashboard/header'
import { SymbolTabs } from '@/components/dashboard/symbol-tabs'
import { TradingViewChart } from '@/components/dashboard/trading-view-chart'
import { MLPrediction } from '@/components/dashboard/ml-prediction'
import { TechnicalPanel } from '@/components/dashboard/technical-panel'
import { AgentRoster } from '@/components/dashboard/agent-roster'
import { OrchestratorDecision } from '@/components/dashboard/orchestrator-decision'
import { RiskDashboard } from '@/components/dashboard/risk-dashboard'
import { PositionsTable } from '@/components/dashboard/positions-table'
import { TradeHistory } from '@/components/dashboard/trade-history'
import { DeliberationLog } from '@/components/dashboard/deliberation-log'
import { ManualControl } from '@/components/dashboard/manual-control'
import { BitgetPanel } from '@/components/dashboard/bitget-panel'
import { TradingViewCard } from '@/components/dashboard/trading-view-card'
import { RiskSettings } from '@/components/dashboard/risk-settings'
import { Footer } from '@/components/dashboard/footer'

export default function Home() {
  return (
    <div className="bg-zinc-950 text-zinc-100 min-h-screen flex flex-col">
      <SonnerToaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#18181b',
            border: '1px solid #3f3f46',
            color: '#fafafa',
          },
        }}
      />
      <DashboardHydrator />
      <Header />
      <SymbolTabs />

      <main className="flex-1 mx-auto w-full max-w-[1800px] px-3 sm:px-4 py-4 space-y-4">
        {/* Main content grid: chart+ML+technical (2 cols) | right rail (1 col) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 flex flex-col gap-4">
            <TradingViewChart />
            <MLPrediction />
            <TechnicalPanel />
          </div>
          <div className="flex flex-col gap-4">
            <AgentRoster />
            <OrchestratorDecision />
            <RiskDashboard />
          </div>
        </div>

        {/* Lower grid: positions | trade history | deliberation log */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <PositionsTable />
          <TradeHistory />
          <DeliberationLog />
        </div>

        {/* Control + integration row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <ManualControl />
          <BitgetPanel />
          <TradingViewCard />
          <RiskSettings />
        </div>
      </main>

      <Footer />
    </div>
  )
}
