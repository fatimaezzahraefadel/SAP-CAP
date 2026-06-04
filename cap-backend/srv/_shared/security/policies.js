'use strict';

const registry = new Map();

function register(action, policyFn) {
  if (!action || typeof action !== 'string') {
    throw new Error('Policy action must be a non-empty string');
  }
  if (typeof policyFn !== 'function') {
    throw new Error(`Policy for '${action}' must be a function`);
  }
  registry.set(action, policyFn);
}

function get(action) {
  return registry.get(action);
}

async function can(ctx, action, resource) {
  const engine = require('./permission-engine');
  return engine.can(ctx, action, resource);
}

async function requirePolicy(ctx, action, resource) {
  const engine = require('./permission-engine');
  return engine.require(ctx, action, resource);
}

module.exports = {
  register,
  get,
  can,
  require: requirePolicy,
};
