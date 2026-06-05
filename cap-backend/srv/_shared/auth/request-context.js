'use strict';

const normalizeString = (value) => String(value ?? '').trim();

function getRequestContext(req) {
  const claims = req?.authContext ?? req?._authClaims ?? null;
  const userId = normalizeString(claims?.sub ?? claims?.userId ?? req?.user?.id ?? req?.headers?.['x-user-id']);
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
