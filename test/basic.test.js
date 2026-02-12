/**
 * Basic Unit Tests for Transport Radar Russia
 * 
 * These tests verify basic functionality of the application.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('Transport Radar Russia - Unit Tests', function() {
  
  describe('Configuration Files', function() {
    
    it('should have valid stops.json file', function() {
      const stopsPath = path.join(__dirname, '..', 'stops.json');
      assert.ok(fs.existsSync(stopsPath), 'stops.json should exist');
      
      const data = fs.readFileSync(stopsPath, 'utf8');
      assert.ok(data, 'stops.json should not be empty');
      
      const json = JSON.parse(data);
      assert.ok(json.stops, 'stops.json should have stops array');
      assert.ok(Array.isArray(json.stops), 'stops should be an array');
    });
    
    it('should have valid package.json file', function() {
      const packagePath = path.join(__dirname, '..', 'package.json');
      assert.ok(fs.existsSync(packagePath), 'package.json should exist');
      
      const data = fs.readFileSync(packagePath, 'utf8');
      const json = JSON.parse(data);
      
      assert.equal(json.name, 'transport-radar-russia', 'package name should be correct');
      assert.ok(json.scripts, 'package.json should have scripts');
      assert.ok(json.dependencies, 'package.json should have dependencies');
    });
    
  });
  
  describe('Server File', function() {
    
    it('should have server.js file', function() {
      const serverPath = path.join(__dirname, '..', 'server.js');
      assert.ok(fs.existsSync(serverPath), 'server.js should exist');
    });
    
  });
  
  describe('Public Files', function() {
    
    it('should have public directory', function() {
      const publicPath = path.join(__dirname, '..', 'public');
      assert.ok(fs.existsSync(publicPath), 'public directory should exist');
    });
    
    it('should have index.html', function() {
      const indexPath = path.join(__dirname, '..', 'public', 'index.html');
      assert.ok(fs.existsSync(indexPath), 'index.html should exist');
    });
    
  });
  
  describe('Stop Data Validation', function() {
    
    it('each stop should have required fields', function() {
      const stopsPath = path.join(__dirname, '..', 'stops.json');
      const data = fs.readFileSync(stopsPath, 'utf8');
      const json = JSON.parse(data);
      
      json.stops.forEach((stop, index) => {
        assert.ok(stop.name, `Stop ${index} should have a name`);
        assert.ok(stop.uuid, `Stop ${index} should have a uuid`);
        assert.ok(stop.direction, `Stop ${index} should have a direction`);
        
        // UUID format validation (basic)
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        assert.ok(uuidPattern.test(stop.uuid), `Stop ${index} uuid should be valid format`);
      });
    });
    
  });
  
});
