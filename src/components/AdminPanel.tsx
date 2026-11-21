import React, { useState, useMemo, useEffect } from 'react';
import {
  ShieldAlert,
  Coins,
  Settings,
  Users,
  Dices,
  RotateCcw,
  Play,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  UserPlus,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  ExternalLink,
  Flame,
  Award,
  Wallet,
  AlertTriangle,
  KeyRound,
  LogOut,
  History,
  Download,
  Globe,
  Server,
  FileArchive,
  FileText,
  Lock,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  ChannelLetter,
  RoundResult,
  BetTicket,
  AppUser,
  SystemConfig,
  BalanceTransaction,
  AuditLogEntry,
  FinancialReportsSummary,
} from '../types/lottery';
import {
  formatKHR,
  formatSignedKHR,
  formatTimer,
  formatCambodiaDateYmd,
  formatCambodiaTimeHms,
  shiftYmdDate,
  getDaysInMonth,
  CHANNEL_COLORS,
  padNumber,
  getRandomLotteryNumber,
} from '../utils/formatters';
import { sound } from '../utils/audio';

export interface CreatePlayerInput {
  id?: string;
  username: string;
  name: string;
  password: string;
  balance: number;
  creditLimit: number;
  phone?: string;
  notes?: string;
}

interface AdminPanelProps {
  currentRoundId: string;
  countdownSeconds: number;
  bettingClosed?: boolean;
  isDrawing?: boolean;
  ownerUser: AppUser;
  onLogoutOwner: () => void;
  // Players
  players: AppUser[];
  onCreatePlayer: (player: CreatePlayerInput) => Promise<string | null>;
  onResetPlayerPassword: (userId: string, newPassword: string) => Promise<string | null>;
  onTogglePlayerStatus: (userId: string) => Promise<string | null>;
  onDeletePlayer: (userId: string) => Promise<string | null>;
  // Owner Password
  onChangeOwnerPassword: (currentPassword: string, newPassword: string) => Promise<string | null>;
  // Cashier Transactions
  transactions: BalanceTransaction[];
  onProcessTransaction: (
    userId: string,
    type: 'DEPOSIT' | 'WITHDRAWAL' | 'SET',
    amount: number,
    paymentMethod: string,
    note?: string
  ) => Promise<string | null>;
  // Tickets & In-play
  tickets: BetTicket[];
  onVoidTicket: (ticketId: string) => Promise<string | null>;
  // System Config
  systemConfig: SystemConfig;
  onUpdateSystemConfig: (config: Partial<SystemConfig>) => Promise<string | null>;
  // Results & Draws
  forcedNextNumbers: Record<ChannelLetter, string> | null;
  onSetForcedNextNumbers: (numbers: Record<ChannelLetter, string> | null) => Promise<string | null>;
  onTriggerDraw: () => Promise<string | null>;
  pastRounds: RoundResult[];
  onDeleteRound: (roundId: string) => Promise<string | null>;
  onResetHistory: () => Promise<string | null>;
  // Reports & Audit
  reports: FinancialReportsSummary;
  auditLogs: AuditLogEntry[];
  // Navigation
  onOpenGameInNewTab?: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  currentRoundId,
  countdownSeconds,
  bettingClosed = false,
  isDrawing = false,
  ownerUser,
  onLogoutOwner,
  players,
  onCreatePlayer,
  onResetPlayerPassword,
  onTogglePlayerStatus,
  onDeletePlayer,
  onChangeOwnerPassword,
  transactions,
  onProcessTransaction,
  tickets,
  onVoidTicket,
  systemConfig,
  onUpdateSystemConfig,
  forcedNextNumbers,
  onSetForcedNextNumbers,
  onTriggerDraw,
  pastRounds,
  onDeleteRound,
  onResetHistory,
  reports,
  auditLogs,
  onOpenGameInNewTab,
}) => {
  // Navigation tabs in Admin
  const [activeTab, setActiveTab] = useState<
    'inplay' | 'users' | 'cashier' | 'draws' | 'reports' | 'system'
  >('inplay');

  // Toast feedback banner
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  };

  // Search & Filter States
  const [userSearch, setUserSearch] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>('ALL');
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketFilter, setTicketFilter] = useState<'PENDING' | 'ALL' | 'WON' | 'LOST' | 'VOID'>(
    'PENDING'
  );

  // Cashier State (Deposit & Withdrawal)
  const [isCashierModalOpen, setIsCashierModalOpen] = useState(false);
  const [cashierSelectedUserId, setCashierSelectedUserId] = useState<string>('');
  const [cashierType, setCashierType] = useState<'DEPOSIT' | 'WITHDRAWAL' | 'SET'>('DEPOSIT');
  const [cashierAmount, setCashierAmount] = useState('100000');
  const [cashierPaymentMethod, setCashierPaymentMethod] = useState('ABA Bank');
  const [cashierNote, setCashierNote] = useState('');
  const [cashierFilter, setCashierFilter] = useState<
    'ALL' | 'DEPOSIT' | 'WITHDRAWAL' | 'BET' | 'PAYOUT' | 'REFUND'
  >('ALL');
  const [cashierSearch, setCashierSearch] = useState('');
  const [cashierSubmitting, setCashierSubmitting] = useState(false);

  // Modal: Add Player
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newUserId, setNewUserId] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserBalance, setNewUserBalance] = useState('0');
  const [newUserCredit, setNewUserCredit] = useState('2000000');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserNotes, setNewUserNotes] = useState('');
  const [creatingPlayer, setCreatingPlayer] = useState(false);

  // Modal: Reset Player Password
  const [passwordEditUser, setPasswordEditUser] = useState<AppUser | null>(null);
  const [passwordEditValue, setPasswordEditValue] = useState('');

  // Owner Change Password form
  const [ownerCurrentPw, setOwnerCurrentPw] = useState('');
  const [ownerNewPw, setOwnerNewPw] = useState('');
  const [ownerConfirmPw, setOwnerConfirmPw] = useState('');
  const [changingOwnerPw, setChangingOwnerPw] = useState(false);

  // Win/Loss Reports sub-views & filters (Daily Asia/Phnom_Penh UTC+7 by default)
  const todayYmd = formatCambodiaDateYmd(Date.now());
  const [reportSubView, setReportSubView] = useState<'overall' | 'player' | 'daily' | 'detailed'>(
    'overall'
  );
  const [reportSelectedPlayerId, setReportSelectedPlayerId] = useState<string>('ALL');
  const [reportSelectedDate, setReportSelectedDate] = useState<string>(todayYmd);
  const [reportStatusFilter, setReportStatusFilter] = useState<
    'SETTLED' | 'ALL' | 'WON' | 'LOST' | 'PENDING' | 'VOID'
  >('SETTLED');

  const getBetReportDateYmd = (b: { status: string; timestamp: number; settledAt?: number | null; dateYmd: string }) => {
    if (b.status === 'PENDING' || b.status === 'VOID') {
      return formatCambodiaDateYmd(b.timestamp);
    }
    return b.dateYmd || formatCambodiaDateYmd(b.settledAt ?? b.timestamp);
  };

  const reportYearOptions = useMemo(() => {
    const years = new Set<number>([parseInt(todayYmd.slice(0, 4), 10)]);
    if (reportSelectedDate !== 'ALL') {
      const sy = parseInt(reportSelectedDate.slice(0, 4), 10);
      if (sy) years.add(sy);
    }
    (reports.dailyReports || []).forEach((d) => {
      const y = parseInt(d.date.slice(0, 4), 10);
      if (y) years.add(y);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [reports.dailyReports, reportSelectedDate, todayYmd]);

  const [repYear, repMonth, repDay] = useMemo(() => {
    const base = reportSelectedDate === 'ALL' ? todayYmd : reportSelectedDate;
    const parts = base.split('-').map((n) => parseInt(n, 10));
    return [parts[0] || 2026, parts[1] || 1, parts[2] || 1];
  }, [reportSelectedDate, todayYmd]);

  const updateReportYmdParts = (y: number, m: number, d: number) => {
    const maxD = getDaysInMonth(y, m);
    const clampedD = Math.min(d, maxD);
    setReportSelectedDate(
      `${y}-${String(m).padStart(2, '0')}-${String(clampedD).padStart(2, '0')}`
    );
  };

  const filteredSettledBets = useMemo(() => {
    return (reports.detailedBets || []).filter((b) => {
      if (b.status !== 'WON' && b.status !== 'LOST') return false;
      if (reportSelectedPlayerId !== 'ALL' && b.userId !== reportSelectedPlayerId) return false;
      if (reportSelectedDate !== 'ALL' && getBetReportDateYmd(b) !== reportSelectedDate) return false;
      return true;
    });
  }, [reports.detailedBets, reportSelectedPlayerId, reportSelectedDate]);

  const filteredRoundReports = useMemo(() => {
    if (reportSelectedPlayerId === 'ALL') {
      const base = reports.roundReports || [];
      return reportSelectedDate === 'ALL'
        ? base
        : base.filter((r) => r.date === reportSelectedDate);
    }
    const map = new Map<
      string,
      {
        date: string;
        roundId: string;
        playersCount: number;
        settledBetsCount: number;
        totalValidStakes: number;
        totalActualPayouts: number;
      }
    >();
    for (const b of filteredSettledBets) {
      const key = `${b.dateYmd}|${b.roundId}`;
      const existing = map.get(key);
      if (existing) {
        existing.settledBetsCount += 1;
        existing.totalValidStakes += b.stake;
        existing.totalActualPayouts += b.payout;
      } else {
        map.set(key, {
          date: b.dateYmd,
          roundId: b.roundId,
          playersCount: 1,
          settledBetsCount: 1,
          totalValidStakes: b.stake,
          totalActualPayouts: b.payout,
        });
      }
    }
    const extractRoundNum = (rid: string) => {
      const m = rid.match(/#(\d+)/);
      return m ? parseInt(m[1], 10) : 0;
    };
    return Array.from(map.values())
      .map((r) => ({
        ...r,
        playerNetWinLoss: r.totalActualPayouts - r.totalValidStakes,
        ownerNetWinLoss: r.totalValidStakes - r.totalActualPayouts,
      }))
      .sort((a, b) => {
        const dc = b.date.localeCompare(a.date);
        return dc !== 0 ? dc : extractRoundNum(b.roundId) - extractRoundNum(a.roundId);
      });
  }, [reports.roundReports, filteredSettledBets, reportSelectedPlayerId, reportSelectedDate]);

  const filteredDailyReports = useMemo(() => {
    if (reportSelectedPlayerId === 'ALL') {
      const base = reports.dailyReports || [];
      return reportSelectedDate === 'ALL'
        ? base
        : base.filter((d) => d.date === reportSelectedDate);
    }
    const map = new Map<
      string,
      {
        date: string;
        roundIds: Set<string>;
        settledBetsCount: number;
        totalValidStakes: number;
        totalActualPayouts: number;
      }
    >();
    for (const b of filteredSettledBets) {
      let d = map.get(b.dateYmd);
      if (!d) {
        d = {
          date: b.dateYmd,
          roundIds: new Set<string>(),
          settledBetsCount: 0,
          totalValidStakes: 0,
          totalActualPayouts: 0,
        };
        map.set(b.dateYmd, d);
      }
      d.roundIds.add(b.roundId);
      d.settledBetsCount += 1;
      d.totalValidStakes += b.stake;
      d.totalActualPayouts += b.payout;
    }
    return Array.from(map.values())
      .map((d) => ({
        date: d.date,
        roundsCount: d.roundIds.size,
        playersCount: 1,
        settledBetsCount: d.settledBetsCount,
        totalValidStakes: d.totalValidStakes,
        totalActualPayouts: d.totalActualPayouts,
        playerNetWinLoss: d.totalActualPayouts - d.totalValidStakes,
        ownerNetWinLoss: d.totalValidStakes - d.totalActualPayouts,
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [reports.dailyReports, filteredSettledBets, reportSelectedPlayerId, reportSelectedDate]);

  const filteredPlayerReports = useMemo(() => {
    const basePlayers = reports.playerReports || [];
    const byDate = reportSelectedDate !== 'ALL';
    let list = basePlayers.map((pr) => {
      if (!byDate) return pr;
      const daySettled = (reports.detailedBets || []).filter(
        (b) =>
          b.userId === pr.userId &&
          getBetReportDateYmd(b) === reportSelectedDate &&
          (b.status === 'WON' || b.status === 'LOST')
      );
      const dayPending = (reports.detailedBets || []).filter(
        (b) =>
          b.userId === pr.userId &&
          getBetReportDateYmd(b) === reportSelectedDate &&
          b.status === 'PENDING'
      );
      const settledStaked = daySettled.reduce((s, b) => s + b.stake, 0);
      const totalWon = daySettled.reduce((s, b) => s + b.payout, 0);
      return {
        ...pr,
        pendingBetsCount: dayPending.length,
        settledBetsCount: daySettled.length,
        settledStaked,
        totalWon,
        playerNetProfitLoss: totalWon - settledStaked,
        ownerProfitLoss: settledStaked - totalWon,
      };
    });
    if (reportSelectedPlayerId !== 'ALL') {
      list = list.filter((pr) => pr.userId === reportSelectedPlayerId);
    }
    return list;
  }, [reports.playerReports, reports.detailedBets, reportSelectedPlayerId, reportSelectedDate]);

  const filteredDetailedBets = useMemo(() => {
    return (reports.detailedBets || []).filter((b) => {
      if (reportSelectedPlayerId !== 'ALL' && b.userId !== reportSelectedPlayerId) return false;
      if (reportSelectedDate !== 'ALL' && getBetReportDateYmd(b) !== reportSelectedDate) return false;
      if (reportStatusFilter === 'SETTLED') return b.status === 'WON' || b.status === 'LOST';
      if (reportStatusFilter !== 'ALL') return b.status === reportStatusFilter;
      return true;
    });
  }, [reports.detailedBets, reportSelectedPlayerId, reportSelectedDate, reportStatusFilter]);

  const filteredReportTotals = useMemo(() => {
    const settledCount = filteredSettledBets.length;
    const totalStake = filteredSettledBets.reduce((s, b) => s + b.stake, 0);
    const totalPayout = filteredSettledBets.reduce((s, b) => s + b.payout, 0);
    let ownerProfit = 0;
    let ownerLoss = 0;
    for (const b of filteredSettledBets) {
      const diff = b.stake - b.payout;
      if (diff > 0) ownerProfit += diff;
      else if (diff < 0) ownerLoss += Math.abs(diff);
    }
    return {
      settledCount,
      totalStake,
      totalPayout,
      ownerProfit,
      ownerLoss,
      playerNet: totalPayout - totalStake,
      ownerNet: totalStake - totalPayout,
    };
  }, [filteredSettledBets]);

  // Local state for forced draw numbers
  const [manualMode, setManualMode] = useState(forcedNextNumbers !== null);
  const [inputsA, setInputsA] = useState(forcedNextNumbers?.A || '48');
  const [inputsB, setInputsB] = useState(forcedNextNumbers?.B || '92');
  const [inputsC, setInputsC] = useState(forcedNextNumbers?.C || '83');
  const [inputsD, setInputsD] = useState(forcedNextNumbers?.D || '17');
  const [inputsE, setInputsE] = useState(forcedNextNumbers?.E || '28');

  useEffect(() => {
    if (forcedNextNumbers) {
      setManualMode(true);
      setInputsA(forcedNextNumbers.A);
      setInputsB(forcedNextNumbers.B);
      setInputsC(forcedNextNumbers.C);
      setInputsD(forcedNextNumbers.D);
      setInputsE(forcedNextNumbers.E);
    }
  }, [forcedNextNumbers]);

  // Modal: Project Export & Local Guide
  const [isDomainGuideModalOpen, setIsDomainGuideModalOpen] = useState(false);

  // Active round pending tickets
  const activeRoundTickets = useMemo(() => {
    return tickets.filter((t) => t.roundId === currentRoundId && t.status === 'PENDING');
  }, [tickets, currentRoundId]);

  const totalInPlayAmount = useMemo(() => {
    return activeRoundTickets.reduce((sum, t) => sum + t.totalCost, 0);
  }, [activeRoundTickets]);

  const totalInPlayLiability = useMemo(() => {
    return activeRoundTickets.reduce((sum, t) => {
      const maxHit = t.stakePerUnit * systemConfig.payoutRate * t.channels.length;
      return sum + maxHit;
    }, 0);
  }, [activeRoundTickets, systemConfig.payoutRate]);

  // Filtered Players
  const filteredPlayers = useMemo(() => {
    return players.filter((u) => {
      const matchStatus = userStatusFilter === 'ALL' || u.status === userStatusFilter;
      const q = userSearch.trim().toLowerCase();
      const matchQuery =
        q === '' ||
        u.id.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.name.toLowerCase().includes(q) ||
        (u.phone && u.phone.toLowerCase().includes(q));
      return matchStatus && matchQuery;
    });
  }, [players, userStatusFilter, userSearch]);

  // Filtered Tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      const matchStatus = ticketFilter === 'ALL' || t.status === ticketFilter;
      const q = ticketSearch.trim().toLowerCase();
      const matchQuery =
        q === '' ||
        t.ticketId.toLowerCase().includes(q) ||
        t.userId.toLowerCase().includes(q) ||
        (t.username && t.username.toLowerCase().includes(q)) ||
        t.roundId.toLowerCase().includes(q) ||
        t.numbers.some((n) => n.includes(q));
      return matchStatus && matchQuery;
    });
  }, [tickets, ticketFilter, ticketSearch]);

  // Top In-Play hot numbers
  const hotNumbers = useMemo(() => {
    const counts: Record<string, number> = {};
    activeRoundTickets.forEach((t) => {
      t.numbers.forEach((num) => {
        counts[num] = (counts[num] || 0) + t.stakePerUnit * t.channels.length;
      });
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [activeRoundTickets]);

  // Filtered Transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const matchType = cashierFilter === 'ALL' || tx.type === cashierFilter;
      const q = cashierSearch.trim().toLowerCase();
      const matchSearch =
        q === '' ||
        tx.transactionId.toLowerCase().includes(q) ||
        tx.userId.toLowerCase().includes(q) ||
        tx.userName.toLowerCase().includes(q) ||
        tx.paymentMethod.toLowerCase().includes(q) ||
        (tx.note && tx.note.toLowerCase().includes(q));
      return matchType && matchSearch;
    });
  }, [transactions, cashierFilter, cashierSearch]);

  // Handlers for Create Player
  const handleOpenAddPlayer = () => {
    sound.playSelect();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const code = `USR_${randomSuffix}`;
    setNewUserId(code);
    setNewUsername(code);
    setNewUserPassword('');
    setNewUserName('');
    setNewUserBalance('0');
    setNewUserCredit('2000000');
    setNewUserPhone('');
    setNewUserNotes('');
    setIsAddUserModalOpen(true);
  };

  const handleCreatePlayerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newUserPassword.trim() || !newUserName.trim()) {
      showFeedback('error', 'សូមបំពេញ Username, ឈ្មោះ និងពាក្យសម្ងាត់អ្នកលេង!');
      return;
    }

    setCreatingPlayer(true);
    const balanceNum = parseInt(newUserBalance.replace(/[^0-9]/g, ''), 10) || 0;
    const creditNum = parseInt(newUserCredit.replace(/[^0-9]/g, ''), 10) || 0;

    const err = await onCreatePlayer({
      id: newUserId.trim().toUpperCase() || undefined,
      username: newUsername.trim(),
      name: newUserName.trim(),
      password: newUserPassword.trim(),
      balance: balanceNum,
      creditLimit: creditNum,
      phone: newUserPhone.trim() || undefined,
      notes: newUserNotes.trim() || undefined,
    });
    setCreatingPlayer(false);

    if (err) {
      sound.playBeep();
      showFeedback('error', err);
      return;
    }

    sound.playCash();
    setIsAddUserModalOpen(false);
    showFeedback('success', `បង្កើតគណនីអ្នកលេង ${newUsername.trim()} ដោយជោគជ័យ!`);
  };

  // Cashier Handlers
  const handleOpenCashier = (
    targetUser: AppUser | null,
    type: 'DEPOSIT' | 'WITHDRAWAL' | 'SET' = 'DEPOSIT'
  ) => {
    sound.playSelect();
    const userToSelect = targetUser || players[0] || null;
    setCashierSelectedUserId(userToSelect ? userToSelect.id : '');
    setCashierType(type);
    setCashierAmount(type === 'WITHDRAWAL' ? '50000' : '100000');
    setCashierPaymentMethod('ABA Bank');
    setCashierNote('');
    setIsCashierModalOpen(true);
  };

  const handleSubmitCashier = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = players.find((u) => u.id === cashierSelectedUserId);
    if (!target) {
      showFeedback('error', 'សូមជ្រើសរើសគណនីអ្នកលេង!');
      return;
    }
    const amountNum = parseInt(cashierAmount.replace(/[^0-9]/g, ''), 10) || 0;
    if (cashierType !== 'SET' && amountNum <= 0) {
      showFeedback('error', 'សូមបញ្ចូលចំនួនទឹកប្រាក់ត្រឹមត្រូវ!');
      return;
    }
    if (cashierType === 'WITHDRAWAL' && amountNum > target.balance) {
      showFeedback(
        'error',
        `ចំនួនដក (${formatKHR(amountNum)}) លើសពីសមតុល្យដែលមាន (${formatKHR(target.balance)})!`
      );
      return;
    }

    setCashierSubmitting(true);
    const err = await onProcessTransaction(
      target.id,
      cashierType,
      amountNum,
      cashierPaymentMethod,
      cashierNote.trim() || undefined
    );
    setCashierSubmitting(false);

    if (err) {
      sound.playBeep();
      showFeedback('error', err);
      return;
    }

    sound.playCash();
    setIsCashierModalOpen(false);
    showFeedback('success', `ប្រតិបត្តិការ ${cashierType} សម្រាប់ ${target.username} ជោគជ័យ!`);
  };

  // Forced Numbers Save
  const handleSaveForcedNumbers = async () => {
    sound.playSelect();
    if (!manualMode) {
      const err = await onSetForcedNextNumbers(null);
      if (err) showFeedback('error', err);
      else showFeedback('success', 'បានបើកការចេញលទ្ធផលដោយចៃដន្យធម្មតា។');
      return;
    }
    const clean = (val: string) => {
      const n = parseInt(val, 10);
      if (isNaN(n) || n < 1 || n > 99) return '01';
      return padNumber(n);
    };
    const nextConfig: Record<ChannelLetter, string> = {
      A: clean(inputsA),
      B: clean(inputsB),
      C: clean(inputsC),
      D: clean(inputsD),
      E: clean(inputsE),
    };
    const err = await onSetForcedNextNumbers(nextConfig);
    if (err) {
      showFeedback('error', err);
    } else {
      showFeedback(
        'success',
        `បានរក្សាទុកលេខឈ្នះ: A=${nextConfig.A}, B=${nextConfig.B}, C=${nextConfig.C}, D=${nextConfig.D}, E=${nextConfig.E}`
      );
    }
  };

  const handleRandomizeForcedNumbers = () => {
    sound.playSelect();
    setManualMode(true);
    setInputsA(getRandomLotteryNumber());
    setInputsB(getRandomLotteryNumber());
    setInputsC(getRandomLotteryNumber());
    setInputsD(getRandomLotteryNumber());
    setInputsE(getRandomLotteryNumber());
  };

  const handleClearForcedNumbers = async () => {
    sound.playClick();
    setManualMode(false);
    const err = await onSetForcedNextNumbers(null);
    if (err) showFeedback('error', err);
    else showFeedback('success', 'បានលុបការកំណត់លេខឈ្នះជាមុន។');
  };

  const handleOwnerPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerCurrentPw || !ownerNewPw) {
      showFeedback('error', 'សូមបញ្ចូលពាក្យសម្ងាត់ចាស់ និងពាក្យសម្ងាត់ថ្មី!');
      return;
    }
    if (ownerNewPw.length < 6) {
      showFeedback('error', 'ពាក្យសម្ងាត់ថ្មីត្រូវមានយ៉ាងតិច 6 តួអក្សរ!');
      return;
    }
    if (ownerNewPw !== ownerConfirmPw) {
      showFeedback('error', 'ពាក្យសម្ងាត់ថ្មី និងការបញ្ជាក់មិនត្រូវគ្នាទេ!');
      return;
    }
    setChangingOwnerPw(true);
    const err = await onChangeOwnerPassword(ownerCurrentPw, ownerNewPw);
    setChangingOwnerPw(false);
    if (err) {
      sound.playBeep();
      showFeedback('error', err);
      return;
    }
    sound.playWin();
    setOwnerCurrentPw('');
    setOwnerNewPw('');
    setOwnerConfirmPw('');
    showFeedback('success', 'ផ្លាស់ប្តូរពាក្យសម្ងាត់ Owner ដោយជោគជ័យ!');
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* =========================================================================
          TOP EXECUTIVE OWNER ADMIN HEADER
         ========================================================================= */}
      <header className="bg-slate-950 border-b border-slate-800 sticky top-0 z-40 shadow-xl px-4 py-3">
        <div className="max-w-[1720px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Brand & Portal Badge */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-amber-300 p-0.5 flex items-center justify-center shadow-lg">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-100 to-amber-400">
                  ឆ្នោតសំណាង 1/99 — ផ្ទាំងគ្រប់គ្រង OWNER ADMIN
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wider">
                  Owner Back-Office
                </span>
              </div>
              <p className="text-xs text-slate-400">
                គ្រប់គ្រងគណនីអ្នកលេង, កាបូបប្រាក់, ការភ្នាល់ In-Play, លទ្ធផលឆ្នោត A–E, របាយការណ៍ និងសវនកម្ម
              </p>
            </div>
          </div>

          {/* Quick Real-Time Status & Controls */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Live Round pill */}
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 shadow-inner">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <div className="text-xs">
                <span className="text-slate-400">ជុំបច្ចុប្បន្ន: </span>
                <span className="font-mono font-bold text-amber-300">{currentRoundId}</span>
              </div>
              <div className="border-l border-slate-700 pl-2 text-xs">
                <span className="text-slate-400">រាប់ថយ: </span>
                <span
                  className={`font-mono font-bold ${
                    !isDrawing && (bettingClosed || countdownSeconds === 0) ? 'text-rose-400' : 'text-white'
                  }`}
                >
                  {isDrawing
                    ? '00:00 (DRAWING)'
                    : bettingClosed || countdownSeconds === 0
                    ? '00:00 (Betting Closed)'
                    : formatTimer(countdownSeconds)}
                </span>
              </div>
            </div>

            {/* Instant Draw Action */}
            <button
              disabled={isDrawing}
              onClick={async () => {
                sound.playClick();
                const err = await onTriggerDraw();
                if (err) showFeedback('error', err);
                else showFeedback('success', `បានចាប់ផ្តើមចេញរង្វាន់ជុំ ${currentRoundId}!`);
              }}
              className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 disabled:opacity-50 text-slate-950 font-black px-3.5 py-1.5 rounded-xl text-xs sm:text-sm shadow-md transition-all active:scale-95"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{isDrawing ? 'កំពុងចេញរង្វាន់...' : 'ចេញរង្វាន់ភ្លាមៗ'}</span>
            </button>

            {/* Owner User Info */}
            <div className="hidden lg:flex items-center gap-1.5 bg-slate-900 border border-amber-500/30 rounded-xl px-2.5 py-1 text-xs">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-mono font-bold text-amber-300">{ownerUser.username}</span>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-bold">
                OWNER
              </span>
            </div>

            {/* Project Export & Setup Guide Button */}
            <button
              onClick={() => {
                sound.playSelect();
                setIsDomainGuideModalOpen(true);
              }}
              className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs sm:text-sm shadow-md border border-emerald-400/30 transition-all active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">📦 ទាញយក Project</span>
            </button>

            {/* Launch Player Platform in New Tab */}
            <button
              onClick={() => {
                sound.playClick();
                if (onOpenGameInNewTab) {
                  onOpenGameInNewTab();
                } else {
                  window.open('http://127.0.0.1:3000', '_blank');
                }
              }}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs sm:text-sm shadow-md border border-blue-400/30 transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>បើកផ្ទាំងអ្នកលេង ↗</span>
            </button>

            {/* Owner Logout */}
            <button
              onClick={() => {
                sound.playClick();
                if (window.confirm('តើអ្នកពិតជាចង់ចាកចេញពីផ្ទាំងគ្រប់គ្រង Owner មែនទេ?')) {
                  onLogoutOwner();
                }
              }}
              className="flex items-center gap-1 bg-rose-600/30 hover:bg-rose-600 text-rose-200 hover:text-white font-bold px-2.5 py-1.5 rounded-xl text-xs transition-colors border border-rose-500/30 shadow-sm"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>ចាកចេញ</span>
            </button>
          </div>
        </div>
      </header>

      {/* Feedback Notification Banner */}
      {feedback && (
        <div
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold text-center border-b ${
            feedback.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/90 border-rose-500/40 text-rose-200'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* =========================================================================
          KEY PLATFORM KPIS & STATS STRIP (100% REAL BACKEND REPORTS)
         ========================================================================= */}
      <div className="bg-slate-950/60 border-b border-slate-800/80 px-4 py-3">
        <div className="max-w-[1720px] mx-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* In-Play Volume */}
          <div className="bg-slate-900/90 border border-amber-500/30 rounded-xl p-3 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-amber-400 font-semibold mb-1">
              <span className="flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                ភ្នាល់កំពុងដំណើរការ
              </span>
              <span className="text-[10px] bg-amber-500/20 px-1.5 py-0.5 rounded text-amber-300 font-mono">
                {activeRoundTickets.length} សំបុត្រ
              </span>
            </div>
            <div className="font-mono text-lg sm:text-xl font-black text-amber-300">
              {formatKHR(totalInPlayAmount)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              សងអតិបរមា:{' '}
              <span className="font-mono text-rose-400">{formatKHR(totalInPlayLiability)}</span>
            </div>
          </div>

          {/* Total Players */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-blue-400" />
                អ្នកលេងសរុប (Players)
              </span>
              <span className="text-[10px] bg-blue-500/20 px-1.5 py-0.5 rounded text-blue-300 font-mono">
                {reports.totalPlayers} គណនី
              </span>
            </div>
            <div className="font-mono text-lg sm:text-xl font-black text-white">
              {reports.activePlayers}{' '}
              <span className="text-xs font-normal text-emerald-400">សកម្ម</span> /{' '}
              {reports.disabledPlayers}{' '}
              <span className="text-xs font-normal text-rose-400">ផ្អាក</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              បង្កើតដោយ Owner ផ្ទាល់
            </div>
          </div>

          {/* Total Player Wallet Balances */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
              <span className="flex items-center gap-1">
                <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                សមតុល្យអ្នកលេងសរុប
              </span>
            </div>
            <div className="font-mono text-lg sm:text-xl font-black text-emerald-300 truncate">
              {formatKHR(reports.totalPlayerBalances)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              សាច់ប្រាក់ក្នុងកាបូបអ្នកលេង
            </div>
          </div>

          {/* Total Valid Stakes (All-Time) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-sm">
            <div className="text-xs text-slate-400 font-semibold mb-1 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
              សរុបភ្នាល់មានសុពលភាព (All-Time)
            </div>
            <div className="font-mono text-lg sm:text-xl font-black text-white">
              {formatKHR(reports.totalValidStakes)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              All-Time • ទូទាត់រួច: {reports.settledBetsCount} | រង់ចាំ: {reports.pendingBetsCount}
            </div>
          </div>

          {/* Total Payouts (All-Time) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-sm">
            <div className="text-xs text-slate-400 font-semibold mb-1 flex items-center gap-1">
              <Coins className="w-3.5 h-3.5 text-rose-400" />
              សរុបរង្វាន់បានសង (All-Time)
            </div>
            <div className="font-mono text-lg sm:text-xl font-black text-rose-400">
              {formatKHR(reports.totalWinningPayouts)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              អត្រាសង:{' '}
              <span className="font-mono font-bold text-amber-300">
                1:{systemConfig.payoutRate}
              </span>
            </div>
          </div>

          {/* Owner Profit / Loss (All-Time) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-sm">
            <div className="text-xs text-slate-400 font-semibold mb-1 flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-emerald-400" />
              ចំណេញ/ខាត Owner (All-Time)
            </div>
            <div
              className={`font-mono text-lg sm:text-xl font-black ${
                reports.ownerRealizedProfitLoss >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {formatKHR(reports.ownerRealizedProfitLoss)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {reports.ownerRealizedProfitLoss >= 0 ? 'ចំណេញសុទ្ធ All-Time (ទូទាត់រួច)' : 'ខាតសុទ្ធ All-Time (ទូទាត់រួច)'}
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          MAIN OWNER NAVIGATION BAR
         ========================================================================= */}
      <div className="bg-slate-950 px-4 border-b border-slate-800">
        <div className="max-w-[1720px] mx-auto flex flex-wrap items-center gap-2 py-2">
          <button
            onClick={() => setActiveTab('inplay')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
              activeTab === 'inplay'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Flame className="w-4 h-4" />
            <span>ភ្នាល់កំពុងដំណើរការ (Bets)</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[11px] font-mono ${
                activeTab === 'inplay' ? 'bg-slate-950 text-amber-300' : 'bg-slate-800 text-slate-300'
              }`}
            >
              {activeRoundTickets.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
              activeTab === 'users'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>គ្រប់គ្រងអ្នកលេង (Players)</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[11px] font-mono ${
                activeTab === 'users' ? 'bg-white text-blue-900' : 'bg-slate-800 text-slate-300'
              }`}
            >
              {players.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('cashier')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
              activeTab === 'cashier'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-600/20'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>💳 ដាក់-ដកប្រាក់ & បញ្ជី (Cashier)</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[11px] font-mono ${
                activeTab === 'cashier'
                  ? 'bg-white text-emerald-950 font-bold'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {transactions.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('draws')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
              activeTab === 'draws'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Dices className="w-4 h-4" />
            <span>កំណត់លទ្ធផលឆ្នោត (Results A–E)</span>
            {forcedNextNumbers && (
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-500 text-white font-bold animate-pulse">
                កំណត់រួច
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
              activeTab === 'reports'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>របាយការណ៍ & សវនកម្ម (Reports & Audit)</span>
          </button>

          <button
            onClick={() => setActiveTab('system')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
              activeTab === 'system'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>ការកំណត់ប្រព័ន្ធ (System Config)</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          TAB 1: ACTIVE & COMPLETED BETS
         ========================================================================= */}
      {activeTab === 'inplay' && (
        <div className="flex-1 max-w-[1720px] w-full mx-auto p-4 space-y-4">
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Flame className="w-5 h-5" />
                </span>
                <h2 className="text-lg sm:text-xl font-black text-white">
                  ការភ្នាល់កំពុងដំណើរការ & ប្រវត្តិភ្នាល់ — ជុំ {currentRoundId}
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                តាមដានសំបុត្រភ្នាល់ពិតប្រាកដពី Database ពិនិត្យលេខចាក់ច្រើន និងគ្រប់គ្រងសំបុត្រ
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="ស្វែងរក ID សំបុត្រ ឬ ID អ្នកលេង..."
                  value={ticketSearch}
                  onChange={(e) => setTicketSearch(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 w-48 sm:w-60"
                />
              </div>

              <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-700 text-xs">
                {(['PENDING', 'ALL', 'WON', 'LOST', 'VOID'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setTicketFilter(st)}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                      ticketFilter === st
                        ? 'bg-amber-400 text-slate-950'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {st === 'PENDING'
                      ? 'កំពុងលេង'
                      : st === 'ALL'
                      ? 'ទាំងអស់'
                      : st === 'WON'
                      ? 'ឈ្នះ'
                      : st === 'LOST'
                      ? 'ចាញ់'
                      : 'លុបចោល'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {hotNumbers.length > 0 && (
            <div className="bg-gradient-to-r from-amber-500/10 via-slate-800 to-slate-800 border border-amber-500/30 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded bg-amber-500 text-slate-950 font-black text-xs">
                  HOT
                </span>
                <span className="text-xs font-bold text-amber-300">
                  លេខដែលមានការចាក់ច្រើនជាងគេក្នុងជុំនេះ (Top Wagered Numbers):
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {hotNumbers.map(([num, amt]) => (
                  <div
                    key={num}
                    className="flex items-center gap-1.5 bg-slate-900 border border-amber-400/40 rounded-xl px-2.5 py-1 text-xs shadow-sm"
                  >
                    <span className="w-6 h-6 rounded-full bg-amber-400 text-slate-950 font-black flex items-center justify-center font-mono">
                      {num}
                    </span>
                    <span className="font-mono text-slate-300">{formatKHR(amt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-900/90 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-700">
                  <tr>
                    <th className="py-3 px-4">ID សំបុត្រ (Ticket ID)</th>
                    <th className="py-3 px-4">អ្នកលេង (Player)</th>
                    <th className="py-3 px-4">ជុំ (Round)</th>
                    <th className="py-3 px-4">ប៉ុស្តិ៍ (Channels)</th>
                    <th className="py-3 px-4">លេខបានចាក់ (Numbers)</th>
                    <th className="py-3 px-4 text-right">តម្លៃភ្នាល់ (Stake)</th>
                    <th className="py-3 px-4 text-right">សងអតិបរមា (Max Payout)</th>
                    <th className="py-3 px-4 text-center">ស្ថានភាព (Status)</th>
                    <th className="py-3 px-4 text-center">សកម្មភាព (Actions)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60">
                  {filteredTickets.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        <Flame className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                        <div className="font-semibold">មិនមានការភ្នាល់ត្រូវនឹងលក្ខខណ្ឌនេះទេ</div>
                        <div className="text-xs text-slate-500 mt-1">
                          សំបុត្រដែលចាក់ពីផ្ទាំងអ្នកលេងនឹងបង្ហាញនៅទីនេះដោយស្វ័យប្រវត្តិ
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredTickets.map((ticket) => {
                      const player = players.find((u) => u.id === ticket.userId);
                      const maxPotentialWin =
                        ticket.stakePerUnit * systemConfig.payoutRate * ticket.channels.length;

                      return (
                        <tr
                          key={ticket.ticketId}
                          className="hover:bg-slate-700/40 transition-colors"
                        >
                          <td className="py-3 px-4 font-mono font-bold text-amber-300">
                            {ticket.ticketId}
                            <div className="text-[10px] text-slate-500 font-normal">
                              {ticket.createdAt}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-mono font-bold text-blue-300">
                              {player?.username || ticket.username || ticket.userId}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate max-w-[140px]">
                              {player?.name || ticket.userId}
                            </div>
                          </td>

                          <td className="py-3 px-4 font-mono text-slate-300 font-semibold">
                            {ticket.roundId}
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1">
                              {ticket.channels.map((ch) => (
                                <span
                                  key={ch}
                                  className={`w-5 h-5 rounded flex items-center justify-center font-bold text-[11px] text-white ${CHANNEL_COLORS[ch].bg}`}
                                >
                                  {ch}
                                </span>
                              ))}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {ticket.numbers.map((n) => (
                                <span
                                  key={n}
                                  className="w-6 h-6 rounded-full bg-slate-700 border border-slate-600 text-amber-300 font-mono font-bold text-xs flex items-center justify-center shadow-xs"
                                >
                                  {n}
                                </span>
                              ))}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1">
                              {ticket.totalBetsCount} គ្រាប់ × {formatKHR(ticket.stakePerUnit)}
                            </div>
                          </td>

                          <td className="py-3 px-4 text-right font-mono font-bold text-white">
                            {formatKHR(ticket.totalCost)}
                          </td>

                          <td className="py-3 px-4 text-right font-mono font-bold text-amber-300">
                            {formatKHR(maxPotentialWin)}
                          </td>

                          <td className="py-3 px-4 text-center">
                            {ticket.status === 'PENDING' && (
                              <span className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full text-xs font-semibold">
                                <Clock className="w-3 h-3 animate-spin" />
                                <span>កំពុងលេង</span>
                              </span>
                            )}
                            {ticket.status === 'WON' && (
                              <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full text-xs font-bold">
                                <CheckCircle className="w-3 h-3" />
                                <span>ឈ្នះ +{formatKHR(ticket.wonAmount)}</span>
                              </span>
                            )}
                            {ticket.status === 'LOST' && (
                              <span className="inline-flex items-center gap-1 bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full text-xs">
                                <XCircle className="w-3 h-3" />
                                <span>ចាញ់</span>
                              </span>
                            )}
                            {ticket.status === 'VOID' && (
                              <span className="inline-flex items-center gap-1 bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded-full text-xs font-semibold">
                                <span>លុបចោល (Refund)</span>
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-center">
                            {ticket.status === 'PENDING' ? (
                              <button
                                onClick={async () => {
                                  if (
                                    window.confirm(
                                      `តើអ្នកពិតជាចង់លុបចោល (Void/Refund) សំបុត្រ ${ticket.ticketId} មែនទេ?`
                                    )
                                  ) {
                                    const err = await onVoidTicket(ticket.ticketId);
                                    if (err) showFeedback('error', err);
                                    else
                                      showFeedback(
                                        'success',
                                        `បានលុបចោល និងសងប្រាក់សម្រាប់សំបុត្រ ${ticket.ticketId}`
                                      );
                                  }
                                }}
                                className="bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/30 px-2 py-1 rounded-lg text-xs font-semibold transition-colors"
                              >
                                លុបចោល (Void)
                              </button>
                            ) : (
                              <span className="text-xs text-slate-500">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: PLAYER MANAGEMENT (OWNER -> PLAYERS ONLY)
         ========================================================================= */}
      {activeTab === 'users' && (
        <div className="flex-1 max-w-[1720px] w-full mx-auto p-4 space-y-4">
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  <Users className="w-5 h-5" />
                </span>
                <h2 className="text-lg sm:text-xl font-black text-white">
                  គ្រប់គ្រងគណនីអ្នកលេង (Player Account Management)
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                បង្កើតគណនីអ្នកលេងថ្មី, កំណត់/ផ្លាស់ប្តូរពាក្យសម្ងាត់, បើក/ផ្អាកគណនី និងគ្រប់គ្រងសមតុល្យ
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleOpenCashier(null, 'DEPOSIT')}
                disabled={players.length === 0}
                className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold px-3.5 py-2 rounded-xl text-xs sm:text-sm shadow-md transition-all active:scale-95"
              >
                <Wallet className="w-4 h-4" />
                <span>+ ដាក់ / ដកប្រាក់ (Deposit & Withdraw)</span>
              </button>

              <button
                onClick={handleOpenAddPlayer}
                className="flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold px-3.5 py-2 rounded-xl text-xs sm:text-sm shadow-md transition-all active:scale-95"
              >
                <UserPlus className="w-4 h-4" />
                <span>+ បង្កើតអ្នកលេងថ្មី (Create Player)</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ស្វែងរកតាម Account ID, Username, ឈ្មោះ ឬលេខទូរស័ព្ទ..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-400"
              />
            </div>

            <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs">
              {(['ALL', 'ACTIVE', 'SUSPENDED'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setUserStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                    userStatusFilter === st
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {st === 'ALL'
                    ? 'ទាំងអស់ (All)'
                    : st === 'ACTIVE'
                    ? 'សកម្ម (Active)'
                    : 'បានផ្អាក (Disabled)'}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-900/90 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-700">
                  <tr>
                    <th className="py-3 px-4">ID & Username</th>
                    <th className="py-3 px-4">ឈ្មោះអ្នកលេង (Name)</th>
                    <th className="py-3 px-4">ពាក្យសម្ងាត់ (Security)</th>
                    <th className="py-3 px-4 text-right">សមតុល្យ (Wallet Balance)</th>
                    <th className="py-3 px-4 text-right">កម្រិតឥណទាន</th>
                    <th className="py-3 px-4 text-center">ស្ថានភាព (Status)</th>
                    <th className="py-3 px-4 text-center">សកម្មភាព (Actions)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60">
                  {filteredPlayers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                        <div>មិនមានគណនីអ្នកលេងត្រូវគ្នាទេ</div>
                      </td>
                    </tr>
                  ) : (
                    filteredPlayers.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-700/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-mono font-bold text-amber-300">{user.username}</div>
                          <div className="text-[10px] text-slate-400 font-mono">ID: {user.id}</div>
                          {user.phone && (
                            <div className="text-[10px] text-slate-400 mt-0.5">📞 {user.phone}</div>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-semibold text-white">{user.name}</div>
                          <div className="text-[10px] text-slate-400">
                            បង្កើត: {user.createdAt}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2 font-mono text-xs">
                            <span className="text-slate-400 flex items-center gap-1">
                              <Lock className="w-3 h-3 text-emerald-400" />
                              Hashed
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                sound.playClick();
                                setPasswordEditUser(user);
                                setPasswordEditValue('');
                              }}
                              className="px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-amber-300 text-[10px] font-bold transition-colors flex items-center gap-1"
                            >
                              <KeyRound className="w-3 h-3" />
                              <span>កំណត់ឡើងវិញ</span>
                            </button>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-black text-emerald-400 text-sm">
                          {formatKHR(user.balance)}
                        </td>

                        <td className="py-3 px-4 text-right font-mono text-slate-300">
                          {formatKHR(user.creditLimit)}
                        </td>

                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={async () => {
                              sound.playClick();
                              const err = await onTogglePlayerStatus(user.id);
                              if (err) showFeedback('error', err);
                              else
                                showFeedback(
                                  'success',
                                  `បានប្តូរស្ថានភាពគណនី ${user.username} ទៅជា ${
                                    user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'
                                  }`
                                );
                            }}
                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold border transition-all ${
                              user.status === 'ACTIVE'
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
                            }`}
                          >
                            {user.status === 'ACTIVE' ? '● សកម្ម (Active)' : '⊘ បានផ្អាក (Disabled)'}
                          </button>
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenCashier(user, 'DEPOSIT')}
                              className="px-2 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-colors"
                            >
                              + ដាក់ប្រាក់
                            </button>
                            <button
                              onClick={() => handleOpenCashier(user, 'WITHDRAWAL')}
                              className="px-2 py-1 rounded bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/30 text-xs font-bold transition-colors"
                            >
                              - ដកប្រាក់
                            </button>
                            <button
                              onClick={async () => {
                                if (
                                  window.confirm(
                                    `តើអ្នកពិតជាចង់លុបគណនី ${user.username} (${user.name}) មែនទេ?`
                                  )
                                ) {
                                  const err = await onDeletePlayer(user.id);
                                  if (err) showFeedback('error', err);
                                  else showFeedback('success', `បានលុបគណនី ${user.username}`);
                                }
                              }}
                              className="p-1.5 rounded bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 transition-colors"
                              title="លុបគណនី"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: CASHIER & TRANSACTIONS LEDGER
         ========================================================================= */}
      {activeTab === 'cashier' && (
        <div className="flex-1 max-w-[1720px] w-full mx-auto p-4 space-y-5">
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <Wallet className="w-5 h-5" />
                </span>
                <h2 className="text-lg sm:text-xl font-black text-white">
                  ប្រតិបត្តិការដាក់ និងដកប្រាក់ (Cashier & Transaction Ledger)
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                គ្រប់គ្រងការដាក់ប្រាក់ ដកប្រាក់ ការភ្នាល់ និងការសងរង្វាន់របស់អ្នកលេងទាំងអស់ពី Database
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleOpenCashier(null, 'DEPOSIT')}
                disabled={players.length === 0}
                className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 text-slate-950 font-black px-4 py-2 rounded-xl text-xs sm:text-sm shadow-md transition-all active:scale-95"
              >
                <ArrowDownRight className="w-4 h-4 stroke-[2.5]" />
                <span>+ ដាក់ប្រាក់ (Deposit)</span>
              </button>

              <button
                onClick={() => handleOpenCashier(null, 'WITHDRAWAL')}
                disabled={players.length === 0}
                className="flex items-center gap-1.5 bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl text-xs sm:text-sm shadow-md transition-all active:scale-95"
              >
                <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                <span>- ដកប្រាក់ (Withdrawal)</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-900/90 border border-emerald-500/30 rounded-2xl p-4 shadow-sm">
              <div className="text-xs font-semibold text-emerald-400 mb-1 flex items-center gap-1.5">
                <ArrowDownRight className="w-4 h-4 text-emerald-400" />
                សរុបដាក់ប្រាក់ (Deposits)
              </div>
              <div className="font-mono text-xl sm:text-2xl font-black text-emerald-300 mt-1">
                +{formatKHR(reports.totalDeposits)}
              </div>
            </div>

            <div className="bg-slate-900/90 border border-rose-500/30 rounded-2xl p-4 shadow-sm">
              <div className="text-xs font-semibold text-rose-400 mb-1 flex items-center gap-1.5">
                <ArrowUpRight className="w-4 h-4 text-rose-400" />
                សរុបដកប្រាក់ (Withdrawals)
              </div>
              <div className="font-mono text-xl sm:text-2xl font-black text-rose-300 mt-1">
                -{formatKHR(reports.totalWithdrawals)}
              </div>
            </div>

            <div className="bg-slate-900/90 border border-amber-500/30 rounded-2xl p-4 shadow-sm">
              <div className="text-xs font-semibold text-amber-400 mb-1 flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-amber-400" />
                លំហូរសាច់ប្រាក់សុទ្ធ (Net Flow)
              </div>
              <div
                className={`font-mono text-xl sm:text-2xl font-black mt-1 ${
                  reports.netCashflow >= 0 ? 'text-amber-300' : 'text-rose-400'
                }`}
              >
                {formatKHR(reports.netCashflow)}
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm">
              <div className="text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
                <History className="w-4 h-4 text-blue-400" />
                សរុបប្រតិបត្តិការ (Transactions)
              </div>
              <div className="font-mono text-xl sm:text-2xl font-black text-white mt-1">
                {transactions.length}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ស្វែងរកតាម TX ID, អ្នកលេង, វិធីសាស្ត្រ..."
                value={cashierSearch}
                onChange={(e) => setCashierSearch(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
              />
            </div>

            <div className="flex flex-wrap bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs">
              {(['ALL', 'DEPOSIT', 'WITHDRAWAL', 'BET', 'PAYOUT', 'REFUND'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setCashierFilter(t)}
                  className={`px-2.5 py-1.5 rounded-lg font-bold transition-all ${
                    cashierFilter === t
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-900/90 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-700">
                  <tr>
                    <th className="py-3 px-4">TX ID</th>
                    <th className="py-3 px-4">ម៉ោង (Time)</th>
                    <th className="py-3 px-4">អ្នកលេង (Player)</th>
                    <th className="py-3 px-4 text-center">ប្រភេទ (Type)</th>
                    <th className="py-3 px-4 text-right">ចំនួន (Amount)</th>
                    <th className="py-3 px-4 text-right">មុន ➔ ក្រោយ</th>
                    <th className="py-3 px-4">វិធីសាស្ត្រ</th>
                    <th className="py-3 px-4">អ្នកចាត់ចែង</th>
                    <th className="py-3 px-4">កំណត់សម្គាល់</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        <Wallet className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                        <div className="font-semibold">មិនទាន់មានកំណត់ត្រាប្រតិបត្តិការទេ</div>
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx) => {
                      const isPositive =
                        tx.type === 'DEPOSIT' || tx.type === 'PAYOUT' || tx.type === 'REFUND';
                      const isNegative = tx.type === 'WITHDRAWAL' || tx.type === 'BET';
                      return (
                        <tr
                          key={tx.transactionId}
                          className="hover:bg-slate-700/40 transition-colors"
                        >
                          <td className="py-3 px-4 font-mono font-bold text-amber-300">
                            {tx.transactionId}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-300 text-xs">
                            {tx.createdAt}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-mono font-bold text-blue-300">{tx.userId}</div>
                            <div className="text-[10px] text-slate-400 truncate max-w-[130px]">
                              {tx.userName}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                                isPositive
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                  : isNegative
                                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              }`}
                            >
                              {tx.type}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-black">
                            <span
                              className={
                                isPositive
                                  ? 'text-emerald-400'
                                  : isNegative
                                  ? 'text-rose-400'
                                  : 'text-amber-400'
                              }
                            >
                              {isPositive ? '+' : isNegative ? '-' : ''}
                              {formatKHR(tx.amount)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-xs">
                            <span className="text-slate-400">{formatKHR(tx.previousBalance)}</span>
                            <span className="text-slate-500 mx-1">➔</span>
                            <span className="text-emerald-300 font-bold">
                              {formatKHR(tx.newBalance)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-xs font-mono text-slate-300">
                            {tx.paymentMethod}
                          </td>
                          <td className="py-3 px-4 text-xs font-mono text-slate-400">
                            {tx.adminId}
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-300 max-w-[180px] truncate">
                            {tx.note || '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: RESULT & DRAW CONTROL (A-E)
         ========================================================================= */}
      {activeTab === 'draws' && (
        <div className="flex-1 max-w-[1720px] w-full mx-auto p-4 space-y-6">
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 shadow-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-700">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-purple-600 text-white">
                    <Dices className="w-5 h-5" />
                  </span>
                  <h2 className="text-xl font-black text-white">
                    ផ្ទាំងកំណត់លទ្ធផលឆ្នោត (Draw Outcome Control) — ជុំ {currentRoundId}
                  </h2>
                </div>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  កំណត់លេខឈ្នះជាមុន (01–99) សម្រាប់ប៉ុស្តិ៍ A, B, C, D, E ឬចុចចេញរង្វាន់ភ្លាមៗ
                </p>
              </div>

              <button
                disabled={isDrawing}
                onClick={async () => {
                  sound.playClick();
                  const err = await onTriggerDraw();
                  if (err) showFeedback('error', err);
                  else showFeedback('success', `បានចាប់ផ្តើមចាប់រង្វាន់ជុំ ${currentRoundId}!`);
                }}
                className="flex items-center gap-2 bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 disabled:opacity-50 text-slate-950 font-black px-5 py-2.5 rounded-xl text-sm shadow-lg active:scale-95 transition-all"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>{isDrawing ? 'កំពុងចាប់រង្វាន់...' : 'ចាប់រង្វាន់ភ្លាមៗ (Draw Now)'}</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleClearForcedNumbers}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold border transition-all ${
                    !manualMode
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                      : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                  }`}
                >
                  🎲 ចេញដោយចៃដន្យធម្មតា (Random Auto Draw)
                </button>

                <button
                  onClick={() => setManualMode(true)}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold border transition-all ${
                    manualMode
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                      : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                  }`}
                >
                  ⚡ កំណត់លេខឈ្នះជាមុន (Force Result Preset)
                </button>
              </div>

              {manualMode && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRandomizeForcedNumbers}
                    className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold px-3 py-1.5 rounded-lg text-xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>ចៃដន្យលេខថ្មី</span>
                  </button>
                  <button
                    onClick={handleClearForcedNumbers}
                    className="flex items-center gap-1 bg-rose-900/40 hover:bg-rose-800 text-rose-300 font-semibold px-3 py-1.5 rounded-lg text-xs border border-rose-500/40"
                  >
                    <span>លុបការកំណត់</span>
                  </button>
                </div>
              )}
            </div>

            {manualMode && (
              <div className="bg-slate-950/80 border border-amber-500/30 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300">
                    បញ្ចូលលេខឈ្នះ (01 - 99) សម្រាប់ប៉ុស្តិ៍នីមួយៗក្នុងជុំ {currentRoundId}:
                  </span>
                  <span className="text-xs text-slate-400">
                    ប្រព័ន្ធនឹងចេញលេខនេះពិតប្រាកដនៅលើគ្រប់ឧបករណ៍!
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {[
                    { ch: 'A' as ChannelLetter, val: inputsA, set: setInputsA },
                    { ch: 'B' as ChannelLetter, val: inputsB, set: setInputsB },
                    { ch: 'C' as ChannelLetter, val: inputsC, set: setInputsC },
                    { ch: 'D' as ChannelLetter, val: inputsD, set: setInputsD },
                    { ch: 'E' as ChannelLetter, val: inputsE, set: setInputsE },
                  ].map(({ ch, val, set }) => (
                    <div
                      key={ch}
                      className="bg-slate-900 border border-slate-700 rounded-xl p-3 flex flex-col items-center gap-2"
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm text-white ${CHANNEL_COLORS[ch].bg}`}
                      >
                        {ch}
                      </div>
                      <input
                        type="number"
                        min="1"
                        max="99"
                        value={val}
                        onChange={(e) => set(e.target.value)}
                        className="w-16 h-12 text-center text-2xl font-black font-mono bg-slate-950 border-2 border-amber-400/50 rounded-lg text-amber-300 focus:outline-none focus:border-amber-400"
                      />
                      <span className="text-[10px] text-slate-400">ប៉ុស្តិ៍ {ch}</span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSaveForcedNumbers}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black px-6 py-2.5 rounded-xl text-sm shadow-md transition-all active:scale-95"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>រក្សាទុកលេខឈ្នះនេះ (Lock in Preset)</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl overflow-hidden shadow-lg">
            <div className="p-4 bg-slate-900/90 border-b border-slate-700 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-white text-base">
                  ប្រវត្តិនៃការចេញលទ្ធផលកន្លងមក (Past Rounds)
                </h3>
                <p className="text-xs text-slate-400">មើលនិងលុបជុំចាស់ៗពី Database</p>
              </div>
              <button
                onClick={async () => {
                  if (
                    window.confirm('តើអ្នកពិតជាចង់កំណត់ប្រវត្តិលទ្ធផលឡើងវិញ (Reset History) មែនទេ?')
                  ) {
                    const err = await onResetHistory();
                    if (err) showFeedback('error', err);
                    else showFeedback('success', 'បានកំណត់ប្រវត្តិលទ្ធផលឡើងវិញ!');
                  }
                }}
                className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-700"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>កំណត់ប្រវត្តិដើមឡើងវិញ</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-950 text-slate-400 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">ជុំ (Round ID)</th>
                    <th className="py-3 px-4">ម៉ោងចេញ (Time)</th>
                    <th className="py-3 px-4">កាលបរិច្ឆេទ (Date)</th>
                    <th className="py-3 px-4 text-center">A</th>
                    <th className="py-3 px-4 text-center">B</th>
                    <th className="py-3 px-4 text-center">C</th>
                    <th className="py-3 px-4 text-center">D</th>
                    <th className="py-3 px-4 text-center">E</th>
                    <th className="py-3 px-4 text-center">សកម្មភាព</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60">
                  {pastRounds.map((round) => (
                    <tr key={round.roundId} className="hover:bg-slate-700/40">
                      <td className="py-3 px-4 font-mono font-bold text-blue-300">
                        {round.roundId}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">{round.drawTime}</td>
                      <td className="py-3 px-4 text-slate-400">{round.date}</td>
                      {(['A', 'B', 'C', 'D', 'E'] as ChannelLetter[]).map((ch) => (
                        <td key={ch} className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center justify-center w-7 h-7 rounded-full font-mono font-black text-xs text-white ${CHANNEL_COLORS[ch].bg}`}
                          >
                            {round.numbers[ch]}
                          </span>
                        </td>
                      ))}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={async () => {
                            if (window.confirm(`តើអ្នកពិតជាចង់លុបជុំ ${round.roundId} មែនទេ?`)) {
                              const err = await onDeleteRound(round.roundId);
                              if (err) showFeedback('error', err);
                              else showFeedback('success', `បានលុបជុំ ${round.roundId}`);
                            }
                          }}
                          className="p-1 rounded bg-slate-800 hover:bg-rose-900/50 text-slate-400 hover:text-rose-300 transition-colors"
                          title="លុបជុំនេះ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 5: FINANCIAL REPORTS BY PLAYER & AUDIT LOGS (A1 & A8)
         ========================================================================= */}
      {activeTab === 'reports' && (
        <div className="flex-1 max-w-[1720px] w-full mx-auto p-4 space-y-6">
          {/* Win/Loss Reporting Section (Adjustment 2: Overall, Player, Daily UTC+7, Detailed) */}
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl overflow-hidden shadow-lg">
            {/* Header & Global Realized KPIs */}
            <div className="p-4 bg-slate-900/90 border-b border-slate-700 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-white">
                    របាយការណ៍ឈ្នះចាញ់ជាក់ស្ដែង (Daily Win/Loss Reports — Asia/Phnom_Penh UTC+7)
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    កាលបរិច្ឆេទរបាយការណ៍:{' '}
                    <span className="font-mono font-bold text-amber-300 bg-slate-950 border border-amber-500/40 px-2 py-0.5 rounded">
                      {reportSelectedDate === 'ALL' ? 'All-Time (គ្រប់កាលបរិច្ឆេទ)' : reportSelectedDate}
                    </span>{' '}
                    • គណនាដោយផ្ទាល់ពីសំបុត្រទូទាត់រួច (មិនរាប់បញ្ចូល Pending / Void)
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                  <div className="bg-slate-950 border border-slate-700 px-3 py-1.5 rounded-xl">
                    Player Net:{' '}
                    <span
                      className={
                        filteredReportTotals.playerNet > 0
                          ? 'text-emerald-400 font-black'
                          : filteredReportTotals.playerNet < 0
                          ? 'text-rose-400 font-black'
                          : 'text-slate-300 font-black'
                      }
                    >
                      {formatSignedKHR(filteredReportTotals.playerNet)}
                    </span>
                  </div>
                  <div className="bg-slate-950 border border-amber-500/40 px-3 py-1.5 rounded-xl">
                    Owner Net W/L:{' '}
                    <span
                      className={
                        filteredReportTotals.ownerNet > 0
                          ? 'text-emerald-400 font-black'
                          : filteredReportTotals.ownerNet < 0
                          ? 'text-rose-400 font-black'
                          : 'text-slate-300 font-black'
                      }
                    >
                      {formatSignedKHR(filteredReportTotals.ownerNet)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Daily Financial Summary Cards for Selected Date */}
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 text-xs">
                <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3">
                  <div className="text-slate-400 font-semibold">សំបុត្រទូទាត់រួច (Settled)</div>
                  <div className="font-mono text-base font-black text-white mt-0.5">
                    {filteredReportTotals.settledCount}
                  </div>
                </div>
                <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3">
                  <div className="text-slate-400 font-semibold">ប្រាក់ភ្នាល់ទូទាត់រួច (Stakes)</div>
                  <div className="font-mono text-base font-black text-white mt-0.5">
                    {formatKHR(filteredReportTotals.totalStake)}
                  </div>
                </div>
                <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3">
                  <div className="text-slate-400 font-semibold">រង្វាន់បានសង (Payouts)</div>
                  <div className="font-mono text-base font-black text-amber-300 mt-0.5">
                    {formatKHR(filteredReportTotals.totalPayout)}
                  </div>
                </div>
                <div className="bg-slate-950/90 border border-emerald-500/30 rounded-xl p-3">
                  <div className="text-emerald-300 font-semibold">ចំណេញ Owner (Profit)</div>
                  <div className="font-mono text-base font-black text-emerald-400 mt-0.5">
                    +{formatKHR(filteredReportTotals.ownerProfit)}
                  </div>
                </div>
                <div className="bg-slate-950/90 border border-rose-500/30 rounded-xl p-3">
                  <div className="text-rose-300 font-semibold">ខាត Owner (Loss)</div>
                  <div className="font-mono text-base font-black text-rose-400 mt-0.5">
                    -{formatKHR(filteredReportTotals.ownerLoss)}
                  </div>
                </div>
                <div className="bg-slate-950/90 border border-amber-500/30 rounded-xl p-3">
                  <div className="text-amber-300 font-semibold">Owner Net Win/Loss</div>
                  <div
                    className={`font-mono text-base font-black mt-0.5 ${
                      filteredReportTotals.ownerNet > 0
                        ? 'text-emerald-400'
                        : filteredReportTotals.ownerNet < 0
                        ? 'text-rose-400'
                        : 'text-slate-300'
                    }`}
                  >
                    {formatSignedKHR(filteredReportTotals.ownerNet)}
                  </div>
                </div>
              </div>

              {/* Report Sub-Views + Player & Date Filters */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  {[
                    { id: 'overall' as const, label: 'A. សរុបតាមថ្ងៃ និងវេន (Overall)' },
                    { id: 'player' as const, label: 'B. តាមអ្នកលេង (By Player)' },
                    { id: 'daily' as const, label: 'C. ប្រវត្តិប្រចាំថ្ងៃ (Daily UTC+7)' },
                    { id: 'detailed' as const, label: 'D. លម្អិតសំបុត្រ (Detailed Bets)' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => {
                        sound.playClick();
                        setReportSubView(tab.id);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        reportSubView === tab.id
                          ? 'bg-amber-500 text-slate-950 shadow-xs'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {/* Player Filter */}
                  <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5">
                    <Users className="w-3.5 h-3.5 text-blue-400" />
                    <select
                      value={reportSelectedPlayerId}
                      onChange={(e) => setReportSelectedPlayerId(e.target.value)}
                      className="bg-transparent text-white font-mono text-xs focus:outline-none"
                    >
                      <option value="ALL" className="bg-slate-900">
                        អ្នកលេងទាំងអស់ (All Players)
                      </option>
                      {players.map((p) => (
                        <option key={p.id} value={p.id} className="bg-slate-900">
                          {p.username} ({p.id})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Year / Month / Day Selector + Previous / Next Day */}
                  <div className="flex flex-wrap items-center gap-1 bg-slate-950 border border-slate-700 rounded-xl px-2 py-1">
                    <button
                      type="button"
                      onClick={() => {
                        sound.playClick();
                        const base = reportSelectedDate === 'ALL' ? todayYmd : reportSelectedDate;
                        setReportSelectedDate(shiftYmdDate(base, -1));
                      }}
                      className="p-1 rounded-lg hover:bg-slate-800 text-slate-300 flex items-center gap-0.5 font-semibold"
                      title="Previous Day"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">ថ្ងៃមុន</span>
                    </button>

                    <Calendar className="w-3.5 h-3.5 text-amber-400 ml-1" />
                    <select
                      aria-label="Report Year"
                      value={repYear}
                      onChange={(e) =>
                        updateReportYmdParts(parseInt(e.target.value, 10), repMonth, repDay)
                      }
                      className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 font-mono text-white text-xs"
                    >
                      {reportYearOptions.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Report Month"
                      value={repMonth}
                      onChange={(e) =>
                        updateReportYmdParts(repYear, parseInt(e.target.value, 10), repDay)
                      }
                      className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 font-mono text-white text-xs"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <option key={m} value={m}>
                          {String(m).padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Report Day"
                      value={repDay}
                      onChange={(e) =>
                        updateReportYmdParts(repYear, repMonth, parseInt(e.target.value, 10))
                      }
                      className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 font-mono text-white text-xs"
                    >
                      {Array.from({ length: getDaysInMonth(repYear, repMonth) }, (_, i) => i + 1).map(
                        (d) => (
                          <option key={d} value={d}>
                            {String(d).padStart(2, '0')}
                          </option>
                        )
                      )}
                    </select>

                    <button
                      type="button"
                      onClick={() => {
                        sound.playClick();
                        const base = reportSelectedDate === 'ALL' ? todayYmd : reportSelectedDate;
                        setReportSelectedDate(shiftYmdDate(base, 1));
                      }}
                      className="p-1 rounded-lg hover:bg-slate-800 text-slate-300 flex items-center gap-0.5 font-semibold"
                      title="Next Day"
                    >
                      <span className="hidden sm:inline">ថ្ងៃបន្ទាប់</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        sound.playClick();
                        setReportSelectedDate(todayYmd);
                      }}
                      className={`ml-1 px-2 py-1 rounded-lg font-bold ${
                        reportSelectedDate === todayYmd
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                      }`}
                    >
                      ថ្ងៃនេះ
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        sound.playClick();
                        setReportSelectedDate('ALL');
                      }}
                      className={`px-2 py-1 rounded-lg font-bold ${
                        reportSelectedDate === 'ALL'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      All-Time
                    </button>
                  </div>

                  {(reportSelectedPlayerId !== 'ALL' || reportSelectedDate !== todayYmd) && (
                    <button
                      onClick={() => {
                        setReportSelectedPlayerId('ALL');
                        setReportSelectedDate(todayYmd);
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold"
                    >
                      សម្អាត (Reset)
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* VIEW A: OVERALL OWNER REPORT (GROUPED BY DATE & ROUND) */}
            {reportSubView === 'overall' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-950 text-slate-400 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">កាលបរិច្ឆេទ (YYYY-MM-DD)</th>
                      <th className="py-3 px-4">វេន (Round ID)</th>
                      <th className="py-3 px-4 text-center">សំបុត្រទូទាត់ (Settled)</th>
                      <th className="py-3 px-4 text-right">ភ្នាល់សុពលភាព (Stakes)</th>
                      <th className="py-3 px-4 text-right">រង្វាន់ជាក់ស្ដែង (Payouts)</th>
                      <th className="py-3 px-4 text-right">Player Net W/L</th>
                      <th className="py-3 px-4 text-right">Owner Net W/L</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60 font-mono">
                    {filteredRoundReports.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-slate-400 font-sans">
                          មិនទាន់មានសំបុត្រដែលបានទូទាត់រួចសម្រាប់ជម្រើសនេះទេ
                        </td>
                      </tr>
                    ) : (
                      filteredRoundReports.map((r) => (
                        <tr key={`${r.date}-${r.roundId}`} className="hover:bg-slate-700/40">
                          <td className="py-3 px-4 font-bold text-slate-200">{r.date}</td>
                          <td className="py-3 px-4 font-bold text-blue-300">{r.roundId}</td>
                          <td className="py-3 px-4 text-center text-slate-300">
                            {r.settledBetsCount}
                          </td>
                          <td className="py-3 px-4 text-right text-white">
                            {formatKHR(r.totalValidStakes)}
                          </td>
                          <td className="py-3 px-4 text-right text-amber-300">
                            {formatKHR(r.totalActualPayouts)}
                          </td>
                          <td
                            className={`py-3 px-4 text-right font-bold ${
                              r.playerNetWinLoss > 0
                                ? 'text-emerald-400'
                                : r.playerNetWinLoss < 0
                                ? 'text-rose-400'
                                : 'text-slate-300'
                            }`}
                          >
                            {formatSignedKHR(r.playerNetWinLoss)}
                          </td>
                          <td
                            className={`py-3 px-4 text-right font-black ${
                              r.ownerNetWinLoss > 0
                                ? 'text-emerald-400'
                                : r.ownerNetWinLoss < 0
                                ? 'text-rose-400'
                                : 'text-slate-300'
                            }`}
                          >
                            {formatSignedKHR(r.ownerNetWinLoss)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {filteredRoundReports.length > 0 && (
                    <tfoot className="bg-slate-950/90 border-t-2 border-slate-700 font-mono font-black text-xs sm:text-sm">
                      <tr>
                        <td colSpan={2} className="py-3 px-4 text-amber-300 font-sans">
                          សរុបរួម (TOTAL — {filteredRoundReports.length} វេន)
                        </td>
                        <td className="py-3 px-4 text-center text-white">
                          {filteredReportTotals.settledCount}
                        </td>
                        <td className="py-3 px-4 text-right text-white">
                          {formatKHR(filteredReportTotals.totalStake)}
                        </td>
                        <td className="py-3 px-4 text-right text-amber-300">
                          {formatKHR(filteredReportTotals.totalPayout)}
                        </td>
                        <td
                          className={`py-3 px-4 text-right ${
                            filteredReportTotals.playerNet > 0
                              ? 'text-emerald-400'
                              : filteredReportTotals.playerNet < 0
                              ? 'text-rose-400'
                              : 'text-slate-300'
                          }`}
                        >
                          {formatSignedKHR(filteredReportTotals.playerNet)}
                        </td>
                        <td
                          className={`py-3 px-4 text-right ${
                            filteredReportTotals.ownerNet > 0
                              ? 'text-emerald-400'
                              : filteredReportTotals.ownerNet < 0
                              ? 'text-rose-400'
                              : 'text-slate-300'
                          }`}
                        >
                          {formatSignedKHR(filteredReportTotals.ownerNet)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}

            {/* VIEW B: INDIVIDUAL PLAYER REPORT */}
            {reportSubView === 'player' && (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-slate-950 text-slate-400 text-xs uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4">អ្នកលេង (Player)</th>
                        <th className="py-3 px-4 text-center">ស្ថានភាព</th>
                        <th className="py-3 px-4 text-right">សមតុល្យ (Wallet)</th>
                        <th className="py-3 px-4 text-center">សំបុត្រទូទាត់ (Settled)</th>
                        <th className="py-3 px-4 text-right">ភ្នាល់សុពលភាព (Stakes)</th>
                        <th className="py-3 px-4 text-right">រង្វាន់ជាក់ស្ដែង (Payouts)</th>
                        <th className="py-3 px-4 text-right">Player Net W/L</th>
                        <th className="py-3 px-4 text-right">Owner Net W/L</th>
                        <th className="py-3 px-4 text-right">ដាក់ / ដក (Transfers)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/60 font-mono">
                      {filteredPlayerReports.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-10 text-center text-slate-400 font-sans">
                            មិនទាន់មានទិន្នន័យអ្នកលេងនៅឡើយទេ
                          </td>
                        </tr>
                      ) : (
                        filteredPlayerReports.map((pr) => (
                          <tr
                            key={pr.userId}
                            onClick={() =>
                              setReportSelectedPlayerId(
                                reportSelectedPlayerId === pr.userId ? 'ALL' : pr.userId
                              )
                            }
                            className={`cursor-pointer transition-colors ${
                              reportSelectedPlayerId === pr.userId
                                ? 'bg-amber-500/15'
                                : 'hover:bg-slate-700/40'
                            }`}
                            title="ចុចដើម្បីមើលរបាយការណ៍លម្អិតរបស់អ្នកលេងនេះ"
                          >
                            <td className="py-3 px-4">
                              <div className="font-bold text-blue-300">{pr.username}</div>
                              <div className="text-[10px] text-slate-400 font-sans">
                                {pr.name} • {pr.userId}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center font-sans">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  pr.status === 'ACTIVE'
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : 'bg-rose-500/20 text-rose-300'
                                }`}
                              >
                                {pr.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-emerald-300">
                              {formatKHR(pr.balance)}
                            </td>
                            <td className="py-3 px-4 text-center text-slate-300">
                              {pr.settledBetsCount}
                              {pr.pendingBetsCount > 0 && (
                                <span className="text-[10px] text-amber-300 ml-1">
                                  (+{pr.pendingBetsCount} pending)
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right text-white">
                              {formatKHR(pr.settledStaked)}
                            </td>
                            <td className="py-3 px-4 text-right text-amber-300">
                              {formatKHR(pr.totalWon)}
                            </td>
                            <td
                              className={`py-3 px-4 text-right font-bold ${
                                pr.playerNetProfitLoss > 0
                                  ? 'text-emerald-400'
                                  : pr.playerNetProfitLoss < 0
                                  ? 'text-rose-400'
                                  : 'text-slate-300'
                              }`}
                            >
                              {formatSignedKHR(pr.playerNetProfitLoss)}
                            </td>
                            <td
                              className={`py-3 px-4 text-right font-black ${
                                pr.ownerProfitLoss > 0
                                  ? 'text-emerald-400'
                                  : pr.ownerProfitLoss < 0
                                  ? 'text-rose-400'
                                  : 'text-slate-300'
                              }`}
                            >
                              {formatSignedKHR(pr.ownerProfitLoss)}
                            </td>
                            <td className="py-3 px-4 text-right text-xs">
                              <span className="text-emerald-400">
                                +{formatKHR(pr.totalDeposited)}
                              </span>
                              {' / '}
                              <span className="text-rose-400">
                                -{formatKHR(pr.totalWithdrawn)}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Focused Player's Own Settled Bets Breakdown */}
                {reportSelectedPlayerId !== 'ALL' && (
                  <div className="border-t border-slate-700 bg-slate-900/60 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs sm:text-sm font-bold text-amber-300">
                        លទ្ធផលភ្នាល់ជាក់ស្ដែងរបស់អ្នកលេង ({reportSelectedPlayerId}) —{' '}
                        {filteredSettledBets.length} សំបុត្រទូទាត់រួច
                      </h3>
                      <button
                        onClick={() => setReportSubView('detailed')}
                        className="text-xs text-blue-400 hover:text-blue-300 underline"
                      >
                        មើលលម្អិតទាំងអស់ →
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950 text-slate-400 uppercase">
                          <tr>
                            <th className="py-2 px-3">Date (YYYY-MM-DD)</th>
                            <th className="py-2 px-3">Round ID</th>
                            <th className="py-2 px-3">Ticket</th>
                            <th className="py-2 px-3 text-right">Stake</th>
                            <th className="py-2 px-3 text-right">Payout</th>
                            <th className="py-2 px-3 text-right">Player W/L</th>
                            <th className="py-2 px-3 text-right">Owner W/L</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 font-mono">
                          {filteredSettledBets.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-6 text-center text-slate-400 font-sans">
                                អ្នកលេងនេះមិនទាន់មានសំបុត្រទូទាត់រួចក្នុងកាលបរិច្ឆេទនេះទេ
                              </td>
                            </tr>
                          ) : (
                            filteredSettledBets.slice(0, 50).map((b) => (
                              <tr key={b.ticketId} className="hover:bg-slate-800/60">
                                <td className="py-2 px-3 text-slate-200">{b.dateYmd}</td>
                                <td className="py-2 px-3 text-blue-300 font-bold">{b.roundId}</td>
                                <td className="py-2 px-3 text-slate-400">{b.ticketId}</td>
                                <td className="py-2 px-3 text-right text-white">
                                  {formatKHR(b.stake)}
                                </td>
                                <td className="py-2 px-3 text-right text-amber-300">
                                  {formatKHR(b.payout)}
                                </td>
                                <td
                                  className={`py-2 px-3 text-right font-bold ${
                                    (b.playerNetWinLoss ?? 0) > 0
                                      ? 'text-emerald-400'
                                      : (b.playerNetWinLoss ?? 0) < 0
                                      ? 'text-rose-400'
                                      : 'text-slate-300'
                                  }`}
                                >
                                  {formatSignedKHR(b.playerNetWinLoss ?? 0)}
                                </td>
                                <td
                                  className={`py-2 px-3 text-right font-black ${
                                    (b.ownerNetWinLoss ?? 0) > 0
                                      ? 'text-emerald-400'
                                      : (b.ownerNetWinLoss ?? 0) < 0
                                      ? 'text-rose-400'
                                      : 'text-slate-300'
                                  }`}
                                >
                                  {formatSignedKHR(b.ownerNetWinLoss ?? 0)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* VIEW C: DAILY HISTORICAL REPORT (ASIA/PHNOM_PENH UTC+7) */}
            {reportSubView === 'daily' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-950 text-slate-400 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">កាលបរិច្ឆេទ (Date UTC+7)</th>
                      <th className="py-3 px-4 text-center">ចំនួនវេន (Rounds)</th>
                      <th className="py-3 px-4 text-center">សំបុត្រទូទាត់ (Settled)</th>
                      <th className="py-3 px-4 text-right">ភ្នាល់សុពលភាព (Stakes)</th>
                      <th className="py-3 px-4 text-right">រង្វាន់ជាក់ស្ដែង (Payouts)</th>
                      <th className="py-3 px-4 text-right">Player Net W/L</th>
                      <th className="py-3 px-4 text-right">Owner Net W/L</th>
                      <th className="py-3 px-4 text-center">ពិនិត្យ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60 font-mono">
                    {filteredDailyReports.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-10 text-center text-slate-400 font-sans">
                          មិនទាន់មានប្រវត្តិរបាយការណ៍ប្រចាំថ្ងៃនៅឡើយទេ
                        </td>
                      </tr>
                    ) : (
                      filteredDailyReports.map((d) => (
                        <tr key={d.date} className="hover:bg-slate-700/40">
                          <td className="py-3 px-4 font-bold text-amber-300">{d.date}</td>
                          <td className="py-3 px-4 text-center text-slate-300">{d.roundsCount}</td>
                          <td className="py-3 px-4 text-center text-slate-300">
                            {d.settledBetsCount}
                          </td>
                          <td className="py-3 px-4 text-right text-white">
                            {formatKHR(d.totalValidStakes)}
                          </td>
                          <td className="py-3 px-4 text-right text-amber-300">
                            {formatKHR(d.totalActualPayouts)}
                          </td>
                          <td
                            className={`py-3 px-4 text-right font-bold ${
                              d.playerNetWinLoss > 0
                                ? 'text-emerald-400'
                                : d.playerNetWinLoss < 0
                                ? 'text-rose-400'
                                : 'text-slate-300'
                            }`}
                          >
                            {formatSignedKHR(d.playerNetWinLoss)}
                          </td>
                          <td
                            className={`py-3 px-4 text-right font-black ${
                              d.ownerNetWinLoss > 0
                                ? 'text-emerald-400'
                                : d.ownerNetWinLoss < 0
                                ? 'text-rose-400'
                                : 'text-slate-300'
                            }`}
                          >
                            {formatSignedKHR(d.ownerNetWinLoss)}
                          </td>
                          <td className="py-3 px-4 text-center font-sans">
                            <button
                              onClick={() => {
                                sound.playClick();
                                setReportSelectedDate(d.date);
                                setReportSubView('overall');
                              }}
                              className="px-2.5 py-1 rounded-lg bg-blue-600/30 hover:bg-blue-600 text-blue-200 hover:text-white text-xs font-bold transition-colors"
                            >
                              មើលវេន →
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* VIEW D: DETAILED BETTING RESULTS */}
            {reportSubView === 'detailed' && (
              <div>
                <div className="px-4 py-2.5 bg-slate-900/50 border-b border-slate-700/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(['SETTLED', 'ALL', 'WON', 'LOST', 'PENDING', 'VOID'] as const).map((st) => (
                      <button
                        key={st}
                        onClick={() => setReportStatusFilter(st)}
                        className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                          reportStatusFilter === st
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-950 text-slate-400 hover:text-white'
                        }`}
                      >
                        {st === 'SETTLED' ? 'ទូទាត់រួច (Settled Only)' : st}
                      </button>
                    ))}
                  </div>
                  <span className="text-slate-400 font-mono">
                    {filteredDetailedBets.length} records
                  </span>
                </div>

                <div className="overflow-x-auto max-h-[520px]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider sticky top-0">
                      <tr>
                        <th className="py-3 px-3">កាលបរិច្ឆេទ & ម៉ោង (Date / Time)</th>
                        <th className="py-3 px-3">វេន (Round ID)</th>
                        <th className="py-3 px-3">អ្នកលេង (Player)</th>
                        <th className="py-3 px-3">ប៉ុស្តិ៍ / លេខ</th>
                        <th className="py-3 px-3 text-right">ភ្នាល់ (Stake)</th>
                        <th className="py-3 px-3 text-right">រង្វាន់ (Payout)</th>
                        <th className="py-3 px-3 text-center">ស្ថានភាព</th>
                        <th className="py-3 px-3 text-right">Player Net W/L</th>
                        <th className="py-3 px-3 text-right">Owner Net W/L</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/60 font-mono">
                      {filteredDetailedBets.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-10 text-center text-slate-400 font-sans">
                            គ្មានទិន្នន័យសំបុត្រសម្រាប់ជម្រើសនេះទេ
                          </td>
                        </tr>
                      ) : (
                        filteredDetailedBets.map((b) => {
                          const isSettled = b.status === 'WON' || b.status === 'LOST';
                          const rowTs =
                            isSettled && b.settledAt && b.settledAt > 0 ? b.settledAt : b.timestamp;
                          const rowDateYmd = getBetReportDateYmd(b);
                          const rowTimeHms = formatCambodiaTimeHms(rowTs);
                          return (
                            <tr key={b.ticketId} className="hover:bg-slate-700/40">
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <div className="font-bold text-slate-200">{rowDateYmd}</div>
                                <div className="text-[11px] text-amber-300">{rowTimeHms}</div>
                                <div className="text-[10px] text-slate-400">{b.ticketId}</div>
                              </td>
                              <td className="py-2.5 px-3 text-blue-300 font-bold whitespace-nowrap">
                                {b.roundId}
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <div className="font-bold text-white">{b.username}</div>
                                <div className="text-[10px] text-slate-400 font-sans">
                                  {b.userId}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-slate-300 max-w-[160px] truncate">
                                [{b.channels.join(',')}] {b.numbers.join(', ')}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-white whitespace-nowrap">
                                {formatKHR(b.stake)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold whitespace-nowrap">
                                {isSettled ? (
                                  <span
                                    className={b.payout > 0 ? 'text-amber-300' : 'text-slate-400'}
                                  >
                                    {formatKHR(b.payout)}
                                  </span>
                                ) : (
                                  <span className="text-slate-500">—</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center font-sans">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    b.status === 'WON'
                                      ? 'bg-emerald-500/20 text-emerald-300'
                                      : b.status === 'LOST'
                                      ? 'bg-slate-700 text-slate-300'
                                      : b.status === 'PENDING'
                                      ? 'bg-amber-500/20 text-amber-300'
                                      : 'bg-rose-500/20 text-rose-300'
                                  }`}
                                >
                                  {b.status}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold whitespace-nowrap">
                                {isSettled && b.playerNetWinLoss !== null ? (
                                  <span
                                    className={
                                      b.playerNetWinLoss > 0
                                        ? 'text-emerald-400'
                                        : b.playerNetWinLoss < 0
                                        ? 'text-rose-400'
                                        : 'text-slate-300'
                                    }
                                  >
                                    {formatSignedKHR(b.playerNetWinLoss)}
                                  </span>
                                ) : (
                                  <span className="text-amber-300 font-sans text-[11px]">
                                    {b.status === 'PENDING' ? 'Pending' : 'Void'}
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right font-black whitespace-nowrap">
                                {isSettled && b.ownerNetWinLoss !== null ? (
                                  <span
                                    className={
                                      b.ownerNetWinLoss > 0
                                        ? 'text-emerald-400'
                                        : b.ownerNetWinLoss < 0
                                        ? 'text-rose-400'
                                        : 'text-slate-300'
                                    }
                                  >
                                    {formatSignedKHR(b.ownerNetWinLoss)}
                                  </span>
                                ) : (
                                  <span className="text-amber-300 font-sans text-[11px]">
                                    {b.status === 'PENDING' ? 'Pending' : 'Void'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Administrative Audit Logs Table */}
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl overflow-hidden shadow-lg">
            <div className="p-4 bg-slate-900/90 border-b border-slate-700">
              <h2 className="text-lg font-black text-white">
                កំណត់ត្រាសកម្មភាពគ្រប់គ្រង (Administrative Audit Logs)
              </h2>
              <p className="text-xs text-slate-400">
                រាល់សកម្មភាពរបស់ Owner និងការទូទាត់លទ្ធផលត្រូវបានកត់ត្រាទុកជាអចិន្ត្រៃយ៍ក្នុង Database
              </p>
            </div>

            <div className="overflow-x-auto max-h-[420px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider sticky top-0">
                  <tr>
                    <th className="py-2.5 px-4">ម៉ោង (Time)</th>
                    <th className="py-2.5 px-4">អ្នកអនុវត្ត (Actor)</th>
                    <th className="py-2.5 px-4">សកម្មភាព (Action)</th>
                    <th className="py-2.5 px-4">គោលដៅ (Target)</th>
                    <th className="py-2.5 px-4">ព័ត៌មានលម្អិត (Details)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-700/40">
                      <td className="py-2.5 px-4 font-mono text-slate-300 whitespace-nowrap">
                        {log.createdAt}
                      </td>
                      <td className="py-2.5 px-4 font-mono font-bold text-amber-300">
                        {log.actorUsername}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 font-mono text-[11px] text-blue-300">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-400">
                        {log.targetId || '—'}
                      </td>
                      <td className="py-2.5 px-4 text-slate-200">{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 6: SYSTEM CONFIGURATION & OWNER SECURITY
         ========================================================================= */}
      {activeTab === 'system' && (
        <div className="flex-1 max-w-[1720px] w-full mx-auto p-4 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* System Parameter Card */}
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 shadow-xl space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-700">
                <span className="p-1.5 rounded-lg bg-emerald-600 text-white">
                  <Settings className="w-5 h-5" />
                </span>
                <h2 className="text-lg font-black text-white">
                  ការកំណត់ប្រព័ន្ធទូទៅ (System Parameters)
                </h2>
              </div>

              {/* Payout rate */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300">
                  អត្រាសងរង្វាន់ឆ្នោត 1/99 (Payout Multiplier):
                </label>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                      1:
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={systemConfig.payoutRate}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val > 0 && val <= 99) {
                          onUpdateSystemConfig({ payoutRate: val });
                        }
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-2 font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <span className="text-xs text-slate-400">
                    ចាក់ 1,000៛ ឈ្នះ {formatKHR(1000 * systemConfig.payoutRate)}
                  </span>
                </div>
              </div>

              {/* Draw interval */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300">
                  រយៈពេលគម្លាតនៃការចេញរង្វាន់ (Draw Countdown Interval):
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {[
                    { label: '15s', sec: 15 },
                    { label: '30s', sec: 30 },
                    { label: '1 នាទី', sec: 60 },
                    { label: '2 នាទី', sec: 120 },
                    { label: '3 នាទី', sec: 180 },
                    { label: '5 នាទី', sec: 300 },
                  ].map(({ label, sec }) => (
                    <button
                      key={sec}
                      onClick={() => {
                        sound.playClick();
                        onUpdateSystemConfig({ drawIntervalSeconds: sec });
                      }}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                        systemConfig.drawIntervalSeconds === sec
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-xs'
                          : 'bg-slate-900 text-slate-300 border-slate-700 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Min & Max bet */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">
                    ភ្នាល់អប្បបរមា (Min Bet):
                  </label>
                  <input
                    type="number"
                    min={10}
                    value={systemConfig.minBetAmount}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val) && val >= 10) onUpdateSystemConfig({ minBetAmount: val });
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 font-mono text-sm text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">
                    ភ្នាល់អតិបរមា (Max Bet):
                  </label>
                  <input
                    type="number"
                    min={100}
                    value={systemConfig.maxBetAmount}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val) && val >= systemConfig.minBetAmount) {
                        onUpdateSystemConfig({ maxBetAmount: val });
                      }
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 font-mono text-sm text-white"
                  />
                </div>
              </div>

              {/* Auto Draw Toggle */}
              <div className="pt-3 border-t border-slate-700 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white">
                    ការចេញរង្វាន់ស្វ័យប្រវត្តិ (Auto Draw Mode)
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {systemConfig.autoDrawEnabled
                      ? 'ចាប់រង្វាន់ដោយស្វ័យប្រវត្តិពេលម៉ោងរាប់ថយដល់ 0'
                      : 'បិទស្វ័យប្រវត្តិ (ចេញរង្វាន់ដោយដៃ Manual Draw តែប៉ុណ្ណោះ)'}
                  </div>
                </div>
                <button
                  onClick={() => {
                    sound.playClick();
                    onUpdateSystemConfig({ autoDrawEnabled: !systemConfig.autoDrawEnabled });
                  }}
                  className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    systemConfig.autoDrawEnabled
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {systemConfig.autoDrawEnabled ? 'AUTO ON' : 'MANUAL ONLY'}
                </button>
              </div>

              {/* System Open / Maintenance */}
              <div className="pt-3 border-t border-slate-700 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white">
                    ស្ថានភាពប្រព័ន្ធឆ្នោត (Platform Status)
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {systemConfig.isSystemOpen
                      ? 'បើកដំណើរការធម្មតា (ទទួលការចាក់)'
                      : 'ផ្អាកជាបណ្ដោះអាសន្ន (បិទការភ្នាល់)'}
                  </div>
                </div>
                <button
                  onClick={() => {
                    sound.playClick();
                    onUpdateSystemConfig({ isSystemOpen: !systemConfig.isSystemOpen });
                  }}
                  className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    systemConfig.isSystemOpen
                      ? 'bg-emerald-600 text-white'
                      : 'bg-rose-600 text-white'
                  }`}
                >
                  {systemConfig.isSystemOpen ? 'បើកដំណើរការ (OPEN)' : 'ផ្អាក (LOCKED)'}
                </button>
              </div>
            </div>

            {/* Right Column: Financial Summary + Change Owner Password */}
            <div className="space-y-6">
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-700">
                  <span className="p-1.5 rounded-lg bg-amber-600 text-white">
                    <Coins className="w-5 h-5" />
                  </span>
                  <h2 className="text-lg font-black text-white">
                    របាយការណ៍ហិរញ្ញវត្ថុប្រព័ន្ធ (All-Time Financial Summary)
                  </h2>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-xs text-slate-400">សរុបប្រាក់ភ្នាល់មានសុពលភាព (All-Time):</span>
                    <span className="font-mono font-bold text-base text-white">
                      {formatKHR(reports.totalValidStakes)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-xs text-slate-400">សរុបប្រាក់រង្វាន់បានសង (All-Time):</span>
                    <span className="font-mono font-bold text-base text-rose-400">
                      {formatKHR(reports.totalWinningPayouts)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-emerald-500/30">
                    <span className="text-xs font-bold text-emerald-400">
                      ចំណេញ/ខាតសុទ្ធ Owner (All-Time Realized P/L):
                    </span>
                    <span
                      className={`font-mono font-black text-lg ${
                        reports.ownerRealizedProfitLoss >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {formatKHR(reports.ownerRealizedProfitLoss)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Change Owner Password Card */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-700">
                  <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    <KeyRound className="w-5 h-5" />
                  </span>
                  <h2 className="text-lg font-black text-white">
                    ផ្លាស់ប្តូរពាក្យសម្ងាត់ Owner (Change Owner Password)
                  </h2>
                </div>

                <form onSubmit={handleOwnerPasswordSubmit} className="space-y-3 text-xs">
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">
                      ពាក្យសម្ងាត់បច្ចុប្បន្ន (Current Password):
                    </label>
                    <input
                      type="password"
                      required
                      value={ownerCurrentPw}
                      onChange={(e) => setOwnerCurrentPw(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-300 mb-1">
                        ពាក្យសម្ងាត់ថ្មី (New Password):
                      </label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={ownerNewPw}
                        onChange={(e) => setOwnerNewPw(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-300 mb-1">
                        បញ្ជាក់ពាក្យសម្ងាត់ថ្មី (Confirm):
                      </label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={ownerConfirmPw}
                        onChange={(e) => setOwnerConfirmPw(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={changingOwnerPw}
                      className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black shadow-md disabled:opacity-50"
                    >
                      {changingOwnerPw ? 'កំពុងរក្សាទុក...' : 'រក្សាទុកពាក្យសម្ងាត់ថ្មី'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: CREATE NEW PLAYER (OWNER ONLY)
         ========================================================================= */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-amber-400" />
                <h3 className="font-black text-white text-base">
                  បង្កើតគណនីអ្នកលេងថ្មី (Create Player Account)
                </h3>
              </div>
              <button
                onClick={() => setIsAddUserModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePlayerSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    Username ចូលលេង:
                  </label>
                  <input
                    type="text"
                    required
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-400"
                    placeholder="player01"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    Account ID (Unique):
                  </label>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      required
                      value={newUserId}
                      onChange={(e) => setNewUserId(e.target.value.toUpperCase())}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-2 font-mono text-white uppercase focus:outline-none focus:border-amber-400"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const code = `USR_${Math.floor(1000 + Math.random() * 9000)}`;
                        setNewUserId(code);
                        if (!newUsername) setNewUsername(code);
                      }}
                      className="px-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700"
                    >
                      🎲
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  ពាក្យសម្ងាត់ (Password - នឹងរក្សាទុកជា Hash សុវត្ថិភាព):
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    minLength={4}
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 font-mono text-white focus:outline-none focus:border-amber-400"
                    placeholder="បញ្ចូលពាក្យសម្ងាត់យ៉ាងតិច 4 តួ"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setNewUserPassword(String(Math.floor(100000 + Math.random() * 900000)))
                    }
                    className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs"
                  >
                    🎲 ចៃដន្យ
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  ឈ្មោះបង្ហាញ (Full Name):
                </label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                  placeholder="ឈ្មោះអ្នកលេង"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    សមតុល្យដំបូង (Initial Balance):
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={newUserBalance}
                    onChange={(e) => setNewUserBalance(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 font-mono text-emerald-400 font-bold focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    កម្រិតឥណទាន (Credit Limit):
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={newUserCredit}
                    onChange={(e) => setNewUserCredit(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 font-mono text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">លេខទូរស័ព្ទ:</label>
                  <input
                    type="text"
                    value={newUserPhone}
                    onChange={(e) => setNewUserPhone(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none"
                    placeholder="012 345 678"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">កំណត់សម្គាល់:</label>
                  <input
                    type="text"
                    value={newUserNotes}
                    onChange={(e) => setNewUserNotes(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none"
                    placeholder="VIP / Note"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddUserModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  បោះបង់
                </button>
                <button
                  type="submit"
                  disabled={creatingPlayer}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black shadow-md disabled:opacity-50"
                >
                  {creatingPlayer ? 'កំពុងបង្កើត...' : '+ បង្កើតគណនីអ្នកលេង'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: CASHIER DEPOSIT & WITHDRAWAL
         ========================================================================= */}
      {isCashierModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="font-black text-white text-base">
                    {cashierType === 'DEPOSIT'
                      ? 'ដាក់ប្រាក់ទៅគណនី (Deposit)'
                      : cashierType === 'WITHDRAWAL'
                      ? 'ដកប្រាក់ពីគណនី (Withdraw)'
                      : 'កំណត់សមតុល្យគណនី (Set Balance)'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    ប្រតិបត្តិការគ្រប់គ្រងដោយ Owner ផ្ទាល់
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCashierModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitCashier} className="text-xs space-y-3.5">
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setCashierType('DEPOSIT')}
                  className={`py-2 rounded-xl font-bold border transition-all ${
                    cashierType === 'DEPOSIT'
                      ? 'bg-emerald-600 text-white border-emerald-400 font-black'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  + ដាក់ប្រាក់
                </button>
                <button
                  type="button"
                  onClick={() => setCashierType('WITHDRAWAL')}
                  className={`py-2 rounded-xl font-bold border transition-all ${
                    cashierType === 'WITHDRAWAL'
                      ? 'bg-rose-600 text-white border-rose-400 font-black'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  - ដកប្រាក់
                </button>
                <button
                  type="button"
                  onClick={() => setCashierType('SET')}
                  className={`py-2 rounded-xl font-bold border transition-all ${
                    cashierType === 'SET'
                      ? 'bg-amber-500 text-slate-950 border-amber-300 font-black'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  = កំណត់ផ្ទាល់
                </button>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  ជ្រើសរើសគណនីអ្នកលេង (Target Player):
                </label>
                <select
                  value={cashierSelectedUserId}
                  onChange={(e) => setCashierSelectedUserId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-emerald-400"
                >
                  {players.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.username} — {u.name} — សមតុល្យ: {formatKHR(u.balance)}
                    </option>
                  ))}
                </select>
              </div>

              {(() => {
                const selectedUser = players.find((u) => u.id === cashierSelectedUserId);
                const currentBal = selectedUser ? selectedUser.balance : 0;
                const amtNum = parseInt(cashierAmount.replace(/[^0-9]/g, ''), 10) || 0;
                const projectedBal =
                  cashierType === 'DEPOSIT'
                    ? currentBal + amtNum
                    : cashierType === 'WITHDRAWAL'
                    ? Math.max(0, currentBal - amtNum)
                    : amtNum;
                const isWithdrawalOverflow = cashierType === 'WITHDRAWAL' && amtNum > currentBal;

                return (
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-slate-300">ចំនួនទឹកប្រាក់ (KHR):</label>
                        <span className="text-[11px] text-slate-400">
                          បច្ចុប្បន្ន:{' '}
                          <strong className="font-mono text-emerald-400">
                            {formatKHR(currentBal)}
                          </strong>
                        </span>
                      </div>
                      <input
                        type="number"
                        required
                        min={cashierType === 'SET' ? 0 : 1}
                        value={cashierAmount}
                        onChange={(e) => setCashierAmount(e.target.value)}
                        className={`w-full bg-slate-800 border rounded-xl px-3 py-2.5 font-mono font-black text-lg text-white focus:outline-none ${
                          isWithdrawalOverflow
                            ? 'border-rose-500 text-rose-300'
                            : 'border-slate-700 focus:border-emerald-400'
                        }`}
                      />
                      {isWithdrawalOverflow && (
                        <div className="text-rose-400 text-[11px] mt-1 font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>ចំនួនដកលើសពីសមតុល្យដែលមាន ({formatKHR(currentBal)})</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {['50000', '100000', '200000', '500000', '1000000', '5000000'].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setCashierAmount(amt)}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-mono text-[11px] border border-slate-700"
                        >
                          +{parseInt(amt, 10).toLocaleString()}៛
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-slate-300 mb-1">វិធីសាស្ត្រ:</label>
                        <select
                          value={cashierPaymentMethod}
                          onChange={(e) => setCashierPaymentMethod(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs"
                        >
                          <option value="ABA Bank">🏦 ABA Bank</option>
                          <option value="Wing Bank">🪪 Wing Bank</option>
                          <option value="TrueMoney">📱 TrueMoney</option>
                          <option value="Cash / សាច់ប្រាក់">💵 Cash / សាច់ប្រាក់</option>
                          <option value="Acleda Bank">🏢 Acleda Bank</option>
                          <option value="Owner Adjustment">💳 Owner Adjustment</option>
                        </select>
                      </div>
                      <div>
                        <label className="block font-bold text-slate-300 mb-1">កំណត់សម្គាល់:</label>
                        <input
                          type="text"
                          value={cashierNote}
                          onChange={(e) => setCashierNote(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs"
                          placeholder="ABA Ref..."
                        />
                      </div>
                    </div>

                    <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-1 font-mono text-xs">
                      <div className="flex justify-between text-slate-400">
                        <span>សមតុល្យដើម:</span>
                        <span>{formatKHR(currentBal)}</span>
                      </div>
                      <div className="flex justify-between font-black text-sm pt-1 border-t border-slate-800 text-white">
                        <span>សមតុល្យថ្មី:</span>
                        <span className="text-emerald-400">{formatKHR(projectedBal)}</span>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => setIsCashierModalOpen(false)}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                      >
                        បោះបង់
                      </button>
                      <button
                        type="submit"
                        disabled={
                          cashierSubmitting ||
                          isWithdrawalOverflow ||
                          (cashierType !== 'SET' && amtNum <= 0)
                        }
                        className="px-5 py-2 rounded-xl font-black text-sm shadow-md bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 disabled:opacity-50"
                      >
                        {cashierSubmitting ? 'កំពុងដំណើរការ...' : '✓ បញ្ជាក់ប្រតិបត្តិការ'}
                      </button>
                    </div>
                  </>
                );
              })()}
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: RESET PLAYER PASSWORD
         ========================================================================= */}
      {passwordEditUser && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-400" />
                <h3 className="font-black text-white text-base">
                  កំណត់ពាក្យសម្ងាត់អ្នកលេងឡើងវិញ
                </h3>
              </div>
              <button
                onClick={() => setPasswordEditUser(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="text-xs space-y-3">
              <div className="bg-slate-800 p-3 rounded-xl border border-slate-700">
                <div className="text-slate-400">
                  Username:{' '}
                  <span className="font-mono font-bold text-amber-300">
                    {passwordEditUser.username}
                  </span>
                </div>
                <div className="text-white font-semibold">{passwordEditUser.name}</div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  ពាក្យសម្ងាត់ថ្មី (New Password):
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    minLength={4}
                    value={passwordEditValue}
                    onChange={(e) => setPasswordEditValue(e.target.value)}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 font-mono text-white focus:outline-none focus:border-amber-400 text-sm"
                    placeholder="បញ្ចូលពាក្យសម្ងាត់ថ្មី"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setPasswordEditValue(String(Math.floor(100000 + Math.random() * 900000)))
                    }
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 text-xs"
                  >
                    🎲 ចៃដន្យ
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setPasswordEditUser(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  បោះបង់
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!passwordEditValue.trim() || passwordEditValue.trim().length < 4) {
                      showFeedback('error', 'ពាក្យសម្ងាត់ត្រូវមានយ៉ាងតិច 4 តួអក្សរ!');
                      return;
                    }
                    sound.playClick();
                    const err = await onResetPlayerPassword(
                      passwordEditUser.id,
                      passwordEditValue.trim()
                    );
                    if (err) showFeedback('error', err);
                    else
                      showFeedback(
                        'success',
                        `បានផ្លាស់ប្តូរពាក្យសម្ងាត់សម្រាប់ ${passwordEditUser.username}!`
                      );
                    setPasswordEditUser(null);
                  }}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black shadow-md"
                >
                  រក្សាទុកពាក្យសម្ងាត់
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: SEPARATE PROJECTS EXPORT (NO CREDENTIALS SHOWN)
         ========================================================================= */}
      {isDomainGuideModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl text-slate-200 space-y-5">
            <div className="flex items-start justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg">
                  <FileArchive className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    📦 ទាញយកគម្រោងដាច់ដោយឡែកទាំងពីរ (Separate Projects)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Game Page (127.0.0.1:3000) + Owner Admin Panel (127.0.0.1:3001)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDomainGuideModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-950/70 border border-blue-500/30 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-1.5 text-blue-400 font-bold text-sm">
                  <Globe className="w-4 h-4" />
                  <span>1. Game Page + Backend</span>
                </div>
                <p className="text-xs text-slate-400">
                  រត់លើ <code className="text-blue-300">http://127.0.0.1:3000</code> ជាមួយ SQLite Database និង Authoritative Server។
                </p>
                <a
                  href="/lottery888-game-page.zip"
                  download="lottery888-game-page.zip"
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-xl text-xs"
                >
                  <Download className="w-4 h-4" />
                  <span>ទាញយក Game Page ZIP</span>
                </a>
              </div>

              <div className="bg-slate-950/70 border border-amber-500/30 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-1.5 text-amber-400 font-bold text-sm">
                  <Server className="w-4 h-4" />
                  <span>2. Owner Admin Panel</span>
                </div>
                <p className="text-xs text-slate-400">
                  រត់លើ <code className="text-amber-300">http://127.0.0.1:3001</code> ភ្ជាប់ផ្ទាល់ទៅ Backend Server តែមួយ។
                </p>
                <a
                  href="/lottery888-admin-panel.zip"
                  download="lottery888-admin-panel.zip"
                  className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-4 py-2 rounded-xl text-xs"
                >
                  <Download className="w-4 h-4" />
                  <span>ទាញយក Admin Panel ZIP</span>
                </a>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsDomainGuideModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs"
              >
                បិទផ្ទាំង
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
