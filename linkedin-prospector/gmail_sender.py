"""
Gmail SMTP sender for prospect onboarding emails.
Sends personalized outreach emails to discovered prospect email addresses.
"""

import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

import config

logger = logging.getLogger(__name__)


# Email templates
SUBJECT_TEMPLATES = [
    "Reducing alert fatigue for {company}",
    "{first_name}, eliminate security blind spots at {company}",
    "How {company} can automate threat response",
]

BODY_TEMPLATE = """\
Hi {first_name},

I came across your profile and noticed you're leading security efforts at {company}. \
Given the challenges companies face with alert overload and evolving threats, \
I thought BlackWolf's autonomous SOC platform might be relevant.

Here's what we do differently:
- AI-powered 24/7 threat monitoring — no analyst needed for initial triage
- Autonomous incident response — threats blocked in seconds, not hours
- We've stopped 12,000+ attacks this month alone for our clients

Companies like yours typically see a 90%+ reduction in alert noise within the first week.

Would you be open to a quick look? You can explore our platform here:
{pricing_url}

Best regards,
Alejandro Silvestre
CTO, BlackWolf Security
https://soc.blackwolfsec.io
"""


def send_prospect_email(
    to_email: str,
    first_name: str,
    company_name: str,
    template_index: int = 0,
) -> bool:
    """
    Send an onboarding/outreach email to a prospect.

    Returns True if sent successfully, False otherwise.
    """
    if not config.MAIL_HOST or not config.MAIL_USERNAME:
        logger.warning("Gmail SMTP not configured, skipping email to %s", to_email)
        return False

    if not to_email or "@" not in to_email:
        return False

    # Skip placeholder emails
    if "linkedin.placeholder" in to_email:
        return False

    try:
        subject_templates = SUBJECT_TEMPLATES
        subject = subject_templates[template_index % len(subject_templates)].format(
            first_name=first_name,
            company=company_name,
        )

        body = BODY_TEMPLATE.format(
            first_name=first_name,
            company=company_name,
            pricing_url=config.PRICING_URL,
        )

        msg = MIMEMultipart("alternative")
        msg["From"] = f"Alejandro Silvestre <{config.ALERT_FROM_EMAIL}>"
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain"))

        with smtplib.SMTP(config.MAIL_HOST, config.MAIL_PORT, timeout=15) as server:
            if config.MAIL_SMTP_STARTTLS:
                server.starttls()
            if config.MAIL_SMTP_AUTH:
                server.login(config.MAIL_USERNAME, config.MAIL_PASSWORD)
            server.sendmail(config.ALERT_FROM_EMAIL, to_email, msg.as_string())

        logger.info("Outreach email sent to %s (%s at %s)", to_email, first_name, company_name)
        return True

    except Exception as e:
        logger.error("Failed to send email to %s: %s", to_email, e)
        return False
