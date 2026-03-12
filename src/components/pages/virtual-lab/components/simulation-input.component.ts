import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LocalizationService } from '../../../../services/localization.service';
import { NotificationService } from '../../../../services/notification.service';

type SpeechRecognitionResultLike = ArrayLike<{ transcript: string }>;
type SpeechRecognitionEventLike = { results: ArrayLike<SpeechRecognitionResultLike> };
type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

@Component({
  selector: 'app-simulation-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="rounded-[1.45rem] border border-white/10 bg-slate-950/90 p-2 shadow-xl">
      <div class="flex flex-col gap-3">
        <textarea
          #draftInput
          [ngModel]="draft()"
          (ngModelChange)="updateDraft($event)"
          (keydown.enter)="submitFromKeyboard($event)"
          rows="2"
          class="min-h-[68px] w-full resize-none overflow-y-auto rounded-[1.3rem] border border-white/10 bg-slate-900/90 px-4 py-2.5 text-[14px] font-medium leading-7 text-white outline-none transition focus:border-indigo-400 [scrollbar-width:thin] [scrollbar-color:rgba(71,85,105,0.95)_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-600/90 [&::-webkit-scrollbar-track]:bg-transparent"
          [placeholder]="placeholder()"
          [disabled]="disabled()"
          [attr.dir]="language() === 'ar' ? 'rtl' : 'ltr'"
        ></textarea>

        @if (showOptions() && quickOptions().length > 0) {
          <div class="rounded-[1.5rem] border border-white/10 bg-white/5 p-3">
            <div class="mb-3 flex items-center justify-between gap-3">
              <p class="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">{{ ui('خيارات سريعة', 'Quick options') }}</p>
              <button type="button" (click)="showOptions.set(false)" class="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-slate-900/70 text-slate-300 transition hover:bg-white/10">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div class="flex flex-wrap gap-2">
              @for (option of quickOptions(); track option) {
                <button
                  type="button"
                  (click)="submitQuickOption(option)"
                  [disabled]="disabled()"
                  class="rounded-full border border-white/10 bg-slate-900/80 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-50"
                >
                  {{ option }}
                </button>
              }
            </div>
          </div>
        }

        <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <p class="text-[11px] font-medium text-slate-500">{{ ui('اكتب، سجّل صوتك، أو استخدم قائمة المساعدة.', 'Type, use voice, or open the helper menu.') }}</p>

          <div class="relative flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              (click)="toggleRecording()"
              [disabled]="disabled()"
              [title]="ui('تسجيل صوتي', 'Voice input')"
              class="flex h-11 w-11 items-center justify-center rounded-2xl border text-sm text-white transition disabled:opacity-50"
              [class.border-white/10]="!isRecording()"
              [class.bg-white/5]="!isRecording()"
              [class.border-rose-400/40]="isRecording()"
              [class.bg-rose-500/10]="isRecording()"
            >
              <i class="fa-solid" [class.fa-microphone]="!isRecording()" [class.fa-microphone-lines]="isRecording()" [class.animate-pulse]="isRecording()"></i>
            </button>

            <div class="relative">
              <button
                type="button"
                (click)="toggleHelperMenu()"
                [disabled]="disabled()"
                [title]="ui('خيارات إضافية', 'More actions')"
                class="flex h-11 w-11 items-center justify-center rounded-2xl border text-sm text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                [class.border-white/10]="!showHelperMenu()"
                [class.bg-white/5]="!showHelperMenu()"
                [class.border-cyan-400/40]="showHelperMenu()"
                [class.bg-cyan-500/10]="showHelperMenu()"
              >
                <i class="fa-solid fa-ellipsis"></i>
              </button>

              @if (showHelperMenu()) {
                <div class="absolute bottom-[calc(100%+0.75rem)] right-0 z-20 w-64 overflow-hidden rounded-[1.35rem] border border-white/10 bg-slate-950/96 p-2 shadow-2xl backdrop-blur-xl">
                  <p class="px-3 pb-2 text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">{{ ui('قائمة المساعدة', 'Helper Menu') }}</p>
                  @for (action of helperActions(); track action.id) {
                    <button
                      type="button"
                      (click)="chooseHelperAction(action.id)"
                      class="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/5 hover:text-white"
                    >
                      <i [class]="action.icon"></i>
                      <span>{{ action.label }}</span>
                    </button>
                  }
                </div>
              }
            </div>

            <button
              type="button"
              (click)="submit()"
              [disabled]="disabled() || !draft().trim()"
              class="inline-flex items-center justify-center gap-3 rounded-2xl bg-indigo-500 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-indigo-500/20 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
            >
              @if (busy()) {
                <i class="fa-solid fa-spinner animate-spin"></i>
                <span>{{ ui('جارٍ المعالجة', 'Processing') }}</span>
              } @else {
                <i class="fa-solid fa-paper-plane"></i>
                <span>{{ ui('إرسال الرد', 'Send Response') }}</span>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SimulationInputComponent implements OnDestroy {
  private readonly localization = inject(LocalizationService);
  private readonly notifications = inject(NotificationService);
  private readonly draftInput = viewChild<ElementRef<HTMLTextAreaElement>>('draftInput');

  readonly placeholder = input('Describe your next move...');
  readonly disabled = input(false);
  readonly busy = input(false);
  readonly language = input<'ar' | 'en'>('en');
  readonly quickOptions = input<string[]>([]);
  readonly canRequestOptions = input(false);
  readonly submitted = output<string>();
  readonly optionsRequested = output<void>();

  readonly draft = signal('');
  readonly showOptions = signal(false);
  readonly showHelperMenu = signal(false);
  readonly isRecording = signal(false);

  private recognition: SpeechRecognitionInstance | null = null;
  private speechBaseDraft = '';

  constructor() {
    effect(() => {
      this.draft();
      queueMicrotask(() => this.syncTextareaHeight());
    });

    effect(() => {
      const options = this.quickOptions();
      if (options.length === 0) {
        this.showOptions.set(false);
        return;
      }

      if (!this.busy()) {
        this.showOptions.set(true);
      }
    });

    effect(() => {
      if (this.disabled()) {
        this.showOptions.set(false);
        this.showHelperMenu.set(false);
        this.stopRecording();
      }
    });
  }

  updateDraft(value: string) {
    this.draft.set(value);
  }

  submit() {
    const nextValue = this.draft().trim();
    if (!nextValue) {
      return;
    }

    this.stopRecording();
    this.showOptions.set(false);
    this.showHelperMenu.set(false);
    this.submitted.emit(nextValue);
    this.draft.set('');
  }

  submitQuickOption(option: string) {
    if (this.disabled()) {
      return;
    }

    this.stopRecording();
    this.showOptions.set(false);
    this.showHelperMenu.set(false);
    this.submitted.emit(option);
  }

  submitFromKeyboard(event: KeyboardEvent) {
    if (event.shiftKey) {
      return;
    }

    event.preventDefault();
    this.submit();
  }

  toggleRecording() {
    this.showHelperMenu.set(false);
    if (this.isRecording()) {
      this.stopRecording();
      return;
    }

    const RecognitionCtor = this.resolveSpeechRecognitionCtor();
    if (!RecognitionCtor) {
      this.notifications.show(
        this.ui('تسجيل صوتي', 'Voice Input'),
        this.ui('الإدخال الصوتي غير مدعوم في هذا المتصفح.', 'Voice input is not supported in this browser.'),
        'warning',
        'fa-solid fa-microphone-lines-slash'
      );
      return;
    }

    this.speechBaseDraft = this.draft().trim();
    const recognition = new RecognitionCtor();
    recognition.lang = this.localization.getSpeechRecognitionLocale(this.language());
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onstart = () => this.isRecording.set(true);
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || '')
        .join(' ')
        .trim();
      const separator = this.speechBaseDraft && transcript ? ' ' : '';
      this.draft.set(`${this.speechBaseDraft}${separator}${transcript}`.trim());
    };
    recognition.onerror = () => {
      this.notifications.show(
        this.ui('تسجيل صوتي', 'Voice Input'),
        this.ui('يرجى السماح بالوصول إلى الميكروفون ثم المحاولة مرة أخرى.', 'Please allow microphone access and try again.'),
        'warning',
        'fa-solid fa-microphone-lines-slash'
      );
      this.stopRecording();
    };
    recognition.onend = () => {
      this.isRecording.set(false);
      if (this.recognition === recognition) {
        this.recognition = null;
      }
      this.speechBaseDraft = this.draft().trim();
    };

    this.recognition = recognition;
    try {
      recognition.start();
    } catch {
      this.notifications.show(
        this.ui('تسجيل صوتي', 'Voice Input'),
        this.ui('تعذر بدء التسجيل الصوتي الآن.', 'Voice input could not start right now.'),
        'warning',
        'fa-solid fa-microphone-lines-slash'
      );
      this.stopRecording();
    }
  }

  ui(arabic: string, english: string) {
    return this.language() === 'ar' ? arabic : english;
  }

  toggleHelperMenu() {
    if (this.disabled()) {
      return;
    }

    this.showHelperMenu.update((value) => !value);
  }

  chooseHelperAction(id: 'options' | 'explain' | 'summary' | 'tutor' | 'exit') {
    this.showHelperMenu.set(false);

    if (id === 'options') {
      if (!this.canRequestOptions()) {
        return;
      }

      if (this.quickOptions().length > 0) {
        this.showOptions.update((value) => !value);
        return;
      }

      this.optionsRequested.emit();
      return;
    }

    const payload = id === 'explain'
      ? this.ui('أنا لا أفهم. اشرح لي ما يحدث الآن بشكل أوضح.', 'I do not understand. Explain what is happening more clearly.')
      : id === 'summary'
        ? this.ui('لخّص لي ما يحدث الآن وما المطلوب مني تحديدًا.', 'Summarize what is happening now and what exactly is required from me.')
        : id === 'exit'
          ? this.ui('أريد الخروج من الاختبار الآن.', 'I want to exit the lab now.')
          : this.ui('أوقف الحالة وعلمني خطوة بخطوة.', 'Stop the case and teach it to me step by step.');

    this.stopRecording();
    this.showOptions.set(false);
    this.submitted.emit(payload);
  }

  helperActions() {
    return [
      {
        id: 'options' as const,
        label: this.ui('أعطني خيارات', 'Show options'),
        icon: 'fa-solid fa-bars-staggered'
      },
      {
        id: 'explain' as const,
        label: this.ui('لم أفهم، اشرح أكثر', 'I did not understand'),
        icon: 'fa-solid fa-circle-question'
      },
      {
        id: 'summary' as const,
        label: this.ui('لخّص ما يحدث', 'Summarize this'),
        icon: 'fa-solid fa-file-lines'
      },
      {
        id: 'tutor' as const,
        label: this.ui('أوقف الحالة وعلّمني', 'Pause and teach me'),
        icon: 'fa-solid fa-graduation-cap'
      },
      {
        id: 'exit' as const,
        label: this.ui('الخروج من الاختبار', 'Exit the lab'),
        icon: 'fa-solid fa-door-open'
      }
    ];
  }

  ngOnDestroy() {
    this.stopRecording();
  }

  private syncTextareaHeight() {
    const element = this.draftInput()?.nativeElement;
    if (!element) {
      return;
    }

    element.style.height = '0px';
    element.style.height = `${Math.min(element.scrollHeight, 116)}px`;
  }

  private stopRecording() {
    const activeRecognition = this.recognition;
    this.recognition = null;
    this.isRecording.set(false);
    this.speechBaseDraft = this.draft().trim();
    activeRecognition?.stop();
  }

  private resolveSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const browserWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };

    return browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition || null;
  }
}
