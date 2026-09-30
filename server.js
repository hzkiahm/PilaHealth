const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: 'pilahealth-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 } // 1 hour
}));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/booking', require('./routes/booking'));
app.use('/api/queue', require('./routes/queue'));
app.use('/api/notification', require('./routes/notification'));
app.use('/api/audit', require('./routes/audit'));
app.use('/api/records', require('./routes/records'));

// Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`✅ PilaHealth running at http://localhost:${PORT}`);
});