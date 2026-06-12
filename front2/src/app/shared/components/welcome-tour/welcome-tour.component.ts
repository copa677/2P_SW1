import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';

interface TourStep {
  title: string;
  description: string;
  selector?: string;
}

@Component({
  selector: 'app-welcome-tour',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="tour-overlay" *ngIf="isVisible()">
      <!-- Spotlight Mask -->
      <div 
        *ngIf="currentSelector() && spotlightRect()" 
        class="tour-spotlight"
        [ngStyle]="{
          'top.px': spotlightRect()?.top,
          'left.px': spotlightRect()?.left,
          'width.px': spotlightRect()?.width,
          'height.px': spotlightRect()?.height
        }"
      ></div>

      <!-- General Shadow Overlay (Used when no target selector is active, like start/end steps) -->
      <div *ngIf="!currentSelector()" class="tour-backdrop-full"></div>

      <!-- Information Tooltip Card -->
      <div 
        class="tour-card animate-scale-in"
        [ngClass]="getCardPositionClass()"
        [ngStyle]="getCardInlineStyle()"
      >
        <!-- Card Header -->
        <div class="tour-card-header">
          <div class="tour-progress">
            Paso {{ currentStep() + 1 }} de {{ steps.length }}
          </div>
          <button (click)="skipTour()" class="tour-close-btn" title="Omitir recorrido">
            ✕
          </button>
        </div>

        <!-- Card Content -->
        <div class="tour-card-body">
          <h3 class="tour-title">{{ currentStepData().title }}</h3>
          <p class="tour-desc">{{ currentStepData().description }}</p>
        </div>

        <!-- Card Footer (Action Buttons) -->
        <div class="tour-card-footer">
          <button 
            (click)="skipTour()" 
            class="tour-btn-text"
          >
            Omitir
          </button>
          
          <div class="tour-nav-actions">
            <button 
              [disabled]="currentStep() === 0" 
              (click)="previousStep()" 
              class="tour-btn-outline"
            >
              Anterior
            </button>
            <button 
              (click)="nextStep()" 
              class="tour-btn-primary"
            >
              {{ currentStep() === steps.length - 1 ? 'Finalizar' : 'Siguiente' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .tour-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      z-index: 9999;
      pointer-events: auto;
      overflow: hidden;
      font-family: 'Inter', sans-serif;
    }

    .tour-backdrop-full {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(15, 23, 42, 0.75);
      backdrop-filter: blur(4px);
      transition: all 0.3s ease;
    }

    .tour-spotlight {
      position: absolute;
      border-radius: 12px;
      box-shadow: 0 0 0 9999px rgba(15, 23, 42, 0.75);
      transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
      pointer-events: none;
      z-index: 10000;
      border: 2px solid #6366f1;
    }

    .tour-card {
      position: absolute;
      width: 320px;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(12px);
      border-radius: 16px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(99, 102, 241, 0.1);
      padding: 18px;
      z-index: 10001;
      display: flex;
      flex-direction: column;
      gap: 12px;
      transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
    }

    :host-context(.dark) .tour-card {
      background: rgba(22, 27, 34, 0.95);
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(99, 102, 241, 0.2);
    }

    .tour-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(0, 0, 0, 0.06);
      padding-bottom: 8px;
    }

    :host-context(.dark) .tour-card-header {
      border-bottom-color: rgba(255, 255, 255, 0.06);
    }

    .tour-progress {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.2px;
      color: #6366f1;
    }

    .tour-close-btn {
      background: transparent;
      border: none;
      font-size: 12px;
      cursor: pointer;
      color: #64748b;
      padding: 2px;
      line-height: 1;
      transition: color 0.2s;
    }

    .tour-close-btn:hover {
      color: #1e293b;
    }

    :host-context(.dark) .tour-close-btn:hover {
      color: #ffffff;
    }

    .tour-title {
      font-size: 15px;
      font-weight: 800;
      color: #1e293b;
      margin: 0 0 6px 0;
      line-height: 1.3;
    }

    :host-context(.dark) .tour-title {
      color: #ffffff;
    }

    .tour-desc {
      font-size: 12.5px;
      line-height: 1.5;
      color: #475569;
      margin: 0;
    }

    :host-context(.dark) .tour-desc {
      color: #9ca3af;
    }

    .tour-card-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 8px;
    }

    .tour-nav-actions {
      display: flex;
      gap: 8px;
    }

    .tour-btn-text {
      background: transparent;
      border: none;
      color: #64748b;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      padding: 6px 10px;
      border-radius: 8px;
      transition: background 0.2s, color 0.2s;
    }

    .tour-btn-text:hover {
      background: rgba(0, 0, 0, 0.03);
      color: #1e293b;
    }

    :host-context(.dark) .tour-btn-text:hover {
      background: rgba(255, 255, 255, 0.03);
      color: #ffffff;
    }

    .tour-btn-outline {
      background: transparent;
      border: 1px solid #cbd5e1;
      color: #475569;
      font-size: 12px;
      font-weight: 700;
      padding: 6px 12px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .tour-btn-outline:hover:not(:disabled) {
      background: #f8fafc;
      border-color: #94a3b8;
    }

    .tour-btn-outline:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    :host-context(.dark) .tour-btn-outline {
      border-color: #374151;
      color: #cbd5e1;
    }

    :host-context(.dark) .tour-btn-outline:hover:not(:disabled) {
      background: #1f2937;
    }

    .tour-btn-primary {
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
      border: none;
      color: white;
      font-size: 12px;
      font-weight: 700;
      padding: 6px 14px;
      border-radius: 8px;
      cursor: pointer;
      box-shadow: 0 4px 6px -1px rgba(99, 102, 241, 0.2);
      transition: all 0.2s;
    }

    .tour-btn-primary:hover {
      box-shadow: 0 10px 15px -3px rgba(99, 102, 241, 0.3);
      transform: translateY(-0.5px);
    }

    /* Posicionamiento en centro de pantalla */
    .tour-card-center {
      top: 50% !important;
      left: 50% !important;
      transform: translate(-50%, -50%) !important;
    }

    /* Animaciones */
    @keyframes scaleIn {
      from {
        opacity: 0;
        transform: translate(-50%, -50%) scale(0.95);
      }
      to {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
      }
    }

    .animate-scale-in {
      animation: scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }
  `]
})
export class WelcomeTourComponent implements OnInit {
  private readonly authService = inject(AuthService);

  readonly isVisible = signal<boolean>(true);
  readonly currentStep = signal<number>(0);
  readonly spotlightRect = signal<{ top: number; left: number; width: number; height: number } | null>(null);

  readonly steps: TourStep[] = [
    {
      title: '¡Bienvenido a POLITICAS Engine!',
      description: 'Te guiaremos en un recorrido corto por las secciones principales del sistema para que aprendas a modelar y ejecutar tus flujos de trabajo.'
    },
    {
      title: 'Dashboard de Control',
      description: 'Visualiza métricas generales, reportes de IA y el estado de avance de los trámites y procesos activos del sistema en tiempo real.',
      selector: '#tour-dashboard'
    },
    {
      title: 'Diagramador UML de Procesos',
      description: 'Crea, edita y diseña tus flujos de procesos dinámicos arrastrando formas (Actividades, Decisiones, Swimlanes) en la pizarra interactiva.',
      selector: '#tour-diagramador'
    },
    {
      title: 'Asignaciones de Carriles',
      description: 'Define qué usuario o cliente debe resolver cada carril (calle) de tu diagrama, configurando el control manual o automático de los flujos.',
      selector: '#tour-asignaciones'
    },
    {
      title: 'Bandeja de Tareas',
      description: 'Tu lista de actividades pendientes asignadas. Aquí rellenarás los formularios dinámicos y subirás los documentos requeridos en cada paso.',
      selector: '#tour-tareas'
    },
    {
      title: 'Gestor Documental',
      description: 'Explora y descarga todos los documentos y archivos de soporte asociados a los expedientes de tus procesos, almacenados de forma segura en la nube.',
      selector: '#tour-documentos'
    },
    {
      title: 'Permisos Granulares',
      description: 'Configura permisos granulares de lectura, escritura y ejecución específicos para los roles del sistema (Admin, Funcionario, Diagramador).',
      selector: '#tour-permisos'
    },
    {
      title: 'Personalización de Tema',
      description: 'Cambia en caliente entre el tema claro para el día y nuestro elegante modo oscuro plomo metálico de alta gama para la noche.',
      selector: '#tour-theme'
    },
    {
      title: '¡Todo listo!',
      description: 'Has completado el recorrido de inicio. Ahora puedes empezar a interactuar con el sistema. ¡Mucho éxito en tus gestiones!'
    }
  ];

  readonly currentStepData = computed(() => this.steps[this.currentStep()]);
  readonly currentSelector = computed(() => this.currentStepData().selector);

  constructor() {
    // Escuchar el paso actual y recalcular las coordenadas del spotlight automáticamente
    effect(() => {
      this.calculateSpotlight();
    });
  }

  ngOnInit() {
    // Asegurar el cálculo inicial después de cargar el componente
    setTimeout(() => this.calculateSpotlight(), 100);
  }

  calculateSpotlight() {
    const selector = this.currentSelector();
    if (!selector) {
      this.spotlightRect.set(null);
      return;
    }

    const element = document.querySelector(selector);
    if (element) {
      const rect = element.getBoundingClientRect();
      // Añadimos un pequeño padding de 6px para que el spotlight no quede muy pegado al botón
      const padding = 6;
      this.spotlightRect.set({
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + (padding * 2),
        height: rect.height + (padding * 2),
      });

      // Asegurar que el elemento destacado sea visible en la pantalla
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      this.spotlightRect.set(null);
    }
  }

  nextStep() {
    if (this.currentStep() < this.steps.length - 1) {
      this.currentStep.update(s => s + 1);
    } else {
      this.finishTour();
    }
  }

  previousStep() {
    if (this.currentStep() > 0) {
      this.currentStep.update(s => s - 1);
    }
  }

  skipTour() {
    this.finishTour();
  }

  private finishTour() {
    this.isVisible.set(false);
    this.authService.completeTour().subscribe({
      next: () => {
        console.log('Tour onboarding completado y guardado en backend.');
      },
      error: (e) => {
        console.error('Error al guardar estado de tour en backend', e);
      }
    });
  }

  // Genera las posiciones del tooltip según el spotlight
  getCardPositionClass(): string {
    const selector = this.currentSelector();
    if (!selector) {
      return 'tour-card-center';
    }
    return '';
  }

  getCardInlineStyle(): Record<string, string> {
    const rect = this.spotlightRect();
    if (!rect) {
      return {};
    }

    const tooltipHeight = 160; // Altura estimada del card
    const tooltipWidth = 320;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    let cardTop = 0;
    let cardLeft = 0;

    // Posicionar a la derecha del elemento si hay espacio, sino abajo/arriba
    if (rect.left + rect.width + tooltipWidth + 20 < windowWidth) {
      cardLeft = rect.left + rect.width + 16;
      cardTop = rect.top + (rect.height / 2) - (tooltipHeight / 2);
    } else if (rect.left - tooltipWidth - 20 > 0) {
      // Posicionar a la izquierda del elemento
      cardLeft = rect.left - tooltipWidth - 16;
      cardTop = rect.top + (rect.height / 2) - (tooltipHeight / 2);
    } else if (rect.top + rect.height + tooltipHeight + 20 < windowHeight) {
      // Posicionar abajo
      cardLeft = rect.left + (rect.width / 2) - (tooltipWidth / 2);
      cardTop = rect.top + rect.height + 16;
    } else {
      // Posicionar arriba
      cardLeft = rect.left + (rect.width / 2) - (tooltipWidth / 2);
      cardTop = rect.top - tooltipHeight - 16;
    }

    // Asegurarse de que el card no se salga por los bordes horizontales de la pantalla
    if (cardLeft < 16) cardLeft = 16;
    if (cardLeft + tooltipWidth > windowWidth - 16) {
      cardLeft = windowWidth - tooltipWidth - 16;
    }

    // Asegurarse de que el card no se salga por los bordes verticales de la pantalla
    if (cardTop < 16) cardTop = 16;
    if (cardTop + tooltipHeight > windowHeight - 16) {
      cardTop = windowHeight - tooltipHeight - 16;
    }

    return {
      'top': `${cardTop}px`,
      'left': `${cardLeft}px`
    };
  }
}
