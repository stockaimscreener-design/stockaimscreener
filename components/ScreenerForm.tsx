'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ScreenerFilters, ScreenerComparison, ScreenerOptions } from '@/lib/supabase'

interface ScreenerFormProps {
  onSubmit: (
    filters: ScreenerFilters,
    comparisons: ScreenerComparison[],
    options: ScreenerOptions
  ) => void
  loading: boolean
}

export default function ScreenerForm({ onSubmit, loading }: ScreenerFormProps) {
  const [filters, setFilters] = useState<ScreenerFilters>({})
  const [comparisons, setComparisons] = useState<ScreenerComparison[]>([])
  const [options, setOptions] = useState<ScreenerOptions>({
    exchange: 'NASDAQ',
    maxSymbols: 100,
    orderBy: 'change_percent',
    limit: 50
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(filters, comparisons, options)
  }

  const updateFilter = (key: keyof ScreenerFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value ? Number(value) : undefined
    }))
  }

  const addComparison = () => {
    setComparisons(prev => [...prev, {
      left: 'volume',
      operator: '>',
      right: 'shares_float'
    }])
  }

  const removeComparison = (index: number) => {
    setComparisons(prev => prev.filter((_, i) => i !== index))
  }

  const updateComparison = (index: number, field: keyof ScreenerComparison, value: string) => {
    setComparisons(prev => prev.map((comp, i) => 
      i === index ? { ...comp, [field]: value } : comp
    ))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">Screening Filters</h2>

      {/* Exchange Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Exchange
        </label>
        <select value={options.exchange ?? 'ALL'}
        onChange={(e) => {
        const value = e.target.value
        setOptions(prev => ({...prev,exchange: value === 'ALL' ? undefined : (value as 'NASDAQ' | 'NYSE')

        }))
      }}

  className="input-field">
          <option value="NASDAQ">NASDAQ</option>
          <option value="NYSE">NYSE</option>
          <option value="ALL">All Exchanges</option>
        </select>
      </div>

      {/* Price Filters */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Price</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Min Price
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              onChange={(e) => updateFilter('price_min', e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Price
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="1000.00"
              onChange={(e) => updateFilter('price_max', e.target.value)}
              className="input-field"
            />
          </div>
        </div>
      </div>

      {/* Change Percentage Filters */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Change %</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Min Change %
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="-10.00"
              onChange={(e) => updateFilter('change_min', e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Change %
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="10.00"
              onChange={(e) => updateFilter('change_max', e.target.value)}
              className="input-field"
            />
          </div>
        </div>
      </div>

      {/* Volume Filters */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Volume</h3>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Min Volume
          </label>
          <input
            type="number"
            placeholder="1000000"
            onChange={(e) => updateFilter('volume_min', e.target.value)}
            className="input-field"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Min Relative Volume
          </label>
          <input
            type="number"
            step="0.01"
            placeholder="1.00"
            onChange={(e) => updateFilter('relative_volume_min', e.target.value)}
            className="input-field"
          />
        </div>
      </div>

      {/* Market Cap Filters */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Market Cap</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Min Market Cap
            </label>
            <input
              type="number"
              placeholder="1000000000"
              onChange={(e) => updateFilter('market_cap_min', e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Market Cap
            </label>
            <input
              type="number"
              placeholder="1000000000000"
              onChange={(e) => updateFilter('market_cap_max', e.target.value)}
              className="input-field"
            />
          </div>
        </div>
      </div>

      {/* Float Filters */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Float</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Min Float
            </label>
            <input
              type="number"
              placeholder="1000000"
              onChange={(e) => updateFilter('float_min', e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Float
            </label>
            <input
              type="number"
              placeholder="1000000000"
              onChange={(e) => updateFilter('float_max', e.target.value)}
              className="input-field"
            />
          </div>
        </div>
      </div>

      {/* Comparisons */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">Comparisons</h3>
          <button
            type="button"
            onClick={addComparison}
            className="btn-secondary text-sm"
          >
            Add Comparison
          </button>
        </div>

        {comparisons.map((comp, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg"
          >
            <select
              value={comp.left}
              onChange={(e) => updateComparison(index, 'left', e.target.value)}
              className="input-field text-sm"
            >
              <option value="volume">Volume</option>
              <option value="shares_float">Shares Float</option>
              <option value="market_cap">Market Cap</option>
              <option value="price">Price</option>
            </select>

            <select
              value={comp.operator}
              onChange={(e) => updateComparison(index, 'operator', e.target.value)}
              className="input-field text-sm"
            >
              <option value=">">&gt;</option>
              <option value="<">&lt;</option>
              <option value="=">=</option>
            </select>

            <select
              value={comp.right}
              onChange={(e) => updateComparison(index, 'right', e.target.value)}
              className="input-field text-sm"
            >
              <option value="shares_float">Shares Float</option>
              <option value="volume">Volume</option>
              <option value="market_cap">Market Cap</option>
              <option value="price">Price</option>
            </select>

            <button
              type="button"
              onClick={() => removeComparison(index)}
              className="text-red-500 hover:text-red-700"
            >
              ×
            </button>
          </motion.div>
        ))}
      </div>

      {/* Options */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Options</h3>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Max Symbols to Check
          </label>
          <input
            type="number"
            min="10"
            max="200"
            value={options.maxSymbols}
            onChange={(e) => setOptions(prev => ({ ...prev, maxSymbols: Number(e.target.value) }))}
            className="input-field"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Order By
          </label>
          <select
            value={options.orderBy}
            onChange={(e) => setOptions(prev => ({ ...prev, orderBy: e.target.value as any }))}
            className="input-field"
          >
            <option value="change_percent">Change %</option>
            <option value="volume">Volume</option>
            <option value="relative_volume">Relative Volume</option>
          </select>
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading}
        className="w-full btn-primary"
      >
        {loading ? 'Screening...' : 'Screen Stocks'}
      </button>
    </form>
  )
}

