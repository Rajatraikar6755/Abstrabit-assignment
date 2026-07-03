import dns from 'dns';
import { promisify } from 'util';

dns.setServers(['8.8.8.8', '8.8.4.4']);
const resolveSrv = promisify(dns.resolveSrv);
const resolveTxt = promisify(dns.resolveTxt);

async function main() {
  try {
    console.log('Resolving SRV records...');
    const srvRecords = await resolveSrv('_mongodb._tcp.cluster0.cgx23zb.mongodb.net');
    console.log('SRV Records found:');
    console.log(srvRecords);

    console.log('\nResolving TXT records...');
    const txtRecords = await resolveTxt('cluster0.cgx23zb.mongodb.net');
    console.log('TXT Records found:');
    console.log(txtRecords);

    // Format standard string
    const hosts = srvRecords.map(r => `${r.name}:${r.port}`).join(',');
    const options = txtRecords.flat().join('&');
    console.log('\nUse this direct connection string:');
    console.log(`mongodb://rajatyout1063ube_db_user:jocwHlUQLRvA7vWM@${hosts}/discord-bot?ssl=true&replicaSet=atlas-m1v23x-shard-0&authSource=admin&${options}`);
  } catch (err) {
    console.error('Resolution failed:', err);
  }
}

main();
