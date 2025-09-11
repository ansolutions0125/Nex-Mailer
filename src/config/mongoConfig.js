// config/mongoConfig.js

import mongoose from 'mongoose';
 
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  throw new Error(
    'Please define the MONGODB_URI environment variable inside .env.local'
  );
}
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function dbConnect() {
  if (cached.conn) {
    return cached.conn;
  }

  const opts = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  };

  // If there's no connection promise, create a new one.
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      console.log('MongoDB connected successfully!'); // Log successful connection
      return mongoose;
    }).catch(error => {
      console.error('MongoDB connection error:', error); // Log connection errors
      cached.promise = null; // Reset promise on error to allow retries
      throw error; // Re-throw the error to propagate it
    });
  }

  // Await the connection promise and store the resolved connection.
  cached.conn = await cached.promise;
  return cached.conn;
}

export default dbConnect;
