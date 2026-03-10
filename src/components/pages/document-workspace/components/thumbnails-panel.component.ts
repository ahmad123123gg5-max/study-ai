import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DocumentPageData, LoadedDocumentResource } from '../document-workspace.types';
import { DocumentPageCanvasComponent } from './document-page-canvas.component';
import { EmptyStateComponent } from './empty-state.component';

@Component({
  selector: 'app-thumbnails-panel',
  standalone: true,
  imports: [CommonModule, DocumentPageCanvasComponent, EmptyStateComponent],
  template: `
    <aside class="flex h-full flex-col rounded-[2rem] border border-slate-200 bg-white shadow-[0_32px_90px_-40px_rgba(15,23,42,0.28)]">
      <header class="border-b border-slate-200 px-4 py-4">
        <p class="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Page Navigator</p>
        <h3 class="mt-1 text-lg font-semibold text-slate-900">Thumbnails</h3>
      </header>

      <div class="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        @for (page of pages(); track page.pageNumber) {
          <button
            (click)="jumpToPage.emit(page.pageNumber)"
            class="w-full rounded-[1.5rem] border p-3 text-left transition"
            [class.border-slate-900]="currentPage() === page.pageNumber"
            [class.bg-slate-50]="currentPage() === page.pageNumber"
            [class.border-slate-200]="currentPage() !== page.pageNumber"
          >
            <div class="overflow-hidden rounded-[1.2rem] border border-slate-200 bg-white">
              <app-document-page-canvas
                [pdfDocument]="pdfDocument()"
                [page]="page"
                [scale]="0.22"
                [shouldRender]="Math.abs(currentPage() - page.pageNumber) <= 5"
              />
            </div>
            <div class="mt-3 flex items-start justify-between gap-3">
              <div>
                <p class="text-sm font-semibold text-slate-900">Page {{ page.pageNumber }}</p>
                <p class="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{{ page.summary }}</p>
              </div>
            </div>
          </button>
        } @empty {
          <app-document-empty-state
            icon="fa-regular fa-images"
            eyebrow="Navigation"
            title="No thumbnails yet"
            description="Open a document and the workspace will generate page previews here."
          />
        }
      </div>
    </aside>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ThumbnailsPanelComponent {
  pages = input<DocumentPageData[]>([]);
  pdfDocument = input<LoadedDocumentResource['pdfDocument'] | null>(null);
  currentPage = input(1);

  jumpToPage = output<number>();
}
