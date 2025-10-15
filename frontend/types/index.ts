export interface MarketData {
  symbol: string
  name: string
  price: number
  change_percent: number
  volume: number
  market_cap: number | null
  shares_float: number | null
  relative_volume: number | null
}

export interface ScreenerResult {
  success: boolean
  count: number
  total_matched: number
  total_checked: number
  results: MarketData[]
  stats: {
    symbols_checked: number
    symbols_with_data: number
    symbols_matched: number
    api_calls_used: number
    duration_seconds: number
  }
}

export interface NavigationItem {
  name: string
  href: string
  current?: boolean
}

export interface TopStock {
  symbol: string
  name: string
  price: number
  change_percent: number
  volume: number
  market_cap: number | null
}

export interface MarketSummary {
  sp500: {
    price: number
    change: number
    changePercent: number
  }
  nasdaq: {
    price: number
    change: number
    changePercent: number
  }
}

