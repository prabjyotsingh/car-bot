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
    addCarForm.addEventListener('submit', handleSaveCar);
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
      <button class="car-btn edit-btn" data-car-id="${car.id}">Edit Details</button>
      <button class="car-btn delete-btn" data-car-id="${car.id}" style="background: #d9534f; border-color: #d9534f; color: white;">Delete</button>
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
        <div class="health-check-details" style="display: none; margin-top: 10px; padding: 10px; background: #2a2a2a; border-radius: 6px; font-size: 0.9em;">
          <div class="analysis-source" style="color: #a5d610; margin-bottom: 8px;"></div>
          <div class="ml-details" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;"></div>
          <div class="normalized-inputs" style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; font-size: 0.8em; color: #888;"></div>
        </div>
        <div class="health-check-warnings" style="display: none; margin-top: 10px; padding: 8px; background: #4a2c00; border-radius: 6px; border-left: 3px solid #FF9800; font-size: 0.8em;"></div>
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

  // Edit details button
  card.querySelector('.edit-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    openEditCarForm(car);
  });
  
  card.querySelector('.delete-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    deleteCar(car);
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

// Open edit form prefilled
function openEditCarForm(car) {
  const addCarModal = document.getElementById('addCarModal');
  addCarModal.style.display = 'flex';
  document.getElementById('editCarId').value = car.id || '';
  document.getElementById('carMake').value = car.make || '';
  document.getElementById('carModel').value = car.model || '';
  document.getElementById('carYear').value = car.year || '';
  // mileage removed
  document.getElementById('carEngine').value = car.engine || '';
  document.getElementById('carColor').value = car.color || '';
  document.getElementById('carNotes').value = car.notes || '';
  document.getElementById('carMileage').value = (typeof car.mileage === 'number' ? car.mileage : 50000);
  document.getElementById('carRpm').value = (typeof car.rpm === 'number' ? car.rpm : 2500);
  document.getElementById('carTemp').value = (typeof car.temperature === 'number' ? car.temperature : 85);
  document.getElementById('carOil').value = (typeof car.oil_level === 'number' ? car.oil_level : 90);
}

// Handle add or update car depending on editCarId presence
function handleSaveCar(e) {
  e.preventDefault();
  const editId = document.getElementById('editCarId').value;
  const carData = {
    id: editId || undefined,
    make: document.getElementById('carMake').value,
    model: document.getElementById('carModel').value,
    year: parseInt(document.getElementById('carYear').value),
    engine: document.getElementById('carEngine').value,
    color: document.getElementById('carColor').value,
    notes: document.getElementById('carNotes').value,
    status: 'Good', // Default status
    mileage: parseFloat(document.getElementById('carMileage').value),
    rpm: parseFloat(document.getElementById('carRpm').value),
    temperature: parseFloat(document.getElementById('carTemp').value),
    oil_level: parseFloat(document.getElementById('carOil').value)
  };
  
  const url = editId ? '/update-car' : '/add-car';
  // In a real app, this would be an API call
  fetch(url, {
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
    document.getElementById('editCarId').value = '';
    
    // Refresh list from server so edits are reflected
    loadUserCars();
  })
  .catch(error => {
    console.error('Error adding car:', error);
    alert('Error adding car. Please try again.');
  });
}

// Input validation function (matching training dataset ranges)
function validateCarInputs(car) {
  const errors = [];
  const warnings = [];
  
  // Critical errors (prevent analysis) - matching training data ranges
  if (car.rpm < 500 || car.rpm > 5000) {
    errors.push('RPM must be between 500-5000 (training dataset range)');
  }
  if (car.temperature < 60 || car.temperature > 150) {
    errors.push('Temperature must be between 60-150°C (training dataset range)');
  }
  if (car.oil_level < 20 || car.oil_level > 100) {
    errors.push('Oil level must be between 20-100% (training dataset range)');
  }
  if (car.mileage < 0 || car.mileage > 200000) {
    errors.push('Mileage must be between 0-200,000 km (training dataset range)');
  }
  
  // Warnings (allow analysis but flag issues)
  if (car.rpm < 1000) {
    warnings.push('RPM is low - engine may be idling or stalling');
  } else if (car.rpm > 4000) {
    warnings.push('RPM is high - engine under stress');
  }
  
  if (car.temperature < 70) {
    warnings.push('Temperature is low - engine may not be warmed up');
  } else if (car.temperature > 110) {
    warnings.push('Temperature is very high - overheating risk');
  }
  
  if (car.oil_level < 30) {
    warnings.push('Oil level is critically low - immediate attention needed');
  } else if (car.oil_level < 50) {
    warnings.push('Oil level is low - consider adding oil');
  }
  
  if (car.mileage > 150000) {
    warnings.push('High mileage vehicle - increased wear expected');
  }
  
  return { errors, warnings };
}

// Run engine health check
function runEngineHealthCheck(car) {
  const carData = {
    id: car.id,
    make: car.make,
    model: car.model,
    mileage: typeof car.mileage === 'number' ? car.mileage : 50000,
    rpm: typeof car.rpm === 'number' ? car.rpm : 2500,
    temperature: typeof car.temperature === 'number' ? car.temperature : 85,
    oil_level: typeof car.oil_level === 'number' ? car.oil_level : 90
  };
  
  // Enhanced input validation
  const validation = validateCarInputs(carData);
  
  // If there are critical errors, show them and don't proceed
  if (validation.errors.length > 0) {
    alert(`Input validation errors:\n${validation.errors.join('\n')}\n\nPlease correct these issues before analysis.`);
    return;
  }
  
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
      
      // Show detailed analysis information (like dashboard)
      const detailsPanel = resultsPanel.querySelector('.health-check-details');
      const warningsPanel = resultsPanel.querySelector('.health-check-warnings');
      
      if (data.details) {
        detailsPanel.style.display = 'block';
        
        // Analysis source
        const sourceEl = detailsPanel.querySelector('.analysis-source');
        sourceEl.textContent = `Analysis Source: ${data.source}`;
        
        // ML details
        const mlDetailsEl = detailsPanel.querySelector('.ml-details');
        mlDetailsEl.innerHTML = `
          <div><strong>ML Model:</strong> ${(data.details.model_prob_good * 100).toFixed(1)}%</div>
          <div><strong>Heuristic:</strong> ${(data.details.heuristic_prob_good * 100).toFixed(1)}%</div>
          <div><strong>ML Weight:</strong> ${(data.details.ml_weight * 100).toFixed(0)}%</div>
          <div><strong>Heuristic Weight:</strong> ${(data.details.heuristic_weight * 100).toFixed(0)}%</div>
        `;
        
        // Normalized inputs
        if (data.details.dataset_normalized_inputs) {
          const inputsEl = detailsPanel.querySelector('.normalized-inputs');
          inputsEl.innerHTML = `
            <div>Mileage: ${data.details.dataset_normalized_inputs.mileage}</div>
            <div>RPM: ${data.details.dataset_normalized_inputs.rpm}</div>
            <div>Temp (°F): ${data.details.dataset_normalized_inputs.temperature_f}</div>
            <div>Oil Level: ${data.details.dataset_normalized_inputs.oil_level}</div>
          `;
        }
      }
      
      // Show warnings if any
      if (validation.warnings && validation.warnings.length > 0) {
        warningsPanel.style.display = 'block';
        warningsPanel.innerHTML = `
          <strong style="color: #FF9800;">⚠ Input Warnings:</strong><br>
          ${validation.warnings.map(warning => `• ${warning}`).join('<br>')}
        `;
      }
      
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

// Delete car function with confirmation
function deleteCar(car) {
  // Show confirmation dialog
  const confirmed = confirm(`Are you sure you want to delete ${car.make} ${car.model} (${car.year})?\n\nThis action cannot be undone.`);
  
  if (!confirmed) {
    return;
  }
  
  // Show loading state
  const carCard = document.querySelector(`.car-card[data-car-id="${car.id}"]`);
  if (carCard) {
    carCard.style.opacity = '0.5';
    carCard.style.pointerEvents = 'none';
  }
  
  // Make API call to delete car
  fetch('/delete-car', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ id: car.id })
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    return response.json();
  })
  .then(data => {
    if (data.success) {
      // Remove car card from DOM
      if (carCard) {
        carCard.remove();
      }
      
      // Show success message
      showNotification('Car deleted successfully!', 'success');
      
      // Check if no cars left
      const remainingCars = document.querySelectorAll('.car-card');
      if (remainingCars.length === 0) {
        const carsContainer = document.getElementById('carsContainer');
        carsContainer.innerHTML = '<div class="no-cars-message">No cars found. Add your first car to get started!</div>';
      }
    } else {
      throw new Error(data.message || 'Failed to delete car');
    }
  })
  .catch(error => {
    console.error('Error deleting car:', error);
    
    // Reset card state
    if (carCard) {
      carCard.style.opacity = '1';
      carCard.style.pointerEvents = 'auto';
    }
    
    // Show error message
    showNotification('Error deleting car. Please try again.', 'error');
  });
}

// Notification function
function showNotification(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  
  // Style the notification
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 20px;
    border-radius: 6px;
    color: white;
    font-weight: bold;
    z-index: 10000;
    max-width: 300px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    transform: translateX(100%);
    transition: transform 0.3s ease;
  `;
  
  // Set background color based on type
  switch (type) {
    case 'success':
      notification.style.backgroundColor = '#28a745';
      break;
    case 'error':
      notification.style.backgroundColor = '#dc3545';
      break;
    case 'warning':
      notification.style.backgroundColor = '#ffc107';
      notification.style.color = '#000';
      break;
    default:
      notification.style.backgroundColor = '#17a2b8';
  }
  
  // Add to page
  document.body.appendChild(notification);
  
  // Animate in
  setTimeout(() => {
    notification.style.transform = 'translateX(0)';
  }, 100);
  
  // Remove after 3 seconds
  setTimeout(() => {
    notification.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 3000);
} 