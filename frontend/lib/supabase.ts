import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types
export interface Stock {
  symbol: string
  name: string | null
  price: number | null
  open: number | null
  high: number | null
  low: number | null
  close: number | null
  volume: number | null
  change_percent: number | null
  raw: any | null
  updated_at: string | null
  float_shares: number | null
  market_cap: number | null
  premarket_change: number | null
  postmarket_change: number | null
  day_volume: number | null
  shares_float: number | null
}

export interface StockTicker {
  Symbol: string
  'Company Name': string | null
  'Security Name': string | null
  'Market Category': string | null
  'Test Issue': string | null
  'Financial Status': string | null
  'Round Lot Size': number | null
  'ETF': string | null
  'NextShares': string | null
  exchange: 'NASDAQ' | 'NYSE'
}

export interface ScreenerFilters {
  price_min?: number
  price_max?: number
  change_min?: number
  change_max?: number
  volume_min?: number
  market_cap_min?: number
  market_cap_max?: number
  float_min?: number
  float_max?: number
  relative_volume_min?: number
}

export interface ScreenerComparison {
  left: string
  operator: '>' | '<' | '='
  right: string
}

export interface ScreenerOptions {
  exchange?: 'NASDAQ' | 'NYSE'   // ✅ add this line
  maxSymbols?: number
  orderBy?: 'change_percent' | 'volume' | 'relative_volume'
  offset?: number
  limit?: number
}

