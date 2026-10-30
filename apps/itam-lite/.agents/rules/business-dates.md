# Business dates

Read before adding or changing a date that has no time of day, such as a device's purchase date or a request's needed-by date.

- **Store a calendar date as a `YYYY-MM-DD` string** (`c.string(name, { length: 10 })` in the migration, `isoDate` from `server/devices/schemas.ts` in the API schema), never as a datetime. A datetime turns the day into an instant and shows a different day in another time zone.
- **"Today" is the date in Asia/Shanghai**, where the company is (docs/design.md §1), not the server's or the browser's time zone. Use `businessToday()` from `server/requests/service.ts` for rules such as "not before today", and check them on the server.
- **Show a calendar date with `formatDay()`** from `client/pages/requests/format.ts`: date only, no time, the same day in every time zone, and `—` when empty. `formatDate()` is for instants such as `createdAt`; using it on a calendar date showed `Jan 1, 1970, 7:30 AM` for empty values and a meaningless time for the rest (chapter 9).
- **A date added to an existing table is nullable**, because rows written before it have none; every page that shows it handles the empty value.
