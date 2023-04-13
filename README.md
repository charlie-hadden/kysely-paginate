# kysely-paginate
Pagination helpers for use with [Kysely](https://github.com/kysely-org/kysely).

> :warning: **This is a work in progress!** This library is still very early in development. Things won't work, things will be missing, and there will be breaking changes.

## Cursor pagination
```ts
const query = db.selectFrom("blogPosts").select(["id", "authorId"]);

const fullResult = await executeWithCursorPagination(query, {
  perPage: 10,
  after: cursor,
  fields: [
    ["authorId", "desc"],
    ["id", "desc"],
  ],
});
```
