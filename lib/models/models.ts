import { z } from "zod";

export const InterviewStepSchema = z.object({
  assistant_message: z.string(),
  current_substate: z.enum([
    "greet",
    "ask_intro",
    "ack_intro",
    "explain_process",
    "ask_clarifications",
    "ready_to_move"
  ])
});

export type InterviewStep = z.infer<typeof InterviewStepSchema>;
