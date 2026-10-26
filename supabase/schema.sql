create extension if not exists vector;

create table if not exists movies (
  id bigserial primary key,
  title text not null,
  year int,
  certificate text,
  runtime int,
  genre text,
  rating numeric,
  overview text,
  embedding vector(1536)
);

create or replace function match_movies(
  query_embedding vector(1536),
  match_count int,
  max_runtime int
)
returns table (
  id bigint, title text, year int, runtime int,
  genre text, rating numeric, overview text, similarity float
)
language sql stable as $$
  select id, title, year, runtime, genre, rating, overview,
         1 - (embedding <=> query_embedding) as similarity
  from movies
  where runtime is null or runtime <= max_runtime
  order by embedding <=> query_embedding
  limit match_count;
$$;
