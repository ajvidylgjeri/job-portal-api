const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { notFound, errorHandler } = require('./utils');

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '100kb' }));

app.get('/', (req, res) => res.json({ service: 'Job Portal API', status: 'ok' }));
app.use('/', require('./routes/auth'));
app.use('/', require('./routes/jobs'));
app.use('/', require('./routes/applications'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
