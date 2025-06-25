import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://asooseoijjjmpopaypog.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzb29zZW9pampqbXBvcGF5cG9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkwOTI4NDUsImV4cCI6MjA1NDY2ODg0NX0.9HzViASPLWsOaqI1LcJeT2q9AHASu3tChLmgmbBsImU';

const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  const { data, error } = await supabase.from('playlists').select('*');
  if (error) {
    console.error('Fehler:', error);
  } else {
    console.log('Playlists:', data);
  }
})();
