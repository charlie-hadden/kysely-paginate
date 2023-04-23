import { Kysely, MysqlDialect, PostgresDialect, SqliteDialect } from "kysely";
import { createPool as createMysqlPool } from "mysql2";
import { Pool as PostgresPool } from "pg";
import Database from "better-sqlite3";
import { faker } from "@faker-js/faker";

interface BlogPost {
  id: number;
  title: string;
  body: string;
  authorId: number;
}

interface Author {
  id: number;
  name: string;
}

export interface DB {
  blogPosts: BlogPost;
  authors: Author;
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

export async function createSampleBlogPosts(db: Kysely<DB>, count: number) {
  let blogPostIdCounter = 1;

  const posts = [...Array<never>(count)].map((_, i) => ({
    id: blogPostIdCounter++,
    title: `Blog Post ${i}`,
    body: faker.lorem.paragraphs(10),
    authorId: i % 2,
  }));

  await db.insertInto("blogPosts").values(posts).execute();

  return posts;
}

export async function createSampleAuthors(db: Kysely<DB>) {
  const authors = [...Array<never>(3)].map((_, i) => ({
    id: i + 1,
    name: `Author ${i + 1}`,
  }));

  await db.insertInto("authors").values(authors).execute();

  return authors;
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

  await db.schema.dropTable("authors").ifExists().execute();
  await db.schema
    .createTable("authors")
    .addColumn("id", "integer", (col) => col.primaryKey())
    .addColumn("name", "varchar(255)", (col) => col.notNull())
    .execute();
}
