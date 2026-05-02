(function() {
  const BOT_URL = window.location.origin;
  const bubble = document.createElement('div');
  bubble.innerHTML = `
    <style>
      #ai-chat-bubble {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 60px;
        height: 60px;
        background: #0f2b1d;
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 28px;
        transition: transform 0.2s;
      }
      #ai-chat-bubble:hover { transform: scale(1.05); }
      #ai-chat-iframe {
        position: fixed;
        bottom: 90px;
        right: 20px;
        width: 380px;
        height: 500px;
        border: none;
        border-radius: 16px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        z-index: 9998;
        display: none;
        background: white;
      }
      @media (max-width: 600px) {
        #ai-chat-iframe {
          width: 100%;
          right: 0;
          bottom: 0;
          height: 100%;
          border-radius: 0;
        }
      }
    </style>
    <div id="ai-chat-bubble">💬</div>
    <iframe id="ai-chat-iframe" src="${BOT_URL}"></iframe>
  `;
  document.body.appendChild(bubble);
  const iframe = document.getElementById('ai-chat-iframe');
  const bubbleDiv = document.getElementById('ai-chat-bubble');
  bubbleDiv.onclick = () => {
    if (iframe.style.display === 'none' || !iframe.style.display) {
      iframe.style.display = 'block';
    } else {
      iframe.style.display = 'none';
    }
  };
})();
