import { Injectable, signal, NgZone, inject } from '@angular/core';
import { Subject } from 'rxjs';
import * as joint from 'jointjs';
import { CollaborationService } from '../../services/collaboration.service';
import { UMLShapes, createUMLTools, createLinkTools, portConfig } from '../elements/uml-shapes';

@Injectable({
  providedIn: 'root'
})
export class DiagramService {
  private zone = inject(NgZone);
  public collabService = inject(CollaborationService);
  
  public graph = new joint.dia.Graph({}, { 
    cellNamespace: { ...joint.shapes, ...UMLShapes } 
  });
  
  public paper!: joint.dia.Paper;
  public selectedCell = signal<joint.dia.Cell | null>(null);
  public showProperties = signal<boolean>(false);
  public currentProjectId: string | null = null;

  // Eventos para colaboración
  public graphChange$ = new Subject<{ type: 'ADD' | 'REMOVE' | 'UPDATE' | 'MOVE' | 'CLEAR' | 'COMMIT', cell: any }>();

  constructor() {
    this.graph.on('add', (cell, collection, opt) => {
      if (!opt.remote) {
        this.graphChange$.next({ type: 'ADD', cell: cell.toJSON() });
      }
    });

    this.graph.on('remove', (cell, collection, opt) => {
      if (!opt.remote) {
        // Para eliminación, solo necesitamos el ID. Es más seguro que toJSON() en un objeto ya eliminado.
        this.graphChange$.next({ type: 'REMOVE', cell: { id: cell.id } });
      }
    });
  }

  public selectCell(cell: joint.dia.Cell | null) {
    this.zone.run(() => {
      const prev = this.selectedCell();
      if (prev && prev.findView(this.paper)) {
        prev.findView(this.paper).removeTools();
      }

      this.selectedCell.set(cell);

      if (cell && cell.findView(this.paper)) {
        const view = cell.findView(this.paper);
        if (cell.isLink()) {
          view.addTools(createLinkTools());
        } else {
          view.addTools(createUMLTools());
        }
      }
    });
  }

  public openProperties() {
    if (this.selectedCell()) {
      this.showProperties.set(true);
    }
  }

  public closeProperties() {
    const cell = this.selectedCell();
    if (cell && this.showProperties()) {
      // Al cerrar, enviamos el estado final (COMMIT) para sincronizar texto/atributos
      this.graphChange$.next({ type: 'COMMIT', cell: cell.toJSON() });
    }
    this.showProperties.set(false);
  }

  public exportJSON(): any {
    return this.graph.toJSON();
  }

  public importJSON(data: any) {
    this.zone.run(() => {
      this.graph.fromJSON(data);
      if (this.paper) {
        // Resetear vista para que el nuevo diagrama sea visible
        this.paper.scale(1, 1);
        this.paper.translate(0, 0);
        // Disparar un evento personalizado para que el CanvasComponent actualice su escala local
        this.paper.trigger('view:reset');
      }
    });
  }

  public addElement(type: string, x: number, y: number, name?: string, width?: number, height?: number) {
    let element: joint.dia.Element;

    const commonProps = {
        position: { x, y },
        ports: portConfig
    };

    switch (type) {
      case 'text':
        element = new joint.shapes.standard.Rectangle();
        element.position(x, y); // Asignar posición del mouse
        element.resize(100, 40);
        element.attr({
          body: { fill: 'transparent', stroke: 'none' },
          label: { text: 'Nuevo Texto', fill: '#1e293b', fontSize: 16 }
        });
        // No añadimos puertos para el texto
        break;
      case 'activity':
        element = new joint.shapes.standard.Rectangle({
          ...commonProps,
          size: { width: 150, height: 60 },
          attrs: {
            body: { fill: '#ffffff', stroke: '#3b82f6', strokeWidth: 2, rx: 10, ry: 10 },
            label: { text: name || 'Actividad', fill: '#1e293b' }
          }
        });
        break;
      case 'decision':
        element = new joint.shapes.standard.Polygon({
          ...commonProps,
          size: { width: 60, height: 60 },
          attrs: {
            body: { 
              refPoints: '0,10 10,0 20,10 10,20',
              fill: '#ffffff', stroke: '#f59e0b', strokeWidth: 2 
            },
            label: { text: name || '¿?', fill: '#1e293b' }
          }
        });
        break;
      case 'initial':
        element = new joint.shapes.standard.Circle({
          ...commonProps,
          size: { width: 30, height: 30 },
          attrs: {
            body: { fill: '#1e293b', stroke: 'none' }
          }
        });
        break;
      case 'final':
        element = new UMLShapes.uml.FinalNode({
            ...commonProps,
            size: { width: 30, height: 30 }
        });
        break;
      case 'fork':
      case 'join':
        const isFork = type === 'fork';
        element = new UMLShapes.uml.ForkJoinNode({
          ...commonProps,
          size: isFork ? { width: 120, height: 8 } : { width: 8, height: 120 },
          ports: {
            groups: portConfig.groups,
            items: [
              { id: 'p1', group: 'ports', args: isFork ? { x: '10%', y: '50%' } : { x: '50%', y: '10%' } },
              { id: 'p2', group: 'ports', args: isFork ? { x: '30%', y: '50%' } : { x: '50%', y: '30%' } },
              { id: 'p3', group: 'ports', args: isFork ? { x: '50%', y: '50%' } : { x: '50%', y: '50%' } },
              { id: 'p4', group: 'ports', args: isFork ? { x: '70%', y: '50%' } : { x: '50%', y: '70%' } },
              { id: 'p5', group: 'ports', args: isFork ? { x: '90%', y: '50%' } : { x: '50%', y: '90%' } }
            ]
          }
        });
        break;
      case 'swimlane':
      case 'swimlane-vertical':
      case 'swimlane-horizontal': {
        const isVertical = type === 'swimlane-vertical' || (name?.includes('vertical')) || (width && width < (height || 0));
        
        element = new joint.shapes.standard.Rectangle({
          position: { x, y },
          size: { 
            width: width || (isVertical ? 200 : 800), 
            height: height || (isVertical ? 800 : 200) 
          },
          attrs: {
            body: { fill: '#f8fafc', stroke: '#cbd5e1', strokeWidth: 2, strokeDasharray: '5,5' },
            label: { 
              text: name?.replace('-vertical', '').replace('-horizontal', '') || (isVertical ? 'Carril Vert.' : 'Carril Horiz.'), 
              fill: '#64748b', fontSize: 14, fontWeight: 'bold',
              // Posicionamiento dinámico
              ...(isVertical ? {
                refY: 10,
                textVerticalAnchor: 'top',
                textAnchor: 'middle',
                refX: '50%'
              } : {
                refX: 15,
                refY: '50%',
                textVerticalAnchor: 'middle',
                textAnchor: 'middle',
                transform: 'rotate(-90)' // Usamos transform para evitar conflictos de tipos
              })
            }
          }
        });
        element.set('isSwimlane', true);
        element.set('z', -1);
        break;
      }
      default:
        return;
    }

    element.addTo(this.graph);
    return element;
  }

  public addLink(sourceId: string, targetId: string, label: string = '') {
    const link = new joint.shapes.standard.Link({
      source: { id: sourceId },
      target: { id: targetId },
      attrs: {
        line: { stroke: '#64748b', strokeWidth: 2, targetMarker: { 'type': 'path', 'd': 'M 10 -5 0 0 10 5 Z' } }
      }
    });

    if (label) {
      link.appendLabel({
        attrs: {
          text: { text: label, fill: '#1e293b', fontSize: 12 }
        }
      });
    }

    link.addTo(this.graph);
    return link;
  }
}
