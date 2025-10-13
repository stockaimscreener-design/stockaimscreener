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

  const handleSearch = async (query: string) => {
    if (!query.trim()) return

    try {
      setLoading(true)
      
      // Search in stocks table
      const { data, error } = await supabase
        .from('stocks')
        .select('*')
        .or(`symbol.ilike.%${query}%,name.ilike.%${query}%`)
        .not('price', 'is', null)
        .limit(20)

      if (error) throw error

      const searchResults: TopStock[] = data?.map(stock => ({
        symbol: stock.symbol,
        name: stock.name || stock.symbol,
        price: stock.price || 0,
        change_percent: stock.change_percent || 0,
        volume: stock.volume || 0,
        market_cap: stock.market_cap
      })) || []

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

        {/* Top Stocks Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="card"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              Top Stocks
            </h2>
            <button
              onClick={fetchDashboardData}
              className="btn-secondary text-sm"
              disabled={loading}
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          <TopStocksTable 
            stocks={topStocks} 
            loading={loading}
          />
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
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

