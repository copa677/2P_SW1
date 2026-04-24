import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DiagramService } from './diagram.service';
import { environment } from '../../config/env';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AIService {
  private http = inject(HttpClient);
  private diagramService = inject(DiagramService);
  private apiUrl = environment.iaUrl;

  async sendPrompt(prompt: string) {
    const state = {
      cells: this.diagramService.graph.getCells().map(c => c.toJSON())
    };

    try {
      const response: any = await firstValueFrom(
        this.http.post(`${this.apiUrl}/api/v1/diagrammer/generate`, { prompt, state })
      );

      // El backend ahora envía un objeto ya parseado.
      let commands = [];
      if (Array.isArray(response.commands)) {
        commands = response.commands;
      } else if (typeof response.commands === 'string') {
        try {
          const cleanJson = response.commands.replace(/```json|```/g, '').trim();
          commands = JSON.parse(cleanJson);
        } catch (e) {
          console.error('Error parseando comandos de IA (String):', e);
          return { error: 'La IA devolvió un formato de texto inválido' };
        }
      } else {
        console.error('Formato de comandos inesperado:', response.commands);
        return { error: 'Formato de respuesta desconocido' };
      }

      await this.executeCommands(commands);
      return { success: true, count: commands.length };
    } catch (error) {
      console.error('Error llamando a la IA:', error);
      throw error;
    }
  }

  private async executeCommands(commands: any[]) {
    for (const cmd of commands) {
      switch (cmd.action) {
        case 'CREATE_LANE': {
          const laneName = cmd.orientation ? `${cmd.name}-${cmd.orientation}` : cmd.name;
          this.diagramService.addElement('swimlane', cmd.x || 100, cmd.y || 100, laneName, cmd.width, cmd.height);
          break;
        }

        case 'CREATE_NODE':
          const newNode = this.diagramService.addElement(cmd.type, cmd.x, cmd.y, cmd.name);
          
          // Vincular a carril si se especifica
          if (newNode && cmd.laneId) {
            // Buscamos el carril por nombre
            const lane = this.diagramService.graph.getElements().find(el => 
              el.get('isSwimlane') && el.attr('label/text') === cmd.laneId
            );
            if (lane) {
              lane.embed(newNode);
            }
          }
          break;

        case 'CONNECT': {
          // La IA suele enviar IDs o nombres. Intentamos buscar por ambos.
          const source = this.findCell(cmd.from);
          const target = this.findCell(cmd.to);
          if (source && target) {
            this.diagramService.addLink(source.id.toString(), target.id.toString(), cmd.label);
          }
          break;
        }

        case 'MOVE': {
          const cell = this.findCell(cmd.id);
          if (cell && (cell as any).position) (cell as any).position(cmd.x, cmd.y);
          break;
        }

        case 'UPDATE_PROP': {
          const target = this.findCell(cmd.id);
          if (target && cmd.props) {
            const p = cmd.props;
            if (p.name) target.attr('label/text', p.name);
            if (p.fill) target.attr('body/fill', p.fill);
            if (p.stroke) target.attr('body/stroke', p.stroke);
            if (p.strokeWidth) target.attr('body/strokeWidth', p.strokeWidth);
            if (p.textColor) target.attr('label/fill', p.textColor);
            if (p.fontSize) target.attr('label/fontSize', p.fontSize);
          }
          break;
        }

        case 'DELETE':
          const toDelete = this.findCell(cmd.id);
          if (toDelete) toDelete.remove();
          break;
      }
      // Pequeño delay para ver la magia ocurrir secuencialmente
      await new Promise(r => setTimeout(r, 200));
    }
  }

  // Utilidad para buscar celdas por ID o por Nombre (Label)
  private findCell(identifier: string) {
    return this.diagramService.graph.getCells().find(c => 
      c.id === identifier || c.attr('label/text') === identifier
    );
  }
}
