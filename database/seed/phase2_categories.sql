insert into categories (name, slug, sort_order)
values
  ('Dresses', 'dresses', 10),
  ('Abayas', 'abayas', 20),
  ('Tops', 'tops', 30),
  ('Bottoms', 'bottoms', 40),
  ('Bags', 'bags', 50),
  ('Accessories', 'accessories', 60),
  ('Luxury Wear', 'luxury-wear', 70),
  ('New Collection', 'new-collection', 80)
on conflict (slug) do nothing;
