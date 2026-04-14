// DEPRECATED: MongoDB has been replaced with Supabase.
// This file is kept as a stub to prevent import errors.
// All database operations now use Supabase via @/lib/supabase.js

console.warn('WARNING: mongodb.js is deprecated. Use supabase.js instead.');

export async function getDb() {
  throw new Error('MongoDB has been removed. Use Supabase instead. Import from @/lib/supabase.js');
}

export default null;
