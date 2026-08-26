const { MongoClient } = require('mongodb');
const { app } = require('electron');
const { loadSettings } = require('./settings');

let client = null;
let dictations = null;
let apiUsage = null;

async function connectDb() {
  const { mongoUri } = loadSettings();
  if (!mongoUri) {
    console.log('[db] DB disabled, no URI configured');
    return;
  }

  try {
    client = new MongoClient(mongoUri);
    await client.connect();

    const db = client.db();
    await db.command({ ping: 1 });

    dictations = db.collection('dictations');
    apiUsage = db.collection('api_usage');

    await dictations.createIndex({ createdAt: -1 });
    await apiUsage.createIndex({ dictationId: 1 });

    console.log('[db] connected');
  } catch (err) {
    console.error('[db] connection failed:', err.message);
    client = null;
    dictations = null;
    apiUsage = null;
  }
}

// Silent-fail by design: a saved dictation must never turn a successful
// paste into an error. Every path here resolves instead of throwing.
async function saveDictation({ text, rawText, hotkey, durationMs, startedAt, focusedApp }) {
  if (!dictations) return null;
  try {
    const result = await dictations.insertOne({
      text,
      rawText,
      createdAt: startedAt,
      hotkey,
      durationMs,
      appVersion: app.getVersion(),
      focusedApp,
      wordCount: text.split(/\s+/).filter(Boolean).length,
    });
    return result.insertedId;
  } catch (err) {
    console.error('[db] saveDictation failed:', err.message);
    return null;
  }
}

async function saveApiUsage({ dictationId, deepgram, groq }) {
  if (!apiUsage) return;
  try {
    await apiUsage.insertOne({
      dictationId,
      deepgram,
      groq,
      createdAt: new Date(),
    });
  } catch (err) {
    console.error('[db] saveApiUsage failed:', err.message);
  }
}

async function closeDb() {
  if (!client) return;
  try {
    await client.close();
  } catch (err) {
    console.error('[db] closeDb failed:', err.message);
  } finally {
    client = null;
    dictations = null;
    apiUsage = null;
  }
}

module.exports = { connectDb, saveDictation, saveApiUsage, closeDb };
