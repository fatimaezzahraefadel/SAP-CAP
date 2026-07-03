using { sap.performance.dashboard.db as db } from '../../db/schema';

extend UserService with definitions {
  type AuthUser {
    id                 : String(50);
    name               : String(100);
    email              : String(150);
    role               : db.UserRole;
    active             : Boolean;
    skills             : LargeString;
    certifications     : LargeString;
    availabilityPercent: Integer;
    teamId             : String(50);
    avatarUrl          : String(500);
  }

  type AuthSession {
    token    : String(4096);
    expiresAt: DateTime;
    user     : AuthUser;
  }

  action currentUser() returns AuthUser;
  action authenticate(email: String, password: String) returns AuthSession;
  action quickAccessAccounts() returns array of AuthUser;
};
