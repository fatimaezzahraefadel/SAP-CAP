'use strict';

module.exports = (srv) => require('./tickets.handlers')(srv);
module.exports.primaryEntity = 'Tickets';
