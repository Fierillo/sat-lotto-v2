import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { neonConfig } from '@neondatabase/serverless';
import WebSocket from 'ws';

neonConfig.webSocketConstructor = WebSocket;

import betHandler from './api/bet.js';
import betsHandler from './api/bets.js';
import resultHandler from './api/result.js';

function shimRes(res: any) {
    if (!res.status) {
        res.status = (code: number) => { res.statusCode = code; return res; };
    }
    if (!res.json) {
        res.json = (data: any) => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
        };
    }
    return res;
}

async function createServer() {
    const app = express();
    app.use(express.json());

    const wrap = (handler: any) => async (req: express.Request, res: express.Response) => {
        try {
            console.log(`${req.method} ${req.url}`);
            await handler(req, shimRes(res));
        } catch (err: any) {
            console.error('API Error:', err);
            if (!res.headersSent) res.status(500).json({ error: err.message });
        }
    };

    app.post('/api/bet', wrap(betHandler));
    app.get('/api/bets', wrap(betsHandler));
    app.get('/api/result', wrap(resultHandler));

    const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa'
    });

    app.use(vite.middlewares);

    const PORT = 5173;
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`\n  ➜  Local:   http://localhost:${PORT}/ (API + Frontend)\n`);
    });
}

createServer().catch(console.error);
