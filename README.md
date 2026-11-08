# Job Portal Backend API

Express + MySQL + JWT with two roles: **candidate** and **employer** (chosen at signup).

## Setup

```bash
npm install
cp .env.example .env        # then edit DB_PASSWORD and JWT_SECRET
mysql -u root -p < sql/schema.sql
npm start                   # or: npm run dev
```
Requires Node 18+ and MySQL 8.0.16+ (CHECK constraints). Send the token as `Authorization: Bearer <token>`.
Passwords are hashed with bcrypt (bcryptjs); auth uses JWT; every error is JSON `{ "error": "..." }`.

## Endpoints

| Method | Path | Access | Description |
|---|---|---|---|
| POST | /signup | public | `{name,email,password,role}` role = candidate \| employer |
| POST | /login | public | → JWT |
| POST | /jobs | employer | Create job (title, company, location, salary?, description, requirements, job_type) |
| GET | /jobs | public | List/search: `?q=&location=&job_type=&page=&limit=` |
| GET | /jobs/:id | public | Job details |
| PUT | /jobs/:id | employer (owner) | Partial update |
| DELETE | /jobs/:id | employer (owner) | Delete job + its applications |
| GET | /my-jobs | employer | Jobs I posted (with application counts) |
| POST | /apply/:jobId | candidate | Apply (one application per job → 409 if repeated) |
| GET | /my-applications | candidate | Jobs I applied to + status |
| GET | /job-applications | employer | Applications to my jobs: `?jobId=&status=` |
| PUT | /applications/:id/status | employer (owner) | `applied` \| `shortlisted` \| `rejected` |

`job_type`: full-time, part-time, internship.

## Design notes
- `authenticate` verifies the JWT; `authorize('employer')` / `authorize('candidate')` enforce roles.
- Employers can only edit/delete their **own** jobs and see applications for their **own** jobs (403 otherwise).
- `UNIQUE(job_id, candidate_id)` prevents duplicate applications at the DB level.
- Search input is escaped for LIKE wildcards; all queries are parameterised.
