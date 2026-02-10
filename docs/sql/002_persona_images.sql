-- persona_images: 페르소나 프로필 이미지 테이블
create table persona_images (
  id uuid default gen_random_uuid() primary key,
  persona_id uuid references personas(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null,
  file_path text not null,
  prompt text not null,
  is_profile boolean default false,
  created_at timestamptz default now()
);

alter table persona_images enable row level security;

create policy "Users manage own images"
  on persona_images
  for all
  using (auth.uid() = user_id);
