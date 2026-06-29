'use strict';

const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const cds = require('@sap/cds');

const webAppRoot = path.join(__dirname, 'app', 'dist');
const webAppIndex = path.join(webAppRoot, 'index.html');

cds.on('bootstrap', (app) => {
	const crypto = require('node:crypto');
	const { getLogger } = require('./srv/shared/logging/logger');
	const logger = getLogger('server');

	app.use((req, res, next) => {
		req.traceId = req.headers['x-trace-id'] || crypto.randomUUID();
		res.setHeader('X-Trace-Id', req.traceId);

		const start = performance.now();
		res.on('finish', () => {
			const duration = performance.now() - start;
			logger.info(`${req.method} ${req.originalUrl || req.url}`, {
				traceId: req.traceId,
				status: res.statusCode,
				durationMs: parseFloat(duration.toFixed(2))
			});
		});
		next();
	});

	if (fs.existsSync(webAppIndex)) {
		app.use(express.static(webAppRoot));
	}
});

cds.on('served', () => {
	if (!fs.existsSync(webAppIndex) || !cds.app) return;

	// Register scheduled background jobs after the server is served
	try {
		const { registerCleanupJob } = require('./srv/documentation/cleanup-job');
		registerCleanupJob();
	} catch (e) {
		// non-fatal if job cannot be registered
		console.warn('cleanup job registration skipped:', e.message);
	}

	cds.app.use((req, res, next) => {
		if (req.method !== 'GET' && req.method !== 'HEAD') return next();
		if (req.path.startsWith('/odata/v4') || req.path.startsWith('/-/')) return next();
		if (req.path.startsWith('/attachments/')) return next();
		if (path.extname(req.path)) return next();

		res.sendFile(webAppIndex);
	});
});

module.exports = cds.server;
