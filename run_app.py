import os
import sys
import logging
import subprocess

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def main():
    logger.info("Starting CarBot application setup...")
    
    # Step 1: Check and regenerate models if needed
    logger.info("Step 1: Making sure ML models are available...")
    try:
        import model_regenerator
        result = model_regenerator.check_and_regenerate_models()
        if not result:
            logger.error("Failed to create ML models! Application may not work correctly.")
            choice = input("Continue anyway? (y/n): ").strip().lower()
            if choice != 'y':
                logger.info("Exiting application setup.")
                return
        else:
            logger.info("ML models successfully verified/regenerated.")
    except Exception as e:
        logger.error(f"Error during model regeneration: {e}")
        choice = input("Continue without ML models? (y/n): ").strip().lower()
        if choice != 'y':
            logger.info("Exiting application setup.")
            return
    
    # Step 2: Run the Flask application
    logger.info("Step 2: Starting Flask application...")
    try:
        # Run the app.py script
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