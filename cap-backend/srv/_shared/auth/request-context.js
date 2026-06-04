'use strict';

const normalizeString = (value) => String(value ?? '').trim();

function getRequestContext(req) {
  const claims = req?._authClaims ?? null;
  const userId = normalizeString(claims?.sub);
  const role = normalizeString(claims?.role);
  const email = normalizeString(claims?.email);

  return {
    userId,
    role,
    email,
    isAuthenticated: Boolean(userId && role),
  };
}

module.exports = {
  getRequestContext,
};
