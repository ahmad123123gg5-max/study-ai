import { ChangeDetectionStrategy, Component, HostListener, effect, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AnnotationTool,
  RecordingCaptureMode,
  RecordingSessionState,
  TargetLanguage,
  TranslationViewMode,
  WorkspaceLanguage,
  WorkspaceToolKey
} from '../document-workspace.types';

@Component({
  selector: 'app-workspace-tool-options-bar',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (activeTool()) {
      <div class="toolbar-shell">
        <div class="toolbar-bar pointer-events-auto" role="toolbar" [attr.aria-label]="toolbarAriaLabel()">
          <div class="toolbar-group">
            <span class="tool-icon tool-icon-anchor" [title]="labelFor(activeTool()!)" [attr.aria-label]="labelFor(activeTool()!)">
              <i [class]="iconFor(activeTool()!)"></i>
            </span>
          </div>

          @switch (activeTool()) {
            @case ('reader') {
              <div class="toolbar-group">
                <button type="button" class="tool-icon" title="Download document" aria-label="Download document" (click)="downloadDocument.emit()"><i class="fa-solid fa-download"></i></button>
              </div>
              <div class="toolbar-divider" aria-hidden="true"></div>
              <div class="toolbar-group">
                <button type="button" class="tool-icon" title="Zoom out" aria-label="Zoom out" (click)="zoomOut.emit()"><i class="fa-solid fa-magnifying-glass-minus"></i></button>
                <button type="button" class="tool-icon" title="Zoom in" aria-label="Zoom in" (click)="zoomIn.emit()"><i class="fa-solid fa-magnifying-glass-plus"></i></button>
                <button type="button" class="tool-icon" title="Fit width" aria-label="Fit width" (click)="fitModeChange.emit('width')"><i class="fa-solid fa-left-right"></i></button>
                <button type="button" class="tool-icon" title="Fit page" aria-label="Fit page" (click)="fitModeChange.emit('page')"><i class="fa-solid fa-expand"></i></button>
              </div>
            }

            @case ('draw') {
              <div class="toolbar-group">
                <button type="button" class="tool-icon" [class.tool-icon-active]="annotationTool() === 'free-draw'" [attr.aria-pressed]="annotationTool() === 'free-draw'" title="Pen" aria-label="Pen" (click)="annotationToolChange.emit('free-draw')"><i class="fa-solid fa-pen"></i></button>
              </div>
              <div class="toolbar-divider" aria-hidden="true"></div>
              <div class="toolbar-group">
                <button type="button" class="tool-icon" title="Undo" aria-label="Undo" [disabled]="!canUndo()" (click)="undo.emit()"><i class="fa-solid fa-arrow-rotate-left"></i></button>
                <button type="button" class="tool-icon" title="Redo" aria-label="Redo" [disabled]="!canRedo()" (click)="redo.emit()"><i class="fa-solid fa-arrow-rotate-right"></i></button>
              </div>
            }

            @case ('highlight') {
              <div class="toolbar-group">
                <button type="button" class="tool-icon" [class.tool-icon-active]="annotationTool() === 'highlight'" [attr.aria-pressed]="annotationTool() === 'highlight'" title="Highlight" aria-label="Highlight" (click)="annotationToolChange.emit('highlight')"><i class="fa-solid fa-highlighter"></i></button>
                <button type="button" class="tool-icon" [class.tool-icon-active]="annotationTool() === 'underline'" [attr.aria-pressed]="annotationTool() === 'underline'" title="Underline" aria-label="Underline" (click)="annotationToolChange.emit('underline')"><i class="fa-solid fa-underline"></i></button>
              </div>
            }

            @case ('shapes') {
              <div class="toolbar-group">
                <button type="button" class="tool-icon" [class.tool-icon-active]="annotationTool() === 'rectangle'" [attr.aria-pressed]="annotationTool() === 'rectangle'" title="Rectangle" aria-label="Rectangle" (click)="annotationToolChange.emit('rectangle')"><i class="fa-regular fa-square"></i></button>
                <button type="button" class="tool-icon" [class.tool-icon-active]="annotationTool() === 'circle'" [attr.aria-pressed]="annotationTool() === 'circle'" title="Circle" aria-label="Circle" (click)="annotationToolChange.emit('circle')"><i class="fa-regular fa-circle"></i></button>
              </div>
              <div class="toolbar-divider" aria-hidden="true"></div>
              <div class="toolbar-group">
                <button type="button" class="tool-icon" title="Undo" aria-label="Undo" [disabled]="!canUndo()" (click)="undo.emit()"><i class="fa-solid fa-arrow-rotate-left"></i></button>
                <button type="button" class="tool-icon" title="Redo" aria-label="Redo" [disabled]="!canRedo()" (click)="redo.emit()"><i class="fa-solid fa-arrow-rotate-right"></i></button>
              </div>
            }

            @case ('arrow') {
              <div class="toolbar-group">
                <button type="button" class="tool-icon" [class.tool-icon-active]="annotationTool() === 'arrow'" [attr.aria-pressed]="annotationTool() === 'arrow'" title="Arrow" aria-label="Arrow" (click)="annotationToolChange.emit('arrow')"><i class="fa-solid fa-arrow-right-long"></i></button>
                <button type="button" class="tool-icon tool-icon-danger" title="Delete selected annotation" aria-label="Delete selected annotation" [disabled]="!hasSelectedAnnotation()" (click)="deleteSelected.emit()"><i class="fa-solid fa-trash"></i></button>
              </div>
            }

            @case ('text-note') {
              <div class="toolbar-group">
                <button type="button" class="tool-icon" [class.tool-icon-active]="annotationTool() === 'text-note'" [attr.aria-pressed]="annotationTool() === 'text-note'" title="Text note" aria-label="Text note" (click)="annotationToolChange.emit('text-note')"><i class="fa-solid fa-font"></i></button>
                <button type="button" class="tool-icon" [class.tool-icon-active]="annotationTool() === 'sticky-note'" [attr.aria-pressed]="annotationTool() === 'sticky-note'" title="Sticky note" aria-label="Sticky note" (click)="annotationToolChange.emit('sticky-note')"><i class="fa-solid fa-note-sticky"></i></button>
                <button type="button" class="tool-icon tool-icon-danger" title="Delete selected annotation" aria-label="Delete selected annotation" [disabled]="!hasSelectedAnnotation()" (click)="deleteSelected.emit()"><i class="fa-solid fa-trash"></i></button>
              </div>
            }

            @case ('sticky-note') {
              <div class="toolbar-group">
                <button type="button" class="tool-icon" [class.tool-icon-active]="annotationTool() === 'sticky-note'" [attr.aria-pressed]="annotationTool() === 'sticky-note'" title="Sticky note" aria-label="Sticky note" (click)="annotationToolChange.emit('sticky-note')"><i class="fa-solid fa-note-sticky"></i></button>
                <button type="button" class="tool-icon" [class.tool-icon-active]="annotationTool() === 'text-note'" [attr.aria-pressed]="annotationTool() === 'text-note'" title="Text note" aria-label="Text note" (click)="annotationToolChange.emit('text-note')"><i class="fa-solid fa-font"></i></button>
                <button type="button" class="tool-icon tool-icon-danger" title="Delete selected annotation" aria-label="Delete selected annotation" [disabled]="!hasSelectedAnnotation()" (click)="deleteSelected.emit()"><i class="fa-solid fa-trash"></i></button>
              </div>
            }

            @case ('eraser') {
              <div class="toolbar-group">
                <button type="button" class="tool-icon" [class.tool-icon-active]="annotationTool() === 'eraser'" [attr.aria-pressed]="annotationTool() === 'eraser'" title="Eraser" aria-label="Eraser" (click)="annotationToolChange.emit('eraser')"><i class="fa-solid fa-eraser"></i></button>
                <button type="button" class="tool-icon" title="Undo" aria-label="Undo" [disabled]="!canUndo()" (click)="undo.emit()"><i class="fa-solid fa-arrow-rotate-left"></i></button>
              </div>
              <div class="toolbar-divider" aria-hidden="true"></div>
              <div class="toolbar-group">
                <span class="toolbar-hint">Click or drag to erase</span>
              </div>
            }

            @case ('translate') {
              <div class="toolbar-group">
                <button type="button" class="tool-icon" [class.tool-icon-active]="translationSettingsOpen()" [attr.aria-pressed]="translationSettingsOpen()" title="Translation languages" aria-label="Translation languages" (click)="toggleTranslationSettings()"><i class="fa-solid fa-language"></i></button>
                <button type="button" class="tool-icon" [class.tool-icon-active]="translationMode() === 'original'" [attr.aria-pressed]="translationMode() === 'original'" title="Original view" aria-label="Original view" (click)="translationModeChange.emit('original')"><i class="fa-regular fa-file-lines"></i></button>
                <button type="button" class="tool-icon" [class.tool-icon-active]="translationMode() === 'inline'" [attr.aria-pressed]="translationMode() === 'inline'" title="Inline translation" aria-label="Inline translation" (click)="translationModeChange.emit('inline')"><i class="fa-solid fa-grip-lines"></i></button>
                <button type="button" class="tool-icon" [class.tool-icon-active]="translationMode() === 'side-by-side'" [attr.aria-pressed]="translationMode() === 'side-by-side'" title="Side-by-side translation" aria-label="Side-by-side translation" (click)="translationModeChange.emit('side-by-side')"><i class="fa-solid fa-table-columns"></i></button>
              </div>
              <div class="toolbar-divider" aria-hidden="true"></div>
              <div class="toolbar-group">
                <button type="button" class="tool-icon tool-icon-primary" title="Translate current page" aria-label="Translate current page" (click)="translatePage.emit()"><i class="fa-solid fa-wand-magic-sparkles"></i></button>
              </div>
            }

            @case ('ai') {
              <div class="toolbar-group">
                <button type="button" class="tool-icon tool-icon-primary" title="Open AI panel" aria-label="Open AI panel" (click)="openAIPanel.emit()"><i class="fa-solid fa-sparkles"></i></button>
              </div>
            }

            @case ('notes') {
              <div class="toolbar-group">
                <button type="button" class="tool-icon tool-icon-primary" title="Open notes panel" aria-label="Open notes panel" (click)="openNotesPanel.emit()"><i class="fa-solid fa-note-sticky"></i></button>
              </div>
            }

            @case ('recorder') {
              <div class="toolbar-group">
                <button type="button" class="tool-icon" [class.tool-icon-active]="recordingCaptureMode() === 'microphone'" [attr.aria-pressed]="recordingCaptureMode() === 'microphone'" title="Microphone only" aria-label="Microphone only" (click)="recordingCaptureModeChange.emit('microphone')"><i class="fa-solid fa-microphone"></i></button>
                <button type="button" class="tool-icon" [class.tool-icon-active]="recordingCaptureMode() === 'screen'" [attr.aria-pressed]="recordingCaptureMode() === 'screen'" title="Screen and microphone" aria-label="Screen and microphone" (click)="recordingCaptureModeChange.emit('screen')"><i class="fa-solid fa-display"></i></button>
              </div>
              <div class="toolbar-divider" aria-hidden="true"></div>
              <div class="toolbar-group">
                <span class="toolbar-timer" [title]="'Recording time ' + recordingTimeLabel()" aria-label="Recording timer">
                  <span class="toolbar-timer-dot" [class.toolbar-timer-dot-live]="recordingState()?.status === 'recording'"></span>
                  {{ recordingTimeLabel() }}
                </span>
              </div>
              <div class="toolbar-divider" aria-hidden="true"></div>
              <div class="toolbar-group">
                @if (recordingState()?.status === 'recording') {
                  <button type="button" class="tool-icon" title="Pause recording" aria-label="Pause recording" (click)="pauseRecording.emit()"><i class="fa-solid fa-pause"></i></button>
                  <button type="button" class="tool-icon tool-icon-danger" title="Stop recording" aria-label="Stop recording" (click)="stopRecording.emit()"><i class="fa-solid fa-stop"></i></button>
                } @else if (recordingState()?.status === 'paused') {
                  <button type="button" class="tool-icon tool-icon-primary" title="Resume recording" aria-label="Resume recording" (click)="resumeRecording.emit()"><i class="fa-solid fa-play"></i></button>
                  <button type="button" class="tool-icon tool-icon-danger" title="Stop recording" aria-label="Stop recording" (click)="stopRecording.emit()"><i class="fa-solid fa-stop"></i></button>
                } @else {
                  <button type="button" class="tool-icon tool-icon-primary" title="Start recording" aria-label="Start recording" (click)="startRecording.emit()"><i class="fa-solid fa-record-vinyl"></i></button>
                }
              </div>
            }

            @case ('focus') {
              <div class="toolbar-group">
                <button type="button" class="tool-icon tool-icon-primary" title="Toggle focus mode" aria-label="Toggle focus mode" (click)="toggleFocusMode.emit()"><i class="fa-solid fa-expand"></i></button>
              </div>
            }
          }

          <div class="toolbar-divider" aria-hidden="true"></div>

          <div class="toolbar-group">
            <button type="button" class="tool-icon" title="Close tool controls" aria-label="Close tool controls" (click)="close.emit()"><i class="fa-solid fa-xmark"></i></button>
          </div>
        </div>

        @if (activeTool() === 'translate' && translationSettingsOpen()) {
          <div class="toolbar-popover pointer-events-auto" role="dialog" aria-label="Translation settings">
            <div class="popover-field">
              <label for="toolbar-translation-source">From</label>
              <select id="toolbar-translation-source" [value]="translationSourceLanguage()" (change)="selectTranslationSource($any($event.target).value)">
                @for (option of sourceLanguages; track option.id) {
                  <option [value]="option.id">{{ option.label }}</option>
                }
              </select>
            </div>
            <div class="popover-field">
              <label for="toolbar-translation-target">To</label>
              <select id="toolbar-translation-target" [value]="translationTargetLanguage()" (change)="selectTranslationTarget($any($event.target).value)">
                @for (option of targetLanguages; track option.id) {
                  <option [value]="option.id">{{ option.label }}</option>
                }
              </select>
            </div>
          </div>
        }
      </div>
    }
  `,
  styles: [`
    .toolbar-shell {
      position: relative;
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      gap: 0.55rem;
      max-width: 100%;
    }

    .toolbar-bar {
      display: inline-flex;
      flex-wrap: nowrap;
      align-items: center;
      gap: 0.5rem;
      border-radius: 1.35rem;
      border: 1px solid rgb(255 255 255 / 0.1);
      background: rgb(2 6 23 / 0.84);
      padding: 0.45rem 0.6rem;
      box-shadow: 0 24px 70px -34px rgba(0, 0, 0, 0.65);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      max-width: min(100vw - 1.5rem, 100%);
      overflow-x: auto;
    }

    .toolbar-group {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
    }

    .toolbar-divider {
      width: 1px;
      height: 1.5rem;
      background: rgb(255 255 255 / 0.1);
    }

    .tool-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.25rem;
      height: 2.25rem;
      border-radius: 0.85rem;
      border: 1px solid rgb(255 255 255 / 0.1);
      background: rgb(255 255 255 / 0.05);
      color: rgb(226 232 240);
      font-size: 0.84rem;
      transition: all 0.16s ease;
      box-shadow: 0 8px 24px -20px rgba(0, 0, 0, 0.35);
      flex: 0 0 auto;
    }

    .tool-icon:hover {
      border-color: rgb(129 140 248 / 0.5);
      color: white;
      background: rgb(79 70 229 / 0.14);
      transform: translateY(-1px);
    }

    .tool-icon:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.16);
    }

    .tool-icon:disabled {
      cursor: not-allowed;
      opacity: 0.42;
      transform: none;
    }

    .tool-icon-active {
      border-color: rgb(79 70 229);
      background: rgb(79 70 229);
      color: white;
    }

    .tool-icon-primary {
      border-color: rgb(79 70 229);
      background: rgb(79 70 229);
      color: white;
    }

    .tool-icon-danger {
      border-color: rgb(251 113 133 / 0.35);
      color: rgb(253 164 175);
    }

    .tool-icon-anchor {
      pointer-events: none;
      background: rgb(255 255 255 / 0.05);
      color: rgb(255 255 255);
    }

    .toolbar-timer {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      min-width: 5rem;
      justify-content: center;
      border-radius: 9999px;
      border: 1px solid rgb(255 255 255 / 0.1);
      background: rgb(255 255 255 / 0.05);
      padding: 0.45rem 0.72rem;
      font-size: 0.7rem;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      color: rgb(226 232 240);
    }

    .toolbar-hint {
      display: inline-flex;
      align-items: center;
      min-height: 2.25rem;
      border-radius: 9999px;
      border: 1px solid rgb(255 255 255 / 0.08);
      background: rgb(255 255 255 / 0.04);
      padding: 0.45rem 0.7rem;
      font-size: 0.7rem;
      font-weight: 700;
      color: rgb(203 213 225);
      white-space: nowrap;
    }

    .toolbar-timer-dot {
      width: 0.45rem;
      height: 0.45rem;
      border-radius: 9999px;
      background: rgb(148 163 184);
    }

    .toolbar-timer-dot-live {
      background: rgb(244 63 94);
      box-shadow: 0 0 0 5px rgba(244, 63, 94, 0.14);
    }

    .toolbar-popover {
      position: absolute;
      top: calc(100% + 0.35rem);
      left: 50%;
      transform: translateX(-50%);
      min-width: 14rem;
      border-radius: 1.2rem;
      border: 1px solid rgb(255 255 255 / 0.1);
      background: rgb(2 6 23 / 0.98);
      padding: 0.9rem;
      box-shadow: 0 26px 70px -34px rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
    }

    .popover-field + .popover-field {
      margin-top: 0.7rem;
    }

    .popover-field label {
      display: block;
      margin-bottom: 0.4rem;
      font-size: 0.72rem;
      font-weight: 700;
      color: rgb(203 213 225);
    }

    .popover-field select {
      width: 100%;
      border-radius: 0.95rem;
      border: 1px solid rgb(255 255 255 / 0.1);
      background: rgb(15 23 42 / 0.94);
      padding: 0.65rem 0.8rem;
      font-size: 0.84rem;
      font-weight: 600;
      color: rgb(255 255 255);
      outline: none;
    }

    .popover-field select:focus {
      border-color: rgb(79 70 229);
      box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.12);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkspaceToolOptionsBarComponent {
  activeTool = input<WorkspaceToolKey | null>(null);
  annotationTool = input<AnnotationTool>('select');
  canUndo = input(false);
  canRedo = input(false);
  hasSelectedAnnotation = input(false);
  translationMode = input<TranslationViewMode>('original');
  translationSourceLanguage = input<WorkspaceLanguage>('auto');
  translationTargetLanguage = input<TargetLanguage>('ar');
  recordingCaptureMode = input<RecordingCaptureMode>('microphone');
  recordingState = input<RecordingSessionState | null>(null);

  close = output<void>();
  openFile = output<void>();
  saveWorkspace = output<void>();
  downloadDocument = output<void>();
  previousPage = output<void>();
  nextPage = output<void>();
  zoomIn = output<void>();
  zoomOut = output<void>();
  fitModeChange = output<'manual' | 'width' | 'page'>();
  annotationToolChange = output<AnnotationTool>();
  undo = output<void>();
  redo = output<void>();
  deleteSelected = output<void>();
  translationModeChange = output<TranslationViewMode>();
  translationSourceLanguageChange = output<WorkspaceLanguage>();
  translationTargetLanguageChange = output<TargetLanguage>();
  translatePage = output<void>();
  openAIPanel = output<void>();
  openNotesPanel = output<void>();
  startRecording = output<void>();
  pauseRecording = output<void>();
  resumeRecording = output<void>();
  stopRecording = output<void>();
  recordingCaptureModeChange = output<RecordingCaptureMode>();
  toggleFocusMode = output<void>();

  protected readonly translationSettingsOpen = signal(false);

  protected readonly sourceLanguages: Array<{ id: WorkspaceLanguage; label: string }> = [
    { id: 'auto', label: 'Auto detect' },
    { id: 'en', label: 'English' },
    { id: 'ar', label: 'Arabic' }
  ];

  protected readonly targetLanguages: Array<{ id: TargetLanguage; label: string }> = [
    { id: 'ar', label: 'Arabic' },
    { id: 'en', label: 'English' }
  ];

  constructor() {
    effect(() => {
      if (this.activeTool() !== 'translate') {
        this.translationSettingsOpen.set(false);
      }
    });
  }

  @HostListener('document:keydown.escape')
  protected handleEscape() {
    this.translationSettingsOpen.set(false);
  }

  protected toggleTranslationSettings() {
    this.translationSettingsOpen.update((open) => !open);
  }

  protected selectTranslationSource(language: WorkspaceLanguage) {
    this.translationSourceLanguageChange.emit(language);
  }

  protected selectTranslationTarget(language: TargetLanguage) {
    this.translationTargetLanguageChange.emit(language);
  }

  protected toolbarAriaLabel(): string {
    return `${this.labelFor(this.activeTool()!)} options`;
  }

  protected labelFor(tool: WorkspaceToolKey): string {
    switch (tool) {
      case 'reader':
        return 'Reader';
      case 'draw':
        return 'Draw';
      case 'highlight':
        return 'Highlight';
      case 'shapes':
        return 'Shapes';
      case 'arrow':
        return 'Arrow';
      case 'text-note':
        return 'Text / Note';
      case 'sticky-note':
        return 'Text / Note';
      case 'eraser':
        return 'Eraser';
      case 'ai':
        return 'AI';
      case 'translate':
        return 'Translate';
      case 'notes':
        return 'Notes';
      case 'focus':
        return 'Focus';
      case 'recorder':
        return 'Recorder';
    }
  }

  protected iconFor(tool: WorkspaceToolKey): string {
    switch (tool) {
      case 'reader':
        return 'fa-solid fa-book-open';
      case 'draw':
        return 'fa-solid fa-pen';
      case 'highlight':
        return 'fa-solid fa-highlighter';
      case 'shapes':
        return 'fa-regular fa-square';
      case 'arrow':
        return 'fa-solid fa-arrow-right-long';
      case 'text-note':
        return 'fa-solid fa-notes-medical';
      case 'sticky-note':
        return 'fa-solid fa-notes-medical';
      case 'eraser':
        return 'fa-solid fa-eraser';
      case 'ai':
        return 'fa-solid fa-sparkles';
      case 'translate':
        return 'fa-solid fa-language';
      case 'notes':
        return 'fa-solid fa-note-sticky';
      case 'focus':
        return 'fa-solid fa-expand';
      case 'recorder':
        return 'fa-solid fa-microphone-lines';
    }
  }

  protected recordingTimeLabel(): string {
    const elapsedMs = this.recordingState()?.elapsedMs || 0;
    const totalSeconds = Math.floor(elapsedMs / 1000);
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  }
}
