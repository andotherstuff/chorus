export default {
  async scheduled(event, env, ctx) {
    console.log('🔄 Scheduled polling triggered:', new Date().toISOString());
    
    try {
      const now = Math.floor(Date.now() / 1000);
      await env.KV.put('last_poll_time', now.toString());
      
      // Log that we have access to secrets (but don't log the actual secret!)
      console.log('📍 Relay URL:', env.RELAY_URL);
      console.log('🔐 Bot token configured:', env.BOT_TOKEN ? 'Yes' : 'No');
      
      console.log('✅ Poll completed successfully');
    } catch (error) {
      console.error('❌ Error in scheduled polling:', error);
    }
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    switch (url.pathname) {
      case '/health':
        return new Response(JSON.stringify({
          status: 'ok',
          timestamp: Date.now(),
          relay: env.RELAY_URL,
          version: '1.0.0',
          hasToken: !!env.BOT_TOKEN  // Boolean only, never expose actual token
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
        
      case '/stats':
        const lastPoll = await env.KV.get('last_poll_time');
        return new Response(JSON.stringify({
          lastPoll: lastPoll ? parseInt(lastPoll) : null,
          timestamp: Date.now()
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
        
      default:
        return new Response('Not Found', { status: 404 });
    }
  }
};