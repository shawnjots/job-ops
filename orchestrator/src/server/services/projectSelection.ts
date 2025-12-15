import { getSetting } from '../repositories/settings.js';

import type { ResumeProjectSelectionItem } from './resumeProjects.js';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export async function pickProjectIdsForJob(args: {
  jobDescription: string;
  eligibleProjects: ResumeProjectSelectionItem[];
  desiredCount: number;
}): Promise<string[]> {
  const desiredCount = Math.max(0, Math.floor(args.desiredCount));
  if (desiredCount === 0) return [];

  const eligibleIds = new Set(args.eligibleProjects.map((p) => p.id));
  if (eligibleIds.size === 0) return [];

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return fallbackPickProjectIds(args.jobDescription, args.eligibleProjects, desiredCount);
  }

  const overrideModel = await getSetting('model');
  const model = overrideModel || process.env.MODEL || 'openai/gpt-4o-mini';

  const prompt = buildProjectSelectionPrompt({
    jobDescription: args.jobDescription,
    projects: args.eligibleProjects,
    desiredCount,
  });

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
    if (!content) throw new Error('No content in response');

    const parsed = JSON.parse(content) as any;
    const selectedProjectIds = Array.isArray(parsed?.selectedProjectIds) ? parsed.selectedProjectIds : [];
    const unique: string[] = [];
    const seen = new Set<string>();
    for (const id of selectedProjectIds) {
      if (typeof id !== 'string') continue;
      const trimmed = id.trim();
      if (!trimmed) continue;
      if (!eligibleIds.has(trimmed)) continue;
      if (seen.has(trimmed)) continue;
      seen.add(trimmed);
      unique.push(trimmed);
      if (unique.length >= desiredCount) break;
    }

    if (unique.length === 0) {
      return fallbackPickProjectIds(args.jobDescription, args.eligibleProjects, desiredCount);
    }

    return unique;
  } catch {
    return fallbackPickProjectIds(args.jobDescription, args.eligibleProjects, desiredCount);
  }
}

function buildProjectSelectionPrompt(args: {
  jobDescription: string;
  projects: ResumeProjectSelectionItem[];
  desiredCount: number;
}): string {
  const projects = args.projects.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    date: p.date,
    summary: truncate(p.summaryText, 500),
  }));

  return `
You are selecting which projects to include on a resume for a specific job.

Rules:
- Choose up to ${args.desiredCount} project IDs.
- Only choose IDs from the provided list.
- Prefer projects that strongly match the job description keywords/tech stack.
- Prefer projects that signal impact and real-world engineering.
- Do NOT invent projects or skills.

Job description:
${args.jobDescription}

Candidate projects (pick from these IDs only):
${JSON.stringify(projects, null, 2)}

Respond with JSON only, in this exact shape:
{
  "selectedProjectIds": ["id1", "id2"]
}
`.trim();
}

function fallbackPickProjectIds(
  jobDescription: string,
  eligibleProjects: ResumeProjectSelectionItem[],
  desiredCount: number
): string[] {
  const jd = (jobDescription || '').toLowerCase();

  const signals = [
    'react',
    'typescript',
    'javascript',
    'node',
    'next.js',
    'nextjs',
    'python',
    'c++',
    'c#',
    'java',
    'kotlin',
    'sql',
    'mongodb',
    'aws',
    'docker',
    'graphql',
    'php',
    'unity',
    'tailwind',
  ];

  const activeSignals = signals.filter((s) => jd.includes(s));

  const scored = eligibleProjects
    .map((p) => {
      const text = `${p.name} ${p.description} ${p.summaryText}`.toLowerCase();
      let score = 0;
      for (const signal of activeSignals) {
        if (text.includes(signal)) score += 5;
      }
      if (/\b(open source|oss)\b/.test(text)) score += 2;
      if (/\b(api|backend|frontend|full[- ]?stack)\b/.test(text)) score += 1;
      return { id: p.id, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, desiredCount).map((s) => s.id);
}

function truncate(input: string, maxChars: number): string {
  if (input.length <= maxChars) return input;
  return `${input.slice(0, maxChars - 1).trimEnd()}…`;
}

