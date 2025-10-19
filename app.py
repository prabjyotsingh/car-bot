from flask import Flask, send_from_directory, render_template_string, request, jsonify
import os
import json

app = Flask(__name__, static_folder='static', static_url_path='/static')

# Map of routes to html files in project root
ROUTES = {
    '/': 'index.html',
    '/login': 'login.html',
    '/signup': 'signup.html',
    '/models': 'models.html',
    '/my-cars': 'my-cars.html',
    '/product': 'product.html',
    '/workshop': 'workshop.html',
    '/dashboard': 'dashboard.html',
}

# In-memory store for demo purposes
CARS = []

# Lazy-loaded ML model
_tf_model = None

def _load_tf_model():
    global _tf_model
    if _tf_model is not None:
        return _tf_model
    try:
        from tensorflow import keras
        model_path = os.path.join('models', 'engine_health_model.h5')
        if os.path.isfile(model_path):
            _tf_model = keras.models.load_model(model_path)
        return _tf_model
    except Exception:
        return None


def _dataset_heuristic_prediction(mileage, rpm, temperature, oil_level):
    """Dataset-based heuristic that matches the actual training data patterns from model_regenerator.py"""
    # Input validation and bounds checking (matching training data ranges)
    mileage = max(0, min(200000, mileage))  # Training data: 0-200,000 km
    rpm = max(500, min(5000, rpm))  # Training data: 500-5000 RPM
    temperature = max(60, min(150, temperature))  # Training data: 60-150°C
    oil_level = max(20, min(100, oil_level))  # Training data: 20-100%
    
    # Convert temperature to Fahrenheit for dataset compatibility (training was in Fahrenheit)
    temp_fahrenheit = (temperature * 9/5) + 32
    
    # Normalize inputs EXACTLY as in training data
    normalized_mileage = mileage / 200000.0  # 0-1 range
    normalized_rpm = rpm / 5000.0  # 0-1 range  
    normalized_temp = temp_fahrenheit / 250.0  # 0-1 range (60-250°F)
    normalized_oil = oil_level / 100.0  # 0.2-1.0 range (20-100%)
    
    # Apply the EXACT same formula used in training data generation
    health = 1.0  # Start with perfect health
    
    # Mileage impact (0-0.4) - exactly as in training
    health -= normalized_mileage * 0.4
    
    # RPM impact - extreme values are bad (0-0.2) - exactly as in training
    rpm_impact = abs(normalized_rpm - 0.5) * 0.4  # Optimal RPM around 2500 (0.5 normalized)
    health -= rpm_impact
    
    # Temperature impact - high temps are bad (0-0.2) - exactly as in training
    temp_impact = max(0, (normalized_temp - 0.6) * 0.5)  # Temps above 150°F (0.6 normalized) are concerning
    health -= temp_impact
    
    # Oil level impact - low oil is bad (0-0.2) - exactly as in training
    oil_impact = (1 - normalized_oil) * 0.2
    health -= oil_impact
    
    # Add some realistic randomness (matching training data)
    import random
    health += random.normalvariate(0, 0.05)
    
    # Ensure value is between 0 and 1
    health = max(0.0, min(1.0, health))
    
    # Convert to percentage
    score = health * 100
    
    # Status determination based on training data patterns
    if score >= 80:
        status = 'Good'
        message = 'Engine is in excellent condition based on dataset analysis.'
    elif score >= 65:
        status = 'Good'
        message = 'Engine is healthy with minor optimizations possible.'
    elif score >= 45:
        status = 'Warning'
        message = 'Engine shows signs of wear - consider maintenance soon.'
    elif score >= 25:
        status = 'Warning'
        message = 'Engine requires attention - schedule service appointment.'
    else:
        status = 'Bad'
        message = 'Engine condition critical - immediate service required.'
    
    return status, score, message

def _heuristic_prediction(mileage, rpm, temperature, oil_level):
    """Fallback heuristic that closely matches the training data patterns"""
    # Input validation (matching training data ranges)
    mileage = max(0, min(200000, mileage))  # Training data: 0-200,000 km
    rpm = max(500, min(5000, rpm))  # Training data: 500-5000 RPM
    temperature = max(60, min(150, temperature))  # Training data: 60-150°C
    oil_level = max(20, min(100, oil_level))  # Training data: 20-100%
    
    # Convert temperature to Fahrenheit for consistency
    temp_fahrenheit = (temperature * 9/5) + 32
    
    # Normalize inputs as in training data
    normalized_mileage = mileage / 200000.0
    normalized_rpm = rpm / 5000.0
    normalized_temp = temp_fahrenheit / 250.0
    normalized_oil = oil_level / 100.0
    
    # Apply similar logic to training data but with more conservative scoring
    health = 1.0
    
    # Mileage impact (progressive wear)
    health -= normalized_mileage * 0.35  # Slightly less aggressive than training
    
    # RPM impact (optimal around 2500 RPM)
    rpm_deviation = abs(normalized_rpm - 0.5)  # 0.5 = 2500 RPM
    health -= rpm_deviation * 0.3  # Less aggressive than training
    
    # Temperature impact (critical above 150°F)
    if normalized_temp > 0.6:  # Above 150°F
        temp_impact = (normalized_temp - 0.6) * 0.4
        health -= temp_impact
    elif normalized_temp < 0.4:  # Below 100°F
        health -= 0.05  # Slight penalty for too cold
    
    # Oil level impact
    oil_impact = (1 - normalized_oil) * 0.15  # Less aggressive than training
    health -= oil_impact
    
    # Cross-factor penalties
    if normalized_rpm > 0.6 and normalized_temp > 0.6:  # High RPM + High temp
        health -= 0.1
    
    if normalized_oil < 0.4 and normalized_temp > 0.6:  # Low oil + High temp
        health -= 0.15
    
    if normalized_mileage > 0.7 and normalized_temp > 0.6:  # High mileage + High temp
        health -= 0.08
    
    # Ensure health stays within bounds
    health = max(0.0, min(1.0, health))
    
    # Convert to percentage
    score = health * 100
    
    # Status determination (matching dataset heuristic)
    if score >= 80:
        status = 'Good'
        message = 'Engine is in excellent condition based on comprehensive analysis.'
    elif score >= 65:
        status = 'Good'
        message = 'Engine is healthy with minor optimizations possible.'
    elif score >= 45:
        status = 'Warning'
        message = 'Engine shows signs of wear - consider maintenance soon.'
    elif score >= 25:
        status = 'Warning'
        message = 'Engine requires attention - schedule service appointment.'
    else:
        status = 'Bad'
        message = 'Engine condition critical - immediate service required.'
    
    return status, score, message

# API: Model info
@app.get('/model-info')
def get_model_info():
    filepath = 'model_info.json'
    if not os.path.isfile(filepath):
        return jsonify({"error": "model_info.json not found"}), 404
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": f"Failed to read model info: {e}"}), 500

# API: Enhanced Chatbot based on dataset patterns
@app.post('/chatbot')
def chatbot_reply():
    try:
        payload = request.get_json(force=True) or {}
        message = (payload.get('message') or '').lower()
        
        def get_reply(msg: str) -> str:
            # Engine health related queries
            if any(word in msg for word in ['engine', 'motor', 'health', 'diagnostic', 'check']):
                return "I can analyze your engine health! Enter your RPM (500-5000), temperature (60-120°C), oil level (20-100%), and mileage (0-200k km) in the dashboard for a comprehensive analysis based on our dataset patterns."
            
            # RPM related queries
            if any(word in msg for word in ['rpm', 'revolution', 'speed', 'idle', 'rev']):
                return "RPM analysis: Optimal range is 2000-2500 RPM. Below 1000 RPM may indicate stalling issues, above 4000 RPM causes engine stress. Our dataset shows engines perform best around 2250 RPM."
            
            # Temperature related queries
            if any(word in msg for word in ['temperature', 'temp', 'hot', 'overheat', 'cooling']):
                return "Temperature guidance: Normal operating range is 80-95°C (176-203°F). Critical threshold is 105°C (221°F). Our dataset indicates engines above 180°F show significant wear patterns."
            
            # Oil related queries
            if any(word in msg for word in ['oil', 'lubrication', 'level', 'change']):
                return "Oil level analysis: Maintain 80-100% for optimal performance. Below 30% is critical, 30-50% requires attention. Our dataset shows severe penalties for oil levels below 30%."
            
            # Mileage related queries
            if any(word in msg for word in ['mileage', 'kilometers', 'km', 'distance', 'odometer']):
                return "Mileage insights: Our dataset covers 0-200,000 km range. High mileage (>150k km) shows increased wear patterns. Linear normalization helps predict maintenance needs."
            
            # Maintenance related queries
            if any(word in msg for word in ['maintenance', 'service', 'repair', 'fix', 'problem']):
                return "Maintenance recommendations: Based on our dataset analysis, engines scoring below 50% need immediate attention. Cross-factor analysis detects dangerous combinations like high RPM + high temperature."
            
            # Workshop related queries
            if any(word in msg for word in ['workshop', 'mechanic', 'garage', 'service center', 'repair shop']):
                return "Workshop finder: I can help locate nearby service centers. For critical issues (confidence <30%), seek immediate professional help. Our analysis helps prioritize urgency."
            
            # Product related queries
            if any(word in msg for word in ['product', 'parts', 'oil filter', 'air filter', 'spark plug']):
                return "Product recommendations: Browse our catalog for engine oils, filters, and maintenance parts. Products are selected based on engine health analysis and dataset patterns."
            
            # Dataset related queries
            if any(word in msg for word in ['dataset', 'data', 'analysis', 'model', 'prediction']):
                return "Dataset info: Our analysis uses 4 factors - RPM (500-5000), Temperature (60-250°F), Oil Level (20-100%), Mileage (0-200k km). ML model + enhanced heuristic provide accurate predictions."
            
            # Greeting queries
            if any(word in msg for word in ['hi', 'hello', 'hey', 'good morning', 'good afternoon']):
                return "Hello! I'm CarBot, your AI engine health assistant. I can analyze engine data, provide maintenance advice, and help with car-related questions based on our comprehensive dataset. What would you like to know?"
            
            # Help queries
            if any(word in msg for word in ['help', 'assist', 'support', 'guide']):
                return "I can help with: Engine health analysis, RPM/temperature/oil guidance, maintenance recommendations, workshop locations, product suggestions, and dataset insights. Just ask!"
            
            # Default response with dataset context
            return "I'm CarBot, specialized in engine health analysis! Ask me about RPM ranges (500-5000), temperature thresholds (60-120°C), oil levels (20-100%), mileage patterns (0-200k km), or maintenance recommendations based on our dataset."
        
        return jsonify({"reply": get_reply(message)})
    except Exception as e:
        return jsonify({"error": f"Failed to process message: {e}"}), 400

# API: Dashboard stubs
@app.get('/get-cars')
def get_cars():
    return jsonify({"cars": CARS})

@app.post('/add-vehicle')
def add_vehicle():
    try:
        payload = request.get_json(force=True) or {}
        raw_mileage = payload.get('mileage', 0)
        try:
            mileage_val = int(float(raw_mileage)) if raw_mileage not in (None, '') else 0
        except Exception:
            mileage_val = 0
        car = {
            "carName": (payload.get('carName') or '').strip(),
            "mileage": mileage_val,
            "engine": (payload.get('engine') or '').strip(),
        }
        if not car["carName"]:
            return jsonify({"ok": False, "error": "carName is required"}), 400
        CARS.append(car)
        return jsonify({"ok": True, "car": car})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 400

@app.post('/add-car')
def add_car():
    try:
        payload = request.get_json(force=True) or {}
        def as_int(value, default=0):
            try:
                return int(value)
            except Exception:
                return default
        car = {
            "id": str(len(CARS) + 1),
            "make": (payload.get('make') or '').strip(),
            "model": (payload.get('model') or '').strip(),
            "year": as_int(payload.get('year'), 2020),
            "engine": (payload.get('engine') or '').strip(),
            "color": (payload.get('color') or '').strip(),
            "notes": (payload.get('notes') or '').strip(),
            "status": payload.get('status') or 'Good',
            "rpm": as_int(payload.get('rpm'), 1200),
            "temperature": as_int(payload.get('temperature'), 85),
            "oil_level": as_int(payload.get('oil_level'), 95)
        }
        if not car["make"] or not car["model"]:
            return jsonify({"ok": False, "error": "make and model are required"}), 400
        CARS.append(car)
        return jsonify({"ok": True, "car": car})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 400

@app.post('/update-car')
def update_car():
    try:
        payload = request.get_json(force=True) or {}
        car_id = str(payload.get('id'))
        if not car_id:
            return jsonify({"ok": False, "error": "id is required"}), 400
        def as_int(value, default=0):
            try:
                return int(value)
            except Exception:
                return default
        updated = None
        for car in CARS:
            if car.get('id') == car_id:
                car['make'] = (payload.get('make') or car.get('make') or '').strip()
                car['model'] = (payload.get('model') or car.get('model') or '').strip()
                car['year'] = as_int(payload.get('year'), car.get('year', 2020))
                # mileage removed
                car['engine'] = (payload.get('engine') or car.get('engine') or '').strip()
                car['color'] = (payload.get('color') or car.get('color') or '').strip()
                car['notes'] = (payload.get('notes') or car.get('notes') or '').strip()
                car['rpm'] = as_int(payload.get('rpm'), car.get('rpm', 1200))
                car['temperature'] = as_int(payload.get('temperature'), car.get('temperature', 85))
                car['oil_level'] = as_int(payload.get('oil_level'), car.get('oil_level', 95))
                updated = car
                break
        if not updated:
            return jsonify({"ok": False, "error": "car not found"}), 404
        return jsonify({"ok": True, "car": updated})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 400

@app.post('/delete-car')
def delete_car():
    try:
        payload = request.get_json(force=True) or {}
        car_id = str(payload.get('id'))
        if not car_id:
            return jsonify({"success": False, "error": "id is required"}), 400
        
        # Find and remove the car
        car_found = False
        for i, car in enumerate(CARS):
            if car.get('id') == car_id:
                deleted_car = CARS.pop(i)
                car_found = True
                break
        
        if not car_found:
            return jsonify({"success": False, "error": "car not found"}), 404
        
        return jsonify({"success": True, "message": "Car deleted successfully", "deleted_car": deleted_car})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400

@app.post('/predict-engine-health')
def predict_engine_health():
    try:
        payload = request.get_json(force=True) or {}
        
        # Enhanced input validation with better defaults
        try:
            mileage = float(payload.get('mileage', 5000) or 5000)
            rpm = float(payload.get('rpm', 1200) or 1200)
            temperature = float(payload.get('temperature', 85) or 85)
            oil_level = float(payload.get('oil_level', 95) or 95)
        except (ValueError, TypeError) as e:
            return jsonify({"error": f"Invalid input values: {e}"}), 400
        
        # Validate input ranges (matching training data ranges)
        if not (0 <= mileage <= 200000):
            return jsonify({"error": "Mileage must be between 0 and 200,000 km"}), 400
        if not (500 <= rpm <= 5000):
            return jsonify({"error": "RPM must be between 500 and 5,000"}), 400
        if not (60 <= temperature <= 150):
            return jsonify({"error": "Temperature must be between 60°C and 150°C"}), 400
        if not (20 <= oil_level <= 100):
            return jsonify({"error": "Oil level must be between 20% and 100%"}), 400

        # Try ML model
        model = _load_tf_model()
        if model is not None:
            import numpy as np
            # Use EXACT dataset normalization as per training data from model_regenerator.py
            # Dataset was trained with these exact ranges and normalization
            
            # Mileage: 0-200,000 km -> 0-1 (linear normalization as in training)
            normalized_mileage = mileage / 200000.0
            
            # RPM: 500-5000 -> 0-1 (exact training range)
            normalized_rpm = rpm / 5000.0
            
            # Temperature: 60-250°F -> 0-1 (original training was in Fahrenheit)
            # Convert Celsius to Fahrenheit for dataset compatibility
            temp_fahrenheit = (temperature * 9/5) + 32
            normalized_temp = temp_fahrenheit / 250.0
            
            # Oil level: 20%-100% -> 0.2-1.0 (exact training range)
            normalized_oil = oil_level / 100.0
            
            x = np.array([[
                normalized_mileage,
                normalized_rpm,
                normalized_temp,
                normalized_oil
            ]], dtype=np.float32)
            
            try:
                prob_good = float(model.predict(x, verbose=0)[0][0])  # 0..1
                
                # Use dataset-based heuristic (matching training formula)
                h_status, h_score, h_message = _dataset_heuristic_prediction(mileage, rpm, temperature, oil_level)
                h_prob_good = h_score / 100.0
                
                # Improved fusion logic with better confidence assessment
                ml_confidence = abs(prob_good - 0.5) * 2  # 0-1 scale
                
                # Determine fusion weights based on input characteristics and model confidence
                extreme_values = (normalized_mileage > 0.8 or normalized_temp > 0.8 or 
                                normalized_oil < 0.3 or normalized_rpm > 0.8)
                
                if extreme_values:
                    # Extreme values - trust heuristic more (70% heuristic, 30% ML)
                    ml_weight = 0.3
                    heuristic_weight = 0.7
                elif ml_confidence > 0.8 and not extreme_values:
                    # High model confidence + normal values - trust model more
                    ml_weight = 0.8
                    heuristic_weight = 0.2
                elif ml_confidence > 0.6:
                    # Moderate confidence - balanced approach
                    ml_weight = 0.6
                    heuristic_weight = 0.4
                else:
                    # Low confidence - trust heuristic more
                    ml_weight = 0.4
                    heuristic_weight = 0.6
                
                # Weighted fusion with confidence adjustment
                fused_good = ml_weight * prob_good + heuristic_weight * h_prob_good
                
                # Apply confidence scaling to final result
                confidence_factor = min(1.0, (ml_confidence + 0.5) / 1.5)
                fused_good = fused_good * confidence_factor + (1 - confidence_factor) * h_prob_good
                
                # Convert to percentage with calibration
                confidence = max(0.0, min(100.0, fused_good * 100.0))
                
                # Enhanced status determination with improved thresholds
                if confidence >= 85:
                    status = 'Good'
                    message = 'Engine is in excellent condition. All systems operating optimally.'
                elif confidence >= 70:
                    status = 'Good'
                    message = 'Engine is healthy with minor optimizations possible.'
                elif confidence >= 55:
                    status = 'Warning'
                    message = 'Engine shows signs of wear. Consider maintenance within 2-3 months.'
                elif confidence >= 35:
                    status = 'Warning'
                    message = 'Engine requires attention. Schedule service appointment soon.'
                elif confidence >= 20:
                    status = 'Bad'
                    message = 'Engine condition poor. Immediate inspection recommended.'
                else:
                    status = 'Bad'
                    message = 'Engine condition critical. Emergency service required immediately.'
                
                return jsonify({
                    "status": status,
                    "confidence": confidence,
                    "message": message,
                    "source": "enhanced_dataset_analysis",
                    "details": {
                        "model_prob_good": round(prob_good, 4),
                        "heuristic_prob_good": round(h_prob_good, 4),
                        "ml_weight": round(ml_weight, 3),
                        "heuristic_weight": round(heuristic_weight, 3),
                        "ml_confidence": round(ml_confidence, 3),
                        "dataset_normalized_inputs": {
                            "mileage": round(normalized_mileage, 3),
                            "rpm": round(normalized_rpm, 3),
                            "temperature_f": round(temp_fahrenheit, 1),
                            "temperature_normalized": round(normalized_temp, 3),
                            "oil_level": round(normalized_oil, 3)
                        }
                    }
                })
            except Exception as e:
                # Log the error for debugging
                print(f"ML model prediction error: {e}")
                pass

        # Fallback heuristic
        status, score, message = _heuristic_prediction(mileage, rpm, temperature, oil_level)
        return jsonify({
            "status": status,
            "confidence": score,
            "message": message,
            "source": "heuristic"
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/favicon.ico')
def favicon():
    # Return 204 to avoid log noise if no favicon is present
    return ('', 204)

@app.route('/<path:filename>')
def serve_file(filename):
    # Serve any root-level html directly if requested explicitly
    if filename.endswith('.html') and os.path.isfile(filename):
        return send_from_directory('.', filename)
    return send_from_directory('.', filename)

# Explicit routes for prettified paths
for route, html_file in ROUTES.items():
    def make_view(file):
        def view():
            if os.path.isfile(file):
                return send_from_directory('.', file)
            return render_template_string('<h1>File not found</h1>')
        return view
    app.add_url_rule(route, endpoint=route, view_func=make_view(html_file))

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    # Disable debug and reloader to avoid conflicts with TensorFlow file watching
    app.run(host='0.0.0.0', port=port, debug=False, use_reloader=False)
