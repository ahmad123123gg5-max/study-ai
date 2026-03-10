import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  output,
  signal,
  viewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AnnotationItem,
  AnnotationPoint,
  AnnotationTool,
  ViewerSelectionRect
} from '../document-workspace.types';

@Component({
  selector: 'app-annotation-layer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div
      #host
      class="absolute inset-0"
      [style.pointer-events]="enabled() ? 'auto' : 'none'"
      (pointerdown)="onPointerDown($event)"
      (pointermove)="onPointerMove($event)"
      (pointerup)="onPointerUp($event)"
      (pointerleave)="onPointerUp($event)"
    >
      @for (annotation of textAnnotations(); track annotation.id) {
        @if (annotation.type === 'highlight') {
          @for (fragment of annotation.fragments || []; track fragment.x + '-' + fragment.y + '-' + fragment.width) {
            <div
              class="absolute rounded-sm"
              [style.left.px]="fragment.x * scale()"
              [style.top.px]="fragment.y * scale()"
              [style.width.px]="fragment.width * scale()"
              [style.height.px]="fragment.height * scale()"
              [style.background]="annotation.color"
              [style.opacity]="selectedAnnotationId() === annotation.id ? '0.34' : '0.22'"
              (click)="onAnnotationClick($event, annotation.id)"
            ></div>
          }
        }

        @if (annotation.type === 'underline') {
          @for (fragment of annotation.fragments || []; track fragment.x + '-' + fragment.y + '-' + fragment.width) {
            <div
              class="absolute"
              [style.left.px]="fragment.x * scale()"
              [style.top.px]="(fragment.y + fragment.height - 2) * scale()"
              [style.width.px]="fragment.width * scale()"
              [style.height.px]="2 * scale()"
              [style.background]="annotation.color"
              (click)="onAnnotationClick($event, annotation.id)"
            ></div>
          }
        }
      }

      <svg
        class="absolute inset-0 h-full w-full"
        [attr.viewBox]="'0 0 ' + pageWidth() + ' ' + pageHeight()"
        preserveAspectRatio="none"
      >
        @for (annotation of shapeAnnotations(); track annotation.id) {
          @switch (annotation.type) {
            @case ('rectangle') {
              <rect
                [attr.x]="annotation.bounds?.x || 0"
                [attr.y]="annotation.bounds?.y || 0"
                [attr.width]="annotation.bounds?.width || 0"
                [attr.height]="annotation.bounds?.height || 0"
                fill="transparent"
                [attr.stroke]="annotation.color"
                [attr.stroke-width]="selectedAnnotationId() === annotation.id ? 3 : 2"
                rx="12"
                (click)="onAnnotationClick($event, annotation.id)"
              />
            }
            @case ('circle') {
              <ellipse
                [attr.cx]="ellipseCenterX(annotation.bounds)"
                [attr.cy]="ellipseCenterY(annotation.bounds)"
                [attr.rx]="ellipseRadiusX(annotation.bounds)"
                [attr.ry]="ellipseRadiusY(annotation.bounds)"
                fill="transparent"
                [attr.stroke]="annotation.color"
                [attr.stroke-width]="selectedAnnotationId() === annotation.id ? 3 : 2"
                (click)="onAnnotationClick($event, annotation.id)"
              />
            }
            @case ('arrow') {
              <g (click)="onAnnotationClick($event, annotation.id)">
                <line
                  [attr.x1]="arrowStartX(annotation)"
                  [attr.y1]="arrowStartY(annotation)"
                  [attr.x2]="arrowEndX(annotation)"
                  [attr.y2]="arrowEndY(annotation)"
                  [attr.stroke]="annotation.color"
                  [attr.stroke-width]="selectedAnnotationId() === annotation.id ? 3 : 2"
                  stroke-linecap="round"
                />
                <polygon [attr.points]="arrowHeadPoints(annotation)" [attr.fill]="annotation.color"></polygon>
              </g>
            }
            @case ('free-draw') {
              <polyline
                [attr.points]="polylinePoints(annotation.points || [])"
                fill="none"
                [attr.stroke]="annotation.color"
                [attr.stroke-width]="selectedAnnotationId() === annotation.id ? 3 : 2"
                stroke-linecap="round"
                stroke-linejoin="round"
                (click)="onAnnotationClick($event, annotation.id)"
              />
            }
          }
        }

        @if (draftShape()) {
          @switch (draftShape()!.type) {
            @case ('rectangle') {
              <rect
                [attr.x]="draftShape()!.bounds?.x || 0"
                [attr.y]="draftShape()!.bounds?.y || 0"
                [attr.width]="draftShape()!.bounds?.width || 0"
                [attr.height]="draftShape()!.bounds?.height || 0"
                fill="transparent"
                stroke="#0f172a"
                stroke-width="2"
                stroke-dasharray="6 6"
                rx="12"
              />
            }
            @case ('circle') {
              <ellipse
                [attr.cx]="ellipseCenterX(draftShape()!.bounds)"
                [attr.cy]="ellipseCenterY(draftShape()!.bounds)"
                [attr.rx]="ellipseRadiusX(draftShape()!.bounds)"
                [attr.ry]="ellipseRadiusY(draftShape()!.bounds)"
                fill="transparent"
                stroke="#0f172a"
                stroke-width="2"
                stroke-dasharray="6 6"
              />
            }
            @case ('arrow') {
              <g>
                <line
                  [attr.x1]="arrowStartX(draftShape()!)"
                  [attr.y1]="arrowStartY(draftShape()!)"
                  [attr.x2]="arrowEndX(draftShape()!)"
                  [attr.y2]="arrowEndY(draftShape()!)"
                  stroke="#0f172a"
                  stroke-width="2"
                  stroke-dasharray="6 6"
                  stroke-linecap="round"
                />
                <polygon [attr.points]="arrowHeadPoints(draftShape()!)" fill="#0f172a"></polygon>
              </g>
            }
            @case ('free-draw') {
              <polyline
                [attr.points]="polylinePoints(draftShape()!.points || [])"
                fill="none"
                stroke="#0f172a"
                stroke-width="2"
                stroke-dasharray="6 6"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            }
          }
        }
      </svg>

      @for (annotation of noteAnnotations(); track annotation.id) {
        <div
          class="absolute z-[8]"
          [style.left.px]="noteMarkerLeft(annotation)"
          [style.top.px]="noteMarkerTop(annotation)"
        >
          <button
            type="button"
            class="flex h-9 w-9 items-center justify-center rounded-full border text-base shadow-[0_14px_28px_-18px_rgba(15,23,42,0.5)] transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15"
            [class.border-amber-300]="annotation.type === 'sticky-note'"
            [class.bg-amber-100]="annotation.type === 'sticky-note'"
            [class.border-sky-300]="annotation.type === 'text-note'"
            [class.bg-sky-50]="annotation.type === 'text-note'"
            [class.ring-2]="selectedAnnotationId() === annotation.id || annotation.noteOpen"
            [class.ring-slate-900]="selectedAnnotationId() === annotation.id || annotation.noteOpen"
            [attr.aria-label]="annotation.type === 'sticky-note' ? 'Open sticky note' : 'Open text note'"
            (pointerdown)="$event.stopPropagation()"
            (click)="toggleNote($event, annotation)"
          >
            {{ annotation.noteIcon || noteIconFor(annotation) }}
          </button>

          @if (annotation.noteOpen) {
            <div
              class="absolute top-0 z-[12] w-[230px] rounded-[1.25rem] border bg-white p-3 shadow-[0_28px_60px_-30px_rgba(15,23,42,0.35)]"
              [class.border-amber-200]="annotation.type === 'sticky-note'"
              [class.border-sky-200]="annotation.type === 'text-note'"
              [style.left.px]="noteCardLeft(annotation)"
              (pointerdown)="$event.stopPropagation()"
              (click)="$event.stopPropagation()"
            >
              <div class="mb-2 flex items-center justify-between gap-2">
                <div>
                  <p class="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                    {{ annotation.type === 'sticky-note' ? 'Pinned note' : 'Text note' }}
                  </p>
                  <p class="mt-1 text-xs text-slate-500">Page {{ annotation.pageNumber }}</p>
                </div>
                <div class="flex items-center gap-1">
                  <button
                    type="button"
                    class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-900 hover:text-white"
                    aria-label="Close note"
                    (click)="closeNote($event, annotation)"
                  >
                    <i class="fa-solid fa-xmark"></i>
                  </button>
                  <button
                    type="button"
                    class="flex h-8 w-8 items-center justify-center rounded-full bg-rose-50 text-rose-600 transition hover:bg-rose-100"
                    aria-label="Delete note"
                    (click)="deleteNote($event, annotation.id)"
                  >
                    <i class="fa-solid fa-trash"></i>
                  </button>
                </div>
              </div>

              <textarea
                rows="5"
                [ngModel]="annotation.text || ''"
                (ngModelChange)="updateNoteText(annotation, $event)"
                placeholder="Write your note here"
                class="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-700 outline-none transition focus:border-slate-900"
              ></textarea>
            </div>
          }
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnnotationLayerComponent {
  annotations = input<AnnotationItem[]>([]);
  pageNumber = input(1);
  pageWidth = input(0);
  pageHeight = input(0);
  scale = input(1);
  activeTool = input<AnnotationTool>('select');
  enabled = input(false);
  selectedAnnotationId = input<string | null>(null);

  annotationCreated = output<AnnotationItem>();
  annotationSelected = output<string | null>();
  annotationUpdated = output<AnnotationItem>();
  annotationDeleted = output<string>();

  private readonly hostRef = viewChild<ElementRef<HTMLElement>>('host');
  private startPoint = signal<AnnotationPoint | null>(null);
  protected readonly draftShape = signal<AnnotationItem | null>(null);
  private eraserDragActive = false;
  private readonly erasedDuringDrag = new Set<string>();

  protected readonly pageAnnotations = computed(() =>
    this.annotations().filter((item) => item.pageNumber === this.pageNumber())
  );
  protected readonly textAnnotations = computed(() =>
    this.pageAnnotations().filter((item) => item.type === 'highlight' || item.type === 'underline')
  );
  protected readonly shapeAnnotations = computed(() =>
    this.pageAnnotations().filter((item) =>
      item.type === 'rectangle' || item.type === 'circle' || item.type === 'arrow' || item.type === 'free-draw')
  );
  protected readonly noteAnnotations = computed(() =>
    this.pageAnnotations().filter((item) =>
      item.type === 'text-note' || item.type === 'sticky-note')
  );

  protected onPointerDown(event: PointerEvent) {
    if (!this.enabled()) {
      return;
    }
    this.capturePointer(event);

    const tool = this.activeTool();
    if (tool === 'highlight' || tool === 'underline') {
      return;
    }

    const point = this.toPoint(event);
    if (tool === 'eraser') {
      event.preventDefault();
      this.eraserDragActive = true;
      this.erasedDuringDrag.clear();
      this.eraseAtPoint(point);
      return;
    }

    if (tool === 'text-note' || tool === 'sticky-note') {
      const annotation = this.createAnnotation(tool, {
        x: point.x,
        y: point.y,
        width: 36,
        height: 36
      });
      this.annotationCreated.emit(annotation);
      return;
    }

    this.startPoint.set(point);

    if (tool === 'free-draw') {
      this.draftShape.set({
        ...this.createAnnotation('free-draw'),
        points: [point]
      });
    } else if (tool === 'arrow') {
      this.draftShape.set({
        ...this.createAnnotation('arrow', this.toBounds(point, point)),
        startPoint: point,
        endPoint: point
      });
    } else if (tool !== 'select') {
      this.draftShape.set({
        ...this.createAnnotation(tool as Exclude<AnnotationTool, 'select' | 'eraser' | 'highlight' | 'underline' | 'text-note' | 'sticky-note'>),
        bounds: {
          x: point.x,
          y: point.y,
          width: 0,
          height: 0
        }
      });
    }
  }

  protected onPointerMove(event: PointerEvent) {
    if (!this.enabled()) {
      return;
    }

    const current = this.toPoint(event);
    if (this.activeTool() === 'eraser' && this.eraserDragActive) {
      event.preventDefault();
      this.eraseAtPoint(current);
      return;
    }

    if (!this.startPoint() || !this.draftShape()) {
      return;
    }

    const start = this.startPoint()!;

    if (this.draftShape()!.type === 'free-draw') {
      this.draftShape.update((draft) =>
        draft
          ? {
              ...draft,
              points: [...(draft.points || []), current]
            }
          : draft
      );
      return;
    }

    if (this.draftShape()!.type === 'arrow') {
      this.draftShape.update((draft) =>
        draft
          ? {
              ...draft,
              startPoint: start,
              endPoint: current,
              bounds: this.toBounds(start, current)
            }
          : draft
      );
      return;
    }

    this.draftShape.update((draft) =>
      draft
        ? {
            ...draft,
            bounds: this.toBounds(start, current)
          }
        : draft
    );
  }

  protected onPointerUp(event: PointerEvent) {
    if (!this.enabled()) {
      return;
    }
    this.releasePointer(event);

    const tool = this.activeTool();
    if (tool === 'eraser') {
      this.eraserDragActive = false;
      this.erasedDuringDrag.clear();
      this.startPoint.set(null);
      this.draftShape.set(null);
      event.preventDefault();
      return;
    }

    const draft = this.draftShape();
    if (draft) {
      if (
        (draft.type === 'free-draw' && (draft.points?.length || 0) > 1) ||
        (draft.type === 'arrow' && this.arrowLength(draft) > 6) ||
        (draft.bounds && Math.abs(draft.bounds.width) + Math.abs(draft.bounds.height) > 6)
      ) {
        this.annotationCreated.emit({
          ...draft,
          updatedAt: new Date().toISOString()
        });
      }
    } else if (tool === 'select') {
      this.annotationSelected.emit(null);
    }

    this.startPoint.set(null);
    this.draftShape.set(null);
  }

  protected onAnnotationClick(event: Event, annotationId: string) {
    event.stopPropagation();
    if (this.activeTool() === 'eraser') {
      return;
    }
    this.annotationSelected.emit(annotationId);
  }

  protected polylinePoints(points: AnnotationPoint[]) {
    return points.map((point) => `${point.x},${point.y}`).join(' ');
  }

  protected arrowStartX(annotation: AnnotationItem): number {
    return this.resolveArrowStart(annotation).x;
  }

  protected arrowStartY(annotation: AnnotationItem): number {
    return this.resolveArrowStart(annotation).y;
  }

  protected arrowEndX(annotation: AnnotationItem): number {
    return this.resolveArrowEnd(annotation).x;
  }

  protected arrowEndY(annotation: AnnotationItem): number {
    return this.resolveArrowEnd(annotation).y;
  }

  protected arrowHeadPoints(annotation: AnnotationItem): string {
    return this.buildArrowHead(this.resolveArrowStart(annotation), this.resolveArrowEnd(annotation));
  }

  protected ellipseCenterX(bounds?: ViewerSelectionRect) {
    return (bounds?.x || 0) + (bounds?.width || 0) / 2;
  }

  protected ellipseCenterY(bounds?: ViewerSelectionRect) {
    return (bounds?.y || 0) + (bounds?.height || 0) / 2;
  }

  protected ellipseRadiusX(bounds?: ViewerSelectionRect) {
    return Math.abs(bounds?.width || 0) / 2;
  }

  protected ellipseRadiusY(bounds?: ViewerSelectionRect) {
    return Math.abs(bounds?.height || 0) / 2;
  }

  protected noteIconFor(annotation: AnnotationItem): string {
    if (annotation.noteIcon) {
      return annotation.noteIcon;
    }
    return annotation.type === 'sticky-note' ? '📌' : '📝';
  }

  protected noteMarkerLeft(annotation: AnnotationItem): number {
    return (annotation.bounds?.x || 0) * this.scale();
  }

  protected noteMarkerTop(annotation: AnnotationItem): number {
    return (annotation.bounds?.y || 0) * this.scale();
  }

  protected noteCardLeft(annotation: AnnotationItem): number {
    const markerLeft = this.noteMarkerLeft(annotation);
    const estimatedCardWidth = 230;
    const availableWidth = this.pageWidth() * this.scale();
    return markerLeft > availableWidth - estimatedCardWidth - 56 ? -estimatedCardWidth + 36 : 44;
  }

  protected toggleNote(event: Event, annotation: AnnotationItem) {
    event.stopPropagation();
    if (this.activeTool() === 'eraser') {
      this.annotationDeleted.emit(annotation.id);
      return;
    }

    this.annotationSelected.emit(annotation.id);
    this.annotationUpdated.emit({
      ...annotation,
      noteOpen: !annotation.noteOpen,
      updatedAt: new Date().toISOString()
    });
  }

  protected closeNote(event: Event, annotation: AnnotationItem) {
    event.stopPropagation();
    this.annotationUpdated.emit({
      ...annotation,
      noteOpen: false,
      updatedAt: new Date().toISOString()
    });
  }

  protected deleteNote(event: Event, annotationId: string) {
    event.stopPropagation();
    this.annotationDeleted.emit(annotationId);
  }

  protected updateNoteText(annotation: AnnotationItem, text: string) {
    this.annotationUpdated.emit({
      ...annotation,
      text,
      noteOpen: true,
      updatedAt: new Date().toISOString()
    });
  }

  private createAnnotation(
    type: AnnotationItem['type'],
    bounds?: ViewerSelectionRect
  ): AnnotationItem {
    const now = new Date().toISOString();
    return {
      id: crypto.randomUUID(),
      type,
      pageNumber: this.pageNumber(),
      color:
        type === 'rectangle' || type === 'circle' || type === 'arrow'
          ? '#0f172a'
          : type === 'free-draw'
            ? '#2563eb'
            : type === 'sticky-note'
              ? '#f59e0b'
              : '#38bdf8',
      bounds,
      text: type === 'sticky-note' || type === 'text-note' ? '' : undefined,
      noteIcon: type === 'sticky-note' ? '📌' : type === 'text-note' ? '📝' : undefined,
      noteOpen: type === 'sticky-note' || type === 'text-note' ? true : undefined,
      createdAt: now,
      updatedAt: now
    };
  }

  private eraseAtPoint(point: AnnotationPoint) {
    const target = [...this.pageAnnotations()]
      .reverse()
      .find((annotation) => !this.erasedDuringDrag.has(annotation.id) && this.annotationIntersectsPoint(annotation, point));

    if (!target) {
      return;
    }

    this.erasedDuringDrag.add(target.id);
    this.annotationDeleted.emit(target.id);
  }

  private annotationIntersectsPoint(annotation: AnnotationItem, point: AnnotationPoint): boolean {
    const tolerance = this.hitTolerance();

    switch (annotation.type) {
      case 'highlight':
      case 'underline':
        return (annotation.fragments || []).some((fragment) => this.pointInRect(point, fragment, tolerance));
      case 'rectangle':
        return this.pointInRect(point, annotation.bounds, tolerance);
      case 'circle':
        return this.pointInEllipse(point, annotation.bounds, tolerance);
      case 'arrow':
        return this.distanceToSegment(point, this.resolveArrowStart(annotation), this.resolveArrowEnd(annotation)) <= tolerance;
      case 'free-draw':
        return this.pointNearPolyline(point, annotation.points || [], tolerance);
      case 'text-note':
      case 'sticky-note':
        return this.pointInRect(
          point,
          annotation.bounds || {
            x: 0,
            y: 0,
            width: 36,
            height: 36
          },
          tolerance
        );
    }
  }

  private pointNearPolyline(point: AnnotationPoint, points: AnnotationPoint[], tolerance: number): boolean {
    if (points.length < 2) {
      return points.some((candidate) => Math.hypot(candidate.x - point.x, candidate.y - point.y) <= tolerance);
    }

    for (let index = 1; index < points.length; index += 1) {
      if (this.distanceToSegment(point, points[index - 1], points[index]) <= tolerance) {
        return true;
      }
    }

    return false;
  }

  private pointInRect(point: AnnotationPoint, rect?: ViewerSelectionRect, tolerance = 0): boolean {
    if (!rect) {
      return false;
    }

    return (
      point.x >= rect.x - tolerance &&
      point.x <= rect.x + rect.width + tolerance &&
      point.y >= rect.y - tolerance &&
      point.y <= rect.y + rect.height + tolerance
    );
  }

  private pointInEllipse(point: AnnotationPoint, bounds?: ViewerSelectionRect, tolerance = 0): boolean {
    if (!bounds) {
      return false;
    }

    const radiusX = Math.max(bounds.width / 2, 1) + tolerance;
    const radiusY = Math.max(bounds.height / 2, 1) + tolerance;
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;
    const normalized =
      ((point.x - centerX) * (point.x - centerX)) / (radiusX * radiusX) +
      ((point.y - centerY) * (point.y - centerY)) / (radiusY * radiusY);

    return normalized <= 1;
  }

  private distanceToSegment(point: AnnotationPoint, start: AnnotationPoint, end: AnnotationPoint): number {
    const dx = end.x - start.x;
    const dy = end.y - start.y;

    if (dx === 0 && dy === 0) {
      return Math.hypot(point.x - start.x, point.y - start.y);
    }

    const projection = ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy);
    const clamped = Math.min(1, Math.max(0, projection));
    const targetX = start.x + dx * clamped;
    const targetY = start.y + dy * clamped;
    return Math.hypot(point.x - targetX, point.y - targetY);
  }

  private resolveArrowStart(annotation: AnnotationItem): AnnotationPoint {
    if (annotation.startPoint) {
      return annotation.startPoint;
    }

    return {
      x: annotation.bounds?.x || 0,
      y: annotation.bounds?.y || 0
    };
  }

  private resolveArrowEnd(annotation: AnnotationItem): AnnotationPoint {
    if (annotation.endPoint) {
      return annotation.endPoint;
    }

    return {
      x: (annotation.bounds?.x || 0) + (annotation.bounds?.width || 0),
      y: (annotation.bounds?.y || 0) + (annotation.bounds?.height || 0)
    };
  }

  private buildArrowHead(start: AnnotationPoint, end: AnnotationPoint): string {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    if (!length) {
      return '';
    }

    const unitX = dx / length;
    const unitY = dy / length;
    const size = Math.max(10, Math.min(18, length * 0.22));
    const baseX = end.x - unitX * size;
    const baseY = end.y - unitY * size;
    const spreadX = -unitY * size * 0.52;
    const spreadY = unitX * size * 0.52;

    return `${end.x},${end.y} ${baseX + spreadX},${baseY + spreadY} ${baseX - spreadX},${baseY - spreadY}`;
  }

  private arrowLength(annotation: AnnotationItem): number {
    const start = this.resolveArrowStart(annotation);
    const end = this.resolveArrowEnd(annotation);
    return Math.hypot(end.x - start.x, end.y - start.y);
  }

  private toBounds(start: AnnotationPoint, end: AnnotationPoint): ViewerSelectionRect {
    return {
      x: Math.min(start.x, end.x),
      y: Math.min(start.y, end.y),
      width: Math.abs(end.x - start.x),
      height: Math.abs(end.y - start.y)
    };
  }

  private hitTolerance(): number {
    return 12 / Math.max(this.scale(), 0.8);
  }

  private capturePointer(event: PointerEvent) {
    const host = this.hostRef()?.nativeElement;
    if (!host || !host.hasPointerCapture || host.hasPointerCapture(event.pointerId)) {
      return;
    }

    try {
      host.setPointerCapture(event.pointerId);
    } catch {
      // Ignore browsers that reject pointer capture for synthetic flows.
    }
  }

  private releasePointer(event: PointerEvent) {
    const host = this.hostRef()?.nativeElement;
    if (!host?.hasPointerCapture || !host.hasPointerCapture(event.pointerId)) {
      return;
    }

    try {
      host.releasePointerCapture(event.pointerId);
    } catch {
      // Ignore browsers that already released the pointer.
    }
  }

  private toPoint(event: PointerEvent): AnnotationPoint {
    const host = this.hostRef()?.nativeElement;
    const rect = host?.getBoundingClientRect();
    if (!rect) {
      return { x: 0, y: 0 };
    }
    return {
      x: (event.clientX - rect.left) / this.scale(),
      y: (event.clientY - rect.top) / this.scale()
    };
  }
}
