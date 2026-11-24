import { ChannelLetter } from '../types/lottery';

export type AdminLang = 'en' | 'km';

export interface NextRoundDraftRecord {
  targetRoundId: string;
  numbers: Record<ChannelLetter, string>;
  savedAt: number;
  status: 'SAVED';
}

export const NEXT_ROUND_DRAFT_STORAGE_KEY = 'lottery888_admin_next_round_draft_v1';
export const ADMIN_LANG_STORAGE_KEY = 'lottery888_admin_lang_v1';

export function computeNextRoundId(currentRoundId: string): string {
  const match = currentRoundId.match(/^(.*#)(\d+)$/);
  if (!match) return `${currentRoundId}-NEXT`;
  const prefix = match[1];
  const num = parseInt(match[2], 10);
  return `${prefix}${num + 1}`;
}

export function loadSavedNextRoundDraft(storage: Storage | null = typeof window !== 'undefined' ? window.localStorage : null): NextRoundDraftRecord | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(NEXT_ROUND_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NextRoundDraftRecord;
    if (!parsed || typeof parsed.targetRoundId !== 'string' || !parsed.numbers) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveNextRoundDraft(
  record: NextRoundDraftRecord,
  storage: Storage | null = typeof window !== 'undefined' ? window.localStorage : null
): void {
  if (!storage) return;
  storage.setItem(NEXT_ROUND_DRAFT_STORAGE_KEY, JSON.stringify(record));
}

export function clearSavedNextRoundDraft(
  storage: Storage | null = typeof window !== 'undefined' ? window.localStorage : null
): void {
  if (!storage) return;
  storage.removeItem(NEXT_ROUND_DRAFT_STORAGE_KEY);
}

export const RISK_TEXT = {
  en: {
    title: 'Owner Betting Risk Analysis',
    subtitle: 'Real-time financial exposure for current round accepted bets (1:{rate} payout). Read-only monitoring.',
    updated: 'Updated',
    syncing: 'Syncing...',
    riskBadge: 'Risk',
    cardRound: 'Current Round',
    cardRoundDesc: 'Active betting round only',
    cardBets: 'Total Accepted Bets',
    cardBetsDesc: 'Accepted tickets (excludes void)',
    cardStakes: 'Total Accepted Stakes',
    cardStakesDesc: 'Total money bet this round',
    cardScenarioPayout: 'Potential Payout (Scenario)',
    cardScenarioPayoutDesc: 'Total payout for A–E inputs below',
    cardProfitLoss: 'Owner Potential Profit / Loss',
    cardProfitLossDesc: 'Whole-round simulation (Stakes − Payout)',
    cardHighExp: 'Highest Per-Channel Exposure',
    cardHighExpNone: 'No active exposure yet',
    cardHighExpNote: 'Single-channel max only',
    topTitle: 'HIGHEST BETTING EXPOSURE',
    topSubtitle: 'Top {count} exposed channel/number pairs. Financial monitoring only — never selects winning results.',
    topEmpty: 'No accepted bets in this round yet.',
    colChannel: 'Channel',
    colNumber: 'Number',
    colBets: 'Accepted Bets',
    colStake: 'Attributed Stake',
    colPayout: 'Potential Payout Exposure',
    colImpact: 'Channel Net Impact',
    colLevel: 'Exposure',
    simTitle: 'Hypothetical Result Risk Calculator (Read-Only)',
    simBadge: 'Simulation Only — Never alters Official Draw or Force Preset',
    simExplain: 'These figures show the financial impact if the entered numbers occur. This is a simulation only.',
    simTotalStakes: 'TOTAL ACCEPTED STAKES',
    simTotalPayout: 'HYPOTHETICAL TOTAL PAYOUT',
    simProfitLoss: 'OWNER POTENTIAL PROFIT / LOSS',
    tableTitle: 'Detailed Number Exposure (01–99)',
    allChannels: 'All Channels',
    channelPrefix: 'Channel',
    viewWithBets: 'Numbers With Bets',
    viewAll: 'All Numbers (495)',
    searchPlaceholder: 'Search 01–99...',
    rowsLabel: 'rows',
    impactNote: 'Channel Net Impact = Round Stakes − Channel Payout (single-channel view only, not whole-round profit)',
    pageOf: 'Page {page} of {total}',
  },
  km: {
    title: 'ការវិភាគហានិភ័យការភ្នាល់',
    subtitle: 'ត្រួតពិនិត្យហានិភ័យហិរញ្ញវត្ថុសម្រាប់សំបុត្រដែលបានទទួលក្នុងជុំបច្ចុប្បន្ន (អត្រាសង 1:{rate})។ សម្រាប់តាមដានប៉ុណ្ណោះ។',
    updated: 'ធ្វើបច្ចុប្បន្នភាព',
    syncing: 'កំពុងភ្ជាប់...',
    riskBadge: 'ហានិភ័យ',
    cardRound: 'ជុំបច្ចុប្បន្ន',
    cardRoundDesc: 'គណនាតែជុំកំពុងដំណើរការប៉ុណ្ណោះ',
    cardBets: 'ចំនួនភ្នាល់ដែលបានទទួល',
    cardBetsDesc: 'សំបុត្រដែលបានទទួល (មិនរាប់សំបុត្រលុប)',
    cardStakes: 'ទឹកប្រាក់ភ្នាល់សរុប',
    cardStakesDesc: 'ទឹកប្រាក់ចាក់សរុបក្នុងជុំនេះ',
    cardScenarioPayout: 'ប្រាក់ដែលអាចត្រូវបង់ (សេណារីយ៉ូ)',
    cardScenarioPayoutDesc: 'សងសរុបសម្រាប់លេខ A–E ខាងក្រោម',
    cardProfitLoss: 'ចំណេញ / ខាតរបស់ម្ចាស់',
    cardProfitLossDesc: 'ការគណនាសាកល្បងទាំងជុំ (ភ្នាល់ − សង)',
    cardHighExp: 'ហានិភ័យខ្ពស់បំផុតតាមប៉ុស្តិ៍',
    cardHighExpNone: 'មិនទាន់មានហានិភ័យទេ',
    cardHighExpNote: 'អតិបរមាក្នុង 1 ប៉ុស្តិ៍ប៉ុណ្ណោះ',
    topTitle: 'ហានិភ័យភ្នាល់ខ្ពស់បំផុត',
    topSubtitle: 'លេខដែលមានហានិភ័យសងខ្ពស់ជាងគេទាំង {count}។ សម្រាប់ត្រួតពិនិត្យហិរញ្ញវត្ថុប៉ុណ្ណោះ — មិនជ្រើសលេខចេញទេ។',
    topEmpty: 'មិនទាន់មានការភ្នាល់ក្នុងជុំនេះនៅឡើយទេ។',
    colChannel: 'ប៉ុស្តិ៍',
    colNumber: 'លេខ',
    colBets: 'ចំនួនភ្នាល់',
    colStake: 'ប្រាក់ភ្នាល់ពាក់ព័ន្ធ',
    colPayout: 'ប្រាក់អាចត្រូវបង់',
    colImpact: 'ផលប៉ះពាល់តាមប៉ុស្តិ៍',
    colLevel: 'កម្រិត',
    simTitle: 'គណនាហានិភ័យលទ្ធផលសាកល្បង (សម្រាប់មើលប៉ុណ្ណោះ)',
    simBadge: 'សាកល្បងប៉ុណ្ណោះ — មិនប៉ះពាល់ការចេញលទ្ធផលផ្លូវការទេ',
    simExplain: 'តួលេខទាំងនេះបង្ហាញពីផលប៉ះពាល់ហិរញ្ញវត្ថុប្រសិនបើលេខដែលបានបញ្ចូលចេញ។ នេះគ្រាន់តែជាការសាកល្បងប៉ុណ្ណោះ។',
    simTotalStakes: 'ទឹកប្រាក់ភ្នាល់សរុប',
    simTotalPayout: 'ប្រាក់សងសរុបសាកល្បង',
    simProfitLoss: 'ចំណេញ / ខាតរបស់ម្ចាស់',
    tableTitle: 'តារាងហានិភ័យលេខលម្អិត (01–99)',
    allChannels: 'គ្រប់ប៉ុស្តិ៍',
    channelPrefix: 'ប៉ុស្តិ៍',
    viewWithBets: 'លេខដែលមានអ្នកចាក់',
    viewAll: 'លេខទាំងអស់ (495)',
    searchPlaceholder: 'ស្វែងរក 01–99...',
    rowsLabel: 'ជួរ',
    impactNote: 'ផលប៉ះពាល់តាមប៉ុស្តិ៍ = ភ្នាល់សរុបទាំងជុំ − ប្រាក់សងប៉ុស្តិ៍នោះ (សម្រាប់តែ 1 ប៉ុស្តិ៍ មិនមែនចំណេញទាំងជុំទេ)',
    pageOf: 'ទំព័រ {page} នៃ {total}',
  },
} as const;

export const DRAFT_TEXT = {
  en: {
    title: 'NEXT ROUND RESULT DRAFT',
    subtitle: 'Prepare draft numbers (01–99) for the upcoming round before betting opens. Does NOT publish or auto-apply to draws.',
    targetRound: 'Target Round ID',
    nextRoundLabel: 'Next Round',
    draftStatus: 'Draft Status',
    lastSaved: 'Last Saved Time',
    statusNone: 'No Draft Saved',
    statusSaved: 'Saved (Upcoming Round)',
    statusLocked: 'Locked — Betting Already Open',
    saveDraft: 'Save Draft',
    editDraft: 'Edit Draft',
    clearDraft: 'Clear Draft',
    savedMsg: 'Draft saved for upcoming round {round}. Official results are unchanged.',
    clearedMsg: 'Draft cleared.',
    invalidMsg: 'Please enter valid two-digit numbers from 01 to 99 for all channels A–E.',
    lockedMsg: 'Betting has already opened for round {round}. Draft editing is locked.',
    storageNote: 'Stored locally in this Admin browser (server-side D1 draft sync requires backend endpoint approval).',
  },
  km: {
    title: 'សេចក្តីព្រាងលទ្ធផលជុំបន្ទាប់',
    subtitle: 'រៀបចំលេខព្រាង (01–99) សម្រាប់ជុំបន្ទាប់មុនពេលបើកភ្នាល់។ មិនផ្សាយ និងមិនអនុវត្តដោយស្វ័យប្រវត្តិទៅលើការចាប់រង្វាន់ទេ។',
    targetRound: 'លេខជុំគោលដៅ',
    nextRoundLabel: 'ជុំបន្ទាប់',
    draftStatus: 'ស្ថានភាពសេចក្តីព្រាង',
    lastSaved: 'ម៉ោងរក្សាទុកចុងក្រោយ',
    statusNone: 'មិនទាន់មានសេចក្តីព្រាង',
    statusSaved: 'បានរក្សាទុក (ជុំបន្ទាប់)',
    statusLocked: 'ជាប់សោ — ជុំនេះបានបើកភ្នាល់ហើយ',
    saveDraft: 'រក្សាទុកសេចក្តីព្រាង',
    editDraft: 'កែសម្រួលសេចក្តីព្រាង',
    clearDraft: 'សម្អាតសេចក្តីព្រាង',
    savedMsg: 'បានរក្សាទុកសេចក្តីព្រាងសម្រាប់ជុំបន្ទាប់ {round}។ លទ្ធផលផ្លូវការមិនត្រូវបានកែប្រែទេ។',
    clearedMsg: 'បានសម្អាតសេចក្តីព្រាង។',
    invalidMsg: 'សូមបញ្ចូលលេខពី 01 ដល់ 99 ឱ្យបានត្រឹមត្រូវសម្រាប់គ្រប់ប៉ុស្តិ៍ A–E។',
    lockedMsg: 'ជុំ {round} បានបើកភ្នាល់ហើយ។ មិនអាចកែសម្រួលសេចក្តីព្រាងបានទេ។',
    storageNote: 'រក្សាទុកក្នុងកម្មវិធី Admin នេះ (ការរក្សាទុកលើ Server D1 ត្រូវការការអនុញ្ញាតបន្ថែម)។',
  },
} as const;
