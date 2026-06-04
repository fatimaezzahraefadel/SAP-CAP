using { sap.performance.dashboard.db as db } from '../../db/schema';

extend UserService with definitions {

  entity Users as projection on db.Users;

};

