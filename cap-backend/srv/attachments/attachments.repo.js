'use strict';

const cds = require('@sap/cds');
const { ENTITIES } = require('../shared/services/validation');

// Columns returned to clients — deliberately excludes the heavy binary `content`
// so list/metadata responses stay small.
const META_COLUMNS = [
  'ID', 'parentType', 'parentId', 'fileName', 'originalName', 'mimeType',
  'sizeBytes', 'storageKey', 'checksumSha256', 'uploadedBy', 'status',
  'deletedAt', 'deletedBy', 'createdAt', 'modifiedAt',
];

class AttachmentsRepo {
  async findById(id) {
    return cds.db.run(
      SELECT.one.from(ENTITIES.Attachments).columns(...META_COLUMNS).where({ ID: id })
    );
  }

  async findByStorageKey(storageKey) {
    return cds.db.run(
      SELECT.one.from(ENTITIES.Attachments).columns(...META_COLUMNS).where({ storageKey })
    );
  }

  async listActiveByParent(parentType, parentId) {
    return cds.db.run(
      SELECT.from(ENTITIES.Attachments).columns(...META_COLUMNS).where({ parentType, parentId, status: 'ACTIVE' })
    );
  }

  /**
   * Reads the binary payload + the metadata the download route needs.
   * Note: @sap/cds returns LargeBinary as a Node Readable stream.
   */
  async findContentById(id) {
    return cds.db.run(
      SELECT.one.from(ENTITIES.Attachments)
        .columns('content', 'mimeType', 'originalName', 'fileName', 'sizeBytes', 'status')
        .where({ ID: id })
    );
  }

  async insert(entry) {
    return cds.db.run(INSERT.into(ENTITIES.Attachments).entries(entry));
  }

  async markDeleted(id, deletedBy, deletedAt) {
    return cds.db.run(
      UPDATE(ENTITIES.Attachments).set({ status: 'DELETED', deletedBy, deletedAt }).where({ ID: id })
    );
  }
}

module.exports = AttachmentsRepo;
