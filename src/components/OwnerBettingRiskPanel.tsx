import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpDown,
  Calculator,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coins,
  Search,
  ShieldCheck,
  Ticket,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { BetTicket, ChannelLetter } from '../types/lottery';
import { CHANNEL_COLORS, formatKHR } from '../utils/formatters';
import {
  ALL_CHANNELS,
  analyzeCurrentRoundRisk,
  ExposureLevel,
  simulateHypotheticalResult,
} from '../utils/bettingRisk';

interface OwnerBettingRiskPanelProps {
  tickets: BetTicket[];
  currentRoundId: string;
  payoutRate: number;
  lastUpdatedAt: number | null;
  syncError: string | null;
}

type SortField = 'number' | 'acceptedBets' | 'potentialPayout' | 'ownerNetImpact';

const PAGE_SIZE = 25;

function formatSignedKHR(amount: number): string {
  if (amount > 0) return `+${formatKHR(amount)}`;
  if (amount < 0) return `-${formatKHR(Math.abs(amount))}`;
  return formatKHR(0);
}

function exposureBadgeClass(level: ExposureLevel): string {
  switch (level) {
    case 'HIGH':
      return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
    case 'MEDIUM':
      return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    case 'LOW':
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    default:
      return 'bg-slate-800 text-slate-400 border-slate-700';
  }
}

export const OwnerBettingRiskPanel: React.FC<OwnerBettingRiskPanelProps> = ({
  tickets,
  currentRoundId,
  payoutRate,
  lastUpdatedAt,
  syncError,
}) => {
  const [channelFilter, setChannelFilter] = useState<'ALL' | ChannelLetter>('ALL');
  const [numberSearch, setNumberSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('potentialPayout');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  // Read-only hypothetical A-E inputs (completely isolated from Force Result / Official Draw)
  const [hypotheticalInputs, setHypotheticalInputs] = useState<Record<ChannelLetter, string>>({
    A: '01',
    B: '02',
    C: '03',
    D: '04',
    E: '05',
  });

  const riskSummary = useMemo(
    () => analyzeCurrentRoundRisk(tickets, currentRoundId, payoutRate),
    [tickets, currentRoundId, payoutRate]
  );

  const hypotheticalResult = useMemo(
    () => simulateHypotheticalResult(tickets, currentRoundId, payoutRate, hypotheticalInputs),
    [tickets, currentRoundId, payoutRate, hypotheticalInputs]
  );

  const filteredAndSortedCells = useMemo(() => {
    const q = numberSearch.trim();
    const list = riskSummary.cells.filter((cell) => {
      if (channelFilter !== 'ALL' && cell.channel !== channelFilter) return false;
      if (q && !cell.number.includes(q)) return false;
      return true;
    });

    list.sort((a, b) => {
      let diff = 0;
      if (sortField === 'number') {
        diff = a.number.localeCompare(b.number) || a.channel.localeCompare(b.channel);
      } else if (sortField === 'acceptedBets') {
        diff = a.acceptedBets - b.acceptedBets;
      } else if (sortField === 'potentialPayout') {
        diff = a.potentialPayout - b.potentialPayout;
      } else {
        diff = a.ownerNetImpact - b.ownerNetImpact;
      }
      return sortDir === 'asc' ? diff : -diff;
    });

    return list;
  }, [riskSummary.cells, channelFilter, numberSearch, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedCells.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedCells = filteredAndSortedCells.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortDir(field === 'number' || field === 'ownerNetImpact' ? 'asc' : 'desc');
    }
    setPage(1);
  };

  const profitLossColor =
    hypotheticalResult.ownerPotentialProfitLoss > 0
      ? 'text-emerald-400'
      : hypotheticalResult.ownerPotentialProfitLoss < 0
      ? 'text-rose-400'
      : 'text-slate-300';

  const lastUpdatedLabel = lastUpdatedAt
    ? new Date(lastUpdatedAt).toLocaleTimeString('en-GB', { hour12: false })
    : 'Syncing...';

  return (
    <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 sm:p-5 space-y-5 shadow-lg">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-700/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Activity className="w-5 h-5" />
            </span>
            <h3 className="text-base sm:text-lg font-black text-white">
              Owner Betting Risk Analysis (ការវិភាគហានិភ័យភ្នាល់)
            </h3>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${exposureBadgeClass(
                riskSummary.roundRiskLevel
              )}`}
            >
              Risk: {riskSummary.roundRiskLevel}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Read-only live exposure monitoring for accepted current-round bets (1:{payoutRate} payout). Does not affect official draws.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          {syncError ? (
            <span className="px-2.5 py-1 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              {syncError}
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              Updated: {lastUpdatedLabel}
            </span>
          )}
        </div>
      </div>

      {/* 6 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {/* Card 1: Current Round */}
        <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-3.5 flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Current Round
          </span>
          <div className="font-mono text-lg font-black text-amber-400 truncate">
            {riskSummary.roundId}
          </div>
          <span className="text-[11px] text-slate-500">Active round isolation</span>
        </div>

        {/* Card 2: Total Accepted Bets */}
        <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-3.5 flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Total Accepted Bets
          </span>
          <div className="flex items-center gap-1.5 font-mono text-lg font-black text-white">
            <Ticket className="w-4 h-4 text-blue-400 shrink-0" />
            <span>{riskSummary.acceptedTicketCount}</span>
          </div>
          <span className="text-[11px] text-slate-500">Excludes voided tickets</span>
        </div>

        {/* Card 3: Total Accepted Stakes */}
        <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-3.5 flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Total Accepted Stakes
          </span>
          <div className="flex items-center gap-1.5 font-mono text-lg font-black text-cyan-400">
            <Coins className="w-4 h-4 shrink-0" />
            <span>{formatKHR(riskSummary.totalAcceptedStakes)}</span>
          </div>
          <span className="text-[11px] text-slate-500">Current round volume</span>
        </div>

        {/* Card 4: Potential Payout Exposure (Simulated Scenario) */}
        <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-3.5 flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Potential Payout Exposure
          </span>
          <div className="font-mono text-lg font-black text-amber-300">
            {formatKHR(hypotheticalResult.hypotheticalTotalPayout)}
          </div>
          <span className="text-[11px] text-slate-500">Selected A–E scenario</span>
        </div>

        {/* Card 5: Owner Potential Profit / Loss (Simulated Scenario) */}
        <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-3.5 flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Owner Potential Profit / Loss
          </span>
          <div className={`flex items-center gap-1.5 font-mono text-lg font-black ${profitLossColor}`}>
            {hypotheticalResult.ownerPotentialProfitLoss >= 0 ? (
              <TrendingUp className="w-4 h-4 shrink-0" />
            ) : (
              <TrendingDown className="w-4 h-4 shrink-0" />
            )}
            <span>{formatSignedKHR(hypotheticalResult.ownerPotentialProfitLoss)}</span>
          </div>
          <span className="text-[11px] text-slate-500">Stakes − Scenario Payout</span>
        </div>

        {/* Card 6: High Exposure (Per-Channel Max) */}
        <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-3.5 flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            High Exposure (Per-Channel)
          </span>
          {riskSummary.maxChannelExposure ? (
            <>
              <div className="font-mono text-lg font-black text-rose-400">
                {formatKHR(riskSummary.maxChannelExposure.potentialPayout)}
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                Ch {riskSummary.maxChannelExposure.channel} • #{riskSummary.maxChannelExposure.number} (
                {riskSummary.maxChannelExposure.acceptedBets} bets)
              </span>
            </>
          ) : (
            <>
              <div className="font-mono text-lg font-black text-slate-500">{formatKHR(0)}</div>
              <span className="text-[11px] text-slate-500">No exposure yet</span>
            </>
          )}
        </div>
      </div>

      {/* Hypothetical Result Risk Analysis (Read-Only Simulator) */}
      <div className="bg-slate-900/80 border border-slate-700/80 rounded-xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-cyan-400" />
            <h4 className="text-sm font-extrabold text-white">
              Hypothetical Result Risk Analysis (Read-Only Simulator)
            </h4>
          </div>
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Isolated simulator — never modifies Force Result Preset or Official Draw
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-4 items-center">
          <div className="flex flex-wrap items-center gap-2">
            {ALL_CHANNELS.map((ch) => (
              <label key={ch} className="flex flex-col items-center gap-1">
                <span className={`text-xs font-black px-2 py-0.5 rounded ${CHANNEL_COLORS[ch].badgeBg}`}>
                  {ch}
                </span>
                <input
                  type="text"
                  maxLength={2}
                  inputMode="numeric"
                  aria-label={`Hypothetical Channel ${ch}`}
                  value={hypotheticalInputs[ch]}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/\D/g, '').slice(0, 2);
                    setHypotheticalInputs((prev) => ({ ...prev, [ch]: cleaned }));
                  }}
                  className="w-12 h-9 text-center font-mono font-black text-sm bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-cyan-400"
                />
              </label>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-800/70 border border-slate-700/70 rounded-xl p-3">
            <div>
              <div className="text-[11px] text-slate-400 font-semibold">Total Accepted Stakes</div>
              <div className="font-mono text-base font-black text-white">
                {formatKHR(hypotheticalResult.totalAcceptedStakes)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-semibold">Hypothetical Total Payout</div>
              <div className="font-mono text-base font-black text-amber-300">
                {formatKHR(hypotheticalResult.hypotheticalTotalPayout)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-semibold">Owner Potential Profit/Loss</div>
              <div className={`font-mono text-base font-black ${profitLossColor}`}>
                {formatSignedKHR(hypotheticalResult.ownerPotentialProfitLoss)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 01-99 Per-Number Exposure Table */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {(['ALL', ...ALL_CHANNELS] as const).map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => {
                  setChannelFilter(ch);
                  setPage(1);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                  channelFilter === ch
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-slate-900 text-slate-300 border border-slate-700 hover:text-white'
                }`}
              >
                {ch === 'ALL' ? 'All Channels' : `Channel ${ch}`}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                maxLength={2}
                placeholder="Search 01-99..."
                value={numberSearch}
                onChange={(e) => {
                  setNumberSearch(e.target.value.replace(/\D/g, '').slice(0, 2));
                  setPage(1);
                }}
                className="bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 w-36 font-mono"
              />
            </div>

            <span className="text-[11px] text-slate-400">
              {filteredAndSortedCells.length} rows (Per-channel exposure only)
            </span>
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-700/80 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-700">
                <tr>
                  <th className="py-2.5 px-3">Channel</th>
                  <th className="py-2.5 px-3">
                    <button
                      type="button"
                      onClick={() => handleSort('number')}
                      className="inline-flex items-center gap-1 hover:text-white"
                    >
                      Number <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-2.5 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleSort('acceptedBets')}
                      className="inline-flex items-center gap-1 hover:text-white"
                    >
                      Accepted Bets <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-2.5 px-3 text-right">Attributed Stake</th>
                  <th className="py-2.5 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleSort('potentialPayout')}
                      className="inline-flex items-center gap-1 hover:text-white"
                    >
                      Potential Payout <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-2.5 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleSort('ownerNetImpact')}
                      className="inline-flex items-center gap-1 hover:text-white"
                    >
                      Owner Net Impact (Ch.) <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-2.5 px-3 text-center">Exposure Level</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {pagedCells.map((cell) => (
                  <tr key={`${cell.channel}-${cell.number}`} className="hover:bg-slate-800/60">
                    <td className="py-2 px-3">
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-black ${
                          CHANNEL_COLORS[cell.channel].badgeBg
                        }`}
                      >
                        {cell.channel}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-black text-white text-sm">{cell.number}</td>
                    <td className="py-2 px-3 text-right text-slate-300">{cell.acceptedBets}</td>
                    <td className="py-2 px-3 text-right text-slate-300">
                      {formatKHR(cell.attributedStake)}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-amber-300">
                      {formatKHR(cell.potentialPayout)}
                    </td>
                    <td
                      className={`py-2 px-3 text-right font-bold ${
                        cell.ownerNetImpact > 0
                          ? 'text-emerald-400'
                          : cell.ownerNetImpact < 0
                          ? 'text-rose-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {formatSignedKHR(cell.ownerNetImpact)}
                    </td>
                    <td className="py-2 px-3 text-center font-sans">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${exposureBadgeClass(
                          cell.exposureLevel
                        )}`}
                      >
                        {cell.exposureLevel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-3 py-2 bg-slate-900 border-t border-slate-800 text-xs text-slate-400">
              <span>
                Page {safePage} of {totalPages}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="p-1 rounded bg-slate-800 border border-slate-700 disabled:opacity-40 hover:text-white"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1 rounded bg-slate-800 border border-slate-700 disabled:opacity-40 hover:text-white"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
