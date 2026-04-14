const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

async function createTestUser() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Check if test user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', 'testuser@creatorflow.ai')
      .single();

    if (existingUser) {
      console.log('Test user already exists');
      console.log('Email: testuser@creatorflow.ai');
      console.log('Password: TestPassword123!');
      return;
    }

    // Create test user
    const hashedPassword = await bcrypt.hash('TestPassword123!', 10);
    const { error } = await supabase
      .from('users')
      .insert({
        id: uuidv4(),
        name: 'Test User',
        email: 'testuser@creatorflow.ai',
        password: hashedPassword,
        image: null,
        provider: 'credentials',
        created_at: new Date().toISOString()
      });

    if (error) {
      throw new Error(error.message);
    }

    console.log('Test user created successfully!');
    console.log('Email: testuser@creatorflow.ai');
    console.log('Password: TestPassword123!');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

createTestUser();
