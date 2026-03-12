import { ChangeDetectionStrategy, Component, effect, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  ScenarioConfig,
  ScenarioDifficulty,
  SimulationDurationMinutes,
  VIRTUAL_LAB_DIFFICULTY_OPTIONS,
  VIRTUAL_LAB_DURATION_OPTIONS
} from '../models/virtual-lab.models';

@Component({
  selector: 'app-setup-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="handleSubmit()" class="rounded-[2.4rem] border border-white/10 bg-slate-950/70 p-6 shadow-2xl md:p-8">
      <div class="space-y-3 text-left">
        <p class="text-[11px] font-black uppercase tracking-[0.32em] text-slate-400">{{ eyebrow() }}</p>
        <h2 class="text-3xl font-black tracking-tight text-white md:text-4xl">{{ title() }}</h2>
        <p class="max-w-2xl text-sm font-medium leading-7 text-slate-300">{{ subtitle() }}</p>
      </div>

      <div class="mt-8 grid gap-5">
        <label class="space-y-3">
          <span class="text-sm font-black text-white">{{ specialtyLabel() }}</span>
          <input
            formControlName="specialty"
            type="text"
            class="w-full rounded-2xl border border-white/10 bg-slate-900 px-5 py-4 text-white outline-none transition focus:border-indigo-400"
            [placeholder]="specialtyPlaceholder()"
          >
        </label>

        <label class="space-y-3">
          <span class="text-sm font-black text-white">{{ scenarioLabel() }}</span>
          <textarea
            formControlName="scenario"
            rows="4"
            class="w-full rounded-2xl border border-white/10 bg-slate-900 px-5 py-4 text-white outline-none transition focus:border-indigo-400"
            [placeholder]="scenarioPlaceholder()"
          ></textarea>
        </label>

        <div class="space-y-3">
          <span class="text-sm font-black text-white">{{ difficultyLabel() }}</span>
          <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            @for (option of difficultyOptions; track option.value) {
              <button
                type="button"
                (click)="form.controls.difficulty.setValue(option.value)"
                class="rounded-2xl border px-4 py-4 text-left transition"
                [class.border-indigo-400]="form.controls.difficulty.value === option.value"
                [class.bg-indigo-500/15]="form.controls.difficulty.value === option.value"
                [class.border-white/10]="form.controls.difficulty.value !== option.value"
                [class.bg-white/5]="form.controls.difficulty.value !== option.value"
              >
                <p class="font-black text-white">{{ option.label }}</p>
                <p class="mt-2 text-xs font-medium leading-6 text-slate-400">{{ option.description }}</p>
              </button>
            }
          </div>
        </div>

        <div class="space-y-3">
          <span class="text-sm font-black text-white">{{ durationLabel() }}</span>
          <div class="grid gap-3 md:grid-cols-3">
            @for (option of durationOptions; track option.value) {
              <button
                type="button"
                (click)="form.controls.durationMinutes.setValue(option.value)"
                class="rounded-2xl border px-4 py-4 text-left transition"
                [class.border-cyan-400]="form.controls.durationMinutes.value === option.value"
                [class.bg-cyan-500/12]="form.controls.durationMinutes.value === option.value"
                [class.border-white/10]="form.controls.durationMinutes.value !== option.value"
                [class.bg-white/5]="form.controls.durationMinutes.value !== option.value"
              >
                <p class="font-black text-white">{{ durationOptionLabel(option.value) }}</p>
                <p class="mt-2 text-xs font-medium leading-6 text-slate-400">{{ durationOptionDescription(option.value) }}</p>
              </button>
            }
          </div>
        </div>
      </div>

      @if (examples().length > 0) {
        <div class="mt-8">
          <p class="mb-3 text-[11px] font-black uppercase tracking-[0.28em] text-slate-500">{{ examplesTitle() }}</p>
          <div class="flex flex-wrap gap-2">
            @for (example of examples(); track example) {
              <button
                type="button"
                (click)="applyExample(example)"
                class="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-slate-200 transition hover:border-white/20 hover:bg-white/10"
              >
                {{ example }}
              </button>
            }
          </div>
        </div>
      }

      @if (errorMessage()) {
        <div class="mt-6 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-200">
          {{ errorMessage() }}
        </div>
      }

      <div class="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-xs font-medium leading-6 text-slate-500">{{ helperText() }}</p>
        <button
          type="submit"
          [disabled]="busy()"
          class="inline-flex items-center justify-center gap-3 rounded-2xl bg-indigo-500 px-6 py-4 text-sm font-black text-white shadow-xl shadow-indigo-500/20 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
        >
          @if (busy()) {
            <i class="fa-solid fa-spinner animate-spin"></i>
            <span>{{ loadingLabel() }}</span>
          } @else {
            <i class="fa-solid fa-bolt"></i>
            <span>{{ submitLabel() }}</span>
          }
        </button>
      </div>
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SetupFormComponent {
  private readonly fb = inject(FormBuilder);

  readonly eyebrow = input.required<string>();
  readonly title = input.required<string>();
  readonly subtitle = input.required<string>();
  readonly specialtyLabel = input.required<string>();
  readonly specialtyPlaceholder = input.required<string>();
  readonly scenarioLabel = input.required<string>();
  readonly scenarioPlaceholder = input.required<string>();
  readonly difficultyLabel = input.required<string>();
  readonly durationLabel = input.required<string>();
  readonly submitLabel = input.required<string>();
  readonly loadingLabel = input.required<string>();
  readonly helperText = input.required<string>();
  readonly examplesTitle = input.required<string>();
  readonly examples = input<string[]>([]);
  readonly busy = input(false);
  readonly errorMessage = input('');
  readonly initialValue = input<ScenarioConfig | null>(null);
  readonly submitted = output<ScenarioConfig>();

  readonly difficultyOptions = VIRTUAL_LAB_DIFFICULTY_OPTIONS;
  readonly durationOptions = VIRTUAL_LAB_DURATION_OPTIONS;

  readonly form = this.fb.nonNullable.group({
    specialty: ['', Validators.required],
    scenario: ['', Validators.required],
    difficulty: ['medium' as ScenarioDifficulty, Validators.required],
    durationMinutes: [10 as SimulationDurationMinutes, Validators.required]
  });

  constructor() {
    effect(() => {
      const value = this.initialValue();
      if (!value) {
        return;
      }

      this.form.patchValue({
        specialty: value.specialty,
        scenario: value.scenario,
        difficulty: value.difficulty,
        durationMinutes: value.durationMinutes || 10
      }, { emitEvent: false });
    });
  }

  applyExample(example: string) {
    const parts = example.split('+').map((value) => value.trim()).filter(Boolean);
    if (parts.length >= 2) {
      this.form.controls.specialty.setValue(parts[0]);
      this.form.controls.scenario.setValue(parts.slice(1).join(' + '));
      return;
    }

    this.form.controls.scenario.setValue(example);
  }

  handleSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.submitted.emit({
      specialty: value.specialty.trim(),
      scenario: value.scenario.trim(),
      difficulty: value.difficulty,
      durationMinutes: value.durationMinutes
    });
  }

  durationOptionLabel(minutes: SimulationDurationMinutes) {
    return `${minutes} min`;
  }

  durationOptionDescription(minutes: SimulationDurationMinutes) {
    const option = this.durationOptions.find((item) => item.value === minutes);
    return option?.description || '';
  }
}
