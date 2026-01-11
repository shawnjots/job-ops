/**
 * Service for generating tailored resume content (Summary, Headline, Skills).
 */

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export interface TailoredData {
  summary: string;
  headline: string;
  skills: any[]; 
}

export interface TailoringResult {
  success: boolean;
  data?: TailoredData;
  error?: string;
}

/**
 * Generate tailored resume content (summary, headline, skills) for a job.
 */
export async function generateTailoring(
  jobDescription: string,
  profile: Record<string, unknown>
): Promise<TailoringResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    console.warn('⚠️ OPENROUTER_API_KEY not set, cannot generate tailoring');
    return { success: false, error: 'API key not configured' };
  }
  
  const model = process.env.MODEL || 'openai/gpt-4o-mini';
  const prompt = buildTailoringPrompt(profile, jobDescription);
  
  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost',
        'X-Title': 'JobOpsOrchestrator',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      }),
    });
    
    if (!response.ok) {
      throw new Error(`OpenRouter error: ${response.status}`);
    }
    
    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content in response');
    }
    
    const parsed = JSON.parse(content);
    
    // Basic validation
    if (!parsed.summary || !parsed.headline || !Array.isArray(parsed.skills)) {
      console.warn('⚠️ AI response missing required fields:', parsed);
    }

    return { 
      success: true, 
      data: {
        summary: sanitizeText(parsed.summary || ''),
        headline: sanitizeText(parsed.headline || ''),
        skills: parsed.skills || []
      } 
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Backwards compatibility wrapper if needed, or alias.
 */
export async function generateSummary(
  jobDescription: string,
  profile: Record<string, unknown>
): Promise<{ success: boolean; summary?: string; error?: string }> {
  // If we just need summary, we can discard the rest (or cache it? but here we just return summary)
  const result = await generateTailoring(jobDescription, profile);
  return {
    success: result.success,
    summary: result.data?.summary,
    error: result.error
  };
}

function buildTailoringPrompt(profile: Record<string, unknown>, jd: string): string {
  // Extract only needed parts of profile to save tokens
  const relevantProfile = {
    basics: {
      name: (profile as any).basics?.name,
      label: (profile as any).basics?.label, // Original headline
      summary: (profile as any).basics?.summary,
    },
    skills: (profile as any).sections?.skills || (profile as any).skills,
    projects: (profile as any).sections?.projects?.items?.map((p: any) => ({
        name: p.name,
        description: p.description,
        keywords: p.keywords
    })),
    experience: (profile as any).sections?.experience?.items?.map((e: any) => ({
        company: e.company,
        position: e.position,
        summary: e.summary
    }))
  };

  return `
You are an expert resume writer tailoring a profile for a specific job application.
You must return a JSON object with three fields: "headline", "summary", and "skills".

JOB DESCRIPTION:
${jd.slice(0, 3000)} ... (truncated if too long)

MY PROFILE:
${JSON.stringify(relevantProfile, null, 2)}

INSTRUCTIONS:

1. "headline" (String):
   - CRITICAL: This is the #1 ATS factor.
   - It must match the Job Title from the JD exactly (e.g., if JD says "Senior React Dev", use "Senior React Dev").
   - If the JD title is very generic, you may add one specialty, but keep it matching the role.

2. "summary" (String):
   - The Hook. This needs to mirror the company's "About You" / "What we're looking for" section.
   - Keep it concise, warm, and confident.
   - Do NOT invent experience.
   - Use the profile to add context.

3. "skills" (Array of Objects):
   - Review my existing skills section structure.
   - Keyword Stuffing: Swap synonyms to match the JD exactly (e.g. "TDD" -> "Unit Testing", "ReactJS" -> "React").
   - Keep my original skill levels and categories, just rename/reorder keywords to prioritize JD terms.
   - Return the full "items" array for the skills section, preserving the structure: { "name": "Frontend", "keywords": [...] }.

OUTPUT FORMAT (JSON):
{
  "headline": "...",
  "summary": "...",
  "skills": [ ... ]
}
`;
}

function sanitizeText(text: string): string {
  return text
    .replace(/\*\*[\s\S]*?\*\*/g, '') // remove markdown bold
    .trim();
}
