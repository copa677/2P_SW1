import { Component, ElementRef, OnInit, AfterViewInit, ViewChild, inject, signal, computed, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import * as joint from 'jointjs';
import { ProcessExecutionService, TaskInstance, ProcessInstance } from '../../core/services/process-execution.service';
import { DiagramService } from '../../core/services/diagram.service';
import { AuthService } from '../../core/services/auth.service';
import { UserService } from '../../core/services/user.service';
import { FinalNode } from '../diagrammer/components/uml-shapes';

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
  protected readonly authService = inject(AuthService);
  protected readonly userService = inject(UserService);

  @ViewChild('paperHolder') paperHolder!: ElementRef;

  // JointJS instances
  graph!: joint.dia.Graph;
  paper!: joint.dia.Paper;

  // Signals para estados
  readonly mode = signal<'execute' | 'track'>('track');
  readonly activeTask = signal<TaskInstance | null>(null);
  readonly allTasks = signal<TaskInstance[]>([]);
  readonly history = signal<any[]>([]);

  // Alias para mantener compatibilidad con HTML existente
  readonly task = computed(() => this.activeTask());

  readonly processInstance = signal<ProcessInstance | null>(null);
  readonly loading = signal<boolean>(true);
  readonly submitting = signal<boolean>(false);

  // Definición del formulario del nodo actual
  readonly formFields = signal<any[]>([]);
  readonly formData = signal<Record<string, any>>({});
  readonly decisionOptions = signal<string[]>([]); // Para decisiones de JointJS auto-detectadas

  readonly statusMessage = signal<string>('');
  readonly statusType = signal<'success' | 'error' | ''>('');

  ngOnInit() {
    this.userService.loadUsers().subscribe();
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

    // Escuchar parámetros de ruta
    this.route.paramMap.subscribe(params => {
      const taskId = params.get('taskId');
      const instanceId = params.get('instanceId');

      if (taskId) {
        this.loading.set(true);
        this.processExecService.getTaskById(taskId).subscribe({
          next: (t) => {
            this.loadProcessAndDiagramDetails(t.processInstanceId, t.id);
          },
          error: (err) => {
            console.error('Error al cargar la tarea', err);
            this.router.navigate(['/mis-tareas']);
          }
        });
      } else if (instanceId) {
        this.loadProcessAndDiagramDetails(instanceId);
      } else {
        this.router.navigate(['/mis-tareas']);
      }
    });
  }

  ngOnDestroy() {
    if (this.paper) {
      (this.paper as any).remove();
    }
  }

  loadProcessAndDiagramDetails(instanceId: string, directTaskId?: string) {
    this.loading.set(true);
    this.processExecService.getProcessById(instanceId).subscribe({
      next: (proc) => {
        this.processInstance.set(proc);

        // Cargar los proyectos
        this.diagramService.loadProjects().subscribe(() => {
          const project = this.diagramService.diagrams().find(d => d.id === proc.projectId);
          if (project) {
            try {
              const parsed = JSON.parse(project.data);
              this.loadFromStructuredJson(parsed);

              // Cargar todas las tareas del proceso
              this.processExecService.getTasksByProcess(instanceId).subscribe({
                next: (tasks) => {
                  this.allTasks.set(tasks);

                  // Cargar historial
                  this.processExecService.getProcessHistory(instanceId).subscribe({
                    next: (hist) => {
                      this.history.set(hist);

                      const currentUser = this.authService.currentUser();
                      
                      // Buscar una tarea pendiente para este usuario
                      let targetTask: TaskInstance | undefined;
                      if (directTaskId) {
                        targetTask = tasks.find(t => t.id === directTaskId && t.status === 'PENDING' && t.assignedUserId === currentUser?.id);
                      }
                      if (!targetTask) {
                        targetTask = tasks.find(t => t.status === 'PENDING' && t.assignedUserId === currentUser?.id);
                      }

                      if (targetTask) {
                        this.activeTask.set(targetTask);
                        this.mode.set('execute');

                        const nodeData = parsed.elementos?.find((el: any) => el.id === targetTask!.nodeId);
                        if (nodeData) {
                          if (nodeData.tipo === 'decision') {
                            // Encontrar opciones de decisión de enlaces salientes
                            const outgoing = parsed.enlaces?.filter((l: any) => l.origen.elementoId === targetTask!.nodeId) || [];
                            const opts = outgoing.map((l: any) => l.condicion || '').filter((c: string) => c !== '');
                            this.decisionOptions.set(opts.length > 0 ? opts : ['Siguiente']);
                            this.formFields.set([]);
                          } else {
                            this.decisionOptions.set([]);
                            this.formFields.set(nodeData.formulario || []);

                            // Inicializar variables del formulario
                            const defaults: Record<string, any> = {};
                            (nodeData.formulario || []).forEach((f: any) => {
                              defaults[f.name] = f.type === 'checkbox' ? false : (f.type === 'number' ? null : '');
                            });
                            this.formData.set(defaults);
                          }
                        }
                        this.highlightActiveNode(targetTask.nodeId);
                      } else {
                        // Modo Seguimiento
                        this.activeTask.set(null);
                        this.mode.set('track');

                        // Resaltar el nodo de la tarea pendiente actual de otro usuario
                        const otherPending = tasks.find(t => t.status === 'PENDING');
                        if (otherPending) {
                          this.highlightActiveNode(otherPending.nodeId);
                        } else if (proc.status === 'COMPLETED') {
                          // Si se completó, buscar nodo final
                          const endNode = parsed.elementos?.find((el: any) => el.tipo === 'end');
                          if (endNode) {
                            this.highlightActiveNode(endNode.id);
                          }
                        }
                      }
                      this.loading.set(false);
                    },
                    error: (err) => {
                      console.error('Error al cargar historial', err);
                      this.loading.set(false);
                    }
                  });
                },
                error: (err) => {
                  console.error('Error al cargar tareas del proceso', err);
                  this.loading.set(false);
                }
              });
            } catch (e) {
              console.error('Error al renderizar diagrama', e);
              this.loading.set(false);
            }
          } else {
            this.loading.set(false);
          }
        });
      },
      error: (err) => {
        console.error('Error al cargar proceso', err);
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
          source: link.origen.puertoId
            ? { id: link.origen.elementoId, port: link.origen.puertoId }
            : { id: link.origen.elementoId },
          target: link.destino.puertoId
            ? { id: link.destino.elementoId, port: link.destino.puertoId }
            : { id: link.destino.elementoId },
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

    // Forzar actualización diferida de rutas de enlace y escala en el DOM
    setTimeout(() => {
      this.graph.getLinks().forEach((link: any) => {
        const view = this.paper.findViewByModel(link) as any;
        if (view) {
          view.update();
        }
      });
      this.paper.scaleContentToFit({ padding: 20 });
    }, 150);
  }

  highlightActiveNode(nodeId: string) {
    // Limpiar cualquier resaltado anterior
    this.graph.getElements().forEach((el: any) => {
      if (el.attr('body/class') === 'active-workflow-node') {
        el.attr('body/class', '');
        el.attr('body/strokeWidth', '1.5px');
        if (el.get('elementType') === 'activity') {
          el.attr('body/stroke', '#3730a3');
        } else if (el.get('elementType') === 'decision') {
          el.attr('body/stroke', '#ca8a04');
        }
      }
    });

    const cell = this.graph.getCell(nodeId);
    if (cell) {
      cell.attr('body/class', 'active-workflow-node');
      cell.attr('body/stroke', '#10b981');
      cell.attr('body/strokeWidth', '3.5px');
    }
  }

  getUserName(userId: string): string {
    if (!userId) return 'Iniciador del Flujo';
    const u = this.userService.users().find(user => user.id === userId);
    return u ? `${u.nombres} ${u.apellidos}` : 'Usuario del Sistema';
  }

  getPendingTaskAssigneeName(): string {
    const pending = this.allTasks().find(t => t.status === 'PENDING');
    if (!pending) return 'Nadie';
    if (!pending.assignedUserId) return 'Iniciador (Cliente)';
    return this.getUserName(pending.assignedUserId);
  }

  getPendingTaskLaneName(): string {
    const pending = this.allTasks().find(t => t.status === 'PENDING');
    if (!pending) return 'N/A';
    const proc = this.processInstance();
    const project = this.diagramService.diagrams().find(d => d.id === proc?.projectId);
    if (project && pending.calleId) {
      try {
        const parsed = JSON.parse(project.data);
        const lane = parsed.calles?.find((c: any) => c.id === pending.calleId);
        if (lane) return lane.nombre;
      } catch {}
    }
    return 'Calle';
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

  submitTask(decisionValue?: string) {
    const isDecision = this.decisionOptions().length > 0;
    const t = this.activeTask();
    const proc = this.processInstance();
    if (!t || !proc) return;

    if (!isDecision && !this.isFormValid()) {
      this.statusMessage.set('Por favor complete todos los campos obligatorios (*)');
      this.statusType.set('error');
      return;
    }

    this.submitting.set(true);
    this.statusMessage.set('');
    this.statusType.set('');

    const payload: Record<string, any> = {
      taskId: t.id
    };

    if (isDecision && decisionValue) {
      // Mandamos la respuesta de la decisión
      payload['decision'] = decisionValue;
    } else {
      Object.assign(payload, this.formData());
    }

    this.processExecService.advanceProcess(proc.id, payload).subscribe({
      next: () => {
        this.submitting.set(false);
        this.statusMessage.set('Tarea completada con éxito.');
        this.statusType.set('success');

        // Recargar el estado en caliente en 800ms
        setTimeout(() => {
          this.statusMessage.set('');
          this.statusType.set('');
          this.loadProcessAndDiagramDetails(proc.id);
        }, 800);
      },
      error: (err) => {
        this.submitting.set(false);
        this.statusMessage.set('Ocurrió un error al procesar la tarea. Inténtelo de nuevo.');
        this.statusType.set('error');
        console.error(err);
      }
    });
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString();
    } catch {
      return dateStr;
    }
  }

  getSubmittedDataKeys(submittedData: Record<string, any>): string[] {
    if (!submittedData) return [];
    return Object.keys(submittedData).filter(k => k !== 'taskId');
  }
}
