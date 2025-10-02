#!/usr/bin/env node
import path from 'node:path';
import fs from 'node:fs/promises';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const projectRoot = process.cwd();
const envLocalPath = path.resolve(projectRoot, '.env.local');
const envPath = path.resolve(projectRoot, '.env');
const imagesDir = path.resolve(projectRoot, 'public/data/images');
const outputPath = path.resolve(projectRoot, 'src/data/generatedContent.ts');

dotenv.config({ path: envPath });
dotenv.config({ path: envLocalPath, override: true });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const { data, error } = await supabase.from('site_content').select('locale,payload');

if (error) {
  console.error('Failed to fetch content from Supabase:', error.message);
  process.exit(1);
}

if (!data || data.length === 0) {
  console.error('No rows found in site_content table.');
  process.exit(1);
}

await fs.rm(imagesDir, { recursive: true, force: true });
await fs.mkdir(imagesDir, { recursive: true });

const slugify = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'image';

const usedFilenames = new Set();

const saveImageFromDataUrl = async (locale, name, dataUrl) => {
  const match = /^data:(image\/[^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    return dataUrl;
  }

  const mime = match[1];
  const base64 = match[2];
  let ext = mime.split('/')[1] || 'png';
  if (ext === 'jpeg') {
    ext = 'jpg';
  }

  const baseSlug = slugify(`${locale}-${name}`);
  let filename = `${baseSlug}.${ext}`;
  let counter = 1;
  while (usedFilenames.has(filename)) {
    filename = `${baseSlug}-${counter}.${ext}`;
    counter += 1;
  }
  usedFilenames.add(filename);

  const buffer = Buffer.from(base64, 'base64');
  await fs.writeFile(path.join(imagesDir, filename), buffer);

  return `/data/images/${filename}`;
};

const contentObject = {};

for (const row of data) {
  const locale = row.locale;
  const payload = row.payload;
  if (!payload) {
    continue;
  }

  if (payload?.faculty?.members) {
    for (const member of payload.faculty.members) {
      if (member.photoDataUrl && typeof member.photoDataUrl === 'string') {
        member.photoDataUrl = await saveImageFromDataUrl(
          locale,
          member.name || 'faculty',
          member.photoDataUrl,
        );
      }
    }
  }

  contentObject[locale] = payload;
}

const sortedEntries = Object.entries(contentObject).sort(([a], [b]) => a.localeCompare(b));
const sortedContent = Object.fromEntries(sortedEntries);

const output = `const content = ${JSON.stringify(sortedContent, null, 2)};

export default content;
`;

await fs.writeFile(outputPath, output, 'utf8');

console.log(`Wrote Supabase content to ${path.relative(projectRoot, outputPath)}`);
console.log(`Saved images to ${path.relative(projectRoot, imagesDir)}`);
