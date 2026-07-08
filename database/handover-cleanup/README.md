# Client Handover Cleanup

This folder contains the pre-client handover cleanup script for the Musiva Internal Operations System.

Run `clean-demo-data.sql` only when preparing a clean database before the client starts using the system. It deletes demo/test business records from operational tables such as orders, customers, deliveries, products, stock, purchases, returns, expenses, suppliers, payments, product images, and audit logs.

Do not run this script after real client usage starts.

Before running:

1. Take a Supabase backup/export.
2. Confirm there is no real client business data in the target database.
3. Review the preflight queries in the SQL file.
4. Edit the confirmation value in the SQL file exactly as instructed.
5. Run the script manually in the Supabase SQL editor or `psql`.
6. Run the verification queries at the bottom of the SQL file.

The script keeps system-required tables such as `profiles`, `roles`, `permissions`, `role_permissions`, and `settings`. It resets order and purchase sequences so the first real records can start at `MSV-10001` and `PO-10001`.
