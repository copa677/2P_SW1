import { Component, ElementRef, OnInit, AfterViewInit, ViewChild, inject, signal, computed, OnDestroy, effect } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { KeyValuePipe } from '@angular/common';
import { Subscription } from 'rxjs';
import * as joint from 'jointjs';
import { DiagramService } from '../../../../core/services/diagram.service';
import { AuthService } from '../../../../core/services/auth.service';
import { CollaborationService } from '../../../../core/services/collaboration.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { PaletteComponent } from '../../components/palette/palette.component';
import { PropertiesComponent, CustomField } from '../../components/properties/properties.component';
import { FinalNode } from '../../components/uml-shapes';

function getDefaultPorts() {
  return {
    groups: {
      'top': { position: 'top', attrs: { circle: { r: 5, fill: '#6366f1', stroke: '#ffffff', 'stroke-width': 1.5, magnet: true, cursor: 'crosshair' } } },
      'bottom': { position: 'bottom', attrs: { circle: { r: 5, fill: '#6366f1', stroke: '#ffffff', 'stroke-width': 1.5, magnet: true, cursor: 'crosshair' } } },
      'left': { position: 'left', attrs: { circle: { r: 5, fill: '#6366f1', stroke: '#ffffff', 'stroke-width': 1.5, magnet: true, cursor: 'crosshair' } } },
      'right': { position: 'right', attrs: { circle: { r: 5, fill: '#6366f1', stroke: '#ffffff', 'stroke-width': 1.5, magnet: true, cursor: 'crosshair' } } }
    },
    items: [
      { id: 'top', group: 'top' },
      { id: 'bottom', group: 'bottom' },
      { id: 'left', group: 'left' },
      { id: 'right', group: 'right' }
    ]
  };
}

function getHorizontalForkPorts() {
  return {
    groups: {
      'fork-point': {
        position: { name: 'absolute' },
        attrs: {
          circle: { r: 5, fill: '#6366f1', stroke: '#ffffff', 'stroke-width': 1.5, magnet: true, cursor: 'crosshair' }
        }
      }
    },
    items: [
      { id: 'p1', group: 'fork-point', args: { x: '0%', y: '50%' } },
      { id: 'p2', group: 'fork-point', args: { x: '25%', y: '50%' } },
      { id: 'p3', group: 'fork-point', args: { x: '50%', y: '50%' } },
      { id: 'p4', group: 'fork-point', args: { x: '75%', y: '50%' } },
      { id: 'p5', group: 'fork-point', args: { x: '100%', y: '50%' } }
    ]
  };
}

function getVerticalForkPorts() {
  return {
    groups: {
      'fork-point': {
        position: { name: 'absolute' },
        attrs: {
          circle: { r: 5, fill: '#6366f1', stroke: '#ffffff', 'stroke-width': 1.5, magnet: true, cursor: 'crosshair' }
        }
      }
    },
    items: [
      { id: 'p1', group: 'fork-point', args: { x: '50%', y: '0%' } },
      { id: 'p2', group: 'fork-point', args: { x: '50%', y: '25%' } },
      { id: 'p3', group: 'fork-point', args: { x: '50%', y: '50%' } },
      { id: 'p4', group: 'fork-point', args: { x: '50%', y: '75%' } },
      { id: 'p5', group: 'fork-point', args: { x: '50%', y: '100%' } }
    ]
  };
}

@Component({
  selector: 'app-diagrammer-editor',
  standalone: true,
  imports: [RouterLink, PaletteComponent, PropertiesComponent, KeyValuePipe],
  templateUrl: './diagrammer-editor.component.html'
})
export class DiagrammerEditorComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly diagramService = inject(DiagramService);
  protected readonly authService = inject(AuthService);
  protected readonly collabService = inject(CollaborationService);
  protected readonly themeService = inject(ThemeService);

  constructor() {
    effect(() => {
      const currentTheme = this.themeService.theme();
      this.updateGridTheme(currentTheme);
    });
  }

  private readonly subscriptions: Subscription[] = [];

  @ViewChild('paperHolder') paperHolder!: ElementRef;

  // JointJS instances
  graph!: joint.dia.Graph;
  paper!: joint.dia.Paper;

  // Reactividad por Signals
  readonly diagramId = signal<string>('');
  readonly diagramName = signal<string>('');
  readonly zoomScale = signal<number>(1);
  readonly isConnectMode = signal<boolean>(false);

  // Signals para enlace del Right Sidebar (Propiedades)
  readonly selectedCellId = signal<string | null>(null);
  readonly selectedCellType = signal<'element' | 'link' | null>(null);
  readonly selectedCellText = signal<string>('');
  readonly selectedCellColor = signal<string>('');
  readonly selectedCustomFields = signal<CustomField[]>([]);
  readonly selectedElementType = signal<string>('');
  readonly copied = signal<boolean>(false);
  readonly paperTranslateX = signal<number>(0);
  readonly paperTranslateY = signal<number>(0);

  // Variables para paneo (Clic Derecho)
  private isPanning = false;
  private startPanX = 0;
  private startPanY = 0;
  private currentTx = 0;
  private currentTy = 0;

  // Puntos de conexión (Linking)
  private firstSourceElementId: string | null = null;
  private activeToolsLinkView: any = null;
  private activeToolsElementView: any = null;

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/diagramas']);
      return;
    }

    this.diagramId.set(id);
    const diag = this.diagramService.diagrams().find(d => d.id === id);
    if (!diag) {
      this.router.navigate(['/diagramas']);
      return;
    }

    this.diagramName.set(diag.name);

    // Conectarse a la colaboración en tiempo real
    this.collabService.connect(id);

    // Escuchar mensajes del socket colaborativo
    this.subscriptions.push(
      this.collabService.messages$.subscribe(msg => {
        this.applyRemoteChange(msg);
      })
    );
  }

  ngAfterViewInit() {
    // Definir espacio de nombres combinado para incluir figuras UML 2.5 personalizadas
    const customNamespace = {
      ...joint.shapes,
      uml: {
        FinalNode
      }
    };

    // Inicializar instancias nativas de JointJS con soporte para el espacio de nombres personalizado
    this.graph = new joint.dia.Graph({}, { cellNamespace: customNamespace });

    // Sincronizar adición de elementos
    (this.graph as any).on('add', (cell: any, collection: any, opt: any) => {
      if (!opt?.remote) {
        this.collabService.sendMessage(this.diagramId(), 'ADD', cell.toJSON());
      }
    });

    // Sincronizar eliminación de elementos
    (this.graph as any).on('remove', (cell: any, collection: any, opt: any) => {
      if (!opt?.remote) {
        this.collabService.sendMessage(this.diagramId(), 'REMOVE', { id: cell.id });
      }
    });

    // Sincronizar movimientos de posición y manejar parent-child embedding de calles
    (this.graph as any).on('change:position', (cell: any, pos: any, opt: any) => {
      if (cell.get('isSwimlane')) return;

      if (cell.isElement()) {
        const lane = this.getLaneForNode(cell);
        const currentParent = cell.getParentCell();
        if (lane) {
          if (!currentParent || currentParent.id !== lane.id) {
            if (currentParent) {
              currentParent.unembed(cell);
            }
            lane.embed(cell);
          }
        } else {
          if (currentParent) {
            currentParent.unembed(cell);
          }
        }
      }

      if (!opt?.remote) {
        this.collabService.sendMessage(this.diagramId(), 'MOVE', { id: cell.id, x: pos.x, y: pos.y });
      }
    });

    // Sincronizar cambios de tamaño con debouncing
    let resizeTimer: any;
    (this.graph as any).on('change:size', (cell: any, size: any, opt: any) => {
      // Si cambia el tamaño de una calle, recalcular la pertenencia de los nodos
      if (cell.get('isSwimlane') || cell.get('elementType') === 'lane') {
        this.graph.getElements().forEach((node: any) => {
          if (node.isElement() && !node.get('isSwimlane') && node.get('elementType') !== 'lane') {
            const lane = this.getLaneForNode(node);
            const currentParent = node.getParentCell();
            if (lane) {
              if (!currentParent || currentParent.id !== lane.id) {
                if (currentParent) {
                  currentParent.unembed(node);
                }
                lane.embed(node);
              }
            } else {
              if (currentParent) {
                currentParent.unembed(node);
              }
            }
          }
        });
      }

      if (!opt?.remote) {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          this.collabService.commitChange(this.diagramId(), cell.id, cell.toJSON());
        }, 300);
      }
    });
    
    // Crear el papel (lienzo de dibujo)
    this.paper = new joint.dia.Paper({
      el: this.paperHolder.nativeElement,
      model: this.graph,
      cellViewNamespace: customNamespace,
      width: '100%',
      height: 600,
      gridSize: 10,
      drawGrid: { name: 'doubleMesh', args: [{ color: '#cbd5e1', thickness: 1 }, { color: '#6366f1', scaleFactor: 5, thickness: 0.5 }] },
      background: {
        color: 'transparent'
      },
      interactive: true,
      snapLinks: true,
      linkPinning: false,
      defaultLink: () => new joint.shapes.standard.Link({
        router: { name: 'manhattan' },
        connector: { name: 'rounded' },
        labels: [{
          attrs: {
            text: { text: '', fontSize: 13, fontWeight: '600', fill: '#ffffff', fontFamily: 'Plus Jakarta Sans, sans-serif', class: 'link-label-text' },
            rect: { fill: '#4f46e5', stroke: '#4338ca', strokeWidth: 1, rx: 6, ry: 6, class: 'link-label-rect' }
          }
        }],
        attrs: {
          line: { stroke: '#6366f1', strokeWidth: 2, targetMarker: { 'type': 'path', 'd': 'M 10 -5 0 0 10 5 Z' } }
        }
      }),
      validateConnection: function(cellViewS, magnetS, cellViewT, magnetT, end, linkView) {
        return cellViewS !== cellViewT; // No auto-conexiones
      }
    });

    // Inicializar el tema de la cuadrícula
    this.updateGridTheme(this.themeService.theme());

    // Escuchar escala y translate para la capa de cursores
    this.paper.on('scale translate', () => {
      const trans = this.paper.translate();
      this.paperTranslateX.set(trans.tx);
      this.paperTranslateY.set(trans.ty);
    });

    // Desactivar el menú contextual nativo sobre el área de dibujo para habilitar el clic derecho sin interferencias
    this.paperHolder.nativeElement.addEventListener('contextmenu', (e: Event) => e.preventDefault());

    // Cargar los datos del diagrama si existen
    const diag = this.diagramService.diagrams().find(d => d.id === this.diagramId());
    if (diag && diag.data) {
      try {
        const parsed = JSON.parse(diag.data);
        if (parsed.elementos && Array.isArray(parsed.elementos)) {
          this.loadFromStructuredJson(parsed);
        } else {
          // Retrocompatibilidad con diagramas anteriores de formato plano
          this.graph.fromJSON(parsed);
          
          // Agregar puertos a los elementos cargados si no los tienen
          this.graph.getElements().forEach((cell: any) => {
            if (cell.get('isSwimlane')) return;
            const ports = cell.getPorts();
            if (!ports || ports.length === 0) {
              const elementType = cell.get('elementType');
              if (elementType === 'fork') {
                const isHorizontal = cell.size().width > cell.size().height;
                cell.prop('ports', isHorizontal ? getHorizontalForkPorts() : getVerticalForkPorts());
              } else if (elementType !== 'lane') {
                cell.prop('ports', getDefaultPorts());
              }
            }
          });
        }
      } catch (err) {
        console.error('Error cargando diagrama JointJS:', err);
      }
    }

    // Escuchadores de Eventos del Lienzo
    this.setupPaperEventListeners();
  }

  ngOnDestroy() {
    this.collabService.disconnect(this.diagramId());
    this.subscriptions.forEach(sub => sub.unsubscribe());
    if (this.paper) {
      (this.paper as any).remove();
    }
  }

  private updateGridTheme(theme: 'light' | 'dark') {
    if (!this.paper) return;
    
    const isDark = theme === 'dark';
    const gridOptions = {
      name: 'doubleMesh',
      args: isDark 
        ? [
            { color: 'rgba(255, 255, 255, 0.04)', thickness: 1 },
            { color: 'rgba(99, 102, 241, 0.15)', scaleFactor: 5, thickness: 0.5 }
          ]
        : [
            { color: '#cbd5e1', thickness: 1 },
            { color: '#6366f1', scaleFactor: 5, thickness: 0.5 }
          ]
    };
    
    this.paper.setGrid(gridOptions as any);
    this.paper.drawGrid();
  }

  // Comprobar si el usuario tiene privilegios de edición en este diagrama
  editable(): boolean {
    const user = this.authService.currentUser();
    if (!user) return false;

    // Admin tiene control de edición absoluto
    if (user.rol === 'ADMIN') return true;

    // Solo el creador original del diagrama con rol de diagramador puede modificarlo
    const diag = this.diagramService.diagrams().find(d => d.id === this.diagramId());
    if (!diag) return false;

    return diag.creatorId === user.id && this.authService.hasPermission('diagramador', 'editar');
  }

  // Configuración de escuchadores interactivos nativos de JointJS
  private setupPaperEventListeners() {
    

    
    // 1. Doble clic en elementos para abrir el panel de propiedades
    this.paper.on('element:pointerdblclick', (cellView: any) => {
      const cell = cellView.model;
      this.selectedCellId.set(cell.id as string);
      this.selectedCellType.set('element');
      
      const labelText = cell.attr('label/text') || '';
      this.selectedCellText.set(labelText);

      const color = cell.attr('body/fill') || '#4f46e5';
      this.selectedCellColor.set(color);
      this.selectedCustomFields.set(cell.get('customFields') || []);

      // Determinar elementType
      let elemType = cell.get('elementType');
      if (!elemType) {
        const type = cell.get('type');
        if (type === 'uml.FinalNode') {
          elemType = 'end';
        } else if (type === 'standard.Circle') {
          elemType = 'start';
        } else if (type === 'standard.Polygon') {
          elemType = 'decision';
        } else if (cell.get('isSwimlane') || labelText.includes('Calle')) {
          elemType = 'lane';
        } else if (cell.size().height <= 10 || cell.size().width <= 10) {
          elemType = 'fork';
        } else {
          elemType = 'activity';
        }
        cell.set('elementType', elemType);
      }
      this.selectedElementType.set(elemType);
    });

    // 2. Doble clic en enlaces (flechas) para configurar etiqueta o condición
    this.paper.on('link:pointerdblclick', (linkView: any) => {
      const link = linkView.model;
      this.selectedCellId.set(link.id as string);
      this.selectedCellType.set('link');
      
      // Obtener el primer label si existe
      const labels = link.labels();
      const text = labels && labels.length > 0 ? (labels[0] as any).attrs.text.text : '';
      this.selectedCellText.set(text);
      this.selectedCellColor.set(''); // Enlaces no tienen color de relleno
      this.selectedCustomFields.set([]);
      this.selectedElementType.set('link');
    });



    // 4. Conectar nodos de forma interactiva cuando la herramienta está activa
    this.paper.on('element:pointerdown', (cellView: any, evt) => {
      if (this.isConnectMode() && this.editable()) {
        const cellId = cellView.model.id as string;
        
        if (!this.firstSourceElementId) {
          // Guardar nodo origen
          this.firstSourceElementId = cellId;
        } else {
          // Unir con el nodo destino
          const sourceId = this.firstSourceElementId;
          const targetId = cellId;

          if (sourceId !== targetId) {
            const link = new joint.shapes.standard.Link({
              router: { name: 'manhattan' },
              connector: { name: 'rounded' },
              source: { id: sourceId },
              target: { id: targetId },
              labels: [{
                attrs: {
                  text: { text: '', fontSize: 13, fontWeight: '600', fill: '#ffffff', fontFamily: 'Plus Jakarta Sans, sans-serif', class: 'link-label-text' },
                  rect: { fill: '#4f46e5', stroke: '#4338ca', strokeWidth: 1, rx: 6, ry: 6, class: 'link-label-rect' }
                }
              }],
              attrs: {
                line: { stroke: '#6366f1', strokeWidth: 2, targetMarker: { 'type': 'path', 'd': 'M 10 -5 0 0 10 5 Z' } }
              }
            });
            link.addTo(this.graph);
          }

          // Resetear modo de conexión
          this.firstSourceElementId = null;
          this.isConnectMode.set(false);
        }
      }
    });

    // Clic en el fondo del papel para limpiar la selección
    this.paper.on('blank:pointerdown', () => {
      this.selectedCellId.set(null);
      this.selectedCellType.set(null);
      this.selectedCellText.set('');
      this.selectedCellColor.set('');
      this.selectedCustomFields.set([]);
      this.selectedElementType.set('');
      this.clearSelectionClass();
      this.hideLinkTools();
      this.hideElementTools();
    });

    // Colaboración: Bloqueo de celdas y Selección (puertos draw.io)
    this.paper.on('cell:pointerdown', (cellView: any, evt: any) => {
      const lock = this.collabService.activeLocks().get(cellView.model.id);
      if (lock) {
        alert(`Este elemento está bloqueado por ${lock.username}`);
        evt.stopPropagation();
        return;
      }
      
      if (cellView.model.isElement() && this.editable()) {
        this.clearSelectionClass();
        this.hideLinkTools();
        this.hideElementTools();
        cellView.el.classList.add('selected-node');
        this.showElementTools(cellView);
      } else if (cellView.model.isLink() && this.editable()) {
        this.clearSelectionClass();
        this.hideElementTools();
        this.showLinkTools(cellView);
      } else {
        this.clearSelectionClass();
        this.hideLinkTools();
        this.hideElementTools();
      }

      if (evt.button === 0 && this.editable()) {
        this.collabService.lockCell(this.diagramId(), cellView.model.id);
      }
    });

    this.paper.on('cell:pointerup', (cellView: any) => {
      if (this.editable()) {
        this.collabService.commitChange(this.diagramId(), cellView.model.id, cellView.model.toJSON());
      }
    });
  }

  private clearSelectionClass() {
    if (this.paper && (this.paper as any).el) {
      const selected = (this.paper as any).el.querySelectorAll('.selected-node');
      for (let i = 0; i < selected.length; i++) {
        selected[i].classList.remove('selected-node');
      }
    }
  }

  showElementTools(cellView: any) {
    this.hideElementTools();
    if (!this.editable()) return;

    // Aumentar padding del recuadro si es una calle
    const isLane = (cellView.model as any).get('isSwimlane') || (cellView.model as any).get('elementType') === 'lane';
    const paddingVal = isLane ? 0 : 5;

    const boundaryTool = new joint.elementTools.Boundary({
      padding: paddingVal,
      useBBox: true,
      attrs: {
        fill: 'none',
        stroke: '#6366f1',
        'stroke-width': 1.8,
        'stroke-dasharray': isLane ? '4 4' : '2 2'
      }
    });

    // Definir la subclase del Control de Redimensión en Backbone
    const ResizeTool = (joint.elementTools.Control as any).extend({
      getPosition: function(view: any) {
        const size = view.model.size();
        return { x: size.width, y: size.height };
      },
      setPosition: function(view: any, coordinates: any) {
        const isLane = view.model.get('isSwimlane') || view.model.get('elementType') === 'lane';
        const minW = isLane ? 150 : 30;
        const minH = isLane ? 60 : 30;
        const width = Math.max(minW, coordinates.x);
        const height = Math.max(minH, coordinates.y);
        view.model.resize(width, height);
      },
      children: [{
        tagName: 'circle',
        selector: 'handle',
        attributes: {
          r: 7,
          fill: '#6366f1',
          stroke: '#ffffff',
          'stroke-width': 2,
          cursor: 'nwse-resize'
        }
      }]
    });

    const resizeTool = new ResizeTool();

    const toolsView = new joint.dia.ToolsView({
      tools: [boundaryTool, resizeTool]
    });

    cellView.addTools(toolsView);
    this.activeToolsElementView = cellView;
  }

  hideElementTools() {
    if (this.activeToolsElementView) {
      try {
        this.activeToolsElementView.removeTools();
      } catch (e) {}
      this.activeToolsElementView = null;
    }
  }

  getLaneForNode(node: any) {
    const nodeBBox = node.getBBox();
    const nodeCenterX = nodeBBox.x + nodeBBox.width / 2;
    const nodeCenterY = nodeBBox.y + nodeBBox.height / 2;
    
    const lanes = this.graph.getElements().filter(cell => (cell as any).get('isSwimlane') || (cell as any).get('elementType') === 'lane');
    
    for (const lane of lanes) {
      const laneBBox = lane.getBBox();
      const insideX = nodeCenterX >= laneBBox.x && nodeCenterX <= (laneBBox.x + laneBBox.width);
      const insideY = nodeCenterY >= laneBBox.y && nodeCenterY <= (laneBBox.y + laneBBox.height);
      if (insideX && insideY) {
        return lane;
      }
    }
    return null;
  }

  showLinkTools(linkView: any) {
    this.hideLinkTools();
    if (!this.editable()) return;
    this.activeToolsLinkView = linkView;
  }

  hideLinkTools() {
    if (this.activeToolsLinkView) {
      try {
        this.activeToolsLinkView.removeTools();
      } catch (e) {}
      this.activeToolsLinkView = null;
    }
  }



  // Paneo (Arrastre de pizarra con clic derecho)
  onMouseDown(event: MouseEvent) {
    // Botón 2 representa el Clic Derecho del ratón
    if (event.button === 2) {
      this.isPanning = true;
      this.startPanX = event.clientX;
      this.startPanY = event.clientY;
      
      const currentTranslate = this.paper.translate();
      this.currentTx = currentTranslate.tx;
      this.currentTy = currentTranslate.ty;

      // Escuchar eventos globales para mover
      window.addEventListener('mousemove', this.onMouseMove);
      window.addEventListener('mouseup', this.onMouseUp);
      
      event.preventDefault();
    }
  }

  // Método de arrastre flecha para conservar el contexto `this`
  private onMouseMove = (event: MouseEvent) => {
    if (this.isPanning) {
      const dx = event.clientX - this.startPanX;
      const dy = event.clientY - this.startPanY;
      this.paper.translate(this.currentTx + dx, this.currentTy + dy);
    }
  };

  private onMouseUp = () => {
    this.isPanning = false;
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
  };

  // Zoom interactivo con Ctrl + Scroll (rueda del ratón)
  onWheel(event: WheelEvent) {
    if (event.ctrlKey) {
      event.preventDefault(); // Evitar el scroll de la pantalla completa
      const delta = event.deltaY < 0 ? 0.1 : -0.1;
      this.adjustZoom(delta);
    }
  }

  adjustZoom(delta: number) {
    const currentScale = this.zoomScale();
    // Limitar la escala entre 0.2x y 3.0x para un paneo correcto
    const newScale = Math.min(Math.max(currentScale + delta, 0.2), 3);
    this.zoomScale.set(newScale);
    this.paper.scale(newScale);
  }

  resetZoom() {
    this.zoomScale.set(1);
    this.paper.scale(1);
  }

  getZoomPercentage(): number {
    return Math.round(this.zoomScale() * 100);
  }

  toggleConnectMode() {
    if (!this.editable()) return;
    this.isConnectMode.update(v => !v);
    this.firstSourceElementId = null;
  }

  // Lógica del Output de PaletteComponent (Barra izquierda)
  onElementSelected(type: string) {
    if (!this.editable()) return;

    // Colocar el elemento en el centro visual relativo del papel
    const translate = this.paper.translate();
    const scale = this.zoomScale();
    const x = (-translate.tx + 300) / scale;
    const y = (-translate.ty + 200) / scale;

    let cell: joint.dia.Element;

    switch (type) {
      case 'start':
        // Nodo de Inicio (UML 2.5): Círculo negro/gris oscuro relleno sólido
        cell = new joint.shapes.standard.Circle({
          position: { x, y },
          size: { width: 30, height: 30 },
          attrs: {
            body: { fill: '#1e293b', stroke: '#0f172a', strokeWidth: 1.5 },
            label: { text: '', display: 'none' }
          },
          ports: getDefaultPorts()
        });
        (cell as any).set('elementType', 'start');
        break;

      case 'end':
        // Nodo de Fin (UML 2.5): Estructura bullseye (círculo con círculo interno)
        cell = new FinalNode({
          position: { x, y },
          size: { width: 30, height: 30 },
          ports: getDefaultPorts()
        });
        (cell as any).set('elementType', 'end');
        break;

      case 'activity':
        cell = new joint.shapes.standard.Rectangle({
          position: { x, y },
          size: { width: 130, height: 60 },
          attrs: {
            body: { fill: '#4f46e5', stroke: '#3730a3', strokeWidth: 2, rx: 12, ry: 12 },
            label: {
              text: 'Actividad',
              textWrap: {
                width: -20,
                height: -10,
                ellipsis: true
              },
              fill: '#ffffff',
              fontSize: 11,
              fontWeight: 'bold',
              refY: '50%',
              yAlign: 'middle'
            }
          },
          ports: getDefaultPorts()
        });
        (cell as any).set('elementType', 'activity');
        break;

      case 'decision':
        cell = new joint.shapes.standard.Polygon({
          position: { x, y },
          size: { width: 130, height: 60 },
          attrs: {
            body: {
              refPoints: '0,10 10,0 20,10 10,20',
              fill: '#fef08a',
              stroke: '#ca8a04',
              strokeWidth: 2
            },
            label: {
              text: '¿Decisión?',
              textWrap: {
                width: -40,
                height: -20,
                ellipsis: true
              },
              fill: '#1e293b',
              fontSize: 10,
              fontWeight: 'bold',
              refY: '50%',
              yAlign: 'middle'
            }
          },
          ports: getDefaultPorts()
        });
        (cell as any).set('elementType', 'decision');
        break;

      case 'fork-h':
        cell = new joint.shapes.standard.Rectangle({
          position: { x, y },
          size: { width: 140, height: 8 },
          attrs: {
            body: { fill: '#1e293b', stroke: '#475569', strokeWidth: 1 },
            label: { text: '', fill: '#ffffff' }
          },
          ports: getHorizontalForkPorts()
        });
        (cell as any).set('elementType', 'fork');
        break;

      case 'fork-v':
        cell = new joint.shapes.standard.Rectangle({
          position: { x, y },
          size: { width: 8, height: 140 },
          attrs: {
            body: { fill: '#1e293b', stroke: '#475569', strokeWidth: 1 },
            label: { text: '', fill: '#ffffff' }
          },
          ports: getVerticalForkPorts()
        });
        (cell as any).set('elementType', 'fork');
        break;

      case 'lane-h':
        cell = new joint.shapes.standard.Rectangle({
          position: { x, y },
          size: { width: 700, height: 150 },
          attrs: {
            body: { class: 'lane-body', fill: 'rgba(99, 102, 241, 0.02)', stroke: '#6366f1', strokeWidth: 2, strokeDasharray: '5 5' },
            label: { text: 'Calle Horizontal', class: 'lane-label', fill: '#6366f1', fontSize: 12, fontWeight: 'bold', refX: 15, refY: 0.5, textAnchor: 'middle', transform: 'rotate(-90)' }
          }
        });
        (cell as any).set('isSwimlane', true);
        (cell as any).set('elementType', 'lane');
        break;

      case 'lane-v':
        cell = new joint.shapes.standard.Rectangle({
          position: { x, y },
          size: { width: 220, height: 500 },
          attrs: {
            body: { class: 'lane-body', fill: 'rgba(99, 102, 241, 0.02)', stroke: '#6366f1', strokeWidth: 2, strokeDasharray: '5 5' },
            label: { text: 'Calle Vertical', class: 'lane-label', fill: '#6366f1', fontSize: 12, fontWeight: 'bold', refX: 0.5, refY: 20, textAnchor: 'middle' }
          }
        });
        (cell as any).set('isSwimlane', true);
        (cell as any).set('elementType', 'lane');
        break;

      default:
        return;
    }

    cell.addTo(this.graph);

    // Si es una calle (swimlane), enviarla al fondo para que no oculte a otros elementos
    if (type === 'lane-h' || type === 'lane-v') {
      cell.toBack();
    }
  }

  // Lógica del Output de PropertiesComponent (Barra derecha)
  onTextChanged(newText: string) {
    const id = this.selectedCellId();
    if (!id || !this.editable()) return;

    const cell = this.graph.getCell(id);
    if (!cell) return;

    if (this.selectedCellType() === 'link') {
      // Enlace: configurar etiqueta
      const link = cell as joint.shapes.standard.Link;
      link.labels([{
        attrs: {
          text: { text: newText, fontSize: 13, fontWeight: '600', fill: '#ffffff', fontFamily: 'Plus Jakarta Sans, sans-serif', class: 'link-label-text' },
          rect: { fill: '#4f46e5', stroke: '#4338ca', strokeWidth: 1, rx: 6, ry: 6, class: 'link-label-rect' }
        }
      }]);
    } else {
      // Nodo: configurar label
      cell.attr('label/text', newText);
    }
    
    this.selectedCellText.set(newText);
  }

  onColorChanged(newColor: string) {
    const id = this.selectedCellId();
    if (!id || !this.editable() || this.selectedCellType() === 'link') return;

    const cell = this.graph.getCell(id);
    if (cell) {
      cell.attr('body/fill', newColor);
      this.selectedCellColor.set(newColor);
    }
  }

  onCustomFieldsChanged(newFields: CustomField[]) {
    const id = this.selectedCellId();
    if (!id || !this.editable() || this.selectedCellType() === 'link') return;

    const cell = this.graph.getCell(id);
    if (cell) {
      (cell as any).set('customFields', newFields);
      this.selectedCustomFields.set(newFields);
    }
  }

  onDeleteRequested() {
    const id = this.selectedCellId();
    if (!id || !this.editable()) return;

    const cell = this.graph.getCell(id);
    if (cell) {
      this.clearSelectionClass();
      this.hideLinkTools();
      this.hideElementTools();
      cell.remove();
      this.selectedCellId.set(null);
      this.selectedCellType.set(null);
      this.selectedCellText.set('');
      this.selectedCellColor.set('');
      this.selectedElementType.set('');
    }
  }

  clearCanvas() {
    if (!this.editable()) return;
    this.clearSelectionClass();
    this.hideLinkTools();
    this.hideElementTools();
    this.graph.clear();
    this.selectedCellId.set(null);
  }

  buildStructuredJson(): any {
    const elements: any[] = [];
    const links: any[] = [];
    const lanes: any[] = [];

    const jointElements = this.graph.getElements() as any[];
    const jointLinks = this.graph.getLinks() as any[];

    const laneCells = jointElements.filter(cell => cell.get('isSwimlane') || cell.get('elementType') === 'lane');
    const nodeCells = jointElements.filter(cell => !cell.get('isSwimlane') && cell.get('elementType') !== 'lane');

    // 1. Mapear Calles
    laneCells.forEach(lane => {
      const type = lane.size().width > lane.size().height ? 'lane-h' : 'lane-v';
      lanes.push({
        id: lane.id,
        tipo: type,
        nombre: lane.attr('label/text') || '',
        posicion: lane.position(),
        tamano: lane.size(),
        elementosContenidos: []
      });
    });

    // Helper para buscar calle que contiene el elemento (por su bbox central de forma aritmética)
    const findLaneForNode = (node: any) => {
      const nodeBBox = node.getBBox();
      const nodeCenterX = nodeBBox.x + nodeBBox.width / 2;
      const nodeCenterY = nodeBBox.y + nodeBBox.height / 2;
      
      let matchedLaneId: string | null = null;
      
      laneCells.forEach(lane => {
        const laneBBox = lane.getBBox();
        const insideX = nodeCenterX >= laneBBox.x && nodeCenterX <= (laneBBox.x + laneBBox.width);
        const insideY = nodeCenterY >= laneBBox.y && nodeCenterY <= (laneBBox.y + laneBBox.height);
        if (insideX && insideY) {
          matchedLaneId = lane.id as string;
        }
      });
      return matchedLaneId;
    };

    // 2. Mapear Elementos
    nodeCells.forEach(node => {
      const elementType = node.get('elementType') || 'activity';
      const laneId = findLaneForNode(node);
      
      if (laneId) {
        const laneObj = lanes.find(l => l.id === laneId);
        if (laneObj) {
          laneObj.elementosContenidos.push(node.id);
        }
      }

      const formFields = (node.get('customFields') || []).map((f: any) => ({
        id: f.id,
        name: f.name,
        type: f.type,
        required: f.required || false,
        options: f.options,
        rowsCount: f.rowsCount
      }));

      elements.push({
        id: node.id,
        tipo: elementType,
        nombre: node.attr('label/text') || '',
        posicion: node.position(),
        tamano: node.size(),
        color: node.attr('body/fill') || '',
        calleId: laneId,
        formulario: formFields
      });
    });

    // 3. Mapear Enlaces
    jointLinks.forEach(link => {
      const source = link.source();
      const target = link.target();
      const labels = link.labels();
      const condition = labels && labels.length > 0 ? (labels[0] as any).attrs.text.text : '';

      links.push({
        id: link.id,
        origen: {
          elementoId: source.id,
          puertoId: source.port
        },
        destino: {
          elementoId: target.id,
          puertoId: target.port
        },
        condicion: condition,
        vertices: link.vertices() || []
      });
    });

    return {
      elementos: elements,
      enlaces: links,
      calles: lanes
    };
  }

  loadFromStructuredJson(data: any) {
    this.graph.clear();
    const cells: joint.dia.Cell[] = [];

    if (!data) return;

    // 1. Mapear calles a celdas de JointJS
    if (data.calles && Array.isArray(data.calles)) {
      data.calles.forEach((lane: any) => {
        const isHorizontal = lane.tipo === 'lane-h';
        const cell = new joint.shapes.standard.Rectangle({
          id: lane.id,
          position: lane.posicion,
          size: lane.tamano,
          attrs: {
            body: { class: 'lane-body', fill: 'rgba(99, 102, 241, 0.02)', stroke: '#6366f1', strokeWidth: 2, strokeDasharray: '5 5' },
            label: isHorizontal 
              ? { text: lane.nombre, class: 'lane-label', fill: '#6366f1', fontSize: 12, fontWeight: 'bold', refX: 15, refY: 0.5, textAnchor: 'middle', transform: 'rotate(-90)' }
              : { text: lane.nombre, class: 'lane-label', fill: '#6366f1', fontSize: 12, fontWeight: 'bold', refX: 0.5, refY: 20, textAnchor: 'middle' }
          }
        });
        (cell as any).set('isSwimlane', true);
        (cell as any).set('elementType', 'lane');
        cells.push(cell);
      });
    }

    // 2. Mapear elementos a celdas de JointJS
    if (data.elementos && Array.isArray(data.elementos)) {
      data.elementos.forEach((el: any) => {
        let cell: joint.dia.Element;
        
        const customFields = (el.formulario || []).map((f: any) => ({
          ...f,
          value: f.type === 'checkbox' ? false : (f.type === 'number' ? 0 : '')
        }));

        switch (el.tipo) {
          case 'start':
            cell = new joint.shapes.standard.Circle({
              id: el.id,
              position: el.posicion,
              size: el.tamano,
              attrs: {
                body: { fill: el.color || '#1e293b', stroke: '#0f172a', strokeWidth: 1.5 },
                label: { text: '', display: 'none' }
              },
              ports: getDefaultPorts()
            });
            break;
            
          case 'end':
            cell = new FinalNode({
              id: el.id,
              position: el.posicion,
              size: el.tamano,
              ports: getDefaultPorts()
            });
            break;
            
          case 'activity':
            cell = new joint.shapes.standard.Rectangle({
              id: el.id,
              position: el.posicion,
              size: el.tamano,
              attrs: {
                body: { fill: el.color || '#4f46e5', stroke: '#3730a3', strokeWidth: 2, rx: 12, ry: 12 },
                label: {
                  text: el.nombre,
                  textWrap: {
                    width: -20,
                    height: -10,
                    ellipsis: true
                  },
                  fill: '#ffffff',
                  fontSize: 11,
                  fontWeight: 'bold',
                  refY: '50%',
                  yAlign: 'middle'
                }
              },
              ports: getDefaultPorts()
            });
            break;
            
          case 'decision':
            cell = new joint.shapes.standard.Polygon({
              id: el.id,
              position: el.posicion,
              size: el.tamano,
              attrs: {
                body: {
                  refPoints: '0,10 10,0 20,10 10,20',
                  fill: el.color || '#fef08a',
                  stroke: '#ca8a04',
                  strokeWidth: 2
                },
                label: {
                  text: el.nombre,
                  textWrap: {
                    width: -40,
                    height: -20,
                    ellipsis: true
                  },
                  fill: '#1e293b',
                  fontSize: 10,
                  fontWeight: 'bold',
                  refY: '50%',
                  yAlign: 'middle'
                }
              },
              ports: getDefaultPorts()
            });
            break;
            
          case 'fork':
            const isHorizontal = el.tamano.width > el.tamano.height;
            cell = new joint.shapes.standard.Rectangle({
              id: el.id,
              position: el.posicion,
              size: el.tamano,
              attrs: {
                body: { fill: el.color || '#1e293b', stroke: '#475569', strokeWidth: 1 },
                label: { text: '', fill: '#ffffff' }
              },
              ports: isHorizontal ? getHorizontalForkPorts() : getVerticalForkPorts()
            });
            break;

          default:
            return;
        }
        
        (cell as any).set('elementType', el.tipo);
        (cell as any).set('customFields', customFields);
        cells.push(cell);
      });
    }

    // 3. Mapear enlaces a celdas de JointJS
    if (data.enlaces && Array.isArray(data.enlaces)) {
      data.enlaces.forEach((link: any) => {
        const cell = new joint.shapes.standard.Link({
          id: link.id,
          router: { name: 'manhattan' },
          connector: { name: 'rounded' },
          source: link.origen.puertoId 
            ? { id: link.origen.elementoId, port: link.origen.puertoId } 
            : { id: link.origen.elementoId },
          target: link.destino.puertoId 
            ? { id: link.destino.elementoId, port: link.destino.puertoId } 
            : { id: link.destino.elementoId },
          vertices: link.vertices || [],
          labels: [{
            attrs: {
              text: { text: link.condicion || '', fontSize: 13, fontWeight: '600', fill: '#ffffff', fontFamily: 'Plus Jakarta Sans, sans-serif', class: 'link-label-text' },
              rect: { fill: '#4f46e5', stroke: '#4338ca', strokeWidth: 1, rx: 6, ry: 6, class: 'link-label-rect' }
            }
          }],
          attrs: {
            line: { stroke: '#6366f1', strokeWidth: 2, targetMarker: { 'type': 'path', 'd': 'M 10 -5 0 0 10 5 Z' } }
          }
        });
        cells.push(cell);
      });
    }

    this.graph.resetCells(cells);
    
    // Si alguna calle fue creada, enviarla al fondo
    this.graph.getElements().forEach((cell: any) => {
      if (cell.get('isSwimlane')) {
        cell.toBack();
      }
    });

    // Establecer relaciones de embedding (padre/hijo) para calles y sus elementos contenidos
    this.graph.getElements().forEach((cell: any) => {
      if (cell.isElement() && !cell.get('isSwimlane')) {
        const lane = this.getLaneForNode(cell);
        if (lane) {
          lane.embed(cell);
        }
      }
    });

    // Forzar actualización diferida de las rutas de enlace una vez el DOM esté listo
    setTimeout(() => {
      this.graph.getLinks().forEach((link: any) => {
        const view = this.paper.findViewByModel(link) as any;
        if (view) {
          view.update();
        }
      });
    }, 150);
  }

  saveDiagram() {
    if (!this.editable()) return;
    const structured = this.buildStructuredJson();
    const json = JSON.stringify(structured);
    this.diagramService.saveDiagramData(this.diagramId(), json);
  }

  exportJson() {
    const structured = this.buildStructuredJson();
    const data = JSON.stringify(structured, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.diagramName().replace(/\s+/g, '_')}_diagram.json`;
    document.body.appendChild(a);
    a.click();
    
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  copyRoomCode() {
    if (typeof window !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(this.diagramId()).then(() => {
        this.copied.set(true);
        setTimeout(() => this.copied.set(false), 2000);
      });
    }
  }

  onPaperMouseMove(event: MouseEvent) {
    if (!this.paper) return;
    const localPoint = this.paper.clientToLocalPoint({
      x: event.clientX,
      y: event.clientY
    });
    this.collabService.sendCursor(this.diagramId(), localPoint.x, localPoint.y);
  }

  private applyRemoteChange(msg: any) {
    const { type, payload } = msg;

    if (type === 'COMMIT') {
      const cellId = payload.cellId || payload.id;
      const cell = this.graph.getCell(cellId);
      
      if (cell) {
        const cleanData = { ...payload };
        delete cleanData.cellId;
        delete cleanData.projectId;
        delete cleanData.userId;
        delete cleanData.username;
        delete cleanData.type;

        (cell as any).prop(cleanData, { remote: true });
      }
    } else if (type === 'ADD') {
      if (!this.graph.getCell(payload.id)) {
        this.graph.addCell(payload, { remote: true });
      }
    } else if (type === 'MOVE') {
      const cell = this.graph.getCell(payload.id) as any;
      if (cell && cell.position) {
        cell.position(payload.x, payload.y, { remote: true });
      }
    } else if (type === 'REMOVE') {
      const cell = this.graph.getCell(payload.id);
      if (cell) {
        cell.remove({ remote: true });
      }
    } else if (type === 'CLEAR') {
      this.graph.clear({ remote: true });
    }
  }
}
