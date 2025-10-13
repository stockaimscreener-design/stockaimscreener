// ✅ Supabase Edge Function: batch update stocks using Service Role key (full DB access)
import { serve } from "https://deno.land/std@0.200.0/http/server.ts";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); // ✅ Rollback to Service Role Key
const DATA_KEY = Deno.env.get("DATA_KEY"); // ✅ You already have this
const PROVIDER = (Deno.env.get("DATA_PROVIDER") || "twelvedata").toLowerCase();
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
serve(async ()=>{
  try {
    const { data: symbolsRows, error: sErr } = await supabase.from("stocks").select("symbol").limit(1000);
    if (sErr) throw sErr;
    const symbols = symbolsRows?.map((r)=>r.symbol) || [];
    if (!symbols.length) return new Response("no symbols", {
      status: 200
    });
    const chunkSize = 100;
    for(let i = 0; i < symbols.length; i += chunkSize){
      const chunk = symbols.slice(i, i + chunkSize);
      let respJson = null;
      if (PROVIDER === "twelvedata") {
        const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(chunk.join(","))}&apikey=${DATA_KEY}`;
        respJson = await (await fetch(url)).json();
      } else if (PROVIDER === "finnhub") {
        const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(chunk[0])}&token=${DATA_KEY}`;
        const js = await (await fetch(url)).json();
        respJson = {
          [chunk[0]]: js
        };
      }
      const rowsToUpsert = chunk.map((sym)=>{
        const entry = respJson[sym] ?? respJson;
        if (!entry) return null;
        return {
          symbol: sym,
          name: entry.name ?? null,
          price: parseFloat(entry.price ?? entry.c ?? entry.close ?? 0) || 0,
          open: parseFloat(entry.open ?? entry.o ?? 0) || null,
          high: parseFloat(entry.high ?? entry.h ?? 0) || null,
          low: parseFloat(entry.low ?? entry.l ?? 0) || null,
          close: parseFloat(entry.close ?? entry.c ?? 0) || null,
          volume: parseInt(entry.volume ?? 0) || null,
          change_percent: parseFloat(entry.percent_change ?? 0) || null,
          raw: entry,
          updated_at: new Date().toISOString()
        };
      }).filter(Boolean);
      if (rowsToUpsert.length) {
        const { error } = await supabase.from("stocks").upsert(rowsToUpsert, {
          onConflict: "symbol"
        });
        if (error) console.error("upsert error", error);
      }
    }
    return new Response("ok", {
      status: 200
    });
  } catch (err) {
    console.error(err);
    return new Response("error", {
      status: 500
    });
  }
});
