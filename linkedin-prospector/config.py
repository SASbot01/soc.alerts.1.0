import os

# LinkedIn credentials
LINKEDIN_EMAIL = os.getenv("LINKEDIN_EMAIL", "")
LINKEDIN_PASSWORD = os.getenv("LINKEDIN_PASSWORD", "")

# Backend integration
BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:8080/api/v1")
PROSPECTOR_API_KEY = os.getenv("PROSPECTOR_API_KEY", "")

# Rate limits (LinkedIn safety)
MAX_CONNECTIONS_PER_DAY = int(os.getenv("MAX_CONNECTIONS_PER_DAY", "20"))
MAX_CONNECTIONS_WEEKEND = int(os.getenv("MAX_CONNECTIONS_WEEKEND", "5"))
MAX_MESSAGES_PER_DAY = int(os.getenv("MAX_MESSAGES_PER_DAY", "15"))
MIN_DELAY_SECONDS = int(os.getenv("MIN_DELAY_SECONDS", "180"))  # 3 min
MAX_DELAY_SECONDS = int(os.getenv("MAX_DELAY_SECONDS", "420"))  # 7 min
WORK_HOUR_START = int(os.getenv("WORK_HOUR_START", "9"))
WORK_HOUR_END = int(os.getenv("WORK_HOUR_END", "18"))
MIN_ACCEPTANCE_RATE = float(os.getenv("MIN_ACCEPTANCE_RATE", "0.20"))

# Search targets
TARGET_TITLES = os.getenv("TARGET_TITLES", "CISO,CTO,IT Director,VP of Security,Head of IT,Security Director,VP Engineering").split(",")
TARGET_INDUSTRIES = os.getenv("TARGET_INDUSTRIES", "Technology,Financial Services,Healthcare,Manufacturing,Retail").split(",")
TARGET_COMPANY_SIZE = os.getenv("TARGET_COMPANY_SIZE", "51-200,201-500,501-1000").split(",")

# Landing / pricing URL
LANDING_URL = os.getenv("LANDING_URL", "https://soc.blackwolfsec.io/landing")
PRICING_URL = os.getenv("PRICING_URL", "https://soc.blackwolfsec.io/pricing")

# Connection request templates (rotated)
CONNECTION_TEMPLATES = [
    "Hi {first_name}, I noticed you're leading security at {company}. We help mid-market companies with 24/7 AI-powered threat monitoring. Would love to connect.",
    "Hi {first_name}, as {title} at {company}, you might find BlackWolf's autonomous SOC interesting — we detect threats traditional tools miss. Let's connect.",
    "Hi {first_name}, I'm working with security leaders like yourself to solve the alert fatigue problem. Our AI SOC handles it autonomously. Happy to share more.",
    "Hi {first_name}, saw your work at {company} — impressive. We're building the next-gen SOC platform and I'd value your perspective. Let's connect.",
]

# Follow-up message templates (after connection accepted)
FOLLOWUP_TEMPLATES = [
    "Thanks for connecting, {first_name}! Given your role at {company}, I thought you'd find this interesting: our SOC platform detected and auto-blocked 12,000+ attacks last week. Happy to show how it works: {pricing_url}",
    "Great to connect, {first_name}! I help companies like {company} eliminate alert fatigue with AI-powered autonomous response. Here's a quick look at what we do: {pricing_url}",
]

# Google search settings
GOOGLE_SEARCH_ENABLED = os.getenv("GOOGLE_SEARCH_ENABLED", "true").lower() == "true"
GOOGLE_DELAY_SECONDS = int(os.getenv("GOOGLE_DELAY_SECONDS", "10"))

# SMTP verification
SMTP_VERIFY_ENABLED = os.getenv("SMTP_VERIFY_ENABLED", "true").lower() == "true"
SMTP_VERIFY_TIMEOUT = int(os.getenv("SMTP_VERIFY_TIMEOUT", "10"))

# Gemini API (for content + image generation)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Auto-publishing schedule (24h format)
PUBLISH_HOUR_1 = int(os.getenv("PUBLISH_HOUR_1", "10"))
PUBLISH_HOUR_2 = int(os.getenv("PUBLISH_HOUR_2", "16"))
PUBLISH_ENABLED = os.getenv("PUBLISH_ENABLED", "true").lower() == "true"

# Post topic rotation
POST_TOPICS = [
    "stats_attacks_blocked",
    "cybersecurity_tip",
    "soc_use_case",
    "current_threats",
    "alert_fatigue",
    "autonomous_response",
    "compliance_security",
    "incident_response",
]

# LinkedIn cookie path (fallback auth)
LINKEDIN_COOKIES_PATH = os.getenv("LINKEDIN_COOKIES_PATH", "/app/cookies/li_cookies.json")

# Gmail SMTP (for prospect outreach emails)
MAIL_HOST = os.getenv("MAIL_HOST", "")
MAIL_PORT = int(os.getenv("MAIL_PORT", "587"))
MAIL_USERNAME = os.getenv("MAIL_USERNAME", "")
MAIL_PASSWORD = os.getenv("MAIL_PASSWORD", "")
MAIL_SMTP_AUTH = os.getenv("MAIL_SMTP_AUTH", "false").lower() == "true"
MAIL_SMTP_STARTTLS = os.getenv("MAIL_SMTP_STARTTLS", "true").lower() == "true"
ALERT_FROM_EMAIL = os.getenv("ALERT_FROM_EMAIL", "")
EMAIL_OUTREACH_ENABLED = os.getenv("EMAIL_OUTREACH_ENABLED", "true").lower() == "true"
