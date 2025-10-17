import os
import sys
import logging
import subprocess

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def models_exist() -> bool:
    models_dir = 'models'
    expected = ['engine_health_model.h5', 'chatbot_model.h5']
    return all(os.path.isfile(os.path.join(models_dir, name)) for name in expected)


def main():
    logger.info("Starting CarBot application setup...")

    # Step 1: Check and regenerate models if needed
    logger.info("Step 1: Ensuring ML models are available...")
    try:
        if models_exist():
            logger.info("Models already exist. Skipping regeneration.")
        else:
            logger.info("Models missing. Generating models (this may take a minute)...")
            import model_regenerator
            result = model_regenerator.check_and_regenerate_models()
            if not result:
                logger.error("Failed to create ML models! Continuing without blocking.")
    except Exception as e:
        logger.error(f"Error during model regeneration: {e}")

    # Step 2: Run the Flask application
    logger.info("Step 2: Starting Flask application...")
    try:
        subprocess.run([sys.executable, "app.py"], check=True)
    except subprocess.CalledProcessError as e:
        logger.error(f"Error running Flask application: {e}")
    except KeyboardInterrupt:
        logger.info("Application stopped by user.")
    except Exception as e:
        logger.error(f"Unexpected error: {e}")

    logger.info("CarBot application shutdown complete.")


if __name__ == "__main__":
    main() 