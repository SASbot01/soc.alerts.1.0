"""
SMTP-level email verification — checks if an email address actually exists
by connecting to the MX server and issuing RCPT TO.
"""

import logging
import smtplib
import socket
import dns.resolver

import config

logger = logging.getLogger(__name__)


def _get_mx_host(domain):
    """Get the primary MX server for a domain."""
    try:
        answers = dns.resolver.resolve(domain, "MX")
        records = sorted(answers, key=lambda r: r.preference)
        if records:
            return str(records[0].exchange).rstrip(".")
    except Exception as e:
        logger.debug("MX lookup failed for %s: %s", domain, e)
    return None


def verify_email(email):
    """
    Verify that an email address exists via SMTP RCPT TO.

    Returns True if the server accepts the recipient, False otherwise.
    Note: Some servers accept all recipients (catch-all), so True doesn't
    guarantee the mailbox exists.
    """
    if not config.SMTP_VERIFY_ENABLED:
        return True  # Skip verification if disabled

    if not email or "@" not in email:
        return False

    domain = email.split("@")[1]
    mx_host = _get_mx_host(domain)
    if not mx_host:
        logger.warning("No MX record for domain %s, cannot verify %s", domain, email)
        return False

    try:
        smtp = smtplib.SMTP(timeout=config.SMTP_VERIFY_TIMEOUT)
        smtp.connect(mx_host, 25)
        smtp.helo("blackwolfsec.io")
        smtp.mail("verify@blackwolfsec.io")
        code, _ = smtp.rcpt(email)
        smtp.quit()

        if code == 250:
            logger.info("Email verified OK: %s", email)
            return True
        else:
            logger.info("Email rejected (code %d): %s", code, email)
            return False

    except (smtplib.SMTPException, socket.error, OSError) as e:
        logger.warning("SMTP verify failed for %s: %s", email, e)
        return False
