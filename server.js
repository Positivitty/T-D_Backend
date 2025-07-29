// Import Express and CORS
const express = require('express');
const cors = require('cors');

// Create an Express app
const app = express();

// Set the port to 3001 (React will use 3000)
const PORT = 3001;

// Middleware
app.use(cors()); // Allow frontend to connect
app.use(express.json());

// Temporary container data
let containers = [
  {
    id: 'CNT-001',
    status: 'In Use',
    location: '1234 Main St, Dallas, TX',
    contents: 'Construction debris',
    assignedTo: 'Johnson Construction',
    dateDropped: '2025-06-25',
    lastUpdated: new Date().toISOString(),
    updatedBy: 'System'
  }
];

// Your first API endpoint!
app.get('/', (req, res) => {
  res.json({ message: 'T&D Rolloff API is running!' });
});

// GET all containers
app.get('/api/containers', (req, res) => {
  res.json(containers);
});

// GET all archived containers (for archive functionality)
app.get('/api/containers/archived', (req, res) => {
  const archivedContainers = containers.filter(c => c.status === 'Dumped');
  res.json(archivedContainers);
});

// POST create new container
app.post('/api/containers', (req, res) => {
  // Check for duplicate container ID
  const existingContainer = containers.find(c => c.id === req.body.id);
  if (existingContainer) {
    return res.status(400).json({ error: 'Container number already exists' });
  }

  const newContainer = {
    ...req.body,
    lastUpdated: new Date().toISOString(),
    updatedBy: 'System'
  };
  
  containers.push(newContainer);
  res.status(201).json(newContainer);
});

// GET single container by ID
app.get('/api/containers/:id', (req, res) => {
  const container = containers.find(c => c.id === req.params.id);
  
  if (!container) {
    return res.status(404).json({ error: 'Container not found' });
  }
  
  res.json(container);
});

// PUT update container
app.put('/api/containers/:id', (req, res) => {
  const containerIndex = containers.findIndex(c => c.id === req.params.id);
  
  if (containerIndex === -1) {
    return res.status(404).json({ error: 'Container not found' });
  }
  
  containers[containerIndex] = {
    ...containers[containerIndex],
    ...req.body,
    lastUpdated: new Date().toISOString(),
    updatedBy: 'System'
  };
  
  res.json(containers[containerIndex]);
});

// DELETE container
app.delete('/api/containers/:id', (req, res) => {
  const containerIndex = containers.findIndex(c => c.id === req.params.id);
  
  if (containerIndex === -1) {
    return res.status(404).json({ error: 'Container not found' });
  }
  
  const deletedContainer = containers.splice(containerIndex, 1)[0];
  res.json({ message: 'Container deleted', container: deletedContainer });
});

// Search containers
app.get('/api/containers/search', (req, res) => {
  const { q, status, location } = req.query;
  
  let filteredContainers = containers;
  
  if (q) {
    filteredContainers = filteredContainers.filter(c => 
      c.id.toLowerCase().includes(q.toLowerCase()) ||
      c.contents?.toLowerCase().includes(q.toLowerCase()) ||
      c.location?.toLowerCase().includes(q.toLowerCase())
    );
  }
  
  if (status && status !== 'All') {
    filteredContainers = filteredContainers.filter(c => c.status === status);
  }
  
  if (location) {
    filteredContainers = filteredContainers.filter(c => 
      c.location?.toLowerCase().includes(location.toLowerCase())
    );
  }
  
  res.json(filteredContainers);
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});