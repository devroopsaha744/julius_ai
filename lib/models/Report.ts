import mongoose, { Document, Schema } from 'mongoose';
import { InterviewScoring, InterviewRecommendation } from './models';

export interface IReport extends Document {
  sessionId: mongoose.Types.ObjectId;
  scoring?: InterviewScoring;
  recommendation?: InterviewRecommendation;
  generatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ReportSchema: Schema = new Schema({
  sessionId: {
    type: Schema.Types.ObjectId,
    ref: 'InterviewSession',
    required: true,
  },
  scoring: {
    type: Schema.Types.Mixed, // Store the scoring object
  },
  recommendation: {
    type: Schema.Types.Mixed, // Store the recommendation object
  },
  generatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

export default mongoose.models.Report || mongoose.model<IReport>('Report', ReportSchema);