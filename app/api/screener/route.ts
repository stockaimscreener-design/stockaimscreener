import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
     // Use ANON key instead of SERVICE_ROLE key for local development
     const authKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
     console.log('Environment check:')
     console.log('SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
     console.log('ANON_KEY exists:', !!authKey)
     
     if (!authKey) {
       throw new Error('SUPABASE_ANON_KEY is not set')
     }
     
     const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/screener`
     console.log('Calling URL:', url)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authKey}`,
      },
      body: JSON.stringify(body),
    })

    console.log('Response status:', response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Edge function error response:', errorText)
      throw new Error(`Edge function error: ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
    
  } catch (error) {
    console.error('Screener API error:', error)
    return NextResponse.json(
      { error: 'Failed to process screener request' },
      { status: 500 }
    )
  }
}