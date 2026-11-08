const router = require('express').Router();
const { pool } = require('../db');
const { ah, HttpError, parseId } = require('../utils');
const { authenticate, authorize } = require('../middleware/auth');

const STATUSES = ['applied', 'shortlisted', 'rejected'];

// POST /apply/:jobId  (candidate only)
router.post('/apply/:jobId', authenticate, authorize('candidate'), ah(async (req, res) => {
  const jobId = parseId(req.params.jobId, 'jobId');
  const [jobs] = await pool.query('SELECT id FROM jobs WHERE id=?', [jobId]);
  if (!jobs.length) throw new HttpError(404, 'Job not found');
  try {
    const [r] = await pool.query('INSERT INTO applications (job_id, candidate_id) VALUES (?, ?)', [jobId, req.user.id]);
    res.status(201).json({ message: 'Application submitted', application: { id: r.insertId, job_id: jobId, status: 'applied' } });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'You have already applied for this job');
    throw e;
  }
}));

// GET /my-applications  (candidate)
router.get('/my-applications', authenticate, authorize('candidate'), ah(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT a.id, a.status, a.applied_at, j.id AS job_id, j.title, j.company, j.location, j.job_type
       FROM applications a JOIN jobs j ON j.id = a.job_id
      WHERE a.candidate_id=? ORDER BY a.applied_at DESC`, [req.user.id]);
  res.json({ total: rows.length, applications: rows });
}));

// GET /job-applications?jobId=&status=  (employer: applications for the employer's own jobs)
router.get('/job-applications', authenticate, authorize('employer'), ah(async (req, res) => {
  const where = ['j.employer_id = ?'];
  const params = [req.user.id];
  if (req.query.jobId) { where.push('j.id = ?'); params.push(parseId(req.query.jobId, 'jobId')); }
  if (req.query.status) {
    if (!STATUSES.includes(req.query.status)) throw new HttpError(400, `status must be one of: ${STATUSES.join(', ')}`);
    where.push('a.status = ?'); params.push(req.query.status);
  }
  const [rows] = await pool.query(
    `SELECT a.id, a.status, a.applied_at, j.id AS job_id, j.title AS job_title,
            u.id AS candidate_id, u.name AS candidate_name, u.email AS candidate_email
       FROM applications a
       JOIN jobs j ON j.id = a.job_id
       JOIN users u ON u.id = a.candidate_id
      WHERE ${where.join(' AND ')} ORDER BY a.applied_at DESC`, params);
  res.json({ total: rows.length, applications: rows });
}));

// PUT /applications/:id/status  { status }  (employer who owns the job) - bonus: status tracking
router.put('/applications/:id/status', authenticate, authorize('employer'), ah(async (req, res) => {
  const id = parseId(req.params.id);
  const status = req.body && req.body.status;
  if (!STATUSES.includes(status)) throw new HttpError(400, `status must be one of: ${STATUSES.join(', ')}`);
  const [rows] = await pool.query(
    'SELECT a.id, j.employer_id FROM applications a JOIN jobs j ON j.id = a.job_id WHERE a.id=?', [id]);
  if (!rows.length) throw new HttpError(404, 'Application not found');
  if (rows[0].employer_id !== req.user.id) throw new HttpError(403, 'This application is not for one of your jobs');
  await pool.query('UPDATE applications SET status=? WHERE id=?', [status, id]);
  res.json({ message: 'Application status updated', id, status });
}));

module.exports = router;
