// Standalone MongoDB connection test — run with `npm run test:db`.
// Reads MONGODB_URI straight from .env, connects with plain Node's `mongodb`
// driver (no Electron involved), and reports a clear pass/fail. Useful for
// isolating whether a connection problem is the URI/network/Atlas itself,
// or specific to running inside Electron's bundled runtime.
require('dotenv').config();
const { MongoClient } = require('mongodb');

async function main() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.log('MONGODB_URI is not set in .env — the app runs fine without it (DB features are skipped), nothing to test.');
    process.exit(0);
  }

  console.log('Connecting to MongoDB...');
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });

  try {
    await client.connect();
    const result = await client.db().admin().ping();
    console.log('SUCCESS — MongoDB Atlas is reachable.');
    console.log('  Ping response:', JSON.stringify(result));
    console.log('  Default database:', client.db().databaseName);
    process.exitCode = 0;
  } catch (err) {
    console.error('FAILED to connect.');
    console.error('  Error type:', err.name);
    console.error('  Message:', err.message);

    if (/bad auth|authentication/i.test(err.message)) {
      console.error('\n  → Likely cause: wrong password or username in MONGODB_URI.');
    } else if (/IP|whitelist|not allowed/i.test(err.message)) {
      console.error('\n  → Likely cause: your current IP is not on the Atlas Network Access allowlist.');
    } else if (/querySrv|ENOTFOUND/i.test(err.message)) {
      console.error('\n  → Likely cause: DNS lookup failed. If the URI uses mongodb+srv://, switch to the standard mongodb://host1,host2,host3/ form — see README Troubleshooting.');
    } else if (/ssl|tls/i.test(err.message)) {
      console.error('\n  → Likely cause: a TLS/SSL handshake problem between this machine and Atlas (antivirus/VPN doing TLS inspection, a stale system clock, or a flaky network). This is unrelated to the app\'s code — try a different network, or temporarily disable antivirus/VPN TLS inspection and re-run this script.');
    }

    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

main();
