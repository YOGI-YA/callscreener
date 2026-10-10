import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  llmProvider: (process.env.LLM_PROVIDER || (process.env.OLLAMA_BASE_URL ? 'ollama' : process.env.GEMINI_API_KEY ? 'gemini' : 'local_heuristic')) as 'gemini' | 'ollama' | 'local_heuristic',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  llmModel: process.env.LLM_MODEL || 'gemini-1.5-flash',
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
  ollamaModel: process.env.OLLAMA_MODEL || 'llama3.2:1b',
  apiSecretKey: process.env.API_SECRET_KEY || 'dev_secret_screening_token_2026',
  llmTimeoutMs: parseInt(process.env.LLM_TIMEOUT_MS || '2500', 10),
  fastRulesTimeoutMs: parseInt(process.env.FAST_RULES_TIMEOUT_MS || '100', 10),
  isDev: (process.env.NODE_ENV || 'development') === 'development',
};
