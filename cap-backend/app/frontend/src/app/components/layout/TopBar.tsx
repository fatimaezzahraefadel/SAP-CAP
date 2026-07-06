import React, { useEffect, useMemo, useState } from 'react';
import { matchPath, useLocation, useNavigate } from 'react-router';
import {
  BookMarked,
  Bell,
  CheckCircle2,
  LogOut,
  Menu,
  Moon,
  PanelLeft,
  Settings,
  Sun,
  User,
  X,
  AlignJustify,
  AlignVerticalSpaceAround,
  Globe,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useDensity } from '../../context/DensityContext';
import { NotificationsAPI } from '../../services/odata/notificationsApi';
import { getBaseRouteForRole, getRoleRouteDefinitions } from '../../routing/routeRegistry';
import { Notification } from '../../types/entities';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import inetumHeaderLogo from '../../../assets/inetum-2-logo.png';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

interface TopBarProps {
  mobileOpen: boolean;
  sidebarCollapsed: boolean;
  onMenuToggle: () => void;
  onToggleCollapse: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  mobileOpen,
  sidebarCollapsed,
  onMenuToggle,
  onToggleCollapse,
}) => {
  const { t, i18n } = useTranslation();
  const { currentUser, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { density, toggleDensity } = useDensity();
  const navigate = useNavigate();
  const location = useLocation();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const displayName = currentUser?.name ?? t('common.guest');

  const initials = useMemo(() => {
    if (!displayName.trim()) return 'G';
    const parts = displayName.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const second = parts[1]?.[0] ?? '';
    return `${first}${second}`.toUpperCase();
  }, [displayName]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    let mounted = true;
    let canPoll = true;

    const load = async () => {
      if (!mounted || !canPoll) return;
      try {
        const notificationData = await NotificationsAPI.getByUser(currentUser.id);
        if (mounted) {
          setNotifications(notificationData.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
        }
      } catch (error) {
        const status =
          typeof error === 'object' && error !== null
            ? (error as { status?: unknown }).status
            : undefined;

        if (status === 401 || status === 403) {
          canPoll = false;
          if (mounted) setNotifications([]);
          return;
        }

        if (mounted) {
          console.error('[TopBar] Failed to load notifications:', error);
        }
      }
    };

    void load();

    // Poll every 15 seconds in production
    const intervalId = setInterval(() => {
      void load();
    }, 15000);

    return () => {
      mounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [currentUser]);

  const visibleNotifications = useMemo(
    () => (currentUser ? notifications : []),
    [currentUser, notifications]
  );

  const unreadCount = useMemo(
    () => visibleNotifications.filter((notification) => !notification.read).length,
    [visibleNotifications]
  );

  const currentRoleLabel = currentUser ? t(`roles.${currentUser.role}`) : null;
  const currentWorkspaceLabel = useMemo(() => {
    if (!currentUser) return null;

    const routeDefinitions = getRoleRouteDefinitions(currentUser.role);
    const basePath = getBaseRouteForRole(currentUser.role);
    const fullRouteDefinitions = routeDefinitions.map((route) => ({
      ...route,
      fullPath: `${basePath}/${route.path}`,
    }));

    const exactMatch = fullRouteDefinitions.find((route) =>
      matchPath({ path: route.fullPath, end: true }, location.pathname)
    );

    if (exactMatch?.nav) {
      return t(`sidebar.items.${exactMatch.nav.label}`, exactMatch.nav.label);
    }

    const sectionMatch = fullRouteDefinitions
      .filter((route) => route.nav)
      .find((route) => matchPath({ path: route.fullPath, end: false }, location.pathname));

    if (sectionMatch?.nav) {
      return t(`sidebar.items.${sectionMatch.nav.label}`, sectionMatch.nav.label);
    }

    return currentRoleLabel;
  }, [currentRoleLabel, currentUser, location.pathname, t]);

  const currentLocale = (i18n.resolvedLanguage ?? i18n.language).toUpperCase();

  const getLegacyNotificationTarget = (notification: Notification): string | null => {
    if (!currentUser) {
      return null;
    }

    const roleBasePath = getBaseRouteForRole(currentUser.role);
    const type = notification.type?.toUpperCase() ?? '';

    switch (type) {
      case 'TICKET_ASSIGNED':
      case 'TICKET_REJECTED':
      case 'TICKET_UPDATED':
      case 'TICKET_STATUS':
        return `${roleBasePath}/tickets`;
      case 'LEAVE_DECISION':
        return currentUser.role === 'MANAGER' ? '/manager/leave' : `${roleBasePath}/leave`;
      case 'ALLOCATION_UPDATED':
        return currentUser.role === 'MANAGER' || currentUser.role === 'PROJECT_MANAGER'
          ? `${roleBasePath}/allocations`
          : `${roleBasePath}/projects`;
      case 'DELIVERABLE_SUBMITTED':
      case 'DELIVERABLE_REVIEWED':
        return currentUser.role === 'CONSULTANT_FONCTIONNEL'
          ? '/consultant-func/deliverables'
          : `${roleBasePath}/projects`;
      case 'PROJECT_FEEDBACK':
        return `${roleBasePath}/projects`;
      case 'WRICEF_SUBMITTED':
      case 'WRICEF_VALIDATED':
      case 'WRICEF_REJECTED':
        if (currentUser.role === 'PROJECT_MANAGER') return '/project-manager/wricef-validation';
        if (currentUser.role === 'MANAGER') return '/manager/wricef';
        return `${roleBasePath}/dashboard`;
      default:
        return `${roleBasePath}/dashboard`;
    }
  };

  const resolveNotificationTarget = (notification: Notification): string | null => {
    const rawTarget = notification.targetPath?.trim();
    if (!currentUser) {
      return null;
    }

    if (!rawTarget) {
      return getLegacyNotificationTarget(notification);
    }

    return rawTarget.replace('{roleBasePath}', getBaseRouteForRole(currentUser.role));
  };

  const markNotificationAsRead = async (notificationId: string) => {
    try {
      await NotificationsAPI.markAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((notification) =>
          notification.id === notificationId ? { ...notification, read: true } : notification
        )
      );
    } catch {
      toast.error(t('common.errors.loadFailed'));
    }
  };

  const handleNotificationSelect = async (notification: Notification) => {
    if (!notification.read) {
      await markNotificationAsRead(notification.id);
    }

    const target = resolveNotificationTarget(notification);
    if (target) {
      navigate(target);
    }
  };

  const changeLanguage = (lng: string) => {
    const normalizedLng = lng.toLowerCase();
    void i18n.changeLanguage(normalizedLng);
    localStorage.setItem('i18nextLng', normalizedLng);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-surface-1/92 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-6 lg:px-8">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onMenuToggle}
          aria-expanded={mobileOpen}
          aria-controls="app-mobile-navigation"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          <span className="sr-only">{t('common.toggleNavigation')}</span>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="hidden md:inline-flex"
          onClick={onToggleCollapse}
          aria-pressed={sidebarCollapsed}
          title={sidebarCollapsed ? t('common.expandSidebar') : t('common.collapseSidebar')}
        >
          <PanelLeft className="h-4 w-4" />
          <span className="sr-only">
            {sidebarCollapsed ? t('common.expandSidebar') : t('common.collapseSidebar')}
          </span>
        </Button>

        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-28 shrink-0 items-center rounded-md border border-border/70 bg-white px-2 shadow-sm sm:w-32 lg:w-36">
            <img
              src={inetumHeaderLogo}
              alt="Inetum"
              className="h-6 w-full object-contain"
            />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              {t('login.platformName')}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-foreground sm:text-base">{displayName}</p>
              {currentRoleLabel && (
                <Badge variant="secondary" className="hidden rounded-full px-2.5 py-1 text-[10px] sm:inline-flex">
                  {currentRoleLabel}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="ml-auto hidden min-w-0 items-center gap-2 rounded-full border border-border/70 bg-background/75 px-3 py-2 text-sm text-muted-foreground backdrop-blur lg:flex">
          <BookMarked className="h-4 w-4 text-primary" />
          <span className="truncate font-medium text-foreground">{currentWorkspaceLabel}</span>
          <span className="h-1.5 w-1.5 rounded-full bg-border" />
          <span>{currentLocale}</span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 rounded-full px-3 text-muted-foreground"
              title={t('common.switchLanguage')}
            >
              <Globe className="h-4 w-4" />
              <span className="hidden text-xs font-semibold sm:inline">{currentLocale}</span>
              <span className="sr-only">{t('common.switchLanguage')}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => changeLanguage('en')}>
              {t('common.english')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => changeLanguage('fr')}>
              {t('common.french')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground"
          onClick={toggleDensity}
          aria-pressed={density === 'compact'}
          title={density === 'compact' ? t('common.comfortableDensity') : t('common.compactDensity')}
        >
          {density === 'compact' ? (
            <AlignJustify className="h-4 w-4" />
          ) : (
            <AlignVerticalSpaceAround className="h-4 w-4" />
          )}
          <span className="sr-only">
            {density === 'compact' ? t('common.comfortableDensity') : t('common.compactDensity')}
          </span>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground"
          onClick={toggleTheme}
          aria-pressed={theme === 'dark'}
          title={theme === 'dark' ? t('common.lightMode') : t('common.darkMode')}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          <span className="sr-only">
            {theme === 'dark' ? t('common.lightMode') : t('common.darkMode')}
          </span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative text-muted-foreground">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <Badge className="absolute -right-1.5 -top-1.5 h-5 min-w-5 rounded-full px-1.5 text-[10px]">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Badge>
              )}
              <span className="sr-only">{t('common.notifications')}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[320px]">
            <DropdownMenuLabel>{t('common.notifications')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {visibleNotifications.length === 0 ? (
              <p className="px-2 py-4 text-sm text-muted-foreground">{t('common.noNotifications')}</p>
            ) : (
              visibleNotifications.slice(0, 8).map((notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  onSelect={() => void handleNotificationSelect(notification)}
                  className="flex cursor-pointer flex-col items-start gap-1 rounded-lg p-3"
                >
                  <div className="flex w-full items-start justify-between gap-2">
                    <span className="font-medium text-foreground">{notification.title}</span>
                    {!notification.read ? (
                      <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                    ) : (
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-primary/70" />
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{notification.message}</span>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-10 gap-2 rounded-full px-2 sm:px-3"
              aria-label={t('common.profile')}
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/12 font-semibold text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden min-w-0 text-left sm:block">
                <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
                {currentRoleLabel && (
                  <p className="truncate text-xs text-muted-foreground">{currentRoleLabel}</p>
                )}
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="space-y-1">
              <p className="font-semibold text-foreground">{currentUser?.name}</p>
              <p className="text-xs font-normal text-muted-foreground">{currentUser?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate('/profile')}>
              <User className="h-4 w-4" />
              {t('common.profile')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate('/settings')}>
              <Settings className="h-4 w-4" />
              {t('common.settings')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => {
                // Prevent Radix from closing the menu and interfering
                e.preventDefault();
                logout();
                // Navigate after state has cleared
                queueMicrotask(() => navigate('/login', { replace: true }));
              }}
            >
              <LogOut className="h-4 w-4" />
              {t('common.logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

