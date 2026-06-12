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
        SELECT.from('sap.performance.dashboard.db.Users', ['ID', 'name', 'role', 'skills', 'availabilityPercent'])
          .where({ active: true, role: { 'not in': ['ADMIN', 'MANAGER'] } })
      );

      if (users.length === 0) return [];

      // 3. Prepare the prompt for Gemini
      const candidatesInfo = users.map(u => ({
        id: u.ID,
        name: u.name,
        role: u.role,
        skills: u.skills ? JSON.parse(u.skills) : [],
        availabilityPercent: u.availabilityPercent || 100
      }));

      const systemPrompt = `You are an AI Dispatch system for an IT consulting company. Your job is to recommend the top 3 best consultants to assign to a specific ticket.
You must return the result as a raw JSON array (do NOT wrap in markdown \`\`\`json block).
Each object in the array must strictly follow this structure:
{
  "userId": "uuid-of-user",
  "userName": "Name of user",
  "userRole": "Role of user",
  "score": 85.5, // Total score out of 100
  "factors": {
    "availabilityScore": 90, // out of 100
    "skillsMatchScore": 80, // out of 100
    "performanceScore": 75, // out of 100
    "similarTicketsScore": 60 // out of 100
  },
  "explanation": "Brief explanation of why this user is recommended for this specific ticket."
}
Analyze the ticket and the candidates. Give priority to those with matching skills and high availability.
`;

      const userPrompt = `
Ticket to assign:
- Title: ${ticket.title}
- Description: ${ticket.description || 'N/A'}
- Nature: ${ticket.nature}
- Complexity: ${ticket.complexity}
- Priority: ${ticket.priority}

Available Candidates:
${JSON.stringify(candidatesInfo, null, 2)}
`;

      // 4. Call OpenRouter API
      const openRouterUrl = 'https://openrouter.ai/api/v1/chat/completions';
      
      const payload = {
        model: 'openai/gpt-oss-120b:free',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2
      };

      const response = await fetch(openRouterUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:5173', // Adjust as needed
          'X-Title': 'Ticket-CAP Performance Dashboard'
        },
        body: JSON.stringify(payload)
      });

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
        recommendations = JSON.parse(rawText);
      } catch (err) {
        console.error('Failed to parse AI JSON:', rawText);
        return req.reject(500, 'AI returned invalid JSON format');
      }

      return recommendations;

    } catch (error) {
      console.error('Error in recommendAssignees:', error);
      return req.reject(500, error.message || error.toString());
    }
  });
};
