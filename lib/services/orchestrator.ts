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

  private getstateForStage(stage: InterviewStage): string {
    const stageTostateMap: Record<InterviewStage, string> = {
      [InterviewStage.GREET]: 'greet',
      [InterviewStage.RESUME]: 'resume',
      [InterviewStage.CODING]: 'coding',
      [InterviewStage.CS]: 'cs',
      [InterviewStage.BEHAVIORAL]: 'behave',
      [InterviewStage.WRAPUP]: 'wrap_up',
      [InterviewStage.COMPLETED]: 'end'
    };
    return stageTostateMap[stage] || 'greet';
  }

  private getStageForstate(state: string): InterviewStage {
    const stateToStageMap: Record<string, InterviewStage> = {
      'greet': InterviewStage.GREET,
      'resume': InterviewStage.RESUME,
      'coding': InterviewStage.CODING,
      'cs': InterviewStage.CS,
      'behave': InterviewStage.BEHAVIORAL,
      'wrap_up': InterviewStage.WRAPUP,
      'end': InterviewStage.COMPLETED
    };
    return stateToStageMap[state] || this.currentStage;
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

        // Run the agent for the current state
        // Note: UnifiedInterviewAgent.run signature: (userMessage, userCode?, currentState?, currentSubstate?, resumeContent?, codeSubmitted?)
        response = await this.unifiedAgent.run(
          userMessage,
          codeToPass,
          this.getstateForStage(this.currentStage),
          this.getstateForStage(this.currentStage),
          resumeContent,
          codeSubmitted
        );

        // Validate state returned by agent
        const allowedstates = ['greet','resume','coding','cs','behave','wrap_up','end'];
        if (!allowedstates.includes(response.state)) {
          console.warn(`Agent returned invalid state '${response.state}', coercing to '${this.getstateForStage(this.currentStage)}'`);
          response.state = this.getstateForStage(this.currentStage);
        }

        // If the unified agent returns state 'end', trigger scoring & recommendation (if resume provided)
        if (response.state === 'end') {
          if (!resumeFilePath) {
            throw new Error('Resume file path is required to generate scoring and recommendation when interview ends');
          }
          const [scoring, recommendation] = await this.activateScoringAndRecommendation(resumeFilePath);
          scoringResult = scoring || undefined;
          recommendationResult = recommendation || undefined;
          this.currentStage = InterviewStage.COMPLETED;
          break;
        }

        // Otherwise update stage based on returned state
        const newStage = this.getStageForstate(response.state);
        if (newStage !== this.currentStage) {
          this.currentStage = newStage;

          // Fire-and-forget follow-up generation to avoid blocking the client response
          // This makes stage transitions immediate, with follow-up appearing asynchronously
          void (async () => {
            try {
              const followUpPrompt = `Stage changed to ${this.getstateForStage(this.currentStage)}. Please ask one concise, stage-appropriate question or give a prompt relevant ONLY to this new state.`;
              const followUp = await this.unifiedAgent.run(
                followUpPrompt,
                undefined,
                this.getstateForStage(this.currentStage),
                this.getstateForStage(this.currentStage),
                resumeContent,
                false
              );
              if (followUp && allowedstates.includes(followUp.state)) {
                // Note: In a real implementation, you'd need to push this followUp to the client via WebSocket
                // For now, we just generate it asynchronously without blocking
                console.log(`Generated async follow-up for stage ${this.currentStage}: ${followUp.assistant_message}`);
              }
            } catch (err) {
              console.warn('Failed to generate stage-entry follow-up:', err);
            }
          })();
        }

        break;

      case InterviewStage.WRAPUP:
        // Don't pass userCode during wrapup stage
        response = await this.unifiedAgent.run(
          userMessage,
          undefined,
          this.getstateForStage(this.currentStage),
          this.getstateForStage(this.currentStage),
          resumeContent,
          false
        );
        // Special handling for wrapup stage - check for "closing" state
        if (response.state === "closing") {
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
            state: "end",
            substate: "end"
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
    // We move to the next stage only when the agent explicitly returns a different allowed state
    const allowed = ['greet','resume','coding','cs','behave','wrap_up','end'];
    return allowed.includes(response.state) && this.getStageForstate(response.state) !== this.currentStage;
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
