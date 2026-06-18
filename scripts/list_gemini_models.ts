import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

function loadKeyFromEnvFile() {
  const p = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(p)) return null;
  const txt = fs.readFileSync(p, 'utf8');
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*GOOGLE_GEMINI_API_KEY\s*=\s*(.+)\s*$/);
    if (m) return m[1].trim();
  }
  return null;
}

async function listModels() {
  const key = process.env.GOOGLE_GEMINI_API_KEY || loadKeyFromEnvFile();
  if (!key) {
    console.error('Set GOOGLE_GEMINI_API_KEY in env or .env.local');
    process.exit(1);
  }
  const client = new GoogleGenerativeAI(key);
  try {
    const models = await client.listModels();
    console.log(JSON.stringify(models, null, 2));
  } catch (e) {
    console.error('ListModels error:', e instanceof Error ? e.message : e);
    process.exit(2);
  }
}

listModels();
