import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StudyNote } from '../document-workspace.types';
import { EmptyStateComponent } from './empty-state.component';

@Component({
  selector: 'app-notes-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, EmptyStateComponent],
  template: `
    <section class="flex h-full flex-col rounded-[2rem] border border-slate-200 bg-white shadow-[0_32px_90px_-40px_rgba(15,23,42,0.35)]">
      <header class="space-y-4 border-b border-slate-200 px-5 py-4">
        <div>
          <p class="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Document Notes</p>
          <h3 class="mt-1 text-lg font-semibold text-slate-900">Anchored and general notes</h3>
        </div>
        <div class="grid gap-2 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-3">
          <input
            [(ngModel)]="draftTitle"
            placeholder="General note title"
            class="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-slate-900"
          />
          <textarea
            [(ngModel)]="draftContent"
            rows="3"
            placeholder="Capture a takeaway, correction, or reminder."
            class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-900"
          ></textarea>
          <button
            (click)="submitGeneralNote()"
            [disabled]="!draftTitle.trim() && !draftContent.trim()"
            class="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add document note
          </button>
        </div>
      </header>

      <div class="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-5">
        @for (note of notes(); track note.id) {
          <article class="rounded-[1.65rem] border border-slate-200 bg-slate-50 p-4">
            <div class="mb-3 flex items-start justify-between gap-3">
              <div>
                <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                  {{ note.type === 'anchored' ? 'Anchored note' : 'General note' }}
                </p>
                @if (note.pageNumber) {
                  <p class="mt-1 text-xs text-slate-500">Page {{ note.pageNumber }}</p>
                }
              </div>
              <div class="flex gap-2">
                @if (note.pageNumber) {
                  <button
                    (click)="jumpToNote.emit(note)"
                    class="rounded-full bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-900 hover:text-white"
                  >
                    Jump
                  </button>
                }
                <button
                  (click)="deleteNote.emit(note.id)"
                  class="rounded-full bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600 transition hover:bg-rose-100"
                >
                  Delete
                </button>
              </div>
            </div>
            <input
              [ngModel]="note.title"
              (ngModelChange)="updateNoteField(note, 'title', $event)"
              class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-900"
            />
            <textarea
              [ngModel]="note.content"
              (ngModelChange)="updateNoteField(note, 'content', $event)"
              rows="4"
              class="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 outline-none transition focus:border-slate-900"
            ></textarea>
            @if (note.anchorText) {
              <p class="mt-3 rounded-2xl bg-white px-3 py-2 text-xs text-slate-500">
                "{{ note.anchorText }}"
              </p>
            }
          </article>
        } @empty {
          <app-document-empty-state
            icon="fa-solid fa-note-sticky"
            eyebrow="Study memory layer"
            title="No notes yet"
            description="Add document-wide notes here, or attach a note directly to selected text from the document."
          />
        }
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotesPanelComponent {
  notes = input<StudyNote[]>([]);

  addGeneralNote = output<{ title: string; content: string }>();
  updateNote = output<StudyNote>();
  deleteNote = output<string>();
  jumpToNote = output<StudyNote>();

  protected draftTitle = '';
  protected draftContent = '';

  protected submitGeneralNote() {
    this.addGeneralNote.emit({
      title: this.draftTitle.trim() || 'Untitled note',
      content: this.draftContent.trim()
    });
    this.draftTitle = '';
    this.draftContent = '';
  }

  protected updateNoteField(note: StudyNote, field: 'title' | 'content', value: string) {
    this.updateNote.emit({
      ...note,
      [field]: value,
      updatedAt: new Date().toISOString()
    });
  }
}
