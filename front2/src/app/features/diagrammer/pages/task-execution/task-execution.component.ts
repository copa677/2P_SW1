import { Component, ElementRef, OnInit, AfterViewInit, ViewChild, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import * as joint from 'jointjs';
import { ProcessExecutionService, TaskInstance, ProcessInstance } from '../../../../core/services/process-execution.service';
import { DiagramService } from '../../../../core/services/diagram.service';
import { FinalNode } from '../../components/uml-shapes';

function getDefaultPorts() {
  return {
    groups: {
      'top': { position: 'top', attrs: { circle: { r: 5, fill: '#6366f1', stroke: '#ffffff', 'stroke-width': 1.5, magnet: true } } },
      'bottom': { position: 'bottom', attrs: { circle: { r: 5, fill: '#6366f1', stroke: '#ffffff', 'stroke-width': 1.5, magnet: true } } },
      'left': { position: 'left', attrs: { circle: { r: 5, fill: '#6366f1', stroke: '#ffffff', 'stroke-width': 1.5, magnet: true } } },
      'right': { position: 'right', attrs: { circle: { r: 5, fill: '#6366f1', stroke: '#ffffff', 'stroke-width': 1.5, magnet: true } } }
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
        attrs: { circle: { r: 5, fill: '#6366f1', stroke: '#ffffff', 'stroke-width': 1.5, magnet: true } }
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
        attrs: { circle: { r: 5, fill: '#6366f1', stroke: '#ffffff', 'stroke-width': 1.5, magnet: true } }
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
  selector: 'app-task-execution',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './task-execution.component.html'
})
export class TaskExecutionComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly processExecService = inject(ProcessExecutionService);
  protected readonly diagramService = inject(DiagramService);

  @ViewChild('paperHolder') paperHolder!: ElementRef;

  // JointJS instances
  graph!: joint.dia.Graph;
  paper!: joint.dia.Paper;

  // Signals para estados
  readonly task = signal<TaskInstance | null>(null);
  readonly processInstance = signal<ProcessInstance | null>(null);
  readonly loading = signal<boolean>(true);
  readonly submitting = signal<boolean>(false);
  
  // Definición del formulario del nodo actual
  readonly formFields = signal<any[]>([]);
  // Valores ingresados en el formulario
  readonly formData = signal<Record<string, any>>({});

  readonly statusMessage = signal<string>('');
  readonly statusType = signal<'success' | 'error' | ''>('');

  ngOnInit() {
    this.diagramService.loadProjects().subscribe();
  }

  ngAfterViewInit() {
    const customNamespace = {
      ...joint.shapes,
      uml: {
        FinalNode
      }
    };

    // Inicializar JointJS Graph y Paper en modo solo lectura
    this.graph = new joint.dia.Graph({}, { cellNamespace: customNamespace });
    this.paper = new joint.dia.Paper({
      el: this.paperHolder.nativeElement,
      model: this.graph,
      cellViewNamespace: customNamespace,
      width: '100%',
      height: 450,
      gridSize: 10,
      drawGrid: { name: 'dot', args: { color: '#e2e8f0', thickness: 1 } },
      background: { color: 'transparent' },
      interactive: false // Modo solo lectura
    });

    // Cargar los datos de la tarea
    const taskId = this.route.snapshot.paramMap.get('taskId');
    if (taskId) {
      this.loadTaskDetails(taskId);
    } else {
      this.router.navigate(['/mis-tareas']);
    }
  }

  ngOnDestroy() {
    if (this.paper) {
      (this.paper as any).remove();
    }
  }

  loadTaskDetails(taskId: string) {
    this.loading.set(true);
    this.processExecService.getTaskById(taskId).subscribe({
      next: (t) => {
        this.task.set(t);
        this.loadProcessAndDiagram(t);
      },
      error: (err) => {
        console.error('Error al cargar la tarea', err);
        this.loading.set(false);
        this.router.navigate(['/mis-tareas']);
      }
    });
  }

  loadProcessAndDiagram(t: TaskInstance) {
    this.processExecService.getProcessById(t.processInstanceId).subscribe({
      next: (proc) => {
        this.processInstance.set(proc);
        
        // Cargar y parsear el diagrama
        const project = this.diagramService.diagrams().find(d => d.id === t.projectId);
        if (project) {
          try {
            const parsed = JSON.parse(project.data);
            this.loadFromStructuredJson(parsed);
            
            // Resaltar el nodo activo
            this.highlightActiveNode(t.nodeId);

            // Cargar definición de campos de formulario de este nodo
            const nodeData = parsed.elementos?.find((el: any) => el.id === t.nodeId);
            if (nodeData && nodeData.formulario) {
              this.formFields.set(nodeData.formulario);
              
              // Inicializar valores por defecto en formData
              const defaults: Record<string, any> = {};
              nodeData.formulario.forEach((f: any) => {
                defaults[f.name] = f.type === 'checkbox' ? false : (f.type === 'number' ? null : '');
              });
              this.formData.set(defaults);
            }
          } catch (e) {
            console.error('Error al renderizar el diagrama', e);
          }
        }
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error al cargar el proceso', err);
        this.loading.set(false);
      }
    });
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
            body: { class: 'lane-body', fill: 'rgba(99, 102, 241, 0.01)', stroke: '#6366f1', strokeWidth: 2, strokeDasharray: '5 5' },
            label: isHorizontal 
              ? { text: lane.nombre, class: 'lane-label', fill: '#6366f1', fontSize: 12, fontWeight: 'bold', refX: 15, refY: 0.5, textAnchor: 'middle', transform: 'rotate(-90)' }
              : { text: lane.nombre, class: 'lane-label', fill: '#6366f1', fontSize: 12, fontWeight: 'bold', refX: 0.5, refY: 15, textAnchor: 'middle' }
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
        
        switch (el.tipo) {
          case 'start':
            cell = new joint.shapes.standard.Circle({
              id: el.id,
              position: el.posicion,
              size: el.tamano,
              attrs: {
                body: { fill: '#1e293b', stroke: '#0f172a', strokeWidth: 1.5 },
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
                body: { fill: '#4f46e5', stroke: '#3730a3', strokeWidth: 1.5, rx: 8, ry: 8 },
                label: {
                  text: el.nombre,
                  textWrap: {
                    width: -20,
                    height: -10,
                    ellipsis: true
                  },
                  fill: '#ffffff',
                  fontSize: 10,
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
                  fill: '#fef08a',
                  stroke: '#ca8a04',
                  strokeWidth: 1.5
                },
                label: {
                  text: el.nombre,
                  textWrap: {
                    width: -40,
                    height: -20,
                    ellipsis: true
                  },
                  fill: '#1e293b',
                  fontSize: 9,
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
                body: { fill: '#1e293b', stroke: '#475569', strokeWidth: 1 },
                label: { text: '', fill: '#ffffff' }
              },
              ports: isHorizontal ? getHorizontalForkPorts() : getVerticalForkPorts()
            });
            break;

          default:
            return;
        }
        
        (cell as any).set('elementType', el.tipo);
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
          source: { id: link.origen.elementoId, port: link.origen.puertoId },
          target: { id: link.destino.elementoId, port: link.destino.puertoId },
          vertices: link.vertices || [],
          labels: [{
            attrs: {
              text: { text: link.condicion || '', fontSize: 11, fontWeight: '600', fill: '#ffffff', fontFamily: 'Plus Jakarta Sans, sans-serif', class: 'link-label-text' },
              rect: { fill: '#4f46e5', stroke: '#4338ca', strokeWidth: 1, rx: 4, ry: 4, class: 'link-label-rect' }
            }
          }],
          attrs: {
            line: { stroke: '#6366f1', strokeWidth: 1.5, targetMarker: { 'type': 'path', 'd': 'M 8 -4 0 0 8 4 Z' } }
          }
        });
        cells.push(cell);
      });
    }

    this.graph.resetCells(cells);
    
    // Mandar calles al fondo
    this.graph.getElements().forEach((cell: any) => {
      if (cell.get('isSwimlane')) {
        cell.toBack();
      }
    });

    // Ajustar el zoom para que se adapte al tamaño del papel
    this.paper.scaleContentToFit({ padding: 20 });
  }

  highlightActiveNode(nodeId: string) {
    const cell = this.graph.getCell(nodeId);
    if (cell) {
      cell.attr('body/class', 'active-workflow-node');
      cell.attr('body/stroke', '#10b981');
      cell.attr('body/strokeWidth', '3.5px');
    }
  }

  isFormValid(): boolean {
    const fields = this.formFields();
    const data = this.formData();
    for (const f of fields) {
      if (f.required) {
        const val = data[f.name];
        if (val === undefined || val === null || val === '') {
          return false;
        }
      }
    }
    return true;
  }

  submitTask() {
    if (!this.isFormValid()) {
      this.statusMessage.set('Por favor complete todos los campos obligatorios (*)');
      this.statusType.set('error');
      return;
    }

    const t = this.task();
    if (!t) return;

    this.submitting.set(true);
    this.statusMessage.set('');
    this.statusType.set('');

    const payload = {
      taskId: t.id,
      ...this.formData()
    };

    this.processExecService.advanceProcess(t.processInstanceId, payload).subscribe({
      next: () => {
        this.submitting.set(false);
        this.statusMessage.set('Tarea completada con éxito. Avanzando al siguiente paso...');
        this.statusType.set('success');
        
        setTimeout(() => {
          this.router.navigate(['/mis-tareas']);
        }, 1500);
      },
      error: (err) => {
        this.submitting.set(false);
        this.statusMessage.set('Ocurrió un error al procesar la tarea. Inténtelo de nuevo.');
        this.statusType.set('error');
        console.error(err);
      }
    });
  }
}
