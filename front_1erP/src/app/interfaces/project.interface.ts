export interface Project {
  id?: string;
  name: string;
  description?: string;
  ownerId?: string;
  data?: any;
  elementCount?: number;
  collaboratorIds?: string[];
  createdAt?: string;
  updatedAt?: string;
  version?: number;
}
