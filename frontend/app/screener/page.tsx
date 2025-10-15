'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ScreenerFilters, ScreenerComparison, ScreenerOptions } from '@/lib/supabase'
import { MarketData, ScreenerResult } from '@/types'
import ScreenerForm from '@/components/ScreenerForm'
import ScreenerResults from '@/components/ScreenerResults'
import LoadingSpinner from '@/components/LoadingSpinner'

export default function ScreenerPage() {
  const [results, setResults] = useState<ScreenerResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleScreening = async (
    filters: ScreenerFilters,
    comparisons: ScreenerComparison[],
    options: ScreenerOptions
  ) => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/screener', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filters,
          comparisons,
          options
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data: ScreenerResult = await response.json()
      setResults(data)
    } catch (err) {
      console.error('Screening error:', err)
      setError(err instanceof Error ? err.message : 'Screening failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Advanced Stock Screener
            </h1>
            <p className="text-lg text-gray-600">
              Filter NASDAQ and NYSE stocks by price, volume, market cap, and more
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Screener Form */}
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="card sticky top-24"
            >
              <ScreenerForm onSubmit={handleScreening} loading={loading} />
            </motion.div>
          </div>

          {/* Results */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              {loading && (
                <div className="card">
                  <LoadingSpinner text="Screening stocks..." />
                </div>
              )}

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="card bg-red-50 border-red-200"
                >
                  <div className="flex items-center">
                    <svg
                      className="h-5 w-5 text-red-400 mr-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                      />
                    </svg>
                    <div>
                      <h3 className="text-sm font-medium text-red-800">
                        Error
                      </h3>
                      <p className="text-sm text-red-700 mt-1">
                        {error}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {results && !loading && (
                <ScreenerResults results={results} />
              )}

              {!results && !loading && !error && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  className="card text-center py-12"
                >
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400 mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Ready to Screen Stocks
                  </h3>
                  <p className="text-gray-600">
                    Use the filters on the left to find stocks that match your criteria.
                  </p>
                </motion.div>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}

