import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, inject, NgZone, ChangeDetectionStrategy, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DiagramService } from '../../services/diagram.service';
import { UMLShapes } from '../../elements/uml-shapes';
import * as joint from 'jointjs';
import { NotificationService } from '../../../services/notification.service';

@Component({
  selector: 'app-canvas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './canvas.component.html',
  styleUrl: './canvas.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CanvasComponent implements AfterViewInit, OnDestroy {
  @ViewChild('paperElement') paperElement!: ElementRef;
  @ViewChild('canvasContainer') canvasContainer!: ElementRef;
  @ViewChild('cursorLayer') cursorLayer!: ElementRef;

  public diagramService = inject(DiagramService);
  private zone = inject(NgZone);
  private renderer = inject(Renderer2);
  private notificationService = inject(NotificationService);

  private currentScale = 1;
  private eventListeners: (() => void)[] = [];

  // Paneo
  public isPanning = false;
  private lastX = 0;
  private lastY = 0;

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      this.initPaper();
      this.initPanListeners();
      this.initZoomListener();
    });
  }

  ngOnDestroy(): void {
    if (this.diagramService.paper) this.diagramService.paper.remove();
    this.eventListeners.forEach(unlisten => unlisten());
  }

  private updateCursorLayerTransform() {
    if (!this.cursorLayer || !this.diagramService.paper) return;

    const scale = this.diagramService.paper.scale();
    const translate = this.diagramService.paper.translate();

    // Aplicar la misma transformación que el papel de JointJS a la capa HTML de cursores
    this.renderer.setStyle(this.cursorLayer.nativeElement, 'transform',
      `translate(${translate.tx}px, ${translate.ty}px) scale(${scale.sx}, ${scale.sy})`);
  }

  onContextMenu(event: MouseEvent) {
    event.preventDefault();
  }

  private initPanListeners() {
    // 1. INICIO DEL EVENTO (mousedown NATIVO para evitar bloqueos de la librería)
    const unlistenDown = this.renderer.listen(this.canvasContainer.nativeElement, 'mousedown', (evt: MouseEvent) => {
      if (evt.button === 2 || evt.which === 3) {
        this.zone.run(() => this.isPanning = true);
        this.lastX = evt.clientX;
        this.lastY = evt.clientY;
        this.renderer.addClass(this.canvasContainer.nativeElement, 'panning');
        evt.stopPropagation();
        return;
      }
    });

    // 2. MOVIMIENTO GLOBAL
    const unlistenMove = this.renderer.listen('window', 'mousemove', (evt: MouseEvent) => {
      if (!this.isPanning || !this.diagramService.paper) return;

      const dx = evt.clientX - this.lastX;
      const dy = evt.clientY - this.lastY;
      const currentT = this.diagramService.paper.translate();
      this.diagramService.paper.translate(currentT.tx + dx, currentT.ty + dy);

      this.updateCursorLayerTransform();

      this.lastX = evt.clientX;
      this.lastY = evt.clientY;
    });

    // 3. FINALIZACIÓN GLOBAL
    const unlistenUp = this.renderer.listen('window', 'mouseup', () => {
      if (this.isPanning) {
        this.zone.run(() => this.isPanning = false);
        this.renderer.removeClass(this.canvasContainer.nativeElement, 'panning');
      }
    });

    this.eventListeners.push(unlistenDown, unlistenMove, unlistenUp);
  }

  private initZoomListener() {
    const unlisten = this.renderer.listen(this.canvasContainer.nativeElement, 'wheel', (event: WheelEvent) => {
      if (event.ctrlKey) {
        event.preventDefault();
        this.zone.run(() => {
          const delta = Math.max(-1, Math.min(1, (event.deltaY || -event.detail)));
          const newScale = this.currentScale - delta * 0.1;
          if (newScale >= 0.2 && newScale <= 3) {
            this.currentScale = newScale;
            this.diagramService.paper.scale(newScale, newScale);
            this.updateCursorLayerTransform();
          }
        });
      }
    });
    this.eventListeners.push(unlisten);
  }

  private initPaper() {
    this.diagramService.paper = new joint.dia.Paper({
      el: this.paperElement.nativeElement,
      model: this.diagramService.graph,
      width: 5000,
      height: 5000,
      gridSize: 10,
      drawGrid: { name: 'dot', color: '#cbd5e1' },
      background: { color: 'transparent' },
      interactive: true,
      cellViewNamespace: { ...joint.shapes, ...UMLShapes },
      linkPinning: false,
      defaultRouter: { name: 'manhattan', args: { padding: 20 } },
      defaultConnector: { name: 'rounded' },
      validateConnection: (cellViewS, magnetS, cellViewT, magnetT) => {
        return !!magnetT && magnetS !== magnetT;
      },
      snapLinks: { radius: 25 },
      defaultLink: () => new joint.shapes.standard.Link({
        attrs: {
          line: { stroke: '#64748b', strokeWidth: 2, targetMarker: { 'type': 'path', 'd': 'M 10 -5 0 0 10 5 Z' } }
        },
        labels: [{
          attrs: {
            ['text']: { ['text']: '' }
          }
        }]
      })
    });

    // Sincronizar transformación inicial
    this.updateCursorLayerTransform();

    this.diagramService.paper.on('scale translate', () => {
      this.updateCursorLayerTransform();
    });

    this.diagramService.paper.on('view:reset', () => {
      this.currentScale = 1;
      this.updateCursorLayerTransform();
    });

    // --- Lógica de Interacción Colaborativa ---

    this.diagramService.paper.on('cell:pointerdown', (cellView: any, evt: any) => {
      const lock = this.diagramService.collabService.activeLocks().get(cellView.model.id);
      if (lock) {
        this.zone.run(() => this.notificationService.warn(`Este elemento está bloqueado por ${lock.username}`));
        evt.stopPropagation();
        return;
      }
      if (evt.button === 0) {
        const projectId = this.diagramService.currentProjectId;
        if (projectId) this.diagramService.collabService.lockCell(projectId, cellView.model.id);
        this.zone.run(() => this.diagramService.selectCell(cellView.model));
      }
    });

    this.diagramService.paper.on('cell:pointerup', (cellView: any) => {
      const projectId = this.diagramService.currentProjectId;
      if (projectId) {
        this.diagramService.collabService.commitChange(projectId, cellView.model.id, cellView.model.toJSON());
      }
    });

    this.diagramService.paper.on('link:pointerdown', (linkView: any, evt: any) => {
      const lock = this.diagramService.collabService.activeLocks().get(linkView.model.id);
      if (lock) {
        this.zone.run(() => this.notificationService.warn(`Esta flecha está bloqueada por ${lock.username}`));
        evt.stopPropagation();
        return;
      }
      if (evt.button === 0) {
        const projectId = this.diagramService.currentProjectId;
        if (projectId) this.diagramService.collabService.lockCell(projectId, linkView.model.id);
        this.zone.run(() => this.diagramService.selectCell(linkView.model));
      }
    });

    // --- EVENTOS DE DOBLE CLIC (Solo para abrir propiedades) ---

    this.diagramService.paper.on('cell:pointerdblclick', (cellView: any) => {
      this.zone.run(() => {
        this.diagramService.selectCell(cellView.model);
        this.diagramService.openProperties();
      });
    });

    this.diagramService.paper.on('link:pointerdblclick', (linkView: any) => {
      this.zone.run(() => {
        this.diagramService.selectCell(linkView.model);
        this.diagramService.openProperties();
      });
    });

    this.diagramService.paper.on('link:pointerup', (linkView: any) => {
      const projectId = this.diagramService.currentProjectId;
      if (projectId) {
        const model = linkView.model;
        // Solo enviar COMMIT si la flecha está conectada a algo (tiene un target con ID)
        // Esto evita que las flechas canceladas (en el aire) se resuciten en otros clientes.
        if (model.get('target') && model.get('target').id) {
          this.diagramService.collabService.commitChange(projectId, model.id, model.toJSON());
        }
      }
    });

    this.diagramService.paper.on('tool:pointerup', (toolView: any) => {
      const model = toolView.parent.model;
      const projectId = this.diagramService.currentProjectId;
      if (projectId && model) {
        this.diagramService.collabService.commitChange(projectId, model.id, model.toJSON());
      }
    });

    this.diagramService.paper.on('blank:pointerdown', (evt: any) => {
      if (evt.button === 0) {
        this.zone.run(() => this.diagramService.closeProperties());
      }
    });

    // Temporizador para debouncing de cambios de tamaño
    let resizeTimer: any;

    this.diagramService.graph.on('change:size', (cell: any, size: any, opt: any) => {
      if (!opt.remote && this.diagramService.currentProjectId) {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          this.diagramService.collabService.commitChange(this.diagramService.currentProjectId!, cell.id, cell.toJSON());
        }, 300);
      }
    });

    this.diagramService.graph.on('change:position', (cell: joint.dia.Element) => {
      if (cell.get('isSwimlane')) return;
      const parent = cell.getParentCell();
      if (parent && !parent.get('isSwimlane')) return;
      const area = cell.getBBox();
      const lanes = this.diagramService.graph.getCells().filter(c => c.get('isSwimlane')) as joint.shapes.standard.Rectangle[];
      const targetLane = lanes.find(l => l.getBBox().containsRect(area));
      if (targetLane) {
        if (cell.getParentCell() !== targetLane) targetLane.embed(cell);
      } else if (parent && parent.get('isSwimlane')) {
        parent.unembed(cell);
      }
    });
  }

  onMouseMove(event: MouseEvent) {
    if (!this.diagramService.paper) return;
    const projectId = this.diagramService.currentProjectId;
    if (!projectId) return;

    const localPoint = this.diagramService.paper.clientToLocalPoint({
      x: event.clientX,
      y: event.clientY
    });

    this.diagramService.collabService.sendCursor(projectId, localPoint.x, localPoint.y);
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    const type = event.dataTransfer?.getData('type');
    if (type && this.diagramService.paper) {
      const point = this.diagramService.paper.clientToLocalPoint({
        x: event.clientX,
        y: event.clientY
      });
      this.zone.run(() => this.diagramService.addElement(type, point.x, point.y));
    }
  }
}