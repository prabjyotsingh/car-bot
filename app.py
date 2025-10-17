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
    """Enhanced dataset-based heuristic using refined training formula"""
    # Convert temperature to Fahrenheit to match dataset
    temp_fahrenheit = (temperature * 9/5) + 32
    
    # Normalize inputs exactly as in dataset
    normalized_mileage = min(1.0, mileage / 200000.0)
    normalized_rpm = max(0.0, min(1.0, rpm / 5000.0))
    normalized_temp = max(0.0, min(1.0, temp_fahrenheit / 250.0))
    normalized_oil = max(0.2, min(1.0, oil_level / 100.0))
    
    # Enhanced dataset formula with more precise weights
    health = 1.0  # Start with perfect health
    
    # Mileage impact (0-0.35) - refined weight
    health -= normalized_mileage * 0.35
    
    # RPM impact - more precise optimal range
    # Optimal RPM around 2000-2500 (0.4-0.5 normalized)
    optimal_rpm = 0.45  # Slightly below 0.5 for better real-world performance
    rpm_deviation = abs(normalized_rpm - optimal_rpm)
    health -= rpm_deviation * 0.5  # Increased sensitivity to RPM deviation
    
    # Temperature impact - more realistic thresholds
    # Critical threshold at 180°F (0.72 normalized) instead of 150°F
    temp_critical = 0.72
    if normalized_temp > temp_critical:
        temp_impact = (normalized_temp - temp_critical) * 0.6
        health -= temp_impact
    elif normalized_temp < 0.4:  # Too cold (100°F)
        health -= 0.1
    
    # Oil level impact - more realistic curve
    if normalized_oil < 0.3:  # Below 30%
        oil_impact = (0.3 - normalized_oil) * 0.8  # Severe penalty
        health -= oil_impact
    elif normalized_oil < 0.5:  # 30-50%
        oil_impact = (0.5 - normalized_oil) * 0.3  # Moderate penalty
        health -= oil_impact
    
    # Cross-factor penalties for dangerous combinations
    # High RPM + High Temperature
    if normalized_rpm > 0.6 and normalized_temp > 0.6:
        health -= 0.15
    
    # Low Oil + High Temperature
    if normalized_oil < 0.4 and normalized_temp > 0.6:
        health -= 0.12
    
    # High Mileage + High Temperature
    if normalized_mileage > 0.7 and normalized_temp > 0.6:
        health -= 0.08
    
    # Ensure value is between 0 and 1
    health = max(0, min(1, health))
    
    # Convert to 0-100 score with better scaling
    score = health * 100
    
    # More accurate status determination based on dataset patterns
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
    """Enhanced heuristic prediction with more accurate analysis"""
    score = 100.0
    
    # Temperature analysis (most critical factor)
    if temperature < 80:
        score -= 5  # Too cold - inefficient operation
    elif temperature > 95:
        score -= (temperature - 95) * 2.0  # Overheating penalty
    elif temperature > 90:
        score -= (temperature - 90) * 1.0  # Warming up penalty
    
    # RPM analysis (optimal range 1000-3000)
    if rpm < 800:
        score -= 15  # Too low - stalling risk
    elif rpm > 4000:
        score -= (rpm - 4000) * 0.02  # High RPM stress
    elif rpm < 1000 or rpm > 3000:
        score -= 5  # Outside optimal range
    
    # Oil level analysis
    if oil_level < 20:
        score -= 30  # Critical oil level
    elif oil_level < 50:
        score -= (50 - oil_level) * 0.5  # Low oil penalty
    elif oil_level > 95:
        score -= 5  # Overfilled
    
    # Mileage analysis (wear factor)
    if mileage > 150000:
        score -= (mileage - 150000) * 0.0001  # High mileage wear
    elif mileage > 100000:
        score -= (mileage - 100000) * 0.00005  # Moderate mileage wear
    
    # Cross-factor analysis
    # High RPM + High Temperature = dangerous combination
    if rpm > 3000 and temperature > 90:
        score -= 10
    
    # Low oil + High temperature = engine damage risk
    if oil_level < 30 and temperature > 85:
        score -= 15
    
    # High mileage + High temperature = aging engine stress
    if mileage > 100000 and temperature > 90:
        score -= 8
    
    # Ensure score stays within bounds
    score = max(0, min(100, score))
    
    # Enhanced status determination
    if score >= 80:
        status = 'Good'
        message = 'Engine is in excellent condition. All systems operating normally.'
    elif score >= 60:
        status = 'Good'
        message = 'Engine is healthy with minor optimizations possible.'
    elif score >= 45:
        status = 'Warning'
        message = 'Engine shows signs of stress. Consider maintenance soon.'
    elif score >= 25:
        status = 'Warning'
        message = 'Engine requires attention. Schedule service appointment.'
    else:
        status = 'Bad'
        message = 'Engine condition critical. Immediate service required.'
    
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

@app.post('/predict-engine-health')
def predict_engine_health():
    try:
        payload = request.get_json(force=True) or {}
        mileage = float(payload.get('mileage', 5000) or 5000)
        rpm = float(payload.get('rpm', 1200) or 1200)
        temperature = float(payload.get('temperature', 85) or 85)
        oil_level = float(payload.get('oil_level', 95) or 95)

        # Try ML model
        model = _load_tf_model()
        if model is not None:
            import numpy as np
            # Use EXACT dataset normalization as per training data
            # Dataset was trained with these exact ranges and normalization
            
            # Mileage: 0-200,000 km -> 0-1 (linear normalization as in training)
            normalized_mileage = min(1.0, mileage / 200000.0)
            
            # RPM: 500-5000 -> 0-1 (exact training range)
            normalized_rpm = max(0.0, min(1.0, rpm / 5000.0))
            
            # Temperature: 60-250°F -> 0-1 (original training was in Fahrenheit)
            # Convert Celsius to Fahrenheit for dataset compatibility
            temp_fahrenheit = (temperature * 9/5) + 32
            normalized_temp = max(0.0, min(1.0, temp_fahrenheit / 250.0))
            
            # Oil level: 20%-100% -> 0-1 (minimum 20% as per training data)
            normalized_oil = max(0.2, min(1.0, oil_level / 100.0))
            
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
                
                # Intelligent fusion based on model confidence and input quality
                ml_confidence = abs(prob_good - 0.5) * 2  # 0-1 scale
                
                # Adjust weights based on input ranges and model confidence
                if normalized_mileage > 0.8 or normalized_temp > 0.8 or normalized_oil < 0.3:
                    # Extreme values - trust heuristic more
                    ml_weight = 0.3
                    heuristic_weight = 0.7
                elif ml_confidence > 0.7:
                    # High model confidence - trust model more
                    ml_weight = 0.7
                    heuristic_weight = 0.3
                else:
                    # Balanced approach
                    ml_weight = 0.5
                    heuristic_weight = 0.5
                
                fused_good = ml_weight * prob_good + heuristic_weight * h_prob_good
                
                # Convert to percentage with calibration
                confidence = max(0.0, min(100.0, fused_good * 100.0))
                
                # Enhanced status determination with more accurate thresholds
                if confidence >= 80:
                    status = 'Good'
                    message = 'Engine is in excellent condition based on comprehensive analysis.'
                elif confidence >= 65:
                    status = 'Good'
                    message = 'Engine is healthy with minor optimizations possible.'
                elif confidence >= 50:
                    status = 'Warning'
                    message = 'Engine shows signs of wear - consider maintenance soon.'
                elif confidence >= 30:
                    status = 'Warning'
                    message = 'Engine requires attention - schedule service appointment.'
                elif confidence >= 15:
                    status = 'Bad'
                    message = 'Engine condition poor - immediate inspection recommended.'
                else:
                    status = 'Bad'
                    message = 'Engine condition critical - emergency service required.'
                
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
