import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = process.cwd();
const SRC_ROOT = path.join(PROJECT_ROOT, 'src');
const OUTPUT_FILE = path.join(SRC_ROOT, 'i18n', 'locales', 'generated-site-phrases.ts');

const SOURCE_EXTENSIONS = new Set(['.ts', '.html']);
const FILES = [];

const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      FILES.push(fullPath);
    }
  }
};

walk(SRC_ROOT);

const patterns = [
  /currentLanguage\(\)\s*===\s*'ar'\s*\?\s*'([^']+)'\s*:\s*'([^']+)'/g,
  /currentLanguage\(\)\s*===\s*"ar"\s*\?\s*"([^"]+)"\s*:\s*"([^"]+)"/g,
  /currentLanguage\(\)\s*===\s*'ar'\s*\?\s*`([^`]+)`\s*:\s*`([^`]+)`/g,
  /currentLanguage\(\)\s*!==\s*'ar'\s*\?\s*'([^']+)'\s*:\s*'([^']+)'/g,
  /currentLanguage\(\)\s*!==\s*"ar"\s*\?\s*"([^"]+)"\s*:\s*"([^"]+)"/g,
  /language\(\)\s*===\s*'ar'\s*\?\s*'([^']+)'\s*:\s*'([^']+)'/g,
  /language\(\)\s*===\s*"ar"\s*\?\s*"([^"]+)"\s*:\s*"([^"]+)"/g,
  /isAr\s*\?\s*'([^']+)'\s*:\s*'([^']+)'/g,
  /isAr\s*\?\s*"([^"]+)"\s*:\s*"([^"]+)"/g
];

const escapeTsString = (value) => value
  .replace(/\\/g, '\\\\')
  .replace(/'/g, "\\'")
  .replace(/\r/g, '\\r')
  .replace(/\n/g, '\\n');

const phrasePairs = new Map();

for (const file of FILES) {
  const raw = fs.readFileSync(file, 'utf8');

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(raw))) {
      const ar = String(match[1] || '').trim();
      const en = String(match[2] || '').trim();
      if (!ar || !en) {
        continue;
      }

      if (!phrasePairs.has(en)) {
        phrasePairs.set(en, ar);
      }
    }
  }
}

const rows = [...phrasePairs.entries()]
  .sort((a, b) => a[0].localeCompare(b[0]))
  .map(([en, ar]) => `  ['${escapeTsString(en)}', '${escapeTsString(ar)}'] as const,`);

const fileContents = `export const GENERATED_SITE_PHRASE_ROWS = [
${rows.join('\n')}
] as const;
`;

fs.writeFileSync(OUTPUT_FILE, fileContents, 'utf8');
console.log(`Generated ${phrasePairs.size} local phrase rows in ${path.relative(PROJECT_ROOT, OUTPUT_FILE)}`);
