const https = require('https');
const http = require('http');

async function getClientCredentialsToken() {
    const url = 'https://4dee736atrial.authentication.us10.hana.ondemand.com/oauth/token?grant_type=client_credentials';
    const clientId = 'sb-ticket-cap-dev!t660974';
    const clientSecret = '12db90a3-8739-4d82-ad0a-6ebc62c8c7c9$Bscwfw5rDej_Q6prXLjTu-nvdWjAZ5PMiLIxlX5MKIs=';
    
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    return new Promise((resolve, reject) => {
        const req = https.request(url, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        });
        req.on('error', reject);
        req.end();
    });
}

async function testRecommend(token) {
    // Need a valid ticket ID from the DB
    // I'll just use a dummy one or fetch one first
    
    // First let's get a ticket ID
    const getOptions = {
        hostname: '4dee736atrial-dev-ticket-cap-srv.cfapps.us10-001.hana.ondemand.com',
        path: '/odata/v4/ticket/Tickets?$top=1',
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    };
    
    const ticketId = await new Promise((resolve, reject) => {
        const req = https.request(getOptions, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.value && json.value.length > 0) resolve(json.value[0].ID);
                    else reject('No tickets found. Data: ' + data);
                } catch(e) {
                    reject('Parse error. Data: ' + data);
                }
            });
        });
        req.on('error', reject);
        req.end();
    });

    console.log('Testing with Ticket ID:', ticketId);

    const postData = JSON.stringify({ ticketId });
    const postOptions = {
        hostname: '4dee736atrial-dev-ticket-cap-srv.cfapps.us10-001.hana.ondemand.com',
        path: '/odata/v4/ticket/recommendAssignees',
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(postOptions, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data }));
        });
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

async function run() {
    try {
        console.log('Getting token...');
        const tokenRes = await getClientCredentialsToken();
        const token = tokenRes.access_token;
        console.log('Got token. Testing AI Recommender...');
        
        const result = await testRecommend(token);
        console.log('Status:', result.status);
        console.log('Response:', result.data);
    } catch (e) {
        console.error('Error:', e);
    }
}

run();
