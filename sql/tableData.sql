create extension ltree;
create extension pgcrypto;
create extension postgis;

create table users (
    id uuid primary key default gen_random_uuid(),
    nick_name varchar(32),
    email varchar(64) not null,
    login varchar(32),
    phone bigint,
    create_time timestamp with time zone not null default now(),
    update_time timestamp with time zone not null default now(),
    last_visited timestamp with time zone,
    birthday timestamp with time zone,
    private_data jsonb,
    public_data jsonb,
    skype varchar(160),
    facebook_id bigint,
    sex char(2),
    password varchar(60),
    location geography(point, 4326),
    locked boolean not null default false,
    denied boolean not null default false,
    email_verified boolean default false not null,
    phone_verified boolean default false not null,
    phone_code int,
    mail_code int
);

create index users_private on users using gin (private_data);
create index users_public on users using gin (public_data);

create table auth_log
(
    time timestamp with time zone primary key default now(),
    id uuid,
    ip varchar(32)
)

create table configs
(
    id serial primary key,
    name varchar(100),
    config jsonb,
    create_time timestamp with time zone default now(),
    update_time timestamp with time zone default now()
)

create unique index configs_name on configs (name);
create index configs_config on configs using gin (config);


insert into users (nick_name, email, phone, password) values ('Miller Rabin', 'millerrabin@raintech.su', 89154230004,
    crypt('ifyouwanttohave', gen_salt('md5')));

select * from configs;

select * from users;
delete from users where nick_name is null;