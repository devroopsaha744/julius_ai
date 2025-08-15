import { z } from "zod";

export const InterviewStepSchema = z.object({
  assistant_message: z.string(),
  current_substate: z.string()
});

export type InterviewStep = z.infer<typeof InterviewStepSchema>;
