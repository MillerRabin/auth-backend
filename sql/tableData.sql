create extension ltree;
create extension pgcrypto;
create extension postgis;

create table users (
    id uuid primary key default gen_random_uuid(),
    nick_name varchar(32) not null,
    email varchar(64) not null,
    login varchar(32) not null,
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
    password varchar(60) not null,
    location geography(point, 4326),
    locked boolean not null default false,
    denied boolean not null default false,
    email_verified boolean default false not null,
    phone_verified boolean default false not null,
    phone_code int,
    mail_code int
);

create table user_access (
    id bigserial primary key,
    r_user uuid not null,
    access int not null,
    create_time timestamp with time zone not null default now(),
    update_time timestamp with time zone not null default now(),
    details varchar(1000)
);


alter table user_access
add constraint user_access_user_fk foreign key (r_user)
references users (id)
on delete cascade;

alter table user_access
add constraint user_access_fk foreign key (access)
references groups (id)
on delete cascade;

create unique index user_access_user_index on user_access (r_user, access);
create index user_access_index on user_access (access);

create table auth_log
(
    time timestamp with time zone primary key default now(),
    id uuid,
    ip varchar(32)
)

create table groups
(
    id serial primary key,
    name ltree not null,
    rights jsonb,
    private_data jsonb,
    public_data jsonb,
    create_time timestamp with time zone not null default now(),
    update_time timestamp with time zone not null default now(),
    details varchar(1000)
)

create unique index groups_name on groups (name);
alter table groups add primary key (id);


insert into groups (name) values ('top.ci.admin');

insert into users (nick_name, email, phone, password) values ('Miller Rabin', 'millerrabin@raintech.su', 89154230004,
    crypt('ifyouwanttohave', gen_salt('md5')));

insert into user_access (r_user, access)
select u.id, g.id
from users u, groups g
where u.email = 'millerrabin@raintech.su' and g.name = 'top.ci.admin';

update users set login = 'millerrabin' where email = 'millerrabin@raintech.su';