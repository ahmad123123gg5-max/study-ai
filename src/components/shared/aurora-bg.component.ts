
import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, HostListener } from '@angular/core';

@Component({
  selector: 'app-aurora-bg',
  standalone: true,
  template: `
    <canvas #auroraCanvas class="fixed inset-0 z-0 pointer-events-none w-full h-full"></canvas>
  `,
  styles: [`
    :host { display: block; }
  `]
})
export class AuroraBgComponent implements AfterViewInit, OnDestroy {
  @ViewChild('auroraCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  private ctx!: CanvasRenderingContext2D;
  private animationFrameId!: number;
  private time = 0;
  private stars: { x: number, y: number, size: number, speed: number, opacity: number, color: string }[] = [];
  private mouseX = 0;
  private mouseY = 0;

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    this.mouseX = (event.clientX / window.innerWidth - 0.5) * 20;
    this.mouseY = (event.clientY / window.innerHeight - 0.5) * 20;
  }

  ngAfterViewInit() {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D;
    this.resize();
    this.initStars();
    window.addEventListener('resize', this.onResize);
    this.animate();
  }

  ngOnDestroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener('resize', this.onResize);
  }

  private onResize = () => {
    this.resize();
    this.initStars();
  };

  private initStars() {
    const { width, height } = this.canvasRef.nativeElement;
    const count = Math.floor((width * height) / 8000);
    const starColors = ['#ffffff', '#e0e7ff', '#fae8ff', '#dcfce7'];
    this.stars = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 1.2 + 0.3,
      speed: Math.random() * 0.15 + 0.05,
      opacity: Math.random() * 0.7 + 0.3,
      color: starColors[Math.floor(Math.random() * starColors.length)]
    }));
  }

  private resize() {
    const canvas = this.canvasRef.nativeElement;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  private animate() {
    this.time += 0.003;
    const { width, height } = this.canvasRef.nativeElement;
    
    // Deep Space Gradient
    const bgGradient = this.ctx.createRadialGradient(
      width / 2 + this.mouseX, height / 2 + this.mouseY, 0,
      width / 2, height / 2, width
    );
    bgGradient.addColorStop(0, '#0f172a'); // slate-900
    bgGradient.addColorStop(1, '#020617'); // slate-950
    this.ctx.fillStyle = bgGradient;
    this.ctx.fillRect(0, 0, width, height);

    this.drawStars();

    // Multiple Aurora Layers for depth
    for (let i = 0; i < 5; i++) {
      this.drawAurora(i);
    }

    // Add subtle noise/grain for 4K texture feel
    this.drawNoise();

    this.animationFrameId = requestAnimationFrame(() => this.animate());
  }

  private drawStars() {
    const { height } = this.canvasRef.nativeElement;
    
    this.stars.forEach(star => {
      star.y -= star.speed;
      if (star.y < 0) star.y = height;
      
      const blink = Math.sin(this.time * 3 + star.x) * 0.4 + 0.6;
      this.ctx.globalAlpha = star.opacity * blink;
      this.ctx.fillStyle = star.color;
      
      // Subtle parallax on stars
      const px = star.x + (this.mouseX * 0.2);
      const py = star.y + (this.mouseY * 0.2);

      this.ctx.beginPath();
      this.ctx.arc(px, py, star.size, 0, Math.PI * 2);
      this.ctx.fill();
    });
    this.ctx.globalAlpha = 1;
  }

  private drawAurora(index: number) {
    const { width, height } = this.canvasRef.nativeElement;
    const colors = [
      'rgba(79, 70, 229, 0.12)', // indigo-600
      'rgba(147, 51, 234, 0.1)',  // purple-600
      'rgba(16, 185, 129, 0.08)', // emerald-500
      'rgba(59, 130, 246, 0.06)', // blue-500
      'rgba(236, 72, 153, 0.04)'  // pink-500
    ];

    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.moveTo(0, height);

    // Parallax and wave logic
    const offset = index * 0.8;
    const speedMult = 1 + (index * 0.1);
    
    for (let x = 0; x <= width; x += 20) {
      const y = height * (0.4 + index * 0.1) + 
                Math.sin(x * 0.0015 + this.time * speedMult + offset) * (80 + index * 20) + 
                Math.cos(x * 0.0008 - this.time * 0.4 + offset) * (120 - index * 10);
      
      // Apply mouse parallax
      const finalX = x + (this.mouseX * (index + 1) * 0.5);
      const finalY = y + (this.mouseY * (index + 1) * 0.5);
      
      this.ctx.lineTo(finalX, finalY);
    }

    this.ctx.lineTo(width + 100, height + 100);
    this.ctx.lineTo(-100, height + 100);
    this.ctx.closePath();

    const gradient = this.ctx.createLinearGradient(0, height * 0.2, 0, height);
    gradient.addColorStop(0, colors[index % colors.length]);
    gradient.addColorStop(0.5, colors[index % colors.length]);
    gradient.addColorStop(1, 'transparent');

    this.ctx.fillStyle = gradient;
    this.ctx.filter = `blur(${20 + index * 10}px)`;
    this.ctx.fill();
    this.ctx.restore();
  }

  private drawNoise() {
    const { width, height } = this.canvasRef.nativeElement;
    this.ctx.globalAlpha = 0.02;
    for (let i = 0; i < 10; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillRect(x, y, 1, 1);
    }
    this.ctx.globalAlpha = 1;
  }
}
