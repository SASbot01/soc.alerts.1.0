"""
Core prospecting logic: LinkedIn search -> Google email discovery -> send connection -> POST to backend.
"""

import re
import random
import logging
import requests

import config
from linkedin_client import LinkedInClient
from google_email_finder import find_email
from email_verifier import verify_email
from gmail_sender import send_prospect_email

logger = logging.getLogger(__name__)

# Only reliable separators between title and company
_COMPANY_SEPARATORS = [" at ", " en ", " @ ", " bij ", " bei ", " chez "]


def _parse_search_result(result, target_title):
    """Extract first_name, last_name, company_name, headline from a search result."""
    name = result.get("name", "").strip()
    if not name:
        return None

    # Clean name: remove certifications like ", CISSP" etc.
    clean_name = re.split(r",\s*(?:CISSP|CISM|CEH|MBA|PhD|PMP|CCISO|MSc)", name)[0].strip()
    parts = clean_name.split()
    first_name = parts[0] if parts else ""
    last_name = parts[-1] if len(parts) > 1 else ""

    headline = result.get("jobtitle", "")
    company_name = ""

    # Parse company from jobtitle: "CISO at Company Name" / "CISO en JICECO"
    for sep in _COMPANY_SEPARATORS:
        if sep.lower() in headline.lower():
            idx = headline.lower().index(sep.lower())
            company_part = headline[idx + len(sep):].strip()
            # Clean trailing parentheticals and pipe-separated extra text
            company_part = re.split(r"\s*[|(]", company_part)[0].strip()
            # Skip if result looks like a title, not a company (too long or has keywords)
            if len(company_part) < 80 and company_part:
                company_name = company_part
            break

    return {
        "first_name": first_name,
        "last_name": last_name,
        "full_name": clean_name,
        "headline": headline,
        "company_name": company_name,
        "location": result.get("location", ""),
    }


class Prospector:
    def __init__(self, linkedin_client: LinkedInClient):
        self.li = linkedin_client
        self._processed_urns = set()  # Avoid re-processing in same session

    def run_search_cycle(self):
        """
        Full prospecting cycle:
        1. Search LinkedIn for target profiles
        2. Parse name/company from search results
        3. Find their email via Google
        4. Send LinkedIn connection request
        5. Send outreach email
        6. POST lead to backend
        """
        if self.li.is_paused:
            logger.info("Prospector paused, skipping search cycle")
            return {"status": "paused", "processed": 0}

        total_processed = 0
        total_connections = 0
        total_leads = 0
        total_emails_sent = 0

        for title in config.TARGET_TITLES:
            results = self.li.search_people(title=title.strip(), limit=15)

            for result in results:
                urn_id = result.get("urn_id")

                if not urn_id or urn_id in self._processed_urns:
                    continue

                self._processed_urns.add(urn_id)

                # Parse info directly from search result (no extra API call)
                info = _parse_search_result(result, title.strip())
                if not info or not info["company_name"]:
                    continue

                first_name = info["first_name"]
                full_name = info["full_name"]
                company_name = info["company_name"]
                headline = info["headline"]

                logger.info("Processing: %s, %s at %s", full_name, headline, company_name)

                # Find email via Google
                email = find_email(full_name, title.strip(), company_name)

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

                # Send outreach email if we found a valid email
                if email and config.EMAIL_OUTREACH_ENABLED:
                    email_sent = send_prospect_email(
                        to_email=email,
                        first_name=first_name,
                        company_name=company_name,
                        template_index=total_emails_sent,
                    )
                    if email_sent:
                        total_emails_sent += 1

                # POST lead to backend
                if email or conn_sent:
                    lead_posted = self._post_lead(
                        email=email,
                        company_name=company_name,
                        domain="",
                        contact_name=full_name,
                        title=headline or title.strip(),
                        linkedin_id=urn_id,
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
            "emails_sent": total_emails_sent,
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
