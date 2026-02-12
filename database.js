const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'transport_radar.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
function initDatabase() {
  // Create arrival_history table
  db.exec(`
    CREATE TABLE IF NOT EXISTS arrival_history (
      id TEXT PRIMARY KEY,
      stop_id TEXT NOT NULL,
      vehicle_id TEXT NOT NULL,
      eta TEXT NOT NULL,
      recorded_at TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Create indexes for performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_arrival_history_stop_id 
    ON arrival_history(stop_id, recorded_at DESC)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_arrival_history_vehicle_id 
    ON arrival_history(vehicle_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_arrival_history_eta 
    ON arrival_history(eta)
  `);

  console.log('Database initialized successfully');
}

// Initialize database on module load
initDatabase();

// Insert arrival event with deduplication
function insertArrivalEvent(stopId, vehicleId, eta, metadata = null) {
  const id = require('crypto').randomUUID();
  const recordedAt = new Date().toISOString();
  
  // Check for duplicates within 5-minute window for the same vehicle/stop/eta
  const stmt = db.prepare(`
    SELECT id FROM arrival_history 
    WHERE stop_id = ? 
      AND vehicle_id = ? 
      AND eta = ?
      AND datetime(recorded_at) > datetime('now', '-5 minutes')
    LIMIT 1
  `);
  
  const duplicate = stmt.get(stopId, vehicleId, eta);
  
  if (duplicate) {
    return null; // Skip duplicate
  }
  
  // Insert new event
  const insert = db.prepare(`
    INSERT INTO arrival_history (id, stop_id, vehicle_id, eta, recorded_at, metadata)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  try {
    insert.run(id, stopId, vehicleId, eta, recordedAt, metadata);
    return { id, stop_id: stopId, vehicle_id: vehicleId, eta, recorded_at: recordedAt, metadata };
  } catch (error) {
    console.error('Error inserting arrival event:', error);
    return null;
  }
}

// Query arrival history with pagination and filters
function queryArrivalHistory(stopId, options = {}) {
  const {
    page = 1,
    pageSize = 20,
    dateFrom = null,
    dateTo = null,
    vehicleId = null
  } = options;

  const offset = (page - 1) * pageSize;
  
  let whereClause = 'WHERE stop_id = ?';
  const params = [stopId];
  
  if (dateFrom) {
    whereClause += ' AND date(eta) >= date(?)';
    params.push(dateFrom);
  }
  
  if (dateTo) {
    whereClause += ' AND date(eta) <= date(?)';
    params.push(dateTo);
  }
  
  if (vehicleId) {
    whereClause += ' AND vehicle_id = ?';
    params.push(vehicleId);
  }
  
  // Get total count
  const countStmt = db.prepare(`
    SELECT COUNT(*) as count FROM arrival_history ${whereClause}
  `);
  const { count: totalItems } = countStmt.get(...params);
  
  // Get paginated data
  const dataStmt = db.prepare(`
    SELECT id, stop_id, vehicle_id, eta, recorded_at, metadata
    FROM arrival_history
    ${whereClause}
    ORDER BY recorded_at DESC
    LIMIT ? OFFSET ?
  `);
  
  const data = dataStmt.all(...params, pageSize, offset);
  
  const totalPages = Math.ceil(totalItems / pageSize);
  
  return {
    data: data.map(row => ({
      id: row.id,
      stop_id: row.stop_id,
      vehicle_id: row.vehicle_id,
      eta: row.eta,
      recorded_at: row.recorded_at,
      metadata: row.metadata ? JSON.parse(row.metadata) : null
    })),
    meta: {
      page: parseInt(page),
      page_size: pageSize,
      total_pages: totalPages,
      total_items: totalItems
    }
  };
}

// Seed sample data for testing
function seedSampleData() {
  const stops = ['760d1406-363e-4b1a-a604-a6c75db93493', 'd9110dc0-8978-4f8a-831a-7c29135843d2'];
  const vehicles = ['1234', '5678', '9012', '3456'];
  
  console.log('Seeding sample arrival history data...');
  
  const now = new Date();
  let count = 0;
  
  // Generate events for the past 30 days
  for (let day = 30; day >= 0; day--) {
    for (let hour = 6; hour < 23; hour++) {
      for (let i = 0; i < Math.random() * 3; i++) {
        const eventDate = new Date(now);
        eventDate.setDate(eventDate.getDate() - day);
        eventDate.setHours(hour, Math.floor(Math.random() * 60), 0, 0);
        
        const stopId = stops[Math.floor(Math.random() * stops.length)];
        const vehicleId = vehicles[Math.floor(Math.random() * vehicles.length)];
        const eta = eventDate.toISOString();
        
        const result = insertArrivalEvent(stopId, vehicleId, eta, JSON.stringify({ 
          route: Math.random() > 0.5 ? '11' : '50',
          delay: Math.floor(Math.random() * 5)
        }));
        
        if (result) count++;
      }
    }
  }
  
  console.log(`Seeded ${count} sample arrival events`);
}

// Check if stop exists (for validation)
function stopExists(stopsData, stopId) {
  return stopsData.stops.some(stop => stop.uuid === stopId);
}

module.exports = {
  db,
  initDatabase,
  insertArrivalEvent,
  queryArrivalHistory,
  seedSampleData,
  stopExists
};
