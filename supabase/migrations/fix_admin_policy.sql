-- Allow the specific admin email to VIEW ALL tickets
-- We use auth.jwt() ->> 'email' to get the email from the session securely

create policy "Admin can view all tickets"
on public.support_tickets for select
to authenticated
using (
  auth.jwt() ->> 'email' = 'franco.blanco@efinnovation.cl'
);

-- Allow the specific admin email to UPDATE tickets (to resolve them)
create policy "Admin can update tickets"
on public.support_tickets for update
to authenticated
using (
  auth.jwt() ->> 'email' = 'franco.blanco@efinnovation.cl'
);
