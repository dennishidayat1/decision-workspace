import { developmentApiUrl } from './development-api-url';

export const environment = {
  production: false,
  apiUrl: developmentApiUrl(globalThis.location?.hostname),
  supabaseUrl: 'https://odxyokdewpjptmdtzahu.supabase.co',
  supabaseKey: 'sb_publishable_0CHW55EWFyz0QfLXNjz52g_giNbKVJF'
};
