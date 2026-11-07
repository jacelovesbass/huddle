/**
 * Read the single room out of an RPC result.
 *
 * `find_room` and `join_room` return the `rooms` composite type, and PostgREST
 * renders a NULL composite as a row of NULL columns rather than as nothing at
 * all. So the result of a wrong join code is `{ id: null, name: null, ... }`,
 * which is an object, which is truthy. Checking the data for truthiness let a
 * wrong code walk into a room with no id. Test the field, not the row.
 */
export const oneRoom = data => {
  const r = Array.isArray(data) ? data[0] : data;
  return r && r.id ? r : null;
};
