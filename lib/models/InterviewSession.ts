import mongoose, { Document, Schema } from 'mongoose';

export interface IInterviewSession extends Document {
  sessionId: string;
  recruiterId: mongoose.Types.ObjectId;
  candidateName?: string;
  candidateEmail?: string;
  resumeId?: mongoose.Types.ObjectId;
  status: 'active' | 'completed' | 'cancelled';
  state: string; // e.g., 'greet', 'resume', 'coding', etc.
  substate: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

const InterviewSessionSchema: Schema = new Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
  },
  recruiterId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  candidateName: {
    type: String,
  },
  candidateEmail: {
    type: String,
  },
  resumeId: {
    type: Schema.Types.ObjectId,
    ref: 'Resume',
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled'],
    default: 'active',
  },
  state: {
    type: String,
    default: 'greet',
  },
  substate: {
    type: String,
    default: '',
  },
  completedAt: {
    type: Date,
  },
}, {
  timestamps: true,
});

export default mongoose.models.InterviewSession || mongoose.model<IInterviewSession>('InterviewSession', InterviewSessionSchema);