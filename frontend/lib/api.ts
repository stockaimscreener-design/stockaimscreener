// frontend/lib/api.ts
import { createClient } from '@supabase/supabase-js'

export type QuoteResult = {
  symbol: string
  name: string | null
  price: number | null
  change_percent: number | null
  volume: number | null
  market_cap: number | null
  shares_float: number | null
  relative_volume: number | null
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type UpdateStocksResponse = {
  success: boolean
  updatedStocks: QuoteResult[]
  error?: string
}

/**
 * Call Supabase Edge Function to update stock prices
 */
export async function updateStocks(symbols: string[]): Promise<UpdateStocksResponse> {
  const url = process.env.NEXT_PUBLIC_SUPASBASE_DBOARD_URL
  if (!url) throw new Error('Update-stocks URL not set')

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbols })
  })

  const data: UpdateStocksResponse = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to update stocks')

  return data
}

/**
 * Fetch stocks from Supabase using ANON key (RLS enforced)
 */
export async function fetchStocks(symbols: string[]): Promise<QuoteResult[]> {
  const { data, error } = await supabase
    .from<QuoteResult>('stocks')
    .select('*')
    .in('symbol', symbols)

  if (error) throw error
  return data || []
}
