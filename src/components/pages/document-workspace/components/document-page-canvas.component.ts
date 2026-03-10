import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  effect,
  signal,
  input,
  viewChild,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DocumentPageData, LoadedDocumentResource } from '../document-workspace.types';

@Component({
  selector: 'app-document-page-canvas',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="relative">
      <canvas
        #canvas
        class="block rounded-[1.6rem]"
        [style.width.px]="page()?.width ? page()!.width * scale() : 0"
        [style.height.px]="page()?.height ? page()!.height * scale() : 0"
      ></canvas>

      @if (renderError()) {
        <div class="absolute inset-0 flex flex-col items-center justify-center rounded-[1.6rem] border border-amber-200 bg-amber-50/95 px-6 text-center text-sm text-amber-800">
          <i class="fa-solid fa-file-circle-exclamation text-xl"></i>
          <p class="mt-3 font-semibold">Page preview unavailable</p>
          <p class="mt-2 max-w-xs text-xs leading-5">{{ renderError() }}</p>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocumentPageCanvasComponent {
  pdfDocument = input<LoadedDocumentResource['pdfDocument'] | null>(null);
  page = input<DocumentPageData | null>(null);
  scale = input(1);
  shouldRender = input(true);

  private readonly destroyRef = inject(DestroyRef);
  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private renderRequest = 0;
  private renderTask: { cancel: () => void } | null = null;
  protected readonly renderError = signal<string | null>(null);

  constructor() {
    effect(() => {
      const canvas = this.canvasRef()?.nativeElement;
      const document = this.pdfDocument();
      const page = this.page();
      const scale = this.scale();
      const shouldRender = this.shouldRender();

      if (!canvas || !document || !page?.viewport) {
        return;
      }

      const viewport = page.viewport.clone({ scale });
      const outputScale =
        typeof window === 'undefined' ? 1 : Math.max(1, window.devicePixelRatio || 1);
      canvas.width = Math.ceil(viewport.width * outputScale);
      canvas.height = Math.ceil(viewport.height * outputScale);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      this.renderError.set(null);
      this.renderTask?.cancel();
      this.renderTask = null;

      if (!shouldRender) {
        const context = canvas.getContext('2d');
        context?.setTransform(1, 0, 0, 1, 0, 0);
        context?.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      const currentRequest = ++this.renderRequest;
      queueMicrotask(async () => {
        const currentCanvas = this.canvasRef()?.nativeElement;
        if (!currentCanvas || currentRequest !== this.renderRequest) {
          return;
        }
        try {
          const pdfPage = await document.getPage(page.pageNumber);
          if (currentRequest !== this.renderRequest) {
            return;
          }
          const context = currentCanvas.getContext('2d');
          if (!context) {
            return;
          }
          context.setTransform(1, 0, 0, 1, 0, 0);
          context.imageSmoothingEnabled = true;
          context.clearRect(0, 0, currentCanvas.width, currentCanvas.height);
          const task = pdfPage.render({
            canvas: currentCanvas,
            canvasContext: context,
            viewport,
            transform:
              outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0]
          });
          this.renderTask = task;
          await task.promise;
          if (this.renderTask === task) {
            this.renderTask = null;
          }
        } catch (error) {
          if ((error as { name?: string } | null)?.name === 'RenderingCancelledException') {
            return;
          }
          console.warn('Page render interrupted', error);
          this.renderError.set('This page could not be rendered right now. Try scrolling away and back, or reopen the document.');
        }
      });
    });

    this.destroyRef.onDestroy(() => {
      this.renderRequest += 1;
      this.renderTask?.cancel();
      this.renderTask = null;
    });
  }
}
