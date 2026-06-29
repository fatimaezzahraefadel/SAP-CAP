// React Router configuration with role-based routing

import { lazy, Suspense, type ReactElement } from 'react';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  useLocation,
  type RouteObject,
} from 'react-router';
import { MainLayout } from './components/layout/MainLayout';
import { Login } from './pages/Login.page';
import { useAuth } from './context/AuthContext';
import { getDefaultRouteForRole } from './context/roleRouting';
import { UserRole } from './types/entities';
import i18n from '../i18n';
import {
  getSharedRouteDefinitions,
  ROLE_ORDER,
  ROLE_ROUTE_REGISTRY,
  type LazyPageImport,
  type RoleRouteDefinition,
  type SharedRouteDefinition,
} from './routing/routeRegistry';

const PageLoader = () => (
  <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
    {i18n.t('common.loading')}
  </div>
);

const SuspensePage = ({ children }: { children: ReactElement }) => (
  <Suspense fallback={<PageLoader />}>{children}</Suspense>
);

const AuthLoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
    {i18n.t('common.loadingSession')}
  </div>
);

const RequireAuth = ({ children }: { children: ReactElement }) => {
  const { currentUser, isAuthenticated, isAuthLoading } = useAuth();
  const location = useLocation();

  if (isAuthLoading) {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated || !currentUser) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: `${location.pathname}${location.search}${location.hash}`,
        }}
      />
    );
  }

  return children;
};

const PublicOnlyRoute = ({ children }: { children: ReactElement }) => {
  const { currentUser, isAuthenticated, isAuthLoading } = useAuth();

  if (isAuthLoading) {
    return <AuthLoadingScreen />;
  }

  if (isAuthenticated && currentUser) {
    return <Navigate to={getDefaultRouteForRole(currentUser.role)} replace />;
  }

  return children;
};

const RequireRole = ({ allowedRoles }: { allowedRoles: UserRole[] }) => {
  const { currentUser, isAuthenticated, isAuthLoading } = useAuth();

  if (isAuthLoading) {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated || !currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(currentUser.role)) {
    return <Navigate to={getDefaultRouteForRole(currentUser.role)} replace />;
  }

  return <Outlet />;
};

const RoleDashboardRedirect = () => {
  const { currentUser, isAuthenticated, isAuthLoading } = useAuth();

  if (isAuthLoading) {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated || !currentUser) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={getDefaultRouteForRole(currentUser.role)} replace />;
};

const renderLazyRoute = (loader: LazyPageImport): ReactElement => {
  const LazyComponent = lazy(loader);
  return (
    <ErrorBoundary>
      <SuspensePage>
        <LazyComponent />
      </SuspensePage>
    </ErrorBoundary>
  );
};

const renderRouteDefinition = (
  route: RoleRouteDefinition | SharedRouteDefinition
): ReactElement => {
  if ('redirectTo' in route) {
    return <Navigate to={route.redirectTo} replace />;
  }

  if ('element' in route && route.element) {
    return route.element;
  }

  if ('lazy' in route && route.lazy) {
    return renderLazyRoute(route.lazy);
  }

  return <Navigate to="/dashboard" replace />;
};

const buildRoleChildren = (role: UserRole): RouteObject[] => {
  const group = ROLE_ROUTE_REGISTRY[role];

  const roleRoutes: RouteObject[] = group.routes.map((route) => ({
    path: route.path,
    element: renderRouteDefinition(route),
  }));

  return [
    {
      index: true,
      element: <Navigate to="dashboard" replace />,
    },
    ...roleRoutes,
  ];
};

const roleBranches: RouteObject[] = ROLE_ORDER.map((role) => ({
  path: ROLE_ROUTE_REGISTRY[role].basePath.slice(1),
  element: <RequireRole allowedRoles={[role]} />,
  children: buildRoleChildren(role),
}));

const sharedRoutes: RouteObject[] = getSharedRouteDefinitions().map((route) => ({
  path: route.path,
  element: renderRouteDefinition(route),
}));

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <PublicOnlyRoute>
        <Login />
      </PublicOnlyRoute>
    ),
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <MainLayout />
      </RequireAuth>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: <RoleDashboardRedirect />,
      },
      {
        path: 'index.html',
        element: <Navigate to="/dashboard" replace />,
      },
      ...roleBranches,
      ...sharedRoutes,
      {
        path: '*',
        element: (
          <div className="p-6">
            <h1 className="text-2xl font-semibold">Page not found</h1>
            <p className="mt-2 text-muted-foreground">
              {i18n.t('common.pageNotFoundDesc')}
            </p>
          </div>
        ),
      },
    ],
  },
  {
    path: '*',
    element: (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="mb-2 text-4xl font-bold text-foreground">404</h1>
          <p className="text-muted-foreground">{i18n.t('common.pageNotFound')}</p>
        </div>
      </div>
    ),
  },
]);
