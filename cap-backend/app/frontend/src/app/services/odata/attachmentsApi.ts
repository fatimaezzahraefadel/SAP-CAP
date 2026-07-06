import { odataFetch, normalizeEntityRecord } from './core';

export interface Attachment {
  id: string;
  parentType: string;
  parentId: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
}

type AttachmentActionResponse =
  | Attachment
  | { ID?: string; id?: string; value?: Attachment & { ID?: string } };

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  txt: 'text/plain',
};

const inferMimeType = (file: File): string => {
  if (file.type) return file.type;
  const extension = file.name.split('.').pop()?.toLowerCase();
  return (extension && MIME_BY_EXTENSION[extension]) || 'application/octet-stream';
};

const normalizeAttachmentActionResponse = (
  response: AttachmentActionResponse | undefined
): Attachment => {
  const raw = response && 'value' in response && response.value ? response.value : response;
  if (!raw) throw new Error('Attachment upload returned no data');
  return normalizeEntityRecord(raw as Attachment);
};

export const AttachmentsAPI = {
  async upload(parentType: string, parentId: string, file: File): Promise<Attachment> {
    const contentBase64 = await fileToBase64(file);
    const response = await odataFetch<AttachmentActionResponse>('core', '/uploadAttachment', {
      method: 'POST',
      body: JSON.stringify({
        parentType,
        parentId,
        fileName: file.name,
        mimeType: inferMimeType(file),
        contentBase64,
      }),
    });

    return normalizeAttachmentActionResponse(response);
  },
};
