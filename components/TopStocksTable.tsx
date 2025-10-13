'use client'

import { motion } from 'framer-motion'
import { TopStock } from '@/types'
import { useState, useEffect } from 'react'

interface TopStocksTableProps {
  stocks: TopStock[]
  loading: boolean
}

type SortField = 'symbol' | 'name' | 'price' | 'change_percent' | 'volume' | 'market_cap'
type SortDirection = 'asc' | 'desc'

export default function TopStocksTable({ stocks, loading }: TopStocksTableProps) {
  const [sortField, setSortField] = useState<SortField>('volume')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  useEffect(() => {
    const handleExportCSV = () => {
      exportToCSV()
    }

    window.addEventListener('exportCSV', handleExportCSV)
    return () => window.removeEventListener('exportCSV', handleExportCSV)
  }, [])

  const exportToCSV = () => {
    if (stocks.length === 0) return

    const headers = ['Symbol', 'Company', 'Price', 'Change %', 'Volume', 'Market Cap']
    const csvContent = [
      headers.join(','),
      ...sortedStocks.map(stock => [
        stock.symbol,
        `"${stock.name}"`,
        stock.price,
        stock.change_percent,
        stock.volume,
        stock.market_cap || 'N/A'
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `stocks_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const sortedStocks = [...stocks].sort((a, b) => {
    let aValue: any = a[sortField]
    let bValue: any = b[sortField]

    // Handle null/undefined values
    if (aValue === null || aValue === undefined) aValue = 0
    if (bValue === null || bValue === undefined) bValue = 0

    // Handle string comparison
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue)
    }

    // Handle numeric comparison
    const result = aValue - bValue
    return sortDirection === 'asc' ? result : -result
  })

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

  const formatMarketCap = (marketCap: number | null) => {
    if (!marketCap) return 'N/A'
    
    if (marketCap >= 1e12) {
      return `$${(marketCap / 1e12).toFixed(1)}T`
    } else if (marketCap >= 1e9) {
      return `$${(marketCap / 1e9).toFixed(1)}B`
    } else if (marketCap >= 1e6) {
      return `$${(marketCap / 1e6).toFixed(1)}M`
    }
    return `$${marketCap.toFixed(0)}`
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="loading-spinner" />
      </div>
    )
  }

  if (stocks.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No stocks found</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th 
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              onClick={() => handleSort('symbol')}
            >
              <div className="flex items-center space-x-1">
                <span>Symbol</span>
                {sortField === 'symbol' && (
                  <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </div>
            </th>
            <th 
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              onClick={() => handleSort('name')}
            >
              <div className="flex items-center space-x-1">
                <span>Company</span>
                {sortField === 'name' && (
                  <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </div>
            </th>
            <th 
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              onClick={() => handleSort('price')}
            >
              <div className="flex items-center space-x-1">
                <span>Price</span>
                {sortField === 'price' && (
                  <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </div>
            </th>
            <th 
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              onClick={() => handleSort('change_percent')}
            >
              <div className="flex items-center space-x-1">
                <span>Change</span>
                {sortField === 'change_percent' && (
                  <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </div>
            </th>
            <th 
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              onClick={() => handleSort('volume')}
            >
              <div className="flex items-center space-x-1">
                <span>Volume</span>
                {sortField === 'volume' && (
                  <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </div>
            </th>
            <th 
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              onClick={() => handleSort('market_cap')}
            >
              <div className="flex items-center space-x-1">
                <span>Market Cap</span>
                {sortField === 'market_cap' && (
                  <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </div>
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {sortedStocks.map((stock, index) => (
            <motion.tr
              key={stock.symbol}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className="hover:bg-gray-50 cursor-pointer"
            >
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">
                  {stock.symbol}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-900 truncate max-w-xs">
                  {stock.name}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">
                  {formatPrice(stock.price)}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`text-sm font-medium ${
                  stock.change_percent >= 0 ? 'text-success' : 'text-danger'
                }`}>
                  {stock.change_percent >= 0 ? '+' : ''}{stock.change_percent.toFixed(2)}%
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-900">
                  {formatVolume(stock.volume)}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-900">
                  {formatMarketCap(stock.market_cap)}
                </div>
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

