import { webSearch, WebSearchInput, WebSearchOutput } from './web-search.tool'
import { callApi, ApiName, CallApiParams, CallApiOutput } from './call-api.tool'
import { fetchUrl, FetchUrlInput, FetchUrlOutput } from './fetch-url.tool'
import { logger } from '../utils/logger'

// ─────────────────────────────────────────────────────────────────────────────
// Tool Registry
//
// Two exports:
//
// 1. TOOL_DEFINITIONS — the JSON schemas sent to Gemini so it knows what
//    tools exist and how to call them. Gemini reads these and decides when
//    and how to invoke each tool.
//
// 2. executeTool() — the dispatcher that runs a tool by name when Gemini
//    requests it. This is what the agent loop calls.
// ─────────────────────────────────────────────────────────────────────────────

// ── 1. Tool definitions (Gemini function calling format) ──────────────────────

export const TOOL_DEFINITIONS = [
  {
    name: 'web_search',
    description:
      'Search the web for recent news, government statements, think-tank ' +
      'publications, UN documents, and academic sources on geopolitical topics. ' +
      'Use recency="day" for breaking news, "week" for recent developments, ' +
      '"month" for background context. Prioritise primary sources.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query. Be specific and include country names, actor names, or event types.',
        },
        max_results: {
          type: 'number',
          description: 'Number of results to return (1-8). Default is 5.',
        },
        recency: {
          type: 'string',
          enum: ['day', 'week', 'month'],
          description: 'Filter results by recency. Omit for no filter.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'call_api',
    description:
      'Call a structured geopolitical data API. Use "acled" for conflict event ' +
      'data (battles, fatalities, actors) or "un_comtrade" for bilateral trade ' +
      'flow data between countries. Always prefer these over web search when ' +
      'structured quantitative data is needed.',
    parameters: {
      type: 'object',
      properties: {
        api_name: {
          type: 'string',
          enum: ['acled', 'un_comtrade'],
          description: 'Which API to call.',
        },
        params: {
          type: 'object',
          description:
            'For acled: { country, start_date (YYYY-MM-DD), end_date (YYYY-MM-DD), event_type? }. ' +
            'For un_comtrade: { reporter (ISO 3-digit code), partner (ISO 3-digit code), year, commodity_code? }.',
        },
      },
      required: ['api_name', 'params'],
    },
  },
  {
    name: 'fetch_url',
    description:
      'Fetch and read the full text content of a specific URL — UN resolutions, ' +
      'official government statements, think-tank reports, or news articles. ' +
      'Only use when you have a specific URL to retrieve. For discovery, use ' +
      'web_search instead. Only trusted domains are permitted.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The full URL to fetch (must be from a trusted domain).',
        },
        extract_text: {
          type: 'boolean',
          description: 'Whether to extract and return the page text. Default true.',
        },
      },
      required: ['url'],
    },
  },
]

// ── 2. Tool executor ──────────────────────────────────────────────────────────

export type ToolName = 'web_search' | 'call_api' | 'fetch_url'

export type ToolResult =
  | WebSearchOutput
  | CallApiOutput
  | FetchUrlOutput
  | { success: false; error: 'unknown_tool'; message: string }

export async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  logger.info(`[Tool] Executing: ${name} ${JSON.stringify(args)}`)

  switch (name) {
    case 'web_search':
      return webSearch(args as unknown as WebSearchInput)

    case 'call_api':
      return callApi(
        args.api_name as ApiName,
        args.params as CallApiParams
      )

    case 'fetch_url':
      return fetchUrl(args as unknown as FetchUrlInput)

    default:
      logger.warn(`[Tool] Unknown tool requested: ${name}`)
      return {
        success: false,
        error: 'unknown_tool',
        message: `Tool '${name}' does not exist in the registry. Available tools: web_search, call_api, fetch_url`,
      }
  }
}
