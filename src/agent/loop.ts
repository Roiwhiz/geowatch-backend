import {
  GoogleGenerativeAI,
  GenerativeModel,
  FunctionDeclaration,
  Tool,
} from "@google/generative-ai";
import { Content } from "@google/generative-ai";
import { buildSystemPrompt } from "./prompt";
import { TOOL_DEFINITIONS, executeTool } from "../tools/index";
import { ReportService, ToolCallRecord } from "./report.service";
import { MessageService } from "../services/message.service";
import { SessionService } from "../services/session.service";
import { logger } from "../utils/logger";
import {
  AIServiceError,
  classifyGeminiError,
  classifyPrismaError,
  parseRetryAfter,
} from "../utils/errors";

// ─────────────────────────────────────────────────────────────────────────────
// Agent Loop
// ─────────────────────────────────────────────────────────────────────────────

const MAX_TOOL_CALLS = parseInt(process.env.MAX_TOOL_CALLS ?? "3", 10);
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES ?? "3", 10);

let hadToolFailure = false;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

function getModel(locale: string): GenerativeModel {
  return genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: buildSystemPrompt(locale),
    tools: [
      {
        functionDeclarations:
          TOOL_DEFINITIONS as unknown as FunctionDeclaration[],
      } as Tool,
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 4096,
    },
  });
}

export interface AgentRunInput {
  sessionId: string;
  query: string;
  history: Content[];
  locale: string;
}

export interface AgentRunOutput {
  reportId: string;
  rawOutput: string;
}

// ── Persistence helper ────────────────────────────────────────────────────────
async function persistAndReturn(
  sessionId: string,
  query: string,
  rawOutput: string,
  toolCalls: ToolCallRecord[],
  partialSources: boolean,
  updateTitle: boolean,
): Promise<AgentRunOutput> {
  try {
    const parsed = ReportService.parseOutput(rawOutput);
    const reportId = await ReportService.save(
      sessionId,
      query,
      parsed,
      toolCalls,
      partialSources,
    );
    await MessageService.saveTurn(sessionId, query, rawOutput);
    if (updateTitle) {
      const messageCount = await MessageService.count(sessionId);
      if (messageCount <= 2) {
        await SessionService.setAutoTitle(sessionId, query);
      }
    }
    await SessionService.touch(sessionId);
    return { reportId, rawOutput };
  } catch (error) {
    const e = error as { code?: string; clientVersion?: string };
    if (e.clientVersion || e.code?.startsWith("P")) {
      throw classifyPrismaError(error);
    }
    throw error;
  }
}

export async function runAgentLoop(
  input: AgentRunInput,
): Promise<AgentRunOutput> {
  const { sessionId, query, history, locale } = input;
  const model = getModel(locale);

  hadToolFailure = false;

  const toolCalls: ToolCallRecord[] = [];
  let iterationCount = 0;

  const workingHistory: Content[] = [
    ...history,
    { role: "user", parts: [{ text: query }] },
  ];

  // ── Agent loop ─────────────────────────────────────────────────────────────
  while (iterationCount < MAX_TOOL_CALLS) {
    const response = await callGeminiWithRetry(model, workingHistory);

    const functionCall = response.functionCalls()?.[0];

    if (functionCall) {
      iterationCount++;
      logger.info(
        `[AgentLoop] Tool call ${iterationCount}/${MAX_TOOL_CALLS}: ${functionCall.name}`,
      );

      const toolResult = await executeTool(
        functionCall.name,
        functionCall.args as Record<string, unknown>,
      );

      toolCalls.push({
        toolName: functionCall.name,
        input: functionCall.args as Record<string, unknown>,
        output: toolResult,
      });

      if (!toolResult.success) hadToolFailure = true;

      workingHistory.push({
        role: "model" as const,
        parts: [
          {
            functionCall: {
              name: functionCall.name,
              args: functionCall.args as object,
            },
          },
        ],
      });

      workingHistory.push({
        role: "function" as const,
        parts: [
          {
            functionResponse: {
              name: functionCall.name,
              response: { result: JSON.stringify(toolResult) },
            },
          },
        ],
      });

      continue;
    }

    // No tool call — Gemini produced a final text response
    const finalOutput = response.text();

    if (!finalOutput) {
      throw new AIServiceError(
        "Gemini returned an empty response. Please try again.",
      );
    }

    return persistAndReturn(
      sessionId,
      query,
      finalOutput,
      toolCalls,
      hadToolFailure,
      true,
    );
  }

  // ── Loop cap hit — force a final answer ───────────────────────────────────
  logger.warn(
    `[AgentLoop] Tool call cap (${MAX_TOOL_CALLS}) reached. Forcing final answer.`,
  );

  workingHistory.push({
    role: "user",
    parts: [
      {
        text:
          "You have reached the maximum number of tool calls. " +
          "Please produce your best available structured report " +
          "using the information you have gathered so far.",
      },
    ],
  });

  const forcedOutput = await callGeminiWithRetry(model, workingHistory);
  const forcedRawOutput = forcedOutput.text();

  return persistAndReturn(
    sessionId,
    query,
    forcedRawOutput,
    toolCalls,
    true,
    false,
  );
}

// ── Gemini call with exponential backoff ──────────────────────────────────────

async function callGeminiWithRetry(model: GenerativeModel, history: Content[]) {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const chat = model.startChat({
        history: history.slice(0, -1),
      });
      const lastMessage = history[history.length - 1];
      const result = await chat.sendMessage(lastMessage.parts);
      return result.response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const msg = lastError.message;

      // Non-retryable — throw immediately with classification
      const isContentError =
        msg.includes("functionResponse") ||
        msg.includes("Content with role") ||
        msg.includes("chat history") ||
        msg.includes("SAFETY");

      if (isContentError) {
        throw classifyGeminiError(lastError);
      }

      // Rate limit — use server-provided retry delay
      if (msg.includes("429") || msg.includes("quota")) {
        if (attempt === MAX_RETRIES) {
          throw classifyGeminiError(lastError);
        }
        const retryAfter = parseRetryAfter(msg);
        const delayMs = retryAfter
          ? retryAfter * 1000
          : Math.pow(2, attempt) * 3000;
        logger.warn(
          `[AgentLoop] Rate limited (attempt ${attempt}/${MAX_RETRIES}), retrying in ${delayMs}ms...`,
        );
        await sleep(delayMs);
        continue;
      }

      // Retryable server errors
      const isRetryable =
        msg.includes("500") ||
        msg.includes("503") ||
        msg.includes("Internal Server Error") ||
        msg.includes("Service Unavailable");

      if (!isRetryable || attempt === MAX_RETRIES) {
        throw classifyGeminiError(lastError);
      }

      const delayMs = Math.pow(2, attempt) * 3000;
      logger.warn(
        `[AgentLoop] Gemini error (attempt ${attempt}/${MAX_RETRIES}), retrying in ${delayMs}ms...`,
      );
      await sleep(delayMs);
    }
  }

  throw classifyGeminiError(
    lastError ?? new Error("Gemini call failed after retries"),
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
