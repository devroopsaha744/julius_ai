import { UnifiedInterviewAgent } from './unified_agent';
import { ScoringAgent } from './score';
import { RecommendationAgent } from './recommendation';
import { InterviewStep, InterviewScoring, InterviewRecommendation } from '../models/models';
import { extractText } from '../utils/extractText';
import fs from 'fs';

export enum InterviewStage {
  GREET = 'greet',
  RESUME = 'resume', 
  CODING = 'coding',
  CS = 'cs',
  BEHAVIORAL = 'behavioral',
  WRAPUP = 'wrapup',
  COMPLETED = 'completed'
}

export class InterviewOrchestrator {
  private sessionId: string;
  private currentStage: InterviewStage;
  
  // Single unified agent instance
  private unifiedAgent: UnifiedInterviewAgent;
  private scoringAgent: ScoringAgent;
  private recommendationAgent: RecommendationAgent;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.currentStage = InterviewStage.GREET;
    
    // Initialize unified agent and scoring/recommendation agents
    this.unifiedAgent = new UnifiedInterviewAgent(sessionId);
    this.scoringAgent = new ScoringAgent(sessionId);
    this.recommendationAgent = new RecommendationAgent(sessionId);
  }

  private getSubstateForStage(stage: InterviewStage): string {
    const stageToSubstateMap: Record<InterviewStage, string> = {
      [InterviewStage.GREET]: 'greet',
      [InterviewStage.RESUME]: 'resume',
      [InterviewStage.CODING]: 'coding',
      [InterviewStage.CS]: 'cs',
      [InterviewStage.BEHAVIORAL]: 'behave',
      [InterviewStage.WRAPUP]: 'wrap_up',
      [InterviewStage.COMPLETED]: 'end'
    };
    return stageToSubstateMap[stage] || 'greet';
  }

  private getStageForSubstate(substate: string): InterviewStage {
    const substateToStageMap: Record<string, InterviewStage> = {
      'greet': InterviewStage.GREET,
      'resume': InterviewStage.RESUME,
      'coding': InterviewStage.CODING,
      'cs': InterviewStage.CS,
      'behave': InterviewStage.BEHAVIORAL,
      'wrap_up': InterviewStage.WRAPUP,
      'end': InterviewStage.COMPLETED
    };
    return substateToStageMap[substate] || this.currentStage;
  }

  async processMessage(userMessage: string, resumeFilePath?: string, userCode?: string, codeSubmitted: boolean = false): Promise<{
    response: InterviewStep;
    currentStage: InterviewStage;
    stageChanged: boolean;
    scoringResult?: InterviewScoring;
    recommendationResult?: InterviewRecommendation;
  }> {
    const previousStage = this.currentStage;
    let response: InterviewStep;
    let scoringResult: InterviewScoring | undefined;
    let recommendationResult: InterviewRecommendation | undefined;

  // Extract resume content once (if provided) to pass into agent so it has context
    let resumeContent: string | undefined = undefined;
    if (resumeFilePath) {
      try {
        resumeContent = await extractText(resumeFilePath);
      } catch (e) {
        // fallback to raw read
        try {
          resumeContent = fs.readFileSync(resumeFilePath, 'utf-8');
        } catch (err) {
          console.warn('Orchestrator: unable to read resume file:', err);
          resumeContent = undefined;
        }
      }
    }

    switch (this.currentStage) {
      case InterviewStage.GREET:
      case InterviewStage.RESUME:
      case InterviewStage.CODING:
      case InterviewStage.CS:
      case InterviewStage.BEHAVIORAL:
        // Only pass userCode during CODING stage AND when the user explicitly submitted code
        const codeToPass = (this.currentStage === InterviewStage.CODING && codeSubmitted) ? userCode : undefined;

        // Run the agent for the current substate
        response = await this.unifiedAgent.run(userMessage, codeToPass, this.getSubstateForStage(this.currentStage), resumeContent, codeSubmitted);

        // Validate substate returned by agent
        const allowedSubstates = ['greet','resume','coding','cs','behave','wrap_up','end'];
        if (!allowedSubstates.includes(response.substate)) {
          console.warn(`Agent returned invalid substate '${response.substate}', coercing to '${this.getSubstateForStage(this.currentStage)}'`);
          response.substate = this.getSubstateForStage(this.currentStage);
        }

        // If the unified agent returns substate 'end', trigger scoring & recommendation (if resume provided)
        if (response.substate === 'end') {
          if (!resumeFilePath) {
            throw new Error('Resume file path is required to generate scoring and recommendation when interview ends');
          }
          const [scoring, recommendation] = await this.activateScoringAndRecommendation(resumeFilePath);
          scoringResult = scoring || undefined;
          recommendationResult = recommendation || undefined;
          this.currentStage = InterviewStage.COMPLETED;
          break;
        }

        // Otherwise update stage based on returned substate
        const newStage = this.getStageForSubstate(response.substate);
        if (newStage !== this.currentStage) {
          this.currentStage = newStage;

          // Immediately ask the agent to produce a follow-up focused on the NEW substate.
          try {
            const followUpPrompt = `Stage changed to ${this.getSubstateForStage(this.currentStage)}. Please ask one concise, stage-appropriate question or give a prompt relevant ONLY to this new substate.`;
            const followUp = await this.unifiedAgent.run(followUpPrompt, undefined, this.getSubstateForStage(this.currentStage), resumeContent, false);
            if (followUp && allowedSubstates.includes(followUp.substate)) {
              response = followUp;
            }
          } catch (err) {
            console.warn('Failed to generate stage-entry follow-up:', err);
          }
        }

        break;

      case InterviewStage.WRAPUP:
        // Don't pass userCode during wrapup stage
  response = await this.unifiedAgent.run(userMessage, undefined, this.getSubstateForStage(this.currentStage), resumeContent, false);
        // Special handling for wrapup stage - check for "closing" substate
        if (response.substate === "closing") {
          // Activate scoring and recommendation in parallel at the end of wrap up
          if (!resumeFilePath) {
            throw new Error('Resume file path is required for scoring and recommendation stage');
          }
          const [scoring, recommendation] = await this.activateScoringAndRecommendation(resumeFilePath);
          scoringResult = scoring || undefined;
          recommendationResult = recommendation || undefined;
          this.currentStage = InterviewStage.COMPLETED;
        } else if (this.shouldMoveToNextStage(response)) {
          this.currentStage = this.getNextStage();
        }
        break;

      case InterviewStage.COMPLETED:
        response = {
          assistant_message: "The interview has been completed. Thank you for your time!",
          substate: "completed"
        };
        break;

      default:
        throw new Error(`Unknown interview stage: ${this.currentStage}`);
    }

    return {
      response,
      currentStage: this.currentStage,
      stageChanged: previousStage !== this.currentStage,
      ...(scoringResult && { scoringResult }),
      ...(recommendationResult && { recommendationResult })
    };
  }

  private shouldMoveToNextStage(response: InterviewStep): boolean {
    // We move to the next stage only when the agent explicitly returns a different allowed substate
    const allowed = ['greet','resume','coding','cs','behave','wrap_up','end'];
    return allowed.includes(response.substate) && this.getStageForSubstate(response.substate) !== this.currentStage;
  }

  private getNextStage(): InterviewStage {
    switch (this.currentStage) {
      case InterviewStage.GREET:
        return InterviewStage.RESUME;
      case InterviewStage.RESUME:
        return InterviewStage.CODING;
      case InterviewStage.CODING:
        return InterviewStage.CS;
      case InterviewStage.CS:
        return InterviewStage.BEHAVIORAL;
      case InterviewStage.BEHAVIORAL:
        return InterviewStage.WRAPUP;
      case InterviewStage.WRAPUP:
        return InterviewStage.COMPLETED;
      default:
        return InterviewStage.COMPLETED;
    }
  }

  private async activateScoring(resumeFilePath: string): Promise<InterviewScoring | null> {
    try {
      const scoringResult = await this.scoringAgent.run("Please provide comprehensive scoring for this interview.", resumeFilePath);
      console.log(`Interview completed for candidate: ${scoringResult.candidate_id}`);
      console.log(`Final Score: ${scoringResult.overall.final_score}/100`);
      console.log(`Recommendation: ${scoringResult.overall.recommendation}`);
      console.log(`Strengths: ${scoringResult.overall.strengths.join(', ')}`);
      console.log(`Areas for Improvement: ${scoringResult.overall.weaknesses.join(', ')}`);
      return scoringResult;
    } catch (error) {
      console.error('Error generating score:', error);
      return null;
    }
  }

  private async activateScoringAndRecommendation(resumeFilePath: string): Promise<[InterviewScoring | null, InterviewRecommendation | null]> {
    try {
      // Run scoring and recommendation in parallel
      const [scoringResult, recommendationResult] = await Promise.all([
        this.scoringAgent.run("Please provide comprehensive scoring for this interview.", resumeFilePath),
        this.recommendationAgent.run("Please provide detailed recommendations and actionable feedback for this interview.", resumeFilePath)
      ]);

      console.log(`Interview completed for candidate: ${scoringResult.candidate_id}`);
      console.log(`Final Score: ${scoringResult.overall.final_score}/100`);
      console.log(`Recommendation: ${scoringResult.overall.recommendation}`);
      console.log(`Number of feedback categories: ${recommendationResult.recommendations.length}`);

      return [scoringResult, recommendationResult];
    } catch (error) {
      console.error('Error generating score and recommendations:', error);
      return [null, null];
    }
  }

  // Utility methods
  getCurrentStage(): InterviewStage {
    return this.currentStage;
  }

  getSessionId(): string {
    return this.sessionId;
  }

  // Method to reset the interview to start over
  resetInterview(): void {
    this.currentStage = InterviewStage.GREET;
  }

  // Method to manually set stage (useful for testing or special cases)
  setStage(stage: InterviewStage): void {
    this.currentStage = stage;
  }

  // Check if interview is completed
  isCompleted(): boolean {
    return this.currentStage === InterviewStage.COMPLETED;
  }

  // Get scoring result manually (can be called after interview completion)
  async generateScoringReport(resumeFilePath: string): Promise<InterviewScoring> {
    return await this.scoringAgent.run("Please provide comprehensive scoring for this interview.", resumeFilePath);
  }

  // Get recommendation result manually (can be called after interview completion)
  async generateRecommendationReport(resumeFilePath: string): Promise<InterviewRecommendation> {
    return await this.recommendationAgent.run("Please provide detailed recommendations and actionable feedback for this interview.", resumeFilePath);
  }

  // Get both scoring and recommendation reports in parallel
  async generateFullReport(resumeFilePath: string): Promise<{
    scoring: InterviewScoring;
    recommendation: InterviewRecommendation;
  }> {
    const [scoring, recommendation] = await Promise.all([
      this.generateScoringReport(resumeFilePath),
      this.generateRecommendationReport(resumeFilePath)
    ]);

    return { scoring, recommendation };
  }
}
