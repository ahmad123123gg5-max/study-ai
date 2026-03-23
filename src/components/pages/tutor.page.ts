
import { Component, signal, inject, ViewChild, ElementRef, computed, effect, output, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AIService, ImprovementPlan } from '../../services/ai.service';
import { ChatService, Message, Conversation, ConversationContext, PendingTutorLaunch, TutorSessionState, TutorTeachingUnit } from '../../services/chat.service';
import { FlashcardsService } from '../../services/flashcards.service';
import { MindMapService } from '../../services/mindmap.service';
import { LocalizationService } from '../../services/localization.service';
import { DiagramModal } from '../shared/diagram-modal.component';
import { UpgradeModal } from '../shared/upgrade-modal.component';
import { SimulationScenarioConfig } from './virtual-lab/models/virtual-lab.models';
import { VirtualLabSessionService } from './virtual-lab/services/virtual-lab-session.service';
import { ClinicalCaseService } from './virtual-lab/services/clinical-case.service';
import { SpecialtyProfileService } from './virtual-lab/services/specialty-profile.service';

type ExplanationLevelKey = 'quick' | 'school' | 'university';
type TutorMessageToolId = 'summary' | 'quiz' | 'mindMap' | 'flashcards' | 'understandingAnalysis' | 'virtualLab';
type TutorUnderstandingActionId = 'no' | 'somewhat' | 'yes';
type TutorIntent = 'new_topic' | 'continue' | 'explain_more' | 'simplify' | 'deepen' | 'examples' | 'quiz' | 'summary' | 'lab' | 'direct_answer';
type StudentProfileEstimate = 'beginner' | 'intermediate' | 'advanced';

interface UploadedTutorFile {
  id: string;
  data: string;
  mimeType: string;
  name: string;
  status?: 'reading' | 'starting' | 'ready' | 'limited' | 'error';
  totalUnits?: number;
  currentPreparedUnits?: number;
  sourceType?: 'pdf' | 'doc' | 'text' | 'image' | 'generic';
  extractedText?: string;
  teachingUnits?: TutorTeachingUnit[];
  teachingMode?: TutorTeachingUnit['kind'];
  extractionMessage?: string;
  autoStarted?: boolean;
}

interface TutorExplanationLevelOption {
  id: ExplanationLevelKey;
  label: string;
  instruction: string;
}

interface TutorMessageTool {
  id: TutorMessageToolId;
  label: string;
  userMessage: string;
  prompt: string;
  iconClass: string;
}

interface TutorUnderstandingAction {
  id: TutorUnderstandingActionId;
  label: string;
  userMessage: string;
  prompt: string;
  buttonClass: string;
}

interface TutorQuickAction {
  id: 'explain_more' | 'simplify' | 'example' | 'quiz' | 'continue';
  label: string;
  prompt: string;
}

interface ChapterProgressEntry {
  chapterId: string;
  documentName: string;
  completedAt: string;
  totalSlides: number;
}

interface SlideMiniQuizOption {
  id: string;
  label: string;
  text: string;
  isCorrect: boolean;
}

interface SlideMiniQuiz {
  slideId: string;
  question: string;
  prompt: string;
  explanation: string;
  options: SlideMiniQuizOption[];
}

interface SlideMiniQuizResult {
  selectedOptionId: string;
  isCorrect: boolean;
  skipped?: boolean;
}

@Component({
  selector: 'app-tutor-page',
  standalone: true,
  imports: [CommonModule, FormsModule, DiagramModal, UpgradeModal],
  template: `
    <div class="fixed inset-0 flex bg-slate-950 overflow-hidden animate-in fade-in duration-500 z-50">
      
      <!-- Mobile Sidebar Backdrop -->
      @if (isTutorSidebarOpen()) {
        <div (click)="closeTutorSidebar()" class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] lg:hidden animate-in fade-in duration-300"></div>
      }

      <!-- 1. LEFT SIDEBAR: CONVERSATION HISTORY & CONTEXT -->
      <aside [class.translate-x-0]="isTutorSidebarOpen()"
             [class.translate-x-full]="!isTutorSidebarOpen() && isRtl()"
             [class.-translate-x-full]="!isTutorSidebarOpen() && !isRtl()"
             [class.right-0]="isRtl()"
             [class.left-0]="!isRtl()"
             class="fixed lg:relative inset-y-0 w-80 max-w-[calc(100vw-1rem)] lg:w-96 border-e border-white/5 bg-slate-900/50 backdrop-blur-3xl flex flex-col shrink-0 overflow-hidden z-[70] lg:z-auto transition-transform duration-500 will-change-transform lg:translate-x-0 lg:left-auto lg:right-auto lg:flex">
        
        <!-- Header with Back Button -->
        <div class="p-6 border-b border-white/5 flex items-center justify-between gap-4">
          <div class="flex items-center gap-4">
            <button (click)="back.emit()" class="w-10 h-10 rounded-xl bg-white/5 hover:bg-indigo-600 transition-all flex items-center justify-center text-white">
              <i class="fa-solid fa-arrow-right" [class.fa-arrow-left]="!isRtl()"></i>
            </button>
            <h2 class="font-black text-white text-lg">{{ uiLabels().tutorTitle }}</h2>
          </div>
          <button (click)="closeTutorSidebar()" class="lg:hidden w-10 h-10 rounded-xl glass hover:bg-white/10 transition flex items-center justify-center text-white">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <!-- New Chat Button -->
        <div class="p-6">
          <button (click)="startNewChat()" 
                  class="w-full bg-indigo-600 text-white p-5 rounded-[1.5rem] font-black flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-indigo-600/20">
            <i class="fa-solid fa-plus"></i>
            {{ uiLabels().newChatBtn }}
          </button>
          <button
            (click)="openFileStudy.emit()"
            class="mt-3 w-full rounded-[1.35rem] border border-white/10 bg-white/5 px-4 py-4 text-sm font-black text-white transition hover:border-indigo-400/30 hover:bg-white/10"
          >
            <span class="flex items-center justify-center gap-3">
              <i class="fa-solid fa-book-open-reader text-indigo-300"></i>
              {{ uiLabels().openFileStudy }}
            </span>
          </button>
        </div>

        <!-- Context Settings -->
        <div class="px-6 pb-4 border-b border-white/5 space-y-3">
          <p class="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">{{ uiLabels().contextTitle }}</p>
          
          <div class="space-y-2">
            <select [(ngModel)]="studentContext.specialization" class="w-full bg-slate-950 border border-white/10 rounded-xl p-2 text-xs text-white outline-none focus:border-indigo-500">
              <option value="">{{ uiLabels().selectSpecialization }}</option>
              @for (option of specializationOptions(); track option.value) {
                <option [value]="option.value">{{ option.label }}</option>
              }
            </select>
            
            @if (studentContext.specialization === 'Other') {
              <input type="text" [(ngModel)]="studentContext.customSpecialization" [placeholder]="uiLabels().customSpecializationPlaceholder" class="w-full bg-slate-950 border border-white/10 rounded-xl p-2 text-xs text-white outline-none focus:border-indigo-500 animate-in fade-in slide-in-from-top-2">
            }
            
            <input type="text" [(ngModel)]="studentContext.subject" [placeholder]="uiLabels().subjectPlaceholder" class="w-full bg-slate-950 border border-white/10 rounded-xl p-2 text-xs text-white outline-none focus:border-indigo-500">
            
            <input type="text" [(ngModel)]="studentContext.lesson" [placeholder]="uiLabels().lessonPlaceholder" class="w-full bg-slate-950 border border-white/10 rounded-xl p-2 text-xs text-white outline-none focus:border-indigo-500">
            
            <select [(ngModel)]="studentContext.helpType" class="w-full bg-slate-950 border border-white/10 rounded-xl p-2 text-xs text-white outline-none focus:border-indigo-500">
              <option value="">{{ uiLabels().selectHelpType }}</option>
              @for (option of helpTypeOptions(); track option.value) {
                <option [value]="option.value">{{ option.label }}</option>
              }
            </select>

            <button (click)="startContextChat()" 
                    [disabled]="!isContextValid()"
                    class="w-full mt-2 bg-emerald-600 text-white p-3 rounded-xl font-bold text-xs hover:bg-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {{ uiLabels().startContextChat }}
            </button>
          </div>
        </div>

        <!-- History List -->
        <div class="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar">
          <div class="flex items-center justify-between px-4 mb-4">
            <p class="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">{{ uiLabels().historyTitle }}</p>
            <button (click)="clearAllChats()" class="text-[10px] font-black text-rose-500 hover:text-rose-400 transition-colors uppercase tracking-widest">{{ t('Clear All') }}</button>
          </div>

          @if (completedChapters().length > 0) {
            <div class="mx-2 mb-4 rounded-[1.4rem] border border-emerald-400/15 bg-emerald-500/8 p-3">
              <p class="mb-2 text-[10px] font-black uppercase tracking-[0.28em] text-emerald-300">{{ uiLabels().chapterCompletedTitle }}</p>
              <div class="space-y-2">
                @for (chapter of completedChapters().slice(0, 4); track chapter.chapterId) {
                  <div class="rounded-xl border border-white/5 bg-black/10 px-3 py-2">
                    <p class="text-xs font-black text-white line-clamp-1">{{ chapter.documentName }}</p>
                    <p class="text-[10px] font-bold text-emerald-200">{{ chapter.totalSlides }} {{ t('slides completed') }}</p>
                  </div>
                }
              </div>
            </div>
          }
          
          @if (chatService.conversations().length === 0) {
            <div class="px-4 py-10 text-center opacity-30">
              <i class="fa-solid fa-ghost text-4xl mb-3"></i>
              <p class="text-xs font-bold">{{ uiLabels().noHistory }}</p>
            </div>
          }

          @if (textConversations().length > 0) {
            <div class="space-y-2">
              @for (chat of textConversations(); track chat.id) {
                <div class="group relative flex items-center">
                  <button (click)="openConversation(chat)"
                          [class.bg-white/5]="chatService.activeChatId() === chat.id"
                          [class.border-indigo-500/30]="chatService.activeChatId() === chat.id"
                          class="flex-1 text-right p-4 rounded-2xl border border-transparent transition-all flex items-center gap-4 hover:bg-white/5 group">
                    <i class="fa-solid fa-message text-slate-500 group-hover:text-indigo-400" [class.text-indigo-400]="chatService.activeChatId() === chat.id"></i>
                    <span class="flex-1 text-sm font-bold text-slate-300 group-hover:text-white leading-snug break-words line-clamp-2" [class.text-white]="chatService.activeChatId() === chat.id">
                      {{ chat.title }}
                    </span>
                  </button>
                  <button (click)="chatService.deleteChat(chat.id)" 
                          class="absolute left-2 opacity-0 group-hover:opacity-100 p-2 text-rose-500 hover:scale-125 transition">
                    <i class="fa-solid fa-trash-can text-xs"></i>
                  </button>
                </div>
              }
            </div>
          }

        </div>

        <!-- System Status Info -->
        <div class="p-6 mt-auto border-t border-white/5 bg-slate-950/40">
           <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500"><i class="fa-solid fa-bolt text-xs"></i></div>
              <div class="text-[10px]">
                 <p class="font-black text-white uppercase tracking-widest">{{ t('Model: StudyVex AI Engine') }}</p>
                 <p class="text-slate-500 font-bold">{{ t('Site AI API • Active') }}</p>
              </div>
           </div>
        </div>
      </aside>

      <!-- 2. MAIN AREA: ACTIVE CHAT -->
      <div class="flex-1 flex flex-col bg-slate-950 relative">
        
        <!-- Header HUD -->
        <header class="h-16 border-b border-white/5 flex items-center justify-between px-4 md:px-10 bg-slate-900/20 shrink-0">
           <div class="flex items-center gap-3 md:gap-6">
              <button (click)="back.emit()" class="hidden sm:flex lg:hidden w-8 h-8 rounded-lg bg-white/5 hover:bg-indigo-600 transition-all items-center justify-center text-white">
                <i class="fa-solid fa-arrow-right" [class.fa-arrow-left]="!isRtl()"></i>
              </button>
              <button (click)="openTutorSidebar()" class="lg:hidden w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center">
                <i class="fa-solid fa-bars-staggered"></i>
              </button>
              <button (click)="openTutorSidebar()" class="hidden md:flex w-10 h-10 rounded-xl border border-white/10 bg-slate-900/50 text-slate-300 hover:bg-slate-800 hover:text-white transition-all items-center justify-center">
                <i class="fa-solid fa-sliders"></i>
              </button>
              <div class="flex items-center gap-2 md:gap-4">
                <span class="hidden xs:inline text-[10px] md:text-xs font-black text-indigo-400 uppercase tracking-widest">{{ uiLabels().activeSessionPrefix }}</span>
                <h3 class="text-xs md:text-sm font-black text-white leading-tight break-words line-clamp-2 max-w-[55vw] sm:max-w-[60vw] md:max-w-sm">{{ chatService.getActiveChat()?.title || uiLabels().welcomeTitle }}</h3>
              </div>
              
              @if (chatService.activeChatId()) {
                <div class="hidden md:flex items-center gap-2">
                  <div class="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/50 px-3 py-1.5 shadow-lg shadow-black/20">
                    <span class="text-[10px] font-black uppercase tracking-widest text-slate-400">{{ uiLabels().explanationLevel }}</span>
                    <select
                      [ngModel]="explanationLevel()"
                      (ngModelChange)="explanationLevel.set($event)"
                      class="bg-transparent text-[10px] font-black uppercase tracking-widest text-white outline-none"
                    >
                      @for (level of explanationOptions(); track level.id) {
                        <option [value]="level.id" class="bg-slate-950 text-white">{{ level.label }}</option>
                      }
                    </select>
                  </div>

                  <button (click)="analyzePerformance()" [disabled]="isAnalyzing()" class="flex items-center gap-2 bg-amber-600/20 text-amber-400 hover:bg-amber-600 hover:text-white px-3 py-1.5 rounded-xl border border-amber-500/30 transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-60">
                    <i class="fa-solid fa-microscope" [class.animate-spin]="isAnalyzing()"></i>
                    {{ t('Analyze Performance') }}
                  </button>
                </div>
              }
           </div>
           <div class="flex items-center gap-2 sm:gap-4">
              @if (ai.userPlan() === 'free') {
                <div class="hidden xs:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-widest">
                  <i class="fa-solid fa-bolt-lightning"></i>
                  <span class="hidden sm:inline">{{ t('Attempts Left:') }}</span>
                  {{ ai.getRemainingAttemptsLabel('aiTeacherQuestions') }}
                </div>
              }
              <div class="hidden xs:flex items-center gap-2">
                <span class="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                <span class="text-[9px] md:text-[10px] text-slate-500 font-black tracking-widest uppercase hidden sm:inline">{{ t('Secure') }}</span>
              </div>
              @if (isLaunchingVirtualLab()) {
                <div class="hidden xl:flex items-center gap-2 rounded-2xl border border-violet-400/20 bg-violet-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.24em] text-violet-100">
                  <i class="fa-solid fa-spinner animate-spin text-violet-200"></i>
                  <span>{{ t('Launching Virtual Lab') }}</span>
                </div>
              }
              <button (click)="back.emit()" class="sm:hidden w-8 h-8 rounded-lg bg-white/5 hover:bg-indigo-600 transition-all flex items-center justify-center text-white">
                <i class="fa-solid fa-arrow-right" [class.fa-arrow-left]="!isRtl()"></i>
              </button>
           </div>
        </header>

        <!-- Message Thread -->
        <div class="flex-1 overflow-y-auto p-3 md:p-8 lg:p-12 space-y-4 md:space-y-8 no-scrollbar" #msgContainer (scroll)="registerUserInteraction()">
          @if (documentStatus()) {
            <div
              class="mx-auto max-w-3xl rounded-[1.6rem] border px-5 py-4 text-sm font-medium shadow-lg shadow-black/10"
              [class.border-cyan-400/20]="documentStatusTone() === 'info' || documentStatusTone() === 'success'"
              [class.bg-cyan-500/10]="documentStatusTone() === 'info' || documentStatusTone() === 'success'"
              [class.text-cyan-50]="documentStatusTone() === 'info' || documentStatusTone() === 'success'"
              [class.border-amber-400/20]="documentStatusTone() === 'warning'"
              [class.bg-amber-500/10]="documentStatusTone() === 'warning'"
              [class.text-amber-100]="documentStatusTone() === 'warning'"
              [class.border-rose-400/20]="documentStatusTone() === 'error'"
              [class.bg-rose-500/10]="documentStatusTone() === 'error'"
              [class.text-rose-100]="documentStatusTone() === 'error'"
            >
              <div class="flex items-start gap-3">
                <i class="fa-solid" [class.fa-spinner]="isPreparingDocument()" [class.animate-spin]="isPreparingDocument()" [class.fa-file-lines]="!isPreparingDocument()"></i>
                <div>
                  <p class="font-black text-white">{{ t('Document Teaching') }}</p>
                  <p class="mt-1 leading-7">{{ documentStatus() }}</p>
                </div>
              </div>
            </div>
          }
          @if (virtualLabLaunchError()) {
            <div class="mx-auto max-w-3xl rounded-[1.7rem] border border-amber-400/20 bg-amber-500/10 px-5 py-4 text-sm font-medium text-amber-100 shadow-lg shadow-black/10">
              <div class="flex items-start gap-3">
                <i class="fa-solid fa-triangle-exclamation mt-0.5 text-amber-300"></i>
                <div>
                  <p class="font-black text-white">{{ t('Virtual Lab fallback used') }}</p>
                  <p class="mt-1 leading-7">{{ virtualLabLaunchError() }}</p>
                </div>
              </div>
            </div>
          }
          @if (!chatService.activeChatId()) {
            <div class="h-full flex flex-col items-center justify-center text-center space-y-4 md:space-y-8 animate-in zoom-in duration-700">
               <div class="w-16 h-16 md:w-24 md:h-24 bg-indigo-600 rounded-[1.5rem] md:rounded-[2.5rem] flex items-center justify-center text-white text-3xl md:text-5xl shadow-2xl shadow-indigo-500/30">
                  <i class="fa-solid fa-graduation-cap"></i>
               </div>
               <div class="space-y-2 md:space-y-4 px-4 md:px-6">
                  <h2 class="text-xl md:text-4xl font-black text-white tracking-tighter">{{ uiLabels().welcomeTitle }}</h2>
                  <p class="text-slate-500 text-xs md:text-lg max-w-md mx-auto">{{ uiLabels().welcomeSubtitle }}</p>
               </div>

               <button (click)="startNewChat()" class="px-6 md:px-12 py-3 md:py-5 bg-white text-slate-950 rounded-xl md:rounded-[2rem] font-black text-sm md:text-lg hover:scale-105 transition shadow-2xl">
                  {{ uiLabels().startNowBtn }}
               </button>
            </div>
          } @else {
            @for (m of chatService.getActiveChat()?.messages; track $index) {
              <div class="flex animate-in slide-in-from-bottom-4 duration-500" [class.justify-end]="m.role === 'user'">
                <div class="flex items-start gap-2 md:gap-4 max-w-[95%] sm:max-w-[90%] md:max-w-[85%] lg:max-w-[70%]" [class.flex-row-reverse]="m.role === 'user'">
                  <div class="flex flex-col gap-2 w-full">
                    <div [class.bg-indigo-600]="m.role === 'user'"
                         [class.bg-slate-900/95]="m.role === 'model'"
                         [class.text-white]="m.role === 'user'"
                         [class.border-white/5]="m.role === 'model'"
                         [class.shadow-[0_24px_60px_rgba(15,23,42,0.22)]]="m.role === 'model'"
                         [class.shadow-[0_18px_48px_rgba(79,70,229,0.18)]]="m.role === 'user'"
                         class="p-4 md:p-8 rounded-[1.7rem] md:rounded-[2.3rem] border text-sm md:text-lg break-words selection:bg-indigo-400 selection:text-white backdrop-blur-sm"
                         [class.rounded-tr-none]="m.role === 'user'"
                         [class.rounded-tl-none]="m.role === 'model'">
                      
                      @if (m.files && m.files.length > 0) {
                        <div class="flex flex-wrap gap-2 mb-4">
                          @for (f of m.files; track $index) {
                            <div class="flex items-center gap-2 bg-black/20 px-3 py-1.5 rounded-lg text-xs font-bold">
                              <i class="fa-solid fa-file-lines text-indigo-300"></i>
                              <span class="truncate max-w-[150px]">{{ f.name }}</span>
                            </div>
                          }
                        </div>
                      }
                      
                      <div
                        class="tutor-message-content"
                        [class.tutor-message-model]="m.role === 'model'"
                        [class.tutor-message-user]="m.role === 'user'"
                        [class.text-right]="resolveMessageDirection(m.text) === 'rtl'"
                        [class.text-left]="resolveMessageDirection(m.text) === 'ltr'"
                        [attr.dir]="resolveMessageDirection(m.text)"
                        [innerHTML]="renderMessageHtml(m.text, m.role)">
                      </div>
                    </div>

                    @if (m.role === 'model' && m.text.trim()) {
                      <div class="mt-2 space-y-3 animate-in fade-in duration-500 delay-200">
                        <div class="flex flex-wrap items-center gap-2">
                          <div class="relative" (click)="$event.stopPropagation()">
                            <button
                              (click)="toggleMessageTools($index, $event)"
                              [disabled]="isThinking() || isLaunchingVirtualLab()"
                              class="w-10 h-10 rounded-xl border border-white/10 bg-slate-900/70 text-slate-300 hover:bg-slate-800 hover:text-white transition-all disabled:opacity-50 flex items-center justify-center"
                            >
                              <span class="text-lg leading-none">⋮</span>
                            </button>

                            @if (openToolMenuIndex() === $index) {
                              <div
                                [class.left-0]="!isRtl()"
                                [class.right-0]="isRtl()"
                                class="absolute top-full mt-2 z-20 w-60 overflow-hidden rounded-[1.4rem] border border-white/10 bg-slate-950/95 p-2 shadow-2xl shadow-black/30 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200"
                              >
                                <p class="px-3 pb-2 text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">{{ uiLabels().toolMenu }}</p>
                                @for (tool of messageToolActions(); track tool.id) {
                                  <button
                                    (click)="runMessageTool(tool, m.text, $index)"
                                    [disabled]="tool.id === 'virtualLab' && isLaunchingVirtualLab()"
                                    class="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-right text-sm font-bold text-slate-200 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
                                  >
                                    <i [class]="tool.id === 'virtualLab' && isLaunchingVirtualLab() ? 'fa-solid fa-spinner animate-spin' : tool.iconClass"></i>
                                    <span>{{ tool.id === 'virtualLab' && isLaunchingVirtualLab() ? t('Launching Virtual Lab') : tool.label }}</span>
                                  </button>
                                }
                              </div>
                            }
                          </div>
                        </div>

                        @if (fileTeachingState()?.active) {
                          <div class="slide-learning-shell rounded-[1.8rem] border border-cyan-400/15 bg-white/[0.035] p-5 md:p-6 shadow-lg shadow-black/10 backdrop-blur-sm" [class.slide-transition-active]="slideTransitionActive()">
                            <div class="flex items-start justify-between gap-4">
                              <div class="min-w-0 flex-1">
                                <p class="text-[10px] font-black uppercase tracking-[0.26em] text-cyan-200">{{ currentTeachingUnitLabel() }}</p>
                                <div class="mt-2 flex items-center gap-3 text-sm font-bold text-white">
                                  <span>{{ slideProgressLabel() }}</span>
                                  <span class="text-cyan-200">{{ slideProgressPercent() }}%</span>
                                </div>
                                <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                                  <div
                                    class="slide-progress-fill h-full rounded-full"
                                    [class.slide-progress-complete]="slideProgressPercent() >= 100"
                                    [style.width.%]="slideProgressPercent()">
                                  </div>
                                </div>
                              </div>

                              <div class="relative shrink-0" (click)="$event.stopPropagation()">
                                <button
                                  (click)="slideActionMenuOpen.set(!slideActionMenuOpen())"
                                  [disabled]="isThinking()"
                                  class="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-slate-900/65 text-slate-200 transition hover:bg-slate-800 hover:text-white disabled:opacity-40"
                                >
                                  <span class="text-lg leading-none">⋯</span>
                                </button>

                                @if (slideActionMenuOpen()) {
                                  <div
                                    [class.left-0]="!isRtl()"
                                    [class.right-0]="isRtl()"
                                    class="absolute top-full mt-2 z-20 w-72 overflow-hidden rounded-[1.4rem] border border-white/10 bg-slate-950/95 p-2 shadow-2xl shadow-black/30 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200"
                                  >
                                    <p class="px-3 pb-2 text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">{{ uiLabels().currentSlideActions }}</p>
                                    <button (click)="continueFileTeaching('explain_more'); slideActionMenuOpen.set(false)" [disabled]="isThinking()" class="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-right text-sm font-bold text-slate-200 transition hover:bg-white/5 hover:text-white disabled:opacity-50">{{ uiLabels().teachExplainMore }}</button>
                                    <button (click)="requestCurrentSlideVariant('detailed'); slideActionMenuOpen.set(false)" [disabled]="isThinking()" class="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-right text-sm font-bold text-slate-200 transition hover:bg-white/5 hover:text-white disabled:opacity-50">{{ uiLabels().detailedExplanationMode }}</button>
                                    <button (click)="continueFileTeaching('quiz'); slideActionMenuOpen.set(false)" [disabled]="isThinking()" class="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-right text-sm font-bold text-slate-200 transition hover:bg-white/5 hover:text-white disabled:opacity-50">{{ uiLabels().teachQuiz }}</button>
                                    <button (click)="skipCurrentSlideExplanation(); slideActionMenuOpen.set(false)" [disabled]="isThinking() || !canGoToNextSlide()" class="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-right text-sm font-bold text-slate-200 transition hover:bg-white/5 hover:text-white disabled:opacity-50">{{ uiLabels().skipExplanation }}</button>
                                    <button (click)="goToPreviousSlide(); slideActionMenuOpen.set(false)" [disabled]="isThinking() || !canGoToPreviousSlide()" class="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-right text-sm font-bold text-slate-200 transition hover:bg-white/5 hover:text-white disabled:opacity-50">{{ uiLabels().previousSlide }}</button>
                                    <div class="mt-1 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                                      <label class="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{{ uiLabels().jumpToSlide }}</label>
                                      <div class="flex items-center gap-2">
                                        <input
                                          type="number"
                                          min="1"
                                          [max]="fileTeachingState()?.totalSlides || fileTeachingState()?.totalUnitCount || 1"
                                          [value]="slideJumpInput()"
                                          (input)="slideJumpInput.set(($any($event.target).value || '').toString()); registerUserInteraction()"
                                          class="w-20 rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm font-bold text-white outline-none focus:border-cyan-400"
                                        >
                                        <button
                                          (click)="jumpToSlide(); slideActionMenuOpen.set(false)"
                                          [disabled]="isThinking()"
                                          class="px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-xs font-black text-white transition hover:bg-white/10 disabled:opacity-40"
                                        >
                                          {{ t('Go') }}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                }
                              </div>
                            </div>

                            <div class="mt-5 flex items-center justify-end">
                              <button
                                (click)="goToNextSlide()"
                                [disabled]="isThinking() || !canGoToNextSlide()"
                                class="min-w-28 rounded-2xl border border-cyan-400/20 bg-cyan-500/18 px-5 py-3 text-sm font-black text-cyan-50 transition hover:bg-cyan-500/28 disabled:opacity-40"
                              >
                                {{ uiLabels().nextSlide }}
                              </button>
                            </div>
                          </div>
                        }
                      </div>
                    }
                  </div>
                </div>
              </div>
            }
            @if (isThinking()) {
              <div class="flex justify-start">
                <div class="bg-slate-900/50 p-6 rounded-3xl flex gap-2 border border-white/5 shadow-inner">
                  <div class="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></div>
                  <div class="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-75"></div>
                  <div class="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-150"></div>
                </div>
              </div>
            }
          }
        </div>

        <!-- Floating Input Bar -->
        <div class="p-2 sm:p-4 md:p-6 lg:px-12 lg:pb-8 bg-gradient-to-t from-slate-950 via-slate-950 to-transparent shrink-0">
          <div class="max-w-3xl mx-auto relative group">
            
            <!-- Uploaded Files Preview -->
            @if (uploadedFiles().length > 0) {
              <div class="flex flex-wrap gap-2 mb-2 px-2 animate-in slide-in-from-bottom-2">
                @for (file of uploadedFiles(); track $index) {
                  <div class="flex items-center gap-1.5 bg-slate-800 border border-white/10 px-2 py-1 rounded-md text-[9px] sm:text-[10px] font-bold text-slate-300">
                    <i class="fa-solid fa-file-lines text-indigo-400"></i>
                    <span class="truncate max-w-[80px] sm:max-w-[100px]">{{ file.name }}</span>
                    @if (file.totalUnits && file.currentPreparedUnits) {
                      <span class="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-1.5 py-0.5 text-[8px] text-cyan-100">
                        {{ file.currentPreparedUnits }}/{{ file.totalUnits }}
                      </span>
                    }
                    @if (file.extractionMessage) {
                      <span class="hidden sm:inline text-[8px] text-slate-400">{{ file.extractionMessage }}</span>
                    }
                    <button (click)="removeFile($index)" class="text-rose-400 hover:text-rose-300 ml-1">
                      <i class="fa-solid fa-xmark"></i>
                    </button>
                  </div>
                }
              </div>
            }

            @if (chatService.activeChatId()) {
              <div class="md:hidden mb-2 flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/40 px-3 py-2">
                <span class="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">{{ uiLabels().explanationLevel }}</span>
                <select
                  [ngModel]="explanationLevel()"
                  (ngModelChange)="explanationLevel.set($event)"
                  class="bg-transparent text-[10px] font-black uppercase tracking-widest text-white outline-none"
                >
                  @for (level of explanationOptions(); track level.id) {
                    <option [value]="level.id" class="bg-slate-950 text-white">{{ level.label }}</option>
                  }
                </select>
              </div>
            }

            <div class="glass flex items-end gap-1.5 sm:gap-3 p-2 sm:p-3 rounded-2xl sm:rounded-[2rem] border border-white/10 shadow-2xl focus-within:border-indigo-500/50 transition-all duration-500 bg-slate-900/50">
              
              <!-- File Upload -->
              <input type="file" #fileInput class="hidden" multiple (change)="onFileSelected($event)" accept=".pdf,.txt,.doc,.docx,.png,.jpg,.jpeg">
              <button (click)="fileInput.click()" 
                      [disabled]="!chatService.activeChatId()"
                      class="w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center text-slate-500 hover:text-indigo-400 transition-all disabled:opacity-20 shrink-0 border border-transparent hover:bg-white/5">
                <i class="fa-solid fa-paperclip text-sm sm:text-lg"></i>
              </button>

              <!-- Voice Toggle -->
              <button (click)="toggleLiveVoice()" 
                      [disabled]="!chatService.activeChatId()"
                      [class.bg-rose-600]="isRecording()" 
                      [class.text-white]="isRecording()"
                      class="w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center text-slate-500 hover:text-indigo-400 transition-all disabled:opacity-20 shrink-0 border border-transparent hover:bg-white/5">
                <i class="fa-solid text-sm sm:text-lg" [class.fa-microphone]="!isRecording()" [class.fa-microphone-lines]="isRecording()" [class.animate-pulse]="isRecording()"></i>
              </button>

              <!-- Handwritten Diagram Toggle -->
              <button (click)="showDiagramModal.set(true)" 
                      [disabled]="!chatService.activeChatId()"
                      class="hidden xs:flex w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl items-center justify-center text-slate-500 hover:text-indigo-400 transition-all disabled:opacity-20 shrink-0 border border-transparent hover:bg-white/5">
                <i class="fa-solid fa-pen-nib text-sm sm:text-lg"></i>
              </button>

              <!-- Main Input Area -->
              <textarea #chatInput 
                        [disabled]="!chatService.activeChatId()"
                        (input)="adjustHeight(); registerUserInteraction()"
                        (keyup.enter)="!$event.shiftKey && send(); $event.preventDefault()" 
                        [placeholder]="uiLabels().placeholder"
                        [class.text-right]="isRtl()"
                        [class.text-left]="!isRtl()"
                        class="flex-1 bg-transparent text-white p-2 text-xs sm:text-base font-medium outline-none border-none resize-none max-h-32 no-scrollbar placeholder:opacity-30 leading-relaxed disabled:opacity-20"></textarea>
              
              <!-- Send Button -->
              <button (click)="send()" 
                      [disabled]="isThinking() || !chatService.activeChatId()" 
                      class="w-8 h-8 sm:w-12 sm:h-12 bg-indigo-600 text-white rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-20 shrink-0 group">
                <i class="fa-solid fa-paper-plane group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform text-[10px] sm:text-sm"></i>
              </button>
            </div>

            @if (isRecording()) {
              <div class="absolute -top-10 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-rose-600 rounded-full text-[9px] font-black uppercase tracking-widest text-white shadow-xl animate-bounce">
                {{ uiLabels().listening }}
              </div>
            }

            <p class="text-center text-[10px] text-slate-600 font-bold uppercase mt-4 tracking-[0.4em] opacity-40">
              Shift + Enter for new line • StudyVex Intelligence 2.5
            </p>
          </div>
        </div>
      </div>

      <!-- Diagram Modal -->
      @if (showDiagramModal()) {
        <app-diagram-modal 
          (closeModal)="showDiagramModal.set(false)" 
          (saveDiagram)="onDiagramSaved($event)">
        </app-diagram-modal>
      }
    </div>

    <!-- Improvement Plan Modal -->
    @if (improvementPlan()) {
      <div class="fixed inset-0 bg-black/80 backdrop-blur-xl z-[200] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
        <div class="bg-slate-900 w-full max-w-5xl max-h-[90vh] rounded-[2rem] md:rounded-[3rem] border border-white/10 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-500">
          <div class="p-6 border-b border-white/5 flex justify-between items-center bg-slate-950/50">
            <div class="flex items-center gap-4">
              <div class="w-12 h-12 bg-amber-600 rounded-xl flex items-center justify-center text-white text-2xl shadow-lg shadow-amber-500/20">
                <i class="fa-solid fa-chart-line"></i>
              </div>
              <div>
                <h3 class="text-xl font-black text-white">{{ t('Smart Improvement Plan') }}</h3>
                <p class="text-slate-400 text-xs">{{ t('Based on your recent conversation') }}</p>
              </div>
            </div>
            <button (click)="improvementPlan.set(null)" class="w-10 h-10 rounded-full glass hover:bg-rose-500 transition flex items-center justify-center text-white">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div class="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 no-scrollbar">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div class="space-y-6">
                <h4 class="text-indigo-400 font-black uppercase tracking-widest text-xs">{{ t('Detected Weak Points') }}</h4>
                @for (wp of improvementPlan()?.weakPoints; track wp.topic) {
                  <div class="bg-slate-800/50 p-6 rounded-2xl border border-white/5 space-y-4 hover:border-amber-500/30 transition-colors group">
                    <div class="flex justify-between items-start">
                      <span class="bg-rose-500/20 text-rose-400 text-[10px] font-black px-2 py-1 rounded uppercase">{{ t('Weak Point') }}</span>
                      <div class="text-right">
                        <p class="text-white font-bold">{{ wp.topic }}</p>
                        <p class="text-[10px] text-slate-500 font-black uppercase tracking-tighter">
                          {{ t('Page') }} {{ wp.page }} | {{ t('Slide') }} {{ wp.slide }} | {{ t('Part') }}: {{ wp.part }}
                        </p>
                      </div>
                    </div>
                    <p class="text-sm text-slate-300 leading-relaxed">{{ wp.explanation }}</p>
                    
                    @if (wp.visualUrl) {
                      <div class="relative rounded-xl overflow-hidden border border-white/10 aspect-video group-hover:border-amber-500/20 transition-colors">
                        <img [src]="wp.visualUrl" class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" referrerpolicy="no-referrer">
                        <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-4">
                          <p class="text-[10px] text-white font-medium italic opacity-70">{{ t('Visual representation') }}: {{ wp.visualPrompt }}</p>
                        </div>
                      </div>
                    }
                  </div>
                }
                @if (improvementPlan()?.weakPoints?.length === 0) {
                  <div class="bg-emerald-500/10 p-8 rounded-2xl border border-emerald-500/20 text-center">
                    <i class="fa-solid fa-star text-3xl text-emerald-500 mb-4"></i>
                    <p class="text-white font-bold">{{ t('No significant weak points detected. Keep up the great work!') }}</p>
                  </div>
                }
              </div>

              <div class="space-y-8">
                <div class="bg-amber-600/10 p-6 rounded-2xl border border-amber-500/20">
                  <h4 class="text-amber-400 font-black uppercase tracking-widest text-xs mb-3">{{ t('Tutor Advice') }}</h4>
                  <p class="text-white font-medium leading-relaxed">{{ improvementPlan()?.overallAdvice }}</p>
                </div>

                <div class="space-y-4">
                  <h4 class="text-emerald-400 font-black uppercase tracking-widest text-xs">{{ t('Next Steps for Improvement') }}</h4>
                  @for (step of improvementPlan()?.nextSteps; track step) {
                    <div class="flex items-center gap-3 bg-emerald-500/5 p-4 rounded-xl border border-emerald-500/10">
                      <i class="fa-solid fa-circle-check text-emerald-500"></i>
                      <p class="text-sm text-white font-medium">{{ step }}</p>
                    </div>
                  }
                </div>
              </div>
            </div>
          </div>
          
          <div class="p-6 bg-slate-950/50 border-t border-white/5 text-center">
            <button (click)="improvementPlan.set(null)" class="bg-indigo-600 text-white px-12 py-4 rounded-xl font-black hover:scale-105 transition shadow-xl">
              {{ t('Got it, I will work on it') }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Upgrade Modal -->
    @if (showUpgradeModal()) {
      <app-upgrade-modal 
        [title]="t('Daily Limit Reached')"
        [message]="upgradeMessage()"
        icon="fa-solid fa-robot"
        (closeModal)="showUpgradeModal.set(false)"
        (upgradePlan)="onUpgradeRequested()">
      </app-upgrade-modal>
    }
  `,
  styles: [`
    :host { display: block; }
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .shadow-3xl { box-shadow: 0 40px 80px rgba(0,0,0,0.4); }
    .tutor-message-content {
      line-height: 1.95;
      word-break: normal;
      overflow-wrap: anywhere;
      white-space: normal;
      unicode-bidi: plaintext;
      text-rendering: optimizeLegibility;
      font-feature-settings: "kern" 1, "liga" 1, "rlig" 1;
    }
    .tutor-message-content {
      font-size: clamp(0.98rem, 0.94rem + 0.18vw, 1.08rem);
      letter-spacing: 0.002em;
    }
    .tutor-message-content[dir="rtl"] {
      direction: rtl;
      text-align: right;
      letter-spacing: 0;
      line-break: auto;
      word-spacing: normal;
      font-family: 'Segoe UI', Tahoma, 'Noto Sans Arabic', 'Noto Naskh Arabic', sans-serif;
      font-feature-settings: "kern" 1, "liga" 1, "rlig" 1, "calt" 1;
    }
    .tutor-message-content[dir="ltr"] {
      direction: ltr;
      text-align: left;
    }
    .tutor-message-content p {
      margin: 0 0 1.05rem;
      text-wrap: wrap;
      white-space: normal;
    }
    .tutor-message-content p:last-child { margin-bottom: 0; }
    .tutor-message-content h2,
    .tutor-message-content h3,
    .tutor-message-content h4 {
      margin: 0 0 0.95rem;
      font-weight: 900;
      line-height: 1.35;
      color: inherit;
      letter-spacing: -0.02em;
    }
    .tutor-message-content ul,
    .tutor-message-content ol {
      margin: 0.55rem 0 1.15rem;
      padding-inline-start: 1.55rem;
      display: grid;
      gap: 0.5rem;
    }
    .tutor-message-content li {
      line-height: 1.9;
      word-break: normal;
      overflow-wrap: anywhere;
    }
    .tutor-message-content[dir="rtl"] :where(p, h2, h3, h4, li, blockquote) {
      text-align: right;
    }
    .tutor-message-content[dir="rtl"] ul,
    .tutor-message-content[dir="rtl"] ol {
      padding-inline-start: 0;
      padding-inline-end: 1.55rem;
    }
    .tutor-message-content strong { font-weight: 800; color: #ffffff; }
    .tutor-message-content blockquote {
      margin: 0.85rem 0 1rem;
      padding: 0.9rem 1rem;
      border-inline-start: 3px solid rgba(99,102,241,0.45);
      border-radius: 1rem;
      background: rgba(99,102,241,0.08);
    }
    .tutor-message-content code {
      display: inline-block;
      margin: 0 0.15rem;
      padding: 0.05rem 0.45rem;
      border-radius: 0.55rem;
      background: rgba(15, 23, 42, 0.7);
      font-size: 0.92em;
      white-space: pre-wrap;
    }
    .tutor-callout {
      margin: 0.85rem 0 1rem;
      padding: 0.95rem 1rem;
      border-radius: 1.1rem;
      border: 1px solid rgba(255,255,255,0.08);
      background: rgba(15,23,42,0.54);
    }
    .tutor-callout-label {
      margin: 0 0 0.45rem !important;
      font-size: 0.75rem;
      font-weight: 900;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.82);
    }
    .tutor-callout-note { background: rgba(59,130,246,0.10); border-color: rgba(59,130,246,0.18); }
    .tutor-callout-warning { background: rgba(245,158,11,0.10); border-color: rgba(245,158,11,0.18); }
    .tutor-callout-definition { background: rgba(16,185,129,0.10); border-color: rgba(16,185,129,0.18); }
    .tutor-callout-example { background: rgba(168,85,247,0.10); border-color: rgba(168,85,247,0.18); }
    .tutor-message-model :where(p, li) { color: rgb(226 232 240); }
    .tutor-message-user :where(p, li, strong) { color: white; }
    .slide-learning-shell {
      transition: transform 260ms ease, opacity 260ms ease, border-color 260ms ease, box-shadow 260ms ease;
    }
    .slide-transition-active {
      animation: slidePanelPulse 420ms ease;
    }
    .slide-progress-fill {
      background: linear-gradient(90deg, rgba(34,211,238,0.85), rgba(56,189,248,0.95), rgba(99,102,241,0.95));
      transition: width 420ms ease, background 260ms ease;
      box-shadow: 0 0 30px rgba(34,211,238,0.22);
    }
    .slide-progress-complete {
      background: linear-gradient(90deg, rgba(16,185,129,0.95), rgba(52,211,153,0.95));
      box-shadow: 0 0 30px rgba(16,185,129,0.24);
    }
    .slide-quiz-card {
      animation: slideQuizFade 300ms ease;
    }
    @keyframes slidePanelPulse {
      0% { opacity: 0.68; transform: translateY(8px) scale(0.99); }
      100% { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes slideQuizFade {
      0% { opacity: 0; transform: translateY(10px); }
      100% { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class TutorPage {
  public ai = inject(AIService);
  public chatService = inject(ChatService);
  private flashcardsService = inject(FlashcardsService);
  private mindMapService = inject(MindMapService);
  private localization = inject(LocalizationService);
  private virtualLabSession = inject(VirtualLabSessionService);
  private clinicalCaseApi = inject(ClinicalCaseService);
  private specialtyProfiles = inject(SpecialtyProfileService);
  @ViewChild('chatInput') chatInput!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('msgContainer') msgContainer!: ElementRef<HTMLDivElement>;
  
  back = output<void>();
  openFlashcards = output<void>();
  openMindMap = output<void>();
  openVirtualLab = output<void>();
  openFileStudy = output<void>();
  sidebarRequestedOpen = signal(false);
  isThinking = signal(false);
  isRecording = signal(false);
  showDiagramModal = signal(false);
  explanationLevel = signal<ExplanationLevelKey>('school');
  openToolMenuIndex = signal<number | null>(null);
  slideActionMenuOpen = signal(false);
  isLaunchingVirtualLab = signal(false);
  virtualLabLaunchError = signal('');
  documentStatus = signal('');
  documentStatusTone = signal<'info' | 'success' | 'warning' | 'error'>('info');
  isPreparingDocument = signal(false);
  slideJumpInput = signal('');
  autoNextEnabled = signal(false);
  autoNextCountdown = signal<number | null>(null);
  slideTransitionActive = signal(false);
  miniQuizResults = signal<Record<string, SlideMiniQuizResult>>({});
  isRtl = computed(() => this.localization.direction() === 'rtl');
  readonly t = (text: string) => this.localization.phrase(text);
  private recognition: unknown = null;
  private readonly documentUnitCache = new Map<string, TutorTeachingUnit[]>();
  private readonly chapterProgressStorageKey = 'studyvex_tutor_completed_chapters_v1';
  private autoNextTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private autoNextIntervalId: ReturnType<typeof setInterval> | null = null;
  private autoNextSlideId: string | null = null;
  private autoNextInteractionBaseline = 0;
  readonly completedChapters = signal<ChapterProgressEntry[]>(this.loadCompletedChapters());

  // Performance Analysis
  isAnalyzing = signal(false);
  improvementPlan = signal<ImprovementPlan | null>(null);

  // Upgrade State
  showUpgradeModal = signal(false);
  upgradeMessage = signal('');
  onUpgradeRequested = () => {
    this.showUpgradeModal.set(false);
    // Navigate to subscription page or emit event
    // For now we emit to parent to switch view
    this.back.emit(); // Temporary: go back to dashboard where they can find subscription
  };
  
  studentContext = {
    specialization: '',
    customSpecialization: '',
    subject: '',
    lesson: '',
    helpType: ''
  };

  uploadedFiles = signal<UploadedTutorFile[]>([]);
  readonly activeChat = computed(() => this.chatService.getActiveChat() || null);
  readonly activeTutorState = computed(() => {
    const chatId = this.chatService.activeChatId();
    return chatId ? this.chatService.getTutorState(chatId) : null;
  });
  readonly fileTeachingState = computed(() => this.activeTutorState()?.fileTeaching || null);
  readonly activeSlideSnapshot = computed(() => {
    const state = this.fileTeachingState();
    if (!state?.active || state.units.length === 0) {
      return null;
    }

    const safeIndex = Math.min(Math.max(0, state.currentUnitIndex || 0), Math.max(0, state.units.length - 1));
    const activeUnit = state.units[safeIndex] || null;
    const totalSlides = state.units.length;
    const currentSlideNumber = activeUnit?.actualSlideNumber || activeUnit?.order || safeIndex + 1;
    const progressPercent = Math.round((Math.min(totalSlides, Math.max(1, currentSlideNumber)) / Math.max(1, totalSlides)) * 100);

    return {
      safeIndex,
      totalSlides,
      currentSlideNumber,
      progressPercent,
      activeUnitId: activeUnit?.id || '',
      activeUnitTitle: activeUnit?.label || '',
      activeUnit
    };
  });
  readonly hasConversationStarted = computed(() => {
    const chat = this.activeChat();
    return !!chat && (chat.messages.length > 0 || this.isThinking());
  });
  readonly shouldForceSidebarOpen = computed(() => !this.hasConversationStarted() && !this.isContextValid());
  readonly isTutorSidebarOpen = computed(() => this.shouldForceSidebarOpen() || this.sidebarRequestedOpen());
  readonly fileTeachingBanner = computed(() => {
    const state = this.fileTeachingState();
    if (!state?.active || state.units.length === 0) {
      return '';
    }
    return `${this.t('Slide')} ${state.currentSlideNumber || state.currentUnitIndex + 1} ${this.t('of')} ${state.totalSlides || state.totalUnitCount || state.units.length}`;
  });

  specializationOptions = computed(() => [
    { value: 'Medicine', label: this.t('Medicine') },
    { value: 'Engineering', label: this.t('Engineering') },
    { value: 'Computer Science', label: this.t('Computer Science') },
    { value: 'Law', label: this.t('Law') },
    { value: 'Business', label: this.t('Business') },
    { value: 'High School', label: this.t('High School') },
    { value: 'Other', label: this.t('Other (Type your own)') }
  ]);

  helpTypeOptions = computed(() => [
    { value: 'Explanation', label: this.t('Explanation') },
    { value: 'Problem Solving', label: this.t('Problem Solving') },
    { value: 'Simplification', label: this.t('Simplification') },
    { value: 'Revision', label: this.t('Revision') },
    { value: 'Exam Preparation', label: this.t('Exam Preparation') }
  ]);

  explanationOptions = computed((): TutorExplanationLevelOption[] => {
    return [
      {
        id: 'quick',
        label: this.t('Quick Explanation'),
        instruction: 'Give a concise, direct explanation. Prioritize the key idea, the shortest correct reasoning path, and a short example only when helpful.'
      },
      {
        id: 'school',
        label: this.t('School Explanation'),
        instruction: 'Teach in a balanced school-friendly way. Use simple wording, a clear sequence, and one practical example suitable for school students.'
      },
      {
        id: 'university',
        label: this.t('University Explanation'),
        instruction: 'Teach in a detailed, academically rigorous way. Include deeper reasoning, scientific framing, precise terminology, and strong examples when relevant.'
      }
    ];
  });

  messageToolActions = computed((): TutorMessageTool[] => {
    return [
      {
        id: 'summary',
        label: this.t('📄 Summary'),
        userMessage: this.t('📄 Create a summary from this explanation'),
        prompt: 'Create a short educational summary of this explanation.',
        iconClass: 'fa-regular fa-file-lines'
      },
      {
        id: 'quiz',
        label: this.t('📝 Quiz'),
        userMessage: this.t('📝 Generate a quiz from this explanation'),
        prompt: 'Generate 5 quiz questions based on this explanation.\nInclude multiple choice questions.',
        iconClass: 'fa-solid fa-clipboard-question'
      },
      {
        id: 'mindMap',
        label: this.t('🧠 Mind Map'),
        userMessage: this.t('🧠 Convert this explanation into a mind map'),
        prompt: 'Convert the explanation into a structured mind map with main ideas and subpoints.',
        iconClass: 'fa-solid fa-diagram-project'
      },
      {
        id: 'flashcards',
        label: this.t('🎴 Flashcards'),
        userMessage: this.t('🎴 Create flashcards from this explanation'),
        prompt: 'Create flashcards from this lesson.\nEach card must contain a question and answer.',
        iconClass: 'fa-regular fa-clone'
      },
      {
        id: 'virtualLab',
        label: this.t('🧪 Virtual Lab'),
        userMessage: this.t('🧪 Launch a virtual lab from this lesson'),
        prompt: 'Create a realistic virtual lab case from this explanation. Focus on an applied scenario, student decision-making, and the key learning objective.',
        iconClass: 'fa-solid fa-flask-vial'
      },
      {
        id: 'understandingAnalysis',
        label: this.t('📊 Understanding Analysis'),
        userMessage: this.t('📊 Analyze understanding from this explanation'),
        prompt: 'Analyze the student\'s understanding level based on the explanation.\nHighlight key difficult concepts.',
        iconClass: 'fa-solid fa-chart-column'
      }
    ];
  });

  understandingActions = computed((): TutorUnderstandingAction[] => {
    return [
      {
        id: 'no',
        label: this.t('❌ No'),
        userMessage: this.t('❌ I did not understand. Explain it more simply.'),
        prompt: 'Explain the concept again in a much simpler way with examples.',
        buttonClass: 'border-rose-500/20 bg-rose-500/10 text-rose-300 hover:bg-rose-500 hover:text-white'
      },
      {
        id: 'somewhat',
        label: this.t('🤔 Somewhat'),
        userMessage: this.t('🤔 I partly understood. Give me another simpler example.'),
        prompt: 'Explain the concept again with another example and simpler wording.',
        buttonClass: 'border-amber-500/20 bg-amber-500/10 text-amber-300 hover:bg-amber-500 hover:text-white'
      },
      {
        id: 'yes',
        label: this.t('✅ Yes'),
        userMessage: this.t('✅ I understood. Give me a quick quiz.'),
        prompt: 'Give the student a quick 3-question quiz to confirm understanding.',
        buttonClass: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500 hover:text-white'
      }
    ];
  });

  textConversations = computed(() =>
    this.chatService.conversations().filter(conversation => (conversation.mode ?? 'text') === 'text')
  );

  uiLabels = computed(() => {
    return {
      newChatBtn: this.t('New Conversation'),
      openFileStudy: this.ai.currentLanguage() === 'ar' ? 'اشرح ملف' : 'Explain File',
      historyTitle: this.t('Smart Session History'),
      noHistory: this.t('No recent history'),
      placeholder: this.t('Ask me anything...'),
      listening: this.t('Listening... speak now'),
      welcomeTitle: this.t('How can I help you today?'),
      welcomeSubtitle: this.t('Start a new chat to explore ideas, learn languages, or solve complex problems.'),
      startNowBtn: this.t('Start Conversation'),
      activeSessionPrefix: this.t('Active Session:'),
      tutorTitle: this.t('Smart Tutor'),
      contextTitle: this.t('Study Context'),
      selectSpecialization: this.t('Select Specialization...'),
      otherSpecialization: this.t('Other (Type your own)'),
      customSpecializationPlaceholder: this.t('Type your specialization...'),
      subjectPlaceholder: this.t('Subject / Course'),
      lessonPlaceholder: this.t('Lesson / Chapter'),
      selectHelpType: this.t('Type of Help...'),
      startContextChat: this.t('Start Session'),
      explanationLevel: this.t('Explanation Level'),
      toolMenu: this.t('Lesson Tools'),
      understoodPrompt: this.t('Did you understand the lesson?'),
      understoodHint: this.t('Choose the right feedback so the tutor can adapt immediately'),
      fileTeachingTitle: this.t('Teach From File'),
      fileTeachingBadge: this.t('Guided mode'),
      slideIndicator: this.t('Slide'),
      ofLabel: this.t('of'),
      nextSlide: this.t('Next'),
      previousSlide: this.t('Previous'),
      jumpToSlide: this.t('Jump to slide'),
      progressLabel: this.t('Progress'),
      autoNext: this.t('Auto-Next'),
      autoNextOn: this.t('On'),
      autoNextOff: this.t('Off'),
      autoNextStarting: this.t('Advancing soon...'),
      currentSlideActions: this.t('Slide Actions'),
      miniQuizTitle: this.t('Mini Quiz'),
      skipQuiz: this.t('Skip Quiz'),
      continueAnyway: this.t('Continue Anyway'),
      skipExplanation: this.t('Skip Explanation'),
      quickExplanationMode: this.t('Quick Explanation'),
      detailedExplanationMode: this.t('Detailed Explanation'),
      correctAnswer: this.t('Correct'),
      wrongAnswer: this.t('Try again'),
      chapterCompletedTitle: this.t('Completed Chapters'),
      readingDocument: this.t('Reading document...'),
      startingPageOne: this.t('Document loaded. Starting with page 1...'),
      preparingNextPages: this.t('Preparing next pages...'),
      teachExplainMore: this.t('Explain More'),
      teachSimplify: this.t('Simplify'),
      teachQuiz: this.t('Quiz Me'),
      teachContinue: this.t('Continue'),
      actionSimplify: this.t('Explain in a simpler way'),
      actionTest: this.t('Test me on this lesson'),
      actionSummarize: this.t('Summarize this topic')
    };
  });

  tutorQuickActions = computed((): TutorQuickAction[] => {
    return [
      { id: 'explain_more', label: this.t('Explain More'), prompt: 'Deepen the same exact point you just explained before moving on.' },
      { id: 'simplify', label: this.t('Simplify'), prompt: 'Explain the same exact point more simply and more clearly.' },
      { id: 'example', label: this.t('Give Example'), prompt: 'Give one or two targeted examples for the same exact point.' },
      { id: 'quiz', label: this.t('Quiz Me'), prompt: 'Ask a quick check question on the same exact point.' },
      { id: 'continue', label: this.t('Continue'), prompt: 'Continue the teaching flow naturally from the same topic.' }
    ];
  });

  constructor() {
    // Auto scroll to bottom when messages change or isThinking changes
    effect(() => {
      this.chatService.conversations();
      this.isThinking();
      setTimeout(() => this.scrollToBottom(), 100);
    });

    effect(() => {
      if (!this.chatService.pendingTutorLaunch()) {
        return;
      }

      queueMicrotask(() => {
        void this.resumePendingTutorLaunch();
      });
    });

    effect(() => {
      const activeChatId = this.chatService.activeChatId();
      const state = this.fileTeachingState();
      const snapshot = this.activeSlideSnapshot();
      if (!activeChatId || !state?.active || !snapshot) {
        if (!state?.active && this.slideJumpInput()) {
          this.slideJumpInput.set('');
        }
        return;
      }

      if (this.slideJumpInput() !== String(snapshot.currentSlideNumber)) {
        this.slideJumpInput.set(String(snapshot.currentSlideNumber));
      }

      const mismatchDetected =
        state.currentUnitIndex !== snapshot.safeIndex ||
        state.currentSlideNumber !== snapshot.currentSlideNumber ||
        state.totalSlides !== snapshot.totalSlides ||
        state.totalUnitCount !== snapshot.totalSlides ||
        state.currentUnitLabel !== snapshot.activeUnitTitle;

      if (!mismatchDetected) {
        return;
      }

      console.log({
        currentSlideIndex: snapshot.safeIndex,
        currentSlideNumber: snapshot.currentSlideNumber,
        totalSlides: snapshot.totalSlides,
        progressPercent: snapshot.progressPercent,
        activeUnitId: snapshot.activeUnitId,
        activeUnitTitle: snapshot.activeUnitTitle
      });

      const previous = this.chatService.getTutorState(activeChatId);
      if (!previous?.fileTeaching) {
        return;
      }

      this.chatService.updateTutorState(activeChatId, {
        ...previous,
        fileTeaching: {
          ...previous.fileTeaching,
          currentUnitIndex: snapshot.safeIndex,
          currentSlideNumber: snapshot.currentSlideNumber,
          totalSlides: snapshot.totalSlides,
          totalUnitCount: snapshot.totalSlides,
          currentUnitLabel: snapshot.activeUnitTitle
        }
      });
    });
  }

  startNewChat() {
    this.chatService.createNewChat(this.t('New Chat'));
    setTimeout(() => this.chatInput.nativeElement.focus(), 100);
  }

  openTutorSidebar() {
    this.sidebarRequestedOpen.set(true);
  }

  closeTutorSidebar() {
    this.sidebarRequestedOpen.set(false);
  }

  openConversation(chat: Conversation) {
    this.chatService.activeChatId.set(chat.id);
    this.closeTutorSidebar();

    this.loadChatContext(chat);
  }

  clearAllChats() {
    if (confirm(this.t('Are you sure you want to clear all conversations?'))) {
      this.chatService.clearAllConversations();
    }
  }

  isContextValid(): boolean {
    const spec = (this.studentContext.specialization === 'Other' ? this.studentContext.customSpecialization : this.studentContext.specialization).trim();
    return !!(spec && this.studentContext.subject.trim() && this.studentContext.helpType.trim());
  }

  startContextChat() {
    if (!this.isContextValid()) return;
    
    const spec = this.studentContext.specialization === 'Other' ? this.studentContext.customSpecialization : this.studentContext.specialization;
    const helpTypeLabel = this.helpTypeOptions().find(option => option.value === this.studentContext.helpType)?.label || this.studentContext.helpType;
    
    const context = {
      specialization: spec,
      subject: this.studentContext.subject,
      lesson: this.studentContext.lesson,
      helpType: this.studentContext.helpType
    };
    
    const title = `${context.subject} - ${helpTypeLabel}`;
    this.chatService.createNewChat(title, context);
    this.closeTutorSidebar();

    const requestText = [
      `I am studying ${spec}.`,
      `The subject/course is ${context.subject}.`,
      context.lesson ? `We are currently on the lesson/chapter ${context.lesson}.` : '',
      `I need help with ${context.helpType}.`,
      'Please start as a teacher using the selected explanation level and this study context.'
    ].filter(Boolean).join(' ');

    void this.submitTutorTurn({
      userVisibleText: this.t('Start Session'),
      requestText,
      useConversationHistory: false
    });
  }

  loadChatContext(chat: { context?: { specialization: string; subject: string; lesson: string; helpType: string } }) {
    if (chat.context) {
      this.studentContext.customSpecialization = '';
      this.studentContext.specialization = chat.context.specialization;
      this.studentContext.subject = chat.context.subject;
      this.studentContext.lesson = chat.context.lesson;
      this.studentContext.helpType = chat.context.helpType;
      
      // Handle custom specialization if it's not in the predefined list
      const predefined = ['Medicine', 'Engineering', 'Computer Science', 'Law', 'Business', 'High School'];
      if (!predefined.includes(chat.context.specialization)) {
        this.studentContext.specialization = 'Other';
        this.studentContext.customSpecialization = chat.context.specialization;
      }
    }
  }

  async onFileSelected(event: Event) {
    const target = event.target as HTMLInputElement;
    const files = target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      void this.ingestUploadedFile(file);
    });
    target.value = '';
  }

  removeFile(index: number) {
    this.uploadedFiles.update(list => list.filter((_, i) => i !== index));
  }

  adjustHeight() {
    const el = this.chatInput.nativeElement;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }

  scrollToBottom() {
    if (this.msgContainer) {
      this.msgContainer.nativeElement.scrollTo({
        top: this.msgContainer.nativeElement.scrollHeight,
        behavior: 'smooth'
      });
    }
  }

  toggleLiveVoice() {
    if (this.isRecording()) { 
      this.stopMic();
      return; 
    }
    
    const SpeechRecognition = (window as unknown as Record<string, unknown>)['webkitSpeechRecognition'] || (window as unknown as Record<string, unknown>)['SpeechRecognition'];
    if (!SpeechRecognition) return;
    
    this.recognition = new (SpeechRecognition as new () => unknown)();
    (this.recognition as Record<string, unknown>)['lang'] = this.ai.getSpeechRecognitionLocale();
    (this.recognition as Record<string, unknown>)['continuous'] = true;
    (this.recognition as Record<string, unknown>)['interimResults'] = true;
    
    (this.recognition as Record<string, unknown>)['onstart'] = () => this.isRecording.set(true);
    (this.recognition as Record<string, unknown>)['onresult'] = (event: { results: Iterable<{ transcript: string }[]> }) => {
      const transcript = Array.from(event.results).map(r => r[0].transcript).join('');
      this.chatInput.nativeElement.value = transcript;
      this.adjustHeight();
    };
    ((this.recognition as Record<string, unknown>)['onend'] as () => void) = () => this.isRecording.set(false);
    ((this.recognition as Record<string, unknown>)['start'] as () => void)();
  }

  stopMic() {
    if (this.recognition) {
      ((this.recognition as Record<string, unknown>)['stop'] as () => void)();
      this.isRecording.set(false);
    }
  }

  toggleMessageTools(index: number, event: Event) {
    event.stopPropagation();
    this.openToolMenuIndex.update(current => current === index ? null : index);
  }

  async runMessageTool(tool: TutorMessageTool, sourceText: string, messageIndex: number) {
    this.openToolMenuIndex.set(null);

    if (tool.id === 'mindMap') {
      const activeChat = this.chatService.getActiveChat();
      if (!activeChat || !sourceText.trim()) {
        return;
      }

      this.mindMapService.openFromSource({
        sourceText,
        sourceType: 'tutor',
        sourceTitle: activeChat.title || this.t('From AI Tutor'),
        conversationId: activeChat.id,
        messageId: String(messageIndex),
        language: this.ai.currentLanguage(),
        mapName: activeChat.title || this.t('Tutor Mind Map')
      });
      this.openMindMap.emit();
      return;
    }

    if (tool.id === 'flashcards') {
      const activeChat = this.chatService.getActiveChat();
      if (!activeChat || !sourceText.trim()) {
        return;
      }

      this.flashcardsService.openFromSource({
        sourceText,
        sourceType: 'tutor',
        sourceTitle: activeChat.title || this.t('From AI Tutor'),
        conversationId: activeChat.id,
        messageId: String(messageIndex),
        language: this.ai.currentLanguage(),
        groupName: activeChat.title || this.t('Tutor Flashcards')
      });
      this.openFlashcards.emit();
      return;
    }

    if (tool.id === 'virtualLab') {
      await this.launchVirtualLabFromConversation(sourceText, messageIndex);
      return;
    }

    await this.submitTutorTurn({
      userVisibleText: tool.userMessage,
      requestText: this.buildDerivedRequest(sourceText, tool.prompt),
      extraSystemInstruction: `${tool.prompt}\nUse the referenced explanation as the primary source. Preserve accuracy and educational clarity.`,
      useConversationHistory: false
    });
  }

  async sendUnderstandingFeedback(action: TutorUnderstandingAction, sourceText: string) {
    await this.submitTutorTurn({
      userVisibleText: action.userMessage,
      requestText: this.buildDerivedRequest(sourceText, action.prompt),
      extraSystemInstruction: `${action.prompt}\nUse the referenced explanation as the concept to revisit or assess.`,
      useConversationHistory: false
    });
  }

  async runTutorQuickAction(action: TutorQuickAction, sourceText: string) {
    await this.submitTutorTurn({
      userVisibleText: action.label,
      requestText: this.buildDerivedRequest(sourceText, action.prompt),
      extraSystemInstruction: `${action.prompt}\nStay grounded in the same topic and preserve continuity with the previous explanation.`,
      useConversationHistory: true
    });
  }

  async continueFileTeaching(mode: Extract<TutorIntent, 'continue' | 'explain_more' | 'simplify' | 'quiz'>) {
    const state = this.fileTeachingState();
    if (!state?.active) {
      return;
    }

    if (mode === 'continue' && state.currentUnitIndex + 1 >= state.units.length && state.extractionState === 'reading') {
      this.setDocumentStatusState(this.uiLabels().preparingNextPages, 'info');
      return;
    }

    if (mode === 'continue') {
      this.cancelAutoNext();
      await this.goToNextSlide();
      return;
    }

    const currentUnit = state.units[state.currentUnitIndex];
    if (!currentUnit) {
      return;
    }

    const prompts: Record<Extract<TutorIntent, 'continue' | 'explain_more' | 'simplify' | 'quiz'>, { user: string; request: string }> = {
      continue: {
        user: this.t('Continue with the next part'),
        request: this.t('Continue teaching the next part of the uploaded material.')
      },
      explain_more: {
        user: this.t('Explain this part in more depth'),
        request: this.t('Explain this same slide/page/section in more depth before moving on.')
      },
      simplify: {
        user: this.t('Simplify this part'),
        request: this.t('Simplify this same slide/page/section with easier wording and one practical example.')
      },
      quiz: {
        user: this.t('Quiz me on this part'),
        request: this.t('Create a short quiz based only on this same slide/page/section.')
      }
    };

    await this.submitTutorTurn({
      userVisibleText: prompts[mode].user,
      requestText: `${prompts[mode].request}\n\n${currentUnit.text}`,
      useConversationHistory: true
    });
  }

  onDiagramSaved(base64: string) {
    this.uploadedFiles.update(list => [...list, {
      id: crypto.randomUUID(),
      data: base64,
      mimeType: 'image/png',
      name: `diagram_${Date.now()}.png`,
      sourceType: 'image',
      status: 'ready',
      totalUnits: 1,
      currentPreparedUnits: 1
    }]);
    this.showDiagramModal.set(false);
  }

  async analyzePerformance() {
    const activeChat = this.chatService.getActiveChat();
    if (!activeChat || activeChat.messages.length < 2) return;

    this.isAnalyzing.set(true);
    try {
      const messagesForAnalysis = activeChat.messages.map(m => ({ role: m.role, text: m.text }));
      const topic = activeChat.context?.subject || activeChat.title;
      const plan = await this.ai.analyzeTutorTest(messagesForAnalysis, topic);
      this.improvementPlan.set(plan);
    } catch (err) {
      console.error('Error analyzing performance:', err);
    } finally {
      this.isAnalyzing.set(false);
    }
  }

  async send() {
    const text = this.chatInput.nativeElement.value.trim();
    if (!text) return;

    if (this.fileTeachingState()?.active) {
      if (/^(continue|next|كمل|كمّل|التالي)$/i.test(text)) {
        this.chatInput.nativeElement.value = '';
        this.adjustHeight();
        await this.goToNextSlide();
        return;
      }
      const slideJump = text.match(/(?:slide|page|شريحة|صفحة)\s*(\d+)/i);
      if (slideJump) {
        this.slideJumpInput.set(slideJump[1]);
        this.chatInput.nativeElement.value = '';
        this.adjustHeight();
        await this.jumpToSlide();
        return;
      }
    }

    const currentFiles = this.fileTeachingState()?.active ? [] : [...this.uploadedFiles()];
    await this.submitTutorTurn({
      userVisibleText: text,
      requestText: text,
      files: currentFiles,
      useConversationHistory: true,
      resetComposer: true
    });
  }

  @HostListener('document:click')
  handleDocumentClick() {
    this.registerUserInteraction();
    this.openToolMenuIndex.set(null);
    this.slideActionMenuOpen.set(false);
  }

  @HostListener('document:wheel')
  handleDocumentWheel() {
    this.registerUserInteraction();
  }

  @HostListener('document:keydown')
  handleDocumentKeydown() {
    this.registerUserInteraction();
  }

  @HostListener('document:keydown.escape')
  handleEscape() {
    this.openToolMenuIndex.set(null);
    this.slideActionMenuOpen.set(false);
    this.closeTutorSidebar();
  }

  ngOnDestroy() {
    this.cancelAutoNext();
    this.stopMic();
  }

  registerUserInteraction() {
    if (!this.autoNextSlideId) {
      return;
    }
    this.cancelAutoNext();
  }

  currentTeachingUnitLabel(): string {
    return this.activeSlideSnapshot()?.activeUnitTitle || '';
  }

  slideProgressLabel(): string {
    const snapshot = this.activeSlideSnapshot();
    if (!snapshot) {
      return '';
    }
    return `📄 ${this.uiLabels().slideIndicator} ${snapshot.currentSlideNumber} ${this.uiLabels().ofLabel} ${snapshot.totalSlides}`;
  }

  slideProgressPercent(): number {
    return this.activeSlideSnapshot()?.progressPercent || 0;
  }

  currentTeachingUnit(): TutorTeachingUnit | null {
    return this.activeSlideSnapshot()?.activeUnit || null;
  }

  currentSlideQuiz(): SlideMiniQuiz | null {
    const unit = this.currentTeachingUnit();
    return unit ? this.buildMiniQuizForUnit(unit) : null;
  }

  currentSlideQuizResult(): SlideMiniQuizResult | null {
    const quiz = this.currentSlideQuiz();
    if (!quiz) {
      return null;
    }
    return this.miniQuizResults()[quiz.slideId] || null;
  }

  selectMiniQuizOption(optionId: string) {
    const quiz = this.currentSlideQuiz();
    if (!quiz) {
      return;
    }

    const chosen = quiz.options.find((option) => option.id === optionId);
    if (!chosen) {
      return;
    }

    this.miniQuizResults.update((results) => ({
      ...results,
      [quiz.slideId]: {
        selectedOptionId: optionId,
        isCorrect: chosen.isCorrect
      }
    }));
    this.cancelAutoNext();
  }

  skipMiniQuiz() {
    const quiz = this.currentSlideQuiz();
    if (!quiz) {
      return;
    }

    this.miniQuizResults.update((results) => ({
      ...results,
      [quiz.slideId]: {
        selectedOptionId: 'skip',
        isCorrect: false,
        skipped: true
      }
    }));
  }

  toggleAutoNext(enabled: boolean) {
    this.autoNextEnabled.set(enabled);
    if (!enabled) {
      this.cancelAutoNext();
      return;
    }

    const currentUnit = this.currentTeachingUnit();
    if (currentUnit && !this.isThinking() && this.canGoToNextSlide()) {
      this.scheduleAutoNextForSlide(currentUnit.id);
    }
  }

  async skipCurrentSlideExplanation() {
    this.registerUserInteraction();
    await this.goToNextSlide();
  }

  async requestCurrentSlideVariant(mode: 'quick' | 'detailed') {
    const state = this.fileTeachingState();
    const currentUnit = this.currentTeachingUnit();
    if (!state?.active || !currentUnit) {
      return;
    }

    this.cancelAutoNext();
    const modePrompt = mode === 'quick'
      ? this.t('Re-teach this same slide in a short, high-clarity format with 2 to 4 concise teaching bullets and one short takeaway.')
      : this.t('Re-teach this same slide in a more detailed, step-by-step format with clearer reasoning, key terms, and one practical example before moving on.');

    await this.submitTutorTurn({
      userVisibleText: mode === 'quick' ? this.uiLabels().quickExplanationMode : this.uiLabels().detailedExplanationMode,
      requestText: `${modePrompt}\n\n${currentUnit.text}`,
      extraSystemInstruction: [
        this.buildDocumentTeachingInstruction(
          currentUnit,
          state.mode,
          state.totalSlides || state.totalUnitCount || state.units.length,
          state.extractionState === 'limited'
        ),
        mode === 'quick'
          ? 'Keep it concise, elegant, and scannable. Use shorter sections and do not ramble.'
          : 'Go deeper while staying structured. Use compact sections, clearer mechanisms, and stronger examples.'
      ].join('\n'),
      useConversationHistory: true
    });
  }

  private buildMiniQuizForUnit(unit: TutorTeachingUnit): SlideMiniQuiz | null {
    const normalized = unit.text
      .replace(/\s+/g, ' ')
      .replace(/^[#*\-\d.\s]+/, '')
      .trim();
    if (!normalized || normalized.length < 40) {
      return null;
    }

    const title = (unit.title || unit.label || this.t('this slide')).replace(/\s+/g, ' ').trim();
    const sentences = normalized
      .split(/(?<=[.!?؟])\s+|\n+/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 35);
    const focusSentence = (sentences[0] || normalized).replace(/\s+/g, ' ').trim();
    const conciseFocus = focusSentence.length > 180 ? `${focusSentence.slice(0, 177).trim()}...` : focusSentence;
    const quizPrompt = this.ai.currentLanguage() === 'ar'
      ? `تحقق سريع: هل هذه العبارة تعبّر عن الفكرة الأساسية في ${title}؟`
      : `Quick check: does this statement match the core idea of ${title}?`;
    const explanation = this.ai.currentLanguage() === 'ar'
      ? `العبارة الصحيحة مأخوذة من الفكرة الرئيسية في ${title} وتلخّص مضمون الشريحة الحالية.`
      : `The correct choice matches the main idea presented on ${title} and stays focused on this slide only.`;

    return {
      slideId: unit.id,
      question: quizPrompt,
      prompt: conciseFocus,
      explanation,
      options: [
        { id: 'true', label: this.ai.currentLanguage() === 'ar' ? 'صح' : 'True', text: this.ai.currentLanguage() === 'ar' ? 'صح' : 'True', isCorrect: true },
        { id: 'false', label: this.ai.currentLanguage() === 'ar' ? 'خطأ' : 'False', text: this.ai.currentLanguage() === 'ar' ? 'خطأ' : 'False', isCorrect: false }
      ]
    };
  }

  private triggerSlideTransition() {
    this.slideTransitionActive.set(true);
    if (typeof window === 'undefined') {
      this.slideTransitionActive.set(false);
      return;
    }
    window.setTimeout(() => this.slideTransitionActive.set(false), 420);
  }

  private cancelAutoNext() {
    if (this.autoNextTimeoutId) {
      clearTimeout(this.autoNextTimeoutId);
      this.autoNextTimeoutId = null;
    }
    if (this.autoNextIntervalId) {
      clearInterval(this.autoNextIntervalId);
      this.autoNextIntervalId = null;
    }
    this.autoNextSlideId = null;
    this.autoNextCountdown.set(null);
  }

  private scheduleAutoNextForSlide(slideId: string) {
    this.cancelAutoNext();
    if (!this.autoNextEnabled() || !this.canGoToNextSlide()) {
      return;
    }

    this.autoNextSlideId = slideId;
    this.autoNextInteractionBaseline = Date.now();
    this.autoNextCountdown.set(3);
    this.autoNextIntervalId = setInterval(() => {
      const current = this.autoNextCountdown();
      if (current === null || current <= 1) {
        this.autoNextCountdown.set(1);
        return;
      }
      this.autoNextCountdown.set(current - 1);
    }, 1000);

    this.autoNextTimeoutId = setTimeout(async () => {
      const state = this.fileTeachingState();
      const currentUnit = state?.active ? state.units[state.currentUnitIndex] : null;
      const noInteractionSinceSchedule = Date.now() >= this.autoNextInteractionBaseline;
      if (
        this.autoNextEnabled() &&
        !this.isThinking() &&
        state?.active &&
        currentUnit?.id === slideId &&
        noInteractionSinceSchedule
      ) {
        this.cancelAutoNext();
        await this.goToNextSlide();
        return;
      }
      this.cancelAutoNext();
    }, 3000);
  }

  canGoToNextSlide(): boolean {
    const state = this.fileTeachingState();
    if (!state?.active) return false;
    return state.currentUnitIndex < state.units.length - 1 || state.extractionState === 'reading';
  }

  canGoToPreviousSlide(): boolean {
    const state = this.fileTeachingState();
    if (!state?.active) return false;
    return state.currentUnitIndex > 0;
  }

  async goToNextSlide() {
    const state = this.fileTeachingState();
    if (!state?.active) return;
    this.cancelAutoNext();
    const snapshot = this.activeSlideSnapshot();
    console.debug('[SmartTutor][PDF] Continue request', {
      currentSlideIndex: snapshot?.safeIndex ?? state.currentUnitIndex,
      currentSlideNumber: snapshot?.currentSlideNumber ?? state.currentSlideNumber ?? 1,
      totalSlides: snapshot?.totalSlides ?? state.units.length,
      progressPercent: snapshot?.progressPercent ?? 0,
      activeUnitId: snapshot?.activeUnitId ?? '',
      activeUnitTitle: snapshot?.activeUnitTitle ?? ''
    });
    const nextIndex = state.currentUnitIndex + 1 < state.units.length ? state.currentUnitIndex + 1 : null;
    if (nextIndex === null) {
      if (state.extractionState === 'reading') {
        this.setDocumentStatusState(this.uiLabels().preparingNextPages, 'info');
        return;
      }
      this.markChapterCompleted(state);
      return;
    }
    await this.navigateToSlideIndex(nextIndex, 'continue');
  }

  async goToPreviousSlide() {
    const state = this.fileTeachingState();
    if (!state?.active) return;
    this.cancelAutoNext();
    const previousIndex = state.currentUnitIndex > 0 ? state.currentUnitIndex - 1 : null;
    if (previousIndex === null) return;
    await this.navigateToSlideIndex(previousIndex, 'continue', true);
  }

  async jumpToSlide() {
    const state = this.fileTeachingState();
    if (!state?.active) return;
    this.cancelAutoNext();
    const requested = Number(this.slideJumpInput().trim());
    if (!Number.isFinite(requested)) return;
    const actualIndex = state.units.findIndex((unit) => (unit.actualSlideNumber || unit.order) === requested);
    if (actualIndex === -1) {
      this.setDocumentStatusState(this.t('This slide is not ready yet or does not exist in the document.'), 'warning');
      return;
    }
    await this.navigateToSlideIndex(actualIndex, 'continue');
  }

  resolveMessageDirection(text: string): 'rtl' | 'ltr' {
    const normalized = (text || '').trim();
    if (!normalized) {
      return this.isRtl() ? 'rtl' : 'ltr';
    }

    const rtlMatch = normalized.match(/[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/);
    const latinMatch = normalized.match(/[A-Za-z]/);
    if (rtlMatch && !latinMatch) {
      return 'rtl';
    }
    if (latinMatch && !rtlMatch) {
      return 'ltr';
    }
    return this.isRtl() ? 'rtl' : 'ltr';
  }

  renderMessageHtml(text: string, role: Message['role']): string {
    const normalized = this.normalizeTutorResponse(text);
    if (!normalized) {
      return '';
    }

    if (role === 'user') {
      return normalized
        .split(/\n{2,}/)
        .map((paragraph) => `<p>${this.formatInlineMarkup(paragraph.trim()).replace(/\n/g, '<br>')}</p>`)
        .join('');
    }

    const lines = normalized.split(/\r?\n/);
    const blocks: string[] = [];
    let paragraphBuffer: string[] = [];
    let listBuffer: string[] = [];
    let listType: 'ul' | 'ol' | null = null;

    const flushParagraph = () => {
      if (paragraphBuffer.length === 0) return;
      blocks.push(`<p>${this.formatInlineMarkup(paragraphBuffer.join('\n'))}</p>`);
      paragraphBuffer = [];
    };

    const flushList = () => {
      if (listBuffer.length === 0 || !listType) return;
      blocks.push(`<${listType}>${listBuffer.join('')}</${listType}>`);
      listBuffer = [];
      listType = null;
    };

    for (const rawLine of lines) {
      const line = rawLine.trimEnd();
      const trimmed = line.trim();

      if (!trimmed) {
        flushParagraph();
        flushList();
        continue;
      }

      if (/^#{1,4}\s+/.test(trimmed)) {
        flushParagraph();
        flushList();
        const level = Math.min(4, Math.max(2, trimmed.match(/^#+/)?.[0].length || 2));
        blocks.push(`<h${level}>${this.formatInlineMarkup(trimmed.replace(/^#{1,4}\s+/, ''))}</h${level}>`);
        continue;
      }

      const semanticPrefix = this.detectSemanticPrefix(trimmed);
      if (semanticPrefix) {
        flushParagraph();
        flushList();
        const body = trimmed.slice(semanticPrefix.raw.length).trim();
        blocks.push(
          `<div class="tutor-callout tutor-callout-${semanticPrefix.kind}">` +
          `<p class="tutor-callout-label">${this.escapeHtml(semanticPrefix.label)}</p>` +
          `<p>${this.formatInlineMarkup(body)}</p>` +
          `</div>`
        );
        continue;
      }

      if (/^\*\*[^*].+\*\*$/.test(trimmed) && trimmed.length < 120) {
        flushParagraph();
        flushList();
        blocks.push(`<h3>${this.formatInlineMarkup(trimmed.replace(/^\*\*|\*\*$/g, ''))}</h3>`);
        continue;
      }

      if (/^(\-|\*|•)\s+/.test(trimmed)) {
        flushParagraph();
        const item = trimmed.replace(/^(\-|\*|•)\s+/, '');
        if (listType !== 'ul') {
          flushList();
          listType = 'ul';
        }
        listBuffer.push(`<li>${this.formatInlineMarkup(item)}</li>`);
        continue;
      }

      if (/^\d+[\.\)]\s+/.test(trimmed)) {
        flushParagraph();
        const item = trimmed.replace(/^\d+[\.\)]\s+/, '');
        if (listType !== 'ol') {
          flushList();
          listType = 'ol';
        }
        listBuffer.push(`<li>${this.formatInlineMarkup(item)}</li>`);
        continue;
      }

      flushList();
      paragraphBuffer.push(trimmed);
    }

    flushParagraph();
    flushList();

    return blocks.join('');
  }

  private normalizeTutorResponse(text: string): string {
    return this.stripTutorLeadIn((text || '')
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n([•\-*])(?=\S)/g, '\n$1 ')
      .replace(/([^\n])\n(?=(?:\d+[\.\)]\s|[-*•]\s|#{1,4}\s))/g, '$1\n\n')
      .trim());
  }

  private stripTutorLeadIn(text: string): string {
    let normalized = text.trim();
    const patterns = [
      /^(?:حسن(?:ا|ًا)|حسنًا)[،,:-]?\s*/i,
      /^(?:دعنا نبدأ|لنبدأ|سنبدأ الآن|سنشرح الآن|سأشرح الآن|سأبدأ الآن)[،,:-]?\s*/i,
      /^(?:لنبدأ بشرح الصفحة|دعنا نبدأ بشرح الصفحة|سأبدأ بشرح الصفحة|سنبدأ بشرح الصفحة)[،,:-]?\s*/i,
      /^(?:سأقوم بشرح|سأشرح|سنشرح)\s+(?:هذه الصفحة|الصفحة الحالية|الصفحة|هذا المحتوى|المحتوى الآن)[،,:-]?\s*/i,
      /^(?:Here'?s|Here is|Okay|Ok|Alright|Let'?s begin|Let'?s start|We will now explain|We will explain now)[,:\-]?\s*/i
    ];

    let changed = true;
    while (changed) {
      changed = false;
      for (const pattern of patterns) {
        const next = normalized.replace(pattern, '');
        if (next !== normalized) {
          normalized = next.trimStart();
          changed = true;
        }
      }
    }

    normalized = normalized.replace(/^(?:الصفحة\s+\S+\s*[:\-]\s*)/i, '');
    return normalized.trim();
  }

  private detectSemanticPrefix(line: string): { raw: string; label: string; kind: 'note' | 'warning' | 'definition' | 'example' } | null {
    const patterns = [
      { regex: /^(note|ملاحظة)\s*[:\-]/i, label: this.ai.currentLanguage() === 'ar' ? 'ملاحظة' : 'Note', kind: 'note' as const },
      { regex: /^(warning|important|تحذير|مهم)\s*[:\-]/i, label: this.ai.currentLanguage() === 'ar' ? 'تنبيه' : 'Important', kind: 'warning' as const },
      { regex: /^(definition|تعريف)\s*[:\-]/i, label: this.ai.currentLanguage() === 'ar' ? 'تعريف' : 'Definition', kind: 'definition' as const },
      { regex: /^(example|مثال)\s*[:\-]/i, label: this.ai.currentLanguage() === 'ar' ? 'مثال' : 'Example', kind: 'example' as const }
    ];

    for (const pattern of patterns) {
      const match = line.match(pattern.regex);
      if (match) {
        return { raw: match[0], label: pattern.label, kind: pattern.kind };
      }
    }

    return null;
  }

  private formatInlineMarkup(value: string): string {
    const escaped = this.escapeHtml(value);
    return escaped
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private async ingestUploadedFile(file: File): Promise<void> {
    const fileId = crypto.randomUUID();
    const sourceType = this.detectSourceType(file);
    this.slideJumpInput.set('');
    this.slideActionMenuOpen.set(false);
    this.cancelAutoNext();

    this.uploadedFiles.update((list) => [...list, {
      id: fileId,
      data: '',
      mimeType: file.type || 'application/octet-stream',
      name: file.name,
      sourceType,
      status: 'reading',
      currentPreparedUnits: 0,
      totalUnits: 0,
      extractionMessage: this.uiLabels().readingDocument
    }]);
    this.isPreparingDocument.set(true);
    this.setDocumentStatusState(this.uiLabels().readingDocument, 'info');

    try {
      const dataUrlPromise = this.readFileAsDataUrl(file);
      const arrayBufferPromise = file.arrayBuffer();
      const [dataUrl, arrayBuffer] = await Promise.all([dataUrlPromise, arrayBufferPromise]);
      const base64Data = dataUrl.split(',')[1] || '';
      this.updateUploadedFile(fileId, { data: base64Data, mimeType: file.type || 'application/octet-stream' });

      const extracted = await this.extractTeachingUnits(fileId, file, arrayBuffer, file.type || 'application/octet-stream');
      this.documentUnitCache.set(fileId, extracted.units);
      this.updateUploadedFile(fileId, {
        extractedText: extracted.text,
        teachingUnits: extracted.units,
        teachingMode: extracted.mode,
        totalUnits: extracted.totalUnits,
        currentPreparedUnits: extracted.units.length,
        status: extracted.limited ? 'limited' : 'starting',
        extractionMessage: extracted.limited
          ? this.t('Text extraction is limited, but teaching will start from the best available page.')
          : this.uiLabels().startingPageOne
      });

      this.mergeTeachingUnitsIntoActiveState(fileId, file.name, extracted.units, {
        mode: extracted.mode,
        totalUnits: extracted.totalUnits,
        limited: extracted.limited
      });

      if (extracted.units.length > 0) {
        const firstTeachingUnit =
          extracted.units.find((unit) => unit.isMeaningful !== false) ?? extracted.units[0];
        this.setDocumentStatusState(
          extracted.limited
            ? this.t('Document text is partially available. Starting from the first readable page...')
            : `${this.uiLabels().startingPageOne} ${firstTeachingUnit.label}`,
          extracted.limited ? 'warning' : 'success'
        );
        await this.maybeAutoStartDocumentTeaching(
          fileId,
          file.name,
          firstTeachingUnit,
          extracted.mode,
          extracted.totalUnits,
          extracted.limited
        );
      } else {
        this.setDocumentStatusState(
          this.t('Text extraction from this document is very limited. You can still ask targeted questions, but automatic teaching may be incomplete.'),
          'warning'
        );
      }
    } catch (error) {
      console.error('Document ingestion failed:', error);
      this.updateUploadedFile(fileId, {
        status: 'error',
        extractionMessage: this.t('Failed to read this document.')
      });
      this.setDocumentStatusState(this.t('Failed to read this document. Please try another file or a text-based PDF.'), 'error');
    } finally {
      this.isPreparingDocument.set(false);
    }
  }

  private detectSourceType(file: File): UploadedTutorFile['sourceType'] {
    const mimeType = file.type || '';
    const lowerName = file.name.toLowerCase();
    if (mimeType.includes('pdf') || lowerName.endsWith('.pdf')) return 'pdf';
    if (mimeType.includes('word') || lowerName.endsWith('.docx') || lowerName.endsWith('.doc')) return 'doc';
    if (mimeType.startsWith('text/') || lowerName.endsWith('.txt') || lowerName.endsWith('.md')) return 'text';
    if (mimeType.startsWith('image/')) return 'image';
    return 'generic';
  }

  private updateUploadedFile(fileId: string, patch: Partial<UploadedTutorFile>) {
    this.uploadedFiles.update((list) => list.map((file) => file.id === fileId ? { ...file, ...patch } : file));
  }

  private async readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error || new Error('Failed to read file.'));
      reader.onload = () => resolve(`${reader.result || ''}`);
      reader.readAsDataURL(file);
    });
  }

  private async extractTeachingUnits(
    fileId: string,
    file: File,
    arrayBuffer: ArrayBuffer,
    mimeType: string
  ): Promise<{ text: string; units: TutorTeachingUnit[]; mode: TutorTeachingUnit['kind']; totalUnits: number; limited: boolean }> {
    const lowerName = file.name.toLowerCase();

    if (mimeType.includes('pdf') || lowerName.endsWith('.pdf')) {
      return this.extractPdfTeachingUnits(fileId, file.name, arrayBuffer);
    }

    if (mimeType.includes('word') || lowerName.endsWith('.docx') || lowerName.endsWith('.doc')) {
      return this.extractDocTeachingUnits(file.name, arrayBuffer);
    }

    if (mimeType.startsWith('text/') || lowerName.endsWith('.txt') || lowerName.endsWith('.md')) {
      const text = new TextDecoder().decode(arrayBuffer);
      const units = this.chunkStructuredText(text, file.name, 'section');
      return { text, units, mode: 'section', totalUnits: units.length, limited: units.length === 0 };
    }

    if (mimeType.startsWith('image/')) {
      const text = this.ai.currentLanguage() === 'ar'
        ? `صورة مرجعية مرفوعة: ${file.name}`
        : `Uploaded visual reference: ${file.name}`;
      return {
        text,
        units: [{
          id: `${fileId}-visual-1`,
          label: this.ai.currentLanguage() === 'ar' ? 'مرجع بصري' : 'Visual reference',
          kind: 'visual',
          sourceName: file.name,
          order: 1,
          text
        }],
        mode: 'visual',
        totalUnits: 1,
        limited: true
      };
    }

    const fallbackText = this.ai.currentLanguage() === 'ar'
      ? `ملف مرفوع: ${file.name}`
      : `Uploaded file: ${file.name}`;
    return {
      text: fallbackText,
      units: [{
        id: `${fileId}-chunk-1`,
        label: this.ai.currentLanguage() === 'ar' ? 'محتوى مرفوع' : 'Uploaded content',
        kind: 'chunk',
        sourceName: file.name,
        order: 1,
        text: fallbackText
      }],
      mode: 'chunk',
      totalUnits: 1,
      limited: true
    };
  }

  private async extractPdfTeachingUnits(fileId: string, fileName: string, arrayBuffer: ArrayBuffer) {
    try {
      const pdfjs = await import('pdfjs-dist');
      const pdf = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
      const totalUnits = Math.max(1, pdf.numPages || 1);
      const firstUnit = await this.extractPdfPageUnit(pdf, fileId, fileName, 1)
        || this.buildPdfFallbackUnit(fileId, fileName, 1);
      const units = firstUnit ? [firstUnit] : [];
      console.debug('[SmartTutor][PDF] Initial extraction', {
        fileName,
        totalSlides: totalUnits,
        extractedUnitsLength: units.length
      });
      void this.prefetchRemainingPdfUnits(fileId, pdf, fileName, totalUnits, units);

      return {
        text: firstUnit?.text || '',
        units,
        mode: 'page' as const,
        totalUnits,
        limited: units.length === 0
      };
    } catch (error) {
      console.warn('Failed to extract PDF teaching units, falling back to generic chunking.', error);
      const estimatedPageCount = this.estimatePdfPageCountFromBytes(arrayBuffer);
      const units = this.buildPdfFallbackUnits(fileId, fileName, estimatedPageCount);
      console.debug('[SmartTutor][PDF] Fallback extraction', {
        fileName,
        totalSlides: estimatedPageCount,
        extractedUnitsLength: units.length
      });
      return {
        text: units.map((unit) => unit.text).join('\n\n'),
        units,
        mode: 'page' as const,
        totalUnits: Math.max(estimatedPageCount, units.length),
        limited: true
      };
    }
  }

  private async extractDocTeachingUnits(fileName: string, arrayBuffer: ArrayBuffer) {
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ arrayBuffer });
      const text = (result.value || '').trim();
      const units = this.chunkStructuredText(text, fileName, 'section');
      return {
        text,
        units,
        mode: 'section' as const,
        totalUnits: units.length,
        limited: units.length === 0
      };
    } catch (error) {
      console.warn('Failed to extract DOC teaching units, falling back to generic chunking.', error);
      const fallbackText = this.ai.currentLanguage() === 'ar'
        ? `تم رفع مستند باسم ${fileName}.`
        : `A document named ${fileName} was uploaded.`;
      const units = this.chunkStructuredText(fallbackText, fileName, 'chunk');
      return {
        text: fallbackText,
        units,
        mode: 'chunk' as const,
        totalUnits: units.length,
        limited: true
      };
    }
  }

  private async extractPdfPageUnit(
    pdf: any,
    fileId: string,
    fileName: string,
    pageNumber: number
  ): Promise<TutorTeachingUnit | null> {
    try {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      const normalizedText = pageText || (this.ai.currentLanguage() === 'ar'
        ? 'هذه الصفحة تحتوي على محتوى بصري أو نص محدود.'
        : 'This page contains mostly visual content or limited extractable text.');
      const classification = this.classifySlideContent(normalizedText);
      const title = this.extractSlideTitle(normalizedText);

      return {
        id: `${fileId}-page-${pageNumber}`,
        label: `${this.t('Page')} ${pageNumber}`,
        kind: 'page',
        sourceName: fileName,
        order: pageNumber,
        text: normalizedText,
        title,
        category: classification.category,
        isMeaningful: classification.isMeaningful,
        actualSlideNumber: pageNumber
      };
    } catch (error) {
      console.warn(`[SmartTutor][PDF] Failed to extract page ${pageNumber} from ${fileName}. Using page fallback.`, error);
      return this.buildPdfFallbackUnit(fileId, fileName, pageNumber);
    }
  }

  private async prefetchRemainingPdfUnits(
    fileId: string,
    pdf: any,
    fileName: string,
    totalUnits: number,
    initialUnits: TutorTeachingUnit[]
  ): Promise<void> {
    const collected = [...initialUnits];
    this.updateUploadedFile(fileId, {
      totalUnits,
      currentPreparedUnits: collected.length,
      extractionMessage: totalUnits > 1 ? this.uiLabels().preparingNextPages : this.uiLabels().startingPageOne
    });

    for (let pageNumber = 2; pageNumber <= totalUnits; pageNumber += 1) {
      try {
        const unit = await this.extractPdfPageUnit(pdf, fileId, fileName, pageNumber)
          || this.buildPdfFallbackUnit(fileId, fileName, pageNumber);
        collected.push(unit);
        this.documentUnitCache.set(fileId, [...collected]);
        console.debug('[SmartTutor][PDF] Prefetched page', {
          fileName,
          pageNumber,
          totalSlides: totalUnits,
          extractedUnitsLength: collected.length
        });
        this.updateUploadedFile(fileId, {
          teachingUnits: [...collected],
          currentPreparedUnits: collected.length,
          totalUnits,
          status: pageNumber === totalUnits ? 'ready' : 'starting',
          extractionMessage: pageNumber === totalUnits
            ? this.t('Document ready for page-by-page teaching.')
            : `${this.uiLabels().preparingNextPages} ${pageNumber}/${totalUnits}`
        });
        this.mergeTeachingUnitsIntoActiveState(fileId, fileName, [...collected], {
          mode: 'page',
          totalUnits,
          limited: false
        });
      } catch (error) {
        console.warn(`Failed to extract page ${pageNumber} from ${fileName}`, error);
        const fallbackUnit = this.buildPdfFallbackUnit(fileId, fileName, pageNumber);
        collected.push(fallbackUnit);
        this.documentUnitCache.set(fileId, [...collected]);
      }
    }

    this.clearDocumentStatusSoon();
  }

  private chunkStructuredText(
    text: string,
    fileName: string,
    kind: Extract<TutorTeachingUnit['kind'], 'section' | 'chunk' | 'page'>
  ): TutorTeachingUnit[] {
    const normalized = (text || '').replace(/\r\n/g, '\n').trim();
    if (!normalized) {
      return [];
    }

    const roughSections = normalized
      .split(/\n{2,}/)
      .map((section) => section.trim())
      .filter(Boolean);

    const chunks = roughSections.length > 0 ? roughSections : [normalized];
    const maxLength = 900;
    const units: TutorTeachingUnit[] = [];

    chunks.forEach((chunk, sectionIndex) => {
      if (chunk.length <= maxLength) {
        const classification = this.classifySlideContent(chunk);
        units.push({
          id: `${fileName}-${kind}-${units.length + 1}`,
          label: kind === 'page' ? `${this.t('Page')} ${units.length + 1}` : `${this.t('Part')} ${units.length + 1}`,
          kind,
          sourceName: fileName,
          order: units.length + 1,
          text: chunk,
          title: this.extractSlideTitle(chunk),
          category: classification.category,
          isMeaningful: classification.isMeaningful,
          actualSlideNumber: units.length + 1
        });
        return;
      }

      const sentences = chunk.split(/(?<=[.!?؟])\s+/);
      let current = '';
      sentences.forEach((sentence) => {
        const candidate = current ? `${current} ${sentence}` : sentence;
        if (candidate.length > maxLength && current) {
          const classification = this.classifySlideContent(current.trim());
          units.push({
            id: `${fileName}-${kind}-${units.length + 1}`,
            label: `${this.t('Part')} ${units.length + 1}`,
            kind,
            sourceName: fileName,
            order: units.length + 1,
            text: current.trim(),
            title: this.extractSlideTitle(current.trim()),
            category: classification.category,
            isMeaningful: classification.isMeaningful,
            actualSlideNumber: units.length + 1
          });
          current = sentence;
        } else {
          current = candidate;
        }
      });

      if (current.trim()) {
        const finalText = current.trim();
        const classification = this.classifySlideContent(finalText);
        units.push({
          id: `${fileName}-${kind}-${units.length + 1}`,
          label: `${this.t('Part')} ${units.length + 1 + sectionIndex}`,
          kind,
          sourceName: fileName,
          order: units.length + 1,
          text: finalText,
          title: this.extractSlideTitle(finalText),
          category: classification.category,
          isMeaningful: classification.isMeaningful,
          actualSlideNumber: units.length + 1
        });
      }
    });

    return units;
  }

  private estimatePdfPageCountFromBytes(arrayBuffer: ArrayBuffer): number {
    try {
      const rawText = new TextDecoder('latin1').decode(arrayBuffer);
      const matches = rawText.match(/\/Type\s*\/Page\b/g);
      return Math.max(1, matches?.length || 1);
    } catch {
      return 1;
    }
  }

  private buildPdfFallbackUnit(fileId: string, fileName: string, pageNumber: number): TutorTeachingUnit {
    const text = this.ai.currentLanguage() === 'ar'
      ? `تعذّر استخراج النص الكامل من الصفحة ${pageNumber} في ${fileName}. سيكمل المعلم من المحتوى المتاح ويعامل هذه الصفحة كوحدة مستقلة.`
      : `Full text extraction was limited for page ${pageNumber} in ${fileName}. The tutor will continue using the available context while keeping this page as a separate unit.`;
    const classification = this.classifySlideContent(text);

    return {
      id: `${fileId}-page-${pageNumber}`,
      label: `${this.t('Page')} ${pageNumber}`,
      kind: 'page',
      sourceName: fileName,
      order: pageNumber,
      text,
      title: this.extractSlideTitle(text),
      category: classification.category,
      isMeaningful: classification.isMeaningful,
      actualSlideNumber: pageNumber
    };
  }

  private buildPdfFallbackUnits(fileId: string, fileName: string, estimatedPageCount: number): TutorTeachingUnit[] {
    const totalPages = Math.max(1, estimatedPageCount);
    return Array.from({ length: totalPages }, (_, index) =>
      this.buildPdfFallbackUnit(fileId, fileName, index + 1)
    );
  }

  private extractSlideTitle(text: string): string {
    const firstLine = (text || '')
      .split(/\n+/)
      .map((line) => line.trim())
      .find(Boolean) || '';
    return firstLine.slice(0, 120);
  }

  private classifySlideContent(text: string): { category: TutorTeachingUnit['category']; isMeaningful: boolean } {
    const normalized = text.replace(/\s+/g, ' ').trim().toLowerCase();
    const shortText = normalized.length < 24;
    if (!normalized || shortText) {
      return { category: 'low-value', isMeaningful: false };
    }

    if (/(thank you|thanks|questions\??|شكرا|شكراً|شكرا لكم|شكراً لكم|thank\s*you)/i.test(normalized)) {
      return { category: 'ending', isMeaningful: false };
    }

    if (/(references|bibliography|citation|المراجع|المصادر|references and sources)/i.test(normalized)) {
      return { category: 'reference', isMeaningful: false };
    }

    if (/(image|figure|diagram|illustration|chart|شكل|صورة|رسم توضيحي)/i.test(normalized) && normalized.length < 90) {
      return { category: 'image-heavy', isMeaningful: true };
    }

    if (normalized.length < 60) {
      return { category: 'title', isMeaningful: true };
    }

    return { category: 'content', isMeaningful: true };
  }

  private setDocumentStatusState(
    message: string,
    tone: 'info' | 'success' | 'warning' | 'error' = 'info'
  ) {
    this.documentStatus.set(message);
    this.documentStatusTone.set(tone);
  }

  private clearDocumentStatusSoon(delayMs: number = 4500) {
    if (typeof window === 'undefined') {
      return;
    }
    window.setTimeout(() => {
      if (!this.isPreparingDocument()) {
        this.documentStatus.set('');
      }
    }, delayMs);
  }

  private mergeTeachingUnitsIntoActiveState(
    fileId: string,
    fileName: string,
    units: TutorTeachingUnit[],
    options: { mode: TutorTeachingUnit['kind']; totalUnits: number; limited: boolean }
  ) {
    const activeId = this.chatService.activeChatId();
    if (!activeId) {
      return;
    }

    const previous = this.chatService.getTutorState(activeId);
    const existingUnits = (previous?.fileTeaching?.documentId === fileId ? previous.fileTeaching.units : []).slice();
    const mergedUnits = Array.from(
      new Map([...existingUnits, ...units].map((unit) => [unit.id, unit])).values()
    ).sort((a, b) => a.order - b.order);
    const meaningfulUnits = mergedUnits.filter((unit) => unit.isMeaningful !== false);
    const chapterId = this.buildChapterId(fileName, options.totalUnits);
    const firstMeaningfulIndex = Math.max(0, mergedUnits.findIndex((unit) => unit.isMeaningful !== false));
    const currentIndex = previous?.fileTeaching?.documentId === fileId
      ? Math.min(previous.fileTeaching.currentUnitIndex, Math.max(mergedUnits.length - 1, 0))
      : firstMeaningfulIndex;
    const currentUnit = mergedUnits[currentIndex];
    const totalSlides = mergedUnits.length;
    console.debug('[SmartTutor][PDF] Merge teaching units', {
      fileName,
      totalSlides,
      extractedUnitsLength: mergedUnits.length,
      currentSlideIndex: currentIndex
    });

    this.chatService.updateTutorState(activeId, {
      ...(previous || {
        topic: currentUnit?.label || fileName,
        explainedSubtopics: [],
        currentDepth: 0,
        lastIntent: 'direct_answer',
        mcqHistory: []
      }),
      topic: previous?.topic || currentUnit?.label || fileName,
      currentSubtopic: currentUnit?.label || previous?.currentSubtopic,
      studentProfileEstimate: previous?.studentProfileEstimate || this.estimateStudentProfile('', previous),
      fileTeaching: {
        active: true,
        documentId: fileId,
        documentName: fileName,
        chapterId,
        sourceNames: [fileName],
        units: mergedUnits,
        meaningfulUnitIds: meaningfulUnits.map((unit) => unit.id),
        coveredUnitIds: previous?.fileTeaching?.coveredUnitIds || [],
        currentUnitIndex: currentIndex,
        currentUnitLabel: currentUnit?.label || (this.ai.currentLanguage() === 'ar' ? 'الصفحة الحالية' : 'Current page'),
        mode: options.mode,
        totalSlides,
        currentSlideNumber: currentUnit?.actualSlideNumber || currentUnit?.order || currentIndex + 1,
        totalUnitCount: totalSlides,
        extractionState: options.limited ? 'limited' : mergedUnits.length >= options.totalUnits ? 'ready' : 'reading',
        nextActionHint: mergedUnits.length > currentIndex + 1
          ? this.t('Continue to move to the next page.')
          : this.uiLabels().preparingNextPages,
        chapterCompleted: this.completedChapters().some((entry) => entry.chapterId === chapterId)
      }
    });
    console.log({
      totalSlides,
      currentSlideIndex: currentIndex,
      unitsLength: mergedUnits.length
    });
  }

  private async maybeAutoStartDocumentTeaching(
    fileId: string,
    fileName: string,
    firstUnit: TutorTeachingUnit,
    mode: TutorTeachingUnit['kind'],
    totalUnits: number,
    limited: boolean
  ) {
    const activeChat = this.chatService.getActiveChat();
    if (!activeChat) {
      return;
    }

    const matchingFile = this.uploadedFiles().find((file) => file.id === fileId);
    if (!matchingFile || matchingFile.autoStarted) {
      return;
    }

    this.updateUploadedFile(fileId, { autoStarted: true });
    this.triggerSlideTransition();
    await this.submitTutorTurn({
      userVisibleText: this.ai.currentLanguage() === 'ar'
        ? `ابدأ شرح ${firstUnit.label} من ${fileName}`
        : `Start teaching ${firstUnit.label} from ${fileName}`,
      requestText: this.buildDocumentTeachingRequest(fileName, firstUnit, mode, totalUnits, limited),
      extraSystemInstruction: this.buildDocumentTeachingInstruction(firstUnit, mode, totalUnits, limited),
      useConversationHistory: activeChat.messages.length > 0
    });

    this.updateUploadedFile(fileId, {
      status: limited ? 'limited' : 'ready',
      extractionMessage: limited
        ? this.t('Document text is limited, but guided teaching is active.')
        : this.t('Page-by-page teaching is active.')
    });
    this.scheduleAutoNextForSlide(firstUnit.id);
    this.clearDocumentStatusSoon();
  }

  private buildDocumentTeachingRequest(
    fileName: string,
    unit: TutorTeachingUnit,
    mode: TutorTeachingUnit['kind'],
    totalUnits: number,
    limited: boolean
  ): string {
    const slideBehavior = unit.isMeaningful === false
      ? this.buildLowValueSlideGuidance(unit)
      : '';
    const labels = this.ai.currentLanguage() === 'ar'
      ? {
          doc: 'اسم الملف',
          unit: 'الوحدة الحالية',
          kind: 'نوع الوحدة',
          total: 'إجمالي الوحدات',
          text: 'نص الوحدة',
          instruction: 'ابدأ الشرح من هذه الوحدة فقط، ولا تنتقل للوحدة التالية إلا إذا طلب الطالب المتابعة.'
        }
      : {
          doc: 'Document',
          unit: 'Current unit',
          kind: 'Unit type',
          total: 'Total units',
          text: 'Unit text',
          instruction: 'Teach only this unit first, and do not move to the next unit unless the student asks to continue.'
        };

    return [
      `${labels.doc}: ${fileName}`,
      `${labels.unit}: ${unit.label}`,
      `${labels.kind}: ${mode}`,
      `${labels.total}: ${totalUnits}`,
      unit.category ? `Slide category: ${unit.category}` : '',
      limited ? this.t('Text extraction is limited, so use best-effort teaching from the available text.') : '',
      labels.text,
      unit.text,
      slideBehavior,
      labels.instruction
    ].filter(Boolean).join('\n\n');
  }

  private buildDocumentTeachingInstruction(
    unit: TutorTeachingUnit,
    mode: TutorTeachingUnit['kind'],
    totalUnits: number,
    limited: boolean
  ): string {
    return [
      `You are teaching an uploaded document page by page.`,
      `Current unit: ${unit.label}`,
      `Current unit type: ${mode}`,
      `Current unit category: ${unit.category || 'content'}`,
      `Total document units: ${totalUnits}`,
      `The student can navigate to any slide at any time. Never refuse next, previous, or jump requests.`,
      `Follow this teacher structure: brief overview, clear explanation, important terms, example/application if useful, short takeaway, optional next step.`,
      unit.isMeaningful === false
        ? `This is a low-value, ending, or reference slide. Keep the explanation brief, but still honor the selected slide and do not block navigation.`
        : unit.category === 'image-heavy'
          ? `This slide is image-heavy. Explain the likely concept briefly and acknowledge that the visual content is the main element.`
          : '',
      limited ? `The extraction is partial. Be transparent that some text may be limited.` : `Do not summarize the whole document yet.`,
      `Adapt the explanation to the student's estimated level and selected explanation style.`
    ].join('\n');
  }

  private buildLowValueSlideGuidance(unit: TutorTeachingUnit): string {
    if (unit.category === 'reference') {
      return this.ai.currentLanguage() === 'ar'
        ? 'هذه شريحة مراجع. اذكر بإيجاز أنها شريحة مراجع ثم انتقل لأقرب شريحة تعليمية مفيدة.'
        : 'This is a references slide. Mention it briefly, then transition to the next meaningful teaching slide.';
    }
    if (unit.category === 'ending') {
      return this.ai.currentLanguage() === 'ar'
        ? 'هذه شريحة ختامية مثل شكراً لكم. احتفل بإنهاء الفصل ثم انتقل أو أعلن اكتمال الفصل.'
        : 'This is an ending slide like Thank you. Celebrate the chapter completion, then move on or mark the chapter complete.';
    }
    return this.ai.currentLanguage() === 'ar'
      ? 'هذه شريحة منخفضة القيمة التعليمية. قدّم ملاحظة انتقالية قصيرة فقط.'
      : 'This is a low-value slide. Give only a short transition note.';
  }

  private findNextMeaningfulIndex(
    state: NonNullable<ReturnType<TutorPage['fileTeachingState']>>,
    fromIndex: number
  ): number | null {
    for (let index = fromIndex + 1; index < state.units.length; index += 1) {
      if (state.units[index]?.isMeaningful !== false) {
        return index;
      }
    }
    return null;
  }

  private findPreviousMeaningfulIndex(
    state: NonNullable<ReturnType<TutorPage['fileTeachingState']>>,
    fromIndex: number
  ): number | null {
    for (let index = fromIndex - 1; index >= 0; index -= 1) {
      if (state.units[index]?.isMeaningful !== false) {
        return index;
      }
    }
    return null;
  }

  private resolveMeaningfulTargetIndex(
    state: NonNullable<ReturnType<TutorPage['fileTeachingState']>>,
    index: number
  ): number | null {
    if (state.units[index]?.isMeaningful !== false) {
      return index;
    }
    return this.findNextMeaningfulIndex(state, index - 1);
  }

  private async navigateToSlideIndex(targetIndex: number, intent: 'continue', isPrevious: boolean = false) {
    const activeChat = this.chatService.getActiveChat();
    const state = this.fileTeachingState();
    if (!activeChat || !state?.active) return;
    const targetUnit = state.units[targetIndex];
    if (!targetUnit) return;

    const previous = this.chatService.getTutorState(activeChat.id);
    const syncedUnitsLength = state.units.length;
    const targetSlideNumber = targetUnit.actualSlideNumber || targetUnit.order || targetIndex + 1;
    const progressPercent = Math.round((Math.min(syncedUnitsLength, Math.max(1, targetSlideNumber)) / Math.max(1, syncedUnitsLength)) * 100);
    console.debug('[SmartTutor][PDF] Navigate', {
      documentName: state.documentName,
      currentSlideIndex: targetIndex,
      currentSlideNumber: targetSlideNumber,
      totalSlides: syncedUnitsLength,
      progressPercent,
      activeUnitId: targetUnit.id,
      activeUnitTitle: targetUnit.label,
      cachedUnitsLength: syncedUnitsLength
    });
    console.log({
      totalSlides: syncedUnitsLength,
      currentSlideIndex: targetIndex,
      currentSlideNumber: targetSlideNumber,
      progressPercent,
      activeUnitId: targetUnit.id,
      activeUnitTitle: targetUnit.label,
      unitsLength: syncedUnitsLength
    });
    this.chatService.updateTutorState(activeChat.id, {
      ...(previous || {
        topic: targetUnit.label,
        explainedSubtopics: [],
        currentDepth: 0,
        lastIntent: 'continue',
        mcqHistory: []
      }),
      lastIntent: intent,
      currentSubtopic: targetUnit.label,
      fileTeaching: {
        ...state,
        currentUnitIndex: targetIndex,
        currentUnitLabel: targetUnit.label,
        totalSlides: syncedUnitsLength,
        totalUnitCount: syncedUnitsLength,
        currentSlideNumber: targetSlideNumber,
        coveredUnitIds: Array.from(new Set([...(state.coveredUnitIds || []), state.units[state.currentUnitIndex]?.id].filter(Boolean)))
      }
    });
    this.slideJumpInput.set(`${targetSlideNumber}`);

    if (targetUnit.isMeaningful === false) {
      this.setDocumentStatusState(
        targetUnit.category === 'ending'
          ? this.t('This is an ending slide. The tutor will keep the explanation brief, and you can move anywhere next.')
          : this.t('This slide has limited teaching value, but you still have full control to study it or move on freely.'),
        'info'
      );
    }

    this.triggerSlideTransition();
    await this.submitTutorTurn({
      userVisibleText: isPrevious
        ? `${this.t('Go back to')} ${targetUnit.label}`
        : `${this.t('Open')} ${targetUnit.label}`,
      requestText: this.buildDocumentTeachingRequest(
        state.documentName || targetUnit.sourceName,
        targetUnit,
        state.mode,
        state.totalSlides || state.totalUnitCount || state.units.length,
        state.extractionState === 'limited'
      ),
      extraSystemInstruction: this.buildDocumentTeachingInstruction(
        targetUnit,
        state.mode,
        state.totalSlides || state.totalUnitCount || state.units.length,
        state.extractionState === 'limited'
      ),
      useConversationHistory: true
    });
    this.scheduleAutoNextForSlide(targetUnit.id);

    if (targetIndex >= state.units.length - 1 && this.findNextMeaningfulIndex(state, targetIndex) === null && state.extractionState !== 'reading') {
      this.markChapterCompleted(this.fileTeachingState() || state);
    }
  }

  private buildChapterId(documentName: string, totalSlides: number): string {
    const normalized = `${documentName}::${totalSlides}`.trim().toLowerCase();
    return normalized.replace(/[^a-z0-9\u0600-\u06FF]+/gi, '-');
  }

  private loadCompletedChapters(): ChapterProgressEntry[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(this.chapterProgressStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  private persistCompletedChapters(entries: ChapterProgressEntry[]) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.chapterProgressStorageKey, JSON.stringify(entries));
  }

  private markChapterCompleted(state: NonNullable<ReturnType<TutorPage['fileTeachingState']>>) {
    const chapterId = state.chapterId || this.buildChapterId(state.documentName || 'document', state.totalSlides || state.units.length);
    if (!this.completedChapters().some((entry) => entry.chapterId === chapterId)) {
      const nextEntries = [
        {
          chapterId,
          documentName: state.documentName || this.t('Document'),
          completedAt: new Date().toISOString(),
          totalSlides: state.totalSlides || state.totalUnitCount || state.units.length
        },
        ...this.completedChapters()
      ];
      this.completedChapters.set(nextEntries);
      this.persistCompletedChapters(nextEntries);
    }
    this.setDocumentStatusState(this.t('You completed this chapter. Excellent work!'), 'success');
    const activeChat = this.chatService.activeChatId();
    if (activeChat) {
      const previous = this.chatService.getTutorState(activeChat);
      if (previous?.fileTeaching) {
        this.chatService.updateTutorState(activeChat, {
          ...previous,
          fileTeaching: {
            ...previous.fileTeaching,
            chapterCompleted: true
          }
        });
      }
    }
  }

  private async launchVirtualLabFromConversation(sourceText: string, messageIndex: number) {
    const activeChat = this.chatService.getActiveChat();
    if (!activeChat) {
      return;
    }

    const context = this.resolveConversationContext(activeChat);
    if (!context) {
      return;
    }

    if (this.isLaunchingVirtualLab()) {
      return;
    }

    const config = this.buildVirtualLabConfigFromTutor(activeChat, context, sourceText, messageIndex);
    this.virtualLabLaunchError.set('');
    this.isLaunchingVirtualLab.set(true);

    try {
      this.virtualLabSession.resetSimulationState();
      const category = this.specialtyProfiles.categorizeSpecialty(config.specialty, config.scenario);
      const shouldAutoStart = !!config.specialty.trim() && !!config.scenario.trim();

      if (shouldAutoStart && category === 'medical') {
        const clinicalCase = await this.clinicalCaseApi.generateCase(config, config.language);
        this.virtualLabSession.openSimulationSession({
          ...config,
          scenario: config.scenario.trim() || clinicalCase.requestedTopic || clinicalCase.title,
          clinicalCase,
          generatedCase: null
        });
        this.openVirtualLab.emit();
        return;
      }

      if (shouldAutoStart) {
        this.virtualLabSession.openSimulationSession(config);
        this.openVirtualLab.emit();
        return;
      }

      this.virtualLabSession.prepareTutorTransfer(config);
      this.virtualLabLaunchError.set(this.t('The tutor context was incomplete, so the lab opened with the best available setup instead of launching an empty case.'));
      this.openVirtualLab.emit();
    } catch (error) {
      console.error('Failed to auto-start virtual lab from tutor.', error);
      this.virtualLabSession.prepareTutorTransfer(config);
      this.virtualLabLaunchError.set(
        error instanceof Error && error.message.trim()
          ? `${this.t('Auto-start could not finish right now. The lab setup was prefilled for you instead.')}\n${error.message}`
          : this.t('Auto-start could not finish right now. The lab setup was prefilled for you instead.')
      );
      this.openVirtualLab.emit();
    } finally {
      this.isLaunchingVirtualLab.set(false);
    }
  }

  private summarizeForTransfer(text: string): string {
    return (text || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 220);
  }

  private buildVirtualLabConfigFromTutor(
    activeChat: Conversation,
    context: ConversationContext,
    sourceText: string,
    messageIndex: number
  ): SimulationScenarioConfig {
    const tutorState = this.activeTutorState();
    const topic = tutorState?.topic || context.lesson || context.subject;
    const recentTopic = tutorState?.currentSubtopic || tutorState?.explainedSubtopics.at(-1) || context.lesson || context.subject;
    const recentUserIntent = tutorState?.lastIntent || context.helpType;
    const recentAssistantMessages = activeChat.messages
      .filter((message) => message.role === 'model')
      .slice(-2)
      .map((message) => this.summarizeForTransfer(message.text))
      .filter(Boolean);
    const fileTeachingState = tutorState?.fileTeaching || null;
    const currentUnit = fileTeachingState?.units[fileTeachingState.currentUnitIndex];
    const attachedFileContext = currentUnit
      ? `${currentUnit.label}: ${this.summarizeForTransfer(currentUnit.text)}`
      : this.uploadedFiles().map((file) => file.name).slice(0, 3).join(', ');
    const concepts = (tutorState?.explainedSubtopics || []).slice(-5).join(', ');
    const scenarioParts = [
      topic,
      recentTopic && recentTopic !== topic ? recentTopic : '',
      concepts ? `Concepts: ${concepts}` : '',
      recentAssistantMessages[0] ? `Teaching context: ${recentAssistantMessages.join(' | ')}` : '',
      attachedFileContext ? `File context: ${attachedFileContext}` : '',
      recentUserIntent ? `Student intent: ${recentUserIntent}` : ''
    ].filter(Boolean);

    return {
      specialty: context.specialization,
      scenario: scenarioParts.join(' | ').slice(0, 550),
      difficulty: this.mapTutorDifficultyToLab(),
      durationMinutes: 10 as const,
      language: this.ai.currentLanguage() === 'ar' ? 'ar' : 'en',
      tutorContext: {
        topic,
        recentTopic,
        explanationContext: this.summarizeForTransfer(sourceText || recentAssistantMessages.join(' | ')),
        userIntent: recentUserIntent,
        attachedFileContext,
        selectedSpecialty: context.specialization,
        sourceConversationId: activeChat.id,
        sourceMessageId: String(messageIndex)
      },
      referenceImages: []
    };
  }

  private mapTutorDifficultyToLab(): 'easy' | 'medium' | 'hard' | 'expert' {
    switch (this.explanationLevel()) {
      case 'quick':
        return 'easy';
      case 'university':
        return 'hard';
      case 'school':
      default:
        return 'medium';
    }
  }

  private estimateStudentProfile(requestText: string, previous: TutorSessionState | null): StudentProfileEstimate {
    const normalized = requestText.toLowerCase();
    if (/(simplify|simpler|basic|beginner|ابسط|بسّط|بسيط)/.test(normalized)) {
      return 'beginner';
    }
    if (/(deep|advanced|nuance|mechanism|detailed|تعمق|متقدم|تفصيلي)/.test(normalized)) {
      return 'advanced';
    }
    if (this.explanationLevel() === 'quick') {
      return 'beginner';
    }
    if (this.explanationLevel() === 'university') {
      return 'advanced';
    }
    return previous?.studentProfileEstimate || 'intermediate';
  }

  private detectTutorIntent(requestText: string): TutorIntent {
    const normalized = requestText.toLowerCase();
    if (/(virtual lab|المختبر)/.test(normalized)) return 'lab';
    if (/(quiz me|quick quiz|اختبرني|اسئلة|أسئلة|mcq)/.test(normalized)) return 'quiz';
    if (/(continue|next|تابع|التالي|move on)/.test(normalized)) return 'continue';
    if (/(explain more|more depth|more detail|وسع|عمق|تفصيل)/.test(normalized)) return 'explain_more';
    if (/(simplify|simpler|بسطة|ابسط|أسهل)/.test(normalized)) return 'simplify';
    if (/(deeper|advanced|deep dive|تعمق|متقدم)/.test(normalized)) return 'deepen';
    if (/(example|examples|مثال|أمثلة)/.test(normalized)) return 'examples';
    if (/(summary|summarize|لخص|ملخص)/.test(normalized)) return 'summary';
    if (/(start|begin|new topic|ابدأ|ابدئي|موضوع جديد)/.test(normalized)) return 'new_topic';
    return 'direct_answer';
  }

  private planTutorState(
    activeChat: Conversation,
    requestText: string,
    context: ConversationContext,
    attachedFiles: UploadedTutorFile[]
  ): TutorSessionState {
    const previous = this.chatService.getTutorState(activeChat.id);
    const intent = this.detectTutorIntent(requestText);
    const topic = context.lesson || context.subject;
    const mergedUnits = attachedFiles.flatMap((file) => file.teachingUnits || []);
    const existingUnits = previous?.fileTeaching?.units || [];
    const units = mergedUnits.length > 0 ? mergedUnits : existingUnits;
    const shouldAdvanceUnit = intent === 'continue' && units.length > 0;
    const firstMeaningfulIndex = this.getFirstMeaningfulUnitIndex(units);
    const currentUnitIndex = previous?.fileTeaching?.active
      ? Math.min(
          units.length - 1,
          Math.max(firstMeaningfulIndex, (previous.fileTeaching.currentUnitIndex || 0) + (shouldAdvanceUnit ? 1 : 0))
        )
      : firstMeaningfulIndex;
    const currentUnit = units[currentUnitIndex] || null;
    const studentProfileEstimate = this.estimateStudentProfile(requestText, previous);
    const coveredUnitIds = previous?.fileTeaching?.coveredUnitIds || [];
    const nextCoveredUnitIds = currentUnit && intent === 'continue'
      ? Array.from(new Set([...coveredUnitIds, currentUnit.id]))
      : coveredUnitIds;
    const syncedFileTeaching = this.buildSyncedFileTeachingState(
      previous,
      attachedFiles,
      units,
      nextCoveredUnitIds,
      shouldAdvanceUnit
    );
    const syncedCurrentUnit = syncedFileTeaching?.units[syncedFileTeaching.currentUnitIndex] || currentUnit;

    return {
      topic,
      explainedSubtopics: Array.from(new Set([...(previous?.explainedSubtopics || []), syncedCurrentUnit?.label || context.lesson || context.subject].filter(Boolean))),
      currentDepth: this.nextDepth(previous?.currentDepth ?? 0, intent),
      lastIntent: intent,
      mcqHistory: previous?.mcqHistory || [],
      currentSubtopic: syncedCurrentUnit?.label || previous?.currentSubtopic || context.lesson || context.subject,
      studentStage: this.nextStudentStage(previous?.studentStage, intent),
      studentProfileEstimate,
      nextSuggestedStep: this.suggestNextStep(intent, syncedCurrentUnit?.label || topic),
      recentFocus: Array.from(new Set([...(previous?.recentFocus || []).slice(-3), requestText.slice(0, 120), syncedCurrentUnit?.label || ''].filter(Boolean))).slice(-4),
      lastTutorResponseSummary: previous?.lastTutorResponseSummary || '',
      fileTeaching: syncedFileTeaching
    };
  }

  private nextDepth(currentDepth: number, intent: TutorIntent): number {
    if (intent === 'simplify') return Math.max(0, currentDepth - 1);
    if (intent === 'deepen' || intent === 'explain_more') return Math.min(4, currentDepth + 1);
    if (intent === 'quiz' || intent === 'summary') return 4;
    if (intent === 'continue') return Math.min(3, Math.max(1, currentDepth));
    return currentDepth;
  }

  private nextStudentStage(
    current: TutorSessionState['studentStage'],
    intent: TutorIntent
  ): NonNullable<TutorSessionState['studentStage']> {
    if (intent === 'simplify') return 'foundation';
    if (intent === 'explain_more') return 'guided';
    if (intent === 'examples' || intent === 'continue') return 'applied';
    if (intent === 'deepen') return 'advanced';
    if (intent === 'quiz' || intent === 'summary') return 'review';
    return current || 'guided';
  }

  private suggestNextStep(intent: TutorIntent, label: string): string {
    if (intent === 'quiz') {
      return this.ai.currentLanguage() === 'ar'
        ? `راجع أخطاءك ثم عد إلى ${label}.`
        : `Review your gaps, then return to ${label}.`;
    }
    if (intent === 'continue') {
      return this.ai.currentLanguage() === 'ar'
        ? 'انتقل إلى الجزء التالي مع الحفاظ على نفس التسلسل.'
        : 'Move to the next section while keeping the same sequence.';
    }
    return this.ai.currentLanguage() === 'ar'
      ? `ثبّت ${label} ثم ابنِ عليه تدريجيًا.`
      : `Stabilize ${label} first, then build on it progressively.`;
  }

  private getFirstMeaningfulUnitIndex(units: TutorTeachingUnit[]): number {
    if (units.length === 0) {
      return 0;
    }
    const meaningfulIndex = units.findIndex((unit) => unit.isMeaningful !== false);
    return meaningfulIndex >= 0 ? meaningfulIndex : 0;
  }

  private buildSyncedFileTeachingState(
    previous: TutorSessionState | null,
    attachedFiles: UploadedTutorFile[],
    units: TutorTeachingUnit[],
    nextCoveredUnitIds: string[],
    shouldAdvanceUnit: boolean
  ): TutorSessionState['fileTeaching'] {
    if (units.length === 0) {
      return previous?.fileTeaching || null;
    }

    const activeFile = attachedFiles.find((file) => (file.teachingUnits?.length || 0) > 0);
    const previousFileTeaching = previous?.fileTeaching || null;
    const totalSlides = units.length;
    const firstMeaningfulIndex = this.getFirstMeaningfulUnitIndex(units);
    const sameDocument = !!previousFileTeaching?.documentId && previousFileTeaching.documentId === (activeFile?.id || previousFileTeaching.documentId);
    const requestedIndex = sameDocument
      ? (previousFileTeaching?.currentUnitIndex || 0) + (shouldAdvanceUnit ? 1 : 0)
      : firstMeaningfulIndex;
    const currentUnitIndex = Math.min(totalSlides - 1, Math.max(firstMeaningfulIndex, requestedIndex));
    const currentUnit = units[currentUnitIndex] || units[firstMeaningfulIndex] || units[0];
    const currentSlideNumber = currentUnit?.actualSlideNumber || currentUnit?.order || currentUnitIndex + 1;
    const extractionState: NonNullable<NonNullable<TutorSessionState['fileTeaching']>['extractionState']> = activeFile?.status === 'limited'
      ? 'limited'
      : (activeFile?.currentPreparedUnits || units.length) < totalSlides
        ? 'reading'
        : 'ready';

    const syncedState: NonNullable<TutorSessionState['fileTeaching']> = {
      active: true,
      documentId: activeFile?.id || previousFileTeaching?.documentId,
      documentName: activeFile?.name || previousFileTeaching?.documentName,
      chapterId: previousFileTeaching?.chapterId || this.buildChapterId(activeFile?.name || previousFileTeaching?.documentName || 'document', totalSlides),
      sourceNames: Array.from(new Set(attachedFiles.map((file) => file.name).concat(previousFileTeaching?.sourceNames || []))),
      units,
      meaningfulUnitIds: units.filter((unit) => unit.isMeaningful !== false).map((unit) => unit.id),
      coveredUnitIds: nextCoveredUnitIds,
      currentUnitIndex,
      currentUnitLabel: currentUnit?.label || (this.ai.currentLanguage() === 'ar' ? 'الجزء الحالي' : 'Current section'),
      mode: currentUnit?.kind || activeFile?.teachingMode || previousFileTeaching?.mode || 'chunk',
      totalSlides,
      currentSlideNumber,
      totalUnitCount: totalSlides,
      extractionState,
      nextActionHint: currentUnitIndex + 1 < totalSlides
        ? this.t('Continue to move to the next page.')
        : this.uiLabels().preparingNextPages,
      chapterCompleted: previousFileTeaching?.chapterCompleted || false
    };

    const mismatchDetected =
      previousFileTeaching?.totalSlides !== undefined && previousFileTeaching.totalSlides !== totalSlides
      || previousFileTeaching?.totalUnitCount !== undefined && previousFileTeaching.totalUnitCount !== totalSlides
      || previousFileTeaching?.currentUnitIndex !== undefined && previousFileTeaching.currentUnitIndex >= totalSlides;

    if (mismatchDetected || !sameDocument) {
      console.log({
        totalSlides,
        currentSlideIndex: currentUnitIndex,
        unitsLength: units.length
      });
    }

    return syncedState;
  }

  private finalizeTutorState(
    chatId: string,
    plannedState: TutorSessionState,
    responseText: string
  ) {
    const previous = this.chatService.getTutorState(chatId);
    const syncedFileTeaching = plannedState.fileTeaching
      ? this.buildSyncedFileTeachingState(
          previous,
          [],
          plannedState.fileTeaching.units,
          plannedState.fileTeaching.coveredUnitIds || [],
          false
        )
      : null;
    this.chatService.updateTutorState(chatId, {
      ...plannedState,
      fileTeaching: syncedFileTeaching,
      lastTutorResponseSummary: this.summarizeForTransfer(responseText),
      recentFocus: Array.from(new Set([...(plannedState.recentFocus || []), this.summarizeForTransfer(responseText)])).slice(-4)
    });
  }

  private resolveConversationContext(activeChat: Conversation): ConversationContext | null {
    const contextToUse = activeChat.context || {
      specialization: this.studentContext.specialization === 'Other' ? this.studentContext.customSpecialization : this.studentContext.specialization,
      subject: this.studentContext.subject,
      lesson: this.studentContext.lesson,
      helpType: this.studentContext.helpType
    };

    if (!contextToUse.specialization || !contextToUse.subject || !contextToUse.helpType) {
      return null;
    }

    return contextToUse;
  }

  private buildHistory(messages: Message[]) {
    return messages.map(message => {
      const parts: ({ text: string } | { inlineData: { data: string, mimeType: string } })[] = [{ text: message.text }];
      if (message.files) {
        message.files.forEach(file => parts.push({ inlineData: { data: file.data, mimeType: file.mimeType } }));
      }
      return { role: message.role, parts };
    });
  }

  private getSelectedExplanationInstruction(): string {
    return this.explanationOptions().find(level => level.id === this.explanationLevel())?.instruction
      || 'Teach with balanced educational detail and clear examples.';
  }

  private getSelectedExplanationLabel(): string {
    return this.explanationOptions().find(level => level.id === this.explanationLevel())?.label
      || this.t('School Explanation');
  }

  private buildTutorSystemPrompt(
    contextToUse: ConversationContext,
    tutorState: TutorSessionState | null,
    extraSystemInstruction?: string
  ): string {
    const lang = this.ai.getLanguageName();
    const fileTeaching = tutorState?.fileTeaching;
    const currentUnit = fileTeaching?.units[fileTeaching.currentUnitIndex];
    const progressionSummary = [
      `Current topic: ${tutorState?.topic || contextToUse.subject}`,
      `Current subtopic: ${tutorState?.currentSubtopic || contextToUse.lesson || contextToUse.subject}`,
      `Student stage: ${tutorState?.studentStage || 'guided'}`,
      `Estimated student profile: ${tutorState?.studentProfileEstimate || 'intermediate'}`,
      `Concepts already covered: ${(tutorState?.explainedSubtopics || []).slice(-6).join(', ') || 'None yet'}`,
      `Next suggested step: ${tutorState?.nextSuggestedStep || 'Continue the lesson progressively.'}`,
      `Last detected intent: ${tutorState?.lastIntent || 'direct_answer'}`
    ].join('\n- ');
    const fileTeachingInstruction = fileTeaching?.active && currentUnit
      ? `

FILE TEACHING MODE:
- Active: yes
- Document name: ${fileTeaching.documentName || currentUnit.sourceName}
- Teaching unit type: ${fileTeaching.mode}
- Current unit label: ${currentUnit.label}
- Current unit source: ${currentUnit.sourceName}
- Covered units: ${(fileTeaching.coveredUnitIds || []).join(', ') || 'None yet'}
- Prepared units: ${fileTeaching.units.length}/${fileTeaching.totalUnitCount || fileTeaching.units.length}
- Extraction state: ${fileTeaching.extractionState || 'ready'}
- Current unit content:
${currentUnit.text}
- Stay on this exact unit if the student asks to explain more, simplify, give examples, or quiz them.
- If the student asks to go next, previous, or jump to another slide, switch immediately to that selected unit without refusing.
- Preserve the original specialty and lesson context while teaching from the file.
`
      : `

FILE TEACHING MODE:
- Active: no
`;

    return `YOU ARE A SENIOR EDUCATIONAL AI SYSTEM.

STUDENT CONTEXT:
- Specialization: ${contextToUse.specialization}
- Subject/Course: ${contextToUse.subject}
- Lesson/Chapter: ${contextToUse.lesson || 'Not specified'}
- Help Requested: ${contextToUse.helpType}
- Student Level: ${this.ai.userLevel()} (1-3: Beginner, 4-7: Intermediate, 8+: Advanced)

SELECTED EXPLANATION LEVEL:
- ${this.getSelectedExplanationLabel()}: ${this.getSelectedExplanationInstruction()}

CORE GOAL:
Provide personalized, structured, educational responses that adapt to this specific student.
Act like a real teacher who understands the student, their level, mistakes, and study context.
DO NOT behave like a generic chatbot.

SESSION PROGRESSION STATE:
- ${progressionSummary}

RESPONSE FORMAT:
- Start directly with the explanation content. Do not begin with openers like "Okay", "Let's start", "We will explain now", "حسنًا", "دعنا نبدأ", "لنبدأ", "سنشرح الآن", or similar introductory phrases.
- If the student moved to a new page, slide, or section, begin immediately with that unit's explanation itself.
- By default, structure normal tutoring answers into:
  1. **Direct Answer**
  2. **Clear Explanation**
  3. **Example or Application**
  4. **Key Takeaway**
  5. **Optional Next Step** when useful
- If the task-specific instruction asks for a summary, quiz, mind map, flashcards, understanding analysis, or another custom output, follow that requested format instead of the default four-part layout.
- Keep paragraphs short and readable. Prefer elegant sectioning over dense blocks.
- Use bullets for grouped points, numbered steps for processes, and short headings when they improve clarity.
- Do not ramble or repeat the same explanation unnecessarily.

ADAPTIVE TEACHING LOGIC:
- Apply the selected explanation level by default.
- If the task-specific instruction explicitly asks for simplification, re-explanation, quizzing, summarization, or restructuring, prioritize that task while staying educational.
- If the student uploaded files, read them carefully and base your explanation on their contents.
- If the student seems to struggle, make the explanation clearer and more supportive without becoming generic.
- Track what has already been explained in this session and continue from it instead of restarting randomly.
- Build answers progressively: foundation -> mechanism/concept -> examples -> application -> quick review when appropriate.
- If the student asks "explain more", deepen the same point before moving on.
- If the student asks to simplify, simplify the same point instead of switching topics.
- If the student asks for examples or quiz questions, keep them tightly grounded in the current topic.
- Adapt explicitly to the estimated student profile:
  - beginner: simpler wording, smaller steps, more examples
  - intermediate: balanced detail with examples
  - advanced: precise terminology, mechanisms, nuances
- Sound like a premium academic tutor: warm, confident, concise, and high-signal.
- When possible, start by answering the question directly in the first one or two lines, then expand.

${fileTeachingInstruction}

LIMITS & SAFETY:
- Educational use only.
- For medical or legal topics, clearly state this is for training and education, not real-life execution.

USER EXPERIENCE TONE:
- Professional, encouraging, calm, and teacher-like.

TASK-SPECIFIC INSTRUCTION:
${extraSystemInstruction || 'Answer the student directly using the selected explanation level.'}

CRITICAL: You MUST respond strictly in ${lang}.`;
  }

  private buildDerivedRequest(sourceText: string, prompt: string): string {
    const isAr = this.ai.currentLanguage() === 'ar';
    const referenceLabel = isAr ? 'الشرح المرجعي:' : 'Reference explanation:';
    const taskLabel = isAr ? 'المهمة:' : 'Task:';

    return `${referenceLabel}\n${sourceText}\n\n${taskLabel}\n${prompt}`;
  }

  private async resumePendingTutorLaunch() {
    const pending: PendingTutorLaunch | null = this.chatService.consumePendingTutorLaunch();
    if (!pending) {
      return;
    }

    const chat = this.chatService.createNewChat(pending.title, pending.context);
    this.loadChatContext(chat);
    this.closeTutorSidebar();

    await this.submitTutorTurn({
      userVisibleText: pending.userVisibleText,
      requestText: pending.requestText,
      files: pending.files as UploadedTutorFile[] | undefined,
      useConversationHistory: false
    });
  }

  private async submitTutorTurn(options: {
    userVisibleText: string;
    requestText: string;
    files?: UploadedTutorFile[];
    extraSystemInstruction?: string;
    useConversationHistory?: boolean;
    resetComposer?: boolean;
  }) {
    const requestText = options.requestText.trim();
    if (!requestText) return;

    const limitCheck = this.ai.checkLimit('aiTeacherQuestions');
    if (!limitCheck.allowed) {
      this.upgradeMessage.set(limitCheck.message);
      this.showUpgradeModal.set(true);
      return;
    }

    const activeChat = this.chatService.getActiveChat();
    if (!activeChat) return;

    const contextToUse = this.resolveConversationContext(activeChat);
    if (!contextToUse) {
      alert(this.t('Please select the study context (Specialization, Subject, and Help Type) before proceeding.'));
      return;
    }

    const activeId = this.chatService.activeChatId();
    if (!activeId) return;

    this.stopMic();
    this.openToolMenuIndex.set(null);

    if (options.resetComposer) {
      this.chatInput.nativeElement.value = '';
      this.adjustHeight();
      if (!this.fileTeachingState()?.active) {
        this.uploadedFiles.set([]);
      }
    }

    const attachedFiles = options.files ?? [];
    const plannedTutorState = this.planTutorState(activeChat, requestText, contextToUse, attachedFiles);
    const messageTimestamp = Date.now();
    const userMessage: Message = attachedFiles.length > 0
      ? { role: 'user', text: options.userVisibleText, files: attachedFiles, createdAt: messageTimestamp }
      : { role: 'user', text: options.userVisibleText, createdAt: messageTimestamp };

    const newMessages: Message[] = [...activeChat.messages, userMessage];
    this.chatService.updateChatMessages(activeId, newMessages);
    this.isThinking.set(true);

    try {
      const history = options.useConversationHistory === false ? [] : this.buildHistory(activeChat.messages);
      const systemPrompt = this.buildTutorSystemPrompt(contextToUse, plannedTutorState, options.extraSystemInstruction);
      const rawResponseText = await this.ai.chat(
        requestText,
        systemPrompt,
        history,
        'gpt-4o-mini',
        attachedFiles,
        { featureHint: 'tutor', knowledgeMode: 'off', maxTokens: 2400 }
      );
      const responseText = this.normalizeTutorResponse(rawResponseText);
      const responseTimestamp = Date.now();
      this.chatService.updateChatMessages(activeId, [
        ...newMessages,
        { role: 'model', text: responseText, createdAt: responseTimestamp }
      ]);
      this.finalizeTutorState(activeId, plannedTutorState, responseText);
      this.scrollToBottom();

      this.ai.incrementUsage('aiTeacherQuestions');
      this.ai.awardXPForAction('aiTutorChat', 10, {
        fingerprint: `tutor:${activeId}:${Math.floor(responseTimestamp / 1000)}`
      });
    } catch {
      const errorMsg = this.t('Sorry, connection error.');
      this.chatService.updateChatMessages(activeId, [...newMessages, { role: 'model', text: errorMsg, createdAt: Date.now() }]);
    } finally {
      this.isThinking.set(false);
    }
  }
}

