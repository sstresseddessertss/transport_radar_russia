const http = require('http');

/**
 * Simple test suite for vehicles endpoint
 */

const BASE_URL = 'http://localhost:3000';
const TEST_STOP_ID = '760d1406-363e-4b1a-a604-a6c75db93493';
const INVALID_STOP_ID = 'invalid-stop-id-12345';

let testsPassed = 0;
let testsFailed = 0;

function makeRequest(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

function assert(condition, message) {
  if (condition) {
    console.log(`✓ ${message}`);
    testsPassed++;
  } else {
    console.error(`✗ ${message}`);
    testsFailed++;
  }
}

async function runTests() {
  console.log('Starting vehicles endpoint tests...\n');

  // Test 1: Valid stop ID returns 200
  console.log('Test 1: Valid stop ID returns vehicles data');
  try {
    const res = await makeRequest(`/api/stops/${TEST_STOP_ID}/vehicles`);
    assert(res.status === 200, 'Status code is 200');
    assert(res.data.data !== undefined, 'Response has data field');
    assert(res.data.meta !== undefined, 'Response has meta field');
    assert(Array.isArray(res.data.data), 'Data is an array');
    assert(res.data.meta.page !== undefined, 'Meta has page field');
    assert(res.data.meta.total_items !== undefined, 'Meta has total_items field');
  } catch (error) {
    console.error(`✗ Test 1 failed: ${error.message}`);
    testsFailed++;
  }

  // Test 2: Invalid stop ID returns 404
  console.log('\nTest 2: Invalid stop ID returns 404');
  try {
    const res = await makeRequest(`/api/stops/${INVALID_STOP_ID}/vehicles`);
    assert(res.status === 404, 'Status code is 404');
    assert(res.data.error !== undefined, 'Response has error field');
  } catch (error) {
    console.error(`✗ Test 2 failed: ${error.message}`);
    testsFailed++;
  }

  // Test 3: Pagination parameters work
  console.log('\nTest 3: Pagination parameters work');
  try {
    const res = await makeRequest(`/api/stops/${TEST_STOP_ID}/vehicles?page=1&page_size=2`);
    assert(res.status === 200, 'Status code is 200');
    assert(res.data.meta.page === 1, 'Page is 1');
    assert(res.data.meta.page_size === 2, 'Page size is 2');
  } catch (error) {
    console.error(`✗ Test 3 failed: ${error.message}`);
    testsFailed++;
  }

  // Test 4: include_positions=false excludes coordinates
  console.log('\nTest 4: include_positions=false excludes coordinates');
  try {
    const res = await makeRequest(`/api/stops/${TEST_STOP_ID}/vehicles?include_positions=false`);
    assert(res.status === 200, 'Status code is 200');
    if (res.data.data.length > 0) {
      assert(res.data.data[0].lat === undefined, 'Lat is not included');
      assert(res.data.data[0].lon === undefined, 'Lon is not included');
    }
  } catch (error) {
    console.error(`✗ Test 4 failed: ${error.message}`);
    testsFailed++;
  }

  // Test 5: Vehicle data structure is correct
  console.log('\nTest 5: Vehicle data structure is correct');
  try {
    const res = await makeRequest(`/api/stops/${TEST_STOP_ID}/vehicles?include_positions=true`);
    assert(res.status === 200, 'Status code is 200');
    if (res.data.data.length > 0) {
      const vehicle = res.data.data[0];
      assert(vehicle.vehicle_id !== undefined, 'Vehicle has vehicle_id');
      assert(vehicle.run_id !== undefined, 'Vehicle has run_id');
      assert(vehicle.eta_seconds !== undefined, 'Vehicle has eta_seconds');
      assert(vehicle.eta_human !== undefined, 'Vehicle has eta_human');
      assert(vehicle.status !== undefined, 'Vehicle has status');
      assert(vehicle.last_update !== undefined, 'Vehicle has last_update');
      assert(vehicle.lat !== undefined, 'Vehicle has lat');
      assert(vehicle.lon !== undefined, 'Vehicle has lon');
    }
  } catch (error) {
    console.error(`✗ Test 5 failed: ${error.message}`);
    testsFailed++;
  }

  // Test 6: Invalid page parameter returns error
  console.log('\nTest 6: Invalid page parameter returns 400');
  try {
    const res = await makeRequest(`/api/stops/${TEST_STOP_ID}/vehicles?page=0`);
    assert(res.status === 400, 'Status code is 400 for page=0');
  } catch (error) {
    console.error(`✗ Test 6 failed: ${error.message}`);
    testsFailed++;
  }

  // Test 7: Caching works (same response for rapid requests)
  console.log('\nTest 7: Caching provides consistent data');
  try {
    const res1 = await makeRequest(`/api/stops/${TEST_STOP_ID}/vehicles`);
    const res2 = await makeRequest(`/api/stops/${TEST_STOP_ID}/vehicles`);
    assert(res1.status === 200 && res2.status === 200, 'Both requests succeed');
    // Note: We can't directly test caching without inspecting cache internals,
    // but we can verify the endpoint is stable
  } catch (error) {
    console.error(`✗ Test 7 failed: ${error.message}`);
    testsFailed++;
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`Tests passed: ${testsPassed}`);
  console.log(`Tests failed: ${testsFailed}`);
  console.log('='.repeat(50));

  process.exit(testsFailed > 0 ? 1 : 0);
}

// Run tests after a short delay to ensure server is ready
setTimeout(() => {
  runTests().catch(error => {
    console.error('Test suite error:', error);
    process.exit(1);
  });
}, 1000);
