// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
  // Initialize chat input listener
  const chatInput = document.getElementById('chatInput');
  if (chatInput) {
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendChat();
      }
    });
  }
});

// Toggle chat visibility when chat button is clicked
function toggleChat() {
  const chatbox = document.getElementById('chatbox');
  if (!chatbox) return;
  
  const isVisible = chatbox.style.display === 'flex';
  chatbox.style.display = isVisible ? 'none' : 'flex';
  
  // Focus input when chat is opened
  if (!isVisible) {
    const chatInput = document.getElementById('chatInput');
    if (chatInput) chatInput.focus();
  }
}

// Send message to chatbot API
function sendChat() {
  const input = document.getElementById('chatInput');
  const messages = document.getElementById('messages');
  
  if (!input || !messages) return;
  
  const userMsg = input.value.trim();
  if (!userMsg) return;
  
  // Add user message to chat
  const userDiv = document.createElement('div');
  userDiv.innerHTML = `<strong>You:</strong> ${userMsg}`;
  messages.appendChild(userDiv);
  messages.scrollTop = messages.scrollHeight;

  // Clear input
  input.value = '';
  
  // Show loading indicator
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'chat-loading';
  loadingDiv.innerHTML = '<strong>CarBot:</strong> <em>Thinking...</em>';
  messages.appendChild(loadingDiv);
  messages.scrollTop = messages.scrollHeight;
  
  // Send to API
  fetch('/chatbot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: userMsg })
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    return response.json();
  })
  .then(data => {
    // Remove loading indicator
    messages.removeChild(loadingDiv);
    
    // Add bot response
    const botDiv = document.createElement('div');
    botDiv.innerHTML = `<strong>CarBot:</strong> ${data.reply}`;
    messages.appendChild(botDiv);
    messages.scrollTop = messages.scrollHeight;
  })
  .catch(error => {
    console.error('Error communicating with chatbot:', error);
    
    // Remove loading indicator
    messages.removeChild(loadingDiv);
    
    // Add error message
    const errorDiv = document.createElement('div');
    errorDiv.innerHTML = `<strong>CarBot:</strong> Sorry, I'm having trouble connecting. Please try again later.`;
    messages.appendChild(errorDiv);
    messages.scrollTop = messages.scrollHeight;
  });
}

function appendMessage(text) {
  const messages = document.getElementById('messages');
  if (!messages) return;
  
  const msg = document.createElement('div');
  msg.textContent = text;
  messages.appendChild(msg);
  messages.scrollTop = messages.scrollHeight;
}

function getBotReply(msg) {
  if (msg.includes('engine')) return "I'm running diagnostics on your engine now.";
  if (msg.includes('workshop')) return "Nearest workshop is 2km away. Want directions?";
  if (msg.includes('product')) return "You can browse oils, filters, and cleaning kits!";
  if (msg.includes('hi') || msg.includes('hello')) return "Hey there! CarBot here — what can I help you with?";
  return "Hmm, I'm still learning! Try asking about your engine, a product, or a mechanic.";
} 