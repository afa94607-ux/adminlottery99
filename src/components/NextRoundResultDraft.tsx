import React, { useEffect, useState } from 'react';
import { CheckCircle2, Edit3, FileText, Lock, Save, Trash2 } from 'lucide-react';
import { ChannelLetter } from '../types/lottery';
import { CHANNEL_COLORS } from '../utils/formatters';
import { ALL_CHANNELS, normalizeTwoDigitNumber } from '../utils/bettingRisk';
import {
  AdminLang,
  clearSavedNextRoundDraft,
  computeNextRoundId,
  DRAFT_TEXT,
  loadSavedNextRoundDraft,
  NextRoundDraftRecord,
  saveNextRoundDraft,
} from '../utils/adminI18n';

interface NextRoundResultDraftProps {
  currentRoundId: string;
  lang: AdminLang;
  onChangeLang: (lang: AdminLang) => void;
}

export const NextRoundResultDraft: React.FC<NextRoundResultDraftProps> = ({
  currentRoundId,
  lang,
  onChangeLang,
}) => {
  const t = DRAFT_TEXT[lang];
  const nextRoundId = computeNextRoundId(currentRoundId);

  const [savedDraft, setSavedDraft] = useState<NextRoundDraftRecord | null>(() =>
    loadSavedNextRoundDraft()
  );
  const [inputs, setInputs] = useState<Record<ChannelLetter, string>>(() => {
    const existing = loadSavedNextRoundDraft();
    return existing?.numbers || { A: '', B: '', C: '', D: '', E: '' };
  });
  const [isEditing, setIsEditing] = useState<boolean>(() => !loadSavedNextRoundDraft());
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Re-sync from storage on mount / round change
  useEffect(() => {
    const existing = loadSavedNextRoundDraft();
    setSavedDraft(existing);
    if (existing) {
      setInputs(existing.numbers);
      setIsEditing(false);
    }
  }, [currentRoundId]);

  const effectiveTargetRoundId = savedDraft?.targetRoundId || nextRoundId;
  // Lock edits if the saved draft's round has already opened for betting (equals currentRoundId)
  const isLockedForActiveRound = Boolean(savedDraft && savedDraft.targetRoundId === currentRoundId);

  const handleSaveDraft = () => {
    setNotice(null);
    if (isLockedForActiveRound) {
      setNotice({ type: 'err', text: t.lockedMsg.replace('{round}', currentRoundId) });
      return;
    }

    const normalized: Record<ChannelLetter, string> = {
      A: normalizeTwoDigitNumber(inputs.A) || '',
      B: normalizeTwoDigitNumber(inputs.B) || '',
      C: normalizeTwoDigitNumber(inputs.C) || '',
      D: normalizeTwoDigitNumber(inputs.D) || '',
      E: normalizeTwoDigitNumber(inputs.E) || '',
    };

    if (ALL_CHANNELS.some((ch) => !normalized[ch])) {
      setNotice({ type: 'err', text: t.invalidMsg });
      return;
    }

    const record: NextRoundDraftRecord = {
      targetRoundId: nextRoundId,
      numbers: normalized,
      savedAt: Date.now(),
      status: 'SAVED',
    };
    saveNextRoundDraft(record);
    setSavedDraft(record);
    setInputs(normalized);
    setIsEditing(false);
    setNotice({ type: 'ok', text: t.savedMsg.replace('{round}', nextRoundId) });
  };

  const handleClearDraft = () => {
    clearSavedNextRoundDraft();
    setSavedDraft(null);
    setInputs({ A: '', B: '', C: '', D: '', E: '' });
    setIsEditing(true);
    setNotice({ type: 'ok', text: t.clearedMsg });
  };

  const statusLabel = isLockedForActiveRound
    ? t.statusLocked
    : savedDraft
    ? t.statusSaved
    : t.statusNone;

  return (
    <div
      className="bg-slate-800/80 border border-cyan-500/30 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4"
      data-testid="next-round-result-draft"
    >
      {/* Header + Language Switch */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-700/80">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              <FileText className="w-5 h-5" />
            </span>
            <h3 className="text-base sm:text-lg font-black text-white">{t.title}</h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              {t.nextRoundLabel}: {effectiveTargetRoundId}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">{t.subtitle}</p>
        </div>

        <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-xl p-1 self-start sm:self-auto">
          {(['en', 'km'] as const).map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => onChangeLang(code)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                lang === code
                  ? 'bg-cyan-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {code === 'en' ? 'EN' : 'ខ្មែរ'}
            </button>
          ))}
        </div>
      </div>

      {/* Metadata Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="bg-slate-900/80 border border-slate-700/70 rounded-xl p-3">
          <div className="text-slate-400 font-semibold">{t.targetRound}</div>
          <div className="font-mono font-black text-sm text-cyan-300 mt-0.5">
            {effectiveTargetRoundId}
          </div>
        </div>
        <div className="bg-slate-900/80 border border-slate-700/70 rounded-xl p-3">
          <div className="text-slate-400 font-semibold">{t.draftStatus}</div>
          <div
            className={`font-bold text-sm mt-0.5 flex items-center gap-1.5 ${
              isLockedForActiveRound
                ? 'text-amber-300'
                : savedDraft
                ? 'text-emerald-400'
                : 'text-slate-400'
            }`}
          >
            {isLockedForActiveRound && <Lock className="w-3.5 h-3.5" />}
            {savedDraft && !isLockedForActiveRound && <CheckCircle2 className="w-3.5 h-3.5" />}
            <span>{statusLabel}</span>
          </div>
        </div>
        <div className="bg-slate-900/80 border border-slate-700/70 rounded-xl p-3">
          <div className="text-slate-400 font-semibold">{t.lastSaved}</div>
          <div className="font-mono font-bold text-sm text-slate-200 mt-0.5">
            {savedDraft
              ? new Date(savedDraft.savedAt).toLocaleString('en-GB', { hour12: false })
              : '—'}
          </div>
        </div>
      </div>

      {/* 5 Draft Inputs A–E */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {ALL_CHANNELS.map((ch) => (
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
              type="text"
              maxLength={2}
              inputMode="numeric"
              aria-label={`Draft Channel ${ch}`}
              disabled={!isEditing || isLockedForActiveRound}
              value={inputs[ch]}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 2);
                setInputs((prev) => ({ ...prev, [ch]: digits }));
              }}
              placeholder="--"
              className="w-16 h-11 text-center text-xl font-black font-mono bg-slate-950 border-2 border-cyan-500/40 rounded-lg text-cyan-300 disabled:opacity-60 focus:outline-none focus:border-cyan-400"
            />
          </div>
        ))}
      </div>

      {notice && (
        <div
          className={`px-3.5 py-2 rounded-xl text-xs font-bold border ${
            notice.type === 'ok'
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* Action Buttons + Storage Notice */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!isEditing || isLockedForActiveRound}
            onClick={handleSaveDraft}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 font-black text-xs sm:text-sm transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>{t.saveDraft}</span>
          </button>

          {savedDraft && !isEditing && !isLockedForActiveRound && (
            <button
              type="button"
              onClick={() => {
                setIsEditing(true);
                setNotice(null);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs sm:text-sm transition-colors"
            >
              <Edit3 className="w-4 h-4" />
              <span>{t.editDraft}</span>
            </button>
          )}

          {savedDraft && (
            <button
              type="button"
              onClick={handleClearDraft}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-900/40 hover:bg-rose-800/60 border border-rose-500/40 text-rose-300 font-bold text-xs sm:text-sm transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>{t.clearDraft}</span>
            </button>
          )}
        </div>

        <span className="text-[11px] text-slate-400">{t.storageNote}</span>
      </div>
    </div>
  );
};
