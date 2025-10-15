import { updateStocks, fetchStocks, QuoteResult } from '@/lib/api'

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  try {
    setLoading(true)
    const symbols = getFilteredSymbols(filters) // implement based on your filter
    // 1️⃣ Call Edge Function to update stock prices
    await updateStocks(symbols)

    // 2️⃣ Fetch updated stocks from Supabase using ANON key
    const updatedData: QuoteResult[] = await fetchStocks(symbols)
    setScreenerResults(updatedData)
  } catch (err: any) {
    console.error(err)
    setError(err.message || 'Error updating stocks')
  } finally {
    setLoading(false)
  }
}
