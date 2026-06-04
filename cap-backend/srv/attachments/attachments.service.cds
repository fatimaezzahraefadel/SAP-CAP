using { CoreService } from '../core-service';
using { sap.performance.dashboard.db as db } from '../../db/schema';

extend CoreService with definitions {
  entity Attachments as projection on db.Attachments;

  // Simple actions for attachment lifecycle. uploadAttachment accepts a base64 payload.
  action uploadAttachment(
    parentType: String,
    parentId: String,
    fileName: String,
    mimeType: String,
    contentBase64: String
  ) returns Attachments;

  action downloadAttachment(id: String) returns String;
  action deleteAttachment(id: String) returns Attachments;
  action listAttachments(parentType: String, parentId: String) returns array of Attachments;
}
