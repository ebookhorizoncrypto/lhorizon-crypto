import http from 'http';
import { join } from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
// Import handlers
import signClaimHandler from './api/sign-claim.js';
import leadMagnetHandler from './api/lead-magnet.js';
import contactHandler from './api/contact.js';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = 3001; // Running on 3001 to avoid conflict with frontend 3000

const server = http.createServer(async (req, res) => {
    // Basic body parser for JSON
    const buffers = [];
    for await (const chunk of req) {
        buffers.push(chunk);
    }
    const data = Buffer.concat(buffers).toString();

    if (data) {
        try {
            req.body = JSON.parse(data);
        } catch (e) {
            req.body = {};
        }
    } else {
        req.body = {};
    }

    console.log(`[${req.method}] ${req.url}`);

    // Default CORS for all requests (redundant protection)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With');

    // Handle Preflight Globally at Server Level
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Router
    const routes = {
        '/api/sign-claim': signClaimHandler,
        '/api/lead-magnet': leadMagnetHandler,
        '/api/contact': contactHandler
    };

    if (routes[req.url] && req.method === 'POST') {
        const handler = routes[req.url];

        // Adapt standard req/res to Vercel-like handler signature
        res.status = (code) => {
            res.statusCode = code;
            return res;
        };
        res.json = (data) => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
            return res;
        };

        try {
            await handler(req, res);
        } catch (err) {
            console.error("Handler Error:", err);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
        }
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend API running at http://localhost:${PORT}`);
    console.log(`Endpoint: http://localhost:${PORT}/api/sign-claim`);
});
