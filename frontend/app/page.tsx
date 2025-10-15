'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase, Stock } from '@/lib/supabase'
import { TopStock, MarketSummary } from '@/types'
import SearchBar from '@/components/SearchBar'
import MarketOverview from '@/components/MarketOverview'
import TopStocksTable from '@/components/TopStocksTable'
import LoadingSpinner from '@/components/LoadingSpinner'

export default function Dashboard() {
  const [topStocks, setTopStocks] = useState<TopStock[]>([])
  const [marketSummary, setMarketSummary] = useState<MarketSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSearchMode, setIsSearchMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch top 50 NASDAQ stocks by volume
      const { data: stocks, error: stocksError } = await supabase
        .from('stocks')
        .select('*')
        .not('price', 'is', null)
        .not('volume', 'is', null)
        .order('volume', { ascending: false })
        .limit(50)

      if (stocksError) throw stocksError

      // Transform data for display
      const transformedStocks: TopStock[] = stocks?.map(stock => ({
        symbol: stock.symbol,
        name: stock.name || stock.symbol,
        price: stock.price || 0,
        change_percent: stock.change_percent || 0,
        volume: stock.volume || 0,
        market_cap: stock.market_cap
      })) || []

      setTopStocks(transformedStocks)

      // Mock market summary (in real app, fetch from API)
      setMarketSummary({
        sp500: {
          price: 4567.89,
          change: 23.45,
          changePercent: 0.52
        },
        nasdaq: {
          price: 14321.76,
          change: -67.89,
          changePercent: -0.47
        }
      })

    } catch (err) {
      console.error('Error fetching dashboard data:', err)
      setError('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price)
  }

  const formatVolume = (volume: number) => {
    if (volume >= 1e9) {
      return `${(volume / 1e9).toFixed(1)}B`
    } else if (volume >= 1e6) {
      return `${(volume / 1e6).toFixed(1)}M`
    } else if (volume >= 1e3) {
      return `${(volume / 1e3).toFixed(1)}K`
    }
    return volume.toString()
  }

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      // If empty query, go back to top stocks
      setIsSearchMode(false)
      setSearchQuery('')
      fetchDashboardData()
      return
    }

    try {
      setLoading(true)
      setError(null)
      setIsSearchMode(true)
      setSearchQuery(query)
      
      // Search in both stocks and stock_tickers tables
      const [stocksResult, tickersResult] = await Promise.all([
        supabase
          .from('stocks')
          .select('*')
          .or(`symbol.ilike.%${query}%,name.ilike.%${query}%`)
          .not('price', 'is', null)
          .limit(20),
        supabase
          .from('stock_tickers')
          .select('*')
          .or(`"Symbol".ilike.%${query}%,"Company Name".ilike.%${query}%`)
          .limit(20)
      ])

      if (stocksResult.error) throw stocksResult.error
      if (tickersResult.error) throw tickersResult.error

      // Combine results from both tables
      const searchResults: TopStock[] = []
      
      // Add stocks with price data
      stocksResult.data?.forEach(stock => {
        searchResults.push({
          symbol: stock.symbol,
          name: stock.name || stock.symbol,
          price: stock.price || 0,
          change_percent: stock.change_percent || 0,
          volume: stock.volume || 0,
          market_cap: stock.market_cap
        })
      })

      // Add/enrich tickers that don't have price data yet via local /api/quote fallback
      const missing = (tickersResult.data || []).filter(t => !searchResults.find(s => s.symbol === t.Symbol))
      if (missing.length > 0) {
        const enriched: TopStock[] = []
        for (const t of missing) {
          try {
            const resp = await fetch(`/api/quote?symbol=${encodeURIComponent(t.Symbol)}`)
            if (resp.ok) {
              const { quote } = await resp.json()
              enriched.push({
                symbol: quote.symbol,
                name: quote.name || t['Company Name'] || t.Symbol,
                price: quote.price || 0,
                change_percent: quote.change_percent || 0,
                volume: quote.volume || 0,
                market_cap: quote.market_cap || null,
              })
            } else {
              enriched.push({
                symbol: t.Symbol,
                name: t['Company Name'] || t.Symbol,
                price: 0,
                change_percent: 0,
                volume: 0,
                market_cap: null,
              })
            }
          } catch {
            enriched.push({
              symbol: t.Symbol,
              name: t['Company Name'] || t.Symbol,
              price: 0,
              change_percent: 0,
              volume: 0,
              market_cap: null,
            })
          }
        }
        searchResults.push(...enriched)
      }

      setTopStocks(searchResults)
    } catch (err) {
      console.error('Search error:', err)
      setError('Search failed')
    } finally {
      setLoading(false)
    }
  }

  if (loading && topStocks.length === 0) {
    return <LoadingSpinner />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl font-bold mb-4">
              StockAim Screener
            </h1>
            <p className="text-xl text-primary-100 mb-8">
              Advanced stock screening for NASDAQ and NYSE markets with real-time data
            </p>
            
            {/* Search Bar */}
            <div className="max-w-2xl">
              <SearchBar onSearch={handleSearch} />
            </div>
          </motion.div>
        </div>
      </div>

      {/* Market Overview */}
      {marketSummary && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-10">
          <MarketOverview data={marketSummary} />
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6"
          >
            {error}
          </motion.div>
        )}

        {/* Top Stocks / Search Results Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="card"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {isSearchMode ? `Search Results for "${searchQuery}"` : 'Top Stocks'}
            </h2>
            <div className="flex space-x-2">
              {isSearchMode && (
                <button
                  onClick={() => {
                    setIsSearchMode(false)
                    setSearchQuery('')
                    fetchDashboardData()
                  }}
                  className="btn-secondary text-sm"
                >
                  Back to Top Stocks
                </button>
              )}
              <button
                onClick={fetchDashboardData}
                className="btn-secondary text-sm"
                disabled={loading}
              >
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
              <button
                onClick={() => {
                  // Export functionality will be handled by TopStocksTable
                  const event = new CustomEvent('exportCSV')
                  window.dispatchEvent(event)
                }}
                className="btn-primary text-sm"
                disabled={topStocks.length === 0}
              >
                Export CSV
              </button>
            </div>
          </div>

          <TopStocksTable 
            stocks={topStocks} 
            loading={loading}
          />
        </motion.div>

        {/* Market Sections */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
          {/* Top Gainers */}
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Top Gainers</h3>
              <button
                onClick={() => {
                  const topGainers = [...topStocks]
                    .filter(stock => stock.change_percent > 0)
                    .sort((a, b) => b.change_percent - a.change_percent)
                  setTopStocks(topGainers)
                  setIsSearchMode(true)
                  setSearchQuery('Top Gainers')
                }}
                className="btn-secondary text-sm"
              >
                View All
              </button>
            </div>
            <div className="space-y-2">
              {topStocks
                .filter(stock => stock.change_percent > 0)
                .sort((a, b) => b.change_percent - a.change_percent)
                .slice(0, 5)
                .map((stock, index) => (
                  <div key={stock.symbol} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                    <div>
                      <div className="font-medium text-sm">{stock.symbol}</div>
                      <div className="text-xs text-gray-500">{stock.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-success">+{stock.change_percent.toFixed(2)}%</div>
                      <div className="text-xs text-gray-500">{formatPrice(stock.price)}</div>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Top Losers */}
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Top Losers</h3>
              <button
                onClick={() => {
                  const topLosers = [...topStocks]
                    .filter(stock => stock.change_percent < 0)
                    .sort((a, b) => a.change_percent - b.change_percent)
                  setTopStocks(topLosers)
                  setIsSearchMode(true)
                  setSearchQuery('Top Losers')
                }}
                className="btn-secondary text-sm"
              >
                View All
              </button>
            </div>
            <div className="space-y-2">
              {topStocks
                .filter(stock => stock.change_percent < 0)
                .sort((a, b) => a.change_percent - b.change_percent)
                .slice(0, 5)
                .map((stock, index) => (
                  <div key={stock.symbol} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                    <div>
                      <div className="font-medium text-sm">{stock.symbol}</div>
                      <div className="text-xs text-gray-500">{stock.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-danger">{stock.change_percent.toFixed(2)}%</div>
                      <div className="text-xs text-gray-500">{formatPrice(stock.price)}</div>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Unusual Volume */}
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Unusual Volume</h3>
              <button
                onClick={() => {
                  const unusualVolume = [...topStocks]
                    .sort((a, b) => b.volume - a.volume)
                  setTopStocks(unusualVolume)
                  setIsSearchMode(true)
                  setSearchQuery('Unusual Volume')
                }}
                className="btn-secondary text-sm"
              >
                View All
              </button>
            </div>
            <div className="space-y-2">
              {topStocks
                .sort((a, b) => b.volume - a.volume)
                .slice(0, 5)
                .map((stock, index) => (
                  <div key={stock.symbol} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                    <div>
                      <div className="font-medium text-sm">{stock.symbol}</div>
                      <div className="text-xs text-gray-500">{stock.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900">{formatVolume(stock.volume)}</div>
                      <div className="text-xs text-gray-500">{formatPrice(stock.price)}</div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          <div className="card text-center">
            <h3 className="text-lg font-semibold mb-2">Advanced Screener</h3>
            <p className="text-gray-600 mb-4">
              Filter stocks by price, volume, market cap, and more
            </p>
            <a href="/screener" className="btn-primary">
              Start Screening
            </a>
          </div>

          <div className="card text-center">
            <h3 className="text-lg font-semibold mb-2">Market Charts</h3>
            <p className="text-gray-600 mb-4">
              Interactive charts and technical analysis tools
            </p>
            <a href="/charts" className="btn-primary">
              View Charts
            </a>
          </div>

          <div className="card text-center">
            <h3 className="text-lg font-semibold mb-2">Get Started</h3>
            <p className="text-gray-600 mb-4">
              Sign up for advanced features and alerts
            </p>
            <a href="/signin" className="btn-primary">
              Sign Up Free
            </a>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

