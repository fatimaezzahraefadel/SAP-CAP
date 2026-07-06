import React from 'react';
import { Label } from '@/app/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';

import { CreateProjectTicketViewModel } from './CreateProjectTicketForm';
import { WricefObject } from '@/app/types/entities';
import { getWricefObjectRef } from '../../../model';

interface CreateProjectTicketContextBlockProps {
  vm: CreateProjectTicketViewModel;
}

export const CreateProjectTicketContextBlock: React.FC<CreateProjectTicketContextBlockProps> = ({
  vm,
}) => {
  return (
    <>
      <div className="rounded border border-border/70 bg-muted/30 p-3 text-sm">
        <p>
          <span className="text-muted-foreground">Project:</span> {vm.projectName}
        </p>
      </div>

      {vm.wricefObjects.length > 0 && (
        <div className="space-y-1.5">
          <Label>Link to WRICEF Object</Label>
          <Select
            value={vm.formValues.wricefObjectId || '_none'}
            onValueChange={(value) => vm.setValue('wricefObjectId', value === '_none' ? '' : value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="No WRICEF object" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">No WRICEF object</SelectItem>
              {vm.wricefObjects.map((object: WricefObject) => {
                const objectRef = getWricefObjectRef(object);
                return (
                  <SelectItem key={object.id} value={object.id}>
                    {objectRef} - {object.title}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      )}
    </>
  );
};
