export interface User {
  id: string;
  nombres: string;
  apellidos: string;
  correo: string;
  rol: string;
  activo: boolean;
}

export interface TokenResponse {
  access_token: string;
  user: User;
}
