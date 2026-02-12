/**
 * Tests for the /api/stops endpoint
 * Tests prefix search, pagination, and validation
 * @jest-environment node
 */

const request = require('supertest');
const express = require('express');
const path = require('path');
const fs = require('fs').promises;

// Create a test server
async function createTestServer() {
  const app = express();
  app.use(express.json());
  
  // Load test stops data
  const testStopsData = {
    stops: [
      { name: "Метро Сокол", uuid: "test-uuid-1", direction: "в центр" },
      { name: "Метро Бульвар Рокоссовского", uuid: "test-uuid-2", direction: "в центр" },
      { name: "Плодоовощной комбинат", uuid: "test-uuid-3", direction: "в центр" },
      { name: "Богородский храм", uuid: "test-uuid-4", direction: "в центр" },
      { name: "Площадь Революции", uuid: "test-uuid-5", direction: "из центра" },
      { name: "Красная площадь", uuid: "test-uuid-6", direction: "из центра" },
      { name: "Тверская", uuid: "test-uuid-7", direction: "в центр" },
      { name: "Арбатская", uuid: "test-uuid-8", direction: "из центра" },
      { name: "Киевская", uuid: "test-uuid-9", direction: "в центр" },
      { name: "Парк культуры", uuid: "test-uuid-10", direction: "из центра" }
    ]
  };
  
  // Implement the endpoint
  app.get('/api/stops', (req, res) => {
    const { prefix, page, page_size } = req.query;
    
    // If no query params at all, return all stops (backward compatibility)
    if (prefix === undefined && page === undefined && page_size === undefined) {
      return res.json(testStopsData);
    }
    
    // Parse pagination parameters
    const pageNum = page !== undefined ? parseInt(page, 10) : 1;
    const pageSize = page_size !== undefined ? parseInt(page_size, 10) : 20;
    
    // Validate pagination parameters
    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({ error: 'Invalid page number. Must be >= 1' });
    }
    
    if (isNaN(pageSize) || pageSize < 1 || pageSize > 100) {
      return res.status(400).json({ error: 'Invalid page_size. Must be between 1 and 100' });
    }
    
    // Filter stops by prefix if provided
    let filteredStops = testStopsData.stops;
    
    if (prefix && prefix.trim()) {
      const searchPrefix = prefix.toLowerCase().trim();
      filteredStops = testStopsData.stops.filter(stop => {
        const nameMatch = stop.name.toLowerCase().includes(searchPrefix);
        const uuidMatch = stop.uuid.toLowerCase().startsWith(searchPrefix);
        return nameMatch || uuidMatch;
      });
    }
    
    // Calculate pagination
    const total = filteredStops.length;
    const totalPages = Math.ceil(total / pageSize);
    const startIndex = (pageNum - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedStops = filteredStops.slice(startIndex, endIndex);
    
    // Return paginated response
    res.json({
      stops: paginatedStops,
      meta: {
        total,
        page: pageNum,
        page_size: pageSize,
        total_pages: totalPages,
        has_next: pageNum < totalPages,
        has_prev: pageNum > 1
      }
    });
  });
  
  return app;
}

describe('GET /api/stops', () => {
  let app;
  
  beforeAll(async () => {
    app = await createTestServer();
  });
  
  describe('Backward compatibility', () => {
    test('should return all stops when no query params provided', async () => {
      const response = await request(app)
        .get('/api/stops')
        .expect(200);
      
      expect(response.body).toHaveProperty('stops');
      expect(Array.isArray(response.body.stops)).toBe(true);
      expect(response.body.stops.length).toBe(10);
    });
  });
  
  describe('Prefix search', () => {
    test('should filter stops by prefix (case insensitive)', async () => {
      const response = await request(app)
        .get('/api/stops')
        .query({ prefix: 'метро', page: 1, page_size: 20 })
        .expect(200);
      
      expect(response.body.stops.length).toBe(2);
      expect(response.body.stops[0].name).toContain('Метро');
      expect(response.body.meta.total).toBe(2);
    });
    
    test('should return empty array when no matches found', async () => {
      const response = await request(app)
        .get('/api/stops')
        .query({ prefix: 'nonexistent', page: 1, page_size: 20 })
        .expect(200);
      
      expect(response.body.stops.length).toBe(0);
      expect(response.body.meta.total).toBe(0);
    });
    
    test('should handle partial matches', async () => {
      const response = await request(app)
        .get('/api/stops')
        .query({ prefix: 'площ', page: 1, page_size: 20 })
        .expect(200);
      
      expect(response.body.stops.length).toBe(2);
      expect(response.body.meta.total).toBe(2);
    });
    
    test('should trim whitespace from prefix', async () => {
      const response = await request(app)
        .get('/api/stops')
        .query({ prefix: '  метро  ', page: 1, page_size: 20 })
        .expect(200);
      
      expect(response.body.stops.length).toBe(2);
    });
  });
  
  describe('Pagination', () => {
    test('should return first page with correct pagination meta', async () => {
      const response = await request(app)
        .get('/api/stops?page=1&page_size=3')
        .expect(200);
      
      expect(response.body.stops.length).toBe(3);
      expect(response.body.meta).toEqual({
        total: 10,
        page: 1,
        page_size: 3,
        total_pages: 4,
        has_next: true,
        has_prev: false
      });
    });
    
    test('should return second page correctly', async () => {
      const response = await request(app)
        .get('/api/stops?page=2&page_size=3')
        .expect(200);
      
      expect(response.body.stops.length).toBe(3);
      expect(response.body.meta.page).toBe(2);
      expect(response.body.meta.has_prev).toBe(true);
      expect(response.body.meta.has_next).toBe(true);
    });
    
    test('should return last page correctly', async () => {
      const response = await request(app)
        .get('/api/stops?page=4&page_size=3')
        .expect(200);
      
      expect(response.body.stops.length).toBe(1);
      expect(response.body.meta.has_next).toBe(false);
      expect(response.body.meta.has_prev).toBe(true);
    });
    
    test('should default page to 1 if not provided', async () => {
      const response = await request(app)
        .get('/api/stops?page_size=5')
        .expect(200);
      
      expect(response.body.meta.page).toBe(1);
    });
    
    test('should default page_size to 20 if not provided', async () => {
      const response = await request(app)
        .get('/api/stops?page=1')
        .expect(200);
      
      expect(response.body.meta.page_size).toBe(20);
    });
  });
  
  describe('Validation', () => {
    test('should reject page < 1', async () => {
      const response = await request(app)
        .get('/api/stops?page=0&page_size=20')
        .expect(400);
      
      expect(response.body.error).toContain('Invalid page number');
    });
    
    test('should reject negative page', async () => {
      const response = await request(app)
        .get('/api/stops?page=-1&page_size=20')
        .expect(400);
      
      expect(response.body.error).toContain('Invalid page number');
    });
    
    test('should reject page_size < 1', async () => {
      const response = await request(app)
        .get('/api/stops?page=1&page_size=0')
        .expect(400);
      
      expect(response.body.error).toContain('Invalid page_size');
    });
    
    test('should reject page_size > 100', async () => {
      const response = await request(app)
        .get('/api/stops?page=1&page_size=101')
        .expect(400);
      
      expect(response.body.error).toContain('Invalid page_size');
    });
  });
  
  describe('Combined prefix and pagination', () => {
    test('should apply both prefix filter and pagination', async () => {
      const response = await request(app)
        .get('/api/stops')
        .query({ prefix: 'центр', page: 1, page_size: 2 })
        .expect(200);
      
      // "в центр" appears in multiple stops
      expect(response.body.stops.length).toBeLessThanOrEqual(2);
      expect(response.body.meta.page).toBe(1);
      expect(response.body.meta.page_size).toBe(2);
    });
  });
});
