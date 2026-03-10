import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  effect,
  inject,
  input,
  output,
  viewChild,
  viewChildren
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AnnotationItem,
  AnnotationTool,
  LoadedDocumentResource,
  SelectedTextContext,
  TranslationPageEntry,
  TranslationViewMode,
  ViewerSelectionRect
} from '../document-workspace.types';
import { EmptyStateComponent } from './empty-state.component';
import { DocumentPageCanvasComponent } from './document-page-canvas.component';
import { DocumentTextLayerComponent } from './document-text-layer.component';
import { AnnotationLayerComponent } from './annotation-layer.component';

@Component({
  selector: 'app-document-viewer',
  standalone: true,
  imports: [
    CommonModule,
    EmptyStateComponent,
    DocumentPageCanvasComponent,
    DocumentTextLayerComponent,
    AnnotationLayerComponent
  ],
  template: `
    @if (!resource()) {
      <app-document-empty-state
        icon="fa-solid fa-file-arrow-up"
        eyebrow="Study documents"
        title="No file open"
        description="Open a PDF or use the workspace demo document to start a study session."
      />
    } @else {
      <div
        #scrollContainer
        class="overflow-visible rounded-[1.6rem] border border-white/10 bg-[radial-gradient(circle_at_top,#1e293b,#0f172a_45%,#020617_100%)] p-3 md:p-4"
        role="main"
        aria-label="Document viewer"
        (mouseup)="captureSelectionSoon()"
        (keyup)="captureSelectionSoon()"
      >
        <div class="mx-auto max-w-[1480px] space-y-4 md:space-y-5">
          @for (page of resource()!.pages; track page.pageNumber) {
            <div
              #pageShell
              class="flex justify-center"
              [attr.data-page-number]="page.pageNumber"
              [attr.aria-label]="'Page ' + page.pageNumber"
              data-page-shell="true"
            >
              <div
                class="relative rounded-[2rem] border border-slate-200 bg-white shadow-[0_40px_120px_-54px_rgba(15,23,42,0.4)]"
                [style.width.px]="page.width * effectiveScale()"
                [style.height.px]="page.height * effectiveScale()"
              >
                <app-document-page-canvas
                  [pdfDocument]="resource()?.pdfDocument || null"
                  [page]="page"
                  [scale]="effectiveScale()"
                  [shouldRender]="shouldRenderPage(page.pageNumber)"
                />

                @if (selectableTextAvailable()) {
                  <app-document-text-layer
                    [page]="page"
                    [scale]="effectiveScale()"
                    [visible]="shouldRenderPage(page.pageNumber)"
                    [translationViewMode]="translationViewMode()"
                    [translationEntry]="pageTranslation(page.pageNumber)"
                  />
                }

                <app-annotation-layer
                  [annotations]="annotations()"
                  [pageNumber]="page.pageNumber"
                  [pageWidth]="page.width"
                  [pageHeight]="page.height"
                  [scale]="effectiveScale()"
                  [activeTool]="activeTool()"
                  [enabled]="annotationModeEnabled()"
                  [selectedAnnotationId]="selectedAnnotationId()"
                  (annotationCreated)="annotationCreated.emit($event)"
                  (annotationSelected)="annotationSelected.emit($event)"
                  (annotationUpdated)="annotationUpdated.emit($event)"
                  (annotationDeleted)="annotationDeleted.emit($event)"
                />

                @if (selectableTextAvailable() && !page.blocks.length) {
                  <div class="pointer-events-none absolute bottom-4 right-4 rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-800 shadow-sm">
                    No text layer on this page
                  </div>
                }
              </div>
            </div>
          }
        </div>

        @if (!selectableTextAvailable()) {
          <div class="pointer-events-none sticky bottom-5 mt-6">
            <div class="mx-auto max-w-xl rounded-[1.6rem] border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-800 shadow-sm">
              No selectable text was detected in this document. The viewer still supports notes, audio recording, and future OCR or converted text integration.
            </div>
          </div>
        }
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocumentViewerComponent {
  resource = input<LoadedDocumentResource | null>(null);
  currentPage = input(1);
  zoom = input(1);
  translationViewMode = input<TranslationViewMode>('original');
  selectableTextAvailable = input(true);
  annotationModeEnabled = input(false);
  annotations = input<AnnotationItem[]>([]);
  activeTool = input<AnnotationTool>('select');
  selectedAnnotationId = input<string | null>(null);
  pageTranslations = input<Record<number, TranslationPageEntry>>({});
  scrollRequest = input<{ pageNumber: number; id: number; anchorY?: number } | null>(null);

  currentPageChange = output<number>();
  selectionChange = output<SelectedTextContext | null>();
  annotationCreated = output<AnnotationItem>();
  annotationSelected = output<string | null>();
  annotationUpdated = output<AnnotationItem>();
  annotationDeleted = output<string>();

  private readonly destroyRef = inject(DestroyRef);
  private readonly scrollContainerRef = viewChild<ElementRef<HTMLElement>>('scrollContainer');
  private readonly pageShellRefs = viewChildren<ElementRef<HTMLElement>>('pageShell');
  private observer: IntersectionObserver | null = null;
  private selectionClearFrame: number | null = null;

  constructor() {
    effect(() => {
      this.resource();
      queueMicrotask(() => this.observePages());
    });

    effect(() => {
      const request = this.scrollRequest();
      if (!request) {
        return;
      }
      queueMicrotask(() => this.scrollToPage(request.pageNumber, request.anchorY));
    });

    this.destroyRef.onDestroy(() => {
      this.observer?.disconnect();
      if (this.selectionClearFrame !== null) {
        cancelAnimationFrame(this.selectionClearFrame);
      }
    });
  }

  protected effectiveScale(): number {
    return this.zoom() || 1;
  }

  protected shouldRenderPage(pageNumber: number): boolean {
    return Math.abs(this.currentPage() - pageNumber) <= 1;
  }

  protected pageTranslation(pageNumber: number): TranslationPageEntry | null {
    return this.pageTranslations()[pageNumber] || null;
  }

  protected captureSelectionSoon() {
    queueMicrotask(() => this.captureSelection());
  }

  @HostListener('window:scroll')
  protected onWindowScroll() {
    if (this.selectionClearFrame !== null) {
      return;
    }

    this.selectionClearFrame = requestAnimationFrame(() => {
      this.selectionClearFrame = null;
      this.selectionChange.emit(null);
    });
  }

  private observePages() {
    this.observer?.disconnect();

    this.observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = [...entries]
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];

        if (!visibleEntry) {
          return;
        }

        const pageNumber = Number((visibleEntry.target as HTMLElement).dataset['pageNumber']);
        if (Number.isFinite(pageNumber)) {
          this.currentPageChange.emit(pageNumber);
        }
      },
      {
        root: null,
        threshold: [0.25, 0.55, 0.8]
      }
    );

    this.pageShellRefs().forEach((ref) => this.observer?.observe(ref.nativeElement));
  }

  private scrollToPage(pageNumber: number, anchorY?: number) {
    const target = this.pageShellRefs().find(
      (ref) => Number(ref.nativeElement.dataset['pageNumber']) === pageNumber
    )?.nativeElement;

    if (!target) {
      return;
    }

    const top =
      target.getBoundingClientRect().top +
      window.scrollY +
      ((anchorY || 0) * this.effectiveScale()) -
      112;
    window.scrollTo({
      top: Math.max(0, top),
      behavior: 'smooth'
    });
  }

  private captureSelection() {
    const currentResource = this.resource();
    const container = this.scrollContainerRef()?.nativeElement;
    const selection = window.getSelection();

    if (!currentResource || !container || !selection || selection.rangeCount === 0 || selection.isCollapsed) {
      this.selectionChange.emit(null);
      return;
    }

    const text = selection.toString().trim();
    if (!text) {
      this.selectionChange.emit(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const ancestor =
      range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? (range.commonAncestorContainer as Element)
        : range.commonAncestorContainer.parentElement;

    const pageShell = ancestor?.closest('[data-page-shell="true"]') as HTMLElement | null;
    if (!pageShell || !container.contains(pageShell)) {
      this.selectionChange.emit(null);
      return;
    }

    const pageNumber = Number(pageShell.dataset['pageNumber']);
    const pageData = currentResource.pages.find((page) => page.pageNumber === pageNumber);
    if (!pageData) {
      this.selectionChange.emit(null);
      return;
    }

    const pageRect = pageShell.getBoundingClientRect();
    const selectionRect = range.getBoundingClientRect();
    const scale = this.effectiveScale();
    const fragments = Array.from(range.getClientRects())
      .filter((rect) => rect.width > 0 && rect.height > 0)
      .map((rect) => ({
        x: (rect.left - pageRect.left) / scale,
        y: (rect.top - pageRect.top) / scale,
        width: rect.width / scale,
        height: rect.height / scale
      }));

    if (fragments.length === 0) {
      this.selectionChange.emit(null);
      return;
    }

    const intersectingBlocks = pageData.blocks.filter((block) =>
      fragments.some((fragment) =>
        this.intersects(fragment, {
          x: block.x,
          y: block.y,
          width: block.width,
          height: block.height
        })
      )
    );
    const blockIds = intersectingBlocks.map((block) => block.id);
    const anchorBlockIndex = blockIds.length
      ? pageData.blocks.findIndex((block) => block.id === blockIds[0])
      : -1;
    const surroundingBlocks =
      anchorBlockIndex >= 0
        ? pageData.blocks.slice(
            Math.max(0, anchorBlockIndex - 1),
            Math.min(pageData.blocks.length, anchorBlockIndex + Math.max(2, blockIds.length + 1))
          )
        : [];
    const contextBefore = anchorBlockIndex > 0 ? pageData.blocks[anchorBlockIndex - 1].text : '';
    const contextAfter =
      anchorBlockIndex >= 0 && anchorBlockIndex + blockIds.length < pageData.blocks.length
        ? pageData.blocks[Math.min(pageData.blocks.length - 1, anchorBlockIndex + blockIds.length)].text
        : '';

    this.selectionChange.emit({
      id: crypto.randomUUID(),
      selectionKey: `${pageNumber}:${text}:${blockIds.join('|') || 'free'}`,
      pageNumber,
      text,
      pageText: pageData.text,
      summary: pageData.summary,
      surroundingText: surroundingBlocks.map((block) => block.text).join(' '),
      contextBefore,
      contextAfter,
      rect: {
        x: selectionRect.left + selectionRect.width / 2,
        y: selectionRect.top,
        width: selectionRect.width,
        height: selectionRect.height
      },
      fragments,
      blockIds,
      anchorBlockId: blockIds[0],
      createdAt: new Date().toISOString()
    });
  }

  private intersects(left: ViewerSelectionRect, right: ViewerSelectionRect) {
    return !(
      left.x + left.width < right.x ||
      right.x + right.width < left.x ||
      left.y + left.height < right.y ||
      right.y + right.height < left.y
    );
  }
}
