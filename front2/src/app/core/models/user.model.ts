export type Role = 'ADMIN' | 'FUNCIONARIO' | 'DIAGRAMADOR' | 'CLIENTE';

export interface User {
  id: string;
  nombres: string;
  apellidos: string;
  correo: string;
  password?: string;
  rol: Role;
  permisos: string[]; // Formato: 'pestaña:acción' (ej: 'usuarios:crear')
  isNew?: boolean;
}

