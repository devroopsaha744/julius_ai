import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage extends Document {
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const MessageSchema: Schema = new Schema({
  sessionId: {
    type: String,
    required: true,
  },
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
}, {
  timestamps: false, // We use timestamp field instead
});

export default mongoose.models.Message || mongoose.model<IMessage>('Message', MessageSchema);