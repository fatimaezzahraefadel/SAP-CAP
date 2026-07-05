import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FilePlus2, Paperclip, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { DocumentationAPI } from '../../services/odata/documentationApi';
import { odataFetch } from '../../services/odata/core';
import {
  DocumentationAttachment,
  DocumentationObject,
  DocumentationObjectType,
  DOCUMENTATION_OBJECT_TYPE_LABELS,
  Ticket,
} from '../../types/entities';
import { sanitizeFileName } from '../../utils/file';

interface DocumentationObjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket: Ticket;
  currentUserId?: string;
  onCreated?: (documentation: DocumentationObject) => void | Promise<void>;
}

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const initialContentFromTicket = (ticket: Ticket) =>
  `# ${ticket.title}\n\n## Context\n${ticket.description}\n\n## Functional Details\n- \n\n## Technical Notes\n- \n`;

export const DocumentationObjectModal: React.FC<DocumentationObjectModalProps> = ({
  open,
  onOpenChange,
  ticket,
  currentUserId,
  onCreated,
}) => {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<DocumentationObjectType>('SFD');
  const [content, setContent] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<Array<DocumentationAttachment & { file?: File }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const objectUrlsRef = useRef<string[]>([]);

  // Revoke all tracked object URLs
  const revokeAllObjectUrls = () => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current = [];
  };

  useEffect(() => {
    if (!open) {
      // Clean up object URLs when dialog closes
      revokeAllObjectUrls();
      return;
    }
    setTitle(`SFD - ${ticket.title}`);
    setDescription(t('documentation.create.defaultDescription', { code: ticket.ticketCode }));
    setType('SFD');
    setContent(initialContentFromTicket(ticket));
    setAttachedFiles([]);
  }, [open, ticket, t]);

  // Cleanup on unmount
  useEffect(() => revokeAllObjectUrls, []);

  const addFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;

    const additions = Array.from(fileList).map((file) => {
      const url = URL.createObjectURL(file);
      objectUrlsRef.current.push(url);
      return {
        filename: sanitizeFileName(file.name),
        size: file.size,
        url,
        file,
      } as DocumentationAttachment & { file?: File };
    });

    setAttachedFiles((prev) => [...prev, ...additions]);
    event.target.value = '';
  };

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => {
      const removed = prev[index];
      if (removed?.url) {
        URL.revokeObjectURL(removed.url);
        objectUrlsRef.current = objectUrlsRef.current.filter((u) => u !== removed.url);
      }
      return prev.filter((_, itemIndex) => itemIndex !== index);
    });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentUserId) {
      toast.error(t('documentation.create.toasts.missingAuthor'));
      return;
    }
    if (!title.trim()) {
      toast.error(t('documentation.create.toasts.createFailed'));
      return;
    }
    if (!content.trim()) {
      toast.error('Content is required');
      return;
    }

    try {
      setIsSubmitting(true);
        const created = await DocumentationAPI.create({
        title: title.trim(),
        description: description.trim(),
        type,
        content: content.trim(),
          attachedFiles: [], // attachments will be uploaded separately
        relatedTicketIds: [ticket.id],
        projectId: ticket.projectId,
        authorId: currentUserId,
      });

        // Upload files to attachments service and update documentation object
        if (attachedFiles.length > 0) {
          const uploadedRows: DocumentationAttachment[] = [];
          for (const f of attachedFiles) {
            if (!f.file) continue; // skip already persisted entries
            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                const result = reader.result as string;
                const comma = result.indexOf(',');
                resolve(comma >= 0 ? result.slice(comma + 1) : result);
              };
              reader.onerror = reject;
              reader.readAsDataURL(f.file as File);
            });

            // Route through odataFetch so the request uses the same XSUAA
            // session/cookie handling as the rest of the OData client.
            let json: { ID?: string; id?: string; value?: { ID?: string; id?: string } } | undefined;
            try {
              json = await odataFetch('core', '/uploadAttachment', {
                method: 'POST',
                body: JSON.stringify({
                  parentType: 'DOCUMENT',
                  parentId: created.id,
                  fileName: f.filename,
                  mimeType: f.file.type || 'application/octet-stream',
                  contentBase64: base64,
                }),
              });
            } catch {
              // continue but notify
              toast.error(`Failed to upload ${f.filename}`);
              continue;
            }

            // The action returns the created attachment; accept either direct object or OData 'value'
            const attachment = json?.value ?? json;
            if (!attachment) continue;
            const url = `/attachments/${attachment.ID || attachment.id}`;
            uploadedRows.push({ filename: f.filename, size: f.size, url });
          }

          if (uploadedRows.length > 0) {
            await DocumentationAPI.update(created.id, { attachedFiles: uploadedRows });
          }
        }

      if (onCreated) {
        await onCreated(created);
      }
      toast.success(t('documentation.create.toasts.createSuccess'));
      onOpenChange(false);
    } catch {
      toast.error(t('documentation.create.toasts.createFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FilePlus2 className="h-5 w-5 text-primary" />
            {t('documentation.create.title')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="rounded-lg border border-border/70 bg-muted/30 p-3 text-sm">
            <p>
              <span className="text-muted-foreground">{t('documentation.create.ticketLabel')}</span> {ticket.ticketCode} - {ticket.title}
            </p>
            <p>
              <span className="text-muted-foreground">{t('documentation.create.projectLabel')}</span> {ticket.projectId}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('documentation.create.initNote')}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="md:col-span-2">
              <Label htmlFor="doc-title">{t('documentation.create.titleLabel')}</Label>
              <Input
                id="doc-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t('documentation.titlePlaceholder')}
              />
            </div>
            <div>
              <Label htmlFor="doc-type">{t('documentation.create.typeLabel')}</Label>
              <Select value={type} onValueChange={(value) => setType(value as DocumentationObjectType)}>
                <SelectTrigger id="doc-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(DOCUMENTATION_OBJECT_TYPE_LABELS) as DocumentationObjectType[]).map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`documentation.types.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="doc-description">{t('documentation.create.overviewLabel')}</Label>
            <Textarea
              id="doc-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              placeholder={t('documentation.create.overviewPlaceholder')}
            />
          </div>

          <div>
            <Label htmlFor="doc-content">{t('documentation.create.contentLabel')}</Label>
            <Textarea
              id="doc-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={14}
              className="font-mono text-sm"
              placeholder={t('documentation.create.contentPlaceholder')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="doc-files">{t('documentation.create.attachFilesLabel')}</Label>
            <Input
              id="doc-files"
              type="file"
              multiple
              onChange={addFiles}
            />
            {attachedFiles.length > 0 && (
              <div className="space-y-2 rounded-md border border-border/70 bg-surface-2 p-3">
                {attachedFiles.map((file, index) => (
                  <div key={`${file.filename}-${index}`} className="flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                        <p className="truncate font-medium text-foreground">{file.filename}</p>
                      </div>
                      <Badge variant="outline" className="mt-1">
                        {formatBytes(file.size)}
                      </Badge>
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => removeFile(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('documentation.create.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('documentation.create.creating') : t('documentation.create.create')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
