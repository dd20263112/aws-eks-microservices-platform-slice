    const express = require('express');
    const crypto = require('crypto');

    // Create an Express application instance
    const app = express();
    app.use(express.json());
    /* ------------------ input json validaton middleware ------------------ */
    app.use((err, req, res, next) => {
    // express.json() throws SyntaxError for bad JSON
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({
        error: 'invalid_json',
        message: 'Malformed JSON in request body',
        requestId: req.requestId
        });
    }

    // Pass other errors down the chain
    next(err);
    });
    const SERVICE_NAME = 'catalog';
    // Define the port number the server will listen on
    const port = process.env.PORT || 8080;

    var queue_url = process.env.AUDIT_QUEUE_URL;

    /* ------------------ request id middleware ------------------ */
    app.use((req, res, next) => {
    req.requestId =
        req.headers['x-request-id'] ||
        crypto.randomUUID();
        res.set('x-request-id', req.requestId);
    next();
    });

    /* ------------------ structured logging middleware ------------------ */
    app.use((req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
        const log = {
        timestamp: new Date().toISOString(),
        level: 'INFO',
        service: SERVICE_NAME,
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        latencyMs: Date.now() - start
        };

        console.log(JSON.stringify(log));
    });

    next();
    });


    // Define a route for the health (GET request to '/health')
    app.get('/health', (req, res) => {
    res.json({
        status: "healthy",
        "x-request-id": req.requestId
        });
    });

    // Define a route for POST items
    app.post('/items', (req, res) => {
    const itemId = crypto.randomUUID();
    const requestId = req.requestId;
    const createdAt = new Date().toISOString();
    res.status(201).json({
        ...req.body,
    itemId,
    createdAt,
    requestId: req.requestId
    });
    });

    

    app.use((req, res) => {
    res.status(404).json({
        error: 'not_found',
        message: 'Route not found',
        requestId: req.requestId
    });
    });
    // Start the server and listen for incoming requests
    const server =  app.listen(port, () => {
    console.log(`Catalog service listening on port ${port}`);
    });

    const shutdown = (signal) => {
    console.log(JSON.stringify({
        level: 'INFO',
        service: 'catalog',
        event: 'shutdown',
        signal
    }));

    // Stop accepting new connections
    server.close(() => {
        console.log(JSON.stringify({
        level: 'INFO',
        service: 'catalog',
        event: 'shutdown_complete'
        }));
        process.exit(0);
    });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);


