const cds = require('@sap/cds');
const { GET, POST } = cds.test(__dirname);

async function test() {
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  if (!OPENROUTER_API_KEY) {
    console.error('Skipping test: OPENROUTER_API_KEY is missing');
    process.exit(1);
  }

  try {
    console.log('Starting CDS server...');
    // The server is automatically started by cds.test()
    
    console.log('Fetching a ticket...');
    const res = await GET('/odata/v4/ticket/Tickets?$top=1');
    const tickets = res.data.value;
    
    if (!tickets || tickets.length === 0) {
      console.log('No tickets found in the database. Cannot test AI dispatch.');
      process.exit(0);
    }
    
    const ticketId = tickets[0].ID;
    console.log(`Testing AI Recommender with Ticket ID: ${ticketId}`);
    
    console.log('Calling recommendAssignees...');
    const response = await POST(`/odata/v4/ticket/recommendAssignees`, { ticketId });
    console.log('\n--- AI RESPONSE ---');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('-------------------');

  } catch(err) {
    console.error('Test failed:', err.response ? err.response.data : err);
  }
  process.exit(0);
}

test();
