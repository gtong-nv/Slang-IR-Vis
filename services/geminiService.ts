import { GoogleGenAI } from "@google/genai";
import { IRNode } from "../types";

// Initialize client
// Note: apiKey is expected to be in process.env.API_KEY per instructions
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const explainIRNode = async (node: IRNode, contextLines: string[]): Promise<string> => {
  if (!process.env.API_KEY) {
     return "API Key is missing. Please configure process.env.API_KEY to use AI features.";
  }

  const modelId = 'gemini-2.5-flash';
  
  const prompt = `
    You are an expert in Slang shading language and Compiler Intermediate Representation (IR).
    Explain the following IR instruction in simple terms.
    
    Instruction:
    ${node.originalLine}
    
    Context (surrounding lines):
    ${contextLines.join('\n')}
    
    Explain what this instruction does, its operands, and its role in the shader logic.
    Keep it concise (under 3 sentences).
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
    });
    return response.text || "No explanation generated.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Failed to fetch explanation. Please check your API Key and connection.";
  }
};

export const analyzeFlow = async (fullIr: string): Promise<string> => {
   if (!process.env.API_KEY) {
     return "API Key is missing.";
  }

  const modelId = 'gemini-2.5-flash';
  
  const prompt = `
    Analyze the following Slang IR code. 
    Describe the high-level data flow and what the shader program is computing.
    Identify the entry point and the main outputs.
    
    IR Code:
    ${fullIr}
  `;

   try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
    });
    return response.text || "No analysis generated.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Failed to analyze flow.";
  }
};