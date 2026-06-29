import React from 'react';
import { PageHeader } from '@/app/components/common/PageHeader';
import { useTranslation } from 'react-i18next';
import { useManagerTicketsViewModel } from '../hooks';
import { TicketCreateDialog } from './TicketCreateDialog';
import { TicketDrawer } from './TicketDrawer';
import { TicketFilters } from './TicketFilters';
import { TicketKPIs } from './TicketKPIs';
import { TicketTable } from './TicketTable';

export const ManagerTicketsView: React.FC = () => {
  const vm = useManagerTicketsViewModel();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title={t('tickets.list.title')}
        subtitle={t('tickets.list.subtitle')}
        breadcrumbs={[
          { label: t('common.home'), path: `${vm.roleBasePath}/dashboard` },
          { label: t('common.tickets') },
        ]}
      />

      <div className="p-6 space-y-4">
        {vm.error && (
          <div className="rounded border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {vm.error}
          </div>
        )}
        <TicketKPIs tickets={vm.filteredTickets} />
        <TicketFilters
          searchQuery={vm.searchQuery}
          statusFilter={vm.statusFilter}
          moduleFilter={vm.moduleFilter}
          complexityFilter={vm.complexityFilter}
          projectFilter={vm.projectFilter}
          assigneeFilter={vm.assigneeFilter}
          dateFrom={vm.dateFrom}
          dateTo={vm.dateTo}
          wricefFilter={vm.wricefFilter}
          viewMode={vm.viewMode}
          showAdvancedFilters={vm.showAdvancedFilters}
          isViewOnly={vm.isViewOnly}
          users={vm.users}
          projects={vm.projects}
          onSearchQueryChange={vm.setSearchQuery}
          onStatusFilterChange={vm.setStatusFilter}
          onModuleFilterChange={vm.setModuleFilter}
          onComplexityFilterChange={vm.setComplexityFilter}
          onProjectFilterChange={vm.setProjectFilter}
          onAssigneeFilterChange={vm.setAssigneeFilter}
          onDateFromChange={vm.setDateFrom}
          onDateToChange={vm.setDateTo}
          onWricefFilterChange={vm.setWricefFilter}
          onViewModeChange={vm.setViewMode}
          onToggleAdvancedFilters={() => vm.setShowAdvancedFilters((previous) => !previous)}
          onClearAll={vm.clearAllFilters}
          onCreateTicket={() => vm.setShowCreate(true)}
        />
        <TicketTable
          loading={vm.loading}
          viewMode={vm.viewMode}
          isViewOnly={vm.isViewOnly}
          currentUserId={vm.currentUserId}
          currentUserRole={vm.currentUserRole}
          tickets={vm.tickets}
          filteredTickets={vm.filteredTickets}
          ticketsByDate={vm.ticketsByDate}
          calendarDays={vm.calendarDays}
          calendarMonth={vm.calendarMonth}
          onPrevMonth={vm.prevMonth}
          onNextMonth={vm.nextMonth}
          onOpenTicketDetails={vm.openTicketDetails}
          onCreateTicket={() => vm.setShowCreate(true)}
          onChangeStatus={(ticket, status) => {
            void vm.changeStatus(ticket, status);
          }}
          onUpdateTicketDueDate={(ticketId, dueDate) => {
            void vm.updateTicketDueDate(ticketId, dueDate);
          }}
          onDeleteTicket={(ticketId) => {
            void vm.deleteTicketById(ticketId);
          }}
          canDeleteTicket={vm.canDeleteTicket}
          resolveProjectName={vm.resolveProjectName}
          resolveUserName={vm.resolveUserName}
        />
      </div>

      <TicketCreateDialog
        open={vm.showCreate}
        vm={{
          currentUserRole: vm.currentUserRole,
          projects: vm.projects,
          users: vm.users,
          selectedProject: vm.selectedProject,
          wricefObjects: vm.wricefObjects,
          form: vm.form,
          isManualWricef: vm.isManualWricef,
          abaqueSuggestedHours: vm.abaqueSuggestedHours,
          isEstimatedByAbaque: vm.isEstimatedByAbaque,
          isSubmitting: vm.isSubmitting,
          onOpenChange: (open) => {
            vm.setShowCreate(open);
          },
          onSubmit: (event) => {
            void vm.submitTicket(event);
          },
          onFormChange: vm.setForm,
          onManualWricefChange: vm.setIsManualWricef,
          onEstimatedByAbaqueChange: vm.onEstimatedByAbaqueChange,
          onApplyAbaqueEstimate: vm.onApplyAbaqueEstimate,
          onCancel: () => {
            vm.setShowCreate(false);
          },
        }}
      />

      <TicketDrawer
        currentUserId={vm.currentUserId}
        selectedTicket={vm.selectedTicket}
        isViewOnly={vm.isViewOnly}
        canDeleteTicket={vm.canDeleteTicket}
        onOpenChange={(open) => {
          if (!open) vm.setSelectedTicket(null);
        }}
        onChangeStatus={(ticket, status) => {
          void vm.changeStatus(ticket, status);
        }}
        onDeleteTicket={(ticketId) => {
          void vm.deleteTicketById(ticketId);
          vm.setSelectedTicket(null);
        }}
        resolveProjectName={vm.resolveProjectName}
        resolveUserName={vm.resolveUserName}
        onDocumentationChanged={vm.handleDocumentationChanged}
      />
    </div>
  );
};
