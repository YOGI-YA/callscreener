import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  llmModel: process.env.LLM_MODEL || 'gemini-1.5-flash',
  apiSecretKey: process.env.API_SECRET_KEY || 'dev_secret_screening_token_2026',
  llmTimeoutMs: parseInt(process.env.LLM_TIMEOUT_MS || '2200', 10),
  fastRulesTimeoutMs: parseInt(process.env.FAST_RULES_TIMEOUT_MS || '100', 10),
  isDev: (process.env.NODE_ENV || 'development') === 'development',
};
