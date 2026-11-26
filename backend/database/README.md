# Nyafaz FieldForce - Supabase PostgreSQL Database

This directory contains the database schema and seed scripts for the **Nyafaz FieldForce** application, designed for Supabase (PostgreSQL 15+).

---

## Files

1. **`schema.sql`**
   - Enables `pgcrypto` for UUIDs and bcrypt password hashing.
   - Defines tables with exact field types, relationships, cascade behaviors, and validation constraints matching the frontend React UI:
     - `users`: Manager and Sales Executive accounts.
     - `salons`: Field salons, lead statuses, branch counts, and assigned executives.
     - `visits`: Scheduled visits, GPS-verified check-in/out coordinates, feedback, and table-level validation enforcement.
     - `sales_opportunities`: Closed deals, package pricing, discounts, GST, and totals.
   - Creates indexes for high-frequency queries (by executive, date, salon, lead status).
   - Enables Row Level Security (RLS) with permissive development policies.

2. **`seed.sql`**
   - Idempotent seed data using `ON CONFLICT` updates:
     - **Users**: 1 Manager (`Aarav Menon`) and 2 Sales Executives (`Priya Nair`, `Rohan Verma`) with hashed password `Demo@123`.
     - **Salons**: 5 dummy salons (`SAL-001` through `SAL-005`).
     - **Visits**: 3 visits scheduled for `CURRENT_DATE` (1 `Completed` visit with GPS & feedback, and 2 `Pending` visits).
     - **Sales Opportunities**: 1 closed deal record linked to converted salon `SAL-004`.

---

## How to Run in Supabase

### Option A: Supabase Web Dashboard (SQL Editor)
1. Open your Supabase Project dashboard.
2. Navigate to the **SQL Editor** in the left navigation.
3. Open and copy the contents of `backend/database/schema.sql`, paste it into the editor, and click **Run**.
4. Open and copy the contents of `backend/database/seed.sql`, paste it into the editor, and click **Run**.

### Option B: Supabase CLI
```bash
# Apply schema
supabase db execute --file backend/database/schema.sql

# Apply seed data
supabase db execute --file backend/database/seed.sql
```

---

## Default Demo Credentials

| Role | Name | Email | Password |
|---|---|---|---|
| **Manager** | Aarav Menon | `manager@nyafaz-demo.com` | `Demo@123` |
| **Sales Executive** | Priya Nair | `priya@nyafaz-demo.com` | `Demo@123` |
| **Sales Executive** | Rohan Verma | `rohan@nyafaz-demo.com` | `Demo@123` |
