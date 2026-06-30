import React from 'react';
import { useTranslation } from 'react-i18next';
import { useProjectDetailsViewModel } from '../hooks';
import { CreateDocumentationDialog } from './dialogs/CreateDocumentationDialog';
import { CreateProjectTicketDialog } from './dialogs/CreateProjectTicketDialog';
import { ViewDocumentationDialog } from './dialogs/ViewDocumentationDialog';
import { ProjectHeader } from './ProjectHeader';
import { ProjectKpis } from './ProjectKpis';
import { ProjectTabs } from './ProjectTabs';
import { AbaquesPanel } from './panels/AbaquesPanel';
import { DocumentationPanel } from './panels/DocumentationPanel';
import { OverviewPanel } from './panels/OverviewPanel';
import { TeamPanel } from './panels/TeamPanel';
import { TicketsPanel } from './panels/TicketsPanel';
import { WricefPanel } from './panels/WricefPanel';

export const ProjectDetailsView: React.FC = () => {
  const { t } = useTranslation();
  const vm = useProjectDetailsViewModel();

  if (vm.loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="p-8 text-muted-foreground">{t('projects.details.loading')}</div>
      </div>
    );
  }
  if (!vm.project) {
    return (
      <div className="min-h-screen bg-background">
        <div className="p-8 space-y-3">
          <h1 className="text-2xl font-semibold text-foreground">{t('projects.details.unavailable')}</h1>
          <p className="text-sm text-muted-foreground">
            {vm.error ?? t('projects.details.couldNotLoad')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ProjectHeader projectName={vm.project.name} roleBasePath={vm.roleBasePath} />
      <div className="p-6 space-y-6">
        {vm.error && (
          <div className="rounded border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {vm.error}
          </div>
        )}
        <ProjectTabs
          tabs={vm.tabs}
          activeTab={vm.activeTab}
          onTabChange={vm.setActiveTab}
          onTabKeyDown={vm.handleTabKeyDown}
        />
        <OverviewPanel active={vm.activeTab === 'overview'} vm={vm.overviewVm!} />
        <AbaquesPanel active={vm.activeTab === 'abaques'} vm={vm.abaquesVm!} />
        <TicketsPanel 
          active={vm.activeTab === 'tickets'} 
          vm={vm.ticketsVm}
        />
        <TeamPanel active={vm.activeTab === 'team'} {...vm.teamVm} />
        <WricefPanel 
          active={vm.activeTab === 'objects'} 
          vm={vm.wricefVm}
        />
        <ProjectKpis {...vm.kpisVm} />
        <DocumentationPanel active={vm.activeTab === 'docs'} vm={vm.documentationVm!} />
        <CreateProjectTicketDialog
          projectId={vm.project.id}
          open={vm.createTicketDialogVm.open}
          onOpenChange={vm.createTicketDialogVm.onOpenChange}
          defaultWricefObjectId={vm.createTicketDialogVm.defaultWricefObjectId}
          onCreated={vm.createTicketDialogVm.onCreated}
        />
        <CreateDocumentationDialog
          open={vm.createDocumentationDialogVm.open}
          vm={vm.createDocumentationDialogVm.vm}
        />
        <ViewDocumentationDialog
          open={vm.viewDocumentationDialogVm.open}
          document={vm.viewDocumentationDialogVm.document}
          onOpenChange={vm.viewDocumentationDialogVm.onOpenChange}
          resolveUserName={vm.viewDocumentationDialogVm.resolveUserName}
          formatBytes={vm.viewDocumentationDialogVm.formatBytes}
        />
      </div>
    </div>
  );
};
