import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage extends Document {
  sessionId: string;
  userId?: string;
  conversation: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema: Schema = new Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true, // One document per session
  },
  userId: {
    type: String,
    required: false,
  },
  conversation: [{
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  }],
}, {
  timestamps: true, // Use createdAt and updatedAt
});

export default mongoose.models.Message || mongoose.model<IMessage>('Message', MessageSchema);