import { createServer } from './server.js';
import { config } from './config.js';
import { CallLogStorage } from './services/callLogStorage.js';

const app = createServer();

// Initialize initial data seeds
CallLogStorage.initializeSeedData();

const server = app.listen(config.port, () => {
  console.log(`\n======================================================`);
  console.log(`  AI Call Screener Backend Service running on :${config.port}`);
  console.log(`  Environment: ${config.nodeEnv}`);
  console.log(`  LLM Engine: ${config.geminiApiKey ? `Gemini (${config.llmModel})` : 'Intelligent Heuristic Simulator'}`);
  console.log(`  Health Check: http://localhost:${config.port}/api/health`);
  console.log(`======================================================\n`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});
