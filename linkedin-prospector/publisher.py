"""
LinkedIn auto-publisher: generates posts with Gemini (text + image) and publishes to LinkedIn.
Publishes 2 posts per day on rotating cybersecurity / BlackWolf SOC topics.
"""

import io
import json
import base64
import random
import logging
from datetime import datetime

import requests
from google import genai
from google.genai import types

import config

logger = logging.getLogger(__name__)

# Gemini prompts per topic
TOPIC_PROMPTS = {
    "stats_attacks_blocked": (
        "Output ONLY the post text — no preamble, no introduction, no meta-commentary. "
        "Write a short, engaging LinkedIn post (max 1300 chars, in English) for BlackWolf Security's page. "
        "Share an impressive but realistic stat about cyberattacks blocked by our autonomous SOC platform this week "
        "(invent a realistic number between 8,000 and 25,000). Mention AI-powered 24/7 monitoring. "
        "End with a call to action to visit our site. Use 2-3 relevant hashtags. Professional but not boring tone."
    ),
    "cybersecurity_tip": (
        "Output ONLY the post text — no preamble, no introduction, no meta-commentary. "
        "Write a short, engaging LinkedIn post (max 1300 chars, in English) for BlackWolf Security's page. "
        "Share a practical cybersecurity tip that CISOs and IT Directors would find valuable. "
        "Subtly mention how BlackWolf's SOC platform helps with this. "
        "Use 2-3 relevant hashtags. Professional and authoritative tone."
    ),
    "soc_use_case": (
        "Output ONLY the post text — no preamble, no introduction, no meta-commentary. "
        "Write a short, engaging LinkedIn post (max 1300 chars, in English) for BlackWolf Security's page. "
        "Describe a real-world scenario where a company's SOC detected and auto-blocked a sophisticated attack "
        "(ransomware, lateral movement, or credential stuffing). Show how BlackWolf's autonomous response saved the day. "
        "Use 2-3 relevant hashtags. Storytelling tone."
    ),
    "current_threats": (
        "Output ONLY the post text — no preamble, no introduction, no meta-commentary. "
        "Write a short, engaging LinkedIn post (max 1300 chars, in English) for BlackWolf Security's page. "
        "Discuss a current trending cyber threat (pick one: AI-powered phishing, supply chain attacks, "
        "zero-day exploits, or cloud misconfigurations). Explain what companies should do and mention "
        "BlackWolf's autonomous detection. Use 2-3 relevant hashtags. Urgent but professional tone."
    ),
    "alert_fatigue": (
        "Output ONLY the post text — no preamble, no introduction, no meta-commentary. "
        "Write a short, engaging LinkedIn post (max 1300 chars, in English) for BlackWolf Security's page. "
        "Discuss the problem of alert fatigue in security operations — SOC analysts drowning in thousands of "
        "false positives daily. Explain how BlackWolf's AI triages and responds autonomously, letting teams "
        "focus on what matters. Use 2-3 relevant hashtags. Empathetic and solution-oriented tone."
    ),
    "autonomous_response": (
        "Output ONLY the post text — no preamble, no introduction, no meta-commentary. "
        "Write a short, engaging LinkedIn post (max 1300 chars, in English) for BlackWolf Security's page. "
        "Highlight the difference between traditional SIEM/SOC tools that only alert vs BlackWolf's autonomous "
        "SOC that detects AND responds automatically — blocking threats in real-time without human intervention. "
        "Use 2-3 relevant hashtags. Bold and confident tone."
    ),
    "compliance_security": (
        "Output ONLY the post text — no preamble, no introduction, no meta-commentary. "
        "Write a short, engaging LinkedIn post (max 1300 chars, in English) for BlackWolf Security's page. "
        "Discuss how companies struggle with compliance (SOC2, ISO 27001, GDPR) and how continuous monitoring "
        "with BlackWolf's platform simplifies audit readiness and proves security posture. "
        "Use 2-3 relevant hashtags. Informative tone."
    ),
    "incident_response": (
        "Output ONLY the post text — no preamble, no introduction, no meta-commentary. "
        "Write a short, engaging LinkedIn post (max 1300 chars, in English) for BlackWolf Security's page. "
        "Explain why incident response speed matters — every minute counts during a breach. Share how "
        "BlackWolf's AI-driven SOC reduces mean-time-to-respond from hours to seconds. "
        "Use 2-3 relevant hashtags. Urgent and impactful tone."
    ),
}

IMAGE_PROMPT_TEMPLATE = (
    "Create a professional, modern cybersecurity-themed image for a LinkedIn post about: {topic_description}. "
    "The image should be clean, corporate, and visually striking. Use dark blue, black, and electric blue/cyan "
    "color palette. Include subtle tech elements like shields, network nodes, or digital patterns. "
    "Do NOT include any text or logos in the image. 1200x627 pixels aspect ratio (landscape). "
    "Photorealistic or high-quality 3D render style."
)

TOPIC_IMAGE_HINTS = {
    "stats_attacks_blocked": "statistics dashboard showing blocked cyberattacks with shields and graphs",
    "cybersecurity_tip": "a security professional giving advice with a digital lock and protection symbols",
    "soc_use_case": "a SOC command center with screens showing threat detection and automated response",
    "current_threats": "digital threats emerging from a dark network with warning signals",
    "alert_fatigue": "an overwhelmed analyst at screens full of alerts vs a calm AI handling them",
    "autonomous_response": "an AI-powered defense system automatically blocking cyber threats",
    "compliance_security": "compliance checkmarks and security certificates with a digital shield",
    "incident_response": "a fast-moving digital response team with a stopwatch showing speed",
}


class Publisher:
    def __init__(self, li_client):
        self._li = li_client
        self._topic_index = 0
        self._posts_published = 0
        self._last_results = []
        self._profile_urn = None

        if config.GEMINI_API_KEY:
            self._gemini = genai.Client(api_key=config.GEMINI_API_KEY)
        else:
            self._gemini = None
            logger.warning("GEMINI_API_KEY not set — publisher will run in dry-run mode")

    def _get_next_topic(self) -> str:
        topics = config.POST_TOPICS
        topic = topics[self._topic_index % len(topics)]
        self._topic_index += 1
        return topic

    # Models to try in order (fallback chain)
    TEXT_MODELS = [
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-2.0-flash-lite",
    ]

    IMAGE_MODELS = [
        "imagen-4.0-generate-001",
        "imagen-4.0-fast-generate-001",
        "imagen-3.0-generate-002",
        "imagen-3.0-generate-001",
    ]

    def generate_post_text(self, topic: str) -> str | None:
        prompt = TOPIC_PROMPTS.get(topic)
        if not prompt:
            logger.error("Unknown topic: %s", topic)
            return None

        if not self._gemini:
            logger.info("[DRY-RUN] Would generate text for topic: %s", topic)
            return f"[DRY-RUN] Post about {topic}"

        for model in self.TEXT_MODELS:
            try:
                logger.info("Trying text generation with model: %s", model)
                response = self._gemini.models.generate_content(
                    model=model,
                    contents=prompt,
                )
                text = response.text.strip()
                # Strip meta-text preamble that Gemini sometimes adds
                for marker in ("---\n\n", "---\n"):
                    if marker in text:
                        text = text.split(marker, 1)[-1].strip()
                # Remove common preamble lines
                lower = text.lower()
                for preamble in (
                    "here's an engaging",
                    "here is an engaging",
                    "here's a short",
                    "here is a short",
                    "here's a linkedin",
                    "here is a linkedin",
                    "sure, here",
                    "absolutely, here",
                ):
                    if lower.startswith(preamble):
                        # Skip to the next line break
                        idx = text.find("\n")
                        if idx != -1:
                            text = text[idx + 1:].strip()
                        break
                if len(text) > 3000:
                    text = text[:2997] + "..."
                logger.info("Generated post text (%d chars) with %s for topic: %s", len(text), model, topic)
                return text
            except Exception as e:
                logger.warning("Model %s failed: %s", model, e)
                continue

        logger.error("All text models exhausted for topic: %s", topic)
        return None

    def generate_image(self, topic: str) -> bytes | None:
        hint = TOPIC_IMAGE_HINTS.get(topic, "cybersecurity concept")
        prompt = IMAGE_PROMPT_TEMPLATE.format(topic_description=hint)

        if not self._gemini:
            logger.info("[DRY-RUN] Would generate image for topic: %s", topic)
            return None

        for model in self.IMAGE_MODELS:
            try:
                logger.info("Trying image generation with model: %s", model)
                response = self._gemini.models.generate_images(
                    model=model,
                    prompt=prompt,
                    config=types.GenerateImagesConfig(
                        number_of_images=1,
                        aspect_ratio="16:9",
                    ),
                )
                if response.generated_images:
                    image_bytes = response.generated_images[0].image.image_bytes
                    logger.info("Generated image (%d bytes) with %s for topic: %s", len(image_bytes), model, topic)
                    return image_bytes
                else:
                    logger.warning("Model %s returned no images for topic: %s", model, topic)
                    continue
            except Exception as e:
                logger.warning("Image model %s failed: %s", model, e)
                continue

        logger.error("All image models exhausted for topic: %s — will publish text-only", topic)
        return None

    def _upload_image_to_linkedin(self, image_bytes: bytes, _retried: bool = False) -> str | None:
        """Upload image to LinkedIn via Voyager API and return the asset URN."""
        if not self._li.is_logged_in:
            logger.warning("Cannot upload image: not logged in to LinkedIn")
            return None

        try:
            # Step 1: Register upload via Voyager media upload
            register_payload = {
                "mediaUploadType": "IMAGE_SHARING",
                "fileSize": len(image_bytes),
                "filename": "post_image.png",
            }
            resp = self._li._api._post(
                "/voyagerMediaUploadMetadata?action=upload",
                json=register_payload,
            )
            if resp.status_code == 401 and not _retried:
                logger.warning("Image register got 401 — re-authenticating...")
                if self._li.reauth():
                    return self._upload_image_to_linkedin(image_bytes, _retried=True)
                return None
            if resp.status_code != 200:
                logger.error("Image register failed: %d %s", resp.status_code, resp.text[:300])
                return None

            data = resp.json()
            upload_url = data.get("value", {}).get("singleUploadUrl", "")
            asset_urn = data.get("value", {}).get("urn", "")
            if not upload_url or not asset_urn:
                logger.error("Missing upload URL or URN in register response")
                return None

            # Step 2: Upload the binary image
            upload_resp = self._li._api.client.session.put(
                upload_url,
                data=image_bytes,
                headers={"Content-Type": "image/png"},
            )
            if upload_resp.status_code not in (200, 201):
                logger.error("Image upload failed: %d", upload_resp.status_code)
                return None

            logger.info("Image uploaded to LinkedIn: %s", asset_urn)
            return asset_urn

        except Exception as e:
            logger.error("Image upload error: %s", e)
            return None

    def _get_profile_urn(self) -> str | None:
        """Get the current user's URN for publishing."""
        # Return cached URN if available
        if self._profile_urn:
            return self._profile_urn

        try:
            me = self._li._api.get_user_profile(use_cache=True)
            if not me or "status" in me:
                logger.error("get_user_profile returned error: %s", me)
                return None

            mini = me.get("miniProfile", {})
            if mini:
                # objectUrn = "urn:li:member:1263732481"
                member_urn = mini.get("objectUrn", "")
                if member_urn:
                    self._profile_urn = member_urn
                    logger.info("Profile URN: %s", member_urn)
                    return member_urn

            plain_id = me.get("plainId")
            if plain_id:
                urn = f"urn:li:member:{plain_id}"
                self._profile_urn = urn
                logger.info("Profile URN from plainId: %s", urn)
                return urn

        except Exception as e:
            logger.error("Failed to get profile URN: %s", e)
        return None

    def _publish_to_linkedin(self, text: str, image_asset: str | None = None, _retried: bool = False) -> bool:
        """Create a LinkedIn post via Voyager normShares API. Auto-reauths on 401."""
        if not self._li.is_logged_in:
            logger.info("[DRY-RUN] Would publish to LinkedIn: %s", text[:100])
            return True

        try:
            payload = {
                "commentaryV2": {
                    "text": text,
                    "attributes": [],
                },
                "origin": "FEED",
                "allowedCommentersScope": "ALL",
                "visibleToConnectionsOnly": False,
            }

            if image_asset:
                payload["mediaCategory"] = "IMAGE"
                payload["media"] = [{"status": "READY", "media": image_asset}]

            resp = self._li._api._post("/contentcreation/normShares", json=payload)
            if resp.status_code in (200, 201):
                logger.info("Post published successfully to LinkedIn!")
                return True
            elif resp.status_code == 401 and not _retried:
                logger.warning("Publish got 401 — attempting re-authentication...")
                if self._li.reauth():
                    self._profile_urn = None  # Reset cached URN
                    logger.info("Re-auth successful, retrying publish...")
                    return self._publish_to_linkedin(text, image_asset, _retried=True)
                else:
                    logger.error("Re-auth failed, cannot publish")
                    return False
            else:
                logger.error("Publish failed: %d %s", resp.status_code, resp.text[:500])
                return False

        except Exception as e:
            logger.error("Publish error: %s", e)
            return False

    def publish_post(self) -> dict:
        """Generate and publish a single post. Returns result dict."""
        if not config.PUBLISH_ENABLED:
            return {"status": "disabled", "message": "Publishing is disabled"}

        topic = self._get_next_topic()
        result = {
            "topic": topic,
            "timestamp": datetime.now().isoformat(),
            "text_generated": False,
            "image_generated": False,
            "published": False,
        }

        logger.info("=== Publishing post for topic: %s ===", topic)

        # Step 1: Generate text
        text = self.generate_post_text(topic)
        if not text:
            result["error"] = "Text generation failed"
            return result
        result["text_generated"] = True
        result["text_preview"] = text[:200]

        # Step 2: Generate image
        image_bytes = self.generate_image(topic)
        image_asset = None
        if image_bytes:
            result["image_generated"] = True
            # Step 3: Upload image to LinkedIn
            image_asset = self._upload_image_to_linkedin(image_bytes)
            if image_asset:
                result["image_uploaded"] = True

        # Step 4: Publish
        published = self._publish_to_linkedin(text, image_asset)
        result["published"] = published

        if published:
            self._posts_published += 1

        self._last_results.append(result)
        # Keep only last 10 results
        if len(self._last_results) > 10:
            self._last_results = self._last_results[-10:]

        return result

    def get_stats(self) -> dict:
        return {
            "posts_published": self._posts_published,
            "topic_index": self._topic_index,
            "publish_enabled": config.PUBLISH_ENABLED,
            "gemini_configured": self._gemini is not None,
            "last_results": self._last_results[-3:],
        }
