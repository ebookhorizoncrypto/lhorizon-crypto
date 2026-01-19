import http from 'http';
import { join } from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
// Import handlers
import signClaimHandler from './api/sign-claim.js';
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

    // Router
    if (req.url === '/api/sign-claim' && req.method === 'POST') {
        // Adapt standard req/res to Vercel-like handler signature if needed
        // Our handler expects (req, res) with .json() method on res
        res.status = (code) => {
            res.statusCode = code;
            return res;
        };
        res.json = (data) => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
            return res;
        };

        await signClaimHandler(req, res);
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

server.listen(PORT, () => {
    console.log(`Backend API running at http://localhost:${PORT}`);
    console.log(`Endpoint: http://localhost:${PORT}/api/sign-claim`);
});
