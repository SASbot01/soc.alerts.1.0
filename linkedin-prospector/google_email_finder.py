"""
Google search scraping to find email addresses from name + company.
"""

import re
import time
import random
import logging
import urllib.parse
import requests
from bs4 import BeautifulSoup

import config

logger = logging.getLogger(__name__)

# Common email patterns to try
EMAIL_PATTERNS = [
    "{first}.{last}@{domain}",
    "{first}{last}@{domain}",
    "{f}{last}@{domain}",
    "{first}@{domain}",
    "{first}_{last}@{domain}",
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

EMAIL_REGEX = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")


def _google_search(query, num_results=5):
    """Scrape Google search results for a query."""
    try:
        url = f"https://www.google.com/search?q={urllib.parse.quote(query)}&num={num_results}"
        resp = requests.get(url, headers=HEADERS, timeout=15)
        if resp.status_code != 200:
            logger.warning("Google returned status %d for query: %s", resp.status_code, query)
            return ""
        return resp.text
    except Exception as e:
        logger.error("Google search failed for '%s': %s", query, e)
        return ""


def _extract_emails_from_html(html):
    """Extract all email addresses from HTML content."""
    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text(separator=" ")
    return set(EMAIL_REGEX.findall(text))


def _guess_domain(company_name):
    """Guess the company domain from name."""
    clean = company_name.lower().strip()
    clean = re.sub(r"[^a-z0-9\s]", "", clean)
    clean = clean.replace(" ", "")
    return f"{clean}.com"


def _generate_email_guesses(first_name, last_name, domain):
    """Generate common email pattern guesses."""
    first = first_name.lower().strip()
    last = last_name.lower().strip()
    f = first[0] if first else ""
    return [
        pattern.format(first=first, last=last, f=f, domain=domain)
        for pattern in EMAIL_PATTERNS
        if first and last
    ]


def find_email(full_name, title, company_name, company_domain=None):
    """
    Try to find someone's email using Google searches.

    Args:
        full_name: e.g. "Juan Garcia"
        title: e.g. "CISO"
        company_name: e.g. "Empresa Corp"
        company_domain: e.g. "empresacorp.com" (optional, will guess if not provided)

    Returns:
        Best email found, or None
    """
    if not config.GOOGLE_SEARCH_ENABLED:
        logger.debug("Google search disabled, skipping email discovery")
        return None

    domain = company_domain or _guess_domain(company_name)
    parts = full_name.strip().split()
    first_name = parts[0] if parts else ""
    last_name = parts[-1] if len(parts) > 1 else ""

    found_emails = set()

    # Search 1: "Name" "Company" email
    query1 = f'"{full_name}" "{company_name}" email'
    html1 = _google_search(query1)
    found_emails.update(_extract_emails_from_html(html1))
    time.sleep(random.randint(config.GOOGLE_DELAY_SECONDS, config.GOOGLE_DELAY_SECONDS + 5))

    # Search 2: Common email patterns
    guesses = _generate_email_guesses(first_name, last_name, domain)
    if guesses:
        query2 = " OR ".join(f'"{g}"' for g in guesses[:3])
        html2 = _google_search(query2)
        found_emails.update(_extract_emails_from_html(html2))
        time.sleep(random.randint(config.GOOGLE_DELAY_SECONDS, config.GOOGLE_DELAY_SECONDS + 5))

    # Search 3: "@domain" + title
    query3 = f'"@{domain}" {title}'
    html3 = _google_search(query3)
    found_emails.update(_extract_emails_from_html(html3))

    # Filter: prefer emails at the company domain
    company_emails = {e for e in found_emails if e.endswith(f"@{domain}")}

    # Also check guessed patterns against found
    for guess in guesses:
        if guess in found_emails:
            logger.info("Found guessed email match: %s", guess)
            return guess

    if company_emails:
        best = sorted(company_emails)[0]
        logger.info("Found company email for %s: %s", full_name, best)
        return best

    # Fallback: return first guess (will be SMTP verified later)
    if guesses:
        logger.info("No confirmed email for %s, returning best guess: %s", full_name, guesses[0])
        return guesses[0]

    logger.warning("No email found for %s at %s", full_name, company_name)
    return None
