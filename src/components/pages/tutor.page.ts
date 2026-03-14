
import { Component, signal, inject, ViewChild, ElementRef, computed, effect, output, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AIService, ImprovementPlan } from '../../services/ai.service';
import { ChatService, Message, Conversation, ConversationContext, PendingTutorLaunch } from '../../services/chat.service';
import { FlashcardsService } from '../../services/flashcards.service';
import { MindMapService } from '../../services/mindmap.service';
import { LocalizationService } from '../../services/localization.service';
import { DiagramModal } from '../shared/diagram-modal.component';
import { UpgradeModal } from '../shared/upgrade-modal.component';

type ExplanationLevelKey = 'quick' | 'school' | 'university';
type TutorMessageToolId = 'summary' | 'quiz' | 'mindMap' | 'flashcards' | 'understandingAnalysis';
type TutorUnderstandingActionId = 'no' | 'somewhat' | 'yes';

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

@Component({
  selector: 'app-tutor-page',
  standalone: true,
  imports: [CommonModule, FormsModule, DiagramModal, UpgradeModal],
  template: `
    <div class="fixed inset-0 flex bg-slate-950 overflow-hidden animate-in fade-in duration-500 z-50">
      
      <!-- Mobile Sidebar Backdrop -->
      @if (mobileSidebarOpen()) {
        <div (click)="mobileSidebarOpen.set(false)" class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] lg:hidden animate-in fade-in duration-300"></div>
      }

      <!-- 1. LEFT SIDEBAR: CONVERSATION HISTORY & CONTEXT -->
      <aside [class.translate-x-0]="mobileSidebarOpen()" 
             [class.translate-x-full]="!mobileSidebarOpen() && isRtl()"
             [class.-translate-x-full]="!mobileSidebarOpen() && !isRtl()"
             class="fixed lg:relative inset-y-0 right-0 lg:right-auto w-80 lg:w-96 border-e border-white/5 bg-slate-900/50 backdrop-blur-3xl flex flex-col shrink-0 overflow-hidden z-[70] lg:z-auto transition-transform duration-500 lg:translate-x-0 lg:flex">
        
        <!-- Header with Back Button -->
        <div class="p-6 border-b border-white/5 flex items-center justify-between gap-4">
          <div class="flex items-center gap-4">
            <button (click)="back.emit()" class="w-10 h-10 rounded-xl bg-white/5 hover:bg-indigo-600 transition-all flex items-center justify-center text-white">
              <i class="fa-solid fa-arrow-right" [class.fa-arrow-left]="!isRtl()"></i>
            </button>
            <h2 class="font-black text-white text-lg">{{ uiLabels().tutorTitle }}</h2>
          </div>
          <button (click)="mobileSidebarOpen.set(false)" class="lg:hidden w-10 h-10 rounded-xl glass hover:bg-white/10 transition flex items-center justify-center text-white">
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
                 <p class="font-black text-white uppercase tracking-widest">{{ t('Model: SmartEdge AI Engine') }}</p>
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
              <button (click)="mobileSidebarOpen.set(true)" class="lg:hidden w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center">
                <i class="fa-solid fa-bars-staggered"></i>
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
              <button (click)="back.emit()" class="sm:hidden w-8 h-8 rounded-lg bg-white/5 hover:bg-indigo-600 transition-all flex items-center justify-center text-white">
                <i class="fa-solid fa-arrow-right" [class.fa-arrow-left]="!isRtl()"></i>
              </button>
           </div>
        </header>

        <!-- Message Thread -->
        <div class="flex-1 overflow-y-auto p-3 md:p-8 lg:p-12 space-y-4 md:space-y-8 no-scrollbar" #msgContainer>
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
                         [class.bg-slate-900]="m.role === 'model'"
                         [class.text-white]="m.role === 'user'"
                         [class.border-white/5]="m.role === 'model'"
                         class="p-3 md:p-8 rounded-2xl md:rounded-[2.5rem] border shadow-sm text-sm md:text-lg leading-relaxed whitespace-pre-wrap break-words selection:bg-indigo-400 selection:text-white"
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
                      
                      {{ m.text }}
                    </div>

                    @if (m.role === 'model' && m.text.trim()) {
                      <div class="mt-2 space-y-3 animate-in fade-in duration-500 delay-200">
                        <div class="flex flex-wrap items-center gap-2">
                          <div class="relative" (click)="$event.stopPropagation()">
                            <button
                              (click)="toggleMessageTools($index, $event)"
                              [disabled]="isThinking()"
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
                                    class="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-right text-sm font-bold text-slate-200 transition hover:bg-white/5 hover:text-white"
                                  >
                                    <i [class]="tool.iconClass"></i>
                                    <span>{{ tool.label }}</span>
                                  </button>
                                }
                              </div>
                            }
                          </div>
                        </div>

                        <div class="rounded-[1.6rem] border border-white/10 bg-slate-900/60 p-4 shadow-lg shadow-black/10 backdrop-blur-sm">
                          <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                              <p class="text-sm font-black text-white">{{ uiLabels().understoodPrompt }}</p>
                              <p class="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">{{ uiLabels().understoodHint }}</p>
                            </div>

                            <div class="flex flex-wrap gap-2">
                              @for (action of understandingActions(); track action.id) {
                                <button
                                  (click)="sendUnderstandingFeedback(action, m.text)"
                                  [disabled]="isThinking()"
                                  [ngClass]="action.buttonClass"
                                  class="px-3 py-2 rounded-xl border text-xs font-black transition-all disabled:opacity-50"
                                >
                                  {{ action.label }}
                                </button>
                              }
                            </div>
                          </div>
                        </div>
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
                        (input)="adjustHeight()"
                        (keyup.enter)="!$event.shiftKey && send(); $event.preventDefault()" 
                        [placeholder]="uiLabels().placeholder"
                        class="flex-1 bg-transparent text-white p-2 text-xs sm:text-base font-medium outline-none border-none resize-none max-h-32 no-scrollbar placeholder:opacity-30 text-right leading-relaxed disabled:opacity-20"></textarea>
              
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
              Shift + Enter for new line • SmartEdge Intelligence 2.5
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
  `]
})
export class TutorPage {
  public ai = inject(AIService);
  public chatService = inject(ChatService);
  private flashcardsService = inject(FlashcardsService);
  private mindMapService = inject(MindMapService);
  private localization = inject(LocalizationService);
  @ViewChild('chatInput') chatInput!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('msgContainer') msgContainer!: ElementRef<HTMLDivElement>;
  
  back = output<void>();
  openFlashcards = output<void>();
  openMindMap = output<void>();
  mobileSidebarOpen = signal(false);
  isThinking = signal(false);
  isRecording = signal(false);
  showDiagramModal = signal(false);
  explanationLevel = signal<ExplanationLevelKey>('school');
  openToolMenuIndex = signal<number | null>(null);
  isRtl = computed(() => this.localization.direction() === 'rtl');
  readonly t = (text: string) => this.localization.phrase(text);
  private recognition: unknown = null;

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

  uploadedFiles = signal<{ data: string, mimeType: string, name: string }[]>([]);

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
      actionSimplify: this.t('Explain in a simpler way'),
      actionTest: this.t('Test me on this lesson'),
      actionSummarize: this.t('Summarize this topic')
    };
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
  }

  startNewChat() {
    this.chatService.createNewChat(this.t('New Chat'));
    setTimeout(() => this.chatInput.nativeElement.focus(), 100);
  }

  openConversation(chat: Conversation) {
    this.chatService.activeChatId.set(chat.id);
    this.mobileSidebarOpen.set(false);

    this.loadChatContext(chat);
  }

  clearAllChats() {
    if (confirm(this.t('Are you sure you want to clear all conversations?'))) {
      this.chatService.clearAllConversations();
    }
  }

  isContextValid(): boolean {
    const spec = this.studentContext.specialization === 'Other' ? this.studentContext.customSpecialization : this.studentContext.specialization;
    return !!(spec && this.studentContext.subject && this.studentContext.helpType);
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

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        const result = e.target?.result as string;
        const base64Data = result.split(',')[1];
        this.uploadedFiles.update(list => [...list, {
          data: base64Data,
          mimeType: file.type || 'application/octet-stream',
          name: file.name
        }]);
      };
      reader.readAsDataURL(file);
    }
    
    // Reset input
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

  onDiagramSaved(base64: string) {
    this.uploadedFiles.update(list => [...list, {
      data: base64,
      mimeType: 'image/png',
      name: `diagram_${Date.now()}.png`
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

    const currentFiles = [...this.uploadedFiles()];
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
    this.openToolMenuIndex.set(null);
  }

  @HostListener('document:keydown.escape')
  handleEscape() {
    this.openToolMenuIndex.set(null);
  }

  ngOnDestroy() {
    this.stopMic();
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

  private buildTutorSystemPrompt(contextToUse: ConversationContext, extraSystemInstruction?: string): string {
    const lang = this.ai.getLanguageName();

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

RESPONSE FORMAT:
- By default, use Markdown and structure normal tutoring answers into:
  1. **Core Concept**
  2. **Step-by-step explanation**
  3. **Practical example**
  4. **Quick check**
- If the task-specific instruction asks for a summary, quiz, mind map, flashcards, understanding analysis, or another custom output, follow that requested format instead of the default four-part layout.

ADAPTIVE TEACHING LOGIC:
- Apply the selected explanation level by default.
- If the task-specific instruction explicitly asks for simplification, re-explanation, quizzing, summarization, or restructuring, prioritize that task while staying educational.
- If the student uploaded files, read them carefully and base your explanation on their contents.
- If the student seems to struggle, make the explanation clearer and more supportive without becoming generic.

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
    this.mobileSidebarOpen.set(false);

    await this.submitTutorTurn({
      userVisibleText: pending.userVisibleText,
      requestText: pending.requestText,
      useConversationHistory: false
    });
  }

  private async submitTutorTurn(options: {
    userVisibleText: string;
    requestText: string;
    files?: { data: string, mimeType: string, name: string }[];
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
      this.uploadedFiles.set([]);
    }

    const attachedFiles = options.files ?? [];
    const messageTimestamp = Date.now();
    const userMessage: Message = attachedFiles.length > 0
      ? { role: 'user', text: options.userVisibleText, files: attachedFiles, createdAt: messageTimestamp }
      : { role: 'user', text: options.userVisibleText, createdAt: messageTimestamp };

    const newMessages: Message[] = [...activeChat.messages, userMessage];
    this.chatService.updateChatMessages(activeId, newMessages);
    this.isThinking.set(true);

    try {
      const history = options.useConversationHistory === false ? [] : this.buildHistory(activeChat.messages);
      const systemPrompt = this.buildTutorSystemPrompt(contextToUse, options.extraSystemInstruction);
      const responseText = await this.ai.chat(
        requestText,
        systemPrompt,
        history,
        'gpt-4o-mini',
        attachedFiles,
        { featureHint: 'tutor', knowledgeMode: 'off', maxTokens: 2400 }
      );
      const responseTimestamp = Date.now();
      this.chatService.updateChatMessages(activeId, [
        ...newMessages,
        { role: 'model', text: responseText, createdAt: responseTimestamp }
      ]);
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

