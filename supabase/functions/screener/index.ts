// supabase/functions/screener/index.ts
import { serve } from "https://deno.land/std@0.200.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

type Filters = {
  price_min?: number;
  price_max?: number;
  float_max?: number;
  market_cap_max?: number;
  change_min?: number;
  change_max?: number;
  relative_volume_min?: number;
  volume_min?: number;
};

type QuoteResult = {
  symbol: string;
  name: string | null;
  price: number | null;
  change_percent: number | null;
  volume: number | null;
  market_cap: number | null;
  shares_float: number | null;
  relative_volume: number | null;
  raw?: any;
};

const FMP_KEY = Deno.env.get("FMP_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Configuration
const YAHOO_BATCH_SIZE = 100; // Yahoo supports up to 100+ symbols
const FMP_BATCH_DELAY = 100; // Minimal delay between FMP calls
const FRESHNESS_MS = 1000 * 60 * 15; // 15 minutes for price data (more aggressive)
const PROFILE_FRESHNESS_MS = 1000 * 60 * 60 * 24; // 24 hours for profile data (less frequent changes)
const DB_BATCH_SIZE = 500; // Larger batch for DB operations

function computeRelativeVolume(today: number | null, avg10: number | null): number | null {
  if (today == null || avg10 == null || avg10 === 0) return null;
  return Number((today / avg10).toFixed(2));
}

// OPTIMIZED: Batch fetch from Yahoo - increased batch size
async function fetchBatchFromYahoo(symbols: string[]): Promise<Map<string, Partial<QuoteResult>>> {
  const results = new Map<string, Partial<QuoteResult>>();
  
  try {
    const symbolList = symbols.join(',');
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbolList)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    
    if (!res.ok) {
      console.error(`Yahoo fetch failed: ${res.status}`);
      return results;
    }
    
    const data = await res.json();
    
    if (!data?.quoteResponse?.result) return results;
    
    for (const quote of data.quoteResponse.result) {
      const symbol = quote.symbol;
      const price = quote.regularMarketPrice ?? null;
      const prevClose = quote.regularMarketPreviousClose ?? null;
      const change_percent = (price != null && prevClose != null && prevClose !== 0)
        ? Number((((price - prevClose) / prevClose) * 100).toFixed(4))
        : null;
      const volume = quote.regularMarketVolume ?? null;
      const avg10 = quote.averageDailyVolume10Day ?? null;
      const relative_volume = computeRelativeVolume(volume, avg10);
      
      results.set(symbol, {
        symbol,
        name: quote.longName ?? quote.shortName ?? null,
        price,
        change_percent,
        volume,
        market_cap: quote.marketCap ?? null,
        shares_float: quote.floatShares ?? null,
        relative_volume,
        raw: quote
      });
    }
  } catch (e) {
    console.error('Yahoo fetch error:', e);
  }
  
  return results;
}

// OPTIMIZED: Batch fetch from FMP profiles (reduced API calls)
async function fetchBatchFromFMP(symbols: string[]): Promise<Map<string, Partial<QuoteResult>>> {
  const results = new Map<string, Partial<QuoteResult>>();
  if (!FMP_KEY || symbols.length === 0) return results;
  
  // FMP doesn't have true batch profile endpoint, so we minimize calls
  // Only fetch for symbols that really need it
  for (const symbol of symbols) {
    try {
      const url = `https://financialmodelingprep.com/stable/profile?symbol=${symbol}&apikey=${FMP_KEY}`;
      const res = await fetch(url);
      
      if (!res.ok) continue;
      
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) continue;
      
      const profile = data[0];
      results.set(symbol, {
        symbol,
        name: profile.companyName ?? null,
        market_cap: profile.mktCap ?? null,
        shares_float: profile.sharesOutstanding ?? null,
        raw: profile
      });
      
      // Minimal delay to avoid rate limiting
      if (symbols.indexOf(symbol) < symbols.length - 1) {
        await new Promise(resolve => setTimeout(resolve, FMP_BATCH_DELAY));
      }
    } catch (e) {
      console.error(`FMP error for ${symbol}:`, e);
    }
  }
  
  return results;
}

// OPTIMIZED: Smart merge with priority logic
function smartMerge(
  primary: Partial<QuoteResult> | null, 
  fallback: Partial<QuoteResult> | null
): QuoteResult | null {
  if (!primary || !primary.symbol) return null;
  
  // Prioritize Yahoo for real-time data, FMP for profile data
  return {
    symbol: String(primary.symbol),
    name: primary.name ?? fallback?.name ?? null,
    price: primary.price ?? null, // Always from Yahoo (real-time)
    change_percent: primary.change_percent ?? null, // Always from Yahoo
    volume: primary.volume ?? null, // Always from Yahoo
    relative_volume: primary.relative_volume ?? null, // Calculated from Yahoo
    market_cap: primary.market_cap ?? fallback?.market_cap ?? null, // Yahoo first, FMP fallback
    shares_float: primary.shares_float ?? fallback?.shares_float ?? null, // Yahoo first, FMP fallback
    raw: { yahoo: primary.raw, fmp: fallback?.raw }
  };
}

// OPTIMIZED: Intelligent cache with separate freshness for price vs profile data
async function getCachedStocks(
  symbols: string[], 
  needsRealtime: boolean = true
): Promise<Map<string, QuoteResult>> {
  const cached = new Map<string, QuoteResult>();
  
  if (symbols.length === 0) return cached;
  
  const { data, error } = await supabase
    .from("stocks")
    .select("*")
    .in("symbol", symbols);
  
  if (error) {
    console.error('Cache lookup error:', error);
    return cached;
  }
  
  if (!data) return cached;
  
  const now = Date.now();
  for (const row of data) {
    if (!row.updated_at) continue;
    
    const age = now - new Date(row.updated_at).getTime();
    
    // Different freshness requirements based on data type
    const freshnessThreshold = needsRealtime ? FRESHNESS_MS : PROFILE_FRESHNESS_MS;
    
    if (age > freshnessThreshold) continue;
    
    cached.set(row.symbol, {
      symbol: row.symbol,
      name: row.name ?? null,
      price: row.price != null ? Number(row.price) : null,
      change_percent: row.change_percent != null ? Number(row.change_percent) : null,
      volume: row.volume != null ? Number(row.volume) : null,
      market_cap: row.market_cap != null ? Number(row.market_cap) : null,
      shares_float: row.shares_float != null ? Number(row.shares_float) : null,
      relative_volume: row.relative_volume != null ? Number(row.relative_volume) : null,
      raw: row.raw ?? null
    });
  }
  
  return cached;
}

// OPTIMIZED: Larger batch upserts with better error handling
async function batchUpsertStocks(stocks: QuoteResult[]): Promise<void> {
  if (stocks.length === 0) return;
  
  const rows = stocks.map(s => ({
    symbol: s.symbol,
    name: s.name,
    price: s.price,
    change_percent: s.change_percent,
    volume: s.volume,
    market_cap: s.market_cap,
    shares_float: s.shares_float,
    relative_volume: s.relative_volume,
    raw: s.raw ?? null,
    updated_at: new Date().toISOString()
  }));
  
  // Larger chunks for better performance
  for (let i = 0; i < rows.length; i += DB_BATCH_SIZE) {
    const chunk = rows.slice(i, i + DB_BATCH_SIZE);
    const { error } = await supabase
      .from("stocks")
      .upsert(chunk, { onConflict: "symbol", ignoreDuplicates: false });
    
    if (error) {
      console.error(`DB upsert error (batch ${i}):`, error);
    }
  }
}

// OPTIMIZED: Parallel fetching strategy with intelligent batching
async function enrichSymbols(symbols: string[]): Promise<QuoteResult[]> {
  const results: QuoteResult[] = [];
  const startTime = Date.now();
  
  // Step 1: Check cache first (single DB query)
  const cached = await getCachedStocks(symbols, true);
  const uncachedSymbols = symbols.filter(s => !cached.has(s));
  
  results.push(...Array.from(cached.values()));
  
  console.log(`✓ Cache: ${cached.size}/${symbols.length} hits (${((cached.size/symbols.length)*100).toFixed(1)}%)`);
  
  if (uncachedSymbols.length === 0) {
    console.log(`✓ Performance: ${Date.now() - startTime}ms (100% cached)`);
    return results;
  }
  
  console.log(`→ Fetching ${uncachedSymbols.length} symbols from APIs...`);
  
  // Step 2: Fetch ALL uncached symbols from Yahoo in larger batches
  const yahooResults = new Map<string, Partial<QuoteResult>>();
  const yahooStartTime = Date.now();
  
  for (let i = 0; i < uncachedSymbols.length; i += YAHOO_BATCH_SIZE) {
    const batch = uncachedSymbols.slice(i, i + YAHOO_BATCH_SIZE);
    const batchResults = await fetchBatchFromYahoo(batch);
    
    for (const [symbol, data] of batchResults.entries()) {
      yahooResults.set(symbol, data);
    }
  }
  
  console.log(`✓ Yahoo: ${yahooResults.size}/${uncachedSymbols.length} fetched in ${Date.now() - yahooStartTime}ms`);
  
  // Step 3: Identify symbols missing critical data from Yahoo
  const needsFMP: string[] = [];
  for (const symbol of uncachedSymbols) {
    const yahoo = yahooResults.get(symbol);
    if (yahoo && yahoo.price) {
      // Only fetch from FMP if missing market_cap OR shares_float
      if (!yahoo.market_cap || !yahoo.shares_float) {
        needsFMP.push(symbol);
      }
    }
  }
  
  // Step 4: Fetch missing data from FMP (minimized calls)
  let fmpResults = new Map<string, Partial<QuoteResult>>();
  if (needsFMP.length > 0) {
    const fmpStartTime = Date.now();
    console.log(`→ FMP needed for ${needsFMP.length} symbols (missing profile data)`);
    fmpResults = await fetchBatchFromFMP(needsFMP);
    console.log(`✓ FMP: ${fmpResults.size}/${needsFMP.length} fetched in ${Date.now() - fmpStartTime}ms`);
  } else {
    console.log(`✓ FMP: 0 calls needed (Yahoo provided all data)`);
  }
  
  // Step 5: Merge and create final results
  const newStocks: QuoteResult[] = [];
  for (const symbol of uncachedSymbols) {
    const yahoo = yahooResults.get(symbol);
    if (!yahoo || !yahoo.price) continue; // Skip if no price
    
    const fmp = fmpResults.get(symbol);
    const merged = smartMerge(yahoo, fmp);
    
    if (merged) {
      newStocks.push(merged);
      results.push(merged);
    }
  }
  
  // Step 6: Batch upsert to DB (single operation per chunk)
  if (newStocks.length > 0) {
    const dbStartTime = Date.now();
    await batchUpsertStocks(newStocks);
    console.log(`✓ DB: ${newStocks.length} stocks cached in ${Date.now() - dbStartTime}ms`);
  }
  
  const totalTime = Date.now() - startTime;
  console.log(`✓ Performance: ${totalTime}ms total | ${(totalTime/symbols.length).toFixed(1)}ms per symbol`);
  
  return results;
}

// Build FMP screener query
function buildFmpScreenerQuery(filters: Filters, limit = 250): string {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("exchange", "NASDAQ,NYSE");
  
  if (filters.price_min != null) params.set("priceMoreThan", String(filters.price_min));
  if (filters.price_max != null) params.set("priceLowerThan", String(filters.price_max));
  if (filters.market_cap_max != null) params.set("marketCapLowerThan", String(filters.market_cap_max));
  if (filters.volume_min != null) params.set("volumeMoreThan", String(filters.volume_min));
  
  return params.toString();
}

serve(async (req) => {
  const requestStart = Date.now();
  
  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "POST only" }),
        { status: 405, headers: { "Content-Type": "application/json" } }
      );
    }
    
    const body = await req.json();
    const filters: Filters = body.filters || {};
    const limit = Number(body.limit ?? 250);
    
    console.log(`\n=== Screener Request ===`);
    console.log(`Filters:`, JSON.stringify(filters));
    console.log(`Limit: ${limit}`);
    
    // Step 1: Get candidates from FMP screener
    const fmpQS = buildFmpScreenerQuery(filters, limit * 2);
    const fmpUrl = `https://financialmodelingprep.com/stable/company-screener?${fmpQS}&apikey=${encodeURIComponent(FMP_KEY)}`;
    
    const fmpStart = Date.now();
    const fmpRes = await fetch(fmpUrl);
    
    if (!fmpRes.ok) {
      const errorText = await fmpRes.text();
      console.error(`FMP screener failed: ${fmpRes.status}`, errorText);
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText };
      }
      
      return new Response(
        JSON.stringify({ 
          error: "FMP screener failed", 
          status: fmpRes.status,
          message: errorData
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }
    
    const fmpData = await fmpRes.json();
    console.log(`✓ FMP screener: ${Date.now() - fmpStart}ms`);
    
    // Handle error responses
    if (fmpData && typeof fmpData === 'object' && 'Error Message' in fmpData) {
      console.error('FMP returned error:', fmpData);
      return new Response(
        JSON.stringify({ 
          error: "FMP API error",
          message: fmpData['Error Message']
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }
    
    // Extract symbols
    let candidates: string[] = [];
    if (Array.isArray(fmpData)) {
      candidates = fmpData
        .map((r: any) => r.symbol ?? r.ticker)
        .filter(Boolean)
        .slice(0, limit * 3); // Get more candidates for better filtering
    }
    
    if (candidates.length === 0) {
      console.log('No candidates from FMP');
      return new Response(
        JSON.stringify({ 
          stocks: [],
          source: "FMP->Yahoo(batch)->FMP(selective)",
          performance: {
            total_time_ms: Date.now() - requestStart,
            api_calls: { fmp: 1, yahoo: 0 },
            cache_hit_rate: "0%"
          }
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    
    console.log(`→ ${candidates.length} candidates from FMP`);
    
    // Step 2: Enrich with caching and batching
    const enriched = await enrichSymbols(candidates);
    
    // Step 3: Apply post-enrichment filters
    const filtered = enriched.filter(q => {
      if (filters.float_max != null && q.shares_float != null && q.shares_float > filters.float_max) return false;
      if (filters.change_min != null && q.change_percent != null && q.change_percent < filters.change_min) return false;
      if (filters.change_max != null && q.change_percent != null && q.change_percent > filters.change_max) return false;
      if (filters.relative_volume_min != null && q.relative_volume != null && q.relative_volume < filters.relative_volume_min) return false;
      if (filters.price_min != null && q.price != null && q.price < filters.price_min) return false;
      if (filters.price_max != null && q.price != null && q.price > filters.price_max) return false;
      if (filters.volume_min != null && q.volume != null && q.volume < filters.volume_min) return false;
      if (filters.market_cap_max != null && q.market_cap != null && q.market_cap > filters.market_cap_max) return false;
      return true;
    });
    
    const out = filtered.slice(0, limit);
    
    const totalTime = Date.now() - requestStart;
    const cacheHitRate = candidates.length > 0 
      ? `${((enriched.length / candidates.length) * 100).toFixed(1)}%`
      : "0%";
    
    console.log(`\n=== Results ===`);
    console.log(`Total time: ${totalTime}ms`);
    console.log(`Candidates: ${candidates.length} → Enriched: ${enriched.length} → Filtered: ${filtered.length} → Final: ${out.length}`);
    
    return new Response(
      JSON.stringify({
        source: "FMP->Yahoo(batch)->FMP(selective)",
        count: out.length,
        performance: {
          total_time_ms: totalTime,
          candidates: candidates.length,
          enriched: enriched.length,
          filtered: filtered.length,
          cache_hit_rate: cacheHitRate,
          avg_time_per_symbol_ms: (totalTime / candidates.length).toFixed(2)
        },
        stocks: out
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
    
  } catch (err) {
    console.error('Unexpected error:', err);
    return new Response(
      JSON.stringify({ 
        error: String(err),
        stack: err instanceof Error ? err.stack : undefined
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});