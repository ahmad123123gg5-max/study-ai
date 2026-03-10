import { Injectable, inject } from '@angular/core';
import { AIService } from '../../../../services/ai.service';
import { AIResponseItem, SelectedTextContext } from '../document-workspace.types';

@Injectable({ providedIn: 'root' })
export class DocumentWorkspaceAIService {
  private readonly ai = inject(AIService);

  async explainSelectedText(selection: SelectedTextContext): Promise<AIResponseItem> {
    const prompt = [
      `Selected text: ${selection.text}`,
      `Page context summary: ${selection.summary}`,
      `Surrounding context: ${selection.surroundingText}`,
      'Explain only the selected text in a student-friendly way.',
      'If the topic is scientific or medical, include one realistic applied example.',
      'Do not explain the full page.'
    ].join('\n');

    const response = await this.runWithFallback(
      prompt,
      'You are a premium study assistant. Keep the answer focused, concise, and useful for a student.',
      () => this.mockExplain(selection)
    );

    return this.createItem('explain', selection, 'Focused explanation', prompt, response);
  }

  async askAboutSelection(selection: SelectedTextContext, question: string): Promise<string> {
    const prompt = [
      `Selected text: ${selection.text}`,
      `Page context summary: ${selection.summary}`,
      `Surrounding context: ${selection.surroundingText}`,
      `Student question: ${question}`,
      'Answer only in relation to the selected text and its immediate meaning.'
    ].join('\n');

    return this.runWithFallback(
      prompt,
      'You are a contextual study assistant. Answer clearly, precisely, and only about the selected excerpt.',
      () => this.mockQuestionAnswer(selection, question)
    );
  }

  async simplifySelectedText(selection: SelectedTextContext): Promise<AIResponseItem> {
    const prompt = [
      `Selected text: ${selection.text}`,
      `Surrounding context: ${selection.surroundingText}`,
      'Rewrite this in simpler language for a student.',
      'Keep the meaning accurate and focused.'
    ].join('\n');

    const response = await this.runWithFallback(
      prompt,
      'You simplify difficult educational text without changing the meaning.',
      () => this.mockSimplify(selection.text)
    );

    return this.createItem('simplify', selection, 'Simplified wording', prompt, response);
  }

  async askGeneralWorkspaceQuestion(
    question: string,
    context: {
      fileName?: string;
      currentPage?: number;
      pageSummary?: string;
      pageText?: string;
    } = {}
  ): Promise<string> {
    const prompt = [
      context.fileName ? `Document: ${context.fileName}` : '',
      context.currentPage ? `Current page: ${context.currentPage}` : '',
      context.pageSummary ? `Current page summary: ${context.pageSummary}` : '',
      context.pageText ? `Current page text sample: ${context.pageText.slice(0, 1800)}` : '',
      `Student question: ${question}`,
      'Answer like a study copilot inside a document workspace.',
      'If the question is broad, answer clearly and give the next practical step.'
    ].filter(Boolean).join('\n');

    return this.runWithFallback(
      prompt,
      'You are a premium study copilot inside a document workspace. Answer clearly, directly, and in a student-friendly way.',
      () => this.mockGeneralQuestionAnswer(question, context)
    );
  }

  private createItem(
    kind: AIResponseItem['kind'],
    selection: SelectedTextContext,
    title: string,
    prompt: string,
    response: string
  ): AIResponseItem {
    return {
      id: crypto.randomUUID(),
      kind,
      title,
      prompt,
      response,
      pageNumber: selection.pageNumber,
      selectionText: selection.text,
      source: 'selected-text',
      createdAt: new Date().toISOString(),
      voiceSupported: kind === 'explain'
    };
  }

  private async runWithFallback(
    message: string,
    systemInstruction: string,
    fallback: () => string
  ): Promise<string> {
    await this.ensureLatency();
    try {
      const response = await this.ai.chat(message, systemInstruction);
      if (response?.trim()) {
        return response.trim();
      }
    } catch (error) {
      console.warn('Document workspace AI fallback activated', error);
    }

    return fallback();
  }

  private mockExplain(selection: SelectedTextContext): string {
    const domain = this.detectDomain(selection.text, selection.pageText);
    const selected = this.compact(selection.text);
    const summary = selection.summary || 'the local passage around your selection';
    const surrounding = selection.surroundingText ? `Nearby text shows ${selection.surroundingText.toLowerCase()}.` : '';
    const practicalExample =
      domain === 'medical'
        ? 'Clinical example: a patient can look stable on pulse oximetry but still have poor tissue oxygen use, so symptoms and lab markers matter.'
        : domain === 'scientific'
          ? 'Applied example: in a lab or exam question, this concept usually appears when you must connect a mechanism to a measurable outcome.'
          : 'Study example: link the sentence to a short real scenario or memory cue so the concept becomes easier to recall.';

    return [
      `This excerpt is mainly saying that ${selected}.`,
      `In the page context, it connects to ${summary.toLowerCase()}.`,
      surrounding,
      practicalExample,
      'What to remember: focus on the mechanism, then ask what would happen in a real student or clinical scenario if that mechanism changed.'
    ].filter(Boolean).join('\n\n');
  }

  private mockQuestionAnswer(selection: SelectedTextContext, question: string): string {
    const selected = this.compact(selection.text);
    const questionStem = question.trim().replace(/\?+$/, '');
    return [
      `Regarding "${selected}", the key answer is: ${this.answerStem(questionStem)}.`,
      'Use the page context to decide whether the passage is describing cause, effect, compensation, or practical application.',
      'If you want a stronger exam answer, compare this selected idea with one nearby concept on the same page and state how they differ.'
    ].join('\n\n');
  }

  private mockSimplify(text: string): string {
    return `In simpler language: ${this.compact(text)}. The main idea is that you should translate the sentence into one clear cause-and-effect statement.`;
  }

  private mockGeneralQuestionAnswer(
    question: string,
    context: {
      fileName?: string;
      currentPage?: number;
      pageSummary?: string;
      pageText?: string;
    }
  ): string {
    const scopedContext = [
      context.fileName ? `You are currently working in "${context.fileName}".` : '',
      context.currentPage ? `The active page is page ${context.currentPage}.` : '',
      context.pageSummary ? `This page is mainly about ${context.pageSummary.toLowerCase()}.` : ''
    ].filter(Boolean).join(' ');

    return [
      scopedContext || 'You are inside the current study document.',
      `Answer: ${this.answerStem(question.trim())}.`,
      context.pageText
        ? `Use the visible text to connect the answer back to this part of the document: "${this.compact(context.pageText).slice(0, 220)}".`
        : 'If you need a more precise answer, ask about a sentence or paragraph from the document.',
      'Next step: ask for a summary, explanation, quiz, or translation if you want to continue from this point.'
    ].join('\n\n');
  }

  private detectDomain(selection: string, pageText: string): 'medical' | 'scientific' | 'general' {
    const corpus = `${selection} ${pageText}`.toLowerCase();
    if (/(patient|clinical|disease|blood|renal|metabolic|acid|oxygen|lactate|therapy|diagnosis)/.test(corpus)) {
      return 'medical';
    }
    if (/(cell|immune|experiment|molecule|physics|chemical|scientific|respiration)/.test(corpus)) {
      return 'scientific';
    }
    return 'general';
  }

  private compact(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }

  private answerStem(question: string): string {
    if (!question) {
      return 'the selected text should be interpreted within its immediate mechanism and example';
    }
    return `the selected text matters because ${question.charAt(0).toLowerCase()}${question.slice(1)} is answered by the mechanism described in the excerpt`;
  }

  private async ensureLatency() {
    await new Promise((resolve) => setTimeout(resolve, 420));
  }
}
