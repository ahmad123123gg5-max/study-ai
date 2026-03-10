
import { Component, ElementRef, ViewChild, output, signal, AfterViewInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LocalizationService } from '../../services/localization.service';

@Component({
  selector: 'app-diagram-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-300">
      <div class="bg-slate-900 w-full max-w-4xl rounded-[2.5rem] border border-white/10 shadow-4xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-500">
        
        <!-- Header -->
        <div class="p-6 border-b border-white/5 flex items-center justify-between">
          <div class="flex items-center gap-4">
            <div class="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
              <i class="fa-solid fa-pen-nib"></i>
            </div>
            <div>
              <h2 class="text-xl font-black text-white">{{ t('Handwritten Diagram') }}</h2>
              <p class="text-xs text-slate-500 font-bold uppercase tracking-widest">{{ t('Handwritten Diagram') }}</p>
            </div>
          </div>
          <button (click)="closeModal.emit()" class="w-10 h-10 rounded-xl bg-white/5 hover:bg-rose-600 transition-all flex items-center justify-center text-white">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <!-- Canvas Area -->
        <div class="flex-1 bg-white relative cursor-crosshair overflow-hidden" #canvasContainer>
          <canvas #canvas 
                  (mousedown)="startDrawing($event)" 
                  (mousemove)="draw($event)" 
                  (mouseup)="stopDrawing()" 
                  (mouseleave)="stopDrawing()"
                  (touchstart)="startDrawingTouch($event)"
                  (touchmove)="drawTouch($event)"
                  (touchend)="stopDrawing()"
                  class="w-full h-full"></canvas>
        </div>

        <!-- Footer / Controls -->
        <div class="p-6 border-t border-white/5 bg-slate-950/50 flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center gap-2">
            <button (click)="clear()" class="px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold text-sm transition-all flex items-center gap-2">
              <i class="fa-solid fa-eraser"></i> {{ t('Clear All') }}
            </button>
            <div class="flex items-center gap-2 ml-4">
              <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest">{{ t('Color') }}:</span>
              <div class="flex gap-1">
                @for (color of colors; track color) {
                  <button (click)="currentColor.set(color)" 
                          [style.background-color]="color"
                          [class.ring-2]="currentColor() === color"
                          class="w-6 h-6 rounded-full ring-offset-2 ring-indigo-500 transition-all"></button>
                }
              </div>
            </div>
          </div>
          
          <div class="flex items-center gap-3">
            <button (click)="closeModal.emit()" class="px-6 py-3 text-slate-400 font-bold hover:text-white transition-colors">{{ t('Cancel') }}</button>
            <button (click)="save()" class="px-8 py-3 bg-indigo-600 text-white rounded-xl font-black shadow-xl shadow-indigo-600/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2">
              <i class="fa-solid fa-check"></i> {{ t('Confirm and Send') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    canvas { touch-action: none; }
  `]
})
export class DiagramModal implements AfterViewInit {
  private readonly localization = inject(LocalizationService);
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('canvasContainer') containerRef!: ElementRef<HTMLDivElement>;
  
  closeModal = output<void>();
  saveDiagram = output<string>(); // emits base64 string
  
  currentColor = signal('#000000');
  colors = ['#000000', '#ef4444', '#10b981', '#3b82f6', '#f59e0b'];
  readonly t = (text: string) => this.localization.phrase(text);
  
  private ctx!: CanvasRenderingContext2D;
  private drawing = false;

  ngAfterViewInit() {
    const canvas = this.canvasRef.nativeElement;
    const container = this.containerRef.nativeElement;
    
    // Set canvas size to match container
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    
    this.ctx = canvas.getContext('2d')!;
    this.ctx.lineCap = 'round';
    this.ctx.lineWidth = 3;
    
    // Fill white background
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  startDrawing(event: MouseEvent) {
    this.drawing = true;
    this.ctx.beginPath();
    this.ctx.moveTo(event.offsetX, event.offsetY);
    this.ctx.strokeStyle = this.currentColor();
  }

  draw(event: MouseEvent) {
    if (!this.drawing) return;
    this.ctx.lineTo(event.offsetX, event.offsetY);
    this.ctx.stroke();
  }

  startDrawingTouch(event: TouchEvent) {
    event.preventDefault();
    const touch = event.touches[0];
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    this.drawing = true;
    this.ctx.beginPath();
    this.ctx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top);
    this.ctx.strokeStyle = this.currentColor();
  }

  drawTouch(event: TouchEvent) {
    event.preventDefault();
    if (!this.drawing) return;
    const touch = event.touches[0];
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    this.ctx.lineTo(touch.clientX - rect.left, touch.clientY - rect.top);
    this.ctx.stroke();
  }

  stopDrawing() {
    this.drawing = false;
  }

  clear() {
    const canvas = this.canvasRef.nativeElement;
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  save() {
    const canvas = this.canvasRef.nativeElement;
    const dataUrl = canvas.toDataURL('image/png');
    const base64 = dataUrl.split(',')[1];
    this.saveDiagram.emit(base64);
  }
}
