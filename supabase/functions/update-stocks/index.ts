// supabase/functions/update-stocks/index.ts
import { serve } from "https://deno.land/std@0.200.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

type QuoteResult = {
  symbol: string;
  name: string | null;
  price: number | null;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  close?: number | null;
  volume: number | null;
  change_percent: number | null;
  market_cap: number | null;
  shares_float: number | null;
  relative_volume: number | null;
  raw?: any;
};

type UpdateMode = 'full' | 'delta' | 'manual';

const FMP_KEY = Deno.env.get("FMP_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Configuration
const BATCH_SIZE = Number(Deno.env.get("BATCH_SIZE") || "100");
const CONCURRENCY = Number(Deno.env.get("CONCURRENCY") || "5");
const TOP_N_DELTA = Number(Deno.env.get("TOP_N_DELTA") || "500");
const FRESHNESS_MS = Number(Deno.env.get("FRESHNESS_MS") || "300000"); // 5 minutes
const THROTTLE_MS = 500; // delay between batches

// Circuit breaker state
let providerFailures = { yahoo: 0, fmp: 0 };
const CIRCUIT_BREAKER_THRESHOLD = 10;

function computeRelativeVolume(today: number | null, avg10: number | null): number | null {
  if (today == null || avg10 == null || avg10 === 0) return null;
  return Number((today / avg10).toFixed(2));
}

// Batch fetch from Yahoo Finance
async function fetchBatchFromYahoo(symbols: string[]): Promise<Map<string, Partial<QuoteResult>>> {
  const results = new Map<string, Partial<QuoteResult>>();
  
  if (providerFailures.yahoo >= CIRCUIT_BREAKER_THRESHOLD) {
    console.warn('Yahoo circuit breaker open, skipping');
    return results;
  }
  
  try {
    const symbolList = symbols.join(',');
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbolList)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000) // 10s timeout
    });
    
    if (!res.ok) {
      providerFailures.yahoo++;
      console.error(`Yahoo API error: ${res.status}`);
      return results;
    }
    
    const data = await res.json();
    
    if (!data?.quoteResponse?.result) return results;
    
    // Reset failures on success
    providerFailures.yahoo = 0;
    
    for (const quote of data.quoteResponse.result) {
      const symbol = quote.symbol;
      const price = quote.regularMarketPrice ?? null;
      const open = quote.regularMarketOpen ?? null;
      const high = quote.regularMarketDayHigh ?? null;
      const low = quote.regularMarketDayLow ?? null;
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
        open,
        high,
        low,
        change_percent,
        volume,
        market_cap: quote.marketCap ?? null,
        shares_float: quote.floatShares ?? null,
        relative_volume,
        raw: quote
      });
    }
  } catch (err) {
    providerFailures.yahoo++;
    console.error('Yahoo batch fetch error:', err);
  }
  
  return results;
}

// Fetch fundamentals from FMP (only if needed)
async function fetchFundamentalsFromFMP(symbols: string[]): Promise<Map<string, Partial<QuoteResult>>> {
  const results = new Map<string, Partial<QuoteResult>>();
  if (!FMP_KEY || symbols.length === 0 || providerFailures.fmp >= CIRCUIT_BREAKER_THRESHOLD) return results;
  
  try {
    const symbolList = symbols.join(',');
    const url = `https://financialmodelingprep.com/api/v3/profile/${encodeURIComponent(symbolList)}?apikey=${encodeURIComponent(FMP_KEY)}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000)
    });
    
    if (!res.ok) {
      providerFailures.fmp++;
      return results;
    }
    
    const data = await res.json();
    if (!Array.isArray(data)) return results;
    
    providerFailures.fmp = 0;
    
    for (const profile of data) {
      results.set(profile.symbol, {
        symbol: profile.symbol,
        name: profile.companyName ?? null,
        market_cap: profile.mktCap ?? profile.marketCap ?? null,
        shares_float: profile.sharesOutstanding ?? null,
        raw: profile
      });
    }
  } catch (err) {
    providerFailures.fmp++;
    console.error('FMP batch fetch error:', err);
  }
  
  return results;
}

// Get symbols for delta mode
async function getDeltaSymbols(): Promise<string[]> {
  const symbols = new Set<string>();
  
  try {
    // 1. Top by volume
    const { data: topVol } = await supabase
      .from("stocks")
      .select("symbol")
      .not("volume", "is", null)
      .order("volume", { ascending: false })
      .limit(Math.floor(TOP_N_DELTA * 0.5));
    
    if (topVol) topVol.forEach(r => symbols.add(r.symbol));
    
    // 2. Most volatile (absolute change)
    const { data: topVolatile } = await supabase
      .from("stocks")
      .select("symbol, change_percent")
      .not("change_percent", "is", null)
      .order("change_percent", { ascending: false })
      .limit(Math.floor(TOP_N_DELTA * 0.3));
    
    if (topVolatile) topVolatile.forEach(r => symbols.add(r.symbol));
    
    // Also get negative movers
    const { data: topNegative } = await supabase
      .from("stocks")
      .select("symbol, change_percent")
      .not("change_percent", "is", null)
      .order("change_percent", { ascending: true })
      .limit(Math.floor(TOP_N_DELTA * 0.2));
    
    if (topNegative) topNegative.forEach(r => symbols.add(r.symbol));
    
    // 3. New symbols not yet in stocks table
    const { data: newSymbols } = await supabase
      .rpc('get_new_symbols', { limit_count: 100 })
      .catch(() => ({ data: null }));
    
    if (newSymbols) {
      newSymbols.forEach((r: any) => symbols.add(r.symbol));
    } else {
      // Fallback: manual query if RPC doesn't exist
      const { data: allTickers } = await supabase
        .from("stock_tickers")
        .select('"Symbol"')
        .limit(100);
      
      const { data: existingStocks } = await supabase
        .from("stocks")
        .select("symbol");
      
      const existingSet = new Set(existingStocks?.map(s => s.symbol) || []);
      allTickers?.forEach((t: any) => {
        if (!existingSet.has(t.Symbol)) {
          symbols.add(t.Symbol);
        }
      });
    }
    
  } catch (err) {
    console.error('Error getting delta symbols:', err);
  }
  
  // Limit to TOP_N_DELTA
  const result = Array.from(symbols).slice(0, TOP_N_DELTA);
  console.log(`Delta mode selected ${result.length} symbols`);
  return result;
}

// Get all symbols for full mode
async function getFullSymbols(): Promise<string[]> {
  try {
    const { data } = await supabase
      .from("stock_tickers")
      .select('"Symbol"');
    
    if (!data) return [];
    
    const symbols = data.map((r: any) => r.Symbol).filter(Boolean);
    console.log(`Full mode: ${symbols.length} total symbols`);
    return symbols;
  } catch (err) {
    console.error('Error getting full symbols:', err);
    return [];
  }
}

// Batch upsert
async function batchUpsert(stocks: QuoteResult[]): Promise<void> {
  if (stocks.length === 0) return;
  
  const rows = stocks.map(s => ({
    symbol: s.symbol,
    name: s.name,
    price: s.price,
    open: s.open ?? null,
    high: s.high ?? null,
    low: s.low ?? null,
    close: null,
    volume: s.volume ?? null,
    change_percent: s.change_percent ?? null,
    market_cap: s.market_cap ?? null,
    shares_float: s.shares_float ?? null,
    relative_volume: s.relative_volume ?? null,
    raw: s.raw ?? null,
    updated_at: new Date().toISOString()
  }));
  
  // Upsert in chunks of 100
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    await supabase.from("stocks").upsert(chunk, { onConflict: "symbol" });
  }
}

// Smart merge
function mergeData(
  yahoo: Partial<QuoteResult> | undefined,
  fmp: Partial<QuoteResult> | undefined
): QuoteResult | null {
  if (!yahoo?.symbol) return null;
  
  return {
    symbol: yahoo.symbol,
    name: yahoo.name ?? fmp?.name ?? null,
    price: yahoo.price ?? null,
    open: yahoo.open ?? null,
    high: yahoo.high ?? null,
    low: yahoo.low ?? null,
    change_percent: yahoo.change_percent ?? null,
    volume: yahoo.volume ?? null,
    market_cap: yahoo.market_cap ?? fmp?.market_cap ?? null,
    shares_float: yahoo.shares_float ?? fmp?.shares_float ?? null,
    relative_volume: yahoo.relative_volume ?? null,
    raw: {
      yahoo: yahoo.raw,
      fmp: fmp?.raw
    }
  };
}

// Process batches with rate limiting
async function processBatches(symbols: string[]): Promise<QuoteResult[]> {
  const results: QuoteResult[] = [];
  const stats = {
    total: symbols.length,
    processed: 0,
    yahoo_calls: 0,
    fmp_calls: 0,
    success: 0,
    failed: 0
  };
  
  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);
    
    console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(symbols.length / BATCH_SIZE)}`);
    
    // Fetch from Yahoo
    const yahooData = await fetchBatchFromYahoo(batch);
    stats.yahoo_calls++;
    
    // Determine which symbols need FMP data
    const needsFMP: string[] = [];
    for (const symbol of batch) {
      const yahoo = yahooData.get(symbol);
      if (yahoo && (!yahoo.market_cap || !yahoo.shares_float)) {
        needsFMP.push(symbol);
      }
    }
    
    // Fetch from FMP only if needed
    const fmpData = needsFMP.length > 0 ? await fetchFundamentalsFromFMP(needsFMP) : new Map();
    if (needsFMP.length > 0) stats.fmp_calls++;
    
    // Merge results
    for (const symbol of batch) {
      const yahoo = yahooData.get(symbol);
      const fmp = fmpData.get(symbol);
      
      if (!yahoo) {
        stats.failed++;
        continue;
      }
      
      const merged = mergeData(yahoo, fmp);
      if (merged && merged.price) {
        results.push(merged);
        stats.success++;
      } else {
        stats.failed++;
      }
    }
    
    stats.processed += batch.length;
    
    // Throttle between batches
    if (i + BATCH_SIZE < symbols.length) {
      await new Promise(resolve => setTimeout(resolve, THROTTLE_MS));
    }
  }
  
  console.log('Processing stats:', stats);
  return results;
}

serve(async (req) => {
  const startTime = Date.now();
  
  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "POST only" }),
        { status: 405, headers: { "Content-Type": "application/json" } }
      );
    }
    
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    
    // Determine mode
    const modeParam = url.searchParams.get("mode") || body.mode;
    const manualSymbols = body.symbols;
    
    let mode: UpdateMode;
    let symbolsToProcess: string[];
    
    if (manualSymbols && Array.isArray(manualSymbols)) {
      mode = 'manual';
      symbolsToProcess = manualSymbols;
    } else if (modeParam === 'full') {
      mode = 'full';
      symbolsToProcess = await getFullSymbols();
    } else if (modeParam === 'delta' || !modeParam) {
      mode = 'delta';
      symbolsToProcess = await getDeltaSymbols();
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid mode. Use 'full', 'delta', or provide 'symbols' array" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    
    console.log(`Starting ${mode} update for ${symbolsToProcess.length} symbols`);
    
    if (symbolsToProcess.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          mode,
          message: "No symbols to process",
          duration_ms: Date.now() - startTime
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    
    // Process all symbols
    const results = await processBatches(symbolsToProcess);
    
    // Batch upsert to database
    if (results.length > 0) {
      await batchUpsert(results);
    }
    
    const duration = Date.now() - startTime;
    
    return new Response(
      JSON.stringify({
        success: true,
        mode,
        requested: symbolsToProcess.length,
        updated: results.length,
        failed: symbolsToProcess.length - results.length,
        duration_ms: duration,
        duration_readable: `${(duration / 1000).toFixed(2)}s`,
        provider_status: {
          yahoo_failures: providerFailures.yahoo,
          fmp_failures: providerFailures.fmp
        },
        stats: {
          avg_time_per_symbol: `${(duration / symbolsToProcess.length).toFixed(0)}ms`,
          batches_processed: Math.ceil(symbolsToProcess.length / BATCH_SIZE)
        }
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
    
  } catch (err) {
    console.error('Update stocks error:', err);
    return new Response(
      JSON.stringify({ 
        error: String(err),
        duration_ms: Date.now() - startTime
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});