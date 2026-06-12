import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProcessExecutionService } from '../../core/services/process-execution.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastrService } from '../../core/services/toastr.service';
import { DocumentEditorComponent } from './components/document-editor/document-editor.component';

export interface TreeNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  s3Key?: string;
  size?: number;
  lastModified?: string;
  children?: TreeNode[];
}

@Component({
  selector: 'app-document-explorer',
  standalone: true,
  imports: [CommonModule, FormsModule, DocumentEditorComponent],
  templateUrl: './document-explorer.component.html'
})
export class DocumentExplorerComponent implements OnInit {
  private readonly processService = inject(ProcessExecutionService);
  protected readonly authService = inject(AuthService);
  private readonly toastrService = inject(ToastrService);

  readonly documentTree = signal<TreeNode[]>([]);
  readonly currentPath = signal<TreeNode[]>([]);
  readonly selectedNode = signal<TreeNode | null>(null);
  readonly searchQuery = signal<string>('');
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);
  readonly viewMode = signal<'grid' | 'list'>('grid');
  readonly activeEditNode = signal<TreeNode | null>(null);

  ngOnInit() {
    this.loadTree();
  }

  // Returns list of items in the current folder
  readonly currentItems = computed<TreeNode[]>(() => {
    const path = this.currentPath();
    if (path.length === 0) {
      return this.documentTree();
    }
    const currentFolder = path[path.length - 1];
    return currentFolder.children || [];
  });

  // Filters items by search query
  readonly filteredItems = computed<TreeNode[]>(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const items = this.currentItems();
    if (!query) {
      return items;
    }
    return items.filter(item => item.name.toLowerCase().includes(query));
  });

  loadTree() {
    this.loading.set(true);
    this.error.set(null);
    this.processService.getS3DocumentTree().subscribe({
      next: (tree) => {
        this.documentTree.set(tree);
        // Sync current path stack if folders were reloaded
        const newPath: TreeNode[] = [];
        let currentLevel = tree;
        for (const pathFolder of this.currentPath()) {
          const matched = currentLevel.find(
            node => node.type === 'folder' && node.id === pathFolder.id
          );
          if (matched) {
            newPath.push(matched);
            currentLevel = matched.children || [];
          } else {
            break;
          }
        }
        this.currentPath.set(newPath);
        this.selectedNode.set(null);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading documents:', err);
        this.error.set('No se pudo cargar la lista de documentos.');
        this.loading.set(false);
      }
    });
  }

  enterFolder(node: TreeNode) {
    if (node.type === 'folder') {
      const path = [...this.currentPath(), node];
      this.currentPath.set(path);
      this.selectedNode.set(null);
      this.searchQuery.set('');
    }
  }

  navigateUp() {
    const path = this.currentPath();
    if (path.length > 0) {
      this.currentPath.set(path.slice(0, -1));
      this.selectedNode.set(null);
      this.searchQuery.set('');
    }
  }

  navigateToBreadcrumb(index: number) {
    if (index === -1) {
      this.currentPath.set([]);
    } else {
      this.currentPath.set(this.currentPath().slice(0, index + 1));
    }
    this.selectedNode.set(null);
    this.searchQuery.set('');
  }

  selectNode(node: TreeNode) {
    this.selectedNode.set(node);
  }

  canDownload(): boolean {
    return this.authService.hasPermission('documentos', 'ver');
  }

  canDelete(): boolean {
    return this.authService.hasPermission('documentos', 'eliminar');
  }

  downloadFile(node: TreeNode) {
    if (node.type !== 'file' || !node.s3Key) return;
    const downloadUrl = this.processService.getDocumentDownloadUrl(node.s3Key);
    // Open in a new tab or trigger direct redirect browser download
    window.open(downloadUrl, '_blank');
  }

  deleteFile(node: TreeNode) {
    if (node.type !== 'file' || !node.s3Key) return;
    if (confirm(`¿Está seguro de que desea eliminar el archivo "${node.name}"?`)) {
      this.loading.set(true);
      this.processService.deleteS3Document(node.s3Key).subscribe({
        next: () => {
          this.toastrService.success(`El archivo "${node.name}" ha sido eliminado.`, 'Documento Eliminado');
          this.loadTree();
        },
        error: (err) => {
          console.error('Error deleting document:', err);
          this.toastrService.error('No se pudo eliminar el archivo.', 'Error');
          this.loading.set(false);
        }
      });
    }
  }

  formatBytes(bytes?: number): string {
    if (bytes === undefined || bytes === null) return '-';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  }

  getFileIcon(name: string): string {
    const ext = name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return '📄';
      case 'doc':
      case 'docx': return '📝';
      case 'xls':
      case 'xlsx': return '📊';
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif': return '🖼️';
      case 'zip':
      case 'rar': return '📦';
      default: return '📄';
    }
  }

  openEditor(node: TreeNode) {
    if (node.type === 'file') {
      this.activeEditNode.set(node);
    }
  }

  closeEditor() {
    this.activeEditNode.set(null);
    this.loadTree();
  }
}
