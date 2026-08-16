const express        = require('express');
const cors           = require('cors');
const path           = require('path');
const session        = require('express-session');
require('dotenv').config();

const eventsRouter   = require('./routes/events');
const authRouter     = require('./routes/auth');

const app = express();

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,
    maxAge: 24 * 60 * 60 * 1000,
  },
}));

app.use(express.static(path.join(__dirname, '../frontend')));

app.get('/',        (req, res) => res.sendFile(path.join(__dirname, '../frontend/pages/index.html')));
app.get('/events',  (req, res) => res.sendFile(path.join(__dirname, '../frontend/pages/events.html')));
app.get('/console', (req, res) => res.sendFile(path.join(__dirname, '../frontend/pages/console.html')));

app.use('/api/auth',   authRouter);
app.use('/api/events', eventsRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});