import { z } from "zod";

export const InterviewStepSchema = z.object({
  assistant_message: z.string(),
  state: z.string(),
  substate: z.string()
});

export type InterviewStep = z.infer<typeof InterviewStepSchema>;

// Scoring Schema
const EvaluationSchema = z.object({
  accuracy: z.number().min(1).max(10),
  depth: z.number().min(1).max(10),
  clarity: z.number().min(1).max(10)
});

const QnASchema = z.object({
  question: z.string(),
  answer: z.string(),
  evaluation: EvaluationSchema
});

const TestResultsSchema = z.object({
  passed: z.number(),
  failed: z.number(),
  total: z.number()
});

const CodingArtifactsSchema = z.object({
  question: z.string(),
  code: z.string(),
  explanation: z.string(),
  test_results: TestResultsSchema
});

const GreetingStageSchema = z.object({
  score: z.number().min(1).max(10),
  criteria: z.object({
    confidence: z.number().min(1).max(10),
    communication: z.number().min(1).max(10),
    professionalism: z.number().min(1).max(10),
    engagement: z.number().min(1).max(10)
  }),
  notes: z.string()
});

const ResumeDiscussionStageSchema = z.object({
  score: z.number().min(1).max(10),
  criteria: z.object({
    relevance_of_experience: z.number().min(1).max(10),
    depth_of_projects: z.number().min(1).max(10),
    clarity_in_explanation: z.number().min(1).max(10),
    technical_alignment: z.number().min(1).max(10)
  }),
  notes: z.string()
});

const CodingRoundStageSchema = z.object({
  score: z.number().min(1).max(10),
  criteria: z.object({
    problem_solving: z.number().min(1).max(10),
    code_correctness: z.number().min(1).max(10),
    optimization: z.number().min(1).max(10),
    readability: z.number().min(1).max(10),
    edge_case_handling: z.number().min(1).max(10),
    explanation: z.number().min(1).max(10)
  }),
  artifacts: CodingArtifactsSchema,
  notes: z.string()
});

const TechnicalCSRoundStageSchema = z.object({
  score: z.number().min(1).max(10),
  criteria: z.object({
    core_cs_fundamentals: z.number().min(1).max(10),
    system_design: z.number().min(1).max(10),
    algorithms_and_ds: z.number().min(1).max(10),
    ml_ai_domain_knowledge: z.number().min(1).max(10),
    clarity_and_depth: z.number().min(1).max(10)
  }),
  qna: z.array(QnASchema),
  notes: z.string()
});

const BehavioralRoundStageSchema = z.object({
  score: z.number().min(1).max(10),
  criteria: z.object({
    teamwork: z.number().min(1).max(10),
    leadership: z.number().min(1).max(10),
    conflict_resolution: z.number().min(1).max(10),
    adaptability: z.number().min(1).max(10),
    culture_fit: z.number().min(1).max(10),
    communication: z.number().min(1).max(10)
  }),
  qna: z.array(QnASchema),
  notes: z.string()
});

const WrapUpStageSchema = z.object({
  score: z.number().min(1).max(10),
  criteria: z.object({
    final_impression: z.number().min(1).max(10),
    questions_asked: z.number().min(1).max(10),
    closing_communication: z.number().min(1).max(10)
  }),
  notes: z.string()
});

const OverallSchema = z.object({
  final_score: z.number().min(1).max(100),
  recommendation: z.enum(["Hire", "No Hire", "Maybe"]),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string())
});

export const InterviewScoringSchema = z.object({
  candidate_id: z.string(),
  interview_id: z.string(),
  stages: z.object({
    greeting: GreetingStageSchema,
    resume_discussion: ResumeDiscussionStageSchema,
    coding_round: CodingRoundStageSchema,
    technical_cs_round: TechnicalCSRoundStageSchema,
    behavioral_round: BehavioralRoundStageSchema,
    wrap_up: WrapUpStageSchema
  }),
  overall: OverallSchema
});

export type InterviewScoring = z.infer<typeof InterviewScoringSchema>;

// Recommendation Schema
const RecommendationItemSchema = z.object({
  category: z.string(),
  strengths: z.array(z.string()),
  areasOfImprovement: z.array(z.string()),
  actionableTips: z.array(z.string()),
  resources: z.array(z.string()),
  overallSummary: z.string()
});

export const InterviewRecommendationSchema = z.object({
  candidate_id: z.string(),
  interview_id: z.string(),
  recommendations: z.array(RecommendationItemSchema),
  finalAdvice: z.string()
});

export type InterviewRecommendation = z.infer<typeof InterviewRecommendationSchema>;
