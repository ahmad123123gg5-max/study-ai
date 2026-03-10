import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TARGETS = [
  'src/app.component.ts',
  'src/components',
  'src/services'
];

const IGNORE_PATTERNS = [
  /src[\\/](i18n|assets)[\\/]/,
  /src[\\/]services[\\/]localization\.service\.ts$/,
  /src[\\/]services[\\/]ai\.service\.ts$/,
  /src[\\/]components[\\/]pages[\\/]document-workspace[\\/]/,
  /src[\\/]i18n[\\/]/,
  /generated-site-phrases\.ts$/,
  /manual-site-phrases\.ts$/
];

const FILE_EXTENSIONS = new Set(['.ts', '.html']);
const ARABIC_REGEX = /[\u0600-\u06FF]/;
const LANGUAGE_TERNARY_REGEX = /\b(currentLanguage|selectedLang|language|isAr)\s*\([^)]*\)?\s*===?\s*['"]ar['"][^?\n]*\?/;

async function collectFiles(entryPath, bucket) {
  const stat = await fs.stat(entryPath);
  if (stat.isDirectory()) {
    const entries = await fs.readdir(entryPath);
    for (const entry of entries) {
      await collectFiles(path.join(entryPath, entry), bucket);
    }
    return;
  }

  if (!FILE_EXTENSIONS.has(path.extname(entryPath))) {
    return;
  }

  const normalized = entryPath.replaceAll('\\', '/');
  if (IGNORE_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return;
  }

  bucket.push(entryPath);
}

function shouldReportLine(line) {
  if (!line.trim()) {
    return false;
  }

  if (line.includes('this.localization.phrase(') || line.includes(" t('") || line.includes('t("')) {
    return false;
  }

  if (line.includes('data-no-i18n') || line.includes('fa-') || line.includes('http://') || line.includes('https://')) {
    return false;
  }

  return ARABIC_REGEX.test(line) || LANGUAGE_TERNARY_REGEX.test(line);
}

async function main() {
  const files = [];
  for (const target of TARGETS) {
    const absolute = path.join(ROOT, target);
    await collectFiles(absolute, files);
  }

  const findings = [];

  for (const file of files) {
    const content = await fs.readFile(file, 'utf8');
    const lines = content.split(/\r?\n/);

    lines.forEach((line, index) => {
      if (shouldReportLine(line)) {
        findings.push({
          file: path.relative(ROOT, file).replaceAll('\\', '/'),
          line: index + 1,
          snippet: line.trim()
        });
      }
    });
  }

  if (!findings.length) {
    console.log('Local i18n check passed.');
    return;
  }

  console.log(`Local i18n check found ${findings.length} possible hardcoded UI strings.`);
  findings.slice(0, 200).forEach((finding) => {
    console.log(`${finding.file}:${finding.line} ${finding.snippet}`);
  });

  if (findings.length > 200) {
    console.log(`...and ${findings.length - 200} more.`);
  }

  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
