// Import Express, CORS, and PostgreSQL
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

// Create an Express app
const app = express();

// Set the port
const PORT = process.env.PORT || 3001;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware
app.use(cors()); // Allow frontend to connect
app.use(express.json());

// Initialize database - create table if it doesn't exist
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS containers (
        id VARCHAR(50) PRIMARY KEY,
        status VARCHAR(50) NOT NULL,
        location TEXT NOT NULL,
        contents TEXT,
        assigned_to VARCHAR(100),
        date_dropped DATE,
        date_dumped DATE,
        weight DECIMAL(10,2),
        last_updated TIMESTAMP DEFAULT NOW(),
        updated_by VARCHAR(50)
      )
    `);
    
    // Insert sample data if table is empty
    const result = await pool.query('SELECT COUNT(*) FROM containers');
    if (parseInt(result.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO containers (id, status, location, contents, assigned_to, date_dropped, updated_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, ['CNT-001', 'In Use', '1234 Main St, Dallas, TX', 'Construction debris', 'Johnson Construction', '2025-06-25', 'System']);
      console.log('Sample data inserted');
    }
    
    console.log('Database initialized successfully');
  } catch (err) {
    console.error('Database initialization error:', err);
  }
}

// Initialize database on startup
initDB();

// Your first API endpoint!
app.get('/', (req, res) => {
  res.json({ message: 'T&D Rolloff API is running with Postgres!' });
});

// GET all containers
app.get('/api/containers', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM containers ORDER BY last_updated DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET all archived containers (for archive functionality)
app.get('/api/containers/archived', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM containers WHERE status = 'Dumped' ORDER BY last_updated DESC");
    res.json(result.rows);
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST create new container
app.post('/api/containers', async (req, res) => {
  try {
    const { id, status, location, contents, assignedTo, dateDropped, weight, dateDumped } = req.body;
    
    // Check for duplicate container ID
    const existing = await pool.query('SELECT id FROM containers WHERE id = $1', [id]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Container number already exists' });
    }

    const result = await pool.query(`
      INSERT INTO containers (id, status, location, contents, assigned_to, date_dropped, date_dumped, weight, updated_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [id, status, location, contents, assignedTo, dateDropped, dateDumped, weight, 'System']);
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET single container by ID
app.get('/api/containers/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM containers WHERE id = $1', [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Container not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// PUT update container
app.put('/api/containers/:id', async (req, res) => {
  try {
    const { status, location, contents, assignedTo, dateDropped, weight, dateDumped } = req.body;
    
    const result = await pool.query(`
      UPDATE containers 
      SET status = $1, location = $2, contents = $3, assigned_to = $4, 
          date_dropped = $5, weight = $6, date_dumped = $7, last_updated = NOW(), updated_by = $8
      WHERE id = $9
      RETURNING *
    `, [status, location, contents, assignedTo, dateDropped, weight, dateDumped, 'System', req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Container not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE container
app.delete('/api/containers/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM containers WHERE id = $1 RETURNING *', [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Container not found' });
    }
    
    res.json({ message: 'Container deleted', container: result.rows[0] });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Search containers
app.get('/api/containers/search', async (req, res) => {
  try {
    const { q, status, location } = req.query;
    
    let query = 'SELECT * FROM containers WHERE 1=1';
    const params = [];
    let paramCount = 0;
    
    if (q) {
      paramCount++;
      query += ` AND (LOWER(id) LIKE $${paramCount} OR LOWER(contents) LIKE $${paramCount} OR LOWER(location) LIKE $${paramCount})`;
      params.push(`%${q.toLowerCase()}%`);
    }
    
    if (status && status !== 'All') {
      paramCount++;
      query += ` AND status = $${paramCount}`;
      params.push(status);
    }
    
    if (location) {
      paramCount++;
      query += ` AND LOWER(location) LIKE $${paramCount}`;
      params.push(`%${location.toLowerCase()}%`);
    }
    
    query += ' ORDER BY last_updated DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} with Postgres database`);
});