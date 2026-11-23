import { Volume2 } from 'lucide-react';
import {
  isVoiceSupported,
  speakText,
  useBrowserVoices,
  VoiceSelection,
} from '../utils/speechUtils';
import { t } from '../i18n';

interface SpeakButtonProps {
  text: string;
  langCode: string;
  muted?: boolean;
  voice?: VoiceSelection | null;
  className?: string;
  iconClassName?: string;
  label?: string;
}

/**
 * Subtle speaker button that pronounces `text` via the Web Speech API.
 * Renders nothing when muted or when there is no text to speak. When the
 * browser has no native voice for the language (and none was bound in
 * settings), the button renders disabled with an explanatory tooltip.
 */
export function SpeakButton({
  text,
  langCode,
  muted = false,
  voice,
  className = '',
  iconClassName = 'w-4 h-4',
  label,
}: SpeakButtonProps) {
  const voices = useBrowserVoices();
  if (muted || !text.trim()) return null;

  const supported = isVoiceSupported(langCode, voice, voices);

  if (!supported) {
    return (
      <span
        role="img"
        aria-label={t('Voice not supported for this language')}
        title={t('Voice not supported for this language')}
        className={`inline-flex items-center justify-center p-1.5 rounded-lg text-[#C9C2B8] dark:text-[#4A453E] cursor-not-allowed ${className}`}
      >
        <Volume2 className={`${iconClassName} opacity-50`} />
      </span>
    );
  }

  return (
    <button
      type="button"
      aria-label={label ?? `Pronounce: ${text}`}
      title={t('Pronounce')}
      onClick={(e) => {
        e.stopPropagation();
        speakText(text, langCode, voice);
      }}
      className={`inline-flex items-center justify-center p-1.5 rounded-lg text-[#78716C] dark:text-[#A8A29E] hover:text-[#B45309] dark:hover:text-[#F59E0B] hover:bg-[#F3EFE8] dark:hover:bg-[#25221E] transition-colors ${className}`}
    >
      <Volume2 className={iconClassName} />
    </button>
  );
}
