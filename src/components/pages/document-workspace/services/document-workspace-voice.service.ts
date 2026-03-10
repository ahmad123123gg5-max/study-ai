import { Injectable, signal } from '@angular/core';
import { VoicePlaybackState } from '../document-workspace.types';

@Injectable({ providedIn: 'root' })
export class DocumentWorkspaceVoiceService {
  readonly state = signal<VoicePlaybackState>({
    status: 'idle',
    itemId: null
  });

  async playVoiceExplanation(itemId: string, text: string): Promise<boolean> {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this.state.set({
        status: 'error',
        itemId,
        errorMessage: 'Voice playback is not supported in this browser.'
      });
      return false;
    }

    window.speechSynthesis.cancel();
    this.state.set({
      status: 'loading',
      itemId
    });

    await new Promise((resolve) => setTimeout(resolve, 150));

    return new Promise<boolean>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1;
      utterance.lang = /[\u0600-\u06FF]/.test(text) ? 'ar-SA' : 'en-US';

      utterance.onstart = () => {
        this.state.set({
          status: 'playing',
          itemId
        });
        resolve(true);
      };

      utterance.onend = () => {
        this.state.set({
          status: 'idle',
          itemId: null
        });
      };

      utterance.onerror = () => {
        this.state.set({
          status: 'error',
          itemId,
          errorMessage: 'Voice playback could not start.'
        });
        resolve(false);
      };

      window.speechSynthesis.speak(utterance);
    });
  }

  stop() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.state.set({
      status: 'idle',
      itemId: null
    });
  }
}
