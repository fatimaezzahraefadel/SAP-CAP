'use strict';

const cds = require('@sap/cds');
const { extractRecommendations } = require('./ai.parse');
const { requireRole, ALL_NON_CONSULTANT_ROLES } = require('../shared/services/validation');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const AI_MODEL = process.env.AI_DISPATCH_MODEL || 'google/gemini-2.5-flash';
const AI_TIMEOUT_MS = Number(process.env.AI_DISPATCH_TIMEOUT_MS || 15000);

const buildSystemPrompt = (language) => `You are an AI dispatch system for an IT consulting company. Your role is to recommend the 5 best technical consultants to assign to a specific ticket.
Return the result as a raw JSON array (do NOT wrap it in a markdown \`\`\`json block).
Each object of the array must strictly follow this structure:
{
  "userId": "the candidate's id exactly as given in the input",
  "userName": "Candidate name",
  "userRole": "Candidate role",
  "score": 85.5,
  "factors": {
    "availabilityScore": 90,
    "skillsMatchScore": 80,
    "performanceScore": 70,
    "similarTicketsScore": 60
  },
  "explanation": "Brief explanation, written in ${language}, of why this candidate is recommended — mention availability, matching skills, delivery track record and similar past tickets."
}
Base your recommendation on:
1. The ticket's need.
2. The candidate's skills and technologies.
3. Their availability.
4. performanceScore: their delivery track record — the share of their past tickets that are DONE.
5. similarTicketsScore: whether they already worked on tickets similar to this one (same nature/module/topic).
Prioritise candidates with matching skills, high availability and relevant experience on similar tickets.
Return EXACTLY 5 recommendations (or one per candidate if fewer than 5 exist), ranked best to worst.
`;

module.exports = (srv) => {
  // The action only exists on TicketService; base-service wires every impl
  // into all services, so skip the ones that do not declare it.
  if (!cds.model?.definitions?.[`${srv.name}.recommendAssignees`]) return;

  srv.on('recommendAssignees', async (req) => {
    const { ticketId } = req.data;
    if (!ticketId) return req.reject(400, 'ticketId is required');

    // Dispatching consultants is a staff activity; consultants cannot burn
    // paid LLM tokens from their own accounts.
    requireRole(req, ALL_NON_CONSULTANT_ROLES, 'Only staff can request AI dispatch recommendations');

    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
    if (!OPENROUTER_API_KEY) {
      return req.reject(500, 'OPENROUTER_API_KEY is missing from environment variables');
    }

    try {
      // 1. Fetch the ticket details
      const ticket = await cds.db.run(
        SELECT.one.from('sap.performance.dashboard.db.Tickets').where({ ID: ticketId })
      );
      if (!ticket) return req.reject(404, 'Ticket not found');

      // 2. Fetch candidates (active technical consultants)
      const users = await cds.db.run(
        SELECT.from('sap.performance.dashboard.db.Users', u => {
          u.ID, u.name, u.role, u.availabilityPercent, u.skills(s => { s.skill })
        }).where({ active: true, role: 'CONSULTANT_TECHNIQUE' })
      );

      if (users.length === 0) return [];

      // 2b. Fetch historical and current tickets for these candidates
      const userIds = users.map(u => u.ID);
      const userTickets = await cds.db.run(
        SELECT.from('sap.performance.dashboard.db.Tickets', t => {
          t.ID, t.title, t.nature, t.module, t.assignedTo, t.status
        }).where({ assignedTo: { 'in': userIds } })
      );

      // Group tickets by user
      const ticketsByUser = {};
      userIds.forEach(id => ticketsByUser[id] = []);
      userTickets.forEach(t => {
        if (ticketsByUser[t.assignedTo]) {
          ticketsByUser[t.assignedTo].push({ title: t.title, nature: t.nature, module: t.module, status: t.status });
        }
      });

      // 3. Prepare the prompt for the AI
      const candidatesInfo = users.map(u => ({
        id: u.ID,
        name: u.name,
        role: u.role,
        skills: u.skills ? u.skills.map(s => s.skill).filter(Boolean) : [],
        availabilityPercent: u.availabilityPercent || 100,
        pastAndCurrentTickets: ticketsByUser[u.ID] || []
      }));

      // Explanations follow the caller's UI language (Accept-Language).
      const language = String(req.locale || 'en').toLowerCase().startsWith('fr') ? 'French' : 'English';

      const userPrompt = `
Ticket to assign:
- Title: ${ticket.title}
- Description: ${ticket.description || 'N/A'}
- Nature: ${ticket.nature}
- Module: ${ticket.module || 'N/A'}
- Complexity: ${ticket.complexity}
- Priority: ${ticket.priority}

Available Candidates:
${JSON.stringify(candidatesInfo, null, 2)}
`;

      // 4. Call OpenRouter API
      const payload = {
        model: AI_MODEL,
        messages: [
          { role: 'system', content: buildSystemPrompt(language) },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        max_tokens: 2500
      };

      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), AI_TIMEOUT_MS);

      let response;
      try {
        response = await fetch(OPENROUTER_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            // Optional OpenRouter attribution headers.
            'HTTP-Referer': process.env.AI_DISPATCH_REFERER || 'https://ticket-cap.local',
            'X-Title': 'Ticket-CAP Performance Dashboard'
          },
          body: JSON.stringify(payload),
          signal: abortController.signal
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        const errText = await response.text();
        console.error('OpenRouter API Error:', response.status, errText);
        return req.reject(502, 'The AI service is unavailable. Please try again.');
      }

      const data = await response.json();
      const rawText = data.choices?.[0]?.message?.content;

      if (!rawText) {
        return req.reject(502, 'The AI returned an empty response. Please try again.');
      }

      try {
        return extractRecommendations(rawText);
      } catch (err) {
        console.error('Failed to parse AI JSON:', rawText, 'Error:', err.message);
        return req.reject(502, 'The AI returned an unexpected format. Please try again.');
      }
    } catch (error) {
      // req.reject throws — let deliberate rejections (404/502 above) through.
      const code = Number(error?.code ?? error?.status);
      if (code >= 400 && code < 600) throw error;

      // AbortError (timeout) and network failures land here.
      console.error('Error in recommendAssignees:', error);
      return req.reject(502, 'AI recommendation failed. Please try again.');
    }
  });
};
