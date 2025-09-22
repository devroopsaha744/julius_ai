import mongoose, { Document, Schema } from 'mongoose';

export interface IResume extends Document {
  filename: string;
  originalName: string;
  path: string;
  size: number;
  mimeType: string;
  uploadedBy: mongoose.Types.ObjectId;
  sessionId?: mongoose.Types.ObjectId; // If associated with a session
  extractedText?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ResumeSchema: Schema = new Schema({
  filename: {
    type: String,
    required: true,
  },
  originalName: {
    type: String,
    required: true,
  },
  path: {
    type: String,
    required: true,
  },
  size: {
    type: Number,
    required: true,
  },
  mimeType: {
    type: String,
    required: true,
  },
  uploadedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  sessionId: {
    type: Schema.Types.ObjectId,
    ref: 'InterviewSession',
  },
  extractedText: {
    type: String,
  },
}, {
  timestamps: true,
});

export default mongoose.models.Resume || mongoose.model<IResume>('Resume', ResumeSchema);