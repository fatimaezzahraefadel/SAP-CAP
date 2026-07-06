import React from 'react';
import { ChevronDown, ChevronRight, FileText, Ticket as TicketIcon } from 'lucide-react';
import { Badge } from '@/app/components/ui/badge';
import {
  TableCell,
  TableRow,
} from '@/app/components/ui/table';
import {
  SAP_MODULE_LABELS,
  TicketComplexity,
  TICKET_COMPLEXITY_LABELS,
  WricefObject,
  WricefType,
  WRICEF_TYPE_LABELS,
} from '@/app/types/entities';
import { getWricefObjectRef } from '../../../model';

interface WricefObjectMainRowProps {
  object: WricefObject;
  isExpanded: boolean;
  ticketCount: number;
  docCount: number;
  wricefTypeBadgeClass: Record<WricefType, string>;
  complexityBadgeClass: Record<TicketComplexity, string>;
  onToggleExpandObject: (objectId: string) => void;
}

export const WricefObjectMainRow: React.FC<WricefObjectMainRowProps> = ({
  object,
  isExpanded,
  ticketCount,
  docCount,
  wricefTypeBadgeClass,
  complexityBadgeClass,
  onToggleExpandObject,
}) => {
  const objectRef = getWricefObjectRef(object);

  return (
    <TableRow className="cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => onToggleExpandObject(object.id)}>
      <TableCell className="px-3 py-3">
        <button type="button" className="p-0.5 rounded hover:bg-muted">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </TableCell>
      <TableCell className="px-3 py-3 font-mono text-sm font-medium">{objectRef}</TableCell>
      <TableCell className="px-3 py-3">
        <Badge className={`text-xs ${wricefTypeBadgeClass[object.type]}`}>
          {WRICEF_TYPE_LABELS[object.type]}
        </Badge>
      </TableCell>
      <TableCell className="px-3 py-3">
        <div className="font-medium text-sm">{object.title}</div>
        {object.description && <div className="text-xs text-muted-foreground line-clamp-1 max-w-[300px]">{object.description}</div>}
      </TableCell>
      <TableCell className="px-3 py-3">
        <Badge className={`text-xs ${complexityBadgeClass[object.complexity]}`}>
          {TICKET_COMPLEXITY_LABELS[object.complexity]}
        </Badge>
      </TableCell>
      <TableCell className="px-3 py-3 text-sm">{SAP_MODULE_LABELS[object.module]}</TableCell>
      <TableCell className="px-3 py-3 text-center">
        <span className="inline-flex items-center gap-1 text-sm">
          <TicketIcon className="h-3.5 w-3.5 text-muted-foreground" />
          {ticketCount}
        </span>
      </TableCell>
      <TableCell className="px-3 py-3 text-center">
        <span className="inline-flex items-center gap-1 text-sm">
          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
          {docCount}
        </span>
      </TableCell>
    </TableRow>
  );
};
