import { prisma } from "../config/prisma";
import { IRFramework } from "@prisma/client";
import { ToolResult } from "../tools/index";

export type ResponseType = "report" | "conversational";

export interface ParsedReport {
  framework: IRFramework;
  bluf: string;
  background: string;
  currentSituation: string;
  analysis: string;
  implications: string;
  sources: string;
  rawOutput: string;
}

export interface ToolCallRecord {
  toolName: string;
  input: Record<string, unknown>;
  output: ToolResult;
}


export function classifyResponse(raw: string): ResponseType {
  // A structured report must have at least BLUF and one other section marker.
  // We check for the bracket labels the system prompt enforces.
  const hasBluf = raw.includes("[BLUF]:");
  const hasFramework = raw.includes("[FRAMEWORK]:");
  const hasAnalysis = raw.includes("[ANALYSIS]:");

  // Require at least BLUF + one structural section to count as a report.
  // A response with only one marker is likely a partial or malformed response.
  if (hasBluf && (hasFramework || hasAnalysis)) {
    return "report";
  }

  return "conversational";
}

export const ReportService = {
  parseOutput(raw: string): ParsedReport {
    const extract = (label: string, nextLabel?: string): string => {
      const start = raw.indexOf(`[${label}]:`);
      if (start === -1) return "";
      const contentStart = start + label.length + 3;
      const end = nextLabel ? raw.indexOf(`[${nextLabel}]:`) : raw.length;
      return raw.slice(contentStart, end === -1 ? raw.length : end).trim();
    };

    const frameworkRaw = extract("FRAMEWORK", "BLUF").toUpperCase();

    let framework: IRFramework = "realism";
    if (frameworkRaw.includes("LIBERALISM")) framework = "liberalism";
    else if (frameworkRaw.includes("CONSTRUCTIVISM")) framework = "constructivism";
    else if (
      frameworkRaw.includes("POLITICAL_ECONOMY") ||
      frameworkRaw.includes("POLITICAL ECONOMY")
    )
      framework = "political_economy";

    return {
      framework,
      bluf: extract("BLUF", "BACKGROUND"),
      background: extract("BACKGROUND", "CURRENT SITUATION"),
      currentSituation: extract("CURRENT SITUATION", "ANALYSIS"),
      analysis: extract("ANALYSIS", "IMPLICATIONS"),
      implications: extract("IMPLICATIONS", "SOURCES"),
      sources: extract("SOURCES"),
      rawOutput: raw,
    };
  },

  async save(
    sessionId: string,
    query: string,
    parsed: ParsedReport,
    toolCalls: ToolCallRecord[],
    partialSources: boolean,
    responseType: ResponseType,   
  ): Promise<string> {
    const result = await prisma.$transaction(async (tx) => {
      const report = await tx.report.create({
        data: {
          sessionId,
          query,
          frameworkUsed: parsed.framework,
          partialSources,
          responseType,            
          output: {
            bluf: parsed.bluf,
            background: parsed.background,
            currentSituation: parsed.currentSituation,
            analysis: parsed.analysis,
            implications: parsed.implications,
            sources: parsed.sources,
            rawOutput: parsed.rawOutput,
          },
        },
      });

      if (toolCalls.length > 0) {
        await tx.toolLog.createMany({
          data: toolCalls.map((tc) => ({
            reportId: report.id,
            toolName: tc.toolName,
            input: tc.input as object,
            output: tc.output as object,
          })),
        });
      }

      return report.id;
    });

    return result;
  },

  async findById(id: string) {
    return prisma.report.findUnique({
      where: { id },
      include: { toolLogs: true },
    });
  },
};
