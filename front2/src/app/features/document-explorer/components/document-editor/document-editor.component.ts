import { 
  Component, 
  Input, 
  Output, 
  EventEmitter, 
  OnInit, 
  OnDestroy, 
  inject, 
  signal, 
  ElementRef, 
  ViewChild, 
  HostListener 
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ProcessExecutionService } from '../../../../core/services/process-execution.service';
import { DocumentCollaborationService, CollaborationUser } from '../../../../core/services/document-collaboration.service';
import { Subscription } from 'rxjs';
import * as XLSX from 'xlsx';
// @ts-ignore
import mammoth from 'mammoth';
import { Document as DocxDocument, Paragraph, TextRun, Packer, HeadingLevel } from 'docx';
import { ToastrService } from '../../../../core/services/toastr.service';

// @ts-ignore
import jspreadsheet from 'jspreadsheet-ce';
import Quill from 'quill';

@Component({
  selector: 'app-document-editor',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './document-editor.component.html',
  styleUrls: ['./document-editor.component.css']
})
export class DocumentEditorComponent implements OnInit, OnDestroy {
  private readonly processService = inject(ProcessExecutionService);
  protected readonly collabService = inject(DocumentCollaborationService);
  private readonly http = inject(HttpClient);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly toastrService = inject(ToastrService);

  @Input() s3Key: string = '';
  @Input() filename: string = '';
  @Output() onClose = new EventEmitter<void>();

  @ViewChild('quillContainer', { static: false }) quillContainer!: ElementRef;
  @ViewChild('spreadsheetContainer', { static: false }) spreadsheetContainer!: ElementRef;

  // Estados
  loading = signal<boolean>(true);
  saving = signal<boolean>(false);
  error = signal<string | null>(null);
  editorType = signal<'text' | 'spreadsheet' | 'pdf' | 'image' | 'video' | 'word' | 'unsupported'>('unsupported');

  // URL para iframe o imagen
  downloadUrl: string = '';
  contentUrl: string = '';
  safeUrl: SafeResourceUrl | null = null;

  // Editores e instancias
  private quillInstance: Quill | null = null;
  private jspreadsheetInstance: any = null;
  private documentId: string = '';
  private applyingRemoteChange: boolean = false;
  private lockedCells = new Map<string, { userId: string, username: string }>();

  // Zoom y Pan para el visualizador de imágenes
  zoomLevel = signal<number>(1);
  panX = signal<number>(0);
  panY = signal<number>(0);
  isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;

  private subscription: Subscription = new Subscription();

  ngOnInit() {
    this.detectEditorType();
    this.documentId = this.s3Key.replace(/\//g, '___');
    this.downloadUrl = this.processService.getDocumentDownloadUrl(this.s3Key);
    this.contentUrl = this.processService.getDocumentContentUrl(this.s3Key);
    this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.downloadUrl);

    // Conectar a la sesión de colaboración en tiempo real
    this.collabService.connect(this.documentId);

    // Escuchar mensajes del WebSocket
    this.subscription.add(
      this.collabService.messages$.subscribe(msg => {
        this.handleIncomingSocketMessage(msg);
      })
    );

    // Cargar contenido inicial del archivo
    this.loadInitialContent();
  }

  ngOnDestroy() {
    // Liberar recursos
    this.subscription.unsubscribe();
    this.collabService.disconnect(this.documentId);

    if (this.jspreadsheetInstance) {
      (jspreadsheet as any).destroy(this.spreadsheetContainer.nativeElement);
    }
  }

  detectEditorType() {
    const ext = this.filename.split('.').pop()?.toLowerCase();
    if (!ext) {
      this.editorType.set('text');
      return;
    }

    if (['txt', 'html', 'md', 'json', 'xml', 'css', 'js'].includes(ext)) {
      this.editorType.set('text');
    } else if (['xlsx', 'xls', 'csv'].includes(ext)) {
      this.editorType.set('spreadsheet');
    } else if (ext === 'pdf') {
      this.editorType.set('pdf');
      this.loading.set(false);
    } else if (['png', 'jpg', 'jpeg', 'gif'].includes(ext)) {
      this.editorType.set('image');
      this.loading.set(false);
    } else if (['mp4', 'webm', 'ogg', 'mov'].includes(ext)) {
      this.editorType.set('video');
      this.loading.set(false);
    } else if (ext === 'docx') {
      this.editorType.set('word');
    } else {
      this.editorType.set('unsupported');
      this.loading.set(false);
    }
  }

  loadInitialContent() {
    if (this.editorType() === 'pdf' || this.editorType() === 'image' || this.editorType() === 'video' || this.editorType() === 'unsupported') {
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    if (this.editorType() === 'text') {
      this.http.get(this.contentUrl, { responseType: 'text' }).subscribe({
        next: (text) => {
          this.initQuill(text);
          this.loading.set(false);
        },
        error: (err) => {
          console.error('Error loading file text:', err);
          this.error.set('No se pudo descargar el contenido del archivo de texto.');
          this.loading.set(false);
        }
      });
    } else if (this.editorType() === 'word') {
      this.http.get(this.contentUrl, { responseType: 'arraybuffer' }).subscribe({
        next: (buffer) => {
          mammoth.convertToHtml({ arrayBuffer: buffer })
            .then((result: any) => {
              this.initQuill(result.value);
              this.loading.set(false);
            })
            .catch((err: any) => {
              console.error('Error converting docx to HTML:', err);
              this.error.set('Error al convertir el archivo Word a texto editable.');
              this.loading.set(false);
            });
        },
        error: (err) => {
          console.error('Error downloading docx:', err);
          this.error.set('No se pudo descargar el archivo Word.');
          this.loading.set(false);
        }
      });
    } else if (this.editorType() === 'spreadsheet') {
      this.http.get(this.contentUrl, { responseType: 'arraybuffer' }).subscribe({
        next: (buffer) => {
          this.parseAndInitSpreadsheet(buffer);
          this.loading.set(false);
        },
        error: (err) => {
          console.error('Error loading spreadsheet:', err);
          this.error.set('No se pudo descargar la hoja de cálculo.');
          this.loading.set(false);
        }
      });
    }
  }

  // --- Quill (Editor de Texto) ---
  initQuill(initialText: string) {
    setTimeout(() => {
      const isHtml = this.filename.toLowerCase().endsWith('.html') || this.editorType() === 'word';
      
      this.quillInstance = new Quill(this.quillContainer.nativeElement, {
        theme: 'snow',
        modules: {
          toolbar: [
            [{ header: [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ color: [] }, { background: [] }],
            [{ list: 'ordered' }, { list: 'bullet' }],
            ['align', 'clean'],
            ['code-block']
          ]
        }
      });

      if (isHtml) {
        this.quillInstance.root.innerHTML = initialText || '';
      } else {
        this.quillInstance.setText(initialText || '');
      }

      // Escuchar cambios de texto locales y difundirlos
      this.quillInstance.on('text-change', (delta, oldDelta, source) => {
        if (source === 'user') {
          this.collabService.sendMessage(this.documentId, 'TEXT_CHANGE', { delta });
        }
      });
    }, 100);
  }

  // --- jSpreadsheet (Planilla de Cálculo) ---
  parseAndInitSpreadsheet(buffer: ArrayBuffer) {
    setTimeout(() => {
      let data: any[][] = [];
      let merges: any = {};
      let colWidths: number[] = [];
      const ext = this.filename.split('.').pop()?.toLowerCase();

      try {
        if (ext === 'csv') {
          const decoder = new TextDecoder('utf-8');
          const csvText = decoder.decode(buffer);
          const workbook = XLSX.read(csvText, { type: 'string' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
        } else {
          const bytes = new Uint8Array(buffer);
          const workbook = XLSX.read(bytes, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

          // 1. Extraer celdas combinadas (Merges)
          if (sheet['!merges']) {
            sheet['!merges'].forEach((merge: any) => {
              const cellName = XLSX.utils.encode_cell({ c: merge.s.c, r: merge.s.r });
              const colSpan = merge.e.c - merge.s.c + 1;
              const rowSpan = merge.e.r - merge.s.r + 1;
              merges[cellName] = [colSpan, rowSpan];
            });
          }

          // 2. Extraer anchos de columna (Column Widths)
          if (sheet['!cols']) {
            sheet['!cols'].forEach((col: any, idx: number) => {
              if (col && col.wpx) {
                colWidths[idx] = col.wpx;
              } else if (col && col.wch) {
                colWidths[idx] = col.wch * 8; // Estimación de píxeles
              }
            });
          }
        }
      } catch (e) {
        console.error('Error parsing sheet data:', e);
        data = [['', '', ''], ['', '', '']]; // Fallback
      }

      // Asegurar un tamaño mínimo
      if (data.length === 0) {
        data = [['']];
      }

      const sheets = (jspreadsheet as any)(this.spreadsheetContainer.nativeElement, {
        worksheets: [{
          data: data,
          minDimensions: [15, 25],
          tableOverflow: true,
          tableWidth: '100%',
          tableHeight: '65vh',
          mergeCells: merges,
          colWidths: colWidths.length > 0 ? colWidths : undefined,
          editable: true,
          onload: (instance: any) => {
            // Aplicar la clase gantt-active a las celdas cargadas inicialmente
            const rows = instance.options.data.length;
            const cols = instance.options.data[0]?.length || 0;
            for (let r = 0; r < rows; r++) {
              for (let c = 3; c < cols; c++) {
                const val = instance.getValueFromCoords(c, r);
                if (val === 'x' || val === 'X' || val === '1') {
                  const cellEl = instance.getCellFromCoords(c, r);
                  if (cellEl) cellEl.classList.add('gantt-active');
                }
              }
            }
          },
          onchange: (instance: any, cell: any, col: any, row: any, value: any) => {
            // Aplicar estilo de Gantt si es columna D o posterior
            if (col >= 3) {
              if (value === 'x' || value === 'X' || value === '1') {
                cell.classList.add('gantt-active');
              } else {
                cell.classList.remove('gantt-active');
              }
            }

            if (!this.applyingRemoteChange) {
              this.collabService.sendMessage(this.documentId, 'CELL_CHANGE', { col, row, value });
            }
          },
          oneditionstart: (instance: any, cell: any, col: any, row: any) => {
            this.collabService.sendMessage(this.documentId, 'CELL_LOCK', { col, row });
          },
          oneditionend: (instance: any, cell: any, col: any, row: any, value: any, save: any) => {
            this.collabService.sendMessage(this.documentId, 'CELL_UNLOCK', { col, row });
          },
          onbeforechange: (instance: any, cell: any, col: any, row: any, value: any) => {
            const cellKey = `${col},${row}`;
            if (this.lockedCells.has(cellKey)) {
              return false; // Cancelar edición si está bloqueada por otro usuario
            }
            return value;
          }
        }]
      } as any);

      this.jspreadsheetInstance = Array.isArray(sheets) ? sheets[0] : sheets;
    }, 100);
  }

  // --- Manejo del Socket y Mensajería ---
  handleIncomingSocketMessage(msg: any) {
    if (msg.type === 'TEXT_CHANGE' && this.quillInstance) {
      this.quillInstance.updateContents(msg.payload.delta, 'api');
    } 
    else if (msg.type === 'CELL_CHANGE' && this.jspreadsheetInstance) {
      this.applyingRemoteChange = true;
      try {
        const { col, row, value } = msg.payload;
        this.jspreadsheetInstance.setValueFromCoords(col, row, value, true);

        // Aplicar la clase de Gantt dinámicamente si es columna D o posterior
        if (col >= 3) {
          const cellElement = this.jspreadsheetInstance.getCellFromCoords(col, row);
          if (cellElement) {
            if (value === 'x' || value === 'X' || value === '1') {
              cellElement.classList.add('gantt-active');
            } else {
              cellElement.classList.remove('gantt-active');
            }
          }
        }
      } finally {
        this.applyingRemoteChange = false;
      }
    } 

    else if (msg.type === 'CELL_LOCK' && this.jspreadsheetInstance) {
      const { col, row } = msg.payload;
      const cellKey = `${col},${row}`;
      this.lockedCells.set(cellKey, { userId: msg.userId, username: msg.username });
      
      const cellElement = this.jspreadsheetInstance.getCellFromCoords(col, row);
      if (cellElement) {
        cellElement.classList.add('cell-locked');
        cellElement.title = `Bloqueado por: ${msg.username}`;
      }
    } 
    else if (msg.type === 'CELL_UNLOCK' && this.jspreadsheetInstance) {
      const { col, row } = msg.payload;
      const cellKey = `${col},${row}`;
      this.lockedCells.delete(cellKey);
      
      const cellElement = this.jspreadsheetInstance.getCellFromCoords(col, row);
      if (cellElement) {
        cellElement.classList.remove('cell-locked');
        cellElement.removeAttribute('title');
      }
    }
    else if (msg.type === 'USER_LEFT') {
      // Limpiar bloqueos de ese usuario que se acaba de desconectar
      this.lockedCells.forEach((value, key) => {
        if (value.userId === msg.userId) {
          const [col, row] = key.split(',').map(Number);
          if (this.jspreadsheetInstance) {
            const cellElement = this.jspreadsheetInstance.getCellFromCoords(col, row);
            if (cellElement) {
              cellElement.classList.remove('cell-locked');
              cellElement.removeAttribute('title');
            }
          }
          this.lockedCells.delete(key);
        }
      });
    }
  }

  // --- Acciones del Editor ---
  saveDocument() {
    if (this.editorType() === 'unsupported' || this.editorType() === 'pdf' || this.editorType() === 'image' || this.editorType() === 'video') return;
    
    this.saving.set(true);
    this.error.set(null);

    if (this.editorType() === 'word' && this.quillInstance) {
      try {
        const htmlContent = this.quillInstance.root.innerHTML;
        
        // Parsear el HTML usando el DOMParser nativo del navegador
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        const children: any[] = [];

        doc.body.childNodes.forEach((node: any) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement;
            const runs: TextRun[] = [];

            // Parsear nodos hijos para mantener estilos (negritas, cursivas, subrayados)
            el.childNodes.forEach((child: any) => {
              let text = child.textContent || '';
              let bold = false;
              let italic = false;
              let underline = false;

              if (child.nodeType === Node.ELEMENT_NODE) {
                const cel = child as HTMLElement;
                bold = cel.tagName === 'STRONG' || cel.tagName === 'B';
                italic = cel.tagName === 'EM' || cel.tagName === 'I';
                underline = cel.tagName === 'U';
                text = cel.textContent || '';
              }

              runs.push(new TextRun({
                text: text,
                bold: bold,
                italics: italic,
                underline: underline ? {} : undefined
              }));
            });

            let heading: any = undefined;
            if (el.tagName === 'H1') heading = HeadingLevel.HEADING_1;
            else if (el.tagName === 'H2') heading = HeadingLevel.HEADING_2;
            else if (el.tagName === 'H3') heading = HeadingLevel.HEADING_3;

            children.push(new Paragraph({
              children: runs,
              heading: heading
            }));
          } else if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
            children.push(new Paragraph({
              children: [new TextRun(node.textContent)]
            }));
          }
        });

        const docxDocument = new DocxDocument({
          sections: [{
            properties: {},
            children: children
          }]
        });

        Packer.toBlob(docxDocument).then((docxBlob: Blob) => {
          const file = new File([docxBlob], this.filename, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
          
          this.processService.updateDocument(this.s3Key, file).subscribe({
            next: () => {
              this.saving.set(false);
              this.toastrService.success('Documento Word guardado con éxito.', 'Guardado Exitoso');
            },
            error: (err) => {
              console.error('Error saving file:', err);
              this.toastrService.error('No se pudo guardar el archivo en el servidor.', 'Error');
              this.saving.set(false);
            }
          });
        }).catch((err) => {
          console.error('Error generating docx blob:', err);
          this.error.set('Error al generar el archivo binario del documento Word.');
          this.saving.set(false);
        });

      } catch (err) {
        console.error('Error converting HTML to docx:', err);
        this.error.set('Error al empaquetar el documento a formato Word (.docx).');
        this.saving.set(false);
      }
      return;
    }

    let file: File;

    if (this.editorType() === 'text' && this.quillInstance) {
      const isHtml = this.filename.toLowerCase().endsWith('.html');
      const textContent = isHtml ? this.quillInstance.root.innerHTML : this.quillInstance.getText();
      const blob = new Blob([textContent], { type: isHtml ? 'text/html' : 'text/plain' });
      file = new File([blob], this.filename, { type: isHtml ? 'text/html' : 'text/plain' });
    } 
    else if (this.editorType() === 'spreadsheet' && this.jspreadsheetInstance) {
      const data = this.jspreadsheetInstance.getData();
      const worksheet = XLSX.utils.aoa_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
      
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      file = new File([blob], this.filename, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    } else {
      this.saving.set(false);
      return;
    }

    this.processService.updateDocument(this.s3Key, file).subscribe({
      next: () => {
        this.saving.set(false);
        this.toastrService.success('Documento guardado con éxito.', 'Guardado Exitoso');
      },
      error: (err) => {
        console.error('Error saving file:', err);
        this.toastrService.error('No se pudo guardar el archivo en el servidor.', 'Error');
        this.saving.set(false);
      }
    });
  }

  // --- Zoom y Pan del Visualizador de Imagen ---
  zoomIn() {
    this.zoomLevel.update(z => Math.min(z + 0.1, 3));
  }

  zoomOut() {
    this.zoomLevel.update(z => Math.max(z - 0.1, 0.2));
  }

  resetZoom() {
    this.zoomLevel.set(1);
    this.panX.set(0);
    this.panY.set(0);
  }

  onImageMouseDown(event: MouseEvent) {
    event.preventDefault();
    this.isDragging = true;
    this.dragStartX = event.clientX - this.panX();
    this.dragStartY = event.clientY - this.panY();
  }

  @HostListener('document:mousemove', ['$event'])
  onImageMouseMove(event: MouseEvent) {
    if (this.isDragging) {
      this.panX.set(event.clientX - this.dragStartX);
      this.panY.set(event.clientY - this.dragStartY);
    }
  }

  @HostListener('document:mouseup')
  onImageMouseUp() {
    this.isDragging = false;
  }
}
