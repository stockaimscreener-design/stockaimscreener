


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."exchange_type" AS ENUM (
    'NASDAQ',
    'NYSE'
);


ALTER TYPE "public"."exchange_type" OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."stock_tickers" (
    "Symbol" "text" NOT NULL,
    "Company Name" "text",
    "Security Name" "text",
    "Market Category" "text",
    "Test Issue" "text",
    "Financial Status" "text",
    "Round Lot Size" bigint,
    "ETF" "text",
    "NextShares" "text",
    "exchange" "public"."exchange_type" DEFAULT 'NASDAQ'::"public"."exchange_type"
);


ALTER TABLE "public"."stock_tickers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stocks" (
    "symbol" "text" NOT NULL,
    "name" "text",
    "price" numeric,
    "open" numeric,
    "high" numeric,
    "low" numeric,
    "close" numeric,
    "volume" bigint,
    "change_percent" numeric,
    "raw" "jsonb",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "float_shares" bigint,
    "market_cap" numeric,
    "premarket_change" numeric,
    "postmarket_change" numeric,
    "day_volume" bigint,
    "shares_float" bigint
);


ALTER TABLE "public"."stocks" OWNER TO "postgres";


ALTER TABLE ONLY "public"."stock_tickers"
    ADD CONSTRAINT "nasdaq_tickers_pkey" PRIMARY KEY ("Symbol");



ALTER TABLE ONLY "public"."stocks"
    ADD CONSTRAINT "stocks_pkey" PRIMARY KEY ("symbol");



CREATE POLICY "public_select" ON "public"."stocks" FOR SELECT USING (true);



ALTER TABLE "public"."stock_tickers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stocks" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";








































































































































































GRANT ALL ON TABLE "public"."stock_tickers" TO "anon";
GRANT ALL ON TABLE "public"."stock_tickers" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_tickers" TO "service_role";



GRANT ALL ON TABLE "public"."stocks" TO "anon";
GRANT ALL ON TABLE "public"."stocks" TO "authenticated";
GRANT ALL ON TABLE "public"."stocks" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































RESET ALL;
