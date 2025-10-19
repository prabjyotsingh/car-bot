// Dashboard JavaScript functionality
document.addEventListener('DOMContentLoaded', function() {
    const engineForm = document.getElementById('engineForm');
    const predictionResult = document.getElementById('predictionResult');
    const chatInput = document.getElementById('chatInput');
    const chatMessages = document.getElementById('chatMessages');

    // Input validation function (matching training dataset ranges)
    function validateInputs(data) {
        const errors = [];
        const warnings = [];
        
        // Critical errors (prevent analysis) - matching training data ranges
        if (data.rpm < 500 || data.rpm > 5000) {
            errors.push('RPM must be between 500-5000 (training dataset range)');
        }
        if (data.temperature < 60 || data.temperature > 150) {
            errors.push('Temperature must be between 60-150°C (training dataset range)');
        }
        if (data.oil_level < 20 || data.oil_level > 100) {
            errors.push('Oil level must be between 20-100% (training dataset range)');
        }
        if (data.mileage < 0 || data.mileage > 200000) {
            errors.push('Mileage must be between 0-200,000 km (training dataset range)');
        }
        
        // Warnings (allow analysis but flag issues)
        if (data.rpm < 1000) {
            warnings.push('RPM is low - engine may be idling or stalling');
        } else if (data.rpm > 4000) {
            warnings.push('RPM is high - engine under stress');
        }
        
        if (data.temperature < 70) {
            warnings.push('Temperature is low - engine may not be warmed up');
        } else if (data.temperature > 110) {
            warnings.push('Temperature is very high - overheating risk');
        }
        
        if (data.oil_level < 30) {
            warnings.push('Oil level is critically low - immediate attention needed');
        } else if (data.oil_level < 50) {
            warnings.push('Oil level is low - consider adding oil');
        }
        
        if (data.mileage > 150000) {
            warnings.push('High mileage vehicle - increased wear expected');
        }
        
        return { errors, warnings };
    }

    // Quick test scenario function (using training dataset ranges)
    function loadScenario(type) {
        const scenarios = {
            healthy: {
                rpm: 2500,  // Optimal RPM from training data
                temperature: 85,
                oil_level: 90,
                mileage: 50000
            },
            warning: {
                rpm: 2000,
                temperature: 95,
                oil_level: 40,
                mileage: 120000
            },
            critical: {
                rpm: 3500,
                temperature: 120,
                oil_level: 25,
                mileage: 180000
            },
            overheating: {
                rpm: 4000,
                temperature: 130,
                oil_level: 60,
                mileage: 95000
            }
        };
        
        const scenario = scenarios[type];
        if (scenario) {
            document.getElementById('rpm').value = scenario.rpm;
            document.getElementById('temperature').value = scenario.temperature;
            document.getElementById('oil_level').value = scenario.oil_level;
            document.getElementById('mileage').value = scenario.mileage;
            
            // Auto-submit the form
            engineForm.dispatchEvent(new Event('submit'));
        }
    }

    // Engine health analysis
    engineForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = new FormData(engineForm);
        const data = {
            rpm: parseInt(formData.get('rpm')),
            temperature: parseInt(formData.get('temperature')),
            oil_level: parseInt(formData.get('oil_level')),
            mileage: parseInt(formData.get('mileage'))
        };

        // Enhanced input validation
        const validation = validateInputs(data);
        
        // If there are critical errors, show them and don't proceed
        if (validation.errors.length > 0) {
            predictionResult.innerHTML = `
                <div style="padding: 20px; border-radius: 10px; background: #333; border-left: 4px solid #F44336;">
                    <div style="display: flex; align-items: center; margin-bottom: 15px;">
                        <span style="font-size: 2em; margin-right: 10px; color: #F44336;">✗</span>
                        <h4 style="color: #F44336; margin: 0;">Critical Input Errors</h4>
                    </div>
                    <ul style="margin: 0; padding-left: 20px; color: #fff;">
                        ${validation.errors.map(error => `<li style="margin-bottom: 5px;">${error}</li>`).join('')}
                    </ul>
                    <p style="color: #aaa; margin-top: 10px;">Please correct these issues before analysis.</p>
                </div>
            `;
            return;
        }

        // Show loading state
        predictionResult.innerHTML = `
            <div style="padding: 20px; text-align: center; color: #a5d610;">
                <div style="font-size: 1.2em; margin-bottom: 10px;">🔍 Analyzing Engine Health...</div>
                <div style="font-size: 0.9em; color: #ccc;">Processing data with ML model and heuristic analysis</div>
            </div>
        `;

        try {
            const response = await fetch('/predict-engine-health', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();
            
            // Add warnings to result if any
            if (validation.warnings.length > 0) {
                result.warnings = validation.warnings;
            }
            
            displayPrediction(result);
        } catch (error) {
            console.error('Error:', error);
            predictionResult.innerHTML = `
                <div style="padding: 20px; border-radius: 10px; background: #333; border-left: 4px solid #F44336;">
                    <div style="display: flex; align-items: center; margin-bottom: 15px;">
                        <span style="font-size: 2em; margin-right: 10px; color: #F44336;">✗</span>
                        <h4 style="color: #F44336; margin: 0;">Analysis Error</h4>
                    </div>
                    <p style="color: #fff;">Failed to analyze engine health. Please check your inputs and try again.</p>
                    <p style="color: #aaa; font-size: 0.9em;">Error: ${error.message}</p>
                </div>
            `;
        }
    });

    function displayPrediction(result) {
        const statusColor = result.status === 'Good' ? '#4CAF50' : 
                           result.status === 'Warning' ? '#FF9800' : '#F44336';
        
        const statusIcon = result.status === 'Good' ? '✓' : 
                          result.status === 'Warning' ? '⚠' : '✗';
        
        let detailsHtml = '';
        if (result.details) {
            detailsHtml = `
                <div style="margin-top: 15px; padding: 10px; background: #2a2a2a; border-radius: 6px;">
                    <h5 style="color: #a5d610; margin-bottom: 8px;">Enhanced Analysis Details</h5>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.9em;">
                        <div><strong>ML Model:</strong> ${(result.details.model_prob_good * 100).toFixed(1)}%</div>
                        <div><strong>Enhanced Heuristic:</strong> ${(result.details.heuristic_prob_good * 100).toFixed(1)}%</div>
                        <div><strong>ML Weight:</strong> ${(result.details.ml_weight * 100).toFixed(0)}%</div>
                        <div><strong>Heuristic Weight:</strong> ${(result.details.heuristic_weight * 100).toFixed(0)}%</div>
                        <div><strong>ML Confidence:</strong> ${(result.details.ml_confidence * 100).toFixed(0)}%</div>
                        <div><strong>Analysis Type:</strong> ${result.source}</div>
                    </div>
                    ${result.details.dataset_normalized_inputs ? `
                        <div style="margin-top: 10px;">
                            <h6 style="color: #a5d610; margin-bottom: 5px;">Dataset Normalized Inputs:</h6>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; font-size: 0.8em;">
                                <div>Mileage: ${result.details.dataset_normalized_inputs.mileage}</div>
                                <div>RPM: ${result.details.dataset_normalized_inputs.rpm}</div>
                                <div>Temp (°F): ${result.details.dataset_normalized_inputs.temperature_f}</div>
                                <div>Temp Norm: ${result.details.dataset_normalized_inputs.temperature_normalized}</div>
                                <div>Oil Level: ${result.details.dataset_normalized_inputs.oil_level}</div>
                            </div>
                            <div style="margin-top: 8px; padding: 5px; background: #1a1a1a; border-radius: 4px; font-size: 0.75em; color: #888;">
                                <strong>Enhanced Features:</strong> Cross-factor analysis | Realistic thresholds | Intelligent fusion
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        }

        // Add warnings section if any input validation warnings exist
        let warningsHtml = '';
        if (result.warnings && result.warnings.length > 0) {
            warningsHtml = `
                <div style="margin-top: 15px; padding: 10px; background: #4a2c00; border-radius: 6px; border-left: 3px solid #FF9800;">
                    <h5 style="color: #FF9800; margin-bottom: 8px;">⚠ Input Warnings</h5>
                    <ul style="margin: 0; padding-left: 20px; color: #fff;">
                        ${result.warnings.map(warning => `<li style="margin-bottom: 3px;">${warning}</li>`).join('')}
                    </ul>
                </div>
            `;
        }
        
        predictionResult.innerHTML = `
            <div style="padding: 20px; border-radius: 10px; background: #333; border-left: 4px solid ${statusColor};">
                <div style="display: flex; align-items: center; margin-bottom: 15px;">
                    <span style="font-size: 2em; margin-right: 10px; color: ${statusColor};">${statusIcon}</span>
                    <div>
                        <h4 style="color: ${statusColor}; margin: 0; font-size: 1.5em;">${result.status}</h4>
                        <p style="margin: 5px 0 0 0; color: #ccc; font-size: 0.9em;">Confidence: ${result.confidence.toFixed(1)}%</p>
                    </div>
                </div>
                <p style="margin-bottom: 15px; line-height: 1.5; color: #fff;">${result.message}</p>
                <div style="font-size: 0.9em; color: #aaa;">
                    <strong>Analysis Source:</strong> ${result.source}
                </div>
                ${detailsHtml}
                ${warningsHtml}
            </div>
        `;
    }

    // Enhanced chatbot functionality
    chatInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    async function sendMessage() {
        const message = chatInput.value.trim();
        if (!message) return;

        // Add user message to chat
        addMessage(message, 'user');
        chatInput.value = '';

        // Show typing indicator
        const typingId = addMessage('CarBot is analyzing your question...', 'bot', true);

        try {
            const response = await fetch('/chatbot', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: message })
            });

            const result = await response.json();
            
            // Remove typing indicator
            removeMessage(typingId);
            
            // Add bot response
            addMessage(result.reply, 'bot');
            
            // Add helpful suggestions based on message content
            addSuggestions(message);
            
        } catch (error) {
            console.error('Error:', error);
            removeMessage(typingId);
            addMessage('Sorry, I encountered an error. Please try again.', 'bot');
        }
    }

    function addMessage(text, sender, isTyping = false) {
        const messageDiv = document.createElement('div');
        const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        messageDiv.id = messageId;
        messageDiv.className = `message ${sender}`;
        
        if (isTyping) {
            messageDiv.style.cssText = `
                margin: 5px 0;
                padding: 8px 12px;
                border-radius: 8px;
                max-width: 80%;
                word-wrap: break-word;
                background: #444;
                color: #a5d610;
                font-style: italic;
                animation: pulse 1.5s infinite;
            `;
        } else {
            messageDiv.style.cssText = `
                margin: 5px 0;
                padding: 8px 12px;
                border-radius: 8px;
                max-width: 80%;
                word-wrap: break-word;
                ${sender === 'user' ? 
                    'background: #a5d610; color: #000; margin-left: auto;' : 
                    'background: #444; color: #fff;'
                }
            `;
        }
        
        messageDiv.textContent = text;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        return messageId;
    }

    function removeMessage(messageId) {
        const messageDiv = document.getElementById(messageId);
        if (messageDiv) {
            messageDiv.remove();
        }
    }

    function addSuggestions(userMessage) {
        const suggestions = [];
        const msg = userMessage.toLowerCase();
        
        if (msg.includes('engine') || msg.includes('health')) {
            suggestions.push('Try the dashboard analysis', 'Check RPM ranges', 'Monitor temperature');
        } else if (msg.includes('rpm')) {
            suggestions.push('Enter RPM in dashboard', 'Check optimal range', 'Monitor engine speed');
        } else if (msg.includes('temperature') || msg.includes('temp')) {
            suggestions.push('Check temperature gauge', 'Monitor cooling system', 'Enter temp in dashboard');
        } else if (msg.includes('oil')) {
            suggestions.push('Check oil level', 'Schedule oil change', 'Monitor oil quality');
        } else if (msg.includes('maintenance') || msg.includes('service')) {
            suggestions.push('Run health analysis', 'Check maintenance schedule', 'Find workshop');
        } else {
            suggestions.push('Try engine analysis', 'Check dashboard', 'Ask about maintenance');
        }
        
        if (suggestions.length > 0) {
            setTimeout(() => {
                const suggestionDiv = document.createElement('div');
                suggestionDiv.className = 'suggestions';
                suggestionDiv.style.cssText = `
                    margin: 5px 0;
                    padding: 8px;
                    background: #2a2a2a;
                    border-radius: 6px;
                    font-size: 0.8em;
                    color: #a5d610;
                `;
                suggestionDiv.innerHTML = `
                    <strong>Suggestions:</strong><br>
                    ${suggestions.map(s => `• ${s}`).join('<br>')}
                `;
                chatMessages.appendChild(suggestionDiv);
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }, 1000);
        }
    }

    // Initialize with sample data
    displayPrediction({
        status: 'Good',
        confidence: 85.2,
        message: 'Engine looks healthy.',
        source: 'heuristic'
    });
});
