import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DiagramService } from '../../services/diagram.service';

@Component({
  selector: 'app-properties',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './properties.component.html',
  styleUrl: './properties.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PropertiesComponent {
  public diagramService = inject(DiagramService);

  public colors = [
    '#ffffff', // Blanco
    '#f8fafc', // Slate 50
    '#fee2e2', // Rojo claro
    '#fef3c7', // Ambar claro
    '#ecfdf5', // Esmeralda claro
    '#eff6ff', // Azul claro
    '#f5f3ff', // Violeta claro
    '#fae8ff', // Fucsia claro
    '#fff1f2', // Rosa claro
    '#e2e8f0'  // Slate 200
  ];

  getActionType(): string {
    const cell = this.diagramService.selectedCell();
    return cell?.get('actionType') || 'none';
  }

  onActionTypeChange(type: string) {
    const cell = this.diagramService.selectedCell();
    if (cell) {
      cell.set('actionType', type);
      this.updateVisualFeedback(cell, type);
    }
  }

  private updateVisualFeedback(cell: any, type: string) {
    if (cell.isLink()) return;

    let stroke = '#3b82f6'; // Default
    let labelSuffix = '';

    switch (type) {
      case 'form':
        stroke = '#10b981'; // Esmeralda
        labelSuffix = ' [FORM]';
        break;
      case 'signature':
        stroke = '#4f46e5'; // Indigo
        labelSuffix = ' [FIRMA]';
        break;
      case 'sello':
        stroke = '#f59e0b'; // Ámbar
        labelSuffix = ' [SELLO]';
        break;
    }

    cell.attr('body/stroke', stroke);
    cell.attr('body/strokeWidth', type === 'none' ? 2 : 4);
  }

  onLabelChange(newLabel: string) {
    const cell = this.diagramService.selectedCell();
    if (cell) {
      cell.attr('label/text', newLabel);
    }
  }

  onColorChange(newColor: string) {
    const cell = this.diagramService.selectedCell();
    if (cell) {
      if (cell.get('isSwimlane')) {
        cell.attr('body/fill', newColor);
      } else {
        cell.attr('body/fill', newColor);
      }
    }
  }

  // --- Gestión de Formulario Dinámico ---

  getFormFields(): any[] {
    const cell = this.diagramService.selectedCell();
    if (!cell) return [];
    if (!cell.get('formFields')) {
      cell.set('formFields', []);
    }
    return cell.get('formFields');
  }

  addFormField() {
    const cell = this.diagramService.selectedCell();
    if (cell) {
      const fields = [...this.getFormFields()];
      fields.push({
        label: 'Nuevo Campo',
        type: 'text',
        required: false
      });
      cell.set('formFields', fields);
    }
  }

  removeFormField(index: number) {
    const cell = this.diagramService.selectedCell();
    if (cell) {
      const fields = [...this.getFormFields()];
      fields.splice(index, 1);
      cell.set('formFields', fields);
    }
  }

  onFieldChange() {
    const cell = this.diagramService.selectedCell();
    if (cell) {
      // Forzar actualización del modelo para asegurar que el JSON se genere con datos frescos
      const fields = [...this.getFormFields()];
      cell.set('formFields', fields);
    }
  }

  deleteElement() {
    const cell = this.diagramService.selectedCell();
    if (cell && confirm('¿Eliminar este elemento?')) {
      cell.remove();
      this.diagramService.closeProperties();
    }
  }
}