const { rateLimit, corsHeaders } = require('./auth');

const MODEL_FALLBACK = [
  { name: 'claude-opus-4-20250514', tier: 'enterprise' },
  { name: 'claude-sonnet-4-20250514', tier: 'pro' },
  { name: 'claude-3-5-sonnet-20241022', tier: 'pro' },
  { name: 'claude-3-haiku-20240307', tier: 'starter' }
];

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders };
  
  const ip = event.headers['client-ip'] || event.headers['x-forwarded-for'] || 'unknown';
  if (!rateLimit(ip)) return { statusCode: 429, headers: corsHeaders, body: JSON.stringify({ error: "Too many requests" }) };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: corsHeaders, body: 'Method Not Allowed' };

  try {
    const { message, userName, userPhone, conversationHistory, systemPrompt, tier, clientId, clientName } = JSON.parse(event.body);
    
    let tierInstructions = tier === 'starter' ? "Keep responses short (1-2 sentences)." 
      : tier === 'pro' ? "Mention voice chat and WhatsApp support is available." 
      : "Offer priority support and custom solutions.";
    
    const fullSystemPrompt = `${systemPrompt || 'You are a helpful customer service AI assistant.'}\n${tierInstructions}\nUser: ${userName || 'not provided'}`;
    
    let modelsToTry = [];
    if (tier === 'enterprise') modelsToTry = MODEL_FALLBACK;
    else if (tier === 'pro') modelsToTry = MODEL_FALLBACK.slice(1);
    else modelsToTry = MODEL_FALLBACK.slice(3);
    
    let response = null;
    
    for (const modelConfig of modelsToTry) {
      try {
        const aiResponse = await fetch('https://api.netlify.com/v1/ai-gateway/anthropic/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: modelConfig.name,
            max_tokens: 500,
            system: fullSystemPrompt,
            messages: [...(conversationHistory || []), { role: 'user', content: message }]
          })
        });
        
        if (!aiResponse.ok) throw new Error();
        const data = await aiResponse.json();
        response = data.content?.[0]?.text;
        if (response) break;
      } catch (modelError) {
        continue;
      }
    }
    
    if (!response) {
      response = "I'm having difficulties. Please click the WhatsApp button below! 💬";
    }
    
    if (userPhone && clientId) {
      try {
        await fetch('https://https://dashboard-ai-bot.netlify.app/.netlify/functions/capture-lead', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer bot-template-key-2024' },
          body: JSON.stringify({ clientId, clientName, leadName: userName, leadPhone: userPhone, tier, platform: 'website' })
        }).catch(e => console.log('Lead capture failed'));
      } catch(e) {}
    }
    
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ reply: response }) };
    
  } catch (error) {
    return { 
      statusCode: 200, 
      headers: corsHeaders, 
      body: JSON.stringify({ reply: "Hi! Click the WhatsApp button below to chat with our team! 💬" }) 
    };
  }
};