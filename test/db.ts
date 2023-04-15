import {
  Generated,
  Kysely,
  MysqlDialect,
  PostgresDialect,
  SqliteDialect,
} from "kysely";
import { createPool as createMysqlPool } from "mysql2";
import { Pool as PostgresPool } from "pg";
import Database from "better-sqlite3";
import { faker } from "@faker-js/faker";

interface BlogPost {
  id: Generated<number>;
  title: string;
  body: string;
  authorId: number;
}

export interface DB {
  blogPosts: BlogPost;
}

export const databases = [
  [
    "sqlite",
    new Kysely<DB>({
      dialect: new SqliteDialect({
        database: new Database("test.sqlite"),
      }),
    }),
  ],

  [
    "mysql",
    new Kysely<DB>({
      dialect: new MysqlDialect({
        pool: createMysqlPool({
          database: "kysely_paginate",
          user: "kysely_paginate",
          password: "kysely_paginate",
          port: 3308,
        }),
      }),
    }),
  ],

  [
    "postgres",
    new Kysely<DB>({
      dialect: new PostgresDialect({
        pool: new PostgresPool({
          database: "kysely_paginate",
          user: "kysely_paginate",
          password: "kysely_paginate",
          port: 5434,
        }),
      }),
    }),
  ],
] as const;

let blogPostIdCounter = 0;

export async function createSampleBlogPosts(db: Kysely<DB>, count: number) {
  const posts = [...Array<never>(count)].map((_, i) => ({
    id: blogPostIdCounter++,
    title: `Blog Post ${i}`,
    body: faker.lorem.paragraphs(10),
    authorId: i % 3,
  }));

  await db.insertInto("blogPosts").values(posts).execute();

  return posts;
}

export async function setupDatabase(db: Kysely<DB>) {
  await db.schema.dropTable("blogPosts").ifExists().execute();
  await db.schema
    .createTable("blogPosts")
    .addColumn("id", "integer", (col) => col.primaryKey())
    .addColumn("title", "varchar(255)", (col) => col.notNull())
    .addColumn("body", "text", (col) => col.notNull())
    .addColumn("authorId", "integer", (col) => col.notNull())
    .execute();
  await db.schema
    .createIndex("blogPosts_authorId_index")
    .on("blogPosts")
    .column("authorId")
    .execute();
}
