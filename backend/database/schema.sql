-- =============================================================================
-- Nyafaz FieldForce - Supabase PostgreSQL Database Schema
-- Idempotent DDL for field force sales management
-- =============================================================================

-- Enable pgcrypto extension for UUID generation and password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. USERS TABLE
-- Stores credentials and roles for Sales Managers and Sales Executives
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('manager', 'executive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 2. SALONS TABLE
-- Stores target salons, contact details, branch count, and lead status
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS salons (
    salon_id TEXT PRIMARY KEY,
    salon_name TEXT NOT NULL,
    owner_name TEXT NOT NULL DEFAULT 'Owner',
    contact_number TEXT NOT NULL DEFAULT '',
    email TEXT,
    address TEXT NOT NULL,
    city TEXT NOT NULL DEFAULT '',
    num_branches INT NOT NULL DEFAULT 1 CHECK (num_branches >= 1),
    lead_status TEXT NOT NULL DEFAULT 'New Lead' CHECK (
        lead_status IN (
            'New Lead',
            'Visit Scheduled',
            'Visited',
            'Interested',
            'Proposal / Discussion',
            'Converted',
            'Lost'
        )
    ),
    assigned_executive_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 3. VISITS TABLE
-- Tracks scheduled salon visits, GPS-verified check-in/out, and feedback
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id TEXT NOT NULL REFERENCES salons(salon_id) ON DELETE CASCADE,
    executive_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scheduled_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Progress', 'Completed')),
    check_in_time TIMESTAMPTZ,
    check_in_lat DOUBLE PRECISION,
    check_in_lng DOUBLE PRECISION,
    check_in_gps_verified BOOLEAN NOT NULL DEFAULT FALSE,
    check_out_time TIMESTAMPTZ,
    check_out_lat DOUBLE PRECISION,
    check_out_lng DOUBLE PRECISION,
    check_out_gps_verified BOOLEAN NOT NULL DEFAULT FALSE,
    visit_outcome TEXT CHECK (visit_outcome IN ('Successful', 'Not Available', 'Follow-up Required')),
    customer_interest TEXT CHECK (customer_interest IN ('High', 'Medium', 'Low')),
    feedback TEXT,
    remarks TEXT,
    follow_up_date DATE,
    visit_type TEXT NOT NULL DEFAULT 'Initial' CHECK (visit_type IN ('Initial', 'Follow-up')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Table-level check constraint:
    -- When a visit is Completed, outcome, customer interest, and non-empty feedback are mandatory
    CONSTRAINT check_completed_visit_feedback CHECK (
        status <> 'Completed' OR (
            visit_outcome IS NOT NULL AND
            customer_interest IS NOT NULL AND
            feedback IS NOT NULL AND
            length(trim(feedback)) > 0
        )
    )
);

-- -----------------------------------------------------------------------------
-- 4. SALES OPPORTUNITIES TABLE
-- Captures closed deal pricing, packages, branch multipliers, and GST
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sales_opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id TEXT NOT NULL REFERENCES salons(salon_id) ON DELETE RESTRICT,
    executive_id UUID NOT NULL REFERENCES users(id),
    product_package TEXT NOT NULL,
    num_branches INT NOT NULL DEFAULT 1 CHECK (num_branches >= 1),
    monthly_subscription NUMERIC(10, 2) NOT NULL DEFAULT 0,
    implementation_charges NUMERIC(10, 2) NOT NULL DEFAULT 0,
    discount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    gst NUMERIC(10, 2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    sales_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- PERFORMANCE & LOOKUP INDEXES
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE INDEX IF NOT EXISTS idx_salons_lead_status ON salons(lead_status);
CREATE INDEX IF NOT EXISTS idx_salons_assigned_executive_id ON salons(assigned_executive_id);

CREATE INDEX IF NOT EXISTS idx_visits_executive_date ON visits(executive_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_visits_salon_id ON visits(salon_id);
CREATE INDEX IF NOT EXISTS idx_visits_status ON visits(status);

CREATE INDEX IF NOT EXISTS idx_sales_opportunities_salon_id ON sales_opportunities(salon_id);
CREATE INDEX IF NOT EXISTS idx_sales_opportunities_executive_id ON sales_opportunities(executive_id);
CREATE INDEX IF NOT EXISTS idx_sales_opportunities_sales_date ON sales_opportunities(sales_date);

-- -----------------------------------------------------------------------------
-- SUPABASE ROW LEVEL SECURITY (RLS)
-- Enables secure policies for Supabase client interactions
-- -----------------------------------------------------------------------------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE salons ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_opportunities ENABLE ROW LEVEL SECURITY;

-- Development / Application Access Policies
DROP POLICY IF EXISTS "Allow public read/write on users" ON users;
CREATE POLICY "Allow public read/write on users" ON users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write on salons" ON salons;
CREATE POLICY "Allow public read/write on salons" ON salons FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write on visits" ON visits;
CREATE POLICY "Allow public read/write on visits" ON visits FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write on sales_opportunities" ON sales_opportunities;
CREATE POLICY "Allow public read/write on sales_opportunities" ON sales_opportunities FOR ALL USING (true) WITH CHECK (true);
