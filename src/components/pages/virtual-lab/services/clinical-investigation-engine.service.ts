import { Injectable } from '@angular/core';
import {
  ClinicalExamSectionData,
  ClinicalResultViewer,
  ClinicalTimelineEvent,
  SimulationScenarioConfig
} from '../models/virtual-lab.models';
import {
  ClinicalActionLogEntry,
  ClinicalExamTarget,
  ClinicalHistoryTarget,
  ClinicalInvestigationId,
  ClinicalSimulationState
} from './clinical-simulation.models';

export interface ClinicalInquiryOutcome {
  message: string;
  logEntry: ClinicalActionLogEntry;
  timeline: ClinicalTimelineEvent;
  scoreImpact: number;
}

@Injectable({ providedIn: 'root' })
export class ClinicalInvestigationEngineService {
  requestHistory(state: ClinicalSimulationState, target: ClinicalHistoryTarget): ClinicalInquiryOutcome {
    const alreadyRequested = state.requestedHistory.has(target);
    if (!alreadyRequested) {
      state.requestedHistory.add(target);
      this.adjustScore(state, 'history', state.definition.expectations.keyHistory.includes(target) ? 14 : 6);
    }

    const message = state.definition.historyResponse(target, state)
      || this.t(state.config.language, 'لا توجد إضافة مهمة أخرى من التاريخ حالياً.', 'No further high-yield history detail is available right now.');
    return this.outcome(
      state,
      'history',
      alreadyRequested
        ? this.t(state.config.language, 'إعادة مراجعة التاريخ', 'History review repeated')
        : this.t(state.config.language, 'تم أخذ history موجه', 'Focused history obtained'),
      message,
      alreadyRequested ? 1 : 4,
      alreadyRequested ? 'neutral' : 'positive'
    );
  }

  requestExam(state: ClinicalSimulationState, target: ClinicalExamTarget): ClinicalInquiryOutcome {
    const existing = state.requestedExams.get(target);
    const finding = existing || state.definition.examResponse(target, state);
    const message = finding
      ? `${finding.summary}\n\n${finding.findings.join('\n')}`
      : this.t(state.config.language, 'لا توجد findings إضافية نوعية في هذا الجزء حالياً.', 'No additional high-yield findings are available in that exam area right now.');

    if (finding && !existing) {
      state.requestedExams.set(target, finding as ClinicalExamSectionData);
      this.adjustScore(state, 'exam', state.definition.expectations.keyExams.includes(target) ? 14 : 6);
    }

    return this.outcome(
      state,
      'exam',
      finding
        ? this.t(state.config.language, 'تم تحديث الفحص السريري', 'Exam findings updated')
        : this.t(state.config.language, 'فحص محدود الفائدة', 'Low-yield exam area'),
      message,
      finding ? 4 : 1,
      finding ? 'positive' : 'neutral'
    );
  }

  requestInvestigation(state: ClinicalSimulationState, target: ClinicalInvestigationId): ClinicalInquiryOutcome {
    const existing = state.requestedInvestigations.get(target);
    const result = existing || state.definition.investigationResult(target, state);
    const message = result
      ? `${result.title}: ${result.note}`
      : this.t(state.config.language, 'هذا الفحص غير متاح أو غير مناسب لهذه الحالة حالياً.', 'That investigation is unavailable or not appropriate for this case right now.');

    if (result && !existing) {
      state.requestedInvestigations.set(target, result as ClinicalResultViewer);
      this.adjustScore(state, 'tests', state.definition.expectations.keyInvestigations.includes(target) ? 14 : 6);
    }

    return this.outcome(
      state,
      'investigation',
      result
        ? this.t(state.config.language, 'تمت إضافة نتيجة جديدة', 'New investigation result added')
        : this.t(state.config.language, 'طلب غير ملائم', 'Low-yield request'),
      message,
      result ? 4 : 1,
      result ? (result.urgent ? 'warning' : 'positive') : 'neutral'
    );
  }

  submitDiagnosis(state: ClinicalSimulationState, text: string): ClinicalInquiryOutcome {
    const normalized = this.normalize(text);
    const matched = state.definition.expectations.diagnosticKeywords.some((keyword) => normalized.includes(this.normalize(keyword)));
    const logLabel = matched
      ? this.t(state.config.language, 'تم طرح تشخيص مناسب', 'Plausible diagnosis proposed')
      : this.t(state.config.language, 'تشخيص غير مكتمل أو غير مرجح', 'Diagnosis proposed with weak support');

    state.diagnosisAttempts.push({
      text,
      matched,
      scoreAwarded: matched ? 18 : 4,
      createdAt: Date.now()
    });
    this.adjustScore(state, 'diagnosis', matched ? 18 : 4);

    state.diagnosticHypotheses = state.definition.buildDifferentials(state).map((item, index) => ({
      ...item,
      primary: matched && index === 0 ? true : item.primary
    }));

    return this.outcome(
      state,
      'diagnosis',
      logLabel,
      matched
        ? this.t(state.config.language, 'التشخيص المقترح يتماشى جيداً مع المعطيات الحالية.', 'The proposed diagnosis fits the current data well.')
        : this.t(state.config.language, 'هذا التشخيص يحتاج دعم أكبر من history/exam/tests قبل اعتماده.', 'That diagnosis needs stronger support from the history, exam, and tests before it can be defended.'),
      matched ? 6 : 2,
      matched ? 'positive' : 'neutral'
    );
  }

  private outcome(
    state: ClinicalSimulationState,
    kind: ClinicalActionLogEntry['kind'],
    title: string,
    detail: string,
    timeSeconds: number,
    tone: ClinicalTimelineEvent['tone']
  ): ClinicalInquiryOutcome {
    const timeline: ClinicalTimelineEvent = {
      id: crypto.randomUUID(),
      timeLabel: this.timeLabel(state.tickCount + timeSeconds, state.config.language),
      title,
      detail,
      tone
    };

    const logEntry: ClinicalActionLogEntry = {
      id: crypto.randomUUID(),
      kind,
      label: title,
      detail,
      effectSummary: [],
      createdAt: Date.now()
    };

    return {
      message: detail,
      logEntry,
      timeline,
      scoreImpact: tone === 'positive' ? 4 : tone === 'warning' ? 2 : 1
    };
  }

  private adjustScore(state: ClinicalSimulationState, key: keyof ClinicalSimulationState['score'], delta: number) {
    state.score[key] = this.clamp(state.score[key] + delta, 0, 100);
  }

  private normalize(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[أإآ]/g, 'ا')
      .replace(/[ة]/g, 'ه')
      .replace(/[ىي]/g, 'ي')
      .replace(/\s+/g, ' ');
  }

  private timeLabel(seconds: number, language: SimulationScenarioConfig['language']) {
    return language === 'ar' ? `+${seconds} ث` : `+${seconds}s`;
  }

  private t(language: SimulationScenarioConfig['language'], arabic: string, english: string) {
    return language === 'ar' ? arabic : english;
  }

  private clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
  }
}
