import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DocumentPageData, TranslationPageEntry, TranslationViewMode } from '../document-workspace.types';

@Component({
  selector: 'app-document-text-layer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="document-workspace-text-layer"
      [style.width.px]="page()?.width ? page()!.width * scale() : 0"
      [style.height.px]="page()?.height ? page()!.height * scale() : 0"
    >
      @if (visible()) {
        @for (block of page()?.blocks || []; track block.id) {
          <div
            class="document-workspace-text-block"
            [style.left.px]="block.x * scale()"
            [style.top.px]="block.y * scale()"
            [style.width.px]="blockWidth(block)"
            [style.minHeight.px]="blockHeight(block)"
            [style.fontSize.px]="blockFontSize(block)"
            [attr.dir]="block.direction"
            [style.textAlign]="block.direction === 'rtl' ? 'right' : 'left'"
          >
            {{ block.text }}
          </div>

          @if (showTranslation(block.id)) {
            <div
              class="document-workspace-translation-chip"
              [style.left.px]="block.x * scale()"
              [style.top.px]="translationTop(block)"
              [style.width.px]="blockWidth(block)"
              [style.fontSize.px]="translationFontSize(block)"
              [attr.dir]="translationDirection()"
              [style.textAlign]="translationDirection() === 'rtl' ? 'right' : 'left'"
            >
              {{ translationFor(block.id) }}
            </div>
          }
        }
      }
    </div>
  `,
  styles: [`
    :host {
      position: absolute;
      inset: 0;
      display: block;
      user-select: text;
    }

    .document-workspace-text-layer {
      position: absolute;
      inset: 0;
      overflow: hidden;
      line-height: 1.2;
      text-size-adjust: none;
      forced-color-adjust: none;
    }

    .document-workspace-text-block {
      color: transparent;
      position: absolute;
      white-space: pre-wrap;
      cursor: text;
      margin: 0;
      padding: 0;
      overflow: hidden;
      background: transparent !important;
      border: 0;
      opacity: 1;
      text-shadow: none !important;
      -webkit-text-fill-color: transparent !important;
      font-family: Georgia, "Times New Roman", serif;
      unicode-bidi: plaintext;
      user-select: text;
    }

    .document-workspace-text-block::selection {
      background: rgba(99, 102, 241, 0.28);
      color: transparent;
      -webkit-text-fill-color: transparent;
    }

    .document-workspace-translation-chip {
      position: absolute;
      z-index: 2;
      pointer-events: none;
      border-radius: 0.85rem;
      background: rgba(238, 242, 255, 0.92);
      color: rgb(67 56 202);
      padding: 0.2rem 0.45rem;
      line-height: 1.35;
      box-shadow: 0 10px 24px -22px rgba(67, 56, 202, 0.5);
      white-space: pre-wrap;
      overflow: hidden;
      text-wrap: balance;
    }
  `],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocumentTextLayerComponent {
  page = input<DocumentPageData | null>(null);
  scale = input(1);
  visible = input(true);
  translationViewMode = input<TranslationViewMode>('original');
  translationEntry = input<TranslationPageEntry | null>(null);

  private readonly translationMap = computed(
    () => new Map((this.translationEntry()?.blocks || []).map((item) => [item.blockId, item.translatedText]))
  );

  protected blockWidth(block: NonNullable<DocumentPageData['blocks']>[number]): number {
    return Math.max(48, block.width * this.scale());
  }

  protected blockHeight(block: NonNullable<DocumentPageData['blocks']>[number]): number {
    return Math.max(block.height * this.scale(), block.fontSize * this.scale() * 1.32);
  }

  protected blockFontSize(block: NonNullable<DocumentPageData['blocks']>[number]): number {
    return Math.max(10, block.fontSize * this.scale());
  }

  protected showTranslation(blockId: string): boolean {
    return this.translationViewMode() !== 'original' && !!this.translationMap().get(blockId);
  }

  protected translationFor(blockId: string): string {
    return this.translationMap().get(blockId) || '';
  }

  protected translationDirection(): 'rtl' | 'ltr' {
    return this.translationEntry()?.targetLanguage === 'ar' ? 'rtl' : 'ltr';
  }

  protected translationTop(block: NonNullable<DocumentPageData['blocks']>[number]): number {
    return (block.y + block.height + Math.max(4, block.fontSize * 0.18)) * this.scale();
  }

  protected translationFontSize(block: NonNullable<DocumentPageData['blocks']>[number]): number {
    return Math.max(9, block.fontSize * this.scale() * 0.68);
  }
}
