import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import yf from 'yahoo-finance2'

type QuoteResult = {
  symbol: string
  name: string | null
  price: number | null
  change_percent: number | null
  volume: number | null
  market_cap: number | null
  shares_float: number | null
  relative_volume: number | null
}

async function fetchFromTwelveData(symbol: string, apiKey?: string): Promise<QuoteResult | null> {
  if (!apiKey) return null
  try {
    const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(apiKey)}`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    if (!data || data.code || data.status === 'error') return null

    const price = data?.price != null ? Number(data.price) : null
    const prevClose = data?.previous_close != null ? Number(data.previous_close) : null
    const changePercent = price != null && prevClose != null && prevClose !== 0
      ? Number((((price - prevClose) / prevClose) * 100).toFixed(4))
      : (data?.percent_change != null ? Number(data.percent_change) : null)

    const volume = data?.volume != null ? Number(data.volume) : null
    const marketCap = data?.market_cap != null ? Number(data.market_cap) : null

    return {
      symbol,
      name: data?.name ?? null,
      price,
      change_percent: changePercent,
      volume,
      market_cap: marketCap,
      shares_float: null,
      relative_volume: null,
    }
  } catch {
    return null
  }
}

async function fetchFromYahoo(symbol: string): Promise<QuoteResult | null> {
  try {
    const q = await yf.quote(symbol)
    if (!q) return null
    const price = q.regularMarketPrice != null ? Number(q.regularMarketPrice) : null
    const prevClose = q.regularMarketPreviousClose != null ? Number(q.regularMarketPreviousClose) : null
    const changePercent = price != null && prevClose != null && prevClose !== 0
      ? Number((((price - prevClose) / prevClose) * 100).toFixed(4))
      : (q.regularMarketChangePercent != null ? Number(q.regularMarketChangePercent) : null)

    const volume = q.regularMarketVolume != null ? Number(q.regularMarketVolume) : null
    const marketCap = q.marketCap != null ? Number(q.marketCap) : null

    return {
      symbol: q.symbol || symbol,
      name: (q.longName || q.shortName || null) as string | null,
      price,
      change_percent: changePercent,
      volume,
      market_cap: marketCap,
      shares_float: null,
      relative_volume: null,
    }
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const symbol = (searchParams.get('symbol') || '').trim().toUpperCase()
    if (!symbol) return NextResponse.json({ error: 'Missing symbol' }, { status: 400 })

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceRole) {
      return NextResponse.json({ error: 'Server not configured for upsert' }, { status: 500 })
    }
    const admin = createClient(supabaseUrl, serviceRole)

    // 1) Try TwelveData
    const twelveKey = process.env.TWELVEDATA_API_KEY
    let result: QuoteResult | null = await fetchFromTwelveData(symbol, twelveKey)

    // 2) Fallback Yahoo
    if (!result || result.price == null || result.price === 0) {
      result = await fetchFromYahoo(symbol)
    }

    if (!result || result.price == null || result.price === 0) {
      return NextResponse.json({ error: 'No quote available from fallbacks' }, { status: 404 })
    }

    // Upsert into stocks
    await admin.from('stocks').upsert({
      symbol: result.symbol,
      name: result.name,
      price: result.price,
      change_percent: result.change_percent,
      volume: result.volume,
      market_cap: result.market_cap,
      shares_float: result.shares_float,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'symbol' })

    return NextResponse.json({ success: true, quote: result })
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 })
  }
}


