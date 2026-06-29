'use strict';

const cds = require('@sap/cds');
const { ENTITIES } = require('../shared/services/validation');

class ProjectFeedbackRepo {
  async findById(id) {
    if (!id) return null;
    return cds.db.run(
      SELECT.one.from(ENTITIES.ProjectFeedback).where({ ID: id })
    );
  }
}

module.exports = ProjectFeedbackRepo;
