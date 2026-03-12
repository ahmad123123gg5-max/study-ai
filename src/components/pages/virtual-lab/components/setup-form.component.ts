import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  ScenarioConfig,
  ScenarioDifficulty,
  SimulationReferenceImage,
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
          <div class="flex items-center justify-between gap-3">
            <span class="text-sm font-black text-white">{{ imageLabel() }}</span>
            @if (referenceImages().length > 0) {
              <span class="text-xs font-bold text-cyan-200">{{ referenceImages().length }} {{ imageCountLabel() }}</span>
            }
          </div>

          <label class="block cursor-pointer rounded-[1.7rem] border border-dashed border-white/10 bg-slate-900/70 p-5 transition hover:border-cyan-400/40 hover:bg-slate-900">
            <input
              type="file"
              accept="image/*"
              multiple
              class="hidden"
              (change)="onImageSelected($event)"
            >
            <div class="flex items-center justify-between gap-4">
              <div class="min-w-0">
                <p class="text-sm font-black text-white">{{ imageHelperText() }}</p>
                <p class="mt-2 text-xs font-medium leading-6 text-slate-400">{{ imageNote() }}</p>
              </div>
              <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-100">
                <i class="fa-solid fa-images"></i>
              </div>
            </div>
          </label>

          @if (referenceImages().length > 0) {
            <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              @for (image of referenceImages(); track image.id) {
                <div class="overflow-hidden rounded-[1.4rem] border border-white/10 bg-slate-900/85">
                  <div class="aspect-[4/3] overflow-hidden bg-slate-950">
                    <img [src]="image.dataUrl" [alt]="image.name" class="h-full w-full object-cover">
                  </div>
                  <div class="flex items-center justify-between gap-3 px-4 py-3">
                    <div class="min-w-0">
                      <p class="truncate text-sm font-bold text-white">{{ image.name }}</p>
                      <p class="text-[11px] font-medium text-slate-500">{{ image.mimeType }}</p>
                    </div>
                    <button
                      type="button"
                      (click)="removeImage(image.id)"
                      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-rose-400/20 bg-rose-500/10 text-rose-200 transition hover:bg-rose-500/20"
                    >
                      <i class="fa-solid fa-trash"></i>
                    </button>
                  </div>
                </div>
              }
            </div>
          }
        </div>

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
  readonly imageLabel = input.required<string>();
  readonly imageHelperText = input.required<string>();
  readonly imageNote = input.required<string>();
  readonly imageCountLabel = input('images');
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
  readonly referenceImages = signal<SimulationReferenceImage[]>([]);

  readonly form = this.fb.nonNullable.group({
    specialty: ['', Validators.required],
    scenario: [''],
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
      this.referenceImages.set(Array.isArray(value.referenceImages) ? value.referenceImages : []);
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
      durationMinutes: value.durationMinutes,
      referenceImages: this.referenceImages()
    });
  }

  async onImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []).filter((file) => file.type.startsWith('image/'));
    if (files.length === 0) {
      input.value = '';
      return;
    }

    const nextImages = await Promise.all(files.map((file) => this.readImage(file)));
    this.referenceImages.update((current) => [...current, ...nextImages]);
    input.value = '';
  }

  removeImage(imageId: string) {
    this.referenceImages.update((current) => current.filter((image) => image.id !== imageId));
  }

  durationOptionLabel(minutes: SimulationDurationMinutes) {
    return `${minutes} min`;
  }

  durationOptionDescription(minutes: SimulationDurationMinutes) {
    const option = this.durationOptions.find((item) => item.value === minutes);
    return option?.description || '';
  }

  private readImage(file: File): Promise<SimulationReferenceImage> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error || new Error('Failed to read image file.'));
      reader.onload = () => resolve({
        id: crypto.randomUUID(),
        name: file.name,
        dataUrl: typeof reader.result === 'string' ? reader.result : '',
        mimeType: file.type || 'image/*'
      });
      reader.readAsDataURL(file);
    });
  }
}
