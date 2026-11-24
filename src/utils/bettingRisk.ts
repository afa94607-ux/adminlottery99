import { BetTicket, ChannelLetter } from '../types/lottery';

export const ALL_CHANNELS: ChannelLetter[] = ['A', 'B', 'C', 'D', 'E'];

export type ExposureLevel = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';

export interface NumberChannelExposure {
  channel: ChannelLetter;
  number: string;
  acceptedBets: number;
  attributedStake: number;
  potentialPayout: number;
  /** Single-channel net impact against total round stakes (not a guaranteed whole-round profit). */
  ownerNetImpact: number;
  exposureLevel: ExposureLevel;
}

export interface RoundRiskSummary {
  roundId: string;
  acceptedTicketCount: number;
  totalAcceptedStakes: number;
  cells: NumberChannelExposure[];
  maxChannelExposure: NumberChannelExposure | null;
  roundRiskLevel: ExposureLevel;
}

export interface HypotheticalScenarioResult {
  numbers: Record<ChannelLetter, string>;
  totalAcceptedStakes: number;
  hypotheticalTotalPayout: number;
  ownerPotentialProfitLoss: number;
}

export function normalizeTwoDigitNumber(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  const n = parseInt(digits, 10);
  if (!Number.isFinite(n) || n < 1 || n > 99) return null;
  return String(n).padStart(2, '0');
}

function getAcceptedCurrentRoundTickets(tickets: BetTicket[], currentRoundId: string): BetTicket[] {
  const seen = new Set<string>();
  const accepted: BetTicket[] = [];
  for (const t of tickets) {
    if (t.roundId !== currentRoundId || t.status === 'VOID') continue;
    if (seen.has(t.ticketId)) continue;
    seen.add(t.ticketId);
    accepted.push(t);
  }
  return accepted;
}

function computeExposureLevel(potentialPayout: number, totalAcceptedStakes: number): ExposureLevel {
  if (potentialPayout <= 0) return 'NONE';
  if (totalAcceptedStakes <= 0 || potentialPayout > totalAcceptedStakes) return 'HIGH';
  if (potentialPayout >= totalAcceptedStakes * 0.5) return 'MEDIUM';
  return 'LOW';
}

export function analyzeCurrentRoundRisk(
  tickets: BetTicket[],
  currentRoundId: string,
  payoutRate: number
): RoundRiskSummary {
  const accepted = getAcceptedCurrentRoundTickets(tickets, currentRoundId);
  const totalAcceptedStakes = accepted.reduce((sum, t) => sum + (t.totalCost || 0), 0);

  // Initialize 5 x 99 = 495 cells in O(1) lookup map
  const cells: NumberChannelExposure[] = [];
  const indexByKey = new Map<string, number>();

  for (const channel of ALL_CHANNELS) {
    for (let i = 1; i <= 99; i++) {
      const num = String(i).padStart(2, '0');
      const idx = cells.length;
      indexByKey.set(`${channel}:${num}`, idx);
      cells.push({
        channel,
        number: num,
        acceptedBets: 0,
        attributedStake: 0,
        potentialPayout: 0,
        ownerNetImpact: totalAcceptedStakes,
        exposureLevel: 'NONE',
      });
    }
  }

  for (const ticket of accepted) {
    const unitStake = Math.max(0, ticket.stakePerUnit || 0);
    const unitPayout = unitStake * payoutRate;
    const uniqueChannels = Array.from(new Set(ticket.channels));
    const uniqueNumbers = Array.from(new Set(ticket.numbers));

    for (const ch of uniqueChannels) {
      for (const rawNum of uniqueNumbers) {
        const norm = normalizeTwoDigitNumber(rawNum);
        if (!norm) continue;
        const idx = indexByKey.get(`${ch}:${norm}`);
        if (idx === undefined) continue;
        const cell = cells[idx];
        cell.acceptedBets += 1;
        cell.attributedStake += unitStake;
        cell.potentialPayout += unitPayout;
      }
    }
  }

  let maxChannelExposure: NumberChannelExposure | null = null;
  for (const cell of cells) {
    cell.ownerNetImpact = totalAcceptedStakes - cell.potentialPayout;
    cell.exposureLevel = computeExposureLevel(cell.potentialPayout, totalAcceptedStakes);
    if (
      cell.potentialPayout > 0 &&
      (!maxChannelExposure || cell.potentialPayout > maxChannelExposure.potentialPayout)
    ) {
      maxChannelExposure = cell;
    }
  }

  const roundRiskLevel: ExposureLevel = maxChannelExposure
    ? maxChannelExposure.exposureLevel
    : 'NONE';

  return {
    roundId: currentRoundId,
    acceptedTicketCount: accepted.length,
    totalAcceptedStakes,
    cells,
    maxChannelExposure,
    roundRiskLevel,
  };
}

export function simulateHypotheticalResult(
  tickets: BetTicket[],
  currentRoundId: string,
  payoutRate: number,
  hypothetical: Record<ChannelLetter, string>
): HypotheticalScenarioResult {
  const accepted = getAcceptedCurrentRoundTickets(tickets, currentRoundId);
  const totalAcceptedStakes = accepted.reduce((sum, t) => sum + (t.totalCost || 0), 0);

  const normalizedTarget: Record<ChannelLetter, string> = {
    A: normalizeTwoDigitNumber(hypothetical.A) || '',
    B: normalizeTwoDigitNumber(hypothetical.B) || '',
    C: normalizeTwoDigitNumber(hypothetical.C) || '',
    D: normalizeTwoDigitNumber(hypothetical.D) || '',
    E: normalizeTwoDigitNumber(hypothetical.E) || '',
  };

  let hypotheticalTotalPayout = 0;

  for (const ticket of accepted) {
    const unitPayout = Math.max(0, ticket.stakePerUnit || 0) * payoutRate;
    const uniqueChannels = Array.from(new Set(ticket.channels));
    const numberSet = new Set(
      ticket.numbers.map((n) => normalizeTwoDigitNumber(n)).filter((v): v is string => v !== null)
    );

    for (const ch of uniqueChannels) {
      const target = normalizedTarget[ch];
      if (target && numberSet.has(target)) {
        hypotheticalTotalPayout += unitPayout;
      }
    }
  }

  return {
    numbers: normalizedTarget,
    totalAcceptedStakes,
    hypotheticalTotalPayout,
    ownerPotentialProfitLoss: totalAcceptedStakes - hypotheticalTotalPayout,
  };
}
