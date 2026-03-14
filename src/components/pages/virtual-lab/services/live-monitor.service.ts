import { Injectable, OnDestroy, computed, signal } from '@angular/core';
import { MedicalMonitorPanelData, MedicalPatientStatePanelData, PanelConfig } from '../models/virtual-lab.models';
import { ParsedSimulationAction } from './simulation-action-parser.service';

interface MonitorDelta {
  heartRate?: number;
  oxygenSaturation?: number;
  respiratoryRate?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  temperatureCelsius?: number;
}

const TICK_MS = 900;

@Injectable({ providedIn: 'root' })
export class LiveMonitorService implements OnDestroy {
  private readonly basePanel = signal<PanelConfig | null>(null);
  private readonly currentMonitor = signal<MedicalMonitorPanelData | null>(null);
  private targetMonitor: MedicalMonitorPanelData | null = null;
  private tickId: number | null = null;

  readonly panelConfig = computed<PanelConfig | null>(() => {
    const panel = this.basePanel();
    if (!panel || panel.type !== 'medical-monitor') {
      return panel;
    }

    const monitor = this.currentMonitor();
    if (!monitor) {
      return panel;
    }

    return { ...panel, monitor };
  });

  setPanel(panel: PanelConfig | null, options: { forceReset?: boolean } = {}) {
    this.basePanel.set(panel);

    if (!panel || panel.type !== 'medical-monitor' || !panel.monitor) {
      this.targetMonitor = null;
      this.currentMonitor.set(null);
      this.stopTicker();
      return;
    }

    const normalized = this.ensureMonitorLive(panel.monitor);
    if (options.forceReset || !this.currentMonitor()) {
      this.currentMonitor.set({ ...normalized });
    } else {
      const patientState = this.mergePatientState(this.currentMonitor(), normalized);
      this.currentMonitor.set({
        ...normalized,
        patientState
      });
    }

    this.targetMonitor = { ...normalized };
    this.startTicker();
  }

  applyAction(action: ParsedSimulationAction, input: string, language: 'ar' | 'en') {
    const current = this.currentMonitor();
    if (!current) {
      return;
    }

    const nextTarget = this.targetMonitor ? { ...this.targetMonitor } : { ...current };
    const now = Date.now();
    const patientState = { ...current.patientState };
    const summary = this.buildActionSummary(action, input, language);
    if (summary) {
      patientState.recentActions = [summary, ...patientState.recentActions].slice(0, 6);
      patientState.lastClinicianResponse = language === 'ar'
        ? `تم تسجيل الإجراء: ${summary}`
        : `Action logged: ${summary}`;
    }

    const interventions = [...patientState.activeInterventions];
    const addIntervention = (kind: MedicalMonitorPanelData['patientState']['activeInterventions'][number]['kind'], label: string, detail: string, intensity: 'low' | 'medium' | 'high') => {
      const existing = interventions.find((item) => item.kind === kind && item.active);
      if (existing) {
        existing.label = label;
        existing.detail = detail;
        existing.intensity = intensity;
        return;
      }
      interventions.unshift({
        id: crypto.randomUUID(),
        label,
        detail,
        kind,
        intensity,
        startedAt: now,
        active: true
      });
    };

    if (action.interventionTargets.includes('monitoring') || action.interventionTargets.includes('ecg')) {
      patientState.monitoringActive = true;
      addIntervention(
        'monitoring',
        language === 'ar' ? 'مراقبة مستمرة' : 'Continuous monitoring',
        language === 'ar' ? 'تم تفعيل المونيتور الحيوي.' : 'Vitals monitoring is active.',
        'medium'
      );
    }

    if (action.interventionTargets.includes('oxygen')) {
      this.applyDelta(nextTarget, {
        oxygenSaturation: 5,
        respiratoryRate: -2
      });
      addIntervention(
        'oxygen',
        language === 'ar' ? 'أكسجين' : 'Oxygen support',
        language === 'ar' ? 'رفع التشبع التدريجي' : 'Improving saturation',
        action.wantsEscalation ? 'high' : 'medium'
      );
    }

    if (action.interventionTargets.includes('airway')) {
      this.applyDelta(nextTarget, {
        oxygenSaturation: 3,
        respiratoryRate: -1
      });
      addIntervention(
        'airway',
        language === 'ar' ? 'تأمين مجرى الهواء' : 'Airway support',
        language === 'ar' ? 'تحسين التهوية' : 'Ventilation support',
        'medium'
      );
    }

    if (action.interventionTargets.includes('iv-fluids')) {
      this.applyDelta(nextTarget, {
        bloodPressureSystolic: 6,
        bloodPressureDiastolic: 4,
        heartRate: -3
      });
      addIntervention(
        'fluids',
        language === 'ar' ? 'سوائل وريدية' : 'IV fluids',
        language === 'ar' ? 'تحسين الضغط والدوران' : 'Supporting perfusion',
        'medium'
      );
    }

    if (action.interventionTargets.includes('iv-access')) {
      addIntervention(
        'access',
        language === 'ar' ? 'خط وريدي' : 'IV access',
        language === 'ar' ? 'تم تجهيز الوصول الوريدي.' : 'IV access established.',
        'low'
      );
    }

    if (action.interventionTargets.includes('medication') || action.mentionsMedication) {
      addIntervention(
        'medication',
        language === 'ar' ? 'علاج دوائي' : 'Medication',
        language === 'ar' ? 'تم إعطاء علاج دوائي.' : 'Medication administered.',
        action.wantsEscalation ? 'high' : 'medium'
      );
    }

    patientState.activeInterventions = interventions.slice(0, 6);
    nextTarget.patientState = patientState;

    const severity = this.resolveSeverity(nextTarget);
    nextTarget.severity = severity;
    nextTarget.alertLevel = severity === 'critical' ? 'critical' : severity === 'stable' ? 'stable' : 'watch';
    nextTarget.alarmActive = severity === 'critical';
    nextTarget.statusLabel = this.statusLabelFor(severity, language);
    nextTarget.trendNote = this.trendNoteFor(action, language);
    nextTarget.bloodPressure = `${nextTarget.bloodPressureSystolic}/${nextTarget.bloodPressureDiastolic}`;

    this.currentMonitor.set({ ...current, patientState });
    this.targetMonitor = nextTarget;
  }

  reset() {
    this.basePanel.set(null);
    this.currentMonitor.set(null);
    this.targetMonitor = null;
    this.stopTicker();
  }

  ngOnDestroy() {
    this.stopTicker();
  }

  private startTicker() {
    if (this.tickId !== null) {
      return;
    }
    this.tickId = window.setInterval(() => this.tick(), TICK_MS);
  }

  private stopTicker() {
    if (this.tickId !== null) {
      window.clearInterval(this.tickId);
      this.tickId = null;
    }
  }

  private tick() {
    const current = this.currentMonitor();
    const target = this.targetMonitor;
    if (!current || !target) {
      return;
    }

    const next: MedicalMonitorPanelData = {
      ...current,
      heartRate: this.stepValue(current.heartRate, target.heartRate, 1),
      oxygenSaturation: this.stepValue(current.oxygenSaturation, target.oxygenSaturation, 1),
      respiratoryRate: this.stepValue(current.respiratoryRate, target.respiratoryRate, 1),
      bloodPressureSystolic: this.stepValue(current.bloodPressureSystolic, target.bloodPressureSystolic, 1),
      bloodPressureDiastolic: this.stepValue(current.bloodPressureDiastolic, target.bloodPressureDiastolic, 1),
      temperatureCelsius: this.stepValueFloat(current.temperatureCelsius, target.temperatureCelsius, 0.1),
      alertLevel: target.alertLevel,
      ecgPreset: target.ecgPreset,
      severity: target.severity,
      statusLabel: target.statusLabel,
      trendNote: target.trendNote,
      alarmActive: target.alarmActive,
      patientState: this.mergePatientState(current, target)
    };

    next.bloodPressure = `${next.bloodPressureSystolic}/${next.bloodPressureDiastolic}`;
    this.currentMonitor.set(next);
  }

  private stepValue(current: number, target: number, maxStep: number) {
    const diff = Math.round(target - current);
    if (diff === 0) return current;
    const step = Math.max(1, Math.min(Math.abs(diff), maxStep));
    return current + Math.sign(diff) * step;
  }

  private stepValueFloat(current: number, target: number, maxStep: number) {
    const diff = target - current;
    if (Math.abs(diff) <= maxStep) return Math.round(target * 10) / 10;
    return Math.round((current + Math.sign(diff) * maxStep) * 10) / 10;
  }

  private applyDelta(target: MedicalMonitorPanelData, delta: MonitorDelta) {
    if (typeof delta.oxygenSaturation === 'number') {
      target.oxygenSaturation = this.clamp(target.oxygenSaturation + delta.oxygenSaturation, 60, 100);
    }
    if (typeof delta.respiratoryRate === 'number') {
      target.respiratoryRate = this.clamp(target.respiratoryRate + delta.respiratoryRate, 6, 40);
    }
    if (typeof delta.heartRate === 'number') {
      target.heartRate = this.clamp(target.heartRate + delta.heartRate, 30, 190);
    }
    if (typeof delta.bloodPressureSystolic === 'number') {
      target.bloodPressureSystolic = this.clamp(target.bloodPressureSystolic + delta.bloodPressureSystolic, 40, 220);
    }
    if (typeof delta.bloodPressureDiastolic === 'number') {
      target.bloodPressureDiastolic = this.clamp(target.bloodPressureDiastolic + delta.bloodPressureDiastolic, 20, 140);
    }
    if (typeof delta.temperatureCelsius === 'number') {
      target.temperatureCelsius = this.clamp(target.temperatureCelsius + delta.temperatureCelsius, 34, 42);
    }
  }

  private resolveSeverity(monitor: MedicalMonitorPanelData): MedicalMonitorPanelData['severity'] {
    if (monitor.oxygenSaturation < 88 || monitor.bloodPressureSystolic < 85 || monitor.heartRate > 150 || monitor.respiratoryRate > 35) {
      return 'critical';
    }
    if (monitor.oxygenSaturation < 92 || monitor.bloodPressureSystolic < 95 || monitor.heartRate > 120 || monitor.respiratoryRate > 28) {
      return 'unstable';
    }
    if (monitor.oxygenSaturation < 95 || monitor.heartRate > 105 || monitor.respiratoryRate > 22) {
      return 'concerning';
    }
    return 'stable';
  }

  private statusLabelFor(severity: MedicalMonitorPanelData['severity'], language: 'ar' | 'en') {
    if (language === 'ar') {
      switch (severity) {
        case 'stable': return 'مستقرة';
        case 'concerning': return 'مقلقة';
        case 'unstable': return 'غير مستقرة';
        case 'critical': return 'حرجة';
        default: return 'مقلقة';
      }
    }

    switch (severity) {
      case 'stable': return 'Stable';
      case 'concerning': return 'Concerning';
      case 'unstable': return 'Unstable';
      case 'critical': return 'Critical';
      default: return 'Concerning';
    }
  }

  private trendNoteFor(action: ParsedSimulationAction, language: 'ar' | 'en') {
    const hasOxygen = action.interventionTargets.includes('oxygen');
    const hasFluids = action.interventionTargets.includes('iv-fluids');
    if (language === 'ar') {
      if (hasOxygen) return 'تشبّع الأكسجين يتحسن تدريجيًا بعد التدخل.';
      if (hasFluids) return 'الضغط يستجيب تدريجيًا للسوائل.';
      if (action.interventionTargets.includes('airway')) return 'تحسن في التهوية بعد دعم مجرى الهواء.';
      return 'العلامات الحيوية تتحرك حسب الاستجابة السريرية.';
    }

    if (hasOxygen) return 'Oxygen saturation is improving after intervention.';
    if (hasFluids) return 'Blood pressure is responding to fluids.';
    if (action.interventionTargets.includes('airway')) return 'Ventilation is improving after airway support.';
    return 'Vitals are shifting based on clinical response.';
  }

  private buildActionSummary(action: ParsedSimulationAction, input: string, language: 'ar' | 'en') {
    const raw = input.trim();
    if (raw.length <= 80) {
      return raw;
    }

    if (action.interventionTargets.includes('oxygen')) {
      return language === 'ar' ? 'أكسجين/قناع' : 'Oxygen support';
    }
    if (action.interventionTargets.includes('iv-fluids')) {
      return language === 'ar' ? 'سوائل وريدية' : 'IV fluids';
    }
    if (action.interventionTargets.includes('monitoring')) {
      return language === 'ar' ? 'مراقبة حيوية' : 'Vitals monitoring';
    }
    return raw.slice(0, 80);
  }

  private ensureMonitorLive(monitor: MedicalMonitorPanelData): MedicalMonitorPanelData {
    const patientState = {
      ...monitor.patientState,
      monitoringActive: true
    };
    return { ...monitor, patientState };
  }

  private mergePatientState(current: MedicalMonitorPanelData | null, target: MedicalMonitorPanelData): MedicalPatientStatePanelData {
    if (!current) {
      return target.patientState;
    }

    return {
      ...target.patientState,
      activeInterventions: current.patientState.activeInterventions.length > 0
        ? current.patientState.activeInterventions
        : target.patientState.activeInterventions,
      recentActions: current.patientState.recentActions.length > 0
        ? current.patientState.recentActions
        : target.patientState.recentActions,
      lastClinicianResponse: current.patientState.lastClinicianResponse || target.patientState.lastClinicianResponse,
      monitoringActive: current.patientState.monitoringActive || target.patientState.monitoringActive
    };
  }

  private clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, Math.round(value * 10) / 10));
  }
}
