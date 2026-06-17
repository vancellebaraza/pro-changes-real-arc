
create policy "Auth users upload project images" on storage.objects for insert to authenticated
  with check (bucket_id = 'project-images' and owner = auth.uid());
create policy "Auth users read project images" on storage.objects for select to authenticated
  using (bucket_id = 'project-images');
create policy "Owners delete project images" on storage.objects for delete to authenticated
  using (bucket_id = 'project-images' and owner = auth.uid());
