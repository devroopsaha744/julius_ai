import { z } from "zod";

export const InterviewStepSchema = z.object({
  assistant_message: z.string(),
  state: z.string(),
  substate: z.string()
});

export type InterviewStep = z.infer<typeof InterviewStepSchema>;

// Scoring Schema
const EvaluationSchema = z.object({
  accuracy: z.number(),
  depth: z.number(),
  clarity: z.number()
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
  score: z.number(),
  criteria: z.object({
    confidence: z.number(),
    communication: z.number(),
    professionalism: z.number(),
    engagement: z.number()
  }),
  notes: z.string()
});

const ResumeDiscussionStageSchema = z.object({
  score: z.number(),
  criteria: z.object({
    relevance_of_experience: z.number(),
    depth_of_projects: z.number(),
    clarity_in_explanation: z.number(),
    technical_alignment: z.number()
  }),
  notes: z.string()
});

const CodingRoundStageSchema = z.object({
  score: z.number(),
  criteria: z.object({
    problem_solving: z.number(),
    code_correctness: z.number(),
    optimization: z.number(),
    readability: z.number(),
    edge_case_handling: z.number(),
    explanation: z.number()
  }),
  artifacts: CodingArtifactsSchema,
  notes: z.string()
});

const TechnicalCSRoundStageSchema = z.object({
  score: z.number(),
  criteria: z.object({
    core_cs_fundamentals: z.number(),
    system_design: z.number(),
    algorithms_and_ds: z.number(),
    ml_ai_domain_knowledge: z.number(),
    clarity_and_depth: z.number()
  }),
  qna: z.array(QnASchema),
  notes: z.string()
});

const BehavioralRoundStageSchema = z.object({
  score: z.number(),
  criteria: z.object({
    teamwork: z.number(),
    leadership: z.number(),
    conflict_resolution: z.number(),
    adaptability: z.number(),
    culture_fit: z.number(),
    communication: z.number()
  }),
  qna: z.array(QnASchema),
  notes: z.string()
});

const WrapUpStageSchema = z.object({
  score: z.number(),
  criteria: z.object({
    final_impression: z.number(),
    questions_asked: z.number(),
    closing_communication: z.number()
  }),
  notes: z.string()
});

const CommunicationSkillsSchema = z.object({
  verbal_clarity: z.number(),
  articulation: z.number(),
  listening_skills: z.number(),
  empathy: z.number(),
  persuasion: z.number(),
  active_listening: z.number(),
  overall_communication_score: z.number()
});

const OverallSchema = z.object({
  final_score: z.number(),
  recommendation: z.string(),
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
  communication_skills: CommunicationSkillsSchema,
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

// Coding Curator Schema
const ProblemSchema = z.object({
  id: z.string(),
  title: z.string(),
  difficulty: z.string(),
  description: z.string(),
  input_format: z.string(),
  output_format: z.string(),
  // Constraints can be null when there are none
  constraints: z.string().nullable(),
  language: z.string().default('javascript'),
  test_cases: z.array(z.object({
    input: z.string(),
    expected_output: z.string()
  })),
  // The Responses API requires fields to be present. If there's no starter template,
  // allow the field to be null rather than making it optional.
  starter_template: z.object({
    java: z.string(),
    cpp: z.string(),
    python: z.string()
  }).nullable()
});

export const CuratorOutputSchema = z.object({
  problems: z.array(ProblemSchema)
});

export type Problem = z.infer<typeof ProblemSchema>;
export type CuratorOutput = z.infer<typeof CuratorOutputSchema>;

// Coding Evaluator Schema
const ProblemResultSchema = z.object({
  id: z.string(),
  correctness: z.number(),
  optimization: z.number(),
  readability: z.number(),
  feedback: z.string(),
  passed_tests: z.number(),
  total_tests: z.number()
});

const OverallEvaluationSchema = z.object({
  overall_correctness: z.number(),
  overall_optimization: z.number(),
  overall_readability: z.number(),
  recommendation: z.string()
});

export const EvaluatorOutputSchema = z.object({
  results: z.array(ProblemResultSchema),
  overall: OverallEvaluationSchema
});

export type ProblemResult = z.infer<typeof ProblemResultSchema>;
export type EvaluatorOutput = z.infer<typeof EvaluatorOutputSchema>;
