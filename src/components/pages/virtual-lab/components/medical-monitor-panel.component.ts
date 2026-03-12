import { ChangeDetectionStrategy, Component, OnDestroy, computed, effect, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ClinicalAbgPanelResult,
  ClinicalImagingResult,
  ClinicalLabPanelResult,
  ClinicalResultViewer,
  MedicalMonitorPanelData,
  PanelConfig
} from '../models/virtual-lab.models';

@Component({
  selector: 'app-medical-monitor-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (config()?.monitor; as monitor) {
      <div class="flex h-full min-h-0 flex-col overflow-hidden">
        <div class="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:rgba(71,85,105,0.95)_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-600/90 [&::-webkit-scrollbar-track]:bg-transparent">
        <section class="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-[11px] font-black uppercase tracking-[0.28em] text-slate-500">{{ ui('الحالة الحالية', 'Live Status') }}</p>
              <p class="mt-2 text-lg font-black" [ngClass]="statusTextClasses(monitor)">{{ monitor.statusLabel }}</p>
            </div>
            <div class="rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em]"
                 [ngClass]="statusChipClasses(monitor)">
              {{ monitor.severity }}
            </div>
          </div>
          <p class="mt-3 text-sm leading-7 text-slate-300">{{ monitor.trendNote }}</p>
          <div class="mt-4 flex flex-wrap items-center gap-2">
            <span class="rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em]" [ngClass]="liveBadgeClasses(monitor)">
              {{ monitor.patientState.monitoringActive || monitor.alarmActive ? ui('المونيتور يعمل', 'Monitor Live') : ui('عرض ساكن', 'Passive View') }}
            </span>
            @if (monitor.alarmActive) {
              <span class="rounded-full border border-rose-400/25 bg-rose-500/12 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-rose-100 animate-pulse">
                {{ ui('إنذار', 'Alarm') }}
              </span>
            }
          </div>
          @if (clinical()?.alerts?.length) {
            <div class="mt-4 space-y-2">
              @for (alert of clinical()?.alerts || []; track alert) {
                <div class="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-100">
                  {{ alert }}
                </div>
              }
            </div>
          }
        </section>

        <section class="rounded-[1.45rem] border border-emerald-400/14 bg-[linear-gradient(180deg,rgba(2,6,23,0.94),rgba(2,6,23,0.86))] p-4 shadow-[inset_0_0_32px_rgba(16,185,129,0.06)]">
          <div class="mb-3 flex items-center justify-between gap-3">
            <div>
              <p class="text-[11px] font-black uppercase tracking-[0.24em] text-emerald-300/75">{{ ui('المونيتور الحيوي', 'Live Monitor Feed') }}</p>
              <p class="mt-1 text-xs font-semibold text-slate-400">{{ ui('تحديث حي مرتبط بالحالة الحالية', 'Live signal tied to the current case state') }}</p>
            </div>
            <div class="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-100">
              <span class="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(74,222,128,0.9)]" [class.animate-ping]="monitor.patientState.monitoringActive || monitor.alarmActive"></span>
              <span>{{ ui('مباشر', 'Live') }}</span>
            </div>
          </div>
          <div class="grid [grid-template-columns:repeat(24,minmax(0,1fr))] items-end gap-1 overflow-hidden rounded-[1.15rem] border border-emerald-400/12 bg-black/25 px-2 py-3">
            @for (bar of waveformBars(); track $index) {
              <span
                class="rounded-full bg-gradient-to-t from-emerald-500/35 via-emerald-400/70 to-cyan-200/90 transition-[height,opacity,transform] duration-150"
                [style.height.%]="bar"
                [style.opacity]="barOpacity($index)"
                [style.transform]="barTransform($index)"
              ></span>
            }
          </div>
        </section>

        <section class="grid grid-cols-2 gap-3">
          <div class="rounded-[1.4rem] border border-white/10 bg-slate-950/80 p-4">
            <p class="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">HR</p>
            <p class="mt-2 text-3xl font-black tabular-nums text-white">{{ displayHeartRate() }}</p>
            <p class="text-xs font-semibold text-slate-500">bpm</p>
          </div>
          <div class="rounded-[1.4rem] border border-white/10 bg-slate-950/80 p-4">
            <p class="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">SpO2</p>
            <p class="mt-2 text-3xl font-black tabular-nums" [class.text-cyan-300]="displayOxygenSaturation() >= 94" [class.text-amber-300]="displayOxygenSaturation() < 94 && displayOxygenSaturation() >= 90" [class.text-rose-300]="displayOxygenSaturation() < 90">{{ displayOxygenSaturation() }}%</p>
            <p class="text-xs font-semibold text-slate-500">oxygen</p>
          </div>
          <div class="rounded-[1.4rem] border border-white/10 bg-slate-950/80 p-4">
            <p class="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">BP</p>
            <p class="mt-2 text-2xl font-black tabular-nums text-white">{{ displayBloodPressure() }}</p>
            <p class="text-xs font-semibold text-slate-500">mmHg</p>
          </div>
          <div class="rounded-[1.4rem] border border-white/10 bg-slate-950/80 p-4">
            <p class="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">RR</p>
            <p class="mt-2 text-2xl font-black tabular-nums text-white">{{ displayRespiratoryRate() }}</p>
            <p class="text-xs font-semibold text-slate-500">/min</p>
          </div>
        </section>

        @if (clinical(); as dashboard) {
          <section class="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-[11px] font-black uppercase tracking-[0.28em] text-slate-500">{{ ui('بيانات المريض', 'Patient Chart') }}</p>
                <h4 class="mt-2 text-xl font-black text-white">{{ dashboard.patientChart.patientName }}</h4>
                <p class="mt-1 text-sm font-semibold text-slate-300">{{ dashboard.patientChart.caseTitle }}</p>
              </div>
              <div class="text-right text-xs font-bold text-slate-400">
                <p>{{ dashboard.patientChart.age }}</p>
                <p>{{ dashboard.patientChart.sex }}</p>
              </div>
            </div>

            <div class="mt-4 grid gap-3 md:grid-cols-2">
              <div class="rounded-2xl border border-white/8 bg-slate-950/80 p-3">
                <p class="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">{{ ui('الشكوى الرئيسية', 'Chief Complaint') }}</p>
                <p class="mt-2 text-sm leading-7 text-slate-200">{{ dashboard.patientChart.chiefComplaint }}</p>
              </div>
              <div class="rounded-2xl border border-white/8 bg-slate-950/80 p-3">
                <p class="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">{{ ui('ملاحظة الفرز', 'Triage Note') }}</p>
                <p class="mt-2 text-sm leading-7 text-slate-200">{{ dashboard.patientChart.triageNote }}</p>
              </div>
            </div>

            <div class="mt-4 space-y-3">
              <div class="rounded-2xl border border-white/8 bg-slate-950/80 p-3">
                <p class="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">{{ ui('التاريخ المرضي الحالي', 'History of Present Illness') }}</p>
                <div class="mt-2 space-y-2">
                  @for (item of dashboard.patientChart.historyOfPresentIllness; track item) {
                    <p class="text-sm leading-7 text-slate-200">{{ item }}</p>
                  }
                </div>
              </div>
              <div class="grid gap-3 sm:grid-cols-3">
                <div class="rounded-2xl border border-white/8 bg-slate-950/80 p-3">
                  <p class="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">{{ ui('السابق المرضي', 'Past History') }}</p>
                  @for (item of dashboard.patientChart.pastHistory; track item) {
                    <p class="mt-2 text-sm leading-7 text-slate-200">{{ item }}</p>
                  }
                </div>
                <div class="rounded-2xl border border-white/8 bg-slate-950/80 p-3">
                  <p class="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">{{ ui('الأدوية', 'Medications') }}</p>
                  @for (item of dashboard.patientChart.medicationHistory; track item) {
                    <p class="mt-2 text-sm leading-7 text-slate-200">{{ item }}</p>
                  }
                </div>
                <div class="rounded-2xl border border-white/8 bg-slate-950/80 p-3">
                  <p class="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">{{ ui('الحساسية / المخاطر', 'Allergies / Risks') }}</p>
                  @for (item of [...dashboard.patientChart.allergies, ...dashboard.patientChart.riskFlags].slice(0, 5); track item) {
                    <p class="mt-2 text-sm leading-7 text-slate-200">{{ item }}</p>
                  }
                </div>
              </div>
            </div>
          </section>

          <section class="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
            <div class="flex items-center justify-between gap-3">
              <p class="text-[11px] font-black uppercase tracking-[0.28em] text-slate-500">{{ ui('الفحص السريري', 'Physical Exam') }}</p>
              <span class="rounded-full border border-white/10 bg-slate-950/80 px-3 py-1 text-[11px] font-black text-slate-200">
                {{ dashboard.highlightedExams.length }}
              </span>
            </div>
            <div class="mt-4 space-y-3">
              @for (exam of dashboard.highlightedExams; track exam.id) {
                <div class="rounded-2xl border border-white/8 bg-slate-950/80 p-3">
                  <div class="flex items-center justify-between gap-3">
                    <p class="text-sm font-black text-white">{{ exam.label }}</p>
                    <span class="rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]"
                          [ngClass]="examStatusClasses(exam.status)">
                      {{ exam.status }}
                    </span>
                  </div>
                  <p class="mt-2 text-sm leading-7 text-slate-300">{{ exam.summary }}</p>
                  <div class="mt-2 space-y-1">
                    @for (item of exam.findings; track item) {
                      <p class="text-sm leading-7 text-slate-200">{{ item }}</p>
                    }
                  </div>
                </div>
              }
            </div>
          </section>

          <section class="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
            <div class="flex items-center justify-between gap-3">
              <p class="text-[11px] font-black uppercase tracking-[0.28em] text-slate-500">{{ ui('النتائج والفحوصات', 'Investigations & Results') }}</p>
              <span class="rounded-full border border-white/10 bg-slate-950/80 px-3 py-1 text-[11px] font-black text-slate-200">{{ dashboard.results.length }}</span>
            </div>

            @if (featuredResult(); as result) {
              <div class="mt-4 rounded-[1.4rem] border border-white/8 bg-slate-950/90 p-4">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="text-sm font-black text-white">{{ result.title }}</p>
                    <p class="mt-1 text-xs font-semibold text-slate-400">{{ result.subtitle }}</p>
                  </div>
                  @if (result.urgent) {
                    <span class="rounded-full border border-rose-400/20 bg-rose-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-rose-100">
                      {{ ui('عاجل', 'Urgent') }}
                    </span>
                  }
                </div>

                @switch (result.kind) {
                  @case ('lab-panel') {
                    <div class="mt-4 space-y-3">
                      @for (group of asLabPanel(result).groups; track group.id) {
                        <div class="overflow-hidden rounded-2xl border border-white/8">
                          <div class="bg-slate-900 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-slate-300">{{ group.label }}</div>
                          <div class="divide-y divide-white/6">
                            @for (item of group.items; track item.name) {
                              <div class="grid grid-cols-[1fr_auto] gap-3 px-4 py-2.5 text-sm">
                                <div>
                                  <p class="font-semibold text-slate-200">{{ item.name }}</p>
                                  @if (item.reference) {
                                    <p class="text-xs text-slate-500">{{ item.reference }}</p>
                                  }
                                </div>
                                <p class="font-black" [ngClass]="labFlagClasses(item.flag || 'normal')">{{ item.value }} {{ item.unit || '' }}</p>
                              </div>
                            }
                          </div>
                        </div>
                      }
                    </div>
                  }
                  @case ('abg') {
                    <div class="mt-4 grid gap-3 sm:grid-cols-2">
                      @for (item of asAbg(result).values; track item.name) {
                        <div class="rounded-2xl border border-white/8 bg-slate-900/80 px-4 py-3">
                          <p class="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{{ item.name }}</p>
                          <p class="mt-2 text-xl font-black" [ngClass]="labFlagClasses(item.flag || 'normal')">{{ item.value }} {{ item.unit || '' }}</p>
                        </div>
                      }
                    </div>
                    <div class="mt-3 rounded-2xl border border-cyan-400/15 bg-cyan-500/8 px-4 py-3 text-sm leading-7 text-cyan-50">
                      {{ asAbg(result).interpretation }}
                    </div>
                  }
                  @case ('ecg') {
                    <div class="mt-4 overflow-hidden rounded-[1.3rem] border border-emerald-400/20 bg-slate-950">
                      <img [src]="ecgAsset(result)" [alt]="result.title" class="h-auto w-full">
                    </div>
                    <div class="mt-3 space-y-2">
                      @for (item of result.findings; track item) {
                        <div class="rounded-2xl border border-white/8 bg-slate-900/80 px-4 py-3 text-sm leading-7 text-slate-200">{{ item }}</div>
                      }
                    </div>
                  }
                  @case ('imaging') {
                    <div class="mt-4 overflow-hidden rounded-[1.4rem] border border-white/10">
                      <div class="relative h-48" [ngClass]="imagingToneClasses(asImaging(result).tone)">
                        <div class="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.14),transparent_44%)]"></div>
                        <div class="absolute inset-x-4 top-4 flex flex-wrap gap-2">
                          @for (annotation of asImaging(result).annotations; track annotation) {
                            <span class="rounded-full border border-white/15 bg-black/30 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white">
                              {{ annotation }}
                            </span>
                          }
                        </div>
                        <div class="absolute bottom-4 left-4 right-4 rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm leading-7 text-slate-100 backdrop-blur-sm">
                          {{ asImaging(result).impression }}
                        </div>
                      </div>
                    </div>
                    <div class="mt-3 space-y-2">
                      @for (item of asImaging(result).findings; track item) {
                        <div class="rounded-2xl border border-white/8 bg-slate-900/80 px-4 py-3 text-sm leading-7 text-slate-200">{{ item }}</div>
                      }
                    </div>
                  }
                }

                <p class="mt-4 text-sm leading-7 text-slate-300">{{ result.note }}</p>
              </div>
            } @else {
              <div class="mt-4 rounded-2xl border border-dashed border-white/10 bg-slate-950/60 px-4 py-6 text-sm font-medium text-slate-500">
                {{ ui('اطلب ECG أو ABG أو CBC أو imaging لتظهر النتائج هنا بشكل منظم.', 'Order ECG, ABG, CBC, or imaging to surface organized results here.') }}
              </div>
            }
          </section>

          <section class="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
            <div class="grid gap-4 lg:grid-cols-2">
              <div>
                <div class="flex items-center justify-between gap-3">
                  <p class="text-[11px] font-black uppercase tracking-[0.28em] text-slate-500">{{ ui('التدخلات النشطة', 'Active Interventions') }}</p>
                  <span class="rounded-full border border-white/10 bg-slate-950/80 px-3 py-1 text-[11px] font-black text-slate-200">{{ monitor.patientState.activeInterventions.length }}</span>
                </div>
                <div class="mt-4 space-y-2">
                  @for (item of monitor.patientState.activeInterventions; track item.id) {
                    <div class="rounded-2xl border px-4 py-3" [ngClass]="interventionCardClasses(item.intensity)">
                      <p class="text-sm font-black text-white">{{ item.label }}</p>
                      <p class="mt-1 text-sm leading-7 text-slate-300">{{ item.detail }}</p>
                    </div>
                  } @empty {
                    <div class="rounded-2xl border border-dashed border-white/10 bg-slate-950/60 px-4 py-4 text-sm text-slate-500">
                      {{ ui('لا توجد تدخلات فعالة حتى الآن.', 'No active interventions yet.') }}
                    </div>
                  }
                </div>
              </div>

              <div>
                <div class="flex items-center justify-between gap-3">
                  <p class="text-[11px] font-black uppercase tracking-[0.28em] text-slate-500">{{ ui('التشخيصات التفريقية', 'Differential Diagnoses') }}</p>
                  <span class="rounded-full border border-white/10 bg-slate-950/80 px-3 py-1 text-[11px] font-black text-slate-200">{{ dashboard.differentials.length }}</span>
                </div>
                <div class="mt-4 space-y-2">
                  @for (dx of dashboard.differentials; track dx.diagnosis) {
                    <div class="rounded-2xl border border-white/8 bg-slate-950/80 px-4 py-3">
                      <div class="flex items-center justify-between gap-3">
                        <p class="text-sm font-black text-white">{{ dx.diagnosis }}</p>
                        <span class="rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]"
                              [ngClass]="dxConfidenceClasses(dx.confidence, dx.primary || false)">
                          {{ dx.confidence }}
                        </span>
                      </div>
                      <p class="mt-2 text-sm leading-7 text-slate-300">{{ dx.rationale }}</p>
                    </div>
                  }
                </div>
              </div>
            </div>
          </section>

          <section class="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
            <div class="grid gap-4 lg:grid-cols-2">
              <div>
                <div class="flex items-center justify-between gap-3">
                  <p class="text-[11px] font-black uppercase tracking-[0.28em] text-slate-500">{{ ui('الأوامر المعلقة', 'Pending Orders') }}</p>
                  <span class="rounded-full border border-white/10 bg-slate-950/80 px-3 py-1 text-[11px] font-black text-slate-200">{{ monitor.patientState.pendingOrders.length }}</span>
                </div>
                <div class="mt-4 space-y-2">
                  @for (order of monitor.patientState.pendingOrders; track order.id) {
                    <div class="rounded-2xl border border-white/8 bg-slate-950/80 px-4 py-3">
                      <div class="flex items-center justify-between gap-3">
                        <p class="text-sm font-black text-white">{{ order.label }}</p>
                        <span class="rounded-full border border-amber-400/20 bg-amber-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-amber-100">
                          {{ order.status }}
                        </span>
                      </div>
                      <p class="mt-2 text-sm leading-7 text-slate-300">{{ order.instructions }}</p>
                    </div>
                  } @empty {
                    <div class="rounded-2xl border border-dashed border-white/10 bg-slate-950/60 px-4 py-4 text-sm text-slate-500">
                      {{ ui('لا توجد أوامر رئيسية معلقة حالياً.', 'No major pending orders at the moment.') }}
                    </div>
                  }
                </div>
              </div>

              <div class="space-y-4">
                <div>
                  <div class="flex items-center justify-between gap-3">
                    <p class="text-[11px] font-black uppercase tracking-[0.28em] text-slate-500">{{ ui('مذكرة سريرية حديثة', 'Latest Clinical Note') }}</p>
                    <span class="rounded-full border border-white/10 bg-slate-950/80 px-3 py-1 text-[11px] font-black text-slate-200">{{ monitor.patientState.recentActions.length }}</span>
                  </div>
                  <div class="mt-4 rounded-2xl border border-white/8 bg-slate-950/80 px-4 py-3 text-sm leading-7 text-slate-200">
                    {{ monitor.patientState.lastClinicianResponse || ui('لم تُسجل استجابة سريرية بعد.', 'No clinical response has been logged yet.') }}
                  </div>
                </div>

                <div>
                  <div class="flex items-center justify-between gap-3">
                    <p class="text-[11px] font-black uppercase tracking-[0.28em] text-slate-500">{{ ui('الأهداف التعليمية', 'Learning Focus') }}</p>
                    <span class="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-[11px] font-black text-cyan-100">{{ dashboard.learningFocus.length }}</span>
                  </div>
                  <div class="mt-4 flex flex-wrap gap-2">
                    @for (item of dashboard.learningFocus; track item) {
                      <span class="rounded-full border border-cyan-400/18 bg-cyan-500/8 px-3 py-2 text-xs font-black text-cyan-50">
                        {{ item }}
                      </span>
                    }
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section class="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
            <div class="flex items-center justify-between gap-3">
              <p class="text-[11px] font-black uppercase tracking-[0.28em] text-slate-500">{{ ui('التقدم السريري', 'Clinical Timeline') }}</p>
              <span class="rounded-full border border-white/10 bg-slate-950/80 px-3 py-1 text-[11px] font-black text-slate-200">{{ dashboard.timeline.length }}</span>
            </div>
            <div class="mt-4 space-y-3">
              @for (event of dashboard.timeline; track event.id) {
                <div class="rounded-2xl border px-4 py-3" [ngClass]="timelineToneClasses(event.tone)">
                  <div class="flex items-center justify-between gap-3">
                    <p class="text-sm font-black text-white">{{ event.title }}</p>
                    <span class="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">{{ event.timeLabel }}</span>
                  </div>
                  <p class="mt-2 text-sm leading-7 text-slate-200">{{ event.detail }}</p>
                </div>
              }
            </div>
          </section>

          <section class="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
            <div class="flex items-center justify-between gap-3">
              <p class="text-[11px] font-black uppercase tracking-[0.28em] text-slate-500">{{ ui('محاور الأداء أثناء الحالة', 'Live Learning Score') }}</p>
              <span class="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-[11px] font-black text-cyan-100">{{ overallScore(dashboard) }}</span>
            </div>
            <div class="mt-4 grid gap-3 sm:grid-cols-2">
              @for (metric of dashboard.scoreCards; track metric.id) {
                <div class="rounded-2xl border border-white/8 bg-slate-950/80 p-4">
                  <p class="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{{ metric.label }}</p>
                  <div class="mt-2 flex items-end justify-between gap-3">
                    <p class="text-2xl font-black text-white">{{ metric.score }}</p>
                    <span class="rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]" [ngClass]="metricStatusClasses(metric.status)">
                      {{ metric.status }}
                    </span>
                  </div>
                  <p class="mt-2 text-sm leading-7 text-slate-300">{{ metric.note }}</p>
                </div>
              }
            </div>
          </section>
        }
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MedicalMonitorPanelComponent implements OnDestroy {
  readonly config = input<PanelConfig | null>(null);
  readonly clinical = computed(() => this.config()?.clinical || null);
  readonly animationStep = signal(0);
  readonly featuredResult = computed(() => {
    const dashboard = this.clinical();
    if (!dashboard) return null;
    return dashboard.results.find((item) => item.id === dashboard.featuredResultId) || dashboard.results[dashboard.results.length - 1] || null;
  });
  readonly displayHeartRate = computed(() => {
    const monitor = this.config()?.monitor;
    if (!monitor) return 0;
    return this.animateInteger(monitor.heartRate, 2, 30, 210);
  });
  readonly displayOxygenSaturation = computed(() => {
    const monitor = this.config()?.monitor;
    if (!monitor) return 0;
    return this.animateInteger(monitor.oxygenSaturation, monitor.alarmActive ? 2 : 1, 60, 100);
  });
  readonly displayRespiratoryRate = computed(() => {
    const monitor = this.config()?.monitor;
    if (!monitor) return 0;
    return this.animateInteger(monitor.respiratoryRate, 1, 6, 48);
  });
  readonly displayBloodPressure = computed(() => {
    const monitor = this.config()?.monitor;
    if (!monitor) return '0/0';
    const systolic = this.animateInteger(monitor.bloodPressureSystolic, 3, 40, 220, 0.7);
    const diastolic = this.animateInteger(monitor.bloodPressureDiastolic, 2, 20, 160, 1.4);
    return `${systolic}/${diastolic}`;
  });
  readonly waveformBars = computed(() => {
    const monitor = this.config()?.monitor;
    const step = this.animationStep();
    if (!monitor) {
      return [];
    }

    const live = this.isMonitorLive(monitor);
    const barCount = 24;
    const cursor = step % barCount;

    return Array.from({ length: barCount }, (_, index) => {
      const base = live ? 14 + Math.abs(Math.sin((index + step) / 2.4)) * 12 : 10;
      const distance = Math.min(Math.abs(index - cursor), barCount - Math.abs(index - cursor));
      const spike = this.waveSpikeHeight(distance, monitor);
      return Math.max(10, Math.min(96, Math.round(base + spike)));
    });
  });

  private beatIntervalId: number | null = null;
  private beatDelayMs: number | null = null;
  private beatTone: 'beat' | 'alarm' | null = null;
  private audioContext: AudioContext | null = null;

  constructor() {
    effect(() => {
      const monitor = this.config()?.monitor;
      if (!monitor || !this.isMonitorLive(monitor)) {
        this.stopBeatLoop();
        return;
      }

      const delay = this.resolveBeatDelay(monitor);
      const tone = monitor.alarmActive ? 'alarm' as const : 'beat' as const;
      if (this.beatIntervalId !== null && this.beatDelayMs === delay && this.beatTone === tone) {
        return;
      }

      this.startBeatLoop(delay, tone);
    });
  }

  ui(arabic: string, english: string) {
    const dashboard = this.clinical();
    return dashboard && /[\u0600-\u06FF]/.test(dashboard.patientChart.caseTitle) ? arabic : english;
  }

  ngOnDestroy() {
    this.stopBeatLoop();
    if (this.audioContext) {
      void this.audioContext.close().catch(() => undefined);
      this.audioContext = null;
    }
  }

  liveBadgeClasses(monitor: MedicalMonitorPanelData) {
    const live = this.isMonitorLive(monitor);
    return {
      'border-emerald-400/20 bg-emerald-500/10 text-emerald-100': live && !monitor.alarmActive,
      'border-rose-400/20 bg-rose-500/10 text-rose-100': monitor.alarmActive,
      'border-white/10 bg-white/5 text-slate-300': !live
    };
  }

  barOpacity(index: number) {
    const cursor = this.animationStep() % 24;
    const distance = Math.min(Math.abs(index - cursor), 24 - Math.abs(index - cursor));
    return distance <= 1 ? 1 : distance <= 3 ? 0.82 : 0.62;
  }

  barTransform(index: number) {
    const cursor = this.animationStep() % 24;
    const distance = Math.min(Math.abs(index - cursor), 24 - Math.abs(index - cursor));
    return distance === 0 ? 'translateY(-2px)' : 'translateY(0)';
  }

  private isMonitorLive(monitor: MedicalMonitorPanelData) {
    return monitor.patientState.monitoringActive || monitor.alarmActive;
  }

  private animateInteger(baseValue: number, amplitude: number, min: number, max: number, phaseOffset: number = 0) {
    const monitor = this.config()?.monitor;
    if (!monitor || !this.isMonitorLive(monitor)) {
      return Math.round(baseValue);
    }

    const phase = this.animationStep() * 0.85 + phaseOffset;
    const nextValue = baseValue + Math.sin(phase) * amplitude + Math.cos(phase / 2.1) * (amplitude * 0.35);
    return Math.max(min, Math.min(max, Math.round(nextValue)));
  }

  private waveSpikeHeight(distance: number, monitor: MedicalMonitorPanelData) {
    const spikeMap: Record<MedicalMonitorPanelData['ecgPreset'], number[]> = {
      normal: [54, 24, 10, 4],
      stemi: [60, 28, 14, 6],
      af: [42, 20, 9, 4],
      vtach: [72, 36, 18, 8]
    };
    const values = spikeMap[monitor.ecgPreset] || spikeMap.normal;
    const amplitude = monitor.alarmActive ? 1.16 : 1;
    return distance < values.length ? values[distance] * amplitude : 0;
  }

  private resolveBeatDelay(monitor: MedicalMonitorPanelData) {
    const bpm = Math.max(42, Math.min(180, monitor.heartRate));
    const delay = Math.round(60000 / bpm);
    return monitor.alarmActive ? Math.max(360, Math.round(delay * 0.82)) : Math.max(420, delay);
  }

  private startBeatLoop(delay: number, tone: 'beat' | 'alarm') {
    this.stopBeatLoop();
    this.beatDelayMs = delay;
    this.beatTone = tone;
    this.emitPulse(tone);
    this.beatIntervalId = window.setInterval(() => this.emitPulse(tone), delay);
  }

  private stopBeatLoop() {
    if (this.beatIntervalId !== null) {
      window.clearInterval(this.beatIntervalId);
      this.beatIntervalId = null;
    }

    this.beatDelayMs = null;
    this.beatTone = null;
  }

  private emitPulse(tone: 'beat' | 'alarm') {
    this.animationStep.update((value) => value + 1);
    this.playMonitorTone(tone);
  }

  private playMonitorTone(tone: 'beat' | 'alarm') {
    if (typeof window === 'undefined' || document.visibilityState !== 'visible') {
      return;
    }

    const AudioContextCtor = window.AudioContext || (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) {
      return;
    }

    if (!this.audioContext) {
      this.audioContext = new AudioContextCtor();
    }

    const context = this.audioContext;
    if (context.state === 'suspended') {
      void context.resume().catch(() => undefined);
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = tone === 'alarm' ? 'square' : 'triangle';
    oscillator.frequency.setValueAtTime(tone === 'alarm' ? 880 : 520, context.currentTime);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(tone === 'alarm' ? 0.028 : 0.014, context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + (tone === 'alarm' ? 0.12 : 0.08));
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + (tone === 'alarm' ? 0.14 : 0.1));
  }

  asLabPanel(result: ClinicalResultViewer) {
    return result as ClinicalLabPanelResult;
  }

  asAbg(result: ClinicalResultViewer) {
    return result as ClinicalAbgPanelResult;
  }

  asImaging(result: ClinicalResultViewer) {
    return result as ClinicalImagingResult;
  }

  ecgAsset(result: ClinicalResultViewer) {
    if (result.kind !== 'ecg') {
      return 'assets/virtual-lab/ecg/normal.svg';
    }

    return `assets/virtual-lab/ecg/${result.preset}.svg`;
  }

  overallScore(dashboard: NonNullable<ReturnType<typeof this.clinical>>) {
    const scores = dashboard.scoreCards.map((item) => item.score);
    if (scores.length === 0) return '0/100';
    const total = Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length);
    return `${total}/100`;
  }

  statusTextClasses(monitor: MedicalMonitorPanelData) {
    return {
      'text-emerald-300': monitor.severity === 'stable',
      'text-amber-300': monitor.severity === 'concerning' || monitor.severity === 'unstable',
      'text-rose-300': monitor.severity === 'critical'
    };
  }

  statusChipClasses(monitor: MedicalMonitorPanelData) {
    return {
      'border-emerald-400/20 bg-emerald-500/10 text-emerald-100': monitor.severity === 'stable',
      'border-amber-400/20 bg-amber-500/10 text-amber-100': monitor.severity === 'concerning' || monitor.severity === 'unstable',
      'border-rose-400/20 bg-rose-500/10 text-rose-100': monitor.severity === 'critical'
    };
  }

  interventionCardClasses(intensity: 'low' | 'medium' | 'high') {
    return {
      'border-cyan-400/18 bg-cyan-500/8': intensity === 'low',
      'border-amber-400/18 bg-amber-500/8': intensity === 'medium',
      'border-rose-400/18 bg-rose-500/10': intensity === 'high'
    };
  }

  examStatusClasses(status: 'baseline' | 'requested' | 'critical') {
    return {
      'border-white/10 bg-white/5 text-slate-200': status === 'baseline',
      'border-cyan-400/20 bg-cyan-500/10 text-cyan-100': status === 'requested',
      'border-rose-400/20 bg-rose-500/10 text-rose-100': status === 'critical'
    };
  }

  metricStatusClasses(status: 'strong' | 'mixed' | 'weak') {
    return {
      'border-emerald-400/20 bg-emerald-500/10 text-emerald-100': status === 'strong',
      'border-amber-400/20 bg-amber-500/10 text-amber-100': status === 'mixed',
      'border-rose-400/20 bg-rose-500/10 text-rose-100': status === 'weak'
    };
  }

  dxConfidenceClasses(confidence: 'low' | 'medium' | 'high', primary: boolean) {
    return {
      'border-emerald-400/20 bg-emerald-500/10 text-emerald-100': confidence === 'high',
      'border-amber-400/20 bg-amber-500/10 text-amber-100': confidence === 'medium',
      'border-slate-500/20 bg-slate-500/10 text-slate-200': confidence === 'low',
      'shadow-[0_0_0_1px_rgba(16,185,129,0.18)]': primary
    };
  }

  imagingToneClasses(tone: ClinicalImagingResult['tone']) {
    return {
      'bg-[radial-gradient(circle_at_top,rgba(241,245,249,0.18),rgba(15,23,42,0.96))]': tone === 'xray',
      'bg-[radial-gradient(circle_at_center,rgba(148,163,184,0.18),rgba(2,6,23,0.98))]': tone === 'ct',
      'bg-[radial-gradient(circle_at_center,rgba(103,232,249,0.12),rgba(2,6,23,0.98))]': tone === 'ultrasound',
      'bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.12),rgba(2,6,23,0.98))]': tone === 'mri'
    };
  }

  labFlagClasses(flag: 'normal' | 'high' | 'low' | 'critical') {
    return {
      'text-slate-100': flag === 'normal',
      'text-amber-300': flag === 'high' || flag === 'low',
      'text-rose-300': flag === 'critical'
    };
  }

  timelineToneClasses(tone: 'neutral' | 'positive' | 'warning' | 'critical') {
    return {
      'border-white/8 bg-slate-950/80': tone === 'neutral',
      'border-emerald-400/16 bg-emerald-500/8': tone === 'positive',
      'border-amber-400/16 bg-amber-500/8': tone === 'warning',
      'border-rose-400/18 bg-rose-500/10': tone === 'critical'
    };
  }
}
