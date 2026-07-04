'use strict';

const cds = require('@sap/cds');
const { ENTITIES } = require('../shared/services/validation');

const CERT_COLUMNS = [
  'ID', 'userId', 'title', 'issuingOrg', 'issuedDate', 'expiryDate',
  'credentialId', 'credentialUrl', 'status', 'description',
  'createdAt', 'modifiedAt',
];

class CertificateRepo {
  async findById(id) {
    return cds.db.run(
      SELECT.one.from(ENTITIES.Certificates).columns(...CERT_COLUMNS).where({ ID: id })
    );
  }

  async listByUser(userId) {
    return cds.db.run(
      SELECT.from(ENTITIES.Certificates).columns(...CERT_COLUMNS).where({ userId })
    );
  }

  async insert(data) {
    return cds.db.run(INSERT.into(ENTITIES.Certificates).entries(data));
  }

  async update(id, data) {
    return cds.db.run(UPDATE(ENTITIES.Certificates).set(data).where({ ID: id }));
  }

  async remove(id) {
    return cds.db.run(DELETE.from(ENTITIES.Certificates).where({ ID: id }));
  }
}

module.exports = CertificateRepo;
