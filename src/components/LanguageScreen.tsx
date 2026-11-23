import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, DatabaseBackup, Download, FileUp, MicOff, Pencil, Pin, PinOff, Play, Plus, Trash2, Upload, Volume2, X } from 'lucide-react';
import { Deck, LanguageItem, VocabCard } from '../types';
import {
  findVoiceForLanguage,
  isVoiceSupported,
  speakText,
  stopSpeaking,
  useBrowserVoices,
  VoiceSelection,
} from '../utils/speechUtils';
import { parseBackupJson } from '../utils/storage';
import { Modal } from './Modal';
import { pluralize, t } from '../i18n';

interface LanguageScreenProps {
  languages: LanguageItem[];
  decks: Deck[];
  cards: VocabCard[];
  onSelectLanguage: (languageId: string) => void;
  onAddCustomLanguage: (data: {
    name: string;
    nativeLabel: string;
    code: string;
    voiceName?: string;
    voiceLang?: string;
    voiceDisabled?: boolean;
  }) => Promise<LanguageItem>;
  onUpdateLanguage: (
    languageId: string,
    updates: Partial<{
      name: string;
      nativeLabel: string;
      code: string;
      voiceName?: string;
      voiceLang?: string;
      voiceDisabled?: boolean;
      pinned?: boolean;
    }>
  ) => Promise<void>;
  onDeleteLanguage: (languageId: string) => Promise<void>;
  onExportBackup: () => void;
  onImportBackup: (rawText: string, mode: 'merge' | 'replace') => Promise<void>;
}

export function LanguageScreen({
  languages,
  decks,
  cards,
  onSelectLanguage,
  onAddCustomLanguage,
  onUpdateLanguage,
  onDeleteLanguage,
  onExportBackup,
  onImportBackup,
}: LanguageScreenProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customNative, setCustomNative] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [codeEditedManually, setCodeEditedManually] = useState(false);
  const [customVoice, setCustomVoice] = useState<string>('auto');
  const [voiceEditedManually, setVoiceEditedManually] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<LanguageItem | null>(null);
  // Keep the last confirmed target so the exit animation still has content
  const lastConfirmDelete = useRef<LanguageItem | null>(null);
  if (confirmDelete) lastConfirmDelete.current = confirmDelete;

  const backupFileRef = useRef<HTMLInputElement | null>(null);
  const [importState, setImportState] = useState<
    | { status: 'ready'; rawText: string; counts: { languages: number; decks: number; cards: number } }
    | { status: 'error'; message: string }
    | null
  >(null);
  const [importing, setImporting] = useState(false);

  const handleBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      try {
        const payload = parseBackupJson(text);
        setImportState({
          status: 'ready',
          rawText: text,
          counts: {
            languages: payload.languages.length,
            decks: payload.decks.length,
            cards: payload.cards.length,
          },
        });
      } catch (err) {
        setImportState({
          status: 'error',
          message: err instanceof Error ? err.message : t('Could not read this backup file.'),
        });
      }
    };
    reader.readAsText(file);
  };

  const handleImportChoice = async (mode: 'merge' | 'replace') => {
    if (importState?.status !== 'ready') return;
    setImporting(true);
    try {
      await onImportBackup(importState.rawText, mode);
      setImportState(null);
    } catch (err) {
      setImportState({
        status: 'error',
        message: err instanceof Error ? err.message : t('Restore failed.'),
      });
    } finally {
      setImporting(false);
    }
  };

  const browserVoices = useBrowserVoices();

  const languageDisplayNames = useMemo(() => {
    try {
      return new Intl.DisplayNames([navigator.language || 'en'], {
        type: 'language',
      });
    } catch {
      return null;
    }
  }, []);

  const voiceLanguageName = (tag: string): string => {
    try {
      return languageDisplayNames?.of(tag.split(/[-_]/)[0]) ?? tag;
    } catch {
      return tag;
    }
  };

  // Group browser voices by their BCP-47 language tag for the dropdown
  const voiceGroups = useMemo(() => {
    const map = new Map<string, SpeechSynthesisVoice[]>();
    for (const v of browserVoices) {
      const list = map.get(v.lang) ?? [];
      list.push(v);
      map.set(v.lang, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [browserVoices]);

  const voiceKey = (v: SpeechSynthesisVoice) => JSON.stringify([v.name, v.lang]);

  // Smart auto-match: bind a voice only when a genuine native match exists
  const effectiveCode = () =>
    (customCode.trim().toUpperCase().slice(0, 3) ||
      customName.trim().slice(0, 2).toUpperCase()) ??
    '';

  useEffect(() => {
    if (!modalOpen || voiceEditedManually) return;
    const code = effectiveCode();
    if (!code) {
      setCustomVoice('auto');
      return;
    }
    const match = findVoiceForLanguage(browserVoices, code);
    setCustomVoice(match ? voiceKey(match) : 'auto');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen, customCode, customName, browserVoices, voiceEditedManually]);

  const selectedVoiceInfo = useMemo(() => {
    if (customVoice === 'auto' || customVoice === 'none') return null;
    try {
      const [name, lang] = JSON.parse(customVoice) as [string, string];
      return { name, lang };
    } catch {
      return null;
    }
  }, [customVoice]);

  const matchedNativeVoice = useMemo(() => {
    const code = effectiveCode();
    return code ? findVoiceForLanguage(browserVoices, code) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [browserVoices, customCode, customName, modalOpen]);

  const resetFormState = () => {
    setCustomName('');
    setCustomNative('');
    setCustomCode('');
    setCodeEditedManually(false);
    setCustomVoice('auto');
    setVoiceEditedManually(false);
  };

  const openAddModal = () => {
    resetFormState();
    setEditingId(null);
    setModalOpen(true);
  };

  const openEditModal = (lang: LanguageItem) => {
    resetFormState();
    setCustomName(lang.name);
    setCustomNative(lang.nativeLabel);
    setCustomCode(lang.code);
    setCodeEditedManually(true);
    if (lang.voiceDisabled) {
      setCustomVoice('none');
      setVoiceEditedManually(true);
    } else if (lang.voiceName) {
      const stored = browserVoices.find(
        (v) => v.name === lang.voiceName && (!lang.voiceLang || v.lang === lang.voiceLang)
      );
      setCustomVoice(stored ? voiceKey(stored) : JSON.stringify([lang.voiceName, lang.voiceLang ?? '']));
      setVoiceEditedManually(true);
    } else {
      setCustomVoice('auto');
      setVoiceEditedManually(false);
    }
    setEditingId(lang.id);
    setModalOpen(true);
  };

  // Pinned languages always sort first; stable order otherwise
  const sortedLanguages = useMemo(
    () =>
      [...languages].sort(
        (a, b) => Number(b.pinned ?? false) - Number(a.pinned ?? false)
      ),
    [languages]
  );

  const handleNameChange = (value: string) => {
    setCustomName(value);
    if (!codeEditedManually) {
      const cleaned = value.replace(/[^a-zA-Z\p{L}]/gu, '').slice(0, 2).toUpperCase();
      setCustomCode(cleaned);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = customName.trim();
    if (!trimmedName) return;

    const finalCode =
      customCode.trim().toUpperCase().slice(0, 3) ||
      trimmedName.slice(0, 2).toUpperCase();

    const voiceFields = {
      voiceName:
        customVoice !== 'auto' && customVoice !== 'none'
          ? selectedVoiceInfo?.name
          : undefined,
      voiceLang:
        customVoice !== 'auto' && customVoice !== 'none'
          ? selectedVoiceInfo?.lang || undefined
          : undefined,
      voiceDisabled: customVoice === 'none' ? true : undefined,
    };

    if (editingId) {
      await onUpdateLanguage(editingId, {
        name: trimmedName,
        nativeLabel: customNative.trim() || trimmedName,
        code: finalCode,
        ...voiceFields,
      });
    } else {
      await onAddCustomLanguage({
        name: trimmedName,
        nativeLabel: customNative.trim() || trimmedName,
        code: finalCode,
        ...voiceFields,
      });
    }
    setModalOpen(false);
    setEditingId(null);
  };

  return (
    <div className="max-w-4xl mx-auto py-6 sm:py-12 space-y-8">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-[#1C1917] dark:text-[#F5F2EC]">
            {t('Select a Language')}
          </h1>
          <p className="text-sm sm:text-base text-[#57534E] dark:text-[#A8A29E]">
            {t('Open a language workspace or add a custom language to start building decks.')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedLanguages.map((lang) => {
          const langDecks = decks.filter((d) => d.languageId === lang.id);
          const langDeckIds = new Set(langDecks.map((d) => d.id));
          const langWordCount = cards.filter((c) => langDeckIds.has(c.deckId)).length;
          const voiceSel: VoiceSelection = {
            name: lang.voiceName,
            lang: lang.voiceLang,
            disabled: lang.voiceDisabled,
          };
          const supported = isVoiceSupported(lang.code, voiceSel, browserVoices);

          return (
            <div
              key={lang.id}
              onClick={() => onSelectLanguage(lang.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectLanguage(lang.id);
                }
              }}
              role="button"
              tabIndex={0}
              className="group relative text-left bg-white dark:bg-[#1C1A17] border border-slate-200 dark:border-[#2E2A25] hover:border-[#B45309] dark:hover:border-[#D97706] rounded-2xl p-5 flex flex-col justify-between min-h-[156px] cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B45309]"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-[#FAF8F5] dark:bg-[#121110] border border-slate-200 dark:border-[#2E2A25] font-mono text-sm font-semibold text-[#1C1917] dark:text-[#F5F2EC] group-hover:border-[#B45309]/40 group-hover:text-[#B45309] dark:group-hover:text-[#F59E0B] transition-colors relative">
                  {lang.code}
                  {lang.pinned && (
                    <Pin className="absolute -top-1.5 -right-1.5 w-3 h-3 text-[#B45309] dark:text-[#F59E0B] fill-current" />
                  )}
                </span>

                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      await onUpdateLanguage(lang.id, { pinned: !lang.pinned });
                    }}
                    aria-label={lang.pinned ? `Unpin ${lang.name}` : `Pin ${lang.name}`}
                    title={lang.pinned ? t('Unpin language') : t('Pin to top')}
                    className={`p-1.5 rounded-md transition-colors ${
                      lang.pinned
                        ? 'text-[#B45309] dark:text-[#F59E0B] hover:bg-amber-50 dark:hover:bg-amber-950/30'
                        : 'text-[#A8A29E] hover:text-[#1C1917] dark:hover:text-[#F5F2EC] hover:bg-[#F3EFE8] dark:hover:bg-[#25221E]'
                    }`}
                  >
                    {lang.pinned ? (
                      <PinOff className="w-3.5 h-3.5" />
                    ) : (
                      <Pin className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditModal(lang);
                    }}
                    aria-label={t('Edit {name}', { name: lang.name })}
                    title={t('Edit {name}', { name: lang.name })}
                    className="p-1.5 rounded-md text-[#A8A29E] hover:text-[#1C1917] dark:hover:text-[#F5F2EC] hover:bg-[#F3EFE8] dark:hover:bg-[#25221E] transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDelete(lang);
                    }}
                    aria-label={t('Delete {name}', { name: lang.name })}
                    title={t('Delete {name}', { name: lang.name })}
                    className="p-1.5 rounded-md text-[#A8A29E] hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <ArrowRight className="w-4 h-4 text-[#A8A29E] group-hover:text-[#B45309] dark:group-hover:text-[#F59E0B] transition-transform duration-200 group-hover:translate-x-0.5 ml-0.5" />
                </div>
              </div>

              <div className="pt-5 space-y-1">
                <h2 className="font-display text-xl font-semibold text-[#1C1917] dark:text-[#F5F2EC]">
                  {lang.name}
                </h2>
                <div className="text-xs text-[#78716C] dark:text-[#A8A29E] truncate">
                  {lang.nativeLabel}
                </div>
                <div className="pt-1.5 text-xs font-medium text-[#57534E] dark:text-[#A8A29E] tabular-nums">
                  {langWordCount} {langWordCount === 1 ? 'word' : 'words'} · {langDecks.length}{' '}
                  {langDecks.length === 1 ? 'deck' : 'decks'}
                </div>
                <div className="pt-1">
                  {lang.voiceDisabled ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-[#78716C] dark:text-[#A8A29E]">
                      <MicOff className="w-3 h-3" />
                      {t('Voice off')}
                    </span>
                  ) : !supported ? (
                    <span
                      className="inline-flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400"
                      title={t('No native browser voice found for this language — pronunciation is disabled')}
                    >
                      <Volume2 className="w-3 h-3" />
                      {t('No browser voice')}
                    </span>
                  ) : lang.voiceName ? (
                    <span
                      className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400"
                      title={t('Using voice: {voice}', { voice: lang.voiceName })}
                    >
                      <Volume2 className="w-3 h-3" />
                      {t('Voice set')}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}

        {/* + Custom Language Card */}
        <button
          type="button"
          onClick={openAddModal}
          className="group text-left bg-[#FAF8F5] dark:bg-[#171513] border border-dashed border-slate-300 dark:border-[#3A352F] hover:border-[#B45309] dark:hover:border-[#D97706] rounded-2xl p-5 flex flex-col justify-between min-h-[156px] transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B45309]"
        >
          <div className="w-11 h-11 rounded-xl bg-white dark:bg-[#1C1A17] border border-dashed border-slate-300 dark:border-[#3A352F] group-hover:border-[#B45309] flex items-center justify-center text-[#57534E] dark:text-[#A8A29E] group-hover:text-[#B45309] dark:group-hover:text-[#F59E0B] transition-colors">
            <Plus className="w-5 h-5" />
          </div>

          <div className="pt-5 space-y-1">
            <h2 className="font-display text-xl font-semibold text-[#1C1917] dark:text-[#F5F2EC]">
              {t('+ Custom Language')}
            </h2>
            <p className="text-xs text-[#57534E] dark:text-[#A8A29E]">
              {t('Add French, Japanese, Italian, or any language you want to study.')}
            </p>
          </div>
        </button>
      </div>

      {/* Data & Backup */}
      <section className="rounded-2xl border border-slate-200 dark:border-[#2E2A25] bg-white dark:bg-[#1C1A17] p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <span className="p-2 rounded-lg bg-[#FAF8F5] dark:bg-[#121110] border border-slate-200 dark:border-[#2E2A25] text-[#B45309] dark:text-[#F59E0B] shrink-0">
              <DatabaseBackup className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-[#1C1917] dark:text-[#F5F2EC]">
                Data &amp; Backup
              </h2>
              <p className="text-xs text-[#78716C] dark:text-[#A8A29E] mt-0.5 leading-relaxed">
                {t('Your progress lives only in this browser. Export a full backup of all languages, decks, words, stats, and activity — then restore it here on this or another device.')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onExportBackup}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#1C1917] dark:bg-[#F5F2EC] text-white dark:text-[#121110] text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              <Download className="w-3.5 h-3.5" />
              {t('Export All Data')}
            </button>
            <button
              type="button"
              onClick={() => backupFileRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-[#2E2A25] bg-[#FAF8F5] dark:bg-[#121110] text-xs font-medium text-[#1C1917] dark:text-[#F5F2EC] hover:border-[#B45309] dark:hover:border-[#D97706] transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              {t('Restore Backup')}
            </button>
            <input
              ref={backupFileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleBackupFile}
            />
          </div>
        </div>
      </section>

      {/* Add / Edit Language Modal */}
      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingId(null);
        }}
        ariaLabel={editingId ? t('Edit Language') : t('Add Custom Language')}
        panelClassName="max-w-md p-6"
      >
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#2E2A25]">
                <h2 className="font-display text-xl font-semibold text-[#1C1917] dark:text-[#F5F2EC]">
                  {editingId ? t('Edit Language') : t('Add Custom Language')}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                    setEditingId(null);
                  }}
                  aria-label={t('Close modal')}
                  className="p-1.5 rounded-md text-[#78716C] hover:text-[#1C1917] dark:hover:text-[#F5F2EC]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#57534E] dark:text-[#A8A29E] mb-1.5">
                  {t('Language Name')}
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={customName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder={t('e.g., Japanese, French, Azerbaijani')}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#FAF8F5] dark:bg-[#121110] border border-slate-200 dark:border-[#2E2A25] text-sm text-[#1C1917] dark:text-[#F5F2EC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B45309]"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-xs font-medium text-[#57534E] dark:text-[#A8A29E] mb-1.5">
                    {t('Code Badge')}
                  </label>
                  <input
                    type="text"
                    maxLength={3}
                    value={customCode}
                    onChange={(e) => {
                      setCodeEditedManually(true);
                      setCustomCode(e.target.value.toUpperCase());
                    }}
                    placeholder="JP"
                    className="w-full px-3 py-2.5 rounded-lg bg-[#FAF8F5] dark:bg-[#121110] border border-slate-200 dark:border-[#2E2A25] text-sm font-mono uppercase text-[#1C1917] dark:text-[#F5F2EC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B45309]"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-[#57534E] dark:text-[#A8A29E] mb-1.5">
                    Native Label (optional)
                  </label>
                  <input
                    type="text"
                    value={customNative}
                    onChange={(e) => setCustomNative(e.target.value)}
                    placeholder={t('e.g., 日本語, Français')}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#FAF8F5] dark:bg-[#121110] border border-slate-200 dark:border-[#2E2A25] text-sm text-[#1C1917] dark:text-[#F5F2EC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B45309]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#57534E] dark:text-[#A8A29E] mb-1.5">
                  {t('Pronunciation Voice')}
                </label>
                <div className="flex items-stretch gap-2">
                  <select
                    value={customVoice}
                    onChange={(e) => {
                      setVoiceEditedManually(true);
                      setCustomVoice(e.target.value);
                    }}
                    className="flex-1 min-w-0 px-3.5 py-2.5 rounded-lg bg-[#FAF8F5] dark:bg-[#121110] border border-slate-200 dark:border-[#2E2A25] text-sm text-[#1C1917] dark:text-[#F5F2EC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B45309]"
                  >
                  <option value="auto">{t('Auto-detect best match')}</option>
                  <option value="none">{t('None / Disable Voice')}</option>
                  {voiceGroups.map(([tag, voices]) => (
                    <optgroup
                      key={tag}
                      label={`${voiceLanguageName(tag)} (${tag})`}
                    >
                      {voices.map((v) => (
                        <option key={voiceKey(v)} value={voiceKey(v)}>
                          {v.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                  {selectedVoiceInfo &&
                    !browserVoices.some(
                      (v) => v.name === selectedVoiceInfo.name && v.lang === selectedVoiceInfo.lang
                    ) && (
                      <option value={customVoice}>
                        {selectedVoiceInfo.name} ({selectedVoiceInfo.lang || 'stored'}) — unavailable
                      </option>
                    )}
                  </select>
                  <button
                    type="button"
                    disabled={customVoice === 'none'}
                    onClick={() => {
                      stopSpeaking();
                      const sample =
                        customNative.trim() || customName.trim() || t('Hello');
                      speakText(
                        sample,
                        effectiveCode() || 'EN',
                        customVoice === 'auto'
                          ? null
                          : selectedVoiceInfo
                            ? { name: selectedVoiceInfo.name, lang: selectedVoiceInfo.lang }
                            : { disabled: true }
                      );
                    }}
                    aria-label={t('Preview selected voice')}
                    title={
                      customVoice === 'none'
                        ? t('Voice is disabled')
                        : t('Preview voice')
                    }
                    className="shrink-0 inline-flex items-center justify-center w-10 rounded-lg border border-slate-200 dark:border-[#2E2A25] bg-[#FAF8F5] dark:bg-[#121110] text-[#57534E] dark:text-[#A8A29E] hover:text-[#B45309] dark:hover:text-[#F59E0B] hover:border-[#B45309]/50 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                </div>
                <p className="mt-1.5 text-[11px] text-[#78716C] dark:text-[#A8A29E] leading-relaxed">
                  {customVoice === 'none'
                    ? t('Pronunciation will be disabled for this language.')
                    : customVoice === 'auto'
                      ? matchedNativeVoice
                        ? `Auto-match found: ${matchedNativeVoice.name} (${matchedNativeVoice.lang})`
                        : browserVoices.length === 0
                          ? t('Loading available voices…')
                          : `No native browser voice found for ${effectiveCode() || 'this language'} — pronunciation will be unavailable.`
                      : selectedVoiceInfo
                        ? `Selected: ${selectedVoiceInfo.name} (${selectedVoiceInfo.lang})`
                        : ''}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                    setEditingId(null);
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-[#57534E] dark:text-[#A8A29E] hover:bg-[#F3EFE8] dark:hover:bg-[#25221E]"
                >
                  {t('Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={!customName.trim()}
                  className="px-4 py-2 rounded-lg bg-[#B45309] hover:bg-[#92400E] text-white text-sm font-medium transition-colors disabled:opacity-40"
                >
                  {editingId ? t('Save Changes') : t('Add Language')}
                </button>
              </div>
            </form>
      </Modal>

      {/* Delete Language Confirmation Modal */}
      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        panelClassName="max-w-sm p-6 space-y-4"
      >
        {lastConfirmDelete.current && (
          <>
            <div className="space-y-1.5">
              <h2 className="font-display text-xl font-semibold text-[#1C1917] dark:text-[#F5F2EC]">
                {t('Delete {name}', { name: lastConfirmDelete.current.name })}?
              </h2>
              <p className="text-sm text-[#57534E] dark:text-[#A8A29E] leading-relaxed">
                {(() => {
                  const n = decks.filter((d) => d.languageId === lastConfirmDelete.current!.id).length;
                  return t('This permanently removes the language along with its {count} {decks} and all associated words. This cannot be undone.', {
                    count: n,
                    decks: pluralize(n, 'deck', 'decks'),
                  });
                })()}
              </p>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-[#57534E] dark:text-[#A8A29E] hover:bg-[#F3EFE8] dark:hover:bg-[#25221E]"
              >
                {t('Cancel')}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = lastConfirmDelete.current!.id;
                  setConfirmDelete(null);
                  await onDeleteLanguage(id);
                }}
                className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white text-sm font-medium transition-colors"
              >
                {t('Delete Language')}
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* Restore Backup Modal */}
      <Modal
        open={importState !== null}
        onClose={() => !importing && setImportState(null)}
        ariaLabel={t('Restore backup')}
        panelClassName="max-w-md p-6 space-y-4"
      >
        {importState?.status === 'error' ? (
          <>
            <div className="space-y-1.5">
              <h2 className="font-display text-xl font-semibold text-[#1C1917] dark:text-[#F5F2EC]">
                {t('Invalid Backup File')}
              </h2>
              <p className="text-sm text-[#57534E] dark:text-[#A8A29E] leading-relaxed">
                {importState.message}
              </p>
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setImportState(null)}
                className="px-4 py-2 rounded-lg bg-[#1C1917] dark:bg-[#F5F2EC] text-white dark:text-[#121110] text-sm font-medium"
              >
                {t('Close')}
              </button>
            </div>
          </>
        ) : importState?.status === 'ready' ? (
          <>
            <div className="space-y-1.5">
              <h2 className="font-display text-xl font-semibold text-[#1C1917] dark:text-[#F5F2EC] flex items-center gap-2">
                <FileUp className="w-5 h-5 text-[#B45309] dark:text-[#F59E0B]" />
                {t('Restore Backup')}
              </h2>
              <p className="text-sm text-[#57534E] dark:text-[#A8A29E] leading-relaxed">
                This backup contains{' '}
                <span className="font-medium text-[#1C1917] dark:text-[#F5F2EC]">
                  {importState.counts.languages} languages, {importState.counts.decks}{' '}
                  decks, and {importState.counts.cards} words
                </span>
                {t(', plus study stats and activity.')}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2.5 pt-1">
              <button
                type="button"
                disabled={importing}
                onClick={() => handleImportChoice('merge')}
                className="w-full text-left px-4 py-3 rounded-xl border border-slate-200 dark:border-[#2E2A25] hover:border-[#B45309] dark:hover:border-[#D97706] bg-[#FAF8F5] dark:bg-[#121110] transition-colors disabled:opacity-50"
              >
                <span className="block text-sm font-semibold text-[#1C1917] dark:text-[#F5F2EC]">
                  {t('Merge into current data')}
                </span>
                <span className="block text-xs text-[#78716C] dark:text-[#A8A29E] mt-0.5 leading-relaxed">
                  {t('Add backup records alongside existing ones. Matching IDs are updated; nothing is deleted.')}
                </span>
              </button>
              <button
                type="button"
                disabled={importing}
                onClick={() => handleImportChoice('replace')}
                className="w-full text-left px-4 py-3 rounded-xl border border-red-200 dark:border-red-900/60 hover:border-red-400 bg-red-50/60 dark:bg-red-950/20 transition-colors disabled:opacity-50"
              >
                <span className="block text-sm font-semibold text-red-800 dark:text-red-300">
                  {t('Replace all current data')}
                </span>
                <span className="block text-xs text-red-700/80 dark:text-red-300/70 mt-0.5 leading-relaxed">
                  {t('Permanently clear this workspace, then restore the backup. Export a backup first if unsure.')}
                </span>
              </button>
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="button"
                disabled={importing}
                onClick={() => setImportState(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-[#57534E] dark:text-[#A8A29E] hover:bg-[#F3EFE8] dark:hover:bg-[#25221E]"
              >
                {t('Cancel')}
              </button>
            </div>
          </>
        ) : null}
      </Modal>
    </div>
  );
}
