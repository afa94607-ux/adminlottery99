/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AdminPanel, CreatePlayerInput } from './components/AdminPanel';
import { AdminLogin } from './components/AdminLogin';
import {
  ChannelLetter,
  RoundResult,
  BetTicket,
  AppUser,
  SystemConfig,
  BalanceTransaction,
  AuditLogEntry,
  FinancialReportsSummary,
} from './types/lottery';
import { INITIAL_PAST_ROUNDS, DEFAULT_SYSTEM_CONFIG } from './utils/formatters';
import { sound } from './utils/audio';
import { lotteryApi } from './utils/lotteryApi';

const TOKEN_KEY_OWNER = 'lottery888_owner_token_v1';

const EMPTY_REPORTS: FinancialReportsSummary = {
  totalPlayers: 0,
  activePlayers: 0,
  disabledPlayers: 0,
  totalPlayerBalances: 0,
  pendingBetsCount: 0,
  pendingBetsVolume: 0,
  settledBetsCount: 0,
  voidBetsCount: 0,
  totalValidStakes: 0,
  settledValidStakes: 0,
  totalWinningPayouts: 0,
  ownerProfitLoss: 0,
  ownerRealizedProfitLoss: 0,
  totalDeposits: 0,
  totalWithdrawals: 0,
  netCashflow: 0,
  playerReports: [],
  dailyReports: [],
  roundReports: [],
  detailedBets: [],
};

export default function App() {
  const [ownerToken, setOwnerToken] = useState<string | null>(() =>
    typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY_OWNER) : null
  );
  const [ownerSession, setOwnerSession] = useState<AppUser | null>(null);
  const [isVerifyingAuth, setIsVerifyingAuth] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    const verify = async () => {
      try {
        if (ownerToken) {
          const res = await lotteryApi.verifySession(ownerToken);
          if (mounted) {
            if (res.ok && res.data?.account?.role === 'OWNER' && res.data.account.status === 'ACTIVE') {
              setOwnerSession(res.data.account);
            } else {
              localStorage.removeItem(TOKEN_KEY_OWNER);
              setOwnerToken(null);
              setOwnerSession(null);
            }
          }
        }
      } finally {
        if (mounted) setIsVerifyingAuth(false);
      }
    };
    verify();
    return () => {
      mounted = false;
    };
  }, []);

  const [currentRoundId, setCurrentRoundId] = useState<string>('26292#149');
  const [countdownSeconds, setCountdownSeconds] = useState<number>(
    DEFAULT_SYSTEM_CONFIG.drawIntervalSeconds
  );
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [bettingClosed, setBettingClosed] = useState<boolean>(false);
  const [pastRounds, setPastRounds] = useState<RoundResult[]>(INITIAL_PAST_ROUNDS);
  const [systemConfig, setSystemConfig] = useState<SystemConfig>(DEFAULT_SYSTEM_CONFIG);
  const [forcedNextNumbers, setForcedNextNumbers] = useState<Record<ChannelLetter, string> | null>(null);
  const [players, setPlayers] = useState<AppUser[]>([]);
  const [tickets, setTickets] = useState<BetTicket[]>([]);
  const [transactions, setTransactions] = useState<BalanceTransaction[]>([]);
  const [reports, setReports] = useState<FinancialReportsSummary>(EMPTY_REPORTS);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  const serverClockOffsetRef = useRef<number>(0);

  const handleOwnerLogin = (ownerAccount: AppUser, token: string) => {
    localStorage.setItem(TOKEN_KEY_OWNER, token);
    setOwnerToken(token);
    setOwnerSession(ownerAccount);
  };

  const handleOwnerLogout = useCallback(async () => {
    if (ownerToken) {
      await lotteryApi.logout(ownerToken);
    }
    localStorage.removeItem(TOKEN_KEY_OWNER);
    setOwnerToken(null);
    setOwnerSession(null);
    setPlayers([]);
    setTickets([]);
    setTransactions([]);
    setAuditLogs([]);
    setReports(EMPTY_REPORTS);
  }, [ownerToken]);

  const roundEndTimeRef = useRef<number>(Date.now() + DEFAULT_SYSTEM_CONFIG.drawIntervalSeconds * 1000);
  const roundDurationRef = useRef<number>(DEFAULT_SYSTEM_CONFIG.drawIntervalSeconds);
  const isSystemOpenRef = useRef<boolean>(DEFAULT_SYSTEM_CONFIG.isSystemOpen);
  const isDrawingRef = useRef<boolean>(false);
  const lastRoundIdRef = useRef<string>('');

  const refreshAdminState = useCallback(async (mode: 'full' | 'live' = 'full') => {
    if (!ownerToken) return;
    const res = await lotteryApi.getAdminState(ownerToken, mode);
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        await handleOwnerLogout();
      }
      return;
    }
    const state = res.data;
    if (!state) return;

    const prevRoundId = lastRoundIdRef.current;
    const wasDrawing = isDrawingRef.current;
    lastRoundIdRef.current = state.currentRoundId;
    roundEndTimeRef.current = state.roundEndTime;
    roundDurationRef.current = Math.max(
      1,
      state.roundDurationSeconds || state.systemConfig.drawIntervalSeconds || 300
    );
    isSystemOpenRef.current = state.systemConfig.isSystemOpen;
    isDrawingRef.current = state.isDrawing;

    serverClockOffsetRef.current = Date.now() - state.serverTimestamp;
    setOwnerSession(state.owner);
    setCurrentRoundId(state.currentRoundId);
    setIsDrawing(state.isDrawing);
    setSystemConfig(state.systemConfig);
    setForcedNextNumbers(state.forcedNextNumbers);
    setPlayers(state.players);

    if (mode === 'full') {
      setPastRounds(state.pastRounds);
      setTickets(state.tickets);
      if (state.transactions) setTransactions(state.transactions);
      if (state.reports) setReports(state.reports);
      if (state.auditLogs) setAuditLogs(state.auditLogs);
    } else {
      setPastRounds((prev) => {
        const map = new Map(prev.map((r) => [r.roundId, r]));
        for (const r of state.pastRounds) map.set(r.roundId, r);
        return Array.from(map.values())
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 50);
      });
      setTickets((prev) => {
        const map = new Map(prev.map((t) => [t.ticketId, t]));
        for (const t of state.tickets) map.set(t.ticketId, t);
        return Array.from(map.values())
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 500);
      });
    }

    if (state.isDrawing) {
      setCountdownSeconds(0);
      setBettingClosed(true);
    } else {
      const maxDuration = roundDurationRef.current;
      const remaining = Math.min(
        maxDuration,
        Math.max(
          0,
          Math.ceil((state.roundEndTime - (Date.now() - serverClockOffsetRef.current)) / 1000)
        )
      );
      setCountdownSeconds(remaining);
      setBettingClosed(
        Boolean(state.bettingClosed) || !state.systemConfig.isSystemOpen || remaining <= 0
      );
    }

    // When a round settles or changes, fetch full financial reports once
    if (mode === 'live' && ((prevRoundId && prevRoundId !== state.currentRoundId) || (wasDrawing && !state.isDrawing))) {
      void refreshAdminState('full');
    }
  }, [ownerToken, handleOwnerLogout]);

  useEffect(() => {
    if (!ownerToken || !ownerSession) return;
    let cancelled = false;
    let timerId: number | null = null;

    void refreshAdminState('full');

    // Local 1s countdown UI tick (0 D1 reads)
    const uiTick = window.setInterval(() => {
      if (isDrawingRef.current) {
        setCountdownSeconds(0);
        setBettingClosed(true);
        return;
      }
      const maxDuration = roundDurationRef.current;
      const remaining = Math.min(
        maxDuration,
        Math.max(
          0,
          Math.ceil((roundEndTimeRef.current - (Date.now() - serverClockOffsetRef.current)) / 1000)
        )
      );
      setCountdownSeconds(remaining);
      setBettingClosed(!isSystemOpenRef.current || remaining <= 0);
    }, 1000);

    // Adaptive server sync: 2s near/during draw, 10s otherwise
    const scheduleNextSync = () => {
      if (cancelled) return;
      const remaining = Math.max(
        0,
        Math.ceil((roundEndTimeRef.current - (Date.now() - serverClockOffsetRef.current)) / 1000)
      );
      const delayMs = isDrawingRef.current || remaining <= 8 ? 2000 : 10000;
      timerId = window.setTimeout(async () => {
        if (cancelled) return;
        await refreshAdminState('live');
        scheduleNextSync();
      }, delayMs);
    };
    scheduleNextSync();

    const handleOnline = () => void refreshAdminState('live');
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void refreshAdminState('full');
    };
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(uiTick);
      if (timerId !== null) window.clearTimeout(timerId);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [ownerToken, Boolean(ownerSession), refreshAdminState]);

  const handleCreatePlayer = async (input: CreatePlayerInput): Promise<string | null> => {
    if (!ownerToken) return 'Not authenticated';
    const res = await lotteryApi.createPlayer(ownerToken, input);
    if (!res.ok) return res.error || 'Failed to create player';
    await refreshAdminState();
    return null;
  };

  const handleResetPlayerPassword = async (
    userId: string,
    newPassword: string
  ): Promise<string | null> => {
    if (!ownerToken) return 'Not authenticated';
    const res = await lotteryApi.resetPlayerPassword(ownerToken, userId, newPassword);
    if (!res.ok) return res.error || 'Failed to reset password';
    await refreshAdminState();
    return null;
  };

  const handleTogglePlayerStatus = async (userId: string): Promise<string | null> => {
    if (!ownerToken) return 'Not authenticated';
    const res = await lotteryApi.togglePlayerStatus(ownerToken, userId);
    if (!res.ok) return res.error || 'Failed to update status';
    await refreshAdminState();
    return null;
  };

  const handleDeletePlayer = async (userId: string): Promise<string | null> => {
    if (!ownerToken) return 'Not authenticated';
    const res = await lotteryApi.deletePlayer(ownerToken, userId);
    if (!res.ok) return res.error || 'Failed to delete player';
    await refreshAdminState();
    return null;
  };

  const handleChangeOwnerPassword = async (
    currentPassword: string,
    newPassword: string
  ): Promise<string | null> => {
    if (!ownerToken) return 'Not authenticated';
    const res = await lotteryApi.changeOwnerPassword(ownerToken, currentPassword, newPassword);
    if (!res.ok) return res.error || 'Failed to change owner password';
    await refreshAdminState();
    return null;
  };

  const handleProcessTransaction = async (
    userId: string,
    type: 'DEPOSIT' | 'WITHDRAWAL' | 'SET',
    amount: number,
    paymentMethod: string,
    note?: string
  ): Promise<string | null> => {
    if (!ownerToken) return 'Not authenticated';
    const res = await lotteryApi.processTransaction(ownerToken, {
      userId,
      type,
      amount,
      paymentMethod,
      note,
    });
    if (!res.ok) return res.error || 'Failed to process transaction';
    await refreshAdminState();
    return null;
  };

  const handleVoidTicket = async (ticketId: string): Promise<string | null> => {
    if (!ownerToken) return 'Not authenticated';
    const res = await lotteryApi.voidTicket(ownerToken, ticketId);
    if (!res.ok) return res.error || 'Failed to void ticket';
    await refreshAdminState();
    return null;
  };

  const handleUpdateSystemConfig = async (cfg: Partial<SystemConfig>): Promise<string | null> => {
    if (!ownerToken) return 'Not authenticated';
    const res = await lotteryApi.updateSystemConfig(ownerToken, cfg);
    if (!res.ok) return res.error || 'Failed to save system config';
    await refreshAdminState();
    return null;
  };

  const handleSetForcedNumbers = async (
    numbers: Record<ChannelLetter, string> | null
  ): Promise<string | null> => {
    if (!ownerToken) return 'Not authenticated';
    const res = await lotteryApi.setForcedNumbers(ownerToken, numbers);
    if (!res.ok) return res.error || 'Failed to set forced numbers';
    await refreshAdminState();
    return null;
  };

  const handleTriggerDraw = async (): Promise<string | null> => {
    if (!ownerToken) return 'Not authenticated';
    const res = await lotteryApi.triggerDraw(ownerToken);
    if (!res.ok) return res.error || 'Failed to trigger draw';
    await refreshAdminState();
    return null;
  };

  const handleDeleteRound = async (roundId: string): Promise<string | null> => {
    if (!ownerToken) return 'Not authenticated';
    const res = await lotteryApi.deleteRound(ownerToken, roundId);
    if (!res.ok) return res.error || 'Failed to delete round';
    await refreshAdminState();
    return null;
  };

  const handleResetHistory = async (): Promise<string | null> => {
    if (!ownerToken) return 'Not authenticated';
    const res = await lotteryApi.resetHistory(ownerToken);
    if (!res.ok) return res.error || 'Failed to reset history';
    await refreshAdminState();
    return null;
  };

  const handleOpenGamePortal = () => {
    sound.playClick();
    const envGameUrl = (import.meta as unknown as { env?: { VITE_GAME_URL?: string } }).env
      ?.VITE_GAME_URL;
    const gameUrl = envGameUrl || 'http://127.0.0.1:3000';
    window.open(gameUrl, '_blank');
  };

  if (isVerifyingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-amber-400 font-bold text-sm">
        កំពុងផ្ទៀងផ្ទាត់សិទ្ធិម្ចាស់ប្រព័ន្ធ (Loading Owner Console)...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      {!ownerSession ? (
        <AdminLogin onLogin={handleOwnerLogin} onOpenPlayerPortal={handleOpenGamePortal} />
      ) : (
        <div className="flex-1 w-full animate-fadeIn">
          <AdminPanel
            currentRoundId={currentRoundId}
            countdownSeconds={countdownSeconds}
            bettingClosed={bettingClosed}
            isDrawing={isDrawing}
            ownerUser={ownerSession}
            onLogoutOwner={handleOwnerLogout}
            players={players}
            onCreatePlayer={handleCreatePlayer}
            onResetPlayerPassword={handleResetPlayerPassword}
            onTogglePlayerStatus={handleTogglePlayerStatus}
            onDeletePlayer={handleDeletePlayer}
            onChangeOwnerPassword={handleChangeOwnerPassword}
            transactions={transactions}
            onProcessTransaction={handleProcessTransaction}
            tickets={tickets}
            onVoidTicket={handleVoidTicket}
            systemConfig={systemConfig}
            onUpdateSystemConfig={handleUpdateSystemConfig}
            forcedNextNumbers={forcedNextNumbers}
            onSetForcedNextNumbers={handleSetForcedNumbers}
            onTriggerDraw={handleTriggerDraw}
            pastRounds={pastRounds}
            onDeleteRound={handleDeleteRound}
            onResetHistory={handleResetHistory}
            reports={reports}
            auditLogs={auditLogs}
            onOpenGameInNewTab={handleOpenGamePortal}
          />
        </div>
      )}
    </div>
  );
}
