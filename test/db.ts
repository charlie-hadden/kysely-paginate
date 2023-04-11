import { Generated, Kysely, SqliteDialect } from "kysely";
import Database from "better-sqlite3";

interface BlogPost {
  id: Generated<number>;
  title: string;
  body: string;
  authorId: number;
}

interface DB {
  blogPosts: BlogPost;
}

export const db = new Kysely<DB>({
  dialect: new SqliteDialect({
    database: new Database("test.sqlite"),
  }),
});

export function createSampleBlogPosts(count: number) {
  const posts = [...Array<never>(count)].map((_, i) => ({
    title: `Blog Post ${i}`,
    body: `Content for post ${i}`,
    authorId: i % 3,
  }));

  return db.insertInto("blogPosts").values(posts).returningAll().execute();
}

await db.schema.dropTable("blogPosts").ifExists().execute();
await db.schema
  .createTable("blogPosts")
  .addColumn("id", "integer", (col) => col.autoIncrement().primaryKey())
  .addColumn("title", "varchar(255)", (col) => col.notNull())
  .addColumn("body", "text", (col) => col.notNull())
  .addColumn("authorId", "integer", (col) => col.notNull())
  .execute();
await db.schema
  .createIndex("blogPosts_title_index")
  .on("blogPosts")
  .column("title")
  .execute();
