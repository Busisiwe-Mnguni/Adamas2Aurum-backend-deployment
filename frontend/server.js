// server.js
// Just serves the static frontend. No API keys, no database, no mock data.

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Live map running at http://localhost:${PORT}`);
});
