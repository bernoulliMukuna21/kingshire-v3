-- Transactions table was missing write policies.
-- The SELECT policy already exists; add INSERT and UPDATE.

-- Clients can create a transaction for a job they own
create policy "Clients can create transactions" on public.transactions
  for insert with check (auth.uid() = client_id);

-- Parties involved can update a transaction (status changes, release, etc.)
create policy "Parties can update own transactions" on public.transactions
  for update using (auth.uid() = client_id or auth.uid() = kinglancer_id);
