import type { ODataRequestOptions } from '../../services/odata/core';
import { NotificationsAPI as ODataNotificationsAPI } from '../../services/odata/notificationsApi';
import { ProjectsAPI as ODataProjectsAPI } from '../../services/odata/projectsApi';
import { TicketsAPI as ODataTicketsAPI } from '../../services/odata/ticketsApi';
import { UsersAPI as ODataUsersAPI } from '../../services/odata/usersApi';
import { Notification, Project, Ticket, User } from '../../types/entities';

export interface ManagerTicketsBootstrapData {
  projects: Project[];
  users: User[];
  tickets: Ticket[];
  errors: string[];
}

const toErrorMessage = (label: string, reason: unknown): string => {
  const message = reason instanceof Error ? reason.message : String(reason ?? 'Unknown error');
  return `Failed to load ${label}: ${message}`;
};

export const ManagerTicketsAPI = {
  async getBootstrapData(requestOptions?: ODataRequestOptions): Promise<ManagerTicketsBootstrapData> {
    const results = await Promise.allSettled([
      ODataProjectsAPI.list({ $orderby: 'name asc', $top: 500 }, requestOptions),
      ODataUsersAPI.getActive(requestOptions),
      ODataTicketsAPI.list({ $orderby: 'createdAt desc', $top: 500 }, requestOptions),
    ]);

    const projects = results[0].status === 'fulfilled' ? results[0].value : [];
    const users = results[1].status === 'fulfilled' ? results[1].value : [];
    const tickets = results[2].status === 'fulfilled' ? results[2].value : [];
    const errors = [
      results[0].status === 'rejected' ? toErrorMessage('projects', results[0].reason) : null,
      results[1].status === 'rejected' ? toErrorMessage('users', results[1].reason) : null,
      results[2].status === 'rejected' ? toErrorMessage('tickets', results[2].reason) : null,
    ].filter((entry): entry is string => Boolean(entry));

    return { projects, users, tickets, errors };
  },

  async listTickets(requestOptions?: ODataRequestOptions): Promise<Ticket[]> {
    return await ODataTicketsAPI.list({ $orderby: 'createdAt desc', $top: 500 }, requestOptions);
  },

  async updateTicket(id: string, payload: Partial<Ticket>): Promise<Ticket> {
    return await ODataTicketsAPI.update(id, payload);
  },

  async deleteTicket(id: string): Promise<void> {
    return await ODataTicketsAPI.delete(id);
  },

  async createNotification(
    payload: Omit<Notification, 'id' | 'createdAt'> & { createdAt?: string }
  ): Promise<Notification> {
    return await ODataNotificationsAPI.create(payload);
  },
};
