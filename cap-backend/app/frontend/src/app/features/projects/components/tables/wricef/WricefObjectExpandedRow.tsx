import React from 'react';
import { useTranslation } from 'react-i18next';
import { FilePlus2, Plus } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { TableCell, TableRow } from '@/app/components/ui/table';
import { DocumentationObject, Ticket, TicketStatus, WricefObject } from '@/app/types/entities';
import { WricefObjectDocumentsTable } from './WricefObjectDocumentsTable';
import { WricefObjectTicketsTable } from './WricefObjectTicketsTable';
import { getWricefObjectRef } from '../../../model';

interface WricefObjectExpandedRowProps {
  object: WricefObject;
  ticketRows: Ticket[];
  objectDocs: DocumentationObject[];
  wricefStatusColor: Record<TicketStatus, string>;
  wricefPriorityColor: Record<string, string>;
  resolveUserName: (userId: string) => string;
  onOpenCreateTicket: (objectId: string) => void;
  onOpenCreateDocument: (objectId: string) => void;
  onOpenTicketDetails: (ticketId: string) => void;
  onViewDocument: (docId: string) => void;
}

export const WricefObjectExpandedRow: React.FC<WricefObjectExpandedRowProps> = ({
  object,
  ticketRows,
  objectDocs,
  wricefStatusColor,
  wricefPriorityColor,
  resolveUserName,
  onOpenCreateTicket,
  onOpenCreateDocument,
  onOpenTicketDetails,
  onViewDocument,
}) => {
  const { t } = useTranslation();
  const objectRef = getWricefObjectRef(object);

  return (
    <TableRow>
      <TableCell colSpan={8} className="p-0">
        <div className="bg-muted/20 border-t border-b border-border/50 px-6 py-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-foreground">
              {t('projects.details.tables.wricef.ticketsFor', { id: objectRef })}
            </h4>
            <Button
              size="sm"
              variant="outline"
              onClick={(event) => {
                event.stopPropagation();
                onOpenCreateTicket(object.id);
              }}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              {t('projects.details.tables.wricef.addTicket')}
            </Button>
          </div>
          <WricefObjectTicketsTable
            ticketRows={ticketRows}
            wricefStatusColor={wricefStatusColor}
            wricefPriorityColor={wricefPriorityColor}
            onOpenTicketDetails={onOpenTicketDetails}
          />

          <div className="mt-4 pt-3 border-t border-border/40">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-foreground">
                  {t('projects.details.tables.wricef.documentsFor', { id: objectRef })}
              </h4>
              <Button
                size="sm"
                variant="outline"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenCreateDocument(object.id);
                }}
              >
                <FilePlus2 className="h-3.5 w-3.5 mr-1" />
                {t('projects.details.tables.wricef.addDocument')}
              </Button>
            </div>
            <WricefObjectDocumentsTable
              objectDocs={objectDocs}
              resolveUserName={resolveUserName}
              onViewDocument={onViewDocument}
            />
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
};
