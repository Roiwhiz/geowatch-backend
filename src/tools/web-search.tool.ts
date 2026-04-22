import axios from 'axios'
import { logger } from '../utils/logger'

// ─────────────────────────────────────────────────────────────────────────────
// Tool: web_search
// Provider: Tavily Search API (purpose-built for LLM agents)
//
// Constraints (from tool design spec):
// - max_results capped at 8
// - query stripped to 200 chars before sending
// - recency filter for time-sensitive geopolitical queries
// - never throws — always returns a typed result object
// ─────────────────────────────────────────────────────────────────────────────

export interface WebSearchInput {
  query: string
  max_results?: number
  recency?: 'day' | 'week' | 'month'
}

export interface WebSearchResult {
  title: string
  url: string
  snippet: string
  published_date: string | null
  source_domain: string
}

export interface WebSearchSuccess {
  success: true
  results: WebSearchResult[]
  query_used: string
  result_count: number
}

export interface WebSearchError {
  success: false
  error: 'search_failed'
  message: string
}

export type WebSearchOutput = WebSearchSuccess | WebSearchError

const TAVILY_API_URL = 'https://api.tavily.com/search'
const MAX_RESULTS_CAP = 8
const QUERY_CHAR_LIMIT = 200

export async function webSearch(input: WebSearchInput): Promise<WebSearchOutput> {
  const query = input.query.substring(0, QUERY_CHAR_LIMIT).trim()
  const maxResults = Math.min(input.max_results ?? 5, MAX_RESULTS_CAP)

  try {
    const response = await axios.post(
      TAVILY_API_URL,
      {
        api_key: process.env.TAVILY_API_KEY,
        query,
        max_results: maxResults,
        search_depth: 'advanced',
        // Only include recency filter when specified
        ...(input.recency && { days: recencyToDays(input.recency) }),
        // Include raw content for richer context
        include_raw_content: false,
        include_answer: false,
      },
      { timeout: 15_000 }
    )

    const results: WebSearchResult[] = (response.data.results ?? []).map(
      (r: Record<string, unknown>) => ({
        title: r.title ?? '',
        url: r.url ?? '',
        snippet: r.content ?? '',
        published_date: (r.published_date as string) ?? null,
        source_domain: extractDomain(r.url as string),
      })
    )

    return {
      success: true,
      results,
      query_used: query,
      result_count: results.length,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    logger.error(`[web_search] Failed: ${message}`)
    return {
      success: false,
      error: 'search_failed',
      message,
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function recencyToDays(recency: 'day' | 'week' | 'month'): number {
  return { day: 1, week: 7, month: 30 }[recency]
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return url
  }
}
