"""
LinkedIn follow-up messenger: checks accepted connections and sends follow-up messages.
"""

import random
import logging

import config
from linkedin_client import LinkedInClient

logger = logging.getLogger(__name__)


class Messenger:
    def __init__(self, linkedin_client: LinkedInClient):
        self.li = linkedin_client
        self._followed_up = set()  # Track who we've already messaged

    def run_followup_cycle(self):
        """
        Check recent conversations for newly accepted connections
        and send follow-up messages with /pricing link.
        """
        if self.li.is_paused:
            logger.info("Messenger paused, skipping followup cycle")
            return {"status": "paused", "messages_sent": 0}

        conversations = self.li.get_conversations()
        messages_sent = 0

        for conv in conversations:
            try:
                participants = conv.get("participants", [])
                conv_id = conv.get("entityUrn", "")

                if not conv_id or conv_id in self._followed_up:
                    continue

                # Look for conversations that are new connections (typically have
                # a system message about connecting)
                events = conv.get("events", [])
                is_new_connection = any(
                    "connected" in str(e).lower() or "accepted" in str(e).lower()
                    for e in events[:3]
                )

                if not is_new_connection:
                    continue

                # Extract participant info
                first_name = ""
                company = ""
                for p in participants:
                    profile = p.get("com.linkedin.voyager.messaging.MessagingMember", {})
                    mini_profile = profile.get("miniProfile", {})
                    first_name = mini_profile.get("firstName", "there")
                    occupation = mini_profile.get("occupation", "")
                    # Try to extract company from occupation (e.g. "CISO at Company")
                    if " at " in occupation:
                        company = occupation.split(" at ")[-1].strip()
                    break

                if not first_name:
                    continue

                # Record acceptance for stats
                self.li.record_acceptance()

                # Send follow-up message
                template = random.choice(config.FOLLOWUP_TEMPLATES)
                message = template.format(
                    first_name=first_name,
                    company=company or "your company",
                    pricing_url=config.PRICING_URL,
                )

                sent = self.li.send_message(conv_id, message)
                if sent:
                    messages_sent += 1
                    self._followed_up.add(conv_id)
                    logger.info("Follow-up sent to %s (%s)", first_name, company)

            except Exception as e:
                logger.error("Error processing conversation: %s", e)
                continue

        result = {"status": "completed", "messages_sent": messages_sent}
        logger.info("Followup cycle complete: %s", result)
        return result
