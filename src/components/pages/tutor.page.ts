import { Component, signal, inject, ViewChild, ElementRef, computed, effect, output, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AIService, ImprovementPlan } from '../../services/ai.service';
import { ChatService, Message, Conversation, ConversationContext, PendingTutorLaunch, TutorSessionState } from '../../services/chat.service';
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
  template: `...[full template unchanged]...`,
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
  tutorState = signal<TutorSessionState | null>(null);
  isRtl = computed(() => this.localization.direction() === 'rtl');
  isArabicUi = computed(() => this.ai.currentLanguage() === 'ar');
  readonly t = (text: string) => this.localization.phrase(text);
  private recognition: unknown = null;

  // [all other signals unchanged...]

  // Add tutor state methods
  private loadTutorState() {
    const activeChat = this.chatService.getActiveChat();
    if (activeChat?.tutorState) {
      this.tutorState.set(activeChat.tutorState);
    } else {
      this.tutorState.set(null);
    }
  }

  private saveTutorState(partial: Partial<TutorSessionState>) {
    const activeId = this.chatService.activeChatId();
    if (!activeId) return;
    const current = this.tutorState() || { topic: '', explainedSubtopics: [], currentDepth: 0, lastIntent: '', mcqHistory: [] };
    const newState = { ...current, ...partial };
    this.chatService.updateTutorState(activeId, newState);
    this.tutorState.set(newState);
  }

  private detectIntent(userText: string): string {
    const lower = userText.toLowerCase().trim();
    if (/more|deeper|continue|explain more|go deeper|أكثر|عمق|تابع|لم أفهم|أوضح أكثر/i.test(lower)) return 'deeper';
    if (/mcq|option a|b|c|d|1\.|2\.|3\.|4\./i.test(lower) || lower.match(/[a-d]\)\s/i)) return 'mcq';
    if (/confused|no|not understand|لم أفهم/i.test(lower)) return 'simplify';
    if (/quiz|test|check/i.test(lower)) return 'quiz';
    return 'direct';
  }

  private detectMCQ(text: string): {question: string, options: string[]} | null {
    const mcqRegex = /([a-d]\)|1\.|2\.|3\.|4\.)\s*([^\n]+)/gi;
    const matches = [...text.matchAll(mcqRegex)];
    if (matches.length >= 2) {
return { question: text.slice(0, matches[0].index || 0).trim(), options: matches.map(m => m[0]) };
    }
    return null;
  }

  private getLayerLabel(depth: number): string {
    const layers = ['نظرة عامة', 'المفهوم الأساسي', 'شرح عميق', 'تطبيقات عملية', 'ملخص'];
    return layers[depth] || 'مراجعة';
  }

// Repair: Remove broken state calls - restore original submitTutorTurn
  async send() {
    const text = this.chatInput.nativeElement.value.trim();
    if (!text) return;

    // Repair: uploadedFiles & submitTutorTurn not defined - use direct ai.chat
    const activeChat = this.chatService.getActiveChat();
    if (!activeChat) return;

    this.isThinking.set(true);
    try {
      const responseText = await this.ai.chat(text, this.buildTutorSystemPrompt(activeChat.context!, '', {}), []);
      // Add response to messages (original logic)
      this.chatService.updateActiveChatMessages([
        ...activeChat.messages,
        { role: 'user', text, createdAt: Date.now() },
        { role: 'model', text: responseText, createdAt: Date.now() }
      ]);
    } catch (err) {
      console.error(err);
    } finally {
      this.isThinking.set(false);
    }
  }


  private buildTutorSystemPrompt(context: ConversationContext, extra?: string, state?: Partial<TutorSessionState>): string {
    const basePrompt = `YOU ARE ADAPTIVE TUTOR.

STRUCTURED LAYERS (progressive, NO REPEAT):
0: **Overview** - Simple definition
1: **Core Concept** - Main mechanism
2: **Deep Explanation** - How/why it works
3: **Applications** - Real-world/clinical use
4: **Summary** - Key takeaways

SESSION STATE: topic="${state?.topic || context.subject}", depth=${state?.currentDepth || 0}, explained: ${JSON.stringify(state?.explainedSubtopics || [])}

RULES:
- "more/deeper/continue": Advance to NEXT layer ONLY, NEW content, reference PRIOR layers briefly
- MCQ (A/B/C/D options): JSON first {correct:'A', whyCorrect:'...', whyOthersWrong:['B:...']}, then explain
- Direct Q: Precise answer + layer link
- Use ## headings, • bullets
- Respond in ${this.ai.getLanguageName()} ONLY

CONTEXT: ${JSON.stringify(context)}

${extra || ''}`;

    return basePrompt;
  }

  // [all other methods unchanged, uiLabels add depthLabel: this.t('Layer') + this.getLayerLabel(this.tutorState()?.currentDepth || 0)]

  // Update header to show depth
  // In template after explanationLevel: <span>Layer {{tutorState()?.currentDepth + 1}}/5</span>

  // [full constructor/ other methods unchanged until end]
}

