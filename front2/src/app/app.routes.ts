import { Routes, CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './core/services/auth.service';

// Guard funcional para proteger las rutas principales
const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  router.navigate(['/login']);
  return false;
};

// Guard funcional para evitar entrar al Login si ya está autenticado
const loginGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    router.navigate(['/dashboard']);
    return false;
  }
  return true;
};

export const routes: Routes = [
  // Ruta de Autenticación
  {
    path: 'login',
    loadComponent: () => import('./layout/auth-layout/auth-layout.component').then(m => m.AuthLayoutComponent),
    canActivate: [loginGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent)
      }
    ]
  },

  // Rutas Principales protegidas por AuthGuard
  {
    path: '',
    loadComponent: () => import('./layout/main-layout/main-layout.component').then(m => m.MainLayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'usuarios',
        loadComponent: () => import('./features/users/users.component').then(m => m.UsersComponent)
      },
      {
        path: 'permisos',
        loadComponent: () => import('./features/roles/permisos.component').then(m => m.PermisosComponent)
      },
      {
        path: 'diagramas',
        loadComponent: () => import('./features/diagrammer/pages/diagrammer-list/diagrammer-list.component').then(m => m.DiagrammerListComponent)
      },
      {
        path: 'diagramas/:id',
        loadComponent: () => import('./features/diagrammer/pages/diagrammer-editor/diagrammer-editor.component').then(m => m.DiagrammerEditorComponent)
      },
      {
        path: 'asignaciones',
        loadComponent: () => import('./features/flow-assignments/flow-assignments.component').then(m => m.FlowAssignmentsComponent)
      },
      {
        path: 'mis-tareas',
        loadComponent: () => import('./features/my-tasks/my-tasks.component').then(m => m.MyTasksComponent)
      },
      {
        path: 'mis-tareas/ejecutar/:taskId',
        loadComponent: () => import('./features/task-execution/task-execution.component').then(m => m.TaskExecutionComponent)
      },
      {
        path: 'mis-tareas/seguimiento/:instanceId',
        loadComponent: () => import('./features/task-execution/task-execution.component').then(m => m.TaskExecutionComponent)
      },
      {
        path: 'documentos',
        loadComponent: () => import('./features/document-explorer/document-explorer.component').then(m => m.DocumentExplorerComponent)
      },
      {
        path: 'reportes',
        loadComponent: () => import('./features/reports/reports.component').then(m => m.ReportsComponent)
      },
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      }
    ]
  },

  // Redirección comodín para URLs no válidas
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
