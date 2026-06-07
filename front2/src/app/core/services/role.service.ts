import { Injectable } from '@angular/core';
import { Role } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class RoleService {
  // Lista de pestañas disponibles en el sistema
  readonly tabs = [
    { id: 'dashboard', name: 'Dashboard', description: 'Acceso a la vista de indicadores y auditoría.' },
    { id: 'usuarios', name: 'Usuarios', description: 'Gestión del CRUD de colaboradores.' },
    { id: 'diagramador', name: 'Diagramador (Actividades)', description: 'Modelado y diseño de diagramas de actividad UML.' },
    { id: 'funcionario', name: 'Funcionario (Flujos)', description: 'Ejecución y operación de flujos de trabajo.' },
    { id: 'permisos', name: 'Permisos', description: 'Configuración granular y de políticas por usuario.' }
  ];

  // Lista de acciones disponibles en el sistema
  readonly actions = [
    { id: 'ver', name: 'Ver', description: 'Visualizar la pestaña y listados.' },
    { id: 'crear', name: 'Crear', description: 'Insertar nuevos registros.' },
    { id: 'editar', name: 'Editar', description: 'Modificar registros existentes.' },
    { id: 'eliminar', name: 'Eliminar', description: 'Dar de baja o remover registros.' }
  ];

  // Obtener los permisos por defecto para un rol específico (Presets)
  getPresetPermissions(role: Role): string[] {
    switch (role) {
      case 'ADMIN':
        // Acceso total a todo en el sistema
        const adminPerms: string[] = [];
        this.tabs.forEach(tab => {
          this.actions.forEach(act => {
            adminPerms.push(`${tab.id}:${act.id}`);
          });
        });
        return adminPerms;

      case 'DIAGRAMADOR':
        // Acceso a diagramador (CRUD completo) y visualización del dashboard
        return [
          'dashboard:ver',
          'diagramador:ver',
          'diagramador:crear',
          'diagramador:editar',
          'diagramador:eliminar'
        ];

      case 'FUNCIONARIO':
        // Acceso a ejecución de flujos (CRUD completo) y visualización del dashboard
        return [
          'dashboard:ver',
          'funcionario:ver',
          'funcionario:crear',
          'funcionario:editar',
          'funcionario:eliminar'
        ];

      case 'CLIENTE':
        // Solo ver dashboard
        return [
          'dashboard:ver'
        ];

      default:
        return ['dashboard:ver'];
    }
  }

  // Traducción estética de pestañas y acciones
  getTabLabel(tabId: string): string {
    const found = this.tabs.find(t => t.id === tabId);
    return found ? found.name : tabId;
  }

  getActionLabel(actionId: string): string {
    const found = this.actions.find(a => a.id === actionId);
    return found ? found.name : actionId;
  }
}
