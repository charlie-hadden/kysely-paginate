import { beforeEach } from "vitest";
import { db } from "./db";

beforeEach(async () => {
  await db.deleteFrom("blogPosts").execute();
});
