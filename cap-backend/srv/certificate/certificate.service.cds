using { UserService } from '../user-service';
using { sap.performance.dashboard.db as db } from '../../db/schema';

extend UserService with definitions {

  // CRUD complet sur les certificats
  entity Certificates as projection on db.Certificates;

  // Type de retour pour les documents (sous-ensemble des métadonnées Attachments,
  // sans le binaire `content`)
  type CertificateDocumentInfo {
    ID           : String;
    parentType   : String;
    parentId     : String;
    fileName     : String;
    originalName : String;
    mimeType     : String;
    sizeBytes    : Integer;
    storageKey   : String;
    status       : String;
    uploadedBy   : String;
    createdAt    : DateTime;
  }

  // Upload d'un document lié à un certificat (base64 payload).
  // La limite du body-parser est portée à 50mb sur le service UserService.
  action uploadCertificateDocument(
    certId        : String,
    fileName      : String,
    mimeType      : String,
    contentBase64 : String
  ) returns CertificateDocumentInfo;

  // Liste les documents actifs d'un certificat
  action listCertificateDocuments(certId: String) returns array of CertificateDocumentInfo;

  // Suppression logique d'un document
  action deleteCertificateDocument(attachmentId: String) returns CertificateDocumentInfo;
}
