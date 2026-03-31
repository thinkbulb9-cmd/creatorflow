const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

async function createTestUser() {
  const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/creatorflow';
  const client = new MongoClient(MONGO_URL);

  try {
    await client.connect();
    console.log('✓ Connected to MongoDB');

    const db = client.db();
    const users = db.collection('users');

    // Check if test user already exists
    const existingUser = await users.findOne({ email: 'testuser@creatorflow.ai' });
    
    if (existingUser) {
      console.log('✓ Test user already exists');
      console.log('Email: testuser@creatorflow.ai');
      console.log('Password: TestPassword123!');
      return;
    }

    // Create test user
    const hashedPassword = await bcrypt.hash('TestPassword123!', 10);
    const testUser = {
      _id: uuidv4(),
      name: 'Test User',
      email: 'testuser@creatorflow.ai',
      password: hashedPassword,
      image: null,
      provider: 'credentials',
      created_at: new Date()
    };

    await users.insertOne(testUser);
    console.log('✓ Test user created successfully!');
    console.log('Email: testuser@creatorflow.ai');
    console.log('Password: TestPassword123!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

createTestUser();
