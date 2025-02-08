import ngrok from 'ngrok';

export async function setupTunnel() {
  try {
    // Configure ngrok with auth token
    await ngrok.authtoken('2cN0ClsiDPQFgjsNhTpFWkSFhM7_3oMcB1SQfFHgGfSJ148f3');
    
    // Create a tunnel to our application
    const url = await ngrok.connect({
      addr: 5000,
      proto: 'http',
      hostname: 'locally-secure-chamois.ngrok-free.app'
    });
    
    console.log('Ngrok tunnel established:', url);
    return url;
  } catch (error) {
    console.error('Failed to establish ngrok tunnel:', error);
    throw error;
  }
}
