-- Dev only: clear disposable test data so the v2 migration can add NOT NULL columns
-- and the reseed can recreate platters with categories. Locations + Users are preserved.
TRUNCATE "Order", "Referral", "Customer", "Platter" RESTART IDENTITY CASCADE;
