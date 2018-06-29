create extension ltree;
create extension pgcrypto;
create extension postgis;

create table users (
    id uuid primary key default gen_random_uuid(),
    nick_name varchar(320) not null,
    email varchar(320) not null,
    phone bigint not null,
    create_time timestamp with time zone not null default now(),
    update_time timestamp with time zone not null default now(),
    last_visited timestamp with time zone,
    birthday timestamp with time zone,
    private_data jsonb,
    public_data jsonb,
    skype varchar(160),
    facebook_id bigint,
    sex char(2),
    groups ltree[] not null,
    password varchar(60) not null,
    location geography(point, 4326),
    locked boolean not null default false,
    denied boolean not null default false,
    email_verified boolean default false not null,
    phone_verified boolean default false not null,
    phone_code int,
    mail_code int
);



create table auth_log
(
    time timestamp with time zone primary key default now(),
    id uuid,
    ip varchar(32)
)

create table groups
(
    id serial,
    name ltree not null,
    rights jsonb,
    private_data jsonb,
    public_data jsonb,
    create_time timestamp with time zone not null default now(),
    update_time timestamp with time zone not null default now()
)


insert into groups (name) values ('top.auth.admin');

insert into users (nick_name, email, phone, password, groups) values ('Miller Rabin', 'millerrabin@raintech.su', 89154230004,
    crypt('ifyouwanttohave', gen_salt('md5')), ARRAY['top.auth.admin', 'top.ci.admin']::ltree[]);

