const router = require('express').Router();
const { pool } = require('../db');
const { ah, HttpError, parseId, parsePaging } = require('../utils');
const { authenticate, authorize } = require('../middleware/auth');

const JOB_TYPES = ['full-time', 'part-time', 'internship'];
const TEXT_FIELDS = ['title', 'company', 'location', 'description', 'requirements'];

/** Validate job payload. When partial=true (PUT) only provided fields are validated. */
function parseJob(body, partial = false) {
  const b = body || {};
  const out = {};
  for (const f of TEXT_FIELDS) {
    if (b[f] === undefined) { if (!partial) throw new HttpError(400, `${f} is required`); continue; }
    if (typeof b[f] !== 'string' || !b[f].trim()) throw new HttpError(400, `${f} must be a non-empty string`);
    out[f] = b[f].trim();
  }
  if (b.job_type === undefined) { if (!partial) throw new HttpError(400, 'job_type is required'); }
  else {
    const t = String(b.job_type).toLowerCase();
    if (!JOB_TYPES.includes(t)) throw new HttpError(400, `job_type must be one of: ${JOB_TYPES.join(', ')}`);
    out.job_type = t;
  }
  if (b.salary !== undefined && b.salary !== null) {
    const s = Number(b.salary);
    if (!Number.isFinite(s) || s < 0) throw new HttpError(400, 'salary must be a non-negative number');
    out.salary = s;
  } else if (b.salary === null) out.salary = null;
  if (partial && !Object.keys(out).length) throw new HttpError(400, 'No valid fields to update');
  return out;
}

/** Loads a job and makes sure the logged-in employer owns it. */
async function ownJob(jobId, employerId) {
  const [rows] = await pool.query('SELECT id, employer_id FROM jobs WHERE id=?', [jobId]);
  if (!rows.length) throw new HttpError(404, 'Job not found');
  if (rows[0].employer_id !== employerId) throw new HttpError(403, 'You can only modify your own job postings');
}

// POST /jobs  (employer only)
router.post('/jobs', authenticate, authorize('employer'), ah(async (req, res) => {
  const j = parseJob(req.body);
  const [r] = await pool.query(
    `INSERT INTO jobs (title, company, location, salary, description, requirements, job_type, employer_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [j.title, j.company, j.location, j.salary ?? null, j.description, j.requirements, j.job_type, req.user.id]
  );
  const [rows] = await pool.query('SELECT * FROM jobs WHERE id=?', [r.insertId]);
  res.status(201).json({ message: 'Job created', job: rows[0] });
}));

// GET /jobs?q=&location=&job_type=&page=&limit=   (public: browse + search)
router.get('/jobs', ah(async (req, res) => {
  const { page, limit, offset } = parsePaging(req.query);
  const where = [];
  const params = [];
  if (req.query.q) {
    const like = `%${String(req.query.q).replace(/[\\%_]/g, '\\$&')}%`;
    where.push('(title LIKE ? OR company LIKE ? OR description LIKE ?)');
    params.push(like, like, like);
  }
  if (req.query.location) {
    where.push('location LIKE ?');
    params.push(`%${String(req.query.location).replace(/[\\%_]/g, '\\$&')}%`);
  }
  if (req.query.job_type) {
    const t = String(req.query.job_type).toLowerCase();
    if (!JOB_TYPES.includes(t)) throw new HttpError(400, `job_type must be one of: ${JOB_TYPES.join(', ')}`);
    where.push('job_type = ?');
    params.push(t);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM jobs ${clause}`, params);
  const [jobs] = await pool.query(`SELECT * FROM jobs ${clause} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  res.json({ page, limit, total, jobs });
}));

// GET /my-jobs  (employer: view all posted jobs)
router.get('/my-jobs', authenticate, authorize('employer'), ah(async (req, res) => {
  const [jobs] = await pool.query(
    `SELECT j.*, (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) AS application_count
       FROM jobs j WHERE j.employer_id=? ORDER BY j.created_at DESC`, [req.user.id]);
  res.json({ total: jobs.length, jobs });
}));

// GET /jobs/:id  (public)
router.get('/jobs/:id', ah(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM jobs WHERE id=?', [parseId(req.params.id)]);
  if (!rows.length) throw new HttpError(404, 'Job not found');
  res.json({ job: rows[0] });
}));

// PUT /jobs/:id  (employer who owns the job)
router.put('/jobs/:id', authenticate, authorize('employer'), ah(async (req, res) => {
  const id = parseId(req.params.id);
  const fields = parseJob(req.body, true);
  await ownJob(id, req.user.id);
  const cols = Object.keys(fields);
  await pool.query(`UPDATE jobs SET ${cols.map((c) => `${c}=?`).join(', ')} WHERE id=?`, [...cols.map((c) => fields[c]), id]);
  const [rows] = await pool.query('SELECT * FROM jobs WHERE id=?', [id]);
  res.json({ message: 'Job updated', job: rows[0] });
}));

// DELETE /jobs/:id  (employer who owns the job)
router.delete('/jobs/:id', authenticate, authorize('employer'), ah(async (req, res) => {
  const id = parseId(req.params.id);
  await ownJob(id, req.user.id);
  await pool.query('DELETE FROM jobs WHERE id=?', [id]);
  res.json({ message: 'Job deleted' });
}));

module.exports = router;
