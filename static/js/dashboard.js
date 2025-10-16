document.addEventListener('DOMContentLoaded', () => {
  // Check if vehicleForm exists before adding event listener
  const vehicleForm = document.getElementById('vehicleForm');
  if (vehicleForm) {
    vehicleForm.addEventListener('submit', handleVehicleSubmit);
  }

  // Initialize chatbox functionality
  const chatInput = document.getElementById('chatInput');
  if (chatInput) {
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendMessage();
      }
    });
  }

  // Initialize engine health prediction on load
  fetchEngineHealth();
});

// Handle vehicle form submission
function handleVehicleSubmit(e) {
  e.preventDefault();
  const carName = document.getElementById('carName').value;
  const mileage = document.getElementById('mileage').value;
  const engine = document.getElementById('engine').value;

  fetch('/add-vehicle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ carName, mileage, engine })
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    return response.json();
  })
  .then(data => {
    alert('Vehicle added successfully!');
    document.getElementById('vehicleForm').reset();
    
    // After adding a vehicle, immediately run a prediction with the new data
    const vehicleData = {
      make: carName.split(' ')[0],
      model: carName.split(' ').slice(1).join(' '),
      year: 2021,
      mileage: parseInt(mileage),
      rpm: 1200,
      temperature: 85,
      oil_level: 95
    };
    
    // Fetch a prediction with the new car's data
    fetch('/predict-engine-health', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vehicleData)
    })
    .then(response => response.json())
    .then(predictionData => {
      // Update the prediction UI with the result
      updatePredictionUI(predictionData);
    })
    .catch(error => {
      console.error('Error fetching prediction:', error);
    });
  })
  .catch(error => {
    console.error('Error adding vehicle:', error);
    alert('Error adding vehicle. Please try again.');
  });
}

// Function to update the prediction UI
function updatePredictionUI(data) {
  const predictionSection = document.querySelector('.prediction-section');
  if (!predictionSection) return;
  
  let statusElement = predictionSection.querySelector('strong');
  if (statusElement) {
    statusElement.textContent = data.status;
    statusElement.style.color = data.status === 'Good' ? '#a5d610' : (data.status === 'Warning' ? '#f0ad4e' : '#d9534f');
  }

  // Add or update prediction details
  if (!predictionSection.querySelector('.prediction-details')) {
    const detailsDiv = document.createElement('div');
    detailsDiv.className = 'prediction-details';
    detailsDiv.innerHTML = `
      <p>Confidence: <span class="confidence-value">${Math.round(data.confidence)}%</span></p>
      <p class="prediction-message">${data.message}</p>
    `;
    predictionSection.appendChild(detailsDiv);
  } else {
    // Update existing details
    predictionSection.querySelector('.confidence-value').textContent = `${Math.round(data.confidence)}%`;
    predictionSection.querySelector('.prediction-message').textContent = data.message;
  }
}

// Fetch engine health prediction from the API
function fetchEngineHealth() {
  const predictionSection = document.querySelector('.prediction-section');
  if (!predictionSection) return;

  // Get the vehicle data - in a real app, this would be dynamic based on selected vehicle
  const vehicleData = {
    mileage: document.getElementById('mileage')?.value || 5000,
    rpm: 1200,
    temperature: 85,
    oil_level: 95
  };

  fetch('/predict-engine-health', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(vehicleData)
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    return response.json();
  })
  .then(data => {
    // Update the prediction section with the result
    let statusElement = predictionSection.querySelector('strong');
    if (statusElement) {
      statusElement.textContent = data.status;
      statusElement.style.color = data.status === 'Normal' ? '#a5d610' : '#ff4d4d';
    }

    // Add more details if they don't exist
    if (!predictionSection.querySelector('.prediction-details')) {
      const detailsDiv = document.createElement('div');
      detailsDiv.className = 'prediction-details';
      detailsDiv.innerHTML = `
        <p>Confidence: <span class="confidence-value">${Math.round(data.confidence)}%</span></p>
        <p class="prediction-message">${data.message}</p>
      `;
      predictionSection.appendChild(detailsDiv);
    } else {
      // Update existing details
      predictionSection.querySelector('.confidence-value').textContent = `${Math.round(data.confidence)}%`;
      predictionSection.querySelector('.prediction-message').textContent = data.message;
    }
  })
  .catch(error => {
    console.error('Error fetching engine health prediction:', error);
    let statusElement = predictionSection.querySelector('strong');
    if (statusElement) {
      statusElement.textContent = 'Error';
      statusElement.style.color = '#ff4d4d';
    }
  });
}

// Send message to chatbot API
function sendMessage() {
  const input = document.getElementById('chatInput');
  const messages = document.getElementById('chatMessages');
  
  if (!input || !messages) return;
  
  const msg = input.value.trim();
  if (!msg) return;
  
  // Add user message to chat
  messages.innerHTML += `<div><strong>You:</strong> ${msg}</div>`;
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
    body: JSON.stringify({ message: msg })
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
    messages.innerHTML += `<div><strong>CarBot:</strong> ${data.reply}</div>`;
    messages.scrollTop = messages.scrollHeight;
  })
  .catch(error => {
    console.error('Error communicating with chatbot:', error);
    
    // Remove loading indicator
    messages.removeChild(loadingDiv);
    
    // Add error message
    messages.innerHTML += `<div><strong>CarBot:</strong> Sorry, I'm having trouble connecting. Please try again later.</div>`;
    messages.scrollTop = messages.scrollHeight;
  });
}
