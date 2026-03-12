import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  type ClinicalCaseDifficulty,
  type ClinicalLevelTier,
  type ClinicalProgressPage,
  type ClinicalProgressStats,
  type ClinicalSpecialtyCount,
  type GeneratedClinicalCase,
  type StudentCaseHistoryEntry,
  type StudentClinicalRecord,
  normalizeGeneratedClinicalCase,
  normalizeStudentCaseHistoryEntry,
  normalizeStudentClinicalRecord
} from './clinical-records.js';

interface ClinicalHistoryRow {
  caseId: string;
  signature: string;
  specialty: string;
  disease: string;
  difficulty: ClinicalCaseDifficulty;
  date: string;
}

interface ClinicalRecordRow {
  recordId: string;
  caseId: string;
  signature: string;
  specialty: string;
  specialtyTrack: string;
  disease: string;
  difficulty: ClinicalCaseDifficulty;
  score: number;
  status: 'completed' | 'failed';
  date: string;
  timeSpentSeconds: number;
  title: string;
  caseDescription: string;
  finalEvaluation: string;
  educationalAnalysis: string;
  mistakesJson: string;
  correctDecisionsJson: string;
  treatmentChoicesJson: string;
  transcriptJson: string;
  summaryJson: string | null;
  generatedCaseJson: string | null;
  levelTier: ClinicalLevelTier;
}

interface StatsRow {
  totalCasesCompleted: number;
  averageScore: number | null;
  bestScore: number | null;
  worstScore: number | null;
  totalTimeSeconds: number | null;
}

interface CountRow {
  total: number;
}

interface CursorRow {
  recordId: string;
  date: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, '..', '..', 'clinical-records.sqlite');

const db = new DatabaseSync(DB_FILE, {
  open: true,
  timeout: 5000
});

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;

  CREATE TABLE IF NOT EXISTS clinical_user_migrations (
    user_id TEXT PRIMARY KEY,
    migrated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS clinical_case_history (
    user_id TEXT NOT NULL,
    case_id TEXT NOT NULL,
    signature TEXT NOT NULL,
    specialty TEXT NOT NULL,
    disease TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    date TEXT NOT NULL,
    PRIMARY KEY (user_id, case_id)
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_case_history_user_signature
  ON clinical_case_history(user_id, signature);

  CREATE INDEX IF NOT EXISTS idx_case_history_user_specialty_date
  ON clinical_case_history(user_id, specialty, date DESC);

  CREATE TABLE IF NOT EXISTS clinical_records (
    user_id TEXT NOT NULL,
    record_id TEXT NOT NULL,
    case_id TEXT NOT NULL,
    signature TEXT NOT NULL,
    specialty TEXT NOT NULL,
    specialty_track TEXT NOT NULL,
    disease TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    score INTEGER NOT NULL,
    status TEXT NOT NULL,
    date TEXT NOT NULL,
    time_spent_seconds INTEGER NOT NULL,
    title TEXT NOT NULL,
    case_description TEXT NOT NULL,
    final_evaluation TEXT NOT NULL,
    educational_analysis TEXT NOT NULL,
    mistakes_json TEXT NOT NULL,
    correct_decisions_json TEXT NOT NULL,
    treatment_choices_json TEXT NOT NULL,
    transcript_json TEXT NOT NULL,
    summary_json TEXT,
    generated_case_json TEXT,
    level_tier TEXT NOT NULL,
    PRIMARY KEY (user_id, record_id)
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_records_user_case
  ON clinical_records(user_id, case_id);

  CREATE INDEX IF NOT EXISTS idx_records_user_date
  ON clinical_records(user_id, date DESC, record_id DESC);

  CREATE INDEX IF NOT EXISTS idx_records_user_specialty
  ON clinical_records(user_id, specialty_track, date DESC);
`);

const selectMigrationStmt = db.prepare(`
  SELECT migrated_at AS migratedAt
  FROM clinical_user_migrations
  WHERE user_id = ?
`);

const markMigrationStmt = db.prepare(`
  INSERT INTO clinical_user_migrations (user_id, migrated_at)
  VALUES (?, ?)
  ON CONFLICT(user_id) DO UPDATE SET
    migrated_at = excluded.migrated_at
`);

const countHistoryStmt = db.prepare(`
  SELECT COUNT(*) AS total
  FROM clinical_case_history
  WHERE user_id = ?
`);

const countRecordsStmt = db.prepare(`
  SELECT COUNT(*) AS total
  FROM clinical_records
  WHERE user_id = ?
`);

const upsertHistoryStmt = db.prepare(`
  INSERT INTO clinical_case_history (
    user_id,
    case_id,
    signature,
    specialty,
    disease,
    difficulty,
    date
  ) VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(user_id, case_id) DO UPDATE SET
    signature = excluded.signature,
    specialty = excluded.specialty,
    disease = excluded.disease,
    difficulty = excluded.difficulty,
    date = excluded.date
`);

const listHistoryStmt = db.prepare(`
  SELECT
    case_id AS caseId,
    signature,
    specialty,
    disease,
    difficulty,
    date
  FROM clinical_case_history
  WHERE user_id = ?
  ORDER BY date DESC, case_id DESC
  LIMIT ?
`);

const findHistoryEntryStmt = db.prepare(`
  SELECT
    case_id AS caseId,
    signature,
    specialty,
    disease,
    difficulty,
    date
  FROM clinical_case_history
  WHERE user_id = ?
    AND (case_id = ? OR signature = ?)
  LIMIT 1
`);

const upsertRecordStmt = db.prepare(`
  INSERT INTO clinical_records (
    user_id,
    record_id,
    case_id,
    signature,
    specialty,
    specialty_track,
    disease,
    difficulty,
    score,
    status,
    date,
    time_spent_seconds,
    title,
    case_description,
    final_evaluation,
    educational_analysis,
    mistakes_json,
    correct_decisions_json,
    treatment_choices_json,
    transcript_json,
    summary_json,
    generated_case_json,
    level_tier
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(user_id, case_id) DO UPDATE SET
    record_id = excluded.record_id,
    signature = excluded.signature,
    specialty = excluded.specialty,
    specialty_track = excluded.specialty_track,
    disease = excluded.disease,
    difficulty = excluded.difficulty,
    score = excluded.score,
    status = excluded.status,
    date = excluded.date,
    time_spent_seconds = excluded.time_spent_seconds,
    title = excluded.title,
    case_description = excluded.case_description,
    final_evaluation = excluded.final_evaluation,
    educational_analysis = excluded.educational_analysis,
    mistakes_json = excluded.mistakes_json,
    correct_decisions_json = excluded.correct_decisions_json,
    treatment_choices_json = excluded.treatment_choices_json,
    transcript_json = excluded.transcript_json,
    summary_json = excluded.summary_json,
    generated_case_json = excluded.generated_case_json,
    level_tier = excluded.level_tier
`);

const selectRecordByCaseStmt = db.prepare(`
  SELECT
    record_id AS recordId,
    case_id AS caseId,
    signature,
    specialty,
    specialty_track AS specialtyTrack,
    disease,
    difficulty,
    score,
    status,
    date,
    time_spent_seconds AS timeSpentSeconds,
    title,
    case_description AS caseDescription,
    final_evaluation AS finalEvaluation,
    educational_analysis AS educationalAnalysis,
    mistakes_json AS mistakesJson,
    correct_decisions_json AS correctDecisionsJson,
    treatment_choices_json AS treatmentChoicesJson,
    transcript_json AS transcriptJson,
    summary_json AS summaryJson,
    generated_case_json AS generatedCaseJson,
    level_tier AS levelTier
  FROM clinical_records
  WHERE user_id = ?
    AND case_id = ?
  LIMIT 1
`);

const selectRecordByIdOrCaseStmt = db.prepare(`
  SELECT
    record_id AS recordId,
    case_id AS caseId,
    signature,
    specialty,
    specialty_track AS specialtyTrack,
    disease,
    difficulty,
    score,
    status,
    date,
    time_spent_seconds AS timeSpentSeconds,
    title,
    case_description AS caseDescription,
    final_evaluation AS finalEvaluation,
    educational_analysis AS educationalAnalysis,
    mistakes_json AS mistakesJson,
    correct_decisions_json AS correctDecisionsJson,
    treatment_choices_json AS treatmentChoicesJson,
    transcript_json AS transcriptJson,
    summary_json AS summaryJson,
    generated_case_json AS generatedCaseJson,
    level_tier AS levelTier
  FROM clinical_records
  WHERE user_id = ?
    AND (record_id = ? OR case_id = ?)
  LIMIT 1
`);

const selectCursorStmt = db.prepare(`
  SELECT
    record_id AS recordId,
    date
  FROM clinical_records
  WHERE user_id = ?
    AND record_id = ?
  LIMIT 1
`);

const selectFirstPageStmt = db.prepare(`
  SELECT
    record_id AS recordId,
    case_id AS caseId,
    signature,
    specialty,
    specialty_track AS specialtyTrack,
    disease,
    difficulty,
    score,
    status,
    date,
    time_spent_seconds AS timeSpentSeconds,
    title,
    case_description AS caseDescription,
    final_evaluation AS finalEvaluation,
    educational_analysis AS educationalAnalysis,
    mistakes_json AS mistakesJson,
    correct_decisions_json AS correctDecisionsJson,
    treatment_choices_json AS treatmentChoicesJson,
    transcript_json AS transcriptJson,
    summary_json AS summaryJson,
    generated_case_json AS generatedCaseJson,
    level_tier AS levelTier
  FROM clinical_records
  WHERE user_id = ?
  ORDER BY date DESC, record_id DESC
  LIMIT ?
`);

const selectPageAfterCursorStmt = db.prepare(`
  SELECT
    record_id AS recordId,
    case_id AS caseId,
    signature,
    specialty,
    specialty_track AS specialtyTrack,
    disease,
    difficulty,
    score,
    status,
    date,
    time_spent_seconds AS timeSpentSeconds,
    title,
    case_description AS caseDescription,
    final_evaluation AS finalEvaluation,
    educational_analysis AS educationalAnalysis,
    mistakes_json AS mistakesJson,
    correct_decisions_json AS correctDecisionsJson,
    treatment_choices_json AS treatmentChoicesJson,
    transcript_json AS transcriptJson,
    summary_json AS summaryJson,
    generated_case_json AS generatedCaseJson,
    level_tier AS levelTier
  FROM clinical_records
  WHERE user_id = ?
    AND (date < ? OR (date = ? AND record_id < ?))
  ORDER BY date DESC, record_id DESC
  LIMIT ?
`);

const aggregateStatsStmt = db.prepare(`
  SELECT
    COUNT(*) AS totalCasesCompleted,
    AVG(score) AS averageScore,
    MAX(score) AS bestScore,
    MIN(score) AS worstScore,
    SUM(time_spent_seconds) AS totalTimeSeconds
  FROM clinical_records
  WHERE user_id = ?
`);

const specialtyBreakdownStmt = db.prepare(`
  SELECT
    specialty_track AS specialty,
    COUNT(*) AS count
  FROM clinical_records
  WHERE user_id = ?
  GROUP BY specialty_track
  ORDER BY count DESC, specialty COLLATE NOCASE ASC
`);

const parseJson = (value: string | null): unknown => {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
};

const stringifyJson = (value: unknown): string | null => {
  if (value === null || typeof value === 'undefined') {
    return null;
  }
  return JSON.stringify(value);
};

const asRow = <T>(value: unknown): T | undefined => value as T | undefined;
const asRows = <T>(value: unknown): T[] => value as T[];

const toHistory = (row: ClinicalHistoryRow | null | undefined): StudentCaseHistoryEntry | null =>
  row ? normalizeStudentCaseHistoryEntry(row) : null;

const toRecord = (row: ClinicalRecordRow | null | undefined): StudentClinicalRecord | null =>
  row
    ? normalizeStudentClinicalRecord({
        recordId: row.recordId,
        caseId: row.caseId,
        signature: row.signature,
        specialty: row.specialty,
        specialtyTrack: row.specialtyTrack,
        disease: row.disease,
        difficulty: row.difficulty,
        score: row.score,
        status: row.status,
        date: row.date,
        timeSpentSeconds: row.timeSpentSeconds,
        mistakes: parseJson(row.mistakesJson),
        correctDecisions: parseJson(row.correctDecisionsJson),
        treatmentChoices: parseJson(row.treatmentChoicesJson),
        title: row.title,
        caseDescription: row.caseDescription,
        finalEvaluation: row.finalEvaluation,
        educationalAnalysis: row.educationalAnalysis,
        transcript: parseJson(row.transcriptJson),
        summary: parseJson(row.summaryJson),
        generatedCase: parseJson(row.generatedCaseJson),
        levelTier: row.levelTier
      })
    : null;

const writeHistory = (userId: string, entry: StudentCaseHistoryEntry) => {
  upsertHistoryStmt.run(
    userId,
    entry.caseId,
    entry.signature,
    entry.specialty,
    entry.disease,
    entry.difficulty,
    entry.date
  );
};

const writeRecord = (userId: string, record: StudentClinicalRecord) => {
  upsertRecordStmt.run(
    userId,
    record.recordId,
    record.caseId,
    record.signature,
    record.specialty,
    record.specialtyTrack,
    record.disease,
    record.difficulty,
    record.score,
    record.status,
    record.date,
    record.timeSpentSeconds,
    record.title,
    record.caseDescription,
    record.finalEvaluation,
    record.educationalAnalysis,
    stringifyJson(record.mistakes) || '[]',
    stringifyJson(record.correctDecisions) || '[]',
    stringifyJson(record.treatmentChoices) || '[]',
    stringifyJson(record.transcript) || '[]',
    stringifyJson(record.summary),
    stringifyJson(record.generatedCase),
    record.levelTier
  );
};

const tierMeta = (totalCasesCompleted: number): { tier: ClinicalLevelTier; recommendedDifficulty: ClinicalCaseDifficulty } => {
  if (totalCasesCompleted >= 36) {
    return { tier: 'platinum', recommendedDifficulty: 'expert' };
  }
  if (totalCasesCompleted >= 18) {
    return { tier: 'gold', recommendedDifficulty: 'hard' };
  }
  if (totalCasesCompleted >= 8) {
    return { tier: 'silver', recommendedDifficulty: 'medium' };
  }
  return { tier: 'bronze', recommendedDifficulty: 'easy' };
};

export const ensureClinicalUserMigrated = (
  userId: string,
  legacyHistory: StudentCaseHistoryEntry[],
  legacyRecords: StudentClinicalRecord[]
): boolean => {
  const alreadyMigrated = asRow<{ migratedAt?: string }>(selectMigrationStmt.get(userId));
  if (alreadyMigrated?.migratedAt) {
    return false;
  }

  const hasStoredHistory = Number(asRow<CountRow>(countHistoryStmt.get(userId))?.total || 0) > 0;
  const hasStoredRecords = Number(asRow<CountRow>(countRecordsStmt.get(userId))?.total || 0) > 0;
  const hasLegacyData = legacyHistory.length > 0 || legacyRecords.length > 0;

  if (!hasLegacyData && (hasStoredHistory || hasStoredRecords)) {
    markMigrationStmt.run(userId, new Date().toISOString());
    return false;
  }

  db.exec('BEGIN');
  try {
    legacyHistory.forEach((entry) => writeHistory(userId, entry));
    legacyRecords.forEach((record) => writeRecord(userId, record));
    markMigrationStmt.run(userId, new Date().toISOString());
    db.exec('COMMIT');
    return hasLegacyData;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
};

export const listClinicalCaseHistory = (userId: string, limit: number = 8000): StudentCaseHistoryEntry[] => {
  const rows = asRows<ClinicalHistoryRow>(listHistoryStmt.all(userId, Math.max(1, Math.min(limit, 8000))));
  return rows
    .map((row) => toHistory(row))
    .filter((entry): entry is StudentCaseHistoryEntry => !!entry);
};

export const hasClinicalCaseHistoryEntry = (userId: string, caseId: string, signature: string): boolean => {
  const row = asRow<ClinicalHistoryRow>(findHistoryEntryStmt.get(userId, caseId, signature));
  return !!toHistory(row);
};

export const appendClinicalCaseHistory = (userId: string, entry: StudentCaseHistoryEntry): StudentCaseHistoryEntry => {
  writeHistory(userId, entry);
  return toHistory(asRow<ClinicalHistoryRow>(findHistoryEntryStmt.get(userId, entry.caseId, entry.signature))) || entry;
};

export const findClinicalRecordByCaseId = (userId: string, caseId: string): StudentClinicalRecord | null =>
  toRecord(asRow<ClinicalRecordRow>(selectRecordByCaseStmt.get(userId, caseId)));

export const upsertClinicalRecord = (userId: string, record: StudentClinicalRecord): StudentClinicalRecord => {
  writeRecord(userId, record);
  return findClinicalRecordByCaseId(userId, record.caseId) || record;
};

export const findClinicalRecord = (userId: string, recordIdOrCaseId: string): StudentClinicalRecord | null =>
  toRecord(asRow<ClinicalRecordRow>(selectRecordByIdOrCaseStmt.get(userId, recordIdOrCaseId, recordIdOrCaseId)));

export const getClinicalRecordCount = (userId: string): number =>
  Number(asRow<CountRow>(countRecordsStmt.get(userId))?.total || 0);

export const getClinicalProgressStats = (userId: string): ClinicalProgressStats => {
  const statsRow = asRow<StatsRow>(aggregateStatsStmt.get(userId)) || {
    totalCasesCompleted: 0,
    averageScore: 0,
    bestScore: 0,
    worstScore: 0,
    totalTimeSeconds: 0
  };

  if (!statsRow.totalCasesCompleted) {
    return {
      totalCasesCompleted: 0,
      averageScore: 0,
      bestScore: 0,
      worstScore: 0,
      totalHoursPracticed: 0,
      mostPracticedSpecialty: 'None',
      specialtyBreakdown: [],
      levelTier: 'bronze',
      recommendedDifficulty: 'easy'
    };
  }

  const specialtyBreakdown = asRows<{ specialty: string; count: number }>(specialtyBreakdownStmt.all(userId)).map(
    (row): ClinicalSpecialtyCount => ({
      specialty: row.specialty || 'General',
      count: Number(row.count || 0)
    })
  );
  const tier = tierMeta(statsRow.totalCasesCompleted);

  return {
    totalCasesCompleted: Number(statsRow.totalCasesCompleted || 0),
    averageScore: Number(Number(statsRow.averageScore || 0).toFixed(1)),
    bestScore: Number(statsRow.bestScore || 0),
    worstScore: Number(statsRow.worstScore || 0),
    totalHoursPracticed: Number((Number(statsRow.totalTimeSeconds || 0) / 3600).toFixed(1)),
    mostPracticedSpecialty: specialtyBreakdown[0]?.specialty || 'None',
    specialtyBreakdown,
    levelTier: tier.tier,
    recommendedDifficulty: tier.recommendedDifficulty
  };
};

export const loadClinicalProgressPage = (
  userId: string,
  cursor: string | null,
  limit: number
): ClinicalProgressPage => {
  const safeLimit = Math.max(5, Math.min(limit, 40));
  const cursorRow = cursor
    ? asRow<CursorRow>(selectCursorStmt.get(userId, cursor))
    : undefined;
  const rows = asRows<ClinicalRecordRow>(cursorRow
    ? selectPageAfterCursorStmt.all(userId, cursorRow.date, cursorRow.date, cursorRow.recordId, safeLimit + 1)
    : selectFirstPageStmt.all(userId, safeLimit + 1));
  const parsed = rows
    .map((row) => toRecord(row))
    .filter((record): record is StudentClinicalRecord => !!record);
  const items = parsed.slice(0, safeLimit);
  const hasMore = parsed.length > safeLimit;

  return {
    items,
    total: getClinicalRecordCount(userId),
    hasMore,
    nextCursor: hasMore ? items[items.length - 1]?.recordId || null : null,
    stats: getClinicalProgressStats(userId)
  };
};

export const normalizeStoredGeneratedCase = (value: unknown): GeneratedClinicalCase | null =>
  normalizeGeneratedClinicalCase(value);
