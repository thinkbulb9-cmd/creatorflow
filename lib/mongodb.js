import { MongoClient } from 'mongodb';

const MONGO_URL = process.env.MONGO_URL;
const rawDbName = process.env.DB_NAME;
const DB_NAME = (!rawDbName || rawDbName === 'your_database_name') ? 'creatorflow' : rawDbName;

if (!MONGO_URL) throw new Error('MONGO_URL is not defined');

let client;
let clientPromise;

if (process.env.NODE_ENV === 'development') {
  if (!global._mongoClientPromise) {
    client = new MongoClient(MONGO_URL);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(MONGO_URL);
  clientPromise = client.connect();
}

export async function getDb() {
  const c = await clientPromise;
  return c.db(DB_NAME);
}

export default clientPromise;
