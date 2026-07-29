import type { ComponentType, ReactElement } from 'react';
import { UserRole } from '../types/entities';

export type NavigationIconKey =
  | 'shield'
  | 'users'
  | 'sliders-horizontal'
  | 'bar-chart-3'
  | 'folder-kanban'
  | 'layout-dashboard'
  | 'triangle-alert'
  | 'ticket'
  | 'book-open-text'
  | 'award'
  | 'calendar-days'
  | 'clock'
  | 'gauge'
  | 'wrench'
  | 'sparkles';

export type LazyPageImport = () => Promise<{ default: ComponentType }>;

interface RouteElementDefinition {
  element: ReactElement;
  lazy?: never;
}

interface RouteLazyDefinition {
  element?: never;
  lazy: LazyPageImport;
}

interface RouteRedirectDefinition {
  redirectTo: string;
  element?: never;
  lazy?: never;
}

type RouteRenderable = RouteElementDefinition | RouteLazyDefinition | RouteRedirectDefinition;

export interface RoleNavMeta {
  label: string;
  iconKey: NavigationIconKey;
}

export type RoleRouteDefinition = RouteRenderable & {
  id: string;
  path: string;
  nav?: RoleNavMeta;
};

export type SharedRouteDefinition = (RouteElementDefinition | RouteLazyDefinition) & {
  id: string;
  path: string;
};

export interface RoleRouteGroup {
  role: UserRole;
  basePath: string;
  section: string;
  routes: RoleRouteDefinition[];
}

export interface SidebarNavItem {
  label: string;
  path: string;
  iconKey: NavigationIconKey;
  section: string;
}

const makeRoleGroup = (config: RoleRouteGroup): RoleRouteGroup => config;

const lazyNamed = <TModule, TExport extends keyof TModule>(
  importer: () => Promise<TModule>,
  exportName: TExport
): LazyPageImport => {
  return async () => {
    const mod = await importer();
    return {
      default: mod[exportName] as ComponentType,
    };
  };
};

const lazyDefault = <TModule extends { default: ComponentType }>(
  importer: () => Promise<TModule>
): LazyPageImport => importer as LazyPageImport;

export const ROLE_ROUTE_REGISTRY: Record<UserRole, RoleRouteGroup> = {
  ADMIN: makeRoleGroup({
    role: 'ADMIN',
    basePath: '/admin',
    section: 'Administration',
    routes: [
      {
        id: 'admin-dashboard',
        path: 'dashboard',
        lazy: lazyNamed(() => import('../pages/admin/AdminDashboard.page'), 'AdminDashboard'),
        nav: { label: 'Dashboard', iconKey: 'shield' },
      },
      {
        id: 'admin-users',
        path: 'users',
        lazy: lazyNamed(() => import('../pages/admin/UsersManagement.page'), 'UsersManagement'),
        nav: { label: 'Users', iconKey: 'users' },
      },
      {
        id: 'admin-reference-data',
        path: 'reference-data',
        lazy: lazyNamed(() => import('../pages/admin/ReferenceData.page'), 'ReferenceDataManagement'),
        nav: { label: 'Reference Data', iconKey: 'sliders-horizontal' },
      },
    ],
  }),
  MANAGER: makeRoleGroup({
    role: 'MANAGER',
    basePath: '/manager',
    section: 'Manager',
    routes: [
      {
        id: 'manager-dashboard',
        path: 'dashboard',
        lazy: lazyNamed(() => import('../pages/manager/ManagerDashboard.page'), 'ManagerDashboard'),
        nav: { label: 'Performance', iconKey: 'bar-chart-3' },
      },
      {
        id: 'manager-projects',
        path: 'projects',
        lazy: lazyNamed(() => import('../pages/manager/ProjectsEnhanced.page'), 'ProjectsEnhanced'),
        nav: { label: 'Projects', iconKey: 'folder-kanban' },
      },
      {
        id: 'manager-project-details',
        path: 'projects/:id',
        lazy: lazyNamed(() => import('../pages/manager/ProjectDetails.page'), 'ProjectDetails'),
      },
      {
        id: 'manager-allocations',
        path: 'allocations',
        lazy: lazyNamed(() => import('../pages/manager/ResourceAllocation.page'), 'ResourceAllocation'),
        nav: { label: 'Allocations', iconKey: 'layout-dashboard' },
      },
      {
        id: 'manager-risks',
        path: 'risks',
        lazy: lazyNamed(() => import('../pages/manager/RisksAndCriticalTickets.page'), 'RisksAndCriticalTickets'),
        nav: { label: 'Risks', iconKey: 'triangle-alert' },
      },
      {
        id: 'manager-tickets',
        path: 'tickets',
        lazy: lazyNamed(() => import('../pages/manager/ManagerTickets.page'), 'ManagerTickets'),
        nav: { label: 'Tickets', iconKey: 'ticket' },
      },
      {
        id: 'manager-ticket-details',
        path: 'tickets/:ticketId',
        lazy: lazyNamed(() => import('../pages/shared/TicketDetailsPage.page'), 'TicketDetailsPage'),
      },
      {
        id: 'manager-objects',
        path: 'objects',
        lazy: lazyNamed(() => import('../pages/shared/DocumentationObjectsPage.page'), 'DocumentationObjectsPage'),
        nav: { label: 'Objects', iconKey: 'book-open-text' },
      },
      {
        id: 'manager-ai-dispatch-redirect',
        path: 'ai-dispatch',
        redirectTo: '/manager/allocations',
      },
      {
        id: 'manager-certifications',
        path: 'certifications',
        lazy: lazyNamed(() => import('../pages/manager/CertifiedConsultants.page'), 'CertifiedConsultants'),
        nav: { label: 'Certifications', iconKey: 'award' },
      },
      {
        id: 'manager-leave',
        path: 'leave',
        lazy: lazyNamed(() => import('../pages/gestion/GestionManagerFiori.page'), 'GestionManagerFiori'),
        nav: { label: 'Conges', iconKey: 'calendar-days' },
      },
      {
        id: 'manager-imputations',
        path: 'imputations',
        lazy: lazyNamed(() => import('../pages/manager/ImputationsEquipe.page'), 'ImputationsEquipe'),
        nav: { label: 'Imputations', iconKey: 'clock' },
      },
      {
        id: 'manager-pending-approvals',
        path: 'pending-approvals',
        lazy: lazyNamed(() => import('../pages/manager/PendingApprovals.page'), 'PendingApprovals'),
        nav: { label: 'Approvals', iconKey: 'shield' },
      },
      {
        id: 'manager-wricef',
        path: 'wricef',
        lazy: lazyNamed(() => import('../pages/manager/WricefManagement.page'), 'WricefManagement'),
        nav: { label: 'WRICEF', iconKey: 'wrench' },
      },
      {
        id: 'manager-evaluations',
        path: 'evaluations',
        lazy: lazyNamed(() => import('../pages/manager/EvaluationsManagement.page'), 'EvaluationsManagement'),
        nav: { label: 'Evaluations', iconKey: 'gauge' },
      },
    ],
  }),
  CONSULTANT_TECHNIQUE: makeRoleGroup({
    role: 'CONSULTANT_TECHNIQUE',
    basePath: '/consultant-tech',
    section: 'Tech Consultant',
    routes: [
      {
        id: 'tech-dashboard',
        path: 'dashboard',
        lazy: lazyNamed(() => import('../pages/consultant-tech/TechDashboard.page'), 'TechDashboard'),
        nav: { label: 'Dashboard', iconKey: 'gauge' },
      },
      {
        id: 'tech-projects',
        path: 'projects',
        lazy: lazyNamed(() => import('../pages/consultant-tech/MyProjects.page'), 'MyProjects'),
        nav: { label: 'Projects', iconKey: 'folder-kanban' },
      },
      {
        id: 'tech-tickets',
        path: 'tickets',
        lazy: lazyNamed(() => import('../pages/consultant-tech/TechTickets.page'), 'TechTickets'),
        nav: { label: 'Tickets', iconKey: 'ticket' },
      },
      {
        id: 'tech-ticket-details',
        path: 'tickets/:ticketId',
        lazy: lazyNamed(() => import('../pages/shared/TicketDetailsPage.page'), 'TicketDetailsPage'),
      },
      {
        id: 'tech-certifications',
        path: 'certifications',
        lazy: lazyNamed(() => import('../pages/consultant-tech/MyCertifications.page'), 'MyCertifications'),
        nav: { label: 'Certifications', iconKey: 'award' },
      },
      {
        id: 'tech-leave',
        path: 'leave',
        lazy: lazyNamed(() => import('../pages/gestion/GestionConsultantFiori.page'), 'GestionConsultantFiori'),
        nav: { label: 'Conges', iconKey: 'calendar-days' },
      },
      {
        id: 'tech-imputations',
        path: 'imputations',
        lazy: lazyNamed(() => import('../pages/consultant-tech/MesImputations.page'), 'MesImputations'),
        nav: { label: 'Imputations', iconKey: 'clock' },
      },
      {
        id: 'tech-objects',
        path: 'objects',
        lazy: lazyNamed(() => import('../pages/shared/DocumentationObjectsPage.page'), 'DocumentationObjectsPage'),
        nav: { label: 'Objects', iconKey: 'book-open-text' },
      },
    ],
  }),
  CONSULTANT_FONCTIONNEL: makeRoleGroup({
    role: 'CONSULTANT_FONCTIONNEL',
    basePath: '/consultant-func',
    section: 'Functional Consultant',
    routes: [
      {
        id: 'func-dashboard',
        path: 'dashboard',
        lazy: lazyNamed(() => import('../pages/consultant-func/FuncDashboard.page'), 'FuncDashboard'),
        nav: { label: 'Dashboard', iconKey: 'gauge' },
      },
      {
        id: 'func-projects',
        path: 'projects',
        lazy: lazyNamed(() => import('../pages/consultant-func/Projects.page'), 'FuncProjects'),
        nav: { label: 'Projects', iconKey: 'folder-kanban' },
      },
      {
        id: 'func-deliverables',
        path: 'deliverables',
        lazy: lazyNamed(() => import('../pages/consultant-func/Deliverables.page'), 'Deliverables'),
        nav: { label: 'Deliverables', iconKey: 'wrench' },
      },
      {
        id: 'func-tickets',
        path: 'tickets',
        lazy: lazyNamed(() => import('../pages/consultant-func/Tickets.page'), 'FuncTickets'),
        nav: { label: 'Tickets', iconKey: 'ticket' },
      },
      {
        id: 'func-ticket-details',
        path: 'tickets/:ticketId',
        lazy: lazyNamed(() => import('../pages/shared/TicketDetailsPage.page'), 'TicketDetailsPage'),
      },
      {
        id: 'func-objects',
        path: 'objects',
        lazy: lazyNamed(() => import('../pages/shared/DocumentationObjectsPage.page'), 'DocumentationObjectsPage'),
        nav: { label: 'Objects', iconKey: 'book-open-text' },
      },
    ],
  }),
  PROJECT_MANAGER: makeRoleGroup({
    role: 'PROJECT_MANAGER',
    basePath: '/project-manager',
    section: 'Project Manager',
    routes: [
      {
        id: 'pm-dashboard',
        path: 'dashboard',
        lazy: lazyDefault(() => import('../pages/project-manager/ProjectManagerDashboard.page')),
        nav: { label: 'Dashboard', iconKey: 'gauge' },
      },
      {
        id: 'pm-projects',
        path: 'projects',
        lazy: lazyNamed(() => import('../pages/manager/ProjectsEnhanced.page'), 'ProjectsEnhanced'),
        nav: { label: 'Projects', iconKey: 'folder-kanban' },
      },
      {
        id: 'pm-project-details',
        path: 'projects/:id',
        lazy: lazyNamed(() => import('../pages/manager/ProjectDetails.page'), 'ProjectDetails'),
      },
      {
        id: 'pm-tickets',
        path: 'tickets',
        lazy: lazyNamed(() => import('../pages/manager/ManagerTickets.page'), 'ManagerTickets'),
        nav: { label: 'Tickets', iconKey: 'ticket' },
      },
      {
        id: 'pm-ticket-details',
        path: 'tickets/:ticketId',
        lazy: lazyNamed(() => import('../pages/shared/TicketDetailsPage.page'), 'TicketDetailsPage'),
      },
      {
        id: 'pm-ai-dispatch-redirect',
        path: 'ai-dispatch',
        redirectTo: '/project-manager/allocations',
      },
      {
        id: 'pm-objects',
        path: 'objects',
        lazy: lazyNamed(() => import('../pages/shared/DocumentationObjectsPage.page'), 'DocumentationObjectsPage'),
        nav: { label: 'Objects', iconKey: 'book-open-text' },
      },
      {
        id: 'pm-ticket-groups-redirect',
        path: 'ticket-groups',
        redirectTo: '/project-manager/objects',
      },
      {
        id: 'pm-allocations',
        path: 'allocations',
        lazy: lazyNamed(() => import('../pages/manager/ResourceAllocation.page'), 'ResourceAllocation'),
        nav: { label: 'Allocations', iconKey: 'layout-dashboard' },
      },
      {
        id: 'pm-imputations',
        path: 'imputations',
        lazy: lazyNamed(() => import('../pages/project-manager/PMImputations.page'), 'PMImputations'),
        nav: { label: 'Imputations', iconKey: 'clock' },
      },
      {
        id: 'pm-wricef-validation',
        path: 'wricef-validation',
        lazy: lazyNamed(() => import('../pages/project-manager/WricefValidation.page'), 'WricefValidation'),
        nav: { label: 'WRICEF Review', iconKey: 'shield' },
      },
      {
        id: 'pm-evaluations',
        path: 'evaluations',
        lazy: lazyNamed(() => import('../pages/manager/EvaluationsManagement.page'), 'EvaluationsManagement'),
        nav: { label: 'Evaluations', iconKey: 'gauge' },
      },
    ],
  }),
  DEV_COORDINATOR: makeRoleGroup({
    role: 'DEV_COORDINATOR',
    basePath: '/dev-coordinator',
    section: 'Dev Coordinator',
    routes: [
      {
        id: 'dev-coord-dashboard',
        path: 'dashboard',
        lazy: lazyDefault(() => import('../pages/dev-coordinator/DevCoordinatorDashboard.page')),
        nav: { label: 'Dashboard', iconKey: 'gauge' },
      },
      {
        id: 'dev-coord-tickets',
        path: 'tickets',
        lazy: lazyNamed(() => import('../pages/manager/ManagerTickets.page'), 'ManagerTickets'),
        nav: { label: 'Tickets', iconKey: 'ticket' },
      },
      {
        id: 'dev-coord-ticket-details',
        path: 'tickets/:ticketId',
        lazy: lazyNamed(() => import('../pages/shared/TicketDetailsPage.page'), 'TicketDetailsPage'),
      },
      {
        id: 'dev-coord-objects',
        path: 'objects',
        lazy: lazyNamed(() => import('../pages/shared/DocumentationObjectsPage.page'), 'DocumentationObjectsPage'),
        nav: { label: 'Objects', iconKey: 'book-open-text' },
      },
      {
        id: 'dev-coord-ticket-groups-redirect',
        path: 'ticket-groups',
        redirectTo: '/dev-coordinator/objects',
      },
      {
        id: 'dev-coord-workload',
        path: 'workload',
        lazy: lazyDefault(() => import('../pages/dev-coordinator/WorkloadPage.page')),
        nav: { label: 'Workload', iconKey: 'bar-chart-3' },
      },
      {
        id: 'dev-coord-imputations',
        path: 'imputations',
        lazy: lazyNamed(() => import('../pages/dev-coordinator/DevCoordImputations.page'), 'DevCoordImputations'),
        nav: { label: 'Imputations', iconKey: 'clock' },
      },
    ],
  }),
};

export const SHARED_ROUTE_REGISTRY: SharedRouteDefinition[] = [
  {
    id: 'shared-profile',
    path: 'profile',
    lazy: lazyNamed(() => import('../pages/shared/Profile.page'), 'ProfilePage'),
  },
  {
    id: 'shared-settings',
    path: 'settings',
    lazy: lazyNamed(() => import('../pages/shared/Settings.page'), 'SettingsPage'),
  },
  {
    id: 'shared-documentation-details',
    path: 'shared/documentation/:id',
    lazy: lazyNamed(() => import('../pages/shared/DocumentationDetails.page'), 'DocumentationDetails'),
  },
];

export const ROLE_ORDER: UserRole[] = [
  'ADMIN',
  'MANAGER',
  'PROJECT_MANAGER',
  'DEV_COORDINATOR',
  'CONSULTANT_TECHNIQUE',
  'CONSULTANT_FONCTIONNEL',
];

export const getBaseRouteForRole = (role: UserRole): string =>
  ROLE_ROUTE_REGISTRY[role]?.basePath ?? '';

export const getDefaultRouteForRole = (role: UserRole): string => {
  const group = ROLE_ROUTE_REGISTRY[role];
  if (!group) return '';

  const dashboardRoute = group.routes.find((route) => route.path === 'dashboard');
  return `${group.basePath}/${dashboardRoute?.path ?? 'dashboard'}`;
};

export const getRoleRouteDefinitions = (role: UserRole): RoleRouteDefinition[] =>
  ROLE_ROUTE_REGISTRY[role]?.routes ?? [];

export const getSharedRouteDefinitions = (): SharedRouteDefinition[] => SHARED_ROUTE_REGISTRY;

export const getSidebarItemsForRole = (role: UserRole): SidebarNavItem[] => {
  const group = ROLE_ROUTE_REGISTRY[role];
  if (!group) return [];

  return group.routes
    .filter((route) => Boolean(route.nav))
    .map((route) => ({
      label: route.nav!.label,
      path: `${group.basePath}/${route.path}`,
      iconKey: route.nav!.iconKey,
      section: group.section,
    }));
};
