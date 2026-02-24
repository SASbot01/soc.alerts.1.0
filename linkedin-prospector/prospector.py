"""
Core prospecting logic: LinkedIn search -> Google email discovery -> send connection -> POST to backend.
"""

import random
import logging
import requests

import config
from linkedin_client import LinkedInClient
from google_email_finder import find_email
from email_verifier import verify_email

logger = logging.getLogger(__name__)


class Prospector:
    def __init__(self, linkedin_client: LinkedInClient):
        self.li = linkedin_client
        self._processed_urns = set()  # Avoid re-processing in same session

    def run_search_cycle(self):
        """
        Full prospecting cycle:
        1. Search LinkedIn for target profiles
        2. For each result, get profile details
        3. Find their email via Google
        4. Send LinkedIn connection request
        5. POST lead to backend
        """
        if self.li.is_paused:
            logger.info("Prospector paused, skipping search cycle")
            return {"status": "paused", "processed": 0}

        total_processed = 0
        total_connections = 0
        total_leads = 0

        for title in config.TARGET_TITLES:
            results = self.li.search_people(keyword_title=title.strip(), limit=15)

            for result in results:
                public_id = result.get("public_id")
                urn_id = result.get("urn_id")

                if not public_id or urn_id in self._processed_urns:
                    continue

                self._processed_urns.add(urn_id)

                # Get full profile
                profile = self.li.get_profile(public_id)
                if not profile:
                    continue

                first_name = profile.get("firstName", "")
                last_name = profile.get("lastName", "")
                full_name = f"{first_name} {last_name}".strip()
                headline = profile.get("headline", "")
                company_name = ""
                company_domain = ""

                # Extract current company
                experiences = profile.get("experience", [])
                if experiences:
                    current = experiences[0]
                    company_name = current.get("companyName", "")
                    # Try to extract domain from company page
                    company_domain = current.get("company", {}).get("websiteUrl", "") if isinstance(current.get("company"), dict) else ""

                if not company_name:
                    continue

                logger.info("Processing: %s, %s at %s", full_name, headline, company_name)

                # Find email via Google
                email = find_email(full_name, title.strip(), company_name, company_domain or None)

                # Verify email if found
                if email and not verify_email(email):
                    logger.info("Email %s failed SMTP verification, skipping email outreach", email)
                    email = None

                # Send connection request
                template = random.choice(config.CONNECTION_TEMPLATES)
                message = template.format(
                    first_name=first_name,
                    company=company_name,
                    title=headline or title.strip(),
                )
                # Truncate to LinkedIn's 300 char limit
                if len(message) > 300:
                    message = message[:297] + "..."

                conn_sent = self.li.send_connection_request(urn_id, message)
                if conn_sent:
                    total_connections += 1

                # POST lead to backend
                if email or conn_sent:
                    lead_posted = self._post_lead(
                        email=email,
                        company_name=company_name,
                        domain=company_domain,
                        contact_name=full_name,
                        title=headline or title.strip(),
                        linkedin_id=public_id,
                    )
                    if lead_posted:
                        total_leads += 1

                total_processed += 1

                # Check if we hit daily limits
                if self.li.is_paused:
                    break

            if self.li.is_paused:
                break

        result = {
            "status": "completed",
            "processed": total_processed,
            "connections_sent": total_connections,
            "leads_posted": total_leads,
        }
        logger.info("Search cycle complete: %s", result)
        return result

    def _post_lead(self, email, company_name, domain, contact_name, title, linkedin_id):
        """POST a discovered lead to the Java backend."""
        if not config.PROSPECTOR_API_KEY:
            logger.warning("No PROSPECTOR_API_KEY configured, skipping backend POST")
            return False

        try:
            payload = {
                "email": email or f"{linkedin_id}@linkedin.placeholder",
                "companyName": company_name,
                "domain": domain,
                "contactName": contact_name,
                "source": "linkedin",
                "tags": f"title:{title},linkedin:{linkedin_id}",
            }

            resp = requests.post(
                f"{config.BACKEND_URL}/prospects/from-bot",
                json=payload,
                headers={
                    "X-Prospector-Key": config.PROSPECTOR_API_KEY,
                    "Content-Type": "application/json",
                },
                timeout=10,
            )

            if resp.status_code == 200:
                logger.info("Lead posted to backend: %s (%s)", contact_name, email)
                return True
            else:
                logger.warning("Backend rejected lead (status %d): %s", resp.status_code, resp.text[:200])
                return False

        except Exception as e:
            logger.error("Failed to POST lead to backend: %s", e)
            return False
