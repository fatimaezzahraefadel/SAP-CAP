'use strict';

const CertificateDomainService = require('./certificate.domain.service');

module.exports = (srv) => {
  const domain = new CertificateDomainService(srv);

  srv.before('CREATE', 'Certificates', (req) => domain.beforeCreate(req));
  srv.before('UPDATE', 'Certificates', (req) => domain.beforeUpdate(req));
  srv.before('DELETE', 'Certificates', (req) => domain.beforeDelete(req));

  srv.on('uploadCertificateDocument', (req) => domain.uploadDocument(req));
  srv.on('listCertificateDocuments', (req) => domain.listDocuments(req));
  srv.on('deleteCertificateDocument', (req) => domain.deleteDocument(req));
};

module.exports.primaryEntity = 'Certificates';
