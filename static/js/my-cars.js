document.addEventListener('DOMContentLoaded', () => {
  // Initialize Firebase but don't require login
  const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "your-app.firebaseapp.com",
    projectId: "your-app",
    storageBucket: "your-app.appspot.com",
    messagingSenderId: "XXXXXX",
    appId: "YOUR_APP_ID"
  };
  
  try {
    // Initialize Firebase but don't make it mandatory
    firebase.initializeApp(firebaseConfig);
  } catch (error) {
    console.log("Firebase not initialized, continuing without authentication");
  }
  
  // Always load cars without requiring authentication
  loadUserCars();
  
  // Initialize UI elements
  initializeUI();
});

// Sample car data (would normally come from an API)
const sampleCars = [
  {
    id: '1',
    make: 'Toyota',
    model: 'Camry',
    year: 2019,
    mileage: 35000,
    engine: 'Petrol',
    color: 'Silver',
    notes: 'Regular maintenance up to date. Last serviced on May 2, 2025.',
    status: 'Good'
  },
  {
    id: '2',
    make: 'Honda',
    model: 'Civic',
    year: 2020,
    mileage: 22000,
    engine: 'Petrol',
    color: 'Blue',
    notes: 'Minor scratch on rear bumper. Tire pressure needs checking.',
    status: 'Good'
  },
  {
    id: '3',
    make: 'Ford',
    model: 'Explorer',
    year: 2018,
    mileage: 48000,
    engine: 'Diesel',
    color: 'Black',
    notes: 'Check engine light came on last week. Scheduled for service.',
    status: 'Warning'
  }
];

// Initialize UI elements and event listeners
function initializeUI() {
  const addNewCarBtn = document.getElementById('addNewCarBtn');
  const addCarModal = document.getElementById('addCarModal');
  const carDetailsModal = document.getElementById('carDetailsModal');
  const closeModalButtons = document.querySelectorAll('.close-modal');
  const cancelBtn = document.querySelector('.cancel-btn');
  const addCarForm = document.getElementById('addCarForm');
  const chatInput = document.getElementById('chatInput');
  
  // Add new car button
  addNewCarBtn.addEventListener('click', () => {
    addCarModal.style.display = 'flex';
  });
  
  // Close modals when clicking X
  closeModalButtons.forEach(button => {
    button.addEventListener('click', () => {
      addCarModal.style.display = 'none';
      carDetailsModal.style.display = 'none';
    });
  });
  
  // Close modals when clicking outside
  window.addEventListener('click', (e) => {
    if (e.target === addCarModal) {
      addCarModal.style.display = 'none';
    }
    if (e.target === carDetailsModal) {
      carDetailsModal.style.display = 'none';
    }
  });
  
  // Cancel button in add car form
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      addCarModal.style.display = 'none';
    });
  }
  
  // Add car form submission
  if (addCarForm) {
    addCarForm.addEventListener('submit', handleAddCar);
  }
  
  // Initialize chat input
  if (chatInput) {
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendMessage();
      }
    });
  }
}

// Load user's cars
function loadUserCars() {
  const carsContainer = document.getElementById('carsContainer');
  
  // In a real app, this would be an API call
  // For demo, we use sample data
  fetch('/get-cars')
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .catch(error => {
      console.error('Error fetching cars:', error);
      // Use sample data as fallback
      return { cars: sampleCars };
    })
    .then(data => {
      // Clear loading message
      carsContainer.innerHTML = '';
      
      const cars = data.cars || sampleCars;
      
      if (cars.length === 0) {
        carsContainer.innerHTML = `
          <div class="no-cars-message">
            <p>You haven't added any cars yet.</p>
            <p>Click the "Add New Car" button to get started.</p>
          </div>
        `;
        return;
      }
      
      // Render each car
      cars.forEach(car => {
        const carCard = createCarCard(car);
        carsContainer.appendChild(carCard);
      });
    });
}

// Create a car card element
function createCarCard(car) {
  const card = document.createElement('div');
  card.className = 'car-card';
  card.setAttribute('data-car-id', car.id);
  
  // Set status color
  if (car.status === 'Warning') {
    card.style.borderLeft = '5px solid #f0ad4e';
  } else if (car.status === 'Danger') {
    card.style.borderLeft = '5px solid #d9534f';
  }
  
  card.innerHTML = `
    <h3>
      ${car.make} ${car.model} 
      <span class="car-badge">${car.year}</span>
    </h3>
    <div class="car-detail">
      <span class="car-detail-label">Mileage:</span>
      <span>${car.mileage.toLocaleString()} miles</span>
    </div>
    <div class="car-detail">
      <span class="car-detail-label">Engine:</span>
      <span>${car.engine}</span>
    </div>
    <div class="car-detail">
      <span class="car-detail-label">Status:</span>
      <span style="color: ${getStatusColor(car.status)}">${car.status}</span>
    </div>
    <div class="car-actions">
      <button class="car-btn view-btn" data-car-id="${car.id}">View Details</button>
      <button class="car-btn predict-btn" data-car-id="${car.id}">Health Check</button>
    </div>
    
    <!-- Health Check Results Container (Initially Hidden) -->
    <div class="health-check-container" id="health-check-${car.id}">
      <div class="health-check-animation">
        <div class="scanning-pulse"></div>
      </div>
      <div class="health-check-results">
        <div class="health-check-status">
          <strong>Engine Health: <span class="status-text">Analyzing...</span></strong>
          <span class="confidence-value"></span>
        </div>
        <div class="health-meter">
          <div class="health-meter-fill"></div>
        </div>
        <div class="health-check-message"></div>
      </div>
      <div class="health-check-close" onclick="closeHealthCheck('${car.id}', event)">✕</div>
    </div>
  `;
  
  // Add event listeners
  card.querySelector('.view-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    showCarDetails(car);
  });
  
  card.querySelector('.predict-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    runEngineHealthCheck(car);
  });
  
  // Show details when clicking the card
  card.addEventListener('click', () => {
    showCarDetails(car);
  });
  
  return card;
}

// Show car details in modal
function showCarDetails(car) {
  const modal = document.getElementById('carDetailsModal');
  const modalTitle = document.getElementById('carDetailsTitle');
  const modalBody = document.getElementById('carDetailsBody');
  
  modalTitle.textContent = `${car.make} ${car.model} (${car.year})`;
  
  modalBody.innerHTML = `
    <div class="car-details-container">
      <div class="car-details-header">
        <div class="car-icon">🚗</div>
        <h3 class="car-details-title">${car.make} ${car.model}</h3>
      </div>
      
      <div class="car-info-grid">
        <div class="car-info-item">
          <div class="car-info-label">Year</div>
          <div class="car-info-value">${car.year}</div>
        </div>
        <div class="car-info-item">
          <div class="car-info-label">Color</div>
          <div class="car-info-value">${car.color}</div>
        </div>
        <div class="car-info-item">
          <div class="car-info-label">Mileage</div>
          <div class="car-info-value">${car.mileage.toLocaleString()} miles</div>
        </div>
        <div class="car-info-item">
          <div class="car-info-label">Engine Type</div>
          <div class="car-info-value">${car.engine}</div>
        </div>
        <div class="car-info-item">
          <div class="car-info-label">Status</div>
          <div class="car-info-value" style="color: ${getStatusColor(car.status)}">${car.status}</div>
        </div>
      </div>
      
      <div class="car-info-item" style="margin-top: 15px;">
        <div class="car-info-label">Notes</div>
        <div class="car-info-value" style="font-weight: normal;">${car.notes || 'No notes available.'}</div>
      </div>
      
      <div class="car-details-actions">
        <button class="car-btn" id="modal-health-check-btn">Run Health Check</button>
        <button class="submit-btn">Edit Details</button>
      </div>
    </div>
  `;
  
  // Add event listener for the health check button in the modal
  const healthCheckBtn = modalBody.querySelector('#modal-health-check-btn');
  if (healthCheckBtn) {
    healthCheckBtn.addEventListener('click', () => {
      // Close the modal
      modal.style.display = 'none';
      
      // Find the car card and run health check
      const carCard = document.querySelector(`.car-card[data-car-id="${car.id}"]`);
      if (carCard) {
        const healthCheckBtn = carCard.querySelector('.predict-btn');
        if (healthCheckBtn) {
          healthCheckBtn.click();
        } else {
          // Fallback if button not found
          runEngineHealthCheck(car);
        }
      }
    });
  }
  
  modal.style.display = 'flex';
}

// Handle adding a new car
function handleAddCar(e) {
  e.preventDefault();
  
  const carData = {
    make: document.getElementById('carMake').value,
    model: document.getElementById('carModel').value,
    year: parseInt(document.getElementById('carYear').value),
    mileage: parseInt(document.getElementById('carMileage').value),
    engine: document.getElementById('carEngine').value,
    color: document.getElementById('carColor').value,
    notes: document.getElementById('carNotes').value,
    status: 'Good' // Default status
  };
  
  // In a real app, this would be an API call
  fetch('/add-car', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(carData)
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    return response.json();
  })
  .then(data => {
    // Close modal and reload cars
    document.getElementById('addCarModal').style.display = 'none';
    document.getElementById('addCarForm').reset();
    
    // Reload the car list - in our demo, we'll just add it to the existing list
    // with a fake ID
    carData.id = Date.now().toString();
    const carsContainer = document.getElementById('carsContainer');
    const carCard = createCarCard(carData);
    carsContainer.appendChild(carCard);
    
    // Remove "no cars" message if it exists
    const noCarMessage = document.querySelector('.no-cars-message');
    if (noCarMessage) {
      noCarMessage.remove();
    }
  })
  .catch(error => {
    console.error('Error adding car:', error);
    alert('Error adding car. Please try again.');
  });
}

// Run engine health check
function runEngineHealthCheck(car) {
  const carData = {
    id: car.id,
    make: car.make,
    model: car.model,
    mileage: car.mileage,
    // Add other needed data
    rpm: 1200, // Sample value
    temperature: 85, // Sample value
    oil_level: 95 // Sample value
  };
  
  // First, close any open health check panels
  document.querySelectorAll('.health-check-container.visible').forEach(container => {
    if (container.id !== `health-check-${car.id}`) {
      container.classList.remove('visible');
    }
  });
  
  // Get health check container for THIS specific car
  const healthCheckContainer = document.getElementById(`health-check-${car.id}`);
  if (!healthCheckContainer) return;
  
  // Get animation and results panels
  const resultsPanel = healthCheckContainer.querySelector('.health-check-results');
  const animationPanel = healthCheckContainer.querySelector('.health-check-animation');
  
  // Clear previous display settings
  resultsPanel.style.display = 'none'; 
  animationPanel.style.display = 'flex';
  
  // Show animation container for this car only
  healthCheckContainer.classList.add('visible');
  
  // In a real app, this would be an API call
  fetch('/predict-engine-health', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(carData)
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    return response.json();
  })
  .then(data => {
    // Wait 2 seconds to show animation
    setTimeout(() => {
      // Make sure the container is still visible (user might have closed it)
      if (!healthCheckContainer.classList.contains('visible')) return;
      
      // Hide animation, show results
      animationPanel.style.display = 'none';
      resultsPanel.style.display = 'block';
      
      // Update status text and color
      const statusText = resultsPanel.querySelector('.status-text');
      statusText.textContent = data.status;
      statusText.style.color = getStatusColor(data.status);
      
      // Update confidence value
      const confidenceValue = resultsPanel.querySelector('.confidence-value');
      confidenceValue.textContent = `${Math.round(data.confidence)}%`;
      
      // Update health meter
      const healthMeter = resultsPanel.querySelector('.health-meter-fill');
      
      // Remove any existing classes
      healthMeter.classList.remove('warning', 'danger');
      
      // Add appropriate class based on status
      if (data.status === 'Warning') {
        healthMeter.classList.add('warning');
      } else if (data.status === 'Danger') {
        healthMeter.classList.add('danger');
      }
      
      // Animate the health meter fill
      setTimeout(() => {
        healthMeter.style.width = `${data.confidence}%`;
      }, 100);
      
      // Update message
      const messageEl = resultsPanel.querySelector('.health-check-message');
      messageEl.textContent = data.message;
      
      // Update the car's status if it changed
      if (data.status !== car.status) {
        // Get THIS specific car card
        const carCard = document.querySelector(`.car-card[data-car-id="${car.id}"]`);
        if (carCard) {
          const statusSpan = carCard.querySelector('.car-detail:nth-child(3) span:last-child');
          if (statusSpan) {
            statusSpan.textContent = data.status;
            statusSpan.style.color = getStatusColor(data.status);
          }
          
          // Update border color
          if (data.status === 'Warning') {
            carCard.style.borderLeft = '5px solid #f0ad4e';
          } else if (data.status === 'Danger') {
            carCard.style.borderLeft = '5px solid #d9534f';
          } else {
            carCard.style.borderLeft = '5px solid #a5d610';
          }
        }
      }
    }, 2000);
  })
  .catch(error => {
    console.error('Error running health check:', error);
    
    // Show error message in the container
    animationPanel.style.display = 'none';
    resultsPanel.style.display = 'block';
    
    const messageEl = resultsPanel.querySelector('.health-check-message');
    messageEl.textContent = 'Error running health check. Please try again.';
    messageEl.style.color = '#d9534f';
  });
}

// Function to close the health check panel
function closeHealthCheck(carId, event) {
  const healthCheckContainer = document.getElementById(`health-check-${carId}`);
  if (healthCheckContainer) {
    // Hide the container
    healthCheckContainer.classList.remove('visible');
    
    // Reset the contents after animation completes
    setTimeout(() => {
      const resultsPanel = healthCheckContainer.querySelector('.health-check-results');
      const animationPanel = healthCheckContainer.querySelector('.health-check-animation');
      
      if (resultsPanel && animationPanel) {
        resultsPanel.style.display = 'none';
        animationPanel.style.display = 'none';
        
        // Reset health meter
        const healthMeter = resultsPanel.querySelector('.health-meter-fill');
        if (healthMeter) {
          healthMeter.style.width = '0';
        }
      }
    }, 400); // Match the transition duration in CSS
  }
  
  // Prevent the click from bubbling up to the card
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
}

// Get color based on status
function getStatusColor(status) {
  switch (status) {
    case 'Danger':
      return '#d9534f';
    case 'Warning':
      return '#f0ad4e';
    case 'Good':
    default:
      return '#a5d610';
  }
}

// Send message to chatbot
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