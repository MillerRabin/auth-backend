create database auth;
create user master;
grant all on database auth to master;
alter user master password 'ifyouwanttohave';
alter user postgres password 'ifyouwanttohave';