import '../styles/globals.css'

// Log environment configuration on startup (only once)
let environmentLogged = false;

if (!environmentLogged && typeof window === 'undefined') {
  // Only log on server-side (not in browser)
  const environment = process.env.ENVIRONMENT || process.env.NODE_ENV || 'development';
  const envLower = environment.toLowerCase();
  const isDev = envLower === 'dev' || envLower === 'development';
  const envMode = isDev ? 'DEV' : 'PRODUCTION';
  
  console.log('\n' + '='.repeat(60));
  console.log('🚀 INVOICE VALIDATOR - STARTING UP');
  console.log('='.repeat(60));
  console.log(`Environment Variable: ${environment}`);
  console.log(`Mode: ${envMode}`);
  if (isDev) {
    console.log(`⚠️  DEV MODE ACTIVE: All emails will be redirected to:`);
    console.log(`    maret.e.rudin-aulenbach@vanderbilt.edu`);
    console.log(`✅ Safe to test - no emails will go to actual contacts`);
  } else {
    console.log(`✅ PRODUCTION MODE: Using actual vendor contact emails`);
    console.log(`⚠️  WARNING: Emails will be sent to real recipients!`);
  }
  console.log('='.repeat(60) + '\n');
  
  environmentLogged = true;
}

export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />
}