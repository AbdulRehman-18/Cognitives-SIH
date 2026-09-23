import { z } from "zod";
import { NextResponse } from "next/server";
import { requireRoleApi, authErrorResponse } from "@/lib/auth/rbac";
import { getAiProvider } from "@/lib/ai/provider";
import { classifyAiError } from "@/lib/ai/errors";

export const maxDuration = 20;

const schema = z.object({
  topic: z.string().min(2).max(200),
  count: z.number().int().min(3).max(6).optional().default(5),
});

const quizSchema = z.object({
  questions: z.array(z.object({
    question: z.string().min(10),
    A: z.string().min(1),
    B: z.string().min(1),
    C: z.string().min(1),
    D: z.string().min(1),
    answer: z.enum(["A","B","C","D"]),
    why: z.string().min(10),
  })).min(3).max(6),
});

export async function POST(req: Request){
  try{ await requireRoleApi(["LEARNER","TRAINER","ADMIN"]); }catch(e){ const r=authErrorResponse(e); if(r) return r; throw e; }
  const body = await req.json().catch(()=>null);
  const parsed = schema.safeParse(body);
  if(!parsed.success) return NextResponse.json({error:"Invalid", issues:parsed.error.flatten()}, {status:400});
  const { topic, count } = parsed.data;

  const provider = getAiProvider();
  const system = `You are SkillForge quiz generator. Output JSON only matching schema. Use KaTeX math: $...$ inline, $$...$$ display when needed. Do NOT mention PDFs, uploads, documents, chunks, citations, or retrieval. Questions must be self-contained.`;
  const prompt = `Generate exactly ${count} distinct high-quality MCQs on topic: "${topic}". Mix difficulty. JSON {questions:[{question,A,B,C,D,answer,why}]}. why: 1-2 sentence explanation, no citation markers.`;

  try{
    const obj = await provider.generateObject({ schema: quizSchema, prompt, system, maxOutputTokens: 2500, schemaName:"quiz", schemaDescription:"5 MCQs" });
    return NextResponse.json({ refused:false, citations:[], ...obj });
  }catch(e){ const ae=classifyAiError(e); return NextResponse.json({error:ae.message, kind:ae.kind},{status:502}); }
}
