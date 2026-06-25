'use strict';

const cds = require('@sap/cds');

module.exports = (srv) => {
  srv.on('recommendAssignees', async (req) => {
    const { ticketId } = req.data;
    if (!ticketId) return req.reject(400, 'ticketId is required');

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

      // 2. Fetch candidates (active users, excluding ADMIN and MANAGER)
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

      const systemPrompt = `Tu es un système d'IA de dispatch pour une société de conseil informatique. Ton rôle est de recommander les 5 meilleurs consultants techniques à assigner à un ticket spécifique.
Tu dois retourner le résultat sous forme de tableau JSON brut (NE PAS l'entourer d'un bloc markdown \`\`\`json).
Chaque objet du tableau doit strictement respecter cette structure :
{
  "userId": "uuid-de-l-utilisateur",
  "userName": "Nom de l'utilisateur",
  "userRole": "Rôle de l'utilisateur",
  "score": 85.5,
  "factors": {
    "availabilityScore": 90,
    "skillsMatchScore": 80,
    "similarTicketsScore": 60
  },
  "explanation": "Explication brève EN FRANÇAIS de pourquoi cet utilisateur est recommandé, mentionnant sa disponibilité, ses compétences correspondantes, et ses tickets similaires passés."
}
Analyse le besoin du ticket et les candidats. Tu DOIS baser ta recommandation sur :
1. Le besoin du ticket.
2. Les compétences et technologies maîtrisées par les consultants.
3. Leur disponibilité.
4. S'ils ont déjà travaillé sur un sujet similaire au ticket.
Donne la priorité à ceux qui ont des compétences correspondantes, une haute disponibilité, et une expérience pertinente sur des tickets similaires.
RETOURNE EXACTEMENT 5 recommandations, classées du meilleur au moins bon.
`;

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
      const openRouterUrl = 'https://openrouter.ai/api/v1/chat/completions';
      
      const payload = {
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        max_tokens: 2500
      };

      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 15000); // 15 seconds timeout

      let response;
      try {
        response = await fetch(openRouterUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'http://localhost:5173', // Adjust as needed
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
        console.error('OpenRouter API Error:', errText);
        return req.reject(500, 'Error calling AI API');
      }

      const data = await response.json();
      const rawText = data.choices?.[0]?.message?.content;
      
      if (!rawText) {
        return req.reject(500, 'AI returned an empty response');
      }

      // Try to parse the JSON
      let recommendations = [];
      try {
        // Sanitize JSON by removing markdown block wrappers
        let sanitizedText = rawText.trim();
        if (sanitizedText.startsWith('```json')) {
          sanitizedText = sanitizedText.replace(/^```json/, '').replace(/```$/, '').trim();
        } else if (sanitizedText.startsWith('```')) {
          sanitizedText = sanitizedText.replace(/^```/, '').replace(/```$/, '').trim();
        }
        
        // As a fallback, try extracting the array substring directly if it's still invalid
        if (!sanitizedText.startsWith('[')) {
            const firstBracket = sanitizedText.indexOf('[');
            const lastBracket = sanitizedText.lastIndexOf(']');
            if (firstBracket !== -1 && lastBracket !== -1) {
                sanitizedText = sanitizedText.substring(firstBracket, lastBracket + 1);
            }
        }

        recommendations = JSON.parse(sanitizedText);
      } catch (err) {
        console.error('Failed to parse AI JSON:', rawText, 'Error:', err.message);
        return req.reject(500, 'AI returned invalid JSON format');
      }

      return recommendations;

    } catch (error) {
      console.error('Error in recommendAssignees:', error);
      return req.reject(500, error.message || error.toString());
    }
  });
};
