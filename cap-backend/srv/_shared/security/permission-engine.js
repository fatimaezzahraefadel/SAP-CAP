'use strict';

const FORBIDDEN_MESSAGE = 'Forbidden: insufficient permission';

function createPermissionError(message) {
  const error = new Error(message || FORBIDDEN_MESSAGE);
  error.code = 403;
  error.status = 403;
  error.statusCode = 403;
  return error;
}

function assertContext(ctx) {
  if (!ctx || typeof ctx !== 'object' || !ctx.isAuthenticated) {
    throw createPermissionError('Missing authenticated user');
  }
}

async function can(ctx, action, resource) {
  assertContext(ctx);

  const policies = require('./policies');
  const policy = policies.get(action);
  if (!policy) return false;

  return Boolean(await policy(ctx, resource));
}

async function requirePermission(ctx, action, resource) {
  if (await can(ctx, action, resource)) return true;
  throw createPermissionError();
}

module.exports = {
  can,
  createPermissionError,
  require: requirePermission,
};
