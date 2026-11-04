import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = {
    conn: null,
    promise: null,
    listenersBound: false,
  };
}

async function connectDB() {
  if (!MONGODB_URI) {
    const error = new Error(
      'Vui lòng định nghĩa biến MONGODB_URI trong file .env.local'
    );
    Object.assign(error, { code: 'MONGODB_URI_MISSING' });
    throw error;
  }

  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  // Không dùng lại connection cache đã bị ngắt.
  if (mongoose.connection.readyState === 0) {
    cached.conn = null;
    cached.promise = null;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      dbName: process.env.MONGODB_DB || 'it_helpdesk',
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 0,
      maxIdleTimeMS: 30000,
    };

    cached.promise = mongoose
      .connect(MONGODB_URI, opts)
      .then((connection) => {
        cached.conn = connection;
        return connection;
      })
      .catch((error) => {
        // A failed initial connection should not poison later retry attempts.
        cached.conn = null;
        cached.promise = null;
        throw error;
      });

    if (!cached.listenersBound) {
      mongoose.connection.on('disconnected', () => {
        cached.conn = null;
        cached.promise = null;
      });
      cached.listenersBound = true;
    }
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

export function isMongoConnectionError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const code = (error as Error & { code?: string }).code;
  return (
    code === 'MONGODB_URI_MISSING' ||
    /MongooseServerSelectionError|MongoServerSelectionError|MongoNetworkError|MongoNetworkTimeoutError/.test(
      error.name
    )
  );
}

export default connectDB;
