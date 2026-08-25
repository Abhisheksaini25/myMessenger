"""
Firebase Cloud Messaging (FCM) push notification utility.

Initializes Firebase Admin SDK and provides a helper function
to send push notifications to Android APK clients.
"""
import os
import json
import logging
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, messaging

logger = logging.getLogger(__name__)

# Resolve the Firebase service account JSON relative to the backend/ directory
BASE_DIR = Path(__file__).resolve().parent.parent
FIREBASE_CREDENTIALS_PATH = os.environ.get(
    "FIREBASE_CREDENTIALS_PATH",
    str(BASE_DIR / "mymessenger-dfa86-firebase-adminsdk-fbsvc-b834e160dc.json"),
)

# Initialize Firebase Admin SDK (only once)
if not firebase_admin._apps:
    firebase_json_env = os.environ.get("FIREBASE_CREDENTIALS_JSON")
    
    if firebase_json_env:
        # Load directly from Vercel Environment Variable
        cred_dict = json.loads(firebase_json_env)
        cred = credentials.Certificate(cred_dict)
    elif os.path.exists(FIREBASE_CREDENTIALS_PATH):
        # Fallback to local file path (for local dev & Render)
        cred = credentials.Certificate(FIREBASE_CREDENTIALS_PATH)
    else:
        logger.warning("No Firebase credentials found.")
        cred = None
    if cred:
        firebase_admin.initialize_app(cred)


def send_push_notification(token: str, title: str, body: str) -> bool:
    """
    Send a push notification via Firebase Cloud Messaging.

    Args:
        token: The recipient's FCM device token.
        title: Notification title.
        body: Notification body text.

    Returns:
        True if sent successfully, False otherwise.
    """
    if not token:
        logger.warning("FCM send skipped: no token provided.")
        return False

    try:
        message = messaging.Message(
            notification=messaging.Notification(
                title=title,
                body=body,
            ),
            token=token,
        )
        response = messaging.send(message)
        logger.info(f"FCM sent successfully: {response}")
        print("FCM sent:", response)
        return True

    except Exception as e:
        logger.error(f"FCM send error: {e}")
        print("FCM error:", str(e))
        return False