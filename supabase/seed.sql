-- Promote a user to admin. Create the user first
-- (Dashboard > Authentication > Users > Add user > Create new user),
-- then run this once in the SQL editor with their email.
-- You can also just edit the `role` cell in Table Editor > profiles.
update public.profiles set role = 'admin' where email = lower('admin@gmail.com');
