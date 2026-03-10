import { Injectable } from '@angular/core';
import {
  RecordingCaptureMode,
  RecordingPermissionState,
  RecordingSessionState
} from '../document-workspace.types';

@Injectable({ providedIn: 'root' })
export class DocumentWorkspaceRecordingService {
  private mediaRecorder: MediaRecorder | null = null;
  private mediaStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private audioChunks: Blob[] = [];
  private timerId: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<(state: RecordingSessionState) => void>();
  private state: RecordingSessionState = this.createBaseState();

  hydrate(nextState: RecordingSessionState) {
    const recoveredStatus =
      nextState.status === 'recording' || nextState.status === 'paused' ? 'stopped' : nextState.status;

    this.state = {
      ...nextState,
      status: recoveredStatus,
      blobUrl: undefined,
      restoredFromInterruptedSession:
        nextState.status === 'recording' || nextState.status === 'paused'
          ? true
          : nextState.restoredFromInterruptedSession,
      updatedAt: new Date().toISOString()
    };
    this.emit();
  }

  subscribe(listener: (state: RecordingSessionState) => void) {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  async start(captureMode: RecordingCaptureMode = 'microphone') {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      this.handlePermissionFailure('unsupported', 'Recording is not supported in this browser.');
      throw new Error('Recording is not supported in this browser.');
    }

    this.resetLiveRecordingArtifacts();

    try {
      if (captureMode === 'screen') {
        if (!navigator.mediaDevices.getDisplayMedia) {
          this.handlePermissionFailure('unsupported', 'Screen recording is not supported in this browser.');
          throw new Error('Screen recording is not supported in this browser.');
        }
        this.screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
      }

      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaStream =
        captureMode === 'screen' && this.screenStream
          ? new MediaStream([
              ...this.screenStream.getVideoTracks(),
              ...this.screenStream.getAudioTracks(),
              ...micStream.getAudioTracks()
            ])
          : micStream;
    } catch (error) {
      const permission = this.resolvePermissionError(error);
      const message =
        permission === 'denied'
          ? captureMode === 'screen'
            ? 'Screen or microphone permission was denied.'
            : 'Microphone permission was denied.'
          : captureMode === 'screen'
            ? 'Screen capture and microphone access are required for workspace recording.'
            : 'A microphone is required to record the lecture session.';
      this.handlePermissionFailure(permission, message);
      throw error;
    }

    this.mediaRecorder = new MediaRecorder(this.mediaStream);
    this.audioChunks = [];

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
        this.updateState({
          chunks: this.audioChunks.length
        });
      }
    };

    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.audioChunks, { type: this.mediaRecorder?.mimeType || 'audio/webm' });
      const blobUrl = URL.createObjectURL(blob);
      this.stopTimer();
      this.updateState({
        status: 'stopped',
        stoppedAt: new Date().toISOString(),
        mimeType: blob.type,
        blobUrl,
        fileName: `lecture-recording-${new Date().getTime()}.webm`
      });
      this.disposeStream();
    };

    this.mediaRecorder.start(1000);
    this.stopTimer();
    this.updateState({
      sessionId: crypto.randomUUID(),
      captureMode,
      status: 'recording',
      permission: 'granted',
      startedAt: new Date().toISOString(),
      stoppedAt: undefined,
      pausedAt: undefined,
      elapsedMs: 0,
      chunks: 0,
      mimeType: this.mediaRecorder.mimeType,
      blobUrl: undefined,
      fileName: undefined,
      lastError: undefined,
      restoredFromInterruptedSession: false
    });
    this.startTimer();
  }

  pause() {
    if (this.mediaRecorder?.state === 'recording') {
      this.mediaRecorder.pause();
      this.stopTimer();
      this.updateState({
        status: 'paused',
        pausedAt: new Date().toISOString()
      });
    }
  }

  resume() {
    if (this.mediaRecorder?.state === 'paused') {
      this.mediaRecorder.resume();
      this.updateState({
        status: 'recording',
        pausedAt: undefined
      });
      this.startTimer();
    }
  }

  stop() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      return;
    }

    this.stopTimer();
    this.disposeStream();
    this.updateState({
      status: 'stopped',
      stoppedAt: new Date().toISOString()
    });
  }

  dispose() {
    this.stopTimer();
    this.disposeStream();
  }

  private startTimer() {
    this.stopTimer();
    this.timerId = setInterval(() => {
      this.updateState({ elapsedMs: this.state.elapsedMs + 1000 });
    }, 1000);
  }

  private stopTimer() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  private updateState(patch: Partial<RecordingSessionState>) {
    this.state = {
      ...this.state,
      ...patch,
      updatedAt: new Date().toISOString()
    };
    this.emit();
  }

  private emit() {
    this.listeners.forEach((listener) => listener(this.state));
  }

  private disposeStream() {
    this.mediaStream?.getTracks().forEach((track) => track.stop());
    this.screenStream?.getTracks().forEach((track) => track.stop());
    this.mediaStream = null;
    this.screenStream = null;
    this.mediaRecorder = null;
  }

  private handlePermissionFailure(permission: RecordingPermissionState, message: string) {
    this.stopTimer();
    this.disposeStream();
    this.updateState({
      status: 'idle',
      permission,
      lastError: message
    });
  }

  private resolvePermissionError(error: unknown): RecordingPermissionState {
    if (error && typeof error === 'object' && 'name' in error) {
      const name = String((error as { name?: string }).name || '');
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        return 'denied';
      }
    }
    return 'unknown';
  }

  private resetLiveRecordingArtifacts() {
    if (this.state.blobUrl) {
      URL.revokeObjectURL(this.state.blobUrl);
    }
    this.audioChunks = [];
  }

  private createBaseState(): RecordingSessionState {
    return {
      sessionId: crypto.randomUUID(),
      captureMode: 'microphone',
      status: 'idle',
      permission: 'unknown',
      elapsedMs: 0,
      chunks: 0,
      updatedAt: new Date().toISOString()
    };
  }
}
