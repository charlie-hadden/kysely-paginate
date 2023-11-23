# kysely-paginate

## 0.3.1

### Patch Changes

- 32232a4: Hopefully fix ESM types

## 0.3.0

### Minor Changes

- 6875b00: Relax peer dependency version

### Patch Changes

- 6875b00: Update dependencies

## 0.2.0

### Minor Changes

- c5b4c54: Implement `hasNextPage` and `hasPrevPage` for cursor pagination.
- 6991b7f: Add optional `parseCursor` to cursor pagination
- a1dec56: Add `cursorPerRow` option to cursor pagination.
- 09390dc: Add support for `before` cursors.
- 9ddef4a: Update fields types to handle joins and other expressions.
- 2592503: Allow passing zod schemas directly to `parseCursor`.
- d1832dc: Make `parseCursor` required for cursor pagination.
- 6902c6b: Add offset pagination support.
- 9ddef4a: Allow specifying deferred join primary key.

### Patch Changes

- eef64ed: Allow default cursor encoder to handle additional types.
- 820809a: Test on node 20.x.
- 3d24c91: Add tests to ensure where clauses apply correctly.
- 440c4e9: Add tests to ensure pagination handles joins.

## 0.1.1

### Patch Changes

- 94e773c: Fix a package.json issue
