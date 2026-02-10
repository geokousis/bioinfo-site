import type { LocaleCode, SiteContent } from '../types';
import { supabase } from './supabaseClient';

const TABLE_NAME = 'site_content';
const STORAGE_BUCKET = 'site-assets';

const ensureSupabase = () => {
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }
  return supabase;
};

const slugifySegment = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'asset';

const fileExtension = (fileName: string) => {
  const match = /\.([a-zA-Z0-9]+)$/.exec(fileName);
  return match ? match[1].toLowerCase() : undefined;
};

const uniqueSuffix = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

type UploadCategory = 'faculty-photo' | 'announcement-attachment' | 'gallery' | 'general';

// Allowed MIME types per category to prevent malicious file uploads
const ALLOWED_MIME_TYPES: Record<UploadCategory, string[]> = {
  'faculty-photo': ['image/jpeg', 'image/png', 'image/webp'],
  'gallery': ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  'announcement-attachment': ['application/pdf'],
  'general': ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
};

// Allowed file extensions (defense in depth)
const ALLOWED_EXTENSIONS: Record<UploadCategory, string[]> = {
  'faculty-photo': ['jpg', 'jpeg', 'png', 'webp'],
  'gallery': ['jpg', 'jpeg', 'png', 'webp', 'gif'],
  'announcement-attachment': ['pdf'],
  'general': ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
};

const validateFileType = (file: File, category: UploadCategory): void => {
  const allowedMimes = ALLOWED_MIME_TYPES[category];
  const allowedExts = ALLOWED_EXTENSIONS[category];
  const ext = fileExtension(file.name);

  if (!allowedMimes.includes(file.type)) {
    throw new Error(
      `Invalid file type "${file.type}". Allowed types for ${category}: ${allowedMimes.join(', ')}`
    );
  }

  if (!ext || !allowedExts.includes(ext)) {
    throw new Error(
      `Invalid file extension ".${ext}". Allowed extensions for ${category}: ${allowedExts.join(', ')}`
    );
  }
};

type UploadSiteAssetOptions = {
  locale: LocaleCode;
  category: UploadCategory;
  identifier?: string;
};

export type UploadSiteAssetResult = {
  publicUrl: string;
  storagePath: string;
};

type SiteContentRow = {
  locale: LocaleCode;
  payload: SiteContent[LocaleCode];
};

type RawRow = {
  locale: string;
  payload: unknown;
};

export type ContentBackup = {
  id: number;
  saved_at: string;
  label: string | null;
  content: SiteContent;
};

export async function fetchSiteContent(): Promise<SiteContent | null> {
  if (!supabase) {
    console.warn('[Supabase] Client not configured, skipping fetch');
    return null;
  }

  console.log('[Supabase] Fetching site content...');

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('locale,payload');

  if (error) {
    console.error('[Supabase] Failed to load site content:', error.message, error.code, error.details);
    return null;
  }

  if (!data || data.length === 0) {
    console.warn('[Supabase] No data returned from site_content table');
    return null;
  }

  console.log('[Supabase] Loaded', data.length, 'locale(s) from database');

  const result: Partial<SiteContent> = {};

  for (const row of data as RawRow[]) {
    const locale = row.locale as LocaleCode;
    const payload = row.payload as SiteContent[LocaleCode];
    result[locale] = payload;
  }

  return result as SiteContent;
}

export async function saveSiteContent(content: SiteContent): Promise<void> {
  const client = ensureSupabase();
  
  // Clean up the content to remove undefined values
  const cleanContent = JSON.parse(JSON.stringify(content));
  
  const rows: SiteContentRow[] = Object.entries(cleanContent).map(([locale, payload]) => ({
    locale: locale as LocaleCode,
    payload: payload as SiteContent[LocaleCode],
  }));

  const { error } = await client.from(TABLE_NAME).upsert(rows, { onConflict: 'locale' });

  if (error) {
    console.error('Supabase save error:', error);
    throw new Error(`Failed to save: ${error.message || 'Unknown error'}`);
  }
}

export async function uploadSiteAsset(
  file: File,
  { locale, category, identifier }: UploadSiteAssetOptions,
): Promise<UploadSiteAssetResult> {
  // Validate file type before uploading
  validateFileType(file, category);

  const client = ensureSupabase();
  const bucket = client.storage.from(STORAGE_BUCKET);

  const baseName = file.name.replace(/\.[^/.]+$/, '');
  const safeBase = slugifySegment(baseName);
  const safeIdentifier = identifier ? slugifySegment(identifier) : undefined;
  const extension = fileExtension(file.name) ?? (file.type && file.type.split('/')[1]) ?? 'bin';
  
  // Map category to storage path
  let categoryPath: string;
  if (category === 'faculty-photo') {
    categoryPath = 'faculty';
  } else if (category === 'gallery') {
    categoryPath = 'gallery';
  } else if (category === 'announcement-attachment') {
    categoryPath = 'announcements';
  } else {
    categoryPath = 'general';
  }
  
  const segments = ['public', categoryPath, locale];
  if (safeIdentifier) {
    segments.push(safeIdentifier);
  }

  const fileName = `${safeBase}-${uniqueSuffix()}.${extension}`;
  const storagePath = [...segments, fileName].join('/');

  const { error } = await bucket.upload(storagePath, file, {
    cacheControl: '3600',
    upsert: true,
    contentType: file.type || undefined,
  });

  if (error) {
    throw error;
  }

  const { data } = bucket.getPublicUrl(storagePath);

  if (!data?.publicUrl) {
    throw new Error('Failed to generate public URL for uploaded asset.');
  }

  return { publicUrl: data.publicUrl, storagePath };
}

export async function deleteSiteAsset(path: string | null | undefined): Promise<void> {
  if (!path) {
    return;
  }
  if (!supabase) {
    console.warn('Supabase is not configured; skipping asset deletion for', path);
    return;
  }

  const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([path]);
  if (error) {
    console.error('Failed to delete asset from storage', { path, error });
  }
}

// Content backup/history functions
const HISTORY_TABLE = 'content_history';

export async function saveContentBackup(content: SiteContent, label?: string): Promise<void> {
  const client = ensureSupabase();

  const { error } = await client.from(HISTORY_TABLE).insert({
    content: JSON.parse(JSON.stringify(content)),
    label: label || `Backup ${new Date().toLocaleString()}`,
  });

  if (error) {
    console.error('Failed to save content backup:', error);
    throw new Error(`Failed to save backup: ${error.message}`);
  }

  console.log('[Supabase] Content backup saved');
}

export async function fetchContentBackups(): Promise<ContentBackup[]> {
  if (!supabase) {
    console.warn('[Supabase] Client not configured, skipping backup fetch');
    return [];
  }

  const { data, error } = await supabase
    .from(HISTORY_TABLE)
    .select('id, saved_at, label, content')
    .order('saved_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('[Supabase] Failed to fetch backups:', error);
    return [];
  }

  return (data ?? []) as ContentBackup[];
}

export async function restoreContentBackup(backupId: number): Promise<SiteContent | null> {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from(HISTORY_TABLE)
    .select('content')
    .eq('id', backupId)
    .single();

  if (error || !data) {
    console.error('[Supabase] Failed to restore backup:', error);
    return null;
  }

  return data.content as SiteContent;
}
