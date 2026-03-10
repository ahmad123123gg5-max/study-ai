import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild, computed, effect, inject, output, signal } from '@angular/core';
import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import * as mammoth from 'mammoth';
import { AIService } from '../../services/ai.service';
import { ChatService, ConversationContext } from '../../services/chat.service';
import { FlashcardsService } from '../../services/flashcards.service';
import { LocalizationService } from '../../services/localization.service';
import { MindMapService } from '../../services/mindmap.service';
import { NotificationService } from '../../services/notification.service';
import { DocumentWorkspacePdfService } from './document-workspace/services/document-workspace-pdf.service';
import { UpgradeModal } from '../shared/upgrade-modal.component';

interface TransformHistory {
  id: string;
  timestamp: string;
  type: string;
  source: string;
  sourceTitle: string;
  result: string;
}

interface SourcePayload {
  text: string;
  title: string;
}

@Component({
  selector: 'app-content-transform-page',
  standalone: true,
  imports: [CommonModule, UpgradeModal],
  template: `
    <div class="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8" [dir]="isRtl() ? 'rtl' : 'ltr'">
      <div class="max-w-7xl mx-auto space-y-6">
        <header class="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-6">
          <div class="space-y-2">
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-[10px] font-black uppercase tracking-[0.25em] border border-indigo-500/20">
              <i class="fa-solid fa-microchip"></i> {{ t('AI Content Engine') }}
            </div>
            <h1 class="text-3xl md:text-4xl font-black text-white">{{ t('Smart Content Transform Lab') }}</h1>
            <p class="text-slate-400 max-w-2xl">{{ t('Convert text, recordings, and files into multiple study-ready outputs.') }}</p>
          </div>
          <div class="flex items-center gap-2">
            <button (click)="clearHistory()" class="px-4 py-2 rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-500/10">{{ t('Clear History') }}</button>
            <div class="flex bg-slate-900 rounded-xl p-1 border border-white/10">
              <button (click)="viewMode.set('editor')" [class.bg-indigo-600]="viewMode() === 'editor'" class="px-4 py-2 rounded-lg text-xs font-bold">{{ t('Editor') }}</button>
              <button (click)="viewMode.set('history')" [class.bg-indigo-600]="viewMode() === 'history'" class="px-4 py-2 rounded-lg text-xs font-bold">{{ t('History') }}</button>
            </div>
          </div>
        </header>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <section class="lg:col-span-4 bg-slate-900 border border-white/10 rounded-[2rem] overflow-hidden">
            <div class="px-5 py-4 border-b border-white/5 flex items-center justify-between gap-3">
              <h2 class="text-sm font-black text-white uppercase tracking-wider">{{ t('Source Content') }}</h2>
              <span class="text-[10px] font-bold text-slate-500">{{ sourceDraft().length }} {{ t('characters') }}</span>
            </div>
            <div class="p-5 space-y-4">
              <textarea
                [value]="sourceDraft()"
                (input)="sourceDraft.set($any($event.target).value)"
                class="w-full min-h-[320px] bg-transparent outline-none resize-none text-base leading-7 placeholder:text-slate-700"
                [placeholder]="t('Paste text here or type your idea...')"
              ></textarea>
              @if (uploadedFiles().length) {
                <div class="flex flex-wrap gap-2">
                  @for (file of uploadedFiles(); track file.name + file.lastModified) {
                    <div class="flex items-center gap-2 rounded-xl bg-slate-800 px-3 py-2 text-[11px] font-bold">
                      <i class="fa-solid" [class.fa-file-audio]="isAudioFile(file)" [class.fa-file-lines]="!isAudioFile(file)"></i>
                      <span class="max-w-[150px] truncate">{{ file.name }}</span>
                      <button (click)="removeFile(file)" class="text-rose-400"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                  }
                </div>
              }
            </div>
            <div class="px-5 py-4 border-t border-white/5 flex flex-wrap items-center justify-between gap-3 bg-slate-900/70">
              <div class="flex flex-wrap gap-3">
                <button (click)="sourceDraft.set('')" class="text-xs font-bold text-slate-400 hover:text-white">{{ t('Clear') }}</button>
                <button (click)="fileInput.click()" class="text-xs font-bold text-indigo-400 hover:text-indigo-300">{{ t('Attach Files') }}</button>
                <input #fileInput type="file" (change)="onFileSelected($event)" class="hidden" multiple accept="audio/*,.pdf,.doc,.docx,.txt">
              </div>
              <button (click)="toggleRecording()" class="w-10 h-10 rounded-full border border-white/10 hover:bg-white/5" [title]="t('Voice Recording')">
                <i class="fa-solid fa-microphone" [class.text-rose-400]="isRecording()"></i>
              </button>
            </div>
          </section>

          <section class="lg:col-span-2 space-y-3">
            <p class="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] px-2">{{ t('Conversion Templates') }}</p>
            @for (type of transformTypes(); track type.id) {
              <button
                (click)="transform(type.id)"
                [disabled]="isBusy() || (!sourceDraft().trim() && uploadedFiles().length === 0)"
                class="w-full rounded-[1.5rem] border border-white/10 bg-slate-900 p-5 text-center hover:border-indigo-500 disabled:opacity-40"
              >
                <div class="w-10 h-10 mx-auto mb-3 rounded-xl bg-slate-800 flex items-center justify-center">
                  <i [class]="type.icon"></i>
                </div>
                <span class="text-xs font-black">{{ type.label }}</span>
              </button>
            }
          </section>

          <section #resultShell class="lg:col-span-6">
            @if (viewMode() === 'editor') {
              <div class="bg-slate-900 border border-white/10 rounded-[2rem] overflow-hidden min-h-[620px] flex flex-col">
                <div class="px-6 py-4 border-b border-white/5 flex items-center justify-between gap-3">
                  <h2 class="text-sm font-black text-white uppercase tracking-wider">{{ t('Generated Result') }}</h2>
                  @if (resultText()) {
                    <div class="flex gap-2">
                      <button (click)="copyToClipboard()" class="w-10 h-10 rounded-xl bg-slate-800 hover:bg-indigo-600" [title]="t('Copy')"><i class="fa-solid fa-copy"></i></button>
                      <button (click)="downloadText()" class="w-10 h-10 rounded-xl bg-slate-800 hover:bg-indigo-600" [title]="t('Download Text')"><i class="fa-solid fa-download"></i></button>
                      <button (click)="toggleFullScreen()" class="w-10 h-10 rounded-xl bg-slate-800 hover:bg-indigo-600" [title]="t('Full Screen')"><i class="fa-solid fa-expand"></i></button>
                    </div>
                  }
                </div>

                <div class="relative flex-1 p-6 overflow-y-auto">
                  @if (isBusy()) {
                    <div class="absolute inset-0 bg-slate-950/70 backdrop-blur-sm z-10 flex items-center justify-center">
                      <div class="text-center space-y-4">
                        <div class="w-12 h-12 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin mx-auto"></div>
                        <p class="font-black">{{ t('Processing content...') }}</p>
                      </div>
                    </div>
                  }

                  @if (resultText()) {
                    <div class="space-y-5">
                      <div class="flex flex-wrap gap-3">
                        <button (click)="generateQuestionsFromResult()" class="px-4 py-3 rounded-2xl bg-amber-500/10 text-amber-300 border border-amber-500/20 font-black">{{ t('Create Questions') }}</button>
                        <button (click)="generateSummaryFromResult()" class="px-4 py-3 rounded-2xl bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-black">{{ t('Summary') }}</button>
                        <button (click)="openResultAsFlashcards()" class="px-4 py-3 rounded-2xl bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-black">{{ t('🎴 Flashcards') }}</button>
                        <button (click)="openResultAsMindMap()" class="px-4 py-3 rounded-2xl bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-black">{{ t('🧠 Mind Map') }}</button>
                        <button (click)="sendToTutor()" class="px-4 py-3 rounded-2xl bg-fuchsia-500/10 text-fuchsia-300 border border-fuchsia-500/20 font-black">{{ t('Send to Smart Tutor') }}</button>
                        <button (click)="exportPdf()" class="px-4 py-3 rounded-2xl bg-rose-500/10 text-rose-300 border border-rose-500/20 font-black">{{ t('Export PDF') }}</button>
                        <button (click)="exportWord()" class="px-4 py-3 rounded-2xl bg-blue-500/10 text-blue-300 border border-blue-500/20 font-black">{{ t('Export Word') }}</button>
                      </div>

                      <div #resultCapture class="rounded-[1.5rem] bg-slate-950/70 border border-white/10 p-6 space-y-4">
                        <div class="border-b border-white/5 pb-4">
                          <p class="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-300">{{ t('Converted Content') }}</p>
                          <h3 class="text-xl font-black text-white mt-2">{{ buildResultTitle() }}</h3>
                        </div>
                        <div class="whitespace-pre-wrap leading-8 text-slate-300">{{ resultText() }}</div>
                      </div>
                    </div>
                  } @else {
                    <div class="h-full flex flex-col items-center justify-center text-center space-y-4">
                      <div class="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center text-3xl text-slate-600">
                        <i class="fa-solid fa-sparkles"></i>
                      </div>
                      <h3 class="text-xl font-black text-white">{{ t('Ready To Transform') }}</h3>
                      <p class="text-slate-500 max-w-sm">{{ t('Add text or files, then choose a conversion.') }}</p>
                    </div>
                  }
                </div>
              </div>
            } @else {
              <div class="space-y-3">
                <div class="flex items-center justify-between px-3">
                  <h2 class="text-sm font-black text-white uppercase tracking-wider">{{ t('Recent Transform History') }}</h2>
                  <button (click)="clearHistory()" class="text-[10px] font-black text-rose-400 uppercase tracking-widest">{{ t('Clear All') }}</button>
                </div>
                @for (item of history(); track item.id) {
                  <button (click)="restoreHistory(item)" class="w-full text-start rounded-[1.5rem] bg-slate-900 border border-white/10 p-5 hover:border-indigo-500/40">
                    <div class="flex items-center justify-between gap-3 mb-2">
                      <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-300 flex items-center justify-center">
                          <i [class]="getIconForType(item.type)"></i>
                        </div>
                        <div>
                          <p class="font-black text-white">{{ getLabelForType(item.type) }}</p>
                          <p class="text-[10px] text-slate-500">{{ item.timestamp | date:'short' }}</p>
                        </div>
                      </div>
                      <span class="text-xs font-black text-indigo-300">{{ t('Restore') }}</span>
                    </div>
                    <p class="text-xs text-slate-400 line-clamp-1">{{ item.sourceTitle }}</p>
                    <p class="text-xs text-slate-500 line-clamp-2 mt-2">{{ item.source }}</p>
                  </button>
                } @empty {
                  <div class="rounded-[2rem] bg-slate-900 border border-dashed border-white/10 p-16 text-center text-slate-500 font-bold">
                    {{ t('No transformation history yet') }}
                  </div>
                }
              </div>
            }
          </section>
        </div>

        @if (showUpgradeModal()) {
          <app-upgrade-modal
            [title]="t('Daily Limit Reached')"
            [message]="upgradeMessage()"
            icon="fa-solid fa-wand-magic-sparkles"
            (closeModal)="showUpgradeModal.set(false)"
            (upgradePlan)="onUpgradeRequested()"
          />
        }
      </div>
    </div>
  `,
  styles: [':host{display:block}']
})
export class ContentTransformPage {
  private readonly ai = inject(AIService);
  private readonly chatService = inject(ChatService);
  private readonly flashcardsService = inject(FlashcardsService);
  private readonly localization = inject(LocalizationService);
  private readonly mindMapService = inject(MindMapService);
  private readonly notificationService = inject(NotificationService);
  private readonly pdfService = inject(DocumentWorkspacePdfService);

  @ViewChild('resultCapture') resultCapture?: ElementRef<HTMLElement>;
  @ViewChild('resultShell') resultShell?: ElementRef<HTMLElement>;

  readonly t = (text: string) => this.localization.phrase(text);
  readonly isRtl = computed(() => this.localization.direction() === 'rtl');

  back = output<void>();
  openFlashcards = output<void>();
  openMindMap = output<void>();
  openTutor = output<void>();

  readonly sourceDraft = signal('');
  readonly result = signal('');
  readonly isBusy = signal(false);
  readonly viewMode = signal<'editor' | 'history'>('editor');
  readonly activeType = signal<string | null>(null);
  readonly lastType = signal<string | null>(null);
  readonly lastSourceTitle = signal('');
  readonly isRecording = signal(false);
  readonly uploadedFiles = signal<File[]>([]);
  readonly history = signal<TransformHistory[]>(this.loadHistory());
  readonly resultText = computed(() => this.result().trim());
  readonly transformTypes = computed(() => [
    { id: 'transcribe', label: this.getLabelForType('transcribe'), icon: this.getIconForType('transcribe') },
    { id: 'summary', label: this.getLabelForType('summary'), icon: this.getIconForType('summary') }
  ]);

  mediaRecorder: MediaRecorder | null = null;
  audioChunks: Blob[] = [];
  recordingStream: MediaStream | null = null;

  showUpgradeModal = signal(false);
  upgradeMessage = signal('');
  onUpgradeRequested = () => {
    this.showUpgradeModal.set(false);
    this.back.emit();
  };

  constructor() {
    effect(() => {
      localStorage.setItem('transform_history', JSON.stringify(this.history()));
    });
  }

  async toggleRecording() {
    if (this.isRecording()) {
      this.mediaRecorder?.stop();
      this.isRecording.set(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.recordingStream = stream;
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];
      this.mediaRecorder.ondataavailable = (event) => this.audioChunks.push(event.data);
      this.mediaRecorder.onstop = async () => {
        this.recordingStream?.getTracks().forEach((track) => track.stop());
        this.recordingStream = null;
        this.isBusy.set(true);
        try {
          const base64 = await this.blobToBase64(new Blob(this.audioChunks, { type: 'audio/webm' }));
          const text = await this.ai.transcribeAudio(base64, 'audio/webm');
          this.sourceDraft.update((value) => [value.trim(), text.trim()].filter(Boolean).join('\n\n'));
        } catch (error) {
          console.error('Recording transcription failed', error);
        } finally {
          this.isBusy.set(false);
        }
      };
      this.mediaRecorder.start();
      this.isRecording.set(true);
    } catch (error) {
      console.error('Recording failed', error);
      this.notificationService.show(this.t('Voice Recording'), this.t('Please allow microphone access and try again.'), 'warning', 'fa-microphone-lines-slash');
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files?.length) return;
    this.uploadedFiles.update((current) => [...current, ...(Array.from(files) as File[])]);
    input.value = '';
  }

  removeFile(file: File) {
    this.uploadedFiles.update((files) => files.filter((candidate) => candidate !== file));
  }

  async transform(type: string) {
    if (!this.sourceDraft().trim() && this.uploadedFiles().length === 0) {
      this.notificationService.show(this.t('Transformation Complete'), this.t('No content available to process.'), 'warning', 'fa-circle-exclamation');
      return;
    }
    const source = await this.prepareSourcePayload();
    if (!source) return;
    await this.runTransformation(source.text, type, source.title);
  }

  async generateQuestionsFromResult() {
    if (this.resultText()) await this.runTransformation(this.resultText(), 'quiz', this.buildResultTitle());
  }

  async generateSummaryFromResult() {
    if (this.resultText()) await this.runTransformation(this.resultText(), 'summary', this.buildResultTitle());
  }

  getIconForType(type: string) {
    if (type === 'transcribe') return 'fa-solid fa-file-lines';
    if (type === 'summary') return 'fa-solid fa-align-left';
    if (type === 'quiz') return 'fa-solid fa-clipboard-question';
    return 'fa-solid fa-file';
  }

  getLabelForType(type: string) {
    if (type === 'transcribe') return this.t('Extract Text');
    if (type === 'summary') return this.t('Summary');
    if (type === 'quiz') return this.t('Create Questions');
    return this.t('Converted Content');
  }

  restoreHistory(item: TransformHistory) {
    this.result.set(item.result);
    this.lastType.set(item.type);
    this.lastSourceTitle.set(item.sourceTitle);
    this.viewMode.set('editor');
  }

  openResultAsFlashcards() {
    if (!this.resultText()) return;
    const sourceTitle = this.buildResultTitle();
    this.flashcardsService.openFromSource({ sourceText: this.resultText(), sourceType: 'transform', sourceTitle, language: this.ai.currentLanguage(), groupName: sourceTitle });
    this.openFlashcards.emit();
  }

  openResultAsMindMap() {
    if (!this.resultText()) return;
    const sourceTitle = this.buildResultTitle();
    this.mindMapService.openFromSource({ sourceText: this.resultText(), sourceType: 'transform', sourceTitle, language: this.ai.currentLanguage(), mapName: sourceTitle });
    this.openMindMap.emit();
  }

  sendToTutor() {
    if (!this.resultText()) return;
    const sourceTitle = this.buildResultTitle();
    const context: ConversationContext = {
      specialization: this.t('General Learning'),
      subject: sourceTitle,
      lesson: this.getLabelForType(this.lastType() || 'transcribe'),
      helpType: 'Explanation'
    };
    this.chatService.queueTutorLaunch({
      title: `${sourceTitle} - ${this.t('Explanation')}`,
      context,
      userVisibleText: this.t('Explain this content in Smart Tutor'),
      requestText: `${this.t('Explain the following study material clearly and step by step.')}\n${this.t('Use the provided content as the lesson source. Start with the core concept, then teach it progressively with examples and a quick knowledge check.')}\n\n${this.resultText()}`
    });
    this.openTutor.emit();
  }

  clearHistory() {
    if (confirm(this.t('Are you sure you want to clear all transformation history?'))) {
      this.history.set([]);
    }
  }

  async copyToClipboard() {
    if (!this.resultText()) return;
    await navigator.clipboard.writeText(this.resultText());
    this.notificationService.show(this.t('Copy'), this.t('Copied to clipboard'), 'success', 'fa-copy');
  }

  downloadText() {
    if (!this.resultText()) return;
    this.downloadBlob(`${this.buildExportBaseName()}.txt`, new Blob(['\uFEFF', this.resultText()], { type: 'text/plain;charset=utf-8' }));
  }

  async exportPdf() {
    const target = this.resultCapture?.nativeElement;
    if (!target || !this.resultText()) return;
    this.isBusy.set(true);
    try {
      const canvas = await html2canvas(target, { backgroundColor: '#020617', scale: 2, useCORS: true, logging: false });
      const pdf = new jsPDF({ orientation: canvas.width > canvas.height ? 'landscape' : 'portrait', unit: 'px', format: [canvas.width, canvas.height] });
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`${this.buildExportBaseName()}.pdf`);
      this.notificationService.show(this.t('Saved'), this.t('PDF export is ready.'), 'success', 'fa-file-pdf');
    } catch (error) {
      console.error('PDF export failed', error);
    } finally {
      this.isBusy.set(false);
    }
  }

  async exportWord() {
    if (!this.resultText()) return;
    this.isBusy.set(true);
    try {
      const alignment = this.isRtl() ? AlignmentType.RIGHT : AlignmentType.LEFT;
      const paragraphs = this.resultText().split(/\n{2,}/).map((part) => part.trim()).filter(Boolean).map((part) => new Paragraph({
        alignment,
        children: [new TextRun({ text: part, size: 24, font: 'Arial' })],
        spacing: { after: 180, line: 360 }
      }));
      const doc = new Document({
        sections: [{
          children: [
            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: this.buildResultTitle(), bold: true, size: 36, color: '2563eb' })],
              spacing: { after: 260 }
            }),
            ...paragraphs
          ]
        }]
      });
      this.downloadBlob(`${this.buildExportBaseName()}.docx`, await Packer.toBlob(doc));
      this.notificationService.show(this.t('Saved'), this.t('Word export is ready.'), 'success', 'fa-file-word');
    } catch (error) {
      console.error('Word export failed', error);
    } finally {
      this.isBusy.set(false);
    }
  }

  toggleFullScreen() {
    if (this.resultShell?.nativeElement.requestFullscreen) {
      void this.resultShell.nativeElement.requestFullscreen();
    }
  }

  isAudioFile(file: File) {
    return this.detectFileKind(file) === 'audio';
  }

  buildResultTitle() {
    const sourceTitle = this.lastSourceTitle() || this.t('Uploaded Content');
    return this.lastType() && this.lastType() !== 'transcribe' ? `${sourceTitle} - ${this.getLabelForType(this.lastType() || 'transcribe')}` : sourceTitle;
  }

  private async runTransformation(sourceText: string, type: string, sourceTitle: string) {
    const text = this.normalizeText(sourceText);
    if (!text) {
      this.notificationService.show(this.t('Transformation Complete'), this.t('No readable content was found in the provided input.'), 'warning', 'fa-triangle-exclamation');
      return;
    }
    const limitCheck = this.ai.checkLimit('contentLabConversions');
    if (!limitCheck.allowed) {
      this.upgradeMessage.set(limitCheck.message);
      this.showUpgradeModal.set(true);
      return;
    }
    this.isBusy.set(true);
    this.activeType.set(type);
    this.lastType.set(type);
    this.lastSourceTitle.set(sourceTitle);
    this.viewMode.set('editor');
    try {
      const result = type === 'transcribe' ? text : await this.ai.transformContent(this.buildTransformationPrompt(type, text), type);
      const finalResult = this.normalizeText(result);
      this.result.set(finalResult);
      this.ai.incrementUsage('contentLabConversions');
      this.history.update((items) => [{
        id: Math.random().toString(36).slice(2),
        timestamp: new Date().toISOString(),
        type,
        source: `${text.slice(0, 160)}${text.length > 160 ? '...' : ''}`,
        sourceTitle,
        result: finalResult
      }, ...items.slice(0, 19)]);
      this.notificationService.show(this.t('Transformation Complete'), this.getLabelForType(type), 'success', 'fa-wand-magic-sparkles');
    } catch (error) {
      console.error('Transformation failed', error);
    } finally {
      this.isBusy.set(false);
      this.activeType.set(null);
    }
  }

  private buildTransformationPrompt(type: string, text: string) {
    if (type === 'summary') return `Create a concise, well-structured study summary from the following content.\n\n${text}`;
    if (type === 'quiz') return `Generate study questions from the following content. Include multiple choice and short answer questions with answers.\n\n${text}`;
    return text;
  }

  private async prepareSourcePayload(): Promise<SourcePayload | null> {
    const parts: string[] = [];
    const skipped: string[] = [];
    const draft = this.normalizeText(this.sourceDraft());
    if (draft) parts.push(draft);
    for (const file of this.uploadedFiles()) {
      const extracted = await this.extractTextFromFile(file);
      if (extracted) {
        parts.push(extracted);
      } else {
        skipped.push(file.name);
      }
    }
    const text = this.normalizeText(parts.join('\n\n'));
    if (skipped.length) {
      this.notificationService.show(this.t('Unsupported files were skipped.'), skipped.join(', '), 'warning', 'fa-triangle-exclamation');
    }
    if (!text) return null;
    return { text, title: this.buildSourceTitle() };
  }

  private async extractTextFromFile(file: File): Promise<string | null> {
    try {
      switch (this.detectFileKind(file)) {
        case 'audio':
          return this.normalizeText(await this.ai.transcribeAudio(await this.blobToBase64(file), file.type || 'audio/webm'));
        case 'pdf': {
          const resource = await this.pdfService.loadFile(file, 'pdf');
          try {
            return this.normalizeText(resource.pages.map((page) => page.text).join('\n\n'));
          } finally {
            await this.pdfService.disposeResource(resource);
          }
        }
        case 'docx':
          return this.normalizeText((await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value);
        case 'text':
          return this.normalizeText(await file.text());
        case 'doc':
          this.notificationService.show(this.t('Legacy .doc files are not supported yet. Please use .docx, .pdf, .txt, or audio files.'), file.name, 'warning', 'fa-file-circle-xmark');
          return null;
        default:
          return null;
      }
    } catch (error) {
      console.error(`Failed to extract text from ${file.name}`, error);
      return null;
    }
  }

  private detectFileKind(file: File): 'audio' | 'pdf' | 'docx' | 'text' | 'doc' | 'unknown' {
    const type = file.type.toLowerCase();
    const ext = file.name.toLowerCase().split('.').pop() || '';
    if (type.startsWith('audio/') || ['mp3', 'wav', 'm4a', 'ogg', 'webm', 'aac'].includes(ext)) return 'audio';
    if (type === 'application/pdf' || ext === 'pdf') return 'pdf';
    if (type.includes('wordprocessingml.document') || ext === 'docx') return 'docx';
    if (type === 'application/msword' || ext === 'doc') return 'doc';
    if (type.startsWith('text/') || ['txt', 'md'].includes(ext)) return 'text';
    return 'unknown';
  }

  private buildSourceTitle() {
    if (this.uploadedFiles().length === 1) return this.uploadedFiles()[0].name.replace(/\.[^/.]+$/, '');
    if (this.uploadedFiles().length > 1) return this.t('Uploaded Content');
    const firstLine = this.sourceDraft().trim().split('\n')[0] || this.t('Uploaded Content');
    return firstLine.slice(0, 60);
  }

  private normalizeText(value: string) {
    return value.replace(/\r/g, '').replace(/\u0000/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        resolve(result.split(',')[1] || '');
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  private downloadBlob(name: string, blob: Blob) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private buildExportBaseName() {
    const raw = (this.buildResultTitle() || this.t('Converted Content')).replace(/[<>:"/\\|?*\u0000-\u001F]/g, '').trim();
    return raw.replace(/\s+/g, '-').slice(0, 80) || 'content-transform';
  }

  private loadHistory(): TransformHistory[] {
    try {
      const parsed = JSON.parse(localStorage.getItem('transform_history') || '[]') as Array<Partial<TransformHistory>>;
      return parsed.map((item) => ({
        id: typeof item.id === 'string' ? item.id : Math.random().toString(36).slice(2),
        timestamp: typeof item.timestamp === 'string' ? item.timestamp : new Date().toISOString(),
        type: typeof item.type === 'string' ? item.type : 'transcribe',
        source: typeof item.source === 'string' ? item.source : '',
        sourceTitle: typeof item.sourceTitle === 'string' ? item.sourceTitle : this.t('Uploaded Content'),
        result: typeof item.result === 'string' ? item.result : JSON.stringify(item.result ?? '', null, 2)
      })).slice(0, 20);
    } catch {
      return [];
    }
  }
}
