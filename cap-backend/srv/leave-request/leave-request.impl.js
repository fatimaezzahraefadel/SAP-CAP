'use strict';

const LeaveRequestDomainService = require('./leave-request.domain.service');

module.exports = (srv) => {
  const domain = new LeaveRequestDomainService(srv);

  srv.before('READ', 'LeaveRequests', (req) => domain.beforeRead(req));
  srv.before('CREATE', 'LeaveRequests', (req) => domain.beforeCreate(req));
  srv.before('UPDATE', 'LeaveRequests', (req) => domain.beforeUpdate(req));
  srv.before('DELETE', 'LeaveRequests', (req) => domain.beforeDelete(req));

  srv.after('UPDATE', 'LeaveRequests', async (data, req) => {
    if (data && (data.status === 'APPROVED' || data.status === 'REJECTED')) {
      try {
        const { Notifications } = cds.entities('sap.performance.dashboard.db');
        const statusFr = data.status === 'APPROVED' ? 'approuvée' : 'rejetée';
        const title = `Demande de congé ${statusFr}`;
        const startDateStr = data.startDate ? new Date(data.startDate).toLocaleDateString('fr-FR') : data.startDate;
        const endDateStr = data.endDate ? new Date(data.endDate).toLocaleDateString('fr-FR') : data.endDate;
        const message = `Votre demande de congé du ${startDateStr} au ${endDateStr} a été ${statusFr}.`;

        await cds.tx(req).run(
          INSERT.into(Notifications).entries({
            userId: data.consultantId,
            type: 'LEAVE_DECISION',
            title,
            message,
            targetPath: '/consultant-tech/leave',
            read: false,
          })
        );
      } catch (e) {
        console.warn('Could not create notification for leave request update:', e.message);
      }
    }
  });
};

module.exports.primaryEntity = 'LeaveRequests';
