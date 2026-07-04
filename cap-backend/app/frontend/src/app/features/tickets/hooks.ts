import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { getBaseRouteForRole } from '../../context/roleRouting';
import { createTicketWithUnifiedFlow } from '../../services/ticketCreation';
import { getProjectAbaqueEstimate } from '../../utils/projectAbaque';
import {
  Project,
  SAPModule,
  Ticket,
  TicketComplexity,
  TicketEvent,
  TicketStatus,
  User,
  UserRole,
  WricefObject,
} from '../../types/entities';
import { isAbortError } from '../../utils/async';import { WricefObjectsAPI } from '../../services/odata/wricefObjectsApi';
import {
  buildCalendarDays,
  buildTicketsByDate,
  filterTickets,
} from './model';
import { ManagerTicketsAPI } from './api';
import { EMPTY_FORM, TicketForm, ViewMode } from './components/types';
import { isStatusTransitionAllowed } from './components/ticketView.constants';

export const useManagerTicketsBootstrap = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  const reload = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError(null);

    try {
      const data = await ManagerTicketsAPI.getBootstrapData({ signal: controller.signal });
      if (controller.signal.aborted) return;

      setProjects(data.projects);
      setUsers(data.users);
      setTickets(data.tickets);
      setError(data.errors.length > 0 ? data.errors.join(' ') : null);
    } catch (err) {
      if (!isAbortError(err)) {
        console.error('[useManagerTicketsBootstrap] Failed to load bootstrap data', err);
        setError(err instanceof Error ? err.message : 'Failed to load ticket data');
      }
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  }, []);

  // Refetches tickets from the server without flipping the page-level loading
  // state, so we can silently reconcile after a mutation (e.g. a create whose
  // response came back incomplete) without flashing a skeleton over the list.
  const refreshTickets = useCallback(async () => {
    try {
      const fresh = await ManagerTicketsAPI.listTickets();
      setTickets(fresh);
    } catch (err) {
      if (!isAbortError(err)) {
        console.error('[useManagerTicketsBootstrap] Failed to refresh tickets', err);
      }
    }
  }, []);

  useEffect(() => {
    void reload();

    return () => {
      requestRef.current?.abort();
      requestRef.current = null;
    };
  }, [reload]);

  return {
    projects,
    setProjects,
    users,
    setUsers,
    tickets,
    setTickets,
    loading,
    error,
    reload,
    refreshTickets,
  };
};

export const useManagerTicketsMutations = () => {
  return {
    updateTicket: ManagerTicketsAPI.updateTicket,
    deleteTicket: ManagerTicketsAPI.deleteTicket,
    createNotification: ManagerTicketsAPI.createNotification,
  };
};

export interface ManagerTicketsViewModel {
  currentUserId?: string;
  currentUserRole?: UserRole;
  roleBasePath: string;
  loading: boolean;
  error: string | null;
  isViewOnly: boolean;
  canDragStatus: boolean;
  canMoveTicket: (ticket: Ticket, target: TicketStatus) => boolean;
  hideApprovalColumns: boolean;
  projects: Project[];
  users: User[];
  tickets: Ticket[];
  filteredTickets: Ticket[];
  ticketsByDate: Record<string, Ticket[]>;
  calendarDays: { date: string; day: number; isCurrentMonth: boolean }[];
  calendarMonth: string;
  viewMode: ViewMode;
  showAdvancedFilters: boolean;
  selectedTicket: Ticket | null;
  showCreate: boolean;
  form: TicketForm;
  selectedProject: Project | undefined;
  wricefObjects: WricefObject[];
  isManualWricef: boolean;
  abaqueSuggestedHours: number | null;
  isEstimatedByAbaque: boolean;
  isSubmitting: boolean;
  searchQuery: string;
  statusFilter: Ticket['status'] | 'ALL';
  moduleFilter: SAPModule | 'ALL';
  complexityFilter: TicketComplexity | 'ALL';
  projectFilter: string;
  assigneeFilter: string;
  dateFrom: string;
  dateTo: string;
  wricefFilter: string;
  setViewMode: (value: ViewMode) => void;
  setShowAdvancedFilters: React.Dispatch<React.SetStateAction<boolean>>;
  setShowCreate: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedTicket: React.Dispatch<React.SetStateAction<Ticket | null>>;
  setForm: React.Dispatch<React.SetStateAction<TicketForm>>;
  setIsManualWricef: React.Dispatch<React.SetStateAction<boolean>>;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  setStatusFilter: React.Dispatch<React.SetStateAction<Ticket['status'] | 'ALL'>>;
  setModuleFilter: React.Dispatch<React.SetStateAction<SAPModule | 'ALL'>>;
  setComplexityFilter: React.Dispatch<React.SetStateAction<TicketComplexity | 'ALL'>>;
  setProjectFilter: React.Dispatch<React.SetStateAction<string>>;
  setAssigneeFilter: React.Dispatch<React.SetStateAction<string>>;
  setDateFrom: React.Dispatch<React.SetStateAction<string>>;
  setDateTo: React.Dispatch<React.SetStateAction<string>>;
  setWricefFilter: React.Dispatch<React.SetStateAction<string>>;
  onEstimatedByAbaqueChange: (value: boolean) => void;
  onApplyAbaqueEstimate: () => void;
  submitTicket: (event: React.FormEvent) => Promise<void>;
  changeStatus: (ticket: Ticket, newStatus: TicketStatus) => Promise<void>;
  updateTicketDueDate: (ticketId: string, dueDate: string) => Promise<void>;
  deleteTicketById: (ticketId: string) => Promise<void>;
  openTicketDetails: (ticketId: string) => void;
  prevMonth: () => void;
  nextMonth: () => void;
  clearAllFilters: () => void;
  canDeleteTicket: boolean;
  resolveProjectName: (id: string) => string;
  resolveUserName: (id?: string) => string;
  handleDocumentationChanged: (ticketId: string, documentationIds: string[]) => void;
}

export const useManagerTicketsViewModel = (): ManagerTicketsViewModel => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { projects, setProjects, users, tickets, setTickets, loading, error, refreshTickets } = useManagerTicketsBootstrap();
  const { updateTicket, deleteTicket } = useManagerTicketsMutations();

  const isViewOnly = currentUser?.role === 'CONSULTANT_TECHNIQUE';
  // Kanban status drag is allowed for everyone who can reach the board, including
  // tech consultants (the backend still enforces per-ticket ownership and valid
  // workflow transitions, rejecting moves the user isn't allowed to make).
  const canDragStatus = Boolean(currentUser);
  // Role-aware Kanban gate: mirrors the backend ticket policy so the board only
  // offers moves the current user is actually allowed to perform, instead of
  // letting an invalid drop hit the server and bounce back as a 403.
  const canMoveTicket = useCallback(
    (ticket: Ticket, target: TicketStatus): boolean => {
      if (!isStatusTransitionAllowed(ticket.status, target)) return false;
      const role = currentUser?.role;
      if (!role) return false;
      // Staff move tickets freely within valid workflow transitions.
      if (role === 'ADMIN' || role === 'MANAGER' || role === 'PROJECT_MANAGER' || role === 'DEV_COORDINATOR') {
        return true;
      }
      // The assigned technical consultant drives their own tickets.
      if (role === 'CONSULTANT_TECHNIQUE') {
        return ticket.assignedTo === currentUser?.id;
      }
      // The functional consultant may drive their own tickets through any valid
      // workflow transition; tickets they merely test follow the testing moves.
      if (role === 'CONSULTANT_FONCTIONNEL') {
        if (ticket.createdBy === currentUser?.id) return true;
        if (ticket.functionalTesterId === currentUser?.id) {
          return ticket.status === 'IN_TEST' && (target === 'DONE' || target === 'IN_PROGRESS');
        }
        return false;
      }
      return false;
    },
    [currentUser]
  );
  // The technical consultant's board has no approval workflow columns.
  const hideApprovalColumns = currentUser?.role === 'CONSULTANT_TECHNIQUE';
  const canDeleteTicket = currentUser?.role === 'MANAGER' || currentUser?.role === 'PROJECT_MANAGER';
  const [form, setForm] = useState<TicketForm>(EMPTY_FORM);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<Ticket['status'] | 'ALL'>('ALL');
  const [moduleFilter, setModuleFilter] = useState<SAPModule | 'ALL'>('ALL');
  const [complexityFilter, setComplexityFilter] = useState<TicketComplexity | 'ALL'>('ALL');
  const [projectFilter, setProjectFilter] = useState<string>('ALL');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [wricefFilter, setWricefFilter] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  });
  const [isManualWricef, setIsManualWricef] = useState(true);
  const [isEstimatedByAbaque, setIsEstimatedByAbaque] = useState(false);
  const [wricefObjects, setWricefObjects] = useState<WricefObject[]>([]);

  const roleBasePath = currentUser ? getBaseRouteForRole(currentUser.role) : '/manager';

  const resolveUserName = useCallback(
    (id?: string) => users.find((user) => user.id === id)?.name ?? '-',
    [users]
  );
  const resolveProjectName = useCallback(
    (id: string) => projects.find((project) => project.id === id)?.name ?? id,
    [projects]
  );

  const handleDocumentationChanged = useCallback(
    (ticketId: string, documentationIds: string[]) => {
      setTickets((previous) =>
        previous.map((ticket) =>
          ticket.id === ticketId
            ? {
                ...ticket,
                documentationObjectIds: documentationIds.length > 0 ? documentationIds : undefined,
              }
            : ticket
        )
      );
      setSelectedTicket((previous) =>
        previous?.id === ticketId
          ? {
              ...previous,
              documentationObjectIds: documentationIds.length > 0 ? documentationIds : undefined,
            }
          : previous
      );
    },
    [setTickets]
  );

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === form.projectId),
    [projects, form.projectId]
  );

  useEffect(() => {
    if (form.projectId) {
      void WricefObjectsAPI.getByProject(form.projectId).then(setWricefObjects);
    } else {
      setWricefObjects([]);
    }
  }, [form.projectId]);

  const hasWricefObjects = wricefObjects.length > 0;

  useEffect(() => {
    setIsManualWricef(!hasWricefObjects);
  }, [hasWricefObjects, form.projectId]);

  useEffect(() => {
    setIsEstimatedByAbaque(false);
  }, [form.projectId, form.nature, form.complexity]);

  const abaqueSuggestedHours = useMemo(
    () =>
      getProjectAbaqueEstimate(
        selectedProject?.abaqueEstimate,
        form.nature,
        form.complexity
      ),
    [form.complexity, form.nature, selectedProject?.abaqueEstimate]
  );

  const filteredTickets = useMemo(
    () =>
      filterTickets(
        tickets,
        {
          searchQuery,
          statusFilter,
          moduleFilter,
          complexityFilter,
          projectFilter,
          assigneeFilter,
          dateFrom,
          dateTo,
          wricefFilter,
        },
        resolveProjectName
      ),
    [
      assigneeFilter,
      complexityFilter,
      dateFrom,
      dateTo,
      moduleFilter,
      projectFilter,
      resolveProjectName,
      searchQuery,
      statusFilter,
      tickets,
      wricefFilter,
    ]
  );

  const submitTicket = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentUser) return;

    if (!form.projectId || !form.title.trim()) {
      toast.error('Project and title are required');
      return;
    }

    try {
      setIsSubmitting(true);
      const project = projects.find((item) => item.id === form.projectId);
      if (!project) {
        toast.error('Selected project not found');
        return;
      }

      // Functional Consultants cannot assign — ticket goes to PENDING_APPROVAL
      const isFuncConsultant = currentUser.role === 'CONSULTANT_FONCTIONNEL';
      const assignedTo = isFuncConsultant ? currentUser.id : (form.assignedTo || undefined);
      const assignedUser = assignedTo
        ? users.find((user) => user.id === assignedTo)
        : undefined;

      const { ticket: created, updatedProject } = await createTicketWithUnifiedFlow({
        project,
        wricefObjects,
        existingProjectTickets: tickets.filter((ticket) => ticket.projectId === project.id),
        createdBy: currentUser.id,
        assignedTo,
        assignedToRole: isFuncConsultant ? currentUser.role : assignedUser?.role,
        priority: form.priority,
        nature: form.nature,
        title: form.title.trim(),
        description: form.description.trim(),
        dueDate: form.dueDate || undefined,
        module: form.module,
        complexity: form.complexity,
        estimationHours: form.estimationHours,
        estimatedViaAbaque: isEstimatedByAbaque,
        selectedWricefObjectId: !isManualWricef ? form.wricefId.trim() || undefined : undefined,
        manualWricefId: isManualWricef ? form.wricefId.trim() || undefined : undefined,
        creationComment: isEstimatedByAbaque
          ? 'Ticket created with project matrix estimation'
          : 'Ticket created',
      });

      // The create response can come back incomplete (e.g. a `return=minimal`
      // reply), leaving the row without id/status/ticketCode — which then breaks
      // opening or deleting it. Only show it optimistically when it's complete,
      // and always reconcile against the authoritative server copy.
      if (created.id && created.status) {
        setTickets((previous) => [created, ...previous]);
      }
      if (updatedProject) {
        setProjects((previous) =>
          previous.map((item) => (item.id === updatedProject.id ? updatedProject : item))
        );
      }

      setForm(EMPTY_FORM);
      setShowCreate(false);
      toast.success('Ticket created successfully');
      void refreshTickets();
    } catch {
      toast.error('Failed to create ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  const changeStatus = async (ticket: Ticket, newStatus: TicketStatus) => {
    if (!currentUser) return;

    const event: TicketEvent = {
      id: `te${Date.now()}`,
      timestamp: new Date().toISOString(),
      userId: currentUser.id,
      action: 'STATUS_CHANGE',
      fromValue: ticket.status,
      toValue: newStatus,
    };

    try {
      const updated = await updateTicket(ticket.id, {
        status: newStatus,
        history: [...(ticket.history || []), event],
      });
      setTickets((previous) => previous.map((item) => (item.id === ticket.id ? updated : item)));
      if (selectedTicket?.id === ticket.id) {
        setSelectedTicket(updated);
      }
      toast.success(`Status -> ${newStatus.replace('_', ' ')}`);
    } catch (err) {
      const detail =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: unknown }).message ?? '')
          : '';
      toast.error(detail ? `Failed to update status: ${detail}` : 'Failed to update status');
    }
  };

  const updateTicketDueDate = async (ticketId: string, dueDate: string) => {
    const ticket = tickets.find((item) => item.id === ticketId);
    if (!ticket) return;

    try {
      const updated = await updateTicket(ticket.id, { dueDate });
      setTickets((previous) => previous.map((item) => (item.id === updated.id ? updated : item)));
      toast.success(`Due date -> ${dueDate}`);
    } catch {
      toast.error('Failed to update due date');
    }
  };

  const deleteTicketById = async (ticketId: string) => {
    // A missing id means the row was built from an incomplete create response;
    // there is nothing to delete on the server. Drop it locally and re-sync.
    if (!ticketId) {
      setTickets((previous) => previous.filter((item) => item.id));
      void refreshTickets();
      return;
    }
    try {
      await deleteTicket(ticketId);
      setTickets((previous) => previous.filter((item) => item.id !== ticketId));
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket(null);
      }
      toast.success('Ticket deleted successfully');
    } catch {
      toast.error('Failed to delete ticket');
    }
  };

  const openTicketDetails = useCallback(
    (ticketId: string) => navigate(`${roleBasePath}/tickets/${ticketId}`),
    [navigate, roleBasePath]
  );

  const calendarDays = useMemo(() => buildCalendarDays(calendarMonth), [calendarMonth]);
  const ticketsByDate = useMemo(() => buildTicketsByDate(filteredTickets), [filteredTickets]);

  const prevMonth = () => {
    const [year, month] = calendarMonth.split('-').map(Number);
    const date = new Date(year, month - 2, 1);
    setCalendarMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  };

  const nextMonth = () => {
    const [year, month] = calendarMonth.split('-').map(Number);
    const date = new Date(year, month, 1);
    setCalendarMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  };

  const clearAllFilters = () => {
    setProjectFilter('ALL');
    setAssigneeFilter('ALL');
    setWricefFilter('');
    setDateFrom('');
    setDateTo('');
    setModuleFilter('ALL');
    setComplexityFilter('ALL');
    setStatusFilter('ALL');
  };

  return {
    currentUserId: currentUser?.id,
    currentUserRole: currentUser?.role,
    roleBasePath,
    loading,
    error,
    isViewOnly,
    canDragStatus,
    canMoveTicket,
    hideApprovalColumns,
    projects,
    users,
    tickets,
    filteredTickets,
    ticketsByDate,
    calendarDays,
    calendarMonth,
    viewMode,
    showAdvancedFilters,
    selectedTicket,
    showCreate,
    form,
    selectedProject,
    wricefObjects,
    isManualWricef,
    abaqueSuggestedHours,
    isEstimatedByAbaque,
    isSubmitting,
    searchQuery,
    statusFilter,
    moduleFilter,
    complexityFilter,
    projectFilter,
    assigneeFilter,
    dateFrom,
    dateTo,
    wricefFilter,
    setViewMode,
    setShowAdvancedFilters,
    setShowCreate,
    setSelectedTicket,
    setForm,
    setIsManualWricef,
    setSearchQuery,
    setStatusFilter,
    setModuleFilter,
    setComplexityFilter,
    setProjectFilter,
    setAssigneeFilter,
    setDateFrom,
    setDateTo,
    setWricefFilter,
    onEstimatedByAbaqueChange: setIsEstimatedByAbaque,
    onApplyAbaqueEstimate: () => {
      if (abaqueSuggestedHours === null) return;
      setForm((previous) => ({ ...previous, estimationHours: abaqueSuggestedHours }));
      setIsEstimatedByAbaque(true);
    },
    submitTicket,
    changeStatus,
    updateTicketDueDate,
    openTicketDetails,
    prevMonth,
    nextMonth,
    clearAllFilters,
    resolveProjectName,
    resolveUserName,
    handleDocumentationChanged,
    deleteTicketById,
    canDeleteTicket,
  };
};
