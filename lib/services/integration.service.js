import { supabaseAdmin } from '../supabase';
import { v4 as uuidv4 } from 'uuid';

export function maskApiKey(key) {
  if (!key || key.length < 8) return '********';
  return key.substring(0, 4) + '********' + key.substring(key.length - 4);
}

export async function getUserIntegration(userId, provider) {
  const { data, error } = await supabaseAdmin
    .from('integrations')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', provider)
    .single();

  if (error || !data) return null;
  return data;
}

export async function getAllIntegrations(userId) {
  const { data: integrations, error } = await supabaseAdmin
    .from('integrations')
    .select('*')
    .eq('user_id', userId);

  if (error || !integrations) return [];

  return integrations.map(i => ({
    ...i,
    config_json: {
      ...i.config_json,
      api_key: i.config_json?.api_key ? maskApiKey(i.config_json.api_key) : undefined,
      client_secret: i.config_json?.client_secret ? maskApiKey(i.config_json.client_secret) : undefined,
    }
  }));
}

export async function saveIntegration(userId, provider, configJson, isConnected = false) {
  const { data: existing } = await supabaseAdmin
    .from('integrations')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', provider)
    .single();

  if (existing) {
    const mergedConfig = { ...existing.config_json, ...configJson };
    await supabaseAdmin
      .from('integrations')
      .update({
        config_json: mergedConfig,
        is_connected: isConnected,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('provider', provider);

    return { ...existing, config_json: mergedConfig, is_connected: isConnected };
  }

  const integration = {
    id: uuidv4(),
    user_id: userId,
    provider,
    config_json: configJson,
    is_connected: isConnected,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { error: insertError } = await supabaseAdmin
    .from('integrations')
    .insert(integration);

  if (insertError) throw new Error(insertError.message);

  return integration;
}

export async function deleteIntegration(userId, provider) {
  await supabaseAdmin
    .from('integrations')
    .delete()
    .eq('user_id', userId)
    .eq('provider', provider);

  return true;
}

export async function getApiKey(userId, provider) {
  const integration = await getUserIntegration(userId, provider);
  if (integration?.config_json?.api_key) return integration.config_json.api_key;
  if (provider === 'openai') return process.env.OPENAI_API_KEY || null;
  if (provider === 'heygen') return process.env.HEYGEN_API_KEY || null;
  return null;
}
