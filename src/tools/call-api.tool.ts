import axios from "axios";
import { logger } from "../utils/logger";

// ─────────────────────────────────────────────────────────────────────────────
// Tool: call_api
// Providers: ACLED (conflict events) | UN Comtrade (trade data)
// ─────────────────────────────────────────────────────────────────────────────

export type ApiName = "acled" | "un_comtrade";

export interface AcledParams {
  country: string;
  start_date: string;
  end_date: string;
  event_type?: string;
}

export interface ComtradeParams {
  reporter: string;
  partner: string;
  year: number;
  commodity_code?: string;
}

export type CallApiParams = AcledParams | ComtradeParams;

export interface CallApiSuccess {
  success: true;
  api_name: ApiName;
  data: Record<string, unknown>[];
  record_count: number;
  fetched_at: string;
}

export interface CallApiError {
  success: false;
  error: "api_failed";
  api_name: ApiName;
  message: string;
}

export type CallApiOutput = CallApiSuccess | CallApiError;

// ─────────────────────────────────────────────────────────────────────────────
// ACLED OAuth Token Cache
// ─────────────────────────────────────────────────────────────────────────────

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

let acledTokenCache: TokenCache | null = null;

async function getAcledToken(): Promise<string> {
  const now = Date.now();

  if (acledTokenCache && acledTokenCache.expiresAt > now + 5 * 60 * 1000) {
    logger.info("[call_api:acled] Using cached token");
    return acledTokenCache.accessToken;
  }

  logger.info("[call_api:acled] Requesting new OAuth token...");
  logger.info(
    { email: process.env.ACLED_EMAIL },
    "[call_api:acled] Using email",
  );

  const params = new URLSearchParams({
    username: process.env.ACLED_EMAIL ?? "",
    password: process.env.ACLED_PASSWORD ?? "",
    grant_type: "password",
    client_id: "acled",
  });

  try {
    const response = await axios.post(
      "https://acleddata.com/oauth/token",
      params.toString(),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 15_000,
      },
    );

    const { access_token, expires_in } = response.data;

    acledTokenCache = {
      accessToken: access_token,
      expiresAt: now + expires_in * 1000,
    };

    logger.info(
      `[call_api:acled] Token acquired successfully, expires in: ${expires_in} seconds`,
    );
    return access_token;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error(
        `[call_api:acled] Token request failed — status: ${error.response?.status}`,
      );
      logger.error(
        `[call_api:acled] Token request failed — data: ${JSON.stringify(error.response?.data)}`,
      );
    }
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

export async function callApi(
  apiName: ApiName,
  params: CallApiParams,
): Promise<CallApiOutput> {
  switch (apiName) {
    case "acled":
      return fetchAcled(params as AcledParams);
    case "un_comtrade":
      return fetchComtrade(params as ComtradeParams);
    default:
      return {
        success: false,
        error: "api_failed",
        api_name: apiName,
        message: `Unknown api_name: '${apiName}'`,
      };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ACLED implementation — OAuth Bearer token
// ─────────────────────────────────────────────────────────────────────────────

async function fetchAcled(params: AcledParams): Promise<CallApiOutput> {
  try {
    const token = await getAcledToken();

    logger.info(
      `[call_api:acled] Making API request with params: ${JSON.stringify(params)}`,
    );

    const response = await axios.get("https://acleddata.com/api/acled/read", {
      params: {
        _format: "json",
        country: params.country,
        event_date: `${params.start_date}|${params.end_date}`,
        event_date_where: "BETWEEN",
        ...(params.event_type && { event_type: params.event_type }),
        fields:
          "event_date|event_type|actor1|actor2|country|location|fatalities|notes",
        limit: 100,
      },
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      timeout: 15_000,
    });

    logger.info(`[call_api:acled] Response status: ${response.status}`);
    logger.info(
      `[call_api:acled] Response data keys: ${Object.keys(response.data ?? {})}`,
    );

    // If token was rejected, clear cache and retry once
    if (response.data?.status === 401) {
      logger.warn(
        "[call_api:acled] Token rejected (401 in body), clearing cache and retrying...",
      );
      acledTokenCache = null;
      return fetchAcled(params);
    }

    const data = response.data?.data ?? [];
    logger.info(`[call_api:acled] Records returned: ${data.length}`);

    return {
      success: true,
      api_name: "acled",
      data,
      record_count: data.length,
      fetched_at: new Date().toISOString(),
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error(`[call_api:acled] Status: ${error.response?.status}`);
      logger.error(
        `[call_api:acled] Response data: ${JSON.stringify(error.response?.data)}`,
      );
      logger.error(`[call_api:acled] Request URL: ${error.config?.url}`);
      logger.error(
        `[call_api:acled] Request params: ${JSON.stringify(error.config?.params)}`,
      );
      if (error.response?.status === 401) {
        acledTokenCache = null;
      }
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error(`[call_api:acled] Failed: ${message}`);
    return {
      success: false,
      error: "api_failed",
      api_name: "acled",
      message,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UN Comtrade implementation
// ─────────────────────────────────────────────────────────────────────────────

async function fetchComtrade(params: ComtradeParams): Promise<CallApiOutput> {
  try {
    const response = await axios.get(
      `https://comtradeapi.un.org/public/v1/preview/C/A/HS`,
      {
        params: {
          reporterCode: params.reporter,
          partnerCode: params.partner,
          period: String(params.year),
          ...(params.commodity_code && { cmdCode: params.commodity_code }),
        },
        timeout: 15_000,
      },
    );

    const data = response.data?.data ?? [];

    return {
      success: true,
      api_name: "un_comtrade",
      data,
      record_count: data.length,
      fetched_at: new Date().toISOString(),
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("[call_api:un_comtrade] Status:", error.response?.status);
      console.error(
        "[call_api:un_comtrade] Response data:",
        JSON.stringify(error.response?.data),
      );
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[call_api:un_comtrade] Failed:", message);
    return {
      success: false,
      error: "api_failed",
      api_name: "un_comtrade",
      message,
    };
  }
}
// async function fetchComtrade(params: ComtradeParams): Promise<CallApiOutput> {
//   try {
//     const response = await axios.get(
//       "https://comtradeapi.un.org/data/v1/get/C/A/HS",
//       {
//         params: {
//           reporterCode: params.reporter,
//           partnerCode: params.partner,
//           period: String(params.year),
//           ...(params.commodity_code && { cmdCode: params.commodity_code }),
//           maxRecords: 100,
//           format: "JSON",
//         },
//         timeout: 15_000,
//       },
//     );

//     const data = response.data?.data ?? [];

//     return {
//       success: true,
//       api_name: "un_comtrade",
//       data,
//       record_count: data.length,
//       fetched_at: new Date().toISOString(),
//     };
//   } catch (error) {
//     if (axios.isAxiosError(error)) {
//       logger.error(`[call_api:un_comtrade] Status: ${error.response?.status}`);
//       logger.error(
//         `[call_api:un_comtrade] Response data: ${JSON.stringify(error.response?.data)}`,
//       );
//     }
//     const message = error instanceof Error ? error.message : "Unknown error";
//     logger.error(`[call_api:un_comtrade] Failed: ${message}`);
//     return {
//       success: false,
//       error: "api_failed",
//       api_name: "un_comtrade",
//       message,
//     };
//   }
// }
