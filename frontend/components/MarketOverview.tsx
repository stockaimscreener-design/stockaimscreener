'use client'

import { motion } from 'framer-motion'
import { MarketSummary } from '@/types'

interface MarketOverviewProps {
  data: MarketSummary
}

export default function MarketOverview({ data }: MarketOverviewProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price)
  }

  const formatChange = (change: number) => {
    return change >= 0 ? `+${change.toFixed(2)}` : change.toFixed(2)
  }

  const formatChangePercent = (percent: number) => {
    return percent >= 0 ? `+${percent.toFixed(2)}%` : `${percent.toFixed(2)}%`
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="bg-white rounded-lg shadow-lg p-6"
    >
      <h2 className="text-xl font-bold text-gray-900 mb-6">Market Overview</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* S&P 500 */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-semibold text-gray-900">S&P 500</h3>
            <span className="text-sm text-gray-500">SPX</span>
          </div>
          <div className="flex justify-between items-center">
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {formatPrice(data.sp500.price)}
              </div>
              <div className="flex items-center space-x-2">
                <span className={`text-sm font-medium ${
                  data.sp500.change >= 0 ? 'text-success' : 'text-danger'
                }`}>
                  {formatChange(data.sp500.change)}
                </span>
                <span className={`text-sm font-medium ${
                  data.sp500.change >= 0 ? 'text-success' : 'text-danger'
                }`}>
                  ({formatChangePercent(data.sp500.changePercent)})
                </span>
              </div>
            </div>
            <div className={`w-3 h-3 rounded-full ${
              data.sp500.change >= 0 ? 'bg-success' : 'bg-danger'
            }`} />
          </div>
        </div>

        {/* NASDAQ */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-semibold text-gray-900">NASDAQ</h3>
            <span className="text-sm text-gray-500">IXIC</span>
          </div>
          <div className="flex justify-between items-center">
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {formatPrice(data.nasdaq.price)}
              </div>
              <div className="flex items-center space-x-2">
                <span className={`text-sm font-medium ${
                  data.nasdaq.change >= 0 ? 'text-success' : 'text-danger'
                }`}>
                  {formatChange(data.nasdaq.change)}
                </span>
                <span className={`text-sm font-medium ${
                  data.nasdaq.change >= 0 ? 'text-success' : 'text-danger'
                }`}>
                  ({formatChangePercent(data.nasdaq.changePercent)})
                </span>
              </div>
            </div>
            <div className={`w-3 h-3 rounded-full ${
              data.nasdaq.change >= 0 ? 'bg-success' : 'bg-danger'
            }`} />
          </div>
        </div>
      </div>

      {/* Market Status */}
      <div className="mt-6 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
          <span className="text-sm text-gray-600">Market Open</span>
        </div>
      </div>
    </motion.div>
  )
}

