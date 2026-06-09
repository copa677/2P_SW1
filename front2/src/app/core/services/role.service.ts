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
    { id: 'permisos', name: 'Permisos', description: 'Configuración granular y de políticas por usuario.' },
    { id: 'procesos', name: 'Procesos (Ejecución)', description: 'Gestión y ejecución de procesos y trámites.' },
    { id: 'documentos', name: 'Gestor Documental (Drive)', description: 'Exploración, visualización y gestión de archivos subidos en S3.' }
  ];

  // Lista de acciones disponibles en el sistema
  readonly actions = [
    { id: 'ver', name: 'Ver', description: 'Visualizar la pestaña y listados.' },
    { id: 'crear', name: 'Crear', description: 'Insertar nuevos registros.' },
    { id: 'editar', name: 'Editar', description: 'Modificar registros existentes.' },
    { id: 'eliminar', name: 'Eliminar', description: 'Dar de baja o remover registros.' }
  ];

  // Traduce la combinación pestaña:acción de la UI al formato de autoridad que espera el Backend
  mapToBackendPermission(tab: string, action: string): string {
    if (tab === 'documentos') {
      if (action === 'ver') return 'documentos:leer';
      if (action === 'crear') return 'documentos:crear';
      if (action === 'editar') return 'documentos:editar';
      if (action === 'eliminar') return 'documentos:eliminar';
    }
    if (tab === 'procesos' || tab === 'funcionario') {
      if (action === 'ver') return 'procesos:leer';
      if (action === 'crear') return 'procesos:iniciar';
      if (action === 'editar') return 'procesos:avanzar';
      if (action === 'eliminar') return 'procesos:eliminar';
    }
    if (tab === 'diagramador') {
      if (action === 'ver') return 'diagramas:leer';
      if (action === 'crear') return 'diagramas:crear';
      if (action === 'editar') return 'diagramas:editar';
      if (action === 'eliminar') return 'diagramas:eliminar';
    }
    return `${tab}:${action}`;
  }

  // Obtener los permisos por defecto para un rol específico (Presets en base al backend)
  getPresetPermissions(role: Role): string[] {
    switch (role) {
      case 'ADMIN':
        // Acceso total a todo en el sistema
        const adminPerms: string[] = [];
        this.tabs.forEach(tab => {
          this.actions.forEach(act => {
            adminPerms.push(this.mapToBackendPermission(tab.id, act.id));
          });
        });
        return adminPerms;

      case 'DIAGRAMADOR':
        return [
          'dashboard:ver',
          'diagramas:leer',
          'diagramas:crear',
          'diagramas:editar',
          'diagramas:eliminar',
          'procesos:leer',
          'documentos:leer'
        ];

      case 'FUNCIONARIO':
        return [
          'dashboard:ver',
          'diagramas:leer',
          'procesos:leer',
          'procesos:iniciar',
          'procesos:avanzar',
          'documentos:leer',
          'documentos:crear',
          'documentos:eliminar'
        ];

      case 'CLIENTE':
        return [
          'dashboard:ver',
          'procesos:leer',
          'procesos:iniciar'
        ];

      default:
        return ['dashboard:ver', 'procesos:leer'];
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
