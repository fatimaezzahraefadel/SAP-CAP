using { sap.performance.dashboard.db as db } from '../../db/schema';

extend CoreService with definitions {
  entity DocumentationObjects as projection on db.DocumentationObjects;
  action cleanupOrphanAttachments() returns Integer;
};

