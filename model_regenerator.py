import os
import logging
import numpy as np
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers, regularizers

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def create_engine_health_model():
    """Create an improved model for engine health prediction"""
    # Create a more sophisticated model with proper regularization
    model = keras.Sequential([
        # Input layer with normalization
        layers.InputLayer(shape=(4,)),
        layers.Normalization(axis=-1),
        
        # First hidden layer
        layers.Dense(32, 
                     activation='relu', 
                     kernel_regularizer=regularizers.l2(0.001),
                     name='hidden_layer_1'),
        layers.Dropout(0.2),
        
        # Second hidden layer
        layers.Dense(16, 
                     activation='relu', 
                     kernel_regularizer=regularizers.l2(0.001),
                     name='hidden_layer_2'),
        layers.Dropout(0.2),
        
        # Output layer
        layers.Dense(1, activation='sigmoid', name='health_score')
    ])
    
    # Compile the model with a more appropriate learning rate
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.001),
        loss='binary_crossentropy',
        metrics=['accuracy']
    )
    
    # Generate more realistic synthetic data for engine health
    # Features: [normalized_mileage, rpm_ratio, engine_temp_ratio, oil_level_ratio]
    num_samples = 1000
    
    # Mileage between 0 and 200,000
    mileage = np.random.uniform(0, 200000, (num_samples, 1)) / 200000
    
    # RPM between 500 and 5000
    rpm = np.random.uniform(500, 5000, (num_samples, 1)) / 5000
    
    # Temperature between 60 and 250 (Fahrenheit)
    temp = np.random.uniform(60, 250, (num_samples, 1)) / 250
    
    # Oil level between 20% and 100%
    oil = np.random.uniform(0.2, 1.0, (num_samples, 1))
    
    # Combine features
    X_train = np.hstack([mileage, rpm, temp, oil])
    
    # Generate labels based on a realistic formula:
    # - Higher mileage is bad
    # - Extreme RPM is bad
    # - High temperature is bad
    # - Low oil is bad
    y_train = np.zeros((num_samples, 1))
    
    for i in range(num_samples):
        # Base health score starts high and decreases with issues
        health = 1.0
        
        # Mileage impact (0-0.4)
        health -= mileage[i, 0] * 0.4
        
        # RPM impact - extreme values are bad (0-0.2)
        rpm_impact = abs(rpm[i, 0] - 0.5) * 0.4  # Optimal RPM around 2500
        health -= rpm_impact
        
        # Temperature impact - high temps are bad (0-0.2)
        temp_impact = max(0, (temp[i, 0] - 0.6) * 0.5)  # Temps above 150F are concerning
        health -= temp_impact
        
        # Oil level impact - low oil is bad (0-0.2)
        oil_impact = (1 - oil[i, 0]) * 0.2
        health -= oil_impact
        
        # Add some randomness
        health += np.random.normal(0, 0.05)
        
        # Ensure value is between 0 and 1
        health = max(0, min(1, health))
        
        y_train[i, 0] = round(health)  # Binary classification 0=bad, 1=good
    
    # Train the model
    model.fit(
        X_train, y_train,
        epochs=10,
        batch_size=32,
        validation_split=0.2,
        verbose=0
    )
    
    return model

def create_chatbot_model():
    """Create a more sophisticated model for chatbot intent classification"""
    # Create a more advanced NLP model
    vocab_size = 30   # Size of our vocabulary
    embedding_dim = 32  # Embedding dimension
    max_length = 20     # Max sequence length
    
    model = keras.Sequential([
        # Embedding layer
        layers.Embedding(
            input_dim=vocab_size,
            output_dim=embedding_dim,
            input_length=max_length
        ),
        
        # Bidirectional LSTM
        layers.Bidirectional(layers.LSTM(32, return_sequences=True)),
        layers.Dropout(0.2),
        
        # Global pooling to reduce sequence dimension
        layers.GlobalAveragePooling1D(),
        
        # Dense layers
        layers.Dense(64, activation='relu'),
        layers.Dropout(0.3),
        layers.Dense(32, activation='relu'),
        
        # Output layer - 25 intent classes
        layers.Dense(25, activation='softmax')
    ])
    
    # Compile with categorical crossentropy (multi-class classification)
    model.compile(
        optimizer='adam',
        loss='sparse_categorical_crossentropy',
        metrics=['accuracy']
    )
    
    # Generate better training data
    # In a real scenario, we would use actual text data with intents
    
    # Generate synthetic token sequences
    X_train = np.zeros((500, max_length))
    y_train = np.zeros((500,))
    
    # Create 20 samples per intent class (25 classes)
    for intent in range(25):
        # For each intent, create 20 samples
        for i in range(20):
            sample_idx = intent * 20 + i
            
            # Fill sequence with some random tokens + intent-specific tokens
            sequence = np.random.randint(1, vocab_size, max_length)
            
            # Add some intent-specific patterns
            sequence[0] = intent % 10 + 1  # First word hints at intent
            sequence[1] = (intent // 5) + 1  # Second word adds more signal
            
            X_train[sample_idx] = sequence
            y_train[sample_idx] = intent
    
    # Train the model
    model.fit(
        X_train, y_train,
        epochs=15,
        batch_size=32,
        validation_split=0.2,
        verbose=0
    )
    
    return model

def check_and_regenerate_models():
    """Check if models exist and are valid, regenerate if needed"""
    models_dir = 'models'
    os.makedirs(models_dir, exist_ok=True)
    
    # Check and regenerate engine health model
    engine_model_path = os.path.join(models_dir, 'engine_health_model.h5')
    try:
        # Always regenerate models to ensure they're valid
        logger.info("Generating new engine health model...")
        engine_model = create_engine_health_model()
        engine_model.save(engine_model_path)
        logger.info(f"New engine health model saved to {engine_model_path}")
        
        # Verify the saved model
        test_model = keras.models.load_model(engine_model_path)
        test_input = np.array([[0.2, 0.3, 0.4, 0.9]])
        prediction = test_model.predict(test_input)
        logger.info(f"Engine health model verification successful: {prediction}")
        
    except Exception as e:
        logger.error(f"Engine health model generation error: {e}")
        return False
    
    # Check and regenerate chatbot model
    chatbot_model_path = os.path.join(models_dir, 'chatbot_model.h5')
    try:
        # Always regenerate models to ensure they're valid
        logger.info("Generating new chatbot model...")
        chatbot_model = create_chatbot_model()
        chatbot_model.save(chatbot_model_path)
        logger.info(f"New chatbot model saved to {chatbot_model_path}")
        
        # Verify the saved model
        test_model = keras.models.load_model(chatbot_model_path)
        test_input = np.zeros((1, 20))
        prediction = test_model.predict(test_input)
        logger.info(f"Chatbot model verification successful: {prediction.shape}")
        
    except Exception as e:
        logger.error(f"Chatbot model generation error: {e}")
        return False
    
    return True

if __name__ == "__main__":
    logger.info("Starting model verification and regeneration...")
    result = check_and_regenerate_models()
    if result:
        logger.info("Model verification and regeneration completed successfully")
    else:
        logger.error("Failed to verify and regenerate models") 