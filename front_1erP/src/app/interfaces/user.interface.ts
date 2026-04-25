export interface User {
  id: string;
  nombres: string;
  apellidos: string;
  correo: string;
  rol: 'ADMIN' | 'FUNCIONARIO' | 'DIAGRAMADOR';
  activo: boolean;
  createdAt?: string;
}

export interface TokenResponse {
  access_token: string;
  user: User;
}
