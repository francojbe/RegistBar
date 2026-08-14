-- Create a secure function to list users
-- Only the specific admin email can execute this query against auth.users

create or replace function public.get_admin_users()
returns table (
  id uuid,
  email varchar,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql
security definer
as $$
begin
  -- Check if the requesting user is the super admin
  if auth.jwt() ->> 'email' = 'franco.blanco@efinnovation.cl' then
    return query 
    select 
      au.id, 
      au.email::varchar, 
      au.created_at, 
      au.last_sign_in_at 
    from auth.users au
    order by au.created_at desc;
  else
    -- Raise an error if unauthorized
    raise exception 'Access denied: User is not an admin';
  end if;
end;
$$;
