import OpenAI from "openai";

import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

export const groqClient = new OpenAI({
  apiKey: process.env.GOOGLE_API_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
});
