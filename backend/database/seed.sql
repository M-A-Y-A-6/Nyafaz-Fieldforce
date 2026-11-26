-- =============================================================================
-- Nyafaz FieldForce - Supabase Seed Data
-- Deterministic, idempotent seed script matching the finalized React UI
-- =============================================================================

-- Ensure pgcrypto extension is active for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. SEED USERS
-- 1 Manager & 2 Sales Executives
-- Password for all demo accounts: Demo@123 (hashed via bcrypt bf)
-- -----------------------------------------------------------------------------
INSERT INTO users (id, full_name, email, password_hash, role)
VALUES
    (
        'a0000000-0000-0000-0000-000000000001',
        'Aarav Menon',
        'manager@nyafaz-demo.com',
        crypt('Demo@123', gen_salt('bf')),
        'manager'
    ),
    (
        'a0000000-0000-0000-0000-000000000002',
        'Priya Nair',
        'priya@nyafaz-demo.com',
        crypt('Demo@123', gen_salt('bf')),
        'executive'
    ),
    (
        'a0000000-0000-0000-0000-000000000003',
        'Rohan Verma',
        'rohan@nyafaz-demo.com',
        crypt('Demo@123', gen_salt('bf')),
        'executive'
    )
ON CONFLICT (email) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role;

-- -----------------------------------------------------------------------------
-- 2. SEED SALONS
-- 5 Fictional dummy salons (SAL-001 to SAL-005)
-- -----------------------------------------------------------------------------
INSERT INTO salons (
    salon_id,
    salon_name,
    owner_name,
    contact_number,
    email,
    address,
    city,
    num_branches,
    lead_status,
    assigned_executive_id
)
VALUES
    (
        'SAL-001',
        'Luxe Hair Lounge & Spa',
        'Vikram Malhotra',
        '+91 98450 12345',
        'contact@luxelounge.com',
        '42, 80ft Road, 4th Block, Koramangala',
        'Bengaluru',
        2,
        'Visit Scheduled',
        (SELECT id FROM users WHERE email = 'priya@nyafaz-demo.com')
    ),
    (
        'SAL-002',
        'Glow & Grace Unisex Salon',
        'Ananya Sharma',
        '+91 98860 67890',
        'info@glowandgrace.in',
        '108, 12th Main Road, Indiranagar',
        'Bengaluru',
        1,
        'Interested',
        (SELECT id FROM users WHERE email = 'priya@nyafaz-demo.com')
    ),
    (
        'SAL-003',
        'Urban Shave & Grooming Studio',
        'Karthik Rao',
        '+91 97400 54321',
        'urban.shave@yahoo.com',
        '24, Church Street, Ashok Nagar',
        'Bengaluru',
        1,
        'Visited',
        (SELECT id FROM users WHERE email = 'rohan@nyafaz-demo.com')
    ),
    (
        'SAL-004',
        'Aura Wellness & Hair Bar',
        'Meera Iyer',
        '+91 96110 98765',
        'meera@aurawellness.com',
        '314, HSR Layout Sector 2, 27th Main',
        'Bengaluru',
        3,
        'Converted',
        (SELECT id FROM users WHERE email = 'priya@nyafaz-demo.com')
    ),
    (
        'SAL-005',
        'Bliss Elegance Family Salon',
        'Deepak Sen',
        '+91 99001 23456',
        'bliss.elegance@outlook.com',
        '15/B, Outer Ring Road, Bellandur',
        'Bengaluru',
        2,
        'Proposal / Discussion',
        (SELECT id FROM users WHERE email = 'rohan@nyafaz-demo.com')
    )
ON CONFLICT (salon_id) DO UPDATE SET
    salon_name = EXCLUDED.salon_name,
    owner_name = EXCLUDED.owner_name,
    contact_number = EXCLUDED.contact_number,
    email = EXCLUDED.email,
    address = EXCLUDED.address,
    city = EXCLUDED.city,
    num_branches = EXCLUDED.num_branches,
    lead_status = EXCLUDED.lead_status,
    assigned_executive_id = EXCLUDED.assigned_executive_id;

-- -----------------------------------------------------------------------------
-- 3. SEED VISITS
-- 3 Sample visits for CURRENT_DATE:
--  - 1 Completed visit (with GPS verification & feedback) for SAL-004
--  - 2 Pending visits for SAL-001 and SAL-002
-- -----------------------------------------------------------------------------
INSERT INTO visits (
    id,
    salon_id,
    executive_id,
    scheduled_date,
    status,
    check_in_time,
    check_in_lat,
    check_in_lng,
    check_in_gps_verified,
    check_out_time,
    check_out_lat,
    check_out_lng,
    check_out_gps_verified,
    visit_outcome,
    customer_interest,
    feedback,
    remarks
)
VALUES
    (
        'b0000000-0000-0000-0000-000000000001',
        'SAL-004',
        (SELECT id FROM users WHERE email = 'priya@nyafaz-demo.com'),
        CURRENT_DATE,
        'Completed',
        CURRENT_DATE + TIME '10:30:00',
        12.9128,
        77.6432,
        TRUE,
        CURRENT_DATE + TIME '11:45:00',
        12.9129,
        77.6431,
        TRUE,
        'Successful',
        'High',
        'Product demo presented to owner. Reviewed multi-outlet inventory, automated billing, and SMS reminders. Contract finalized for all 3 branches.',
        'Smooth closing. Onboarding scheduled for next week.'
    ),
    (
        'b0000000-0000-0000-0000-000000000002',
        'SAL-001',
        (SELECT id FROM users WHERE email = 'priya@nyafaz-demo.com'),
        CURRENT_DATE,
        'Pending',
        NULL,
        NULL,
        NULL,
        FALSE,
        NULL,
        NULL,
        NULL,
        FALSE,
        NULL,
        NULL,
        NULL,
        NULL
    ),
    (
        'b0000000-0000-0000-0000-000000000003',
        'SAL-002',
        (SELECT id FROM users WHERE email = 'priya@nyafaz-demo.com'),
        CURRENT_DATE,
        'Pending',
        NULL,
        NULL,
        NULL,
        FALSE,
        NULL,
        NULL,
        NULL,
        FALSE,
        NULL,
        NULL,
        NULL,
        NULL
    )
ON CONFLICT (id) DO UPDATE SET
    salon_id = EXCLUDED.salon_id,
    executive_id = EXCLUDED.executive_id,
    scheduled_date = EXCLUDED.scheduled_date,
    status = EXCLUDED.status,
    check_in_time = EXCLUDED.check_in_time,
    check_in_lat = EXCLUDED.check_in_lat,
    check_in_lng = EXCLUDED.check_in_lng,
    check_in_gps_verified = EXCLUDED.check_in_gps_verified,
    check_out_time = EXCLUDED.check_out_time,
    check_out_lat = EXCLUDED.check_out_lat,
    check_out_lng = EXCLUDED.check_out_lng,
    check_out_gps_verified = EXCLUDED.check_out_gps_verified,
    visit_outcome = EXCLUDED.visit_outcome,
    customer_interest = EXCLUDED.customer_interest,
    feedback = EXCLUDED.feedback,
    remarks = EXCLUDED.remarks;

-- -----------------------------------------------------------------------------
-- 4. SEED SALES OPPORTUNITIES
-- 1 Sample closed deal for Converted salon SAL-004
-- Pricing: Enterprise Package, 3 Branches, Discount: 2000, GST: 18%
-- -----------------------------------------------------------------------------
INSERT INTO sales_opportunities (
    id,
    salon_id,
    executive_id,
    product_package,
    num_branches,
    monthly_subscription,
    implementation_charges,
    discount,
    gst,
    total_amount,
    sales_date
)
VALUES
    (
        'c0000000-0000-0000-0000-000000000001',
        'SAL-004',
        (SELECT id FROM users WHERE email = 'priya@nyafaz-demo.com'),
        'Enterprise Package',
        3,
        8999.00,
        15000.00,
        2000.00,
        7199.46,
        47196.46,
        CURRENT_DATE
    )
ON CONFLICT (id) DO UPDATE SET
    salon_id = EXCLUDED.salon_id,
    executive_id = EXCLUDED.executive_id,
    product_package = EXCLUDED.product_package,
    num_branches = EXCLUDED.num_branches,
    monthly_subscription = EXCLUDED.monthly_subscription,
    implementation_charges = EXCLUDED.implementation_charges,
    discount = EXCLUDED.discount,
    gst = EXCLUDED.gst,
    total_amount = EXCLUDED.total_amount,
    sales_date = EXCLUDED.sales_date;
