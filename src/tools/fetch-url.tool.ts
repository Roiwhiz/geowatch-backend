import axios from "axios";
import * as cheerio from "cheerio";
import logger from "../utils/logger";

// ─────────────────────────────────────────────────────────────────────────────
// Tool: fetch_url
// Fetches a specific URL and returns clean extracted text.
//
// Security constraints (from tool design spec):
// - Domain allowlist — only trusted geopolitical/academic sources
// - Private IP block — SSRF protection
// - 500KB response cap
// - 8,000 word text truncation
// - 10s hard timeout
// - never throws — always returns a typed result object
// ─────────────────────────────────────────────────────────────────────────────

export interface FetchUrlInput {
  url: string;
  extract_text?: boolean;
}

export interface FetchUrlSuccess {
  success: true;
  url: string;
  title: string;
  text_content: string;
  word_count: number;
  fetched_at: string;
}

export interface FetchUrlError {
  success: false;
  error: "fetch_failed";
  url: string;
  message: string;
}

export type FetchUrlOutput = FetchUrlSuccess | FetchUrlError;

// Trusted domains — expand as needed

const ALLOWED_DOMAINS = new Set([
  "un.org",
  "nato.int",
  "who.int",
  "worldbank.org",
  "imf.org",
  "cfr.org",
  "foreignaffairs.com",
  "chathamhouse.org",
  "iiss.org",
  "crisisgroup.org",
  "amnesty.org",
  "hrw.org",
  "icj-cij.org",
  "reuters.com",
  "apnews.com",
  "bbc.com",
  "theguardian.com",
  "ft.com",
  "economist.com",
  "foreignpolicy.com",
  "aljazeera.com",
  "brookings.edu",
  "rand.org",
  "sipri.org",
  "iccnow.org",
  "acleddata.com",
  "jstor.org",
  "scholar.google.com",
  "africacenter.org", // Africa Center for Strategic Studies
  "usip.org", // US Institute of Peace
  "iss.co.za", // Institute for Security Studies Africa
  "issafrica.org", // ISS Africa
  "globalinitiative.net", // Global Initiative Against Transnational Organized Crime
  "reliefweb.int", // UN OCHA ReliefWeb
  "icrc.org", // International Committee of the Red Cross
  "ipi.int", // International Peace Institute
]);
// Private IP ranges — block SSRF attempts
const PRIVATE_IP_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^::1$/,
  /^0\./,
];

const MAX_RESPONSE_BYTES = 500_000;
const MAX_WORD_COUNT = 8_000;
const FETCH_TIMEOUT_MS = 10_000;

export async function fetchUrl(input: FetchUrlInput): Promise<FetchUrlOutput> {
  const { url, extract_text = true } = input;

  // ── Security validation ────────────────────────────────────────────────────
  const securityCheck = validateUrl(url);
  if (!securityCheck.valid) {
    return {
      success: false,
      error: "fetch_failed",
      url,
      message: securityCheck.reason,
    };
  }

  try {
    const response = await axios.get(url, {
      timeout: FETCH_TIMEOUT_MS,
      maxContentLength: MAX_RESPONSE_BYTES,
      headers: {
        "User-Agent": "GeoWatch-Agent/1.0 (geopolitical research tool)",
        Accept: "text/html,application/xhtml+xml,text/plain",
      },
      responseType: "text",
    });

    if (!extract_text) {
      return {
        success: true,
        url,
        title: url,
        text_content: "",
        word_count: 0,
        fetched_at: new Date().toISOString(),
      };
    }

    // ── Extract clean text from HTML ─────────────────────────────────────────
    const { title, text } = extractTextFromHtml(response.data as string);
    const truncated = truncateToWordLimit(text, MAX_WORD_COUNT);

    return {
      success: true,
      url,
      title,
      text_content: truncated,
      word_count: countWords(truncated),
      fetched_at: new Date().toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    // console.error("[fetch_url] Failed:", url, message);
    logger.error({ url }, "[fetch_url] Failed:", message);
    return { success: false, error: "fetch_failed", url, message };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function validateUrl(
  url: string,
): { valid: true } | { valid: false; reason: string } {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, reason: "Invalid URL format" };
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { valid: false, reason: "Only HTTP and HTTPS URLs are allowed" };
  }

  const hostname = parsed.hostname;

  // Block private IP ranges
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      return {
        valid: false,
        reason: "Private or loopback addresses are not allowed",
      };
    }
  }

  // Check against allowlist — match hostname or parent domain
  const isAllowed = [...ALLOWED_DOMAINS].some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
  );

  if (!isAllowed) {
    return {
      valid: false,
      reason: `Domain '${hostname}' is not in the trusted sources list`,
    };
  }

  return { valid: true };
}

function extractTextFromHtml(html: string): { title: string; text: string } {
  const $ = cheerio.load(html);

  // Extract title
  const title =
    $("title").first().text().trim() ||
    $("h1").first().text().trim() ||
    "Untitled";

  // Remove non-content elements
  $("script, style, nav, footer, header, aside, .ad, .advertisement").remove();

  // Extract meaningful text
  const text = $("article, main, .content, .post-content, body")
    .first()
    .text()
    .replace(/\s+/g, " ")
    .trim();

  return { title, text };
}

function truncateToWordLimit(text: string, limit: number): string {
  const words = text.split(" ");
  if (words.length <= limit) return text;
  return words.slice(0, limit).join(" ") + "... [truncated]";
}

function countWords(text: string): number {
  return text.split(" ").filter(Boolean).length;
}
