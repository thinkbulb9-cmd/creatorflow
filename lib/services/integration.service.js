import { getDb } from '../mongodb';
import { v4 as uuidv4 } from 'uuid';

export function maskApiKey(key) {
  if (!key || key.length < 8) return '********';
  return key.substring(0, 4) + '********' + key.substring(key.length - 4);
}

export async function getUserIntegration(userId, provider) {
  const db = await getDb();
  return db.collection('integrations').findOne({ user_id: userId, provider });
}

export async function getAllIntegrations(userId) {
  const db = await getDb();
  const integrations = await db.collection('integrations').find({ user_id: userId }).toArray();
  return integrations.map(i => ({
    ...i,
    config_json: {
      ...i.config_json,
      api_key: i.config_json?.api_key ? maskApiKey(i.config_json.api_key) : undefined,
      client_secret: i.config_json?.client_secret ? maskApiKey(i.config_json.client_secret) : undefined,
    }
  }));
}

export async function saveIntegration(userId, provider, configJson) {
  const db = await getDb();
  const existing = await db.collection('integrations').findOne({ user_id: userId, provider });
  if (existing) {
    const mergedConfig = { ...existing.config_json, ...configJson };
    await db.collection('integrations').updateOne(
      { user_id: userId, provider },
      { $set: { config_json: mergedConfig, is_connected: true, updated_at: new Date() } }
    );
    return { ...existing, config_json: mergedConfig, is_connected: true };
  }
  const integration = {
    _id: uuidv4(), user_id: userId, provider,
    config_json: configJson, is_connected: true,
    created_at: new Date(), updated_at: new Date()
  };
  await db.collection('integrations').insertOne(integration);
  return integration;
}

export async function deleteIntegration(userId, provider) {
  const db = await getDb();
  await db.collection('integrations').deleteOne({ user_id: userId, provider });
  return true;
}

export async function getApiKey(userId, provider) {
  const integration = await getUserIntegration(userId, provider);
  if (integration?.config_json?.api_key) return integration.config_json.api_key;
  if (provider === 'openai') return process.env.OPENAI_API_KEY || null;
  if (provider === 'heygen') return process.env.HEYGEN_API_KEY || null;
  return null;
}
