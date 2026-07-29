import React from 'react';
import { UserCheck } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import type { Ticket, User } from '@/app/types/entities';
import { useTranslation } from 'react-i18next';

interface AssignmentToggleProps {
  ticket: Partial<Ticket>;
  users: User[];
  allTickets: Ticket[];
  value: string;
  onChange: (userId: string) => void;
  candidateRoles?: User['role'][];
}

export const AssignmentToggle: React.FC<AssignmentToggleProps> = ({
  users,
  value,
  onChange,
  candidateRoles = ['CONSULTANT_TECHNIQUE'],
}) => {
  const { t } = useTranslation();
  const candidates = users.filter((user) => user.active && candidateRoles.includes(user.role));

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <UserCheck className="h-4 w-4" />
        {t('assignment.manual')}
      </div>
      {candidates.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
          {t('assignment.noConsultants')}
        </p>
      ) : (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder={t('assignment.selectPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {candidates.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.name} ({t(`roles.${user.role}`)})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
};
