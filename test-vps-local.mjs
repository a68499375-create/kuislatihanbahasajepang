import fs from 'fs';
import path from 'path';

async function test() {
  try {
    const res = await fetch('http://localhost:3000/api/auth/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: 'UID-A4BEE7491C8D' })
    });
    const data = await res.json();
    console.log('Result:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Error:', e.message);
  }
}

test();
