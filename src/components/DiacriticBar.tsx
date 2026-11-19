import { useState } from 'react';
import { DIACRITIC_PRESETS, getDiacriticsForLang } from '../utils/textUtils';

interface DiacriticBarProps {
  langCode: string;
  onInsert: (char: string) => void;
  disabled?: boolean;
  defaultPresetId?: string;
}

export function DiacriticBar({
  langCode,
  onInsert,
  disabled = false,
  defaultPresetId,
}: DiacriticBarProps) {
  const initialPreset = defaultPresetId
    ? DIACRITIC_PRESETS.find((p) => p.id === defaultPresetId) ?? getDiacriticsForLang(langCode)
    : getDiacriticsForLang(langCode);

  const [selectedPresetId, setSelectedPresetId] = useState<string>(initialPreset.id);
  const [uppercase, setUppercase] = useState(false);

  const activePreset =
    DIACRITIC_PRESETS.find((p) => p.id === selectedPresetId) ?? initialPreset;

  return (
    <div className="flex flex-col gap-2 pt-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-[#57534E] dark:text-[#A8A29E]">
          Quick-insert characters
        </span>
        <div className="flex items-center gap-1.5">
          <select
            aria-label="Character set"
            value={activePreset.id}
            onChange={(e) => setSelectedPresetId(e.target.value)}
            disabled={disabled}
            className="text-xs px-2 py-1 rounded-md bg-[#F3EFE8] dark:bg-[#25221E] border border-[#E6E1D8] dark:border-[#2E2A25] text-[#1C1917] dark:text-[#F5F2EC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B45309]"
          >
            {DIACRITIC_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setUppercase((prev) => !prev)}
            className={`px-2 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 ${
              uppercase
                ? 'bg-[#B45309] text-white border-[#B45309] dark:bg-[#D97706] dark:border-[#D97706]'
                : 'bg-white dark:bg-[#1C1A17] text-[#57534E] dark:text-[#A8A29E] border-[#E6E1D8] dark:border-[#2E2A25] hover:text-[#1C1917] dark:hover:text-[#F5F2EC]'
            }`}
          >
            Shift
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {activePreset.chars.map((char) => {
          const displayChar = uppercase ? char.toUpperCase() : char;
          return (
            <button
              key={char}
              type="button"
              disabled={disabled}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onInsert(displayChar)}
              className="min-w-[38px] h-9 px-2.5 rounded-lg bg-white dark:bg-[#1C1A17] border border-[#E6E1D8] dark:border-[#2E2A25] text-sm font-medium text-[#1C1917] dark:text-[#F5F2EC] hover:border-[#B45309] dark:hover:border-[#D97706] hover:bg-[#FAF8F5] dark:hover:bg-[#25221E] active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none"
            >
              {displayChar}
            </button>
          );
        })}
      </div>
    </div>
  );
}
