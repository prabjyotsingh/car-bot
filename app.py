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


def _heuristic_prediction(mileage, rpm, temperature, oil_level):
    score = 100
    # mileage intentionally ignored for prediction calibration
    score -= max(0, (temperature - 90) * 0.5)
    score -= max(0, (1500 - rpm) * 0.01)
    score -= max(0, (100 - oil_level) * 0.3)
    score = max(0, min(100, score))
    status = 'Good' if score >= 70 else ('Warning' if score >= 40 else 'Bad')
    message = 'Engine looks healthy.' if status == 'Good' else ('Consider a check-up soon.' if status == 'Warning' else 'Service recommended.')
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

# API: Chatbot
@app.post('/chatbot')
def chatbot_reply():
    try:
        payload = request.get_json(force=True) or {}
        message = (payload.get('message') or '').lower()
        def get_reply(msg: str) -> str:
            if 'engine' in msg:
                return "I'm running diagnostics on your engine now."
            if 'workshop' in msg:
                return "Nearest workshop is 2km away. Want directions?"
            if 'product' in msg:
                return "You can browse oils, filters, and cleaning kits!"
            if 'hi' in msg or 'hello' in msg:
                return "Hey there! CarBot here — what can I help you with?"
            return "Hmm, I'm still learning! Try asking about your engine, a product, or a mechanic."
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
            # Model from model_regenerator expects 4 normalized features in [0,1]
            x = np.array([
                [
                    0.2,                                       # normalized_mileage (neutral placeholder)
                    max(0.0, min(1.0, rpm / 5000.0)),          # rpm_ratio
                    max(0.0, min(1.0, temperature / 250.0)),   # engine_temp_ratio
                    max(0.2, min(1.0, oil_level / 100.0)),     # oil_level_ratio (min 0.2 per generator)
                ]
            ], dtype=np.float32)
            try:
                prob_good = float(model.predict(x, verbose=0)[0][0])  # 0..1
                # Heuristic into 0..1 (convert 0..100 score)
                h_status, h_score, _ = _heuristic_prediction(mileage, rpm, temperature, oil_level)
                h_prob_good = h_score / 100.0
                # Simple fusion (weighted average)
                fused_good = 0.6 * prob_good + 0.4 * h_prob_good

                confidence = max(0.0, min(100.0, fused_good * 100.0))
                # Calibrated thresholds
                status = 'Good' if confidence >= 65 else ('Warning' if confidence >= 35 else 'Bad')
                message = 'Engine looks healthy.' if status == 'Good' else ('Consider a check-up soon.' if status == 'Warning' else 'Service recommended.')
                return jsonify({
                    "status": status,
                    "confidence": confidence,
                    "message": message,
                    "source": "model+heuristic",
                    "details": {
                        "model_prob_good": round(prob_good, 4),
                        "heuristic_prob_good": round(h_prob_good, 4)
                    }
                })
            except Exception:
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
    app.run(host='0.0.0.0', port=port, debug=True)
