import mongoose, { Document, Schema } from 'mongoose';
import { InterviewScoring, InterviewRecommendation } from './models';

export interface IInterview extends Document {
  userId: mongoose.Types.ObjectId;
  resumeId?: mongoose.Types.ObjectId;
  sessionId: string;
  conversationalReport?: InterviewScoring;
  codingReport?: any; // SingleEvaluatorOutput
  finalReport?: InterviewRecommendation;
  status: 'in_progress' | 'completed';
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

const InterviewSchema: Schema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  resumeId: {
    type: Schema.Types.ObjectId,
    ref: 'Resume',
  },
  sessionId: {
    type: String,
    required: true,
    unique: true,
  },
  conversationalReport: {
    type: Schema.Types.Mixed, // Store InterviewScoring
  },
  codingReport: {
    type: Schema.Types.Mixed, // Store SingleEvaluatorOutput
  },
  finalReport: {
    type: Schema.Types.Mixed, // Store InterviewRecommendation
  },
  status: {
    type: String,
    enum: ['in_progress', 'completed'],
    default: 'in_progress',
  },
  completedAt: {
    type: Date,
  },
}, {
  timestamps: true,
});

export default mongoose.models.Interview || mongoose.model<IInterview>('Interview', InterviewSchema);