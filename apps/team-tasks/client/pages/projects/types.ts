export interface Project {
  id: string;
  name: string;
  createdAt: string;
}
export interface ProjectList {
  data: Project[];
  meta: { total: number; page: number; pageSize: number };
}
export interface ProjectContext {
  reload: () => void;
}
