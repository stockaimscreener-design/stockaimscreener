// supabase/functions/screener/index.ts
// Real-time Finnhub screener - queries based on user filters
// ENV: FINNHUB_KEY
import { serve } from "https://deno.land/std@0.200.0/http/server.ts";
// Deno-compatible ESM import for supabase-js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// NEW:
const FINNHUB_KEY = Deno.env.get("FINNHUB_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""; // Auto-injected by Supabase
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? ""; // Auto-injected

// Use ANON_KEY instead of SERVICE_ROLE_KEY for the client
let supabase = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

if (!FINNHUB_KEY) console.error("[INIT] Missing FINNHUB_KEY");

// --- Rate limiting for free tier (60 calls/min) ---
const CALLS_PER_MINUTE = 55; // Buffer of 5
const RATE_LIMIT_WINDOW = 60000;
const CONCURRENCY = 3; // Process 3 symbols in parallel
const MAX_SYMBOLS_TO_CHECK = 100; // Limit to prevent timeout

let apiCallTimestamps = [];

async function rateLimitedFetch(url) {
  const now = Date.now();
  apiCallTimestamps = apiCallTimestamps.filter((ts) => now - ts < RATE_LIMIT_WINDOW);

  if (apiCallTimestamps.length >= CALLS_PER_MINUTE) {
    const oldestCall = apiCallTimestamps[0];
    const waitTime = RATE_LIMIT_WINDOW - (now - oldestCall) + 1000;
    console.log(`[RATE_LIMIT] Waiting ${Math.ceil(waitTime / 1000)}s`);
    await new Promise((resolve) => setTimeout(resolve, waitTime));
    apiCallTimestamps = apiCallTimestamps.filter((ts) => Date.now() - ts < RATE_LIMIT_WINDOW);
  }

  apiCallTimestamps.push(Date.now());
  const res = await fetch(url);

  if (res.status === 429) {
    // Respect Retry-After header if present
    const retryAfter = parseInt(res.headers.get("retry-after") || "60", 10);
    console.log(`[RATE_LIMIT] Got 429, waiting ${retryAfter}s`);
    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
    // After waiting, call again
    return rateLimitedFetch(url);
  }

  return res;
}

function nowISO() {
  return new Date().toISOString();
}

function safeNum(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function finnhubFetch(path, params = {}) {
  const url = new URL(`https://finnhub.io/api/v1/${path}`);
  url.searchParams.set("token", FINNHUB_KEY);
  for (const k of Object.keys(params)) url.searchParams.set(k, String(params[k]));

  try {
    const res = await rateLimitedFetch(url.toString());
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Finnhub ${path} HTTP ${res.status}: ${text}`);
    }
    // Try parse JSON; if it fails, bubble error
    return await res.json();
  } catch (err) {
    console.log(
      JSON.stringify({
        timestamp: nowISO(),
        level: "ERROR",
        source: "FINNHUB_FETCH",
        path,
        message: typeof err === "object" && err && "message" in err ? String(err.message) : String(err),
      })
    );
    throw err;
  }
}

// Get list of NASDAQ/NYSE stocks from our database
async function fetchStockTickers(exchange?: 'NASDAQ' | 'NYSE') {
  console.log(`[FETCH] Getting ${exchange || 'NASDAQ/NYSE'} stock symbols from database`);
  try {
    if (!supabase) {
      console.log("[ERROR] Supabase client not initialized");
      return [];
    }

    let query = supabase.from('stock_tickers').select('*');
    
    if (exchange) {
      query = query.eq('exchange', exchange);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.log("[ERROR] fetchStockTickers:", error.message);
      return [];
    }
    
    if (!Array.isArray(data)) return [];
    
    console.log(`[FETCH] Found ${data.length} valid stocks from database`);
    return data.map(ticker => ({
      symbol: ticker.Symbol,
      type: 'common',
      description: ticker['Company Name']
    }));
  } catch (err) {
    console.log(
      "[ERROR] fetchStockTickers:",
      typeof err === "object" && err && "message" in err ? String(err.message) : String(err)
    );
    return [];
  }
}

// Fetch comprehensive data for a single symbol
async function fetchSymbolData(symbol) {
  try {
    // Parallel fetch: quote, profile, and metrics (3 API calls per symbol)
    const [quoteData, profileData, metricData] = await Promise.all([
      finnhubFetch("quote", { symbol }).catch(() => null),
      finnhubFetch("stock/profile2", { symbol }).catch(() => null),
      finnhubFetch("stock/metric", { symbol, metric: "all" }).catch(() => null),
    ]);

    // Parse quote data
    const c = safeNum(quoteData?.c);
    const pc = safeNum(quoteData?.pc);
    const change_percent =
      c !== null && pc !== null && pc !== 0 ? Number(((c - pc) / pc * 100).toFixed(4)) : null;
    const volume = safeNum(quoteData?.v ?? quoteData?.volume) ?? null;

    // Parse profile data (market cap is in millions, convert to actual value)
    const market_cap = safeNum(profileData?.marketCapitalization)
      ? safeNum(profileData.marketCapitalization) * 1e6
      : null;
    const shares_float = safeNum(profileData?.shareOutstanding) ?? null;
    const name = profileData?.name ?? null;

    // Parse metrics (Finnhub's metric shape can vary)
    const avgVolume =
      metricData?.metric?.["10DayAverageTradingVolume"] ??
      metricData?.metric?.avgVolume ??
      metricData?.metric?.["10DayAverageTradingVolume"];
    const avgVol = safeNum(avgVolume);

    // Calculate relative volume
    const relative_volume =
      avgVol !== null && volume !== null && avgVol > 0 ? Number((volume / avgVol).toFixed(4)) : null;

    // Return structured data - FIXED: Only consider valid if price AND volume exist and are > 0
    return {
      symbol,
      name,
      price: c,
      change_percent,
      volume,
      market_cap,
      shares_float,
      relative_volume,
      avgVolume: avgVol,
      hasData: c !== null && c > 0 && volume !== null && volume > 0
    };
  } catch (err) {
    console.log(
      `[ERROR] fetchSymbolData ${symbol}:`,
      typeof err === "object" && err && "message" in err ? String(err.message) : String(err)
    );
    return null;
  }
}

// Process symbols with concurrency control
async function mapWithConcurrency(items, concurrency, fn) {
  const results = new Array(items.length);
  let i = 0;

  async function worker() {
    while (true) {
      const idx = i++;
      if (idx >= items.length) break;
      try {
        results[idx] = await fn(items[idx]);
      } catch (e) {
        console.log(
          `[ERROR] Worker failed at index ${idx}:`,
          typeof e === "object" && e && "message" in e ? String(e.message) : String(e)
        );
        results[idx] = null;
      }
    }
  }

  await Promise.all(new Array(Math.max(1, concurrency)).fill(null).map(() => worker()));
  return results;
}

// Apply filters to a stock
function passesFilters(stock, filters, comparisons) {
  if (!stock) return false;

  // ADDED: Stricter validation - reject invalid price/volume data
  if (stock.price === null || stock.price <= 0) return false;
  if (stock.volume === null || stock.volume <= 0) return false;

  // Price filters - EXPLICIT CHECKS
  if (filters.price_min !== undefined && filters.price_min !== null) {
    const minPrice = Number(filters.price_min);
    if (stock.price < minPrice) {
      console.log(`[FILTER_DEBUG] ${stock.symbol} rejected: price ${stock.price} < min ${minPrice}`);
      return false;
    }
  }
  if (filters.price_max !== undefined && filters.price_max !== null) {
    const maxPrice = Number(filters.price_max);
    if (stock.price > maxPrice) {
      console.log(`[FILTER_DEBUG] ${stock.symbol} rejected: price ${stock.price} > max ${maxPrice}`);
      return false;
    }
  }

  // Float filters
  if (filters.float_min !== undefined && filters.float_min !== null) {
    if (stock.shares_float === null || stock.shares_float < Number(filters.float_min)) return false;
  }
  if (filters.float_max !== undefined && filters.float_max !== null) {
    if (stock.shares_float === null || stock.shares_float > Number(filters.float_max)) return false;
  }

  // Market cap filters
  if (filters.market_cap_min !== undefined && filters.market_cap_min !== null) {
    if (stock.market_cap === null || stock.market_cap < Number(filters.market_cap_min)) return false;
  }
  if (filters.market_cap_max !== undefined && filters.market_cap_max !== null) {
    if (stock.market_cap === null || stock.market_cap > Number(filters.market_cap_max)) return false;
  }

  // Change percent filters
  if (filters.change_min !== undefined && filters.change_min !== null) {
    if (stock.change_percent === null || stock.change_percent < Number(filters.change_min)) return false;
  }
  if (filters.change_max !== undefined && filters.change_max !== null) {
    if (stock.change_percent === null || stock.change_percent > Number(filters.change_max)) return false;
  }

  // Relative volume filters
  if (filters.relative_volume_min !== undefined && filters.relative_volume_min !== null) {
    if (stock.relative_volume === null || stock.relative_volume < Number(filters.relative_volume_min))
      return false;
  }

  // Volume filters
  if (filters.volume_min !== undefined && filters.volume_min !== null) {
    if (stock.volume < Number(filters.volume_min)) return false;
  }

  // Comparisons (e.g., volume > shares_float)
  for (const cmp of comparisons) {
    const leftVal = stock[cmp.left] ?? null;
    const rightVal = stock[cmp.right] ?? null;
    if (leftVal === null || rightVal === null) return false;

    if (cmp.operator === ">" && !(leftVal > rightVal)) return false;
    if (cmp.operator === "<" && !(leftVal < rightVal)) return false;
    if (cmp.operator === "=" && !(leftVal === rightVal)) return false;
  }

  return true;
}

// Main serve handler
serve(async (req) => {
  const VERSION = "v2.1-FILTER-FIX";
  console.log(`[INIT] Screener invoked: ${nowISO()} - Version: ${VERSION}`);

  

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "content-type": "application/json" },
    });
  }

  let body = {};
  try {
    body = await req.json().catch(() => ({}));
  } catch (err) {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const filters = body.filters || {};
  const comparisons = Array.isArray(body.comparisons) ? body.comparisons : [];
  const options = body.options || {};
  const exchange = options.exchange || 'NASDAQ'; // Default to NASDAQ, can be 'NASDAQ', 'NYSE', or 'ALL'
  const maxSymbols = Math.min(Number(options.maxSymbols || MAX_SYMBOLS_TO_CHECK), 200);
  const orderBy = String(options.orderBy ?? "change_percent");

  console.log("[REQUEST] Filters:", JSON.stringify(filters));
  console.log("[REQUEST] Max symbols to check:", maxSymbols);

  try {
    const startTime = Date.now();

    // Step 1: Get list of stocks from database
    console.log(`[STEP 1] Fetching ${exchange} stock list from database...`);
    const exchangeFilter = exchange === 'ALL' ? undefined : exchange;
    const allStocks = await fetchStockTickers(exchangeFilter);

    if (!allStocks.length) {
      return new Response(JSON.stringify({ error: "Failed to fetch stock list from database" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }

    // Step 2: Limit to maxSymbols (randomly sample to get variety)
    const symbolsToCheck = allStocks
      .sort(() => Math.random() - 0.5)
      .slice(0, maxSymbols)
      .map((s) => s.symbol);

    console.log(`[STEP 2] Checking ${symbolsToCheck.length} symbols`);

    // Step 3: Fetch data for each symbol with concurrency - NO LOGGING during fetch
    console.log("[STEP 3] Fetching data from Finnhub... (this may take a while)");
    const stocksData = await mapWithConcurrency(symbolsToCheck, CONCURRENCY, async (symbol) => {
      const data = await fetchSymbolData(symbol);
      // NO LOGGING HERE - wait until after filtering
      return data;
    });

    // Step 4: Filter out nulls and apply user filters - FIXED: Added logging after filtering
    console.log("[STEP 4] Applying filters...");
    const validStocks = stocksData.filter((s) => s !== null && s.hasData);
    
    // Debug: Log a few stocks before filtering
    console.log("[DEBUG] Sample stocks before filtering:");
    validStocks.slice(0, 3).forEach(s => {
      console.log(`  ${s.symbol}: price=${s.price}, change=${s.change_percent}%, vol=${s.volume}, float=${s.shares_float}, mcap=${s.market_cap}`);
    });
    
    const filteredStocks = validStocks.filter((stock) => {
      const passes = passesFilters(stock, filters, comparisons);
      // Debug: Log why stocks are rejected
      if (!passes && validStocks.indexOf(stock) < 5) {
        console.log(`  [REJECTED] ${stock.symbol}: price=${stock.price}, change=${stock.change_percent}%`);
      }
      return passes;
    });
    
    console.log(`[RESULT] ${validStocks.length} stocks with data, ${filteredStocks.length} passed filters`);
    
    // Log sample of filtered results
    if (filteredStocks.length > 0) {
      console.log(`[FILTERED RESULTS] Sample of ${Math.min(10, filteredStocks.length)} stocks that PASSED filters:`);
      filteredStocks.slice(0, 10).forEach(stock => {
        console.log(`  [✓] ${stock.symbol}: ${stock.price} (${stock.change_percent}%) Vol: ${stock.volume} Float: ${stock.shares_float}`);
      });
    }

    // Step 5: Sort results
    if (orderBy === "relative_volume") {
      filteredStocks.sort((a, b) => (b.relative_volume ?? -Infinity) - (a.relative_volume ?? -Infinity));
    } else if (orderBy === "volume") {
      filteredStocks.sort((a, b) => (b.volume ?? -Infinity) - (a.volume ?? -Infinity));
    } else {
      // Default: sort by change_percent
      filteredStocks.sort((a, b) => (b.change_percent ?? -Infinity) - (a.change_percent ?? -Infinity));
    }

    // Step 6: Paginate
    const offset = Number(options.offset ?? 0);
    const limit = Number(options.limit ?? 50);
    const paginatedResults = filteredStocks.slice(offset, offset + limit);

    // Step 7: Upsert results into Supabase
    if (supabase) {
      try {
        const upsertPayload = paginatedResults
          .filter((stock) => stock && stock.symbol)
          .map((stock) => ({
            symbol: stock.symbol,
            name: stock.name ?? null,
            price: stock.price ?? null,
            change_percent: stock.change_percent ?? null,
            volume: stock.volume ?? null,
            relative_volume: stock.relative_volume ?? null,
            market_cap: stock.market_cap ?? null,
            float_shares: stock.shares_float ?? null,
            shares_float: stock.shares_float ?? null,
            updated_at: new Date().toISOString(),
          }));

        if (upsertPayload.length > 0) {
          const { error } = await supabase.from("stocks").upsert(upsertPayload, {
            onConflict: ["symbol"],
          });

          if (error) {
            console.log(
              "[SUPABASE ERROR]",
              typeof error === "object" && error && "message" in error ? String(error.message) : String(error)
            );
          } else {
            console.log(`[SUPABASE] Upserted ${upsertPayload.length} stocks`);
          }
        } else {
          console.log("[SUPABASE] No valid stocks to upsert");
        }
      } catch (err) {
        console.log(
          "[SUPABASE ERROR]",
          typeof err === "object" && err && "message" in err ? String(err.message) : String(err)
        );
      }
    } else {
      console.log("[SUPABASE] Missing URL or service role key, skipping DB update");
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[COMPLETE] Returned ${paginatedResults.length} results in ${duration}s`);

    return new Response(
      JSON.stringify({
        success: true,
        count: paginatedResults.length,
        total_matched: filteredStocks.length,
        total_checked: validStocks.length,
        results: paginatedResults
          .filter((stock) => stock)
          .map((stock) => ({
            symbol: stock.symbol,
            name: stock.name,
            price: stock.price,
            change_percent: stock.change_percent,
            volume: stock.volume,
            relative_volume: stock.relative_volume,
            market_cap: stock.market_cap,
            shares_float: stock.shares_float,
          })),
        stats: {
          symbols_checked: symbolsToCheck.length,
          symbols_with_data: validStocks.length,
          symbols_matched: filteredStocks.length,
          api_calls_used: apiCallTimestamps.length,
          duration_seconds: parseFloat(duration),
        },
      }),
      {
        headers: { "content-type": "application/json" },
        status: 200,
      }
    );
  } catch (err) {
    console.log("[ERROR] Fatal:", String(err?.message ?? err));
    return new Response(
      JSON.stringify({
        error: String(err?.message ?? err),
        stack: err?.stack,
      }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
});
