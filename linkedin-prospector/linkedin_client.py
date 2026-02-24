"""
Safe LinkedIn wrapper with rate limiting, working-hours enforcement, and acceptance tracking.
"""

import time
import random
import logging
from datetime import datetime, timedelta
from threading import Lock
from linkedin_api import Linkedin

import config

logger = logging.getLogger(__name__)


class LinkedInClient:
    def __init__(self):
        self._api = None
        self._lock = Lock()
        self._paused = False

        # Daily counters (reset at midnight)
        self._connections_today = 0
        self._messages_today = 0
        self._last_reset_date = datetime.now().date()

        # Acceptance tracking
        self._total_sent = 0
        self._total_accepted = 0

    def login(self):
        if not config.LINKEDIN_EMAIL or not config.LINKEDIN_PASSWORD:
            logger.warning("LinkedIn credentials not configured, running in dry-run mode")
            return False
        try:
            self._api = Linkedin(config.LINKEDIN_EMAIL, config.LINKEDIN_PASSWORD)
            logger.info("LinkedIn login successful for %s", config.LINKEDIN_EMAIL)
            return True
        except Exception as e:
            logger.error("LinkedIn login failed: %s", e)
            return False

    @property
    def is_logged_in(self):
        return self._api is not None

    @property
    def is_paused(self):
        return self._paused

    def pause(self):
        self._paused = True
        logger.warning("LinkedIn client PAUSED")

    def resume(self):
        self._paused = False
        logger.info("LinkedIn client RESUMED")

    def _reset_daily_if_needed(self):
        today = datetime.now().date()
        if today != self._last_reset_date:
            self._connections_today = 0
            self._messages_today = 0
            self._last_reset_date = today
            logger.info("Daily counters reset")

    def _is_working_hours(self):
        now = datetime.now()
        return config.WORK_HOUR_START <= now.hour < config.WORK_HOUR_END

    def _is_weekend(self):
        return datetime.now().weekday() >= 5

    def _get_daily_connection_limit(self):
        return config.MAX_CONNECTIONS_WEEKEND if self._is_weekend() else config.MAX_CONNECTIONS_PER_DAY

    def _check_acceptance_rate(self):
        if self._total_sent < 20:
            return True  # Not enough data
        rate = self._total_accepted / self._total_sent
        if rate < config.MIN_ACCEPTANCE_RATE:
            logger.warning("Acceptance rate %.1f%% below threshold %.1f%%, auto-pausing",
                           rate * 100, config.MIN_ACCEPTANCE_RATE * 100)
            self.pause()
            return False
        return True

    def _random_delay(self):
        delay = random.randint(config.MIN_DELAY_SECONDS, config.MAX_DELAY_SECONDS)
        logger.debug("Waiting %d seconds before next action", delay)
        time.sleep(delay)

    def _can_send_connection(self):
        self._reset_daily_if_needed()
        if self._paused:
            logger.debug("Skipping: client is paused")
            return False
        if not self._is_working_hours():
            logger.debug("Skipping: outside working hours")
            return False
        if self._connections_today >= self._get_daily_connection_limit():
            logger.debug("Skipping: daily connection limit reached (%d)", self._connections_today)
            return False
        return self._check_acceptance_rate()

    def _can_send_message(self):
        self._reset_daily_if_needed()
        if self._paused:
            return False
        if not self._is_working_hours():
            return False
        if self._messages_today >= config.MAX_MESSAGES_PER_DAY:
            logger.debug("Skipping: daily message limit reached (%d)", self._messages_today)
            return False
        return True

    def search_people(self, keywords=None, title=None, industries=None, company_size=None, limit=20):
        if not self.is_logged_in:
            logger.warning("Not logged in, returning empty search")
            return []
        try:
            results = self._api.search_people(
                keywords=keywords,
                keyword_title=title,
                limit=limit,
            )
            logger.info("LinkedIn search returned %d results (title=%s)", len(results), title)
            return results
        except Exception as e:
            logger.error("LinkedIn search failed: %s", e)
            return []

    def get_profile(self, public_id):
        if not self.is_logged_in:
            return None
        try:
            return self._api.get_profile(public_id)
        except Exception as e:
            logger.error("Failed to get profile %s: %s", public_id, e)
            return None

    def send_connection_request(self, profile_urn, message):
        with self._lock:
            if not self._can_send_connection():
                return False
            if not self.is_logged_in:
                logger.info("[DRY-RUN] Would send connection to %s: %s", profile_urn, message[:50])
                self._connections_today += 1
                self._total_sent += 1
                return True
            try:
                self._random_delay()
                self._api.add_connection(profile_urn, message=message)
                self._connections_today += 1
                self._total_sent += 1
                logger.info("Connection request sent to %s (%d today)", profile_urn, self._connections_today)
                return True
            except Exception as e:
                logger.error("Failed to send connection to %s: %s", profile_urn, e)
                return False

    def send_message(self, conversation_urn_or_recipients, message):
        with self._lock:
            if not self._can_send_message():
                return False
            if not self.is_logged_in:
                logger.info("[DRY-RUN] Would send message: %s", message[:50])
                self._messages_today += 1
                return True
            try:
                self._random_delay()
                self._api.send_message(message, conversation_urn_id=conversation_urn_or_recipients)
                self._messages_today += 1
                logger.info("Message sent (%d today)", self._messages_today)
                return True
            except Exception as e:
                logger.error("Failed to send message: %s", e)
                return False

    def get_conversations(self):
        if not self.is_logged_in:
            return []
        try:
            return self._api.get_conversations()
        except Exception as e:
            logger.error("Failed to get conversations: %s", e)
            return []

    def record_acceptance(self):
        self._total_accepted += 1

    def get_stats(self):
        rate = (self._total_accepted / self._total_sent * 100) if self._total_sent > 0 else 0
        return {
            "logged_in": self.is_logged_in,
            "paused": self._paused,
            "connections_today": self._connections_today,
            "messages_today": self._messages_today,
            "daily_connection_limit": self._get_daily_connection_limit(),
            "daily_message_limit": config.MAX_MESSAGES_PER_DAY,
            "total_sent": self._total_sent,
            "total_accepted": self._total_accepted,
            "acceptance_rate": round(rate, 1),
            "is_working_hours": self._is_working_hours(),
            "is_weekend": self._is_weekend(),
        }
