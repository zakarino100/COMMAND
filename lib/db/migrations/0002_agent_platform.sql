CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  brand_id UUID NOT NULL,
  mode TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  avatar_url TEXT,
  channels JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE agent_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  variant_name TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  greeting_message TEXT NOT NULL,
  address_validation_instructions TEXT,
  closing_instructions TEXT,
  objection_handling TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  is_control BOOLEAN NOT NULL DEFAULT false,
  total_conversations INTEGER NOT NULL DEFAULT 0,
  successful_conversions INTEGER NOT NULL DEFAULT 0,
  conversion_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
  test_start_date TIMESTAMP WITH TIME ZONE,
  test_end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(agent_id, variant_name)
);

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL,
  phone TEXT,
  email TEXT,
  name TEXT,
  street_number TEXT,
  street_name TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  in_service_area BOOLEAN,
  status TEXT NOT NULL DEFAULT 'new',
  visit_count INTEGER NOT NULL DEFAULT 0,
  chat_count INTEGER NOT NULL DEFAULT 0,
  quote_count INTEGER NOT NULL DEFAULT 0,
  booking_count INTEGER NOT NULL DEFAULT 0,
  last_interaction TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(brand_id, phone)
);

CREATE INDEX customers_brand_id_idx ON customers(brand_id);
CREATE INDEX customers_phone_idx ON customers(phone);
CREATE INDEX customers_address_idx ON customers(city, street_name);

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  brand_id UUID NOT NULL,
  customer_id UUID,
  channel TEXT NOT NULL,
  variant_id UUID,
  messages JSONB NOT NULL DEFAULT '[]',
  outcome TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX conversations_agent_id_idx ON conversations(agent_id);
CREATE INDEX conversations_customer_id_idx ON conversations(customer_id);
CREATE INDEX conversations_variant_id_idx ON conversations(variant_id);

CREATE TABLE ab_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  control_variant_id UUID,
  challenger_variant_id UUID,
  control_conversations INTEGER NOT NULL DEFAULT 0,
  control_conversions INTEGER NOT NULL DEFAULT 0,
  control_conversion_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
  challenger_conversations INTEGER NOT NULL DEFAULT 0,
  challenger_conversions INTEGER NOT NULL DEFAULT 0,
  challenger_conversion_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
  uplift_percentage DOUBLE PRECISION,
  statistical_significance DOUBLE PRECISION,
  winner_variant_id UUID,
  confidence_level TEXT,
  test_start_date DATE NOT NULL,
  test_end_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX ab_test_results_agent_id_idx ON ab_test_results(agent_id);
