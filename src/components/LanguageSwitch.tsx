import type { LocaleCode } from '../types';

type LanguageSwitchProps = {
  value: LocaleCode;
  onChange: (locale: LocaleCode) => void;
  compact?: boolean;
};

const shortLabels: Record<LocaleCode, string> = {
  en: 'EN',
  gr: 'ΕΛ',
};

export function LanguageSwitch({ value, onChange, compact }: LanguageSwitchProps) {
  const nextLocale: LocaleCode = value === 'en' ? 'gr' : 'en';
  const baseClass = compact ? 'text-xs' : 'text-sm shadow-sm';

  return (
    <button
      type="button"
      onClick={() => onChange(nextLocale)}
      className={`inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-3 py-1 font-semibold text-gray-700 hover:bg-gray-100 transition-colors ${baseClass}`}
      aria-label="Toggle language"
    >
      <span className="tracking-wide">{shortLabels[value]}</span>
      <span className="text-gray-400">/</span>
      <span className="tracking-wide">{shortLabels[nextLocale]}</span>
    </button>
  );
}
