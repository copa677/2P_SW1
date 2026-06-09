import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface CustomField {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'checkbox' | 'select' | 'file' | 'table' | 'label' | 'list';
  value: any;
  required?: boolean;
  options?: string;
  fileName?: string;
  rowsCount?: number;
}

@Component({
  selector: 'app-properties',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './properties.component.html'
})
export class PropertiesComponent {
  // Inputs basados en Signals de Angular 20
  readonly cellId = input<string | null>(null);
  readonly cellType = input<'element' | 'link' | null>(null);
  readonly cellText = input<string>('');
  readonly cellColor = input<string>('');
  readonly editable = input<boolean>(true);
  readonly customFields = input<CustomField[]>([]);
  readonly elementType = input<string>('');

  // Outputs basados en Signals de Angular 20
  readonly textChanged = output<string>();
  readonly colorChanged = output<string>();
  readonly deleteRequested = output<void>();
  readonly customFieldsChanged = output<CustomField[]>();

  // Paleta de colores empresariales HSL
  readonly colorPalette = [
    { name: 'Índigo', value: '#4f46e5' },
    { name: 'Teal', value: '#0d9488' },
    { name: 'Esmeralda', value: '#10b981' },
    { name: 'Amarillo', value: '#fef08a' },
    { name: 'Rose', value: '#f43f5e' },
    { name: 'Azul', value: '#2563eb' },
    { name: 'Naranja', value: '#f97316' },
    { name: 'Gris', value: '#64748b' }
  ];

  // Creador de campos dinámicos
  newFieldName = '';
  newFieldType: 'text' | 'number' | 'date' | 'checkbox' | 'select' | 'file' | 'table' | 'label' | 'list' = 'text';
  newFieldOptions = '';
  newFieldRowsCount = 1;
  newFieldRequired = false;

  addField() {
    if (!this.newFieldName.trim()) return;

    let defaultValue: any = '';
    if (this.newFieldType === 'checkbox') {
      defaultValue = false;
    } else if (this.newFieldType === 'number') {
      defaultValue = 0;
    } else if (this.newFieldType === 'list') {
      defaultValue = '[]';
    } else if (this.newFieldType === 'table') {
      const cols = this.newFieldOptions.split(',').map(c => c.trim()).filter(c => c.length > 0);
      const rows = [];
      const rowsNum = this.newFieldRowsCount || 1;
      for (let i = 0; i < rowsNum; i++) {
        const row: Record<string, string> = {};
        cols.forEach(c => {
          row[c] = '';
        });
        rows.push(row);
      }
      defaultValue = JSON.stringify(rows);
    } else if (this.newFieldType === 'label') {
      defaultValue = this.newFieldOptions.trim() || 'Texto Informativo';
    }

    const newField: CustomField = {
      id: 'field_' + Math.random().toString(36).substring(2, 9),
      name: this.newFieldName.trim(),
      type: this.newFieldType,
      required: this.newFieldRequired,
      value: defaultValue,
      options: ['select', 'table', 'label'].includes(this.newFieldType) ? this.newFieldOptions.trim() : undefined,
      rowsCount: this.newFieldType === 'table' ? this.newFieldRowsCount : undefined
    };

    const updated = [...this.customFields(), newField];
    this.customFieldsChanged.emit(updated);

    this.newFieldName = '';
    this.newFieldOptions = '';
    this.newFieldRowsCount = 1;
    this.newFieldRequired = false;
  }

  removeField(fieldId: string) {
    const updated = this.customFields().filter(f => f.id !== fieldId);
    this.customFieldsChanged.emit(updated);
  }

  onFieldValueChange(fieldId: string, newValue: any) {
    const updated = this.customFields().map(f => {
      if (f.id === fieldId) {
        return { ...f, value: newValue };
      }
      return f;
    });
    this.customFieldsChanged.emit(updated);
  }

  onFileSelected(event: Event, fieldId: string) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      const reader = new FileReader();
      
      reader.onload = () => {
        const base64String = reader.result as string;
        const updated = this.customFields().map(f => {
          if (f.id === fieldId) {
            return { ...f, value: base64String, fileName: file.name };
          }
          return f;
        });
        this.customFieldsChanged.emit(updated);
      };
      
      reader.readAsDataURL(file);
    }
  }

  getSelectOptions(optionsStr?: string): string[] {
    if (!optionsStr) return [];
    return optionsStr.split(',').map(o => o.trim()).filter(o => o.length > 0);
  }

  getFieldTypeLabel(type: string): string {
    switch (type) {
      case 'text': return 'Texto';
      case 'number': return 'Número';
      case 'date': return 'Fecha';
      case 'checkbox': return 'Casilla (Boolean)';
      case 'select': return 'Lista (Select)';
      case 'file': return 'Archivo (Imagen, Video, Doc, etc.)';
      case 'table': return 'Tabla';
      case 'label': return 'Etiqueta (Texto Fijo)';
      case 'list': return 'Lista Dinámica';
      default: return type;
    }
  }

  onTextChange(newText: string) {
    this.textChanged.emit(newText);
  }

  onColorChange(newColor: string) {
    this.colorChanged.emit(newColor);
  }

  onDelete() {
    this.deleteRequested.emit();
  }
}
