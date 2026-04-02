export type Role = 'admin' | 'manager' | 'sourcing' | 'marketing' | 'purchasing';

export interface User {
  id: string;
  name: string;
  username: string;
  password?: string;
  role: Role;
  token?: string;
  menus?: string[];
}

export interface UserCreate {
  name: string;
  username: string;
  password: string;
  role: Role;
}

