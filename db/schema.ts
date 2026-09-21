import {integer,sqliteTable,text} from 'drizzle-orm/sqlite-core';
export const workspaces=sqliteTable('demo_workspaces',{owner:text('owner').primaryKey(),revision:integer('revision').notNull().default(0),payload:text('payload').notNull()});
