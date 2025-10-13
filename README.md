# StockAimScreener

A comprehensive stock screening platform for NASDAQ and NYSE markets with real-time data and advanced filtering capabilities.

## Features

### 🏠 Dashboard
- Top 50 NASDAQ stocks by volume
- Real-time market overview (S&P 500, NASDAQ)
- Stock search functionality
- Quick access to screening tools

### 🔍 Advanced Screener
- Filter by price, volume, market cap, shares float
- Change percentage filters
- Relative volume analysis
- Custom comparisons between metrics
- Support for NASDAQ, NYSE, or all exchanges
- Real-time data from multiple providers (Finnhub, Twelve Data)

### 📊 Data Sources
- NASDAQ and NYSE stock database (4,428+ stocks)
- Real-time price and volume data
- Market cap and float information
- Excludes ETFs, derivatives, test issues, and preferred stocks

### 🎨 Modern UI
- Built with Next.js 14 and React 18
- Framer Motion animations
- Tailwind CSS styling
- Responsive design
- Dark/light mode ready

## Tech Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety and better DX
- **Tailwind CSS** - Utility-first CSS framework
- **Framer Motion** - Smooth animations
- **Supabase JS** - Database client

### Backend
- **Supabase** - Backend as a Service
- **Supabase Edge Functions** - Serverless functions (Deno)
- **PostgreSQL** - Database with real-time capabilities

### Data Providers
- **Finnhub API** - Real-time stock data
- **Twelve Data API** - Alternative data source
- **Yahoo Finance** - Market data (planned)

## Database Schema

### stocks table
```sql
create table public.stocks (
  symbol text not null,
  name text null,
  price numeric null,
  open numeric null,
  high numeric null,
  low numeric null,
  close numeric null,
  volume bigint null,
  change_percent numeric null,
  raw jsonb null,
  updated_at timestamp with time zone null default now(),
  float_shares bigint null,
  market_cap numeric null,
  premarket_change numeric null,
  postmarket_change numeric null,
  day_volume bigint null,
  shares_float bigint null,
  constraint stocks_pkey primary key (symbol)
);
```

### stock_tickers table
```sql
create table public.stock_tickers (
  "Symbol" text not null,
  "Company Name" text null,
  "Security Name" text null,
  "Market Category" text null,
  "Test Issue" text null,
  "Financial Status" text null,
  "Round Lot Size" bigint null,
  "ETF" text null,
  "NextShares" text null,
  exchange public.exchange_type null default 'NASDAQ'::exchange_type,
  constraint nasdaq_tickers_pkey primary key ("Symbol")
);
```

## Setup Instructions

### Prerequisites
- Node.js 18+ 
- Deno (for Supabase Edge Functions)
- Supabase account
- API keys for data providers

### 1. Clone and Install Dependencies
```bash
git clone <repository-url>
cd StockAimScreener
npm install
```

### 2. Environment Variables
Create a `.env.local` file in the root directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Data Provider API Keys
FINNHUB_API_KEY=your_finnhub_key_here
TWELVEDATA_API_KEY=your_twelvedata_key_here
```

### 3. Supabase Setup
```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Start local development (optional)
supabase start
```

### 4. Database Setup
1. Create the tables using the SQL schema above
2. Upload your stock_tickers data from DataHub.io
3. Set up Row Level Security (RLS) policies

### 5. Deploy Edge Functions
```bash
# Deploy the screener function
supabase functions deploy screener

# Deploy the update-stocks function
supabase functions deploy update-stocks
```

### 6. Run Development Server
```bash
npm run dev
```

Visit `http://localhost:3000` to see the application.

## Local Development

### Frontend Development
```bash
npm run dev          # Start Next.js dev server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

### Supabase Edge Functions
```bash
# Test screener function locally
cd supabase/screener
deno run --allow-net --allow-env index.ts

# Test with custom environment
deno run --allow-net --allow-env test-local.ts
```

### Database Management
```bash
supabase db reset    # Reset local database
supabase db push     # Push migrations
supabase db pull     # Pull schema changes
```

## Deployment

### Frontend (Netlify/Vercel)
1. Connect your repository
2. Set environment variables
3. Deploy automatically on push

### Backend (Supabase)
1. Deploy Edge Functions
2. Configure production environment variables
3. Set up database backups

## API Usage

### Screener Endpoint
```javascript
const response = await fetch('/api/screener', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    filters: {
      price_min: 10,
      price_max: 100,
      volume_min: 1000000
    },
    options: {
      exchange: 'NASDAQ',
      maxSymbols: 100,
      orderBy: 'change_percent'
    }
  })
})
```

## Future Enhancements

### Phase 2 Features
- **Charts Integration** - TradingView charts
- **User Authentication** - Google OAuth, email verification
- **Subscription Plans** - Free, Pro, Premium tiers
- **Email Alerts** - Custom notification system
- **API Access** - RESTful API for developers

### Phase 3 Features
- **Advanced Analytics** - Technical indicators
- **Portfolio Tracking** - Watchlists and portfolios
- **Social Features** - Share screens, community
- **Mobile App** - React Native application

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support, email stockaimscreener@gmail.com or create an issue on GitHub.

---

**Built with ❤️ by IndiaAITech**

