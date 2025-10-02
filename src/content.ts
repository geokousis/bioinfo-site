import type { LocaleCode, SiteContent } from './types';
import generatedContent from './data/generatedContent';

export const STORAGE_KEY = 'bioifo_site_content_v2';
export const localeLabels: Record<LocaleCode, string> = {
  en: 'English',
  gr: 'Ελληνικά',
};

export const initialContent: SiteContent = generatedContent as SiteContent;
