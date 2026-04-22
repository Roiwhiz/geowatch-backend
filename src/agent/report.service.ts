import { prisma } from "../config/prisma";
import { IRFramework } from "@prisma/client";
import { ToolResult } from "../tools/index";

// ─────────────────────────────────────────────────────────────────────────────
// Report Service
// Persists completed agent outputs and their tool call logs to the database.
// Called by the agent loop after every successful run.
// ─────────────────────────────────────────────────────────────────────────────

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

export const ReportService = {
  // Parse the raw agent output string into structured sections.
  // The system prompt enforces the section labels — we extract them here.
  parseOutput(raw: string): ParsedReport {
    const extract = (label: string, nextLabel?: string): string => {
      const start = raw.indexOf(`[${label}]:`);
      if (start === -1) return "";
      const contentStart = start + label.length + 3;
      const end = nextLabel ? raw.indexOf(`[${nextLabel}]:`) : raw.length;
      return raw.slice(contentStart, end === -1 ? raw.length : end).trim();
    };

    const frameworkRaw = extract("FRAMEWORK", "BLUF").toUpperCase();

    // Map to Prisma enum — default to realism if unrecognised
    let framework: IRFramework = "realism";
    if (frameworkRaw.includes("LIBERALISM")) framework = "liberalism";
    else if (frameworkRaw.includes("CONSTRUCTIVISM"))
      framework = "constructivism";
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

  // Save a completed report and all its tool call logs in one transaction.
  async save(
    sessionId: string,
    query: string,
    parsed: ParsedReport,
    toolCalls: ToolCallRecord[],
    partialSources: boolean,
  ): Promise<string> {
    const result = await prisma.$transaction(async (tx) => {
      // Create the report
      const report = await tx.report.create({
        data: {
          sessionId,
          query,
          frameworkUsed: parsed.framework,
          partialSources,
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

      // Create a tool log entry for each tool call made during this run
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

  // Fetch a single report by ID.
  async findById(id: string) {
    return prisma.report.findUnique({
      where: { id },
      include: { toolLogs: true },
    });
  },
};
