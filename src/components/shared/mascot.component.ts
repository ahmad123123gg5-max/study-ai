
import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, HostListener } from '@angular/core';
import * as THREE from 'three';

@Component({
  selector: 'app-mascot',
  standalone: true,
  template: `
    <div #container class="hidden md:block w-64 h-64 cursor-pointer"></div>
  `,
  styles: [`
    :host { display: block; }
  `]
})
export class MascotComponent implements AfterViewInit, OnDestroy {
  @ViewChild('container') containerRef!: ElementRef<HTMLDivElement>;
  
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private mascot!: THREE.Group;
  private animationFrameId!: number;
  
  private mouseX = 0;
  private mouseY = 0;
  private targetX = 0;
  private targetY = 0;

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    this.targetX = (event.clientX / window.innerWidth - 0.5) * 2;
    this.targetY = -(event.clientY / window.innerHeight - 0.5) * 2;
  }

  ngAfterViewInit() {
    this.initThree();
    this.createMascot();
    this.animate();
  }

  ngOnDestroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.renderer.dispose();
  }

  private initThree() {
    const width = 256;
    const height = 256;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    this.camera.position.z = 5;

    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.containerRef.nativeElement.appendChild(this.renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0x4f46e5, 2);
    pointLight.position.set(5, 5, 5);
    this.scene.add(pointLight);
  }

  private createMascot() {
    this.mascot = new THREE.Group();

    // Body
    const bodyGeo = new THREE.SphereGeometry(1, 32, 32);
    const bodyMat = new THREE.MeshPhongMaterial({ 
      color: 0xffffff, 
      shininess: 100,
      transparent: true,
      opacity: 0.9
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    this.mascot.add(body);

    // Visor/Face
    const visorGeo = new THREE.SphereGeometry(0.6, 32, 32);
    const visorMat = new THREE.MeshPhongMaterial({ color: 0x1e293b });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.z = 0.6;
    visor.scale.y = 0.6;
    this.mascot.add(visor);

    // Glow eyes
    const eyeGeo = new THREE.CircleGeometry(0.1, 32);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x4f46e5 });
    
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.2, 0, 1.15);
    this.mascot.add(eyeL);

    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.2, 0, 1.15);
    this.mascot.add(eyeR);

    this.scene.add(this.mascot);
  }

  private animate() {
    this.animationFrameId = requestAnimationFrame(() => this.animate());

    // Smooth follow
    this.mouseX += (this.targetX - this.mouseX) * 0.05;
    this.mouseY += (this.targetY - this.mouseY) * 0.05;

    this.mascot.rotation.y = this.mouseX * 0.5;
    this.mascot.rotation.x = -this.mouseY * 0.5;
    
    // Floating effect
    this.mascot.position.y = Math.sin(Date.now() * 0.002) * 0.2;

    this.renderer.render(this.scene, this.camera);
  }
}
