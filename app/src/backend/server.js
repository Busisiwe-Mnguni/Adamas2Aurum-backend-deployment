const express = require('express');
const cors    = require('cors');
const path    = require('path');
require('dotenv').config();

const eventsRouter = require('./routes/events');

const app = express();

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '../frontend')));

app.get('/events',  (req, res) => res.sendFile(path.join(__dirname, '../frontend/pages/events.html')));
app.get('/console', (req, res) => res.sendFile(path.join(__dirname, '../frontend/pages/console.html')));

app.use('/api/events', eventsRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});