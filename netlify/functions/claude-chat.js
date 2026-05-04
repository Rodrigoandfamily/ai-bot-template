const { rateLimit, corsHeaders } = require('./auth');

// ============================================
// MEMORY CACHE - Stores answers for faster responses
// ============================================
const answerCache = new Map();

// Model fallback options
const MODEL_FALLBACK = [
  { name: 'claude-3-haiku-20240307', tier: 'enterprise' },
  { name: 'claude-3-haiku-20240307', tier: 'pro' },
  { name: 'claude-3-haiku-20240307', tier: 'starter' }
];

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders };
  }
  
  // Rate limiting
  const ip = event.headers['client-ip'] || event.headers['x-forwarded-for'] || 'unknown';
  if (!rateLimit(ip)) {
    return { 
      statusCode: 429, 
      headers: corsHeaders, 
      body: JSON.stringify({ error: "Too many requests. Please wait a moment." }) 
    };
  }
  
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      headers: corsHeaders, 
      body: 'Method Not Allowed' 
    };
  }

  try {
    const { 
      message, 
      userName, 
      userPhone, 
      conversationHistory, 
      systemPrompt, 
      tier, 
      clientId, 
      clientName 
    } = JSON.parse(event.body);
    
    // ============================================
    // STEP 1: Check if answer is already in CACHE
    // ============================================
    const cacheKey = `${clientId}_${message.toLowerCase().trim()}`;
    
    if (answerCache.has(cacheKey)) {
      const cachedAnswer = answerCache.get(cacheKey);
      console.log(`✅ CACHE HIT for: ${message}`);
      
      // Send lead to dashboard if user shared info
      if (userPhone && clientId) {
        try {
          await fetch('https://YOUR-DASHBOARD-URL.netlify.app/.netlify/functions/capture-lead', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json', 
              'Authorization': 'Bearer bot-template-key-2024' 
            },
            body: JSON.stringify({ 
              clientId, 
              clientName, 
              leadName: userName, 
              leadPhone: userPhone, 
              tier, 
              platform: 'website' 
            })
          }).catch(e => console.log('Lead capture failed'));
        } catch(e) {}
      }
      
      return { 
        statusCode: 200, 
        headers: corsHeaders, 
        body: JSON.stringify({ 
          reply: cachedAnswer + " ⚡",
          cached: true 
        }) 
      };
    }
    
    console.log(`❌ CACHE MISS for: ${message} - Generating with Claude`);
    
    // ============================================
    // STEP 2: Generate answer with Claude AI
    // ============================================
    
    // Tier-specific instructions
    let tierInstructions = "";
    if (tier === 'starter') {
      tierInstructions = "Keep responses very short (1-2 sentences). Be helpful but brief.";
    } else if (tier === 'pro') {
      tierInstructions = "Be warm and conversational. Offer to help with specific needs. Keep responses under 3 sentences.";
    } else {
      tierInstructions = "Be extremely helpful and detailed. Offer priority support and custom solutions. You can give longer responses.";
    }
    
    // Build the full system prompt
    const fullSystemPrompt = `${systemPrompt || 'You are a friendly customer service AI assistant.'}

${tierInstructions}

Current customer: ${userName || 'a new customer'}
${userPhone ? `Customer's WhatsApp: ${userPhone} (already collected)` : 'Customer has not shared contact yet'}

IMPORTANT RULES:
- Answer based ONLY on the business information provided below
- If you don't know something, say "Let me check with the team and get back to you!"
- Always be friendly and use emojis occasionally 😊
- Keep responses natural - not robotic
- Try to get the customer's name and phone number if not already collected

BUSINESS INFORMATION:
${systemPrompt || 'No specific business info provided. Be a helpful general assistant.'}`;
    
    // Determine which models to try based on tier
    let modelsToTry = [];
    if (tier === 'enterprise') {
      modelsToTry = MODEL_FALLBACK;
    } else if (tier === 'pro') {
      modelsToTry = MODEL_FALLBACK.slice(1);
    } else {
      modelsToTry = MODEL_FALLBACK.slice(2);
    }
    
    let aiResponse = null;
    let responseText = null;
    
    // Try each model in fallback order
    for (const modelConfig of modelsToTry) {
      try {
        console.log(`Trying model: ${modelConfig.name}`);
        
        const response = await fetch('https://api.netlify.com/v1/ai-gateway/anthropic/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: modelConfig.name,
            max_tokens: 500,
            temperature: 0.7,
            system: fullSystemPrompt,
            messages: [
              ...(conversationHistory || []).slice(-6),
              { role: 'user', content: message }
            ]
          })
        });
        
        if (!response.ok) {
          throw new Error(`Model ${modelConfig.name} returned ${response.status}`);
        }
        
        const data = await response.json();
        aiResponse = data.content?.[0]?.text;
        
        if (aiResponse && aiResponse.length > 0) {
          responseText = aiResponse;
          console.log(`✅ Success with model: ${modelConfig.name}`);
          break;
        }
      } catch (modelError) {
        console.error(`Model ${modelConfig.name} failed:`, modelError.message);
        continue;
      }
    }
    
    // Fallback response if all models fail
    if (!responseText) {
      responseText = "Thanks for your message! I'll make sure someone gets back to you shortly. 💬";
      console.error('All models failed - using fallback response');
    }
    
    // ============================================
    // STEP 3: SAVE answer to CACHE for next time
    // ============================================
    answerCache.set(cacheKey, responseText);
    console.log(`💾 Saved to cache: ${cacheKey}`);
    
    // Limit cache size (keep last 500 answers)
    if (answerCache.size > 500) {
      const firstKey = answerCache.keys().next().value;
      answerCache.delete(firstKey);
      console.log(`🗑️ Cache limit reached - removed oldest entry`);
    }
    
    // ============================================
    // STEP 4: Send lead to dashboard if user shared info
    // ============================================
    if (userPhone && clientId) {
      try {
        await fetch('https://YOUR-DASHBOARD-URL.netlify.app/.netlify/functions/capture-lead', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            'Authorization': 'Bearer bot-template-key-2024' 
          },
          body: JSON.stringify({ 
            clientId, 
            clientName, 
            leadName: userName, 
            leadPhone: userPhone, 
            tier, 
            platform: 'website' 
          })
        }).catch(e => console.log('Lead capture failed:', e));
      } catch(e) {
        console.log('Lead capture error:', e);
      }
    }
    
    // ============================================
    // STEP 5: Return response to user
    // ============================================
    return { 
      statusCode: 200, 
      headers: corsHeaders, 
      body: JSON.stringify({ 
        reply: responseText,
        cached: false 
      }) 
    };
    
  } catch (error) {
    console.error('Fatal error:', error);
    
    // Graceful fallback
    return { 
      statusCode: 200, 
      headers: corsHeaders, 
      body: JSON.stringify({ 
        reply: "Hi! I'm here to help. Click the WhatsApp button below to chat with our team directly! 💬" 
      }) 
    };
  }
};