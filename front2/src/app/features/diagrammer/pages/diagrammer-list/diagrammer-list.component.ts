import { Component, inject, signal, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DiagramService, Diagram } from '../../../../core/services/diagram.service';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-diagrammer-list',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './diagrammer-list.component.html'
})
export class DiagrammerListComponent {
  protected readonly diagramService = inject(DiagramService);
  protected readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  // Estados reactivos locales para controlar modales
  readonly showAddModal = signal<boolean>(false);
  readonly showJoinModal = signal<boolean>(false);
  readonly diagramToDelete = signal<Diagram | null>(null);
  diagramName = '';
  joinCode = '';
  joinError = '';

  // Computed Signal: Filtra los diagramas reactivamente según la identidad del usuario en sesión
  readonly filteredDiagrams = computed(() => {
    const user = this.authService.currentUser();
    if (!user) return [];

    const list = this.diagramService.diagrams();
    // El Administrador ve todo el catálogo global de diagramas
    if (user.rol === 'ADMIN') {
      return list;
    }

    // El Diagramador ve sus diagramas personales creados o aquellos en los que colabora
    return list.filter(d => d.creatorId === user.id || (d.collaboratorIds && d.collaboratorIds.includes(user.id)));
  });

  // Políticas de Permisos Granulares por Usuario
  canCreate(): boolean {
    return this.authService.hasPermission('diagramador', 'crear');
  }

  canEdit(diag: Diagram): boolean {
    const user = this.authService.currentUser();
    if (!user) return false;
    
    // El admin puede editar todo siempre
    if (user.rol === 'ADMIN') return true;

    // Solo el creador original del diagrama puede editarlo
    return diag.creatorId === user.id && this.authService.hasPermission('diagramador', 'editar');
  }

  canDelete(diag: Diagram): boolean {
    const user = this.authService.currentUser();
    if (!user) return false;
    
    // El admin puede borrar todo
    if (user.rol === 'ADMIN') return true;

    // El creador original con permisos de eliminación
    return diag.creatorId === user.id && this.authService.hasPermission('diagramador', 'eliminar');
  }

  // Modales
  openAddModal() {
    this.diagramName = '';
    this.showAddModal.set(true);
  }

  closeAddModal() {
    this.showAddModal.set(false);
  }

  createDiagram() {
    if (!this.diagramName.trim()) return;

    const user = this.authService.currentUser();
    if (!user) return;

    this.diagramService.createDiagram(
      this.diagramName,
      user.id,
      `${user.nombres} ${user.apellidos}`
    ).subscribe({
      next: (newProj) => {
        this.closeAddModal();
        // Redirigir directamente al editor interactivo del nuevo diagrama
        this.router.navigate(['/diagramas', newProj.id]);
      },
      error: (err) => {
        console.error('Error al crear diagrama', err);
      }
    });
  }

  openJoinModal() {
    this.joinCode = '';
    this.joinError = '';
    this.showJoinModal.set(true);
  }

  closeJoinModal() {
    this.showJoinModal.set(false);
  }

  joinRoom() {
    if (!this.joinCode.trim()) return;

    this.diagramService.joinProject(this.joinCode.trim()).subscribe({
      next: (joinedProj) => {
        this.closeJoinModal();
        // Redirigir al editor del diagrama al que se unió
        this.router.navigate(['/diagramas', joinedProj.id]);
      },
      error: (err) => {
        this.joinError = 'No se pudo unir a la sala. Verifica que el código sea correcto y no seas ya colaborador o dueño.';
        console.error('Error joining room', err);
      }
    });
  }

  confirmDelete(diag: Diagram) {
    this.diagramToDelete.set(diag);
  }

  cancelDelete() {
    this.diagramToDelete.set(null);
  }

  executeDelete() {
    const diag = this.diagramToDelete();
    if (diag) {
      this.diagramService.deleteDiagram(diag.id);
      this.diagramToDelete.set(null);
    }
  }
}
