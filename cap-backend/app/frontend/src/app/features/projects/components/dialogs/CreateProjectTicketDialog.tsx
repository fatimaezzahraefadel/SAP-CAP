import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Calculator } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Resolver, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { CreateProjectTicketForm } from './project-ticket/CreateProjectTicketForm';
import { ticketSchema, TicketFormValues } from './project-ticket/schema';
import { useProjectDetails, useProjectWricefObjects, useProjectTickets, projectKeys } from '../../queries';
import { toast } from 'sonner';
import { useAuth } from '@/app/context/AuthContext';
import { Ticket } from '@/app/types/entities';
import { createTicketWithUnifiedFlow } from '@/app/services/ticketCreation';
import { useQueryClient } from '@tanstack/react-query';
import { getProjectAbaqueEstimate } from '@/app/utils/projectAbaque';

interface CreateProjectTicketDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultWricefObjectId?: string;
  onCreated?: (ticket: Ticket) => void;
}

export const CreateProjectTicketDialog: React.FC<CreateProjectTicketDialogProps> = ({
  projectId,
  open,
  onOpenChange,
  defaultWricefObjectId,
  onCreated,
}) => {
  const { t } = useTranslation();
  const { data: project } = useProjectDetails(projectId);
  const { data: wricefObjects = [] } = useProjectWricefObjects(projectId);
  const { data: tickets = [] } = useProjectTickets(projectId);
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();

  const [isCreatingTicket, setIsCreatingTicket] = useState(false);
  const [isEstimatedByAbaque, setIsEstimatedByAbaque] = useState(false);

  const form = useForm<TicketFormValues>({
    resolver: zodResolver(ticketSchema) as Resolver<TicketFormValues>,
    defaultValues: {
      title: '',
      description: '',
      nature: 'ENHANCEMENT',
      priority: 'MEDIUM',
      complexity: 'SIMPLE',
      effortHours: 0,
      dueDate: '',
      wricefObjectId: defaultWricefObjectId || '',
    },
  });

  useEffect(() => {
    if (!open) return;
    setIsEstimatedByAbaque(false);
    form.reset({
      title: '',
      description: '',
      nature: 'ENHANCEMENT',
      priority: 'MEDIUM',
      complexity: 'SIMPLE',
      effortHours: 0,
      dueDate: '',
      wricefObjectId: defaultWricefObjectId || '',
    });
  }, [defaultWricefObjectId, form, open]);

  const formValues = form.watch();
  const abaqueSuggestedHours = getProjectAbaqueEstimate(
    project?.abaqueEstimate,
    formValues.nature,
    formValues.complexity
  );

  const onSubmit = async (values: TicketFormValues) => {
    if (!project || !currentUser) return;
    try {
      setIsCreatingTicket(true);
      const { ticket: created } = await createTicketWithUnifiedFlow({
        project,
        wricefObjects,
        existingProjectTickets: tickets,
        createdBy: currentUser.id,
        priority: values.priority,
        nature: values.nature,
        title: values.title.trim(),
        description: values.description.trim(),
        dueDate: values.dueDate || undefined,
        module: 'OTHER',
        complexity: values.complexity,
        estimationHours: values.effortHours,
        estimatedViaAbaque: isEstimatedByAbaque,
        selectedWricefObjectId: values.wricefObjectId || undefined,
        creationComment: isEstimatedByAbaque
          ? 'Ticket created with project matrix estimation'
          : 'Ticket created with manual estimation',
      });
      
      queryClient.invalidateQueries({ queryKey: projectKeys.tickets(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.details(projectId) });
      onCreated?.(created);

      form.reset();
      onOpenChange(false);
      toast.success(t('tickets.create.submit'));
    } catch {
      toast.error(t('common.errors.loadFailed'));
    } finally {
      setIsCreatingTicket(false);
    }
  };

  const vm = {
    projectName: project?.name ?? '',
    wricefObjects,
    formValues,
    setValue: form.setValue,
    register: form.register,
    errors: form.formState.errors,
    abaqueSuggestedHours,
    isEstimatedByAbaque,
    onNatureChange: (value: TicketFormValues['nature']) => {
      setIsEstimatedByAbaque(false);
      form.setValue('nature', value);
    },
    onComplexityChange: (value: TicketFormValues['complexity']) => {
      setIsEstimatedByAbaque(false);
      form.setValue('complexity', value);
    },
    onEffortHoursChange: (value: number) => {
      setIsEstimatedByAbaque(false);
      form.setValue('effortHours', value);
    },
    onApplyAbaqueEstimate: () => {
      if (abaqueSuggestedHours === null) return;
      form.setValue('effortHours', abaqueSuggestedHours);
      setIsEstimatedByAbaque(true);
    },
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl sm:max-w-5xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            {t('projectPanels.toolbar.createTicket')}
          </DialogTitle>
          <VisuallyHidden>
            <DialogDescription>
              {t('projects.ticketDialog.title')}
            </DialogDescription>
          </VisuallyHidden>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-5">
            <CreateProjectTicketForm vm={vm} />
          </div>
          <DialogFooter className="mt-4 pt-4 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isCreatingTicket}>
              {isCreatingTicket ? t('tickets.create.submitting') : t('projectPanels.toolbar.createTicket')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
