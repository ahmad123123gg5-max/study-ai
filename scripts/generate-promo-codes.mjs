import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, '..', 'user_data.json');
const CODE_COUNT = 20;
const FORCE = process.argv.includes('--force') || process.argv.includes('-f');

const readData = async () => {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    console.error('Unable to read user_data.json:', error);
    process.exit(1);
  }
};

const writeData = async (payload) => {
  try {
    await fs.writeFile(DATA_FILE, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  } catch (error) {
    console.error('Unable to write promo codes:', error);
    process.exit(1);
  }
};

const buildCode = () => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const suffix = Array.from({ length: 6 })
    .map(() => alphabet[Math.floor(Math.random() * alphabet.length)])
    .join('');
  return `FREE14-${suffix}`;
};

const normalizePromo = (code) => ({
  code,
  type: 'pro_trial',
  durationDays: 14,
  maxUses: 1,
  usedCount: 0,
  isActive: true,
  createdAt: new Date().toISOString(),
  redeemedAt: null,
  redeemedByUserId: null,
  redeemedByEmail: null
});

const run = async () => {
  const data = await readData();
  const existingCodes = Array.isArray(data.promoCodes) ? data.promoCodes : [];

  if (existingCodes.length > 0 && !FORCE) {
    console.log('تم العثور على أكواد ترويجية موجودة مسبقاً. استخدم --force لإعادة توليدها.');
    console.log('الأكواد الحالية:');
    existingCodes.forEach((entry) => console.log(`- ${entry.code}`));
    return;
  }

  const generatedCodes = [];
  const seen = new Set();
  while (generatedCodes.length < CODE_COUNT) {
    const candidate = buildCode();
    if (seen.has(candidate)) {
      continue;
    }
    seen.add(candidate);
    generatedCodes.push(normalizePromo(candidate));
  }

  data.promoCodes = generatedCodes;
  await writeData(data);

  console.log(`Generated ${CODE_COUNT} promo codes:`);
  generatedCodes.forEach((entry) => console.log(`- ${entry.code}`));
};

await run();
