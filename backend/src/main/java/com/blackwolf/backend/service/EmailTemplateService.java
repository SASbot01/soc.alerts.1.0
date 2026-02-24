package com.blackwolf.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class EmailTemplateService {

    @Value("${app.base-url:https://soc.blackwolfsec.io}")
    private String baseUrl;

    public String renderWelcome(String companyName, String email, String tempPassword) {
        return wrapHtml("Welcome to BlackWolf SOC", """
                <h1 style="color:#ffffff;margin:0 0 10px 0;font-size:28px;">Welcome to BlackWolf SOC</h1>
                <p style="color:#9ca3af;font-size:16px;margin:0 0 30px 0;">Your security operations center is ready.</p>

                <div style="background:#1e293b;border-radius:8px;padding:24px;margin-bottom:24px;">
                    <p style="color:#e2e8f0;margin:0 0 16px 0;font-size:15px;">Hi there! Your <strong style="color:#ef4444;">%s</strong> account has been provisioned.</p>

                    <div style="background:#0f172a;border-radius:6px;padding:16px;margin-bottom:16px;">
                        <p style="color:#94a3b8;margin:0 0 8px 0;font-size:13px;">YOUR CREDENTIALS</p>
                        <p style="color:#e2e8f0;margin:0 0 4px 0;font-size:14px;"><strong>Email:</strong> %s</p>
                        <p style="color:#e2e8f0;margin:0;font-size:14px;"><strong>Temporary Password:</strong> <code style="background:#1e293b;padding:2px 8px;border-radius:4px;color:#f59e0b;">%s</code></p>
                    </div>

                    <p style="color:#94a3b8;margin:0 0 20px 0;font-size:13px;">Please change your password after your first login.</p>

                    <a href="%s/login" style="display:inline-block;background:#ef4444;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:6px;font-weight:600;font-size:15px;">Login to Dashboard</a>
                </div>

                <div style="background:#1e293b;border-radius:8px;padding:24px;">
                    <p style="color:#e2e8f0;margin:0 0 12px 0;font-size:15px;font-weight:600;">Quick Start Guide</p>
                    <ol style="color:#94a3b8;margin:0;padding-left:20px;font-size:14px;line-height:2;">
                        <li>Login and change your password</li>
                        <li>Enable MFA for extra security</li>
                        <li>Deploy your first sensor</li>
                        <li>Configure alert notifications</li>
                    </ol>
                </div>
                """.formatted(companyName, email, tempPassword, baseUrl));
    }

    public String renderDeploySensor(String companyName, String apiKey) {
        return wrapHtml("Deploy Your First Sensor", """
                <h1 style="color:#ffffff;margin:0 0 10px 0;font-size:28px;">Deploy Your First Sensor</h1>
                <p style="color:#9ca3af;font-size:16px;margin:0 0 30px 0;">Start monitoring your infrastructure in minutes.</p>

                <div style="background:#1e293b;border-radius:8px;padding:24px;margin-bottom:24px;">
                    <p style="color:#e2e8f0;margin:0 0 16px 0;font-size:15px;">Your <strong style="color:#ef4444;">%s</strong> dashboard is active, but we haven't received any data yet. Deploy a sensor to start seeing threats in real-time.</p>

                    <p style="color:#e2e8f0;margin:0 0 12px 0;font-size:15px;font-weight:600;">Option 1: Suricata IDS (Network Monitoring)</p>
                    <div style="background:#0f172a;border-radius:6px;padding:16px;margin-bottom:16px;overflow-x:auto;">
                        <code style="color:#4ade80;font-size:13px;white-space:pre;">docker run -d --net=host \\
  -e SOC_API_URL=%s/api/v1 \\
  -e SOC_API_KEY=YOUR_API_KEY \\
  -e SOC_COMPANY_ID=YOUR_COMPANY_ID \\
  blackwolfsec/suricata-bridge:latest</code>
                    </div>

                    <p style="color:#e2e8f0;margin:0 0 12px 0;font-size:15px;font-weight:600;">Option 2: Auth Log Monitor (SSH/Login Monitoring)</p>
                    <div style="background:#0f172a;border-radius:6px;padding:16px;margin-bottom:20px;overflow-x:auto;">
                        <code style="color:#4ade80;font-size:13px;white-space:pre;">docker run -d \\
  -v /var/log/auth.log:/var/log/auth.log:ro \\
  -e SOC_API_URL=%s/api/v1 \\
  -e SOC_API_KEY=YOUR_API_KEY \\
  blackwolfsec/auth-monitor:latest</code>
                    </div>

                    <a href="%s/sensors" style="display:inline-block;background:#ef4444;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:6px;font-weight:600;font-size:15px;">View Sensor Guide</a>
                </div>

                <p style="color:#64748b;font-size:13px;margin:0;">Need help? Reply to this email or check our documentation.</p>
                """.formatted(companyName, baseUrl, baseUrl, baseUrl));
    }

    public String renderWeeklyReport(String companyName, int threatCount, int incidentCount, int blockedIps) {
        String statsContent;
        if (threatCount > 0 || incidentCount > 0) {
            statsContent = """
                    <div style="display:flex;gap:16px;margin-bottom:20px;">
                        <div style="flex:1;background:#0f172a;border-radius:6px;padding:16px;text-align:center;">
                            <p style="color:#94a3b8;margin:0 0 4px 0;font-size:12px;">THREATS DETECTED</p>
                            <p style="color:#ef4444;margin:0;font-size:28px;font-weight:700;">%d</p>
                        </div>
                        <div style="flex:1;background:#0f172a;border-radius:6px;padding:16px;text-align:center;">
                            <p style="color:#94a3b8;margin:0 0 4px 0;font-size:12px;">INCIDENTS</p>
                            <p style="color:#f59e0b;margin:0;font-size:28px;font-weight:700;">%d</p>
                        </div>
                        <div style="flex:1;background:#0f172a;border-radius:6px;padding:16px;text-align:center;">
                            <p style="color:#94a3b8;margin:0 0 4px 0;font-size:12px;">IPs BLOCKED</p>
                            <p style="color:#4ade80;margin:0;font-size:28px;font-weight:700;">%d</p>
                        </div>
                    </div>
                    <p style="color:#e2e8f0;margin:0 0 20px 0;font-size:14px;">Your AI agent is actively monitoring and protecting your infrastructure 24/7.</p>
                    """.formatted(threatCount, incidentCount, blockedIps);
        } else {
            statsContent = """
                    <div style="background:#0f172a;border-radius:6px;padding:20px;text-align:center;margin-bottom:20px;">
                        <p style="color:#94a3b8;margin:0 0 8px 0;font-size:14px;">No data received this week.</p>
                        <p style="color:#64748b;margin:0;font-size:13px;">Deploy a sensor to start monitoring your infrastructure.</p>
                    </div>
                    """;
        }

        return wrapHtml("Your First Week Security Summary", """
                <h1 style="color:#ffffff;margin:0 0 10px 0;font-size:28px;">Your Week in Review</h1>
                <p style="color:#9ca3af;font-size:16px;margin:0 0 30px 0;">Security summary for %s</p>

                <div style="background:#1e293b;border-radius:8px;padding:24px;margin-bottom:24px;">
                    %s
                    <a href="%s/login" style="display:inline-block;background:#ef4444;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:6px;font-weight:600;font-size:15px;">View Full Dashboard</a>
                </div>
                """.formatted(companyName, statsContent, baseUrl));
    }

    public String renderTrialEnding(String companyName, int daysLeft) {
        return wrapHtml("Your Trial Ends in " + daysLeft + " Days", """
                <h1 style="color:#ffffff;margin:0 0 10px 0;font-size:28px;">Your Trial Ends Soon</h1>
                <p style="color:#9ca3af;font-size:16px;margin:0 0 30px 0;">%d days remaining on your %s trial.</p>

                <div style="background:#1e293b;border-radius:8px;padding:24px;margin-bottom:24px;">
                    <p style="color:#e2e8f0;margin:0 0 20px 0;font-size:15px;">Don't lose access to your security monitoring. Choose a plan to continue protecting your infrastructure.</p>

                    <table style="width:100%%;border-collapse:separate;border-spacing:12px 0;margin-bottom:24px;">
                        <tr>
                            <td style="background:#0f172a;border-radius:8px;padding:20px;text-align:center;vertical-align:top;width:33%%;">
                                <p style="color:#94a3b8;margin:0 0 4px 0;font-size:12px;">STARTER</p>
                                <p style="color:#ffffff;margin:0 0 4px 0;font-size:24px;font-weight:700;">$1,999</p>
                                <p style="color:#64748b;margin:0 0 12px 0;font-size:12px;">/month</p>
                                <p style="color:#94a3b8;margin:0;font-size:13px;">50 assets<br>5 users<br>30-day retention</p>
                            </td>
                            <td style="background:#0f172a;border:2px solid #ef4444;border-radius:8px;padding:20px;text-align:center;vertical-align:top;width:33%%;">
                                <p style="color:#ef4444;margin:0 0 4px 0;font-size:12px;font-weight:600;">MOST POPULAR</p>
                                <p style="color:#ffffff;margin:0 0 4px 0;font-size:24px;font-weight:700;">$4,999</p>
                                <p style="color:#64748b;margin:0 0 12px 0;font-size:12px;">/month</p>
                                <p style="color:#94a3b8;margin:0;font-size:13px;">200 assets<br>15 users<br>90-day retention</p>
                            </td>
                            <td style="background:#0f172a;border-radius:8px;padding:20px;text-align:center;vertical-align:top;width:33%%;">
                                <p style="color:#94a3b8;margin:0 0 4px 0;font-size:12px;">ENTERPRISE</p>
                                <p style="color:#ffffff;margin:0 0 4px 0;font-size:24px;font-weight:700;">$9,999</p>
                                <p style="color:#64748b;margin:0 0 12px 0;font-size:12px;">/month</p>
                                <p style="color:#94a3b8;margin:0;font-size:13px;">500 assets<br>Unlimited users<br>1-year retention</p>
                            </td>
                        </tr>
                    </table>

                    <div style="text-align:center;">
                        <a href="%s/pricing" style="display:inline-block;background:#ef4444;color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:6px;font-weight:600;font-size:16px;">Choose Your Plan</a>
                    </div>
                </div>

                <p style="color:#64748b;font-size:13px;margin:0;">Questions? Reply to this email — we're here to help.</p>
                """.formatted(daysLeft, companyName, baseUrl));
    }

    // ── COLD OUTREACH TEMPLATES (all CTAs → /landing) ──────────────────────

    public String renderOutreachIntro(String recipientName, String companyDomain) {
        return wrapHtml("Your Infrastructure Is Exposed", """
                <h1 style="color:#ffffff;margin:0 0 10px 0;font-size:28px;">Is Your Infrastructure Protected?</h1>
                <p style="color:#9ca3af;font-size:16px;margin:0 0 30px 0;">Most mid-market companies discover breaches 200+ days late.</p>

                <div style="background:#1e293b;border-radius:8px;padding:24px;margin-bottom:24px;">
                    <p style="color:#e2e8f0;margin:0 0 16px 0;font-size:15px;">Hi%s,</p>

                    <p style="color:#e2e8f0;margin:0 0 16px 0;font-size:15px;">We analyzed publicly visible attack surfaces for companies like <strong style="color:#ef4444;">%s</strong> and found that most lack real-time threat detection.</p>

                    <p style="color:#e2e8f0;margin:0 0 16px 0;font-size:15px;">BlackWolf SOC provides:</p>

                    <div style="background:#0f172a;border-radius:6px;padding:16px;margin-bottom:16px;">
                        <table style="width:100%%;border:none;border-spacing:0;">
                            <tr>
                                <td style="padding:8px 0;color:#4ade80;font-size:14px;">&#10003; 24/7 AI-powered threat monitoring</td>
                            </tr>
                            <tr>
                                <td style="padding:8px 0;color:#4ade80;font-size:14px;">&#10003; Autonomous incident response</td>
                            </tr>
                            <tr>
                                <td style="padding:8px 0;color:#4ade80;font-size:14px;">&#10003; Deploy in hours, not months</td>
                            </tr>
                            <tr>
                                <td style="padding:8px 0;color:#4ade80;font-size:14px;">&#10003; Starting at $1,999/mo (vs $500K/yr in-house)</td>
                            </tr>
                        </table>
                    </div>

                    <p style="color:#94a3b8;margin:0 0 20px 0;font-size:13px;">14-day free trial. No credit card required.</p>

                    <a href="%s/landing" style="display:inline-block;background:#ef4444;color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:6px;font-weight:600;font-size:16px;">Start Free Trial</a>
                </div>
                """.formatted(
                    recipientName != null && !recipientName.isBlank() ? " " + recipientName : "",
                    companyDomain != null ? companyDomain : "your company",
                    baseUrl));
    }

    public String renderOutreachValue(String recipientName) {
        return wrapHtml("What BlackWolf Detects In Real-Time", """
                <h1 style="color:#ffffff;margin:0 0 10px 0;font-size:28px;">What We Detect Every Day</h1>
                <p style="color:#9ca3af;font-size:16px;margin:0 0 30px 0;">Real threats our AI stopped this week across all customers.</p>

                <div style="background:#1e293b;border-radius:8px;padding:24px;margin-bottom:24px;">
                    <p style="color:#e2e8f0;margin:0 0 16px 0;font-size:15px;">Hi%s,</p>

                    <p style="color:#e2e8f0;margin:0 0 20px 0;font-size:15px;">Here's what our AI agent blocked last week:</p>

                    <div style="display:flex;gap:12px;margin-bottom:20px;">
                        <div style="flex:1;background:#0f172a;border-radius:6px;padding:16px;text-align:center;">
                            <p style="color:#94a3b8;margin:0 0 4px 0;font-size:11px;">BRUTE FORCE</p>
                            <p style="color:#ef4444;margin:0;font-size:24px;font-weight:700;">12,847</p>
                        </div>
                        <div style="flex:1;background:#0f172a;border-radius:6px;padding:16px;text-align:center;">
                            <p style="color:#94a3b8;margin:0 0 4px 0;font-size:11px;">PORT SCANS</p>
                            <p style="color:#f59e0b;margin:0;font-size:24px;font-weight:700;">5,392</p>
                        </div>
                        <div style="flex:1;background:#0f172a;border-radius:6px;padding:16px;text-align:center;">
                            <p style="color:#94a3b8;margin:0 0 4px 0;font-size:11px;">IPs BLOCKED</p>
                            <p style="color:#4ade80;margin:0;font-size:24px;font-weight:700;">2,156</p>
                        </div>
                    </div>

                    <p style="color:#e2e8f0;margin:0 0 20px 0;font-size:15px;">Without monitoring, these attacks go unnoticed until it's too late. Our AI catches them in <strong style="color:#ef4444;">&lt; 2 minutes</strong>.</p>

                    <a href="%s/pricing" style="display:inline-block;background:#ef4444;color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:6px;font-weight:600;font-size:16px;">See Plans &amp; Pricing</a>
                </div>
                """.formatted(
                    recipientName != null && !recipientName.isBlank() ? " " + recipientName : "",
                    baseUrl));
    }

    public String renderOutreachSocialProof(String recipientName) {
        return wrapHtml("How Companies Like Yours Stay Protected", """
                <h1 style="color:#ffffff;margin:0 0 10px 0;font-size:28px;">Don't Be the Next Headline</h1>
                <p style="color:#9ca3af;font-size:16px;margin:0 0 30px 0;">Companies without SOC spend 4x more after a breach.</p>

                <div style="background:#1e293b;border-radius:8px;padding:24px;margin-bottom:24px;">
                    <p style="color:#e2e8f0;margin:0 0 16px 0;font-size:15px;">Hi%s,</p>

                    <div style="background:#0f172a;border-radius:6px;padding:20px;margin-bottom:16px;border-left:4px solid #ef4444;">
                        <p style="color:#e2e8f0;margin:0 0 8px 0;font-size:15px;font-style:italic;">"We deployed BlackWolf on a Friday afternoon and caught our first real intrusion attempt by Monday morning. The AI correlated a port scan, brute force, and suspicious login into one incident automatically."</p>
                        <p style="color:#94a3b8;margin:0;font-size:13px;">— CISO, Mid-Market SaaS Company</p>
                    </div>

                    <p style="color:#e2e8f0;margin:0 0 16px 0;font-size:15px;">The average cost of a data breach is <strong style="color:#ef4444;">$4.45 million</strong>. BlackWolf costs less than $25K/year.</p>

                    <table style="width:100%%;border:none;border-spacing:0;margin-bottom:20px;">
                        <tr>
                            <td style="padding:12px;background:#0f172a;border-radius:6px;text-align:center;width:33%%;">
                                <p style="color:#ffffff;margin:0;font-size:24px;font-weight:700;">&lt; 2h</p>
                                <p style="color:#94a3b8;margin:4px 0 0 0;font-size:11px;">Time to Deploy</p>
                            </td>
                            <td style="width:12px;"></td>
                            <td style="padding:12px;background:#0f172a;border-radius:6px;text-align:center;width:33%%;">
                                <p style="color:#ffffff;margin:0;font-size:24px;font-weight:700;">99.9%%</p>
                                <p style="color:#94a3b8;margin:4px 0 0 0;font-size:11px;">Uptime SLA</p>
                            </td>
                            <td style="width:12px;"></td>
                            <td style="padding:12px;background:#0f172a;border-radius:6px;text-align:center;width:33%%;">
                                <p style="color:#ffffff;margin:0;font-size:24px;font-weight:700;">24/7</p>
                                <p style="color:#94a3b8;margin:4px 0 0 0;font-size:11px;">AI Monitoring</p>
                            </td>
                        </tr>
                    </table>

                    <a href="%s/landing" style="display:inline-block;background:#ef4444;color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:6px;font-weight:600;font-size:16px;">Start Your Free Trial</a>
                </div>
                """.formatted(
                    recipientName != null && !recipientName.isBlank() ? " " + recipientName : "",
                    baseUrl));
    }

    public String renderOutreachUrgency(String recipientName) {
        return wrapHtml("Last Chance — Your Free Trial Awaits", """
                <h1 style="color:#ffffff;margin:0 0 10px 0;font-size:28px;">Still Unprotected?</h1>
                <p style="color:#9ca3af;font-size:16px;margin:0 0 30px 0;">Every day without monitoring is a risk you can't afford.</p>

                <div style="background:#1e293b;border-radius:8px;padding:24px;margin-bottom:24px;">
                    <p style="color:#e2e8f0;margin:0 0 16px 0;font-size:15px;">Hi%s,</p>

                    <p style="color:#e2e8f0;margin:0 0 16px 0;font-size:15px;">This is our final reminder. Since our first email, attackers worldwide have launched:</p>

                    <div style="background:#0f172a;border-radius:6px;padding:20px;text-align:center;margin-bottom:16px;">
                        <p style="color:#ef4444;margin:0;font-size:36px;font-weight:800;">2.3 Billion+</p>
                        <p style="color:#94a3b8;margin:4px 0 0 0;font-size:13px;">cyberattacks globally in the last 14 days</p>
                    </div>

                    <p style="color:#e2e8f0;margin:0 0 16px 0;font-size:15px;">BlackWolf makes it simple:</p>
                    <ol style="color:#94a3b8;margin:0 0 20px 0;padding-left:20px;font-size:14px;line-height:2.2;">
                        <li style="color:#e2e8f0;">Sign up (2 minutes)</li>
                        <li style="color:#e2e8f0;">Deploy a sensor (1 command)</li>
                        <li style="color:#e2e8f0;">AI starts protecting you instantly</li>
                    </ol>

                    <div style="text-align:center;">
                        <a href="%s/landing" style="display:inline-block;background:#ef4444;color:#ffffff;text-decoration:none;padding:16px 48px;border-radius:6px;font-weight:700;font-size:18px;">Activate Free Trial Now</a>
                        <p style="color:#64748b;margin:12px 0 0 0;font-size:12px;">14 days free. No credit card. Cancel anytime.</p>
                    </div>
                </div>
                """.formatted(
                    recipientName != null && !recipientName.isBlank() ? " " + recipientName : "",
                    baseUrl));
    }

    public String renderAlertHtml(String subject, String body) {
        return wrapHtml(subject, """
                <h1 style="color:#ffffff;margin:0 0 10px 0;font-size:24px;">%s</h1>
                <div style="background:#1e293b;border-radius:8px;padding:24px;">
                    <pre style="color:#e2e8f0;margin:0;font-size:14px;white-space:pre-wrap;font-family:monospace;">%s</pre>
                </div>
                """.formatted(subject, body));
    }

    private String wrapHtml(String title, String content) {
        return """
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>%s</title>
                </head>
                <body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                    <table width="100%%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;">
                        <tr>
                            <td align="center" style="padding:40px 20px;">
                                <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%%;">
                                    <!-- Header -->
                                    <tr>
                                        <td style="padding:0 0 30px 0;">
                                            <table width="100%%" cellpadding="0" cellspacing="0">
                                                <tr>
                                                    <td>
                                                        <span style="font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">BLACK</span><span style="font-size:24px;font-weight:800;color:#ef4444;letter-spacing:-0.5px;">WOLF</span>
                                                        <span style="color:#475569;font-size:14px;margin-left:8px;">SOC</span>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                    <!-- Content -->
                                    <tr>
                                        <td style="background:#111827;border-radius:12px;padding:40px;">
                                            %s
                                        </td>
                                    </tr>
                                    <!-- Footer -->
                                    <tr>
                                        <td style="padding:30px 0 0 0;text-align:center;">
                                            <p style="color:#475569;font-size:12px;margin:0 0 8px 0;">BlackWolf Security Operations Center</p>
                                            <p style="color:#374151;font-size:11px;margin:0;">
                                                <a href="%s/landing" style="color:#374151;text-decoration:underline;">Home</a> &middot;
                                                <a href="%s/pricing" style="color:#374151;text-decoration:underline;">Pricing</a>
                                            </p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </body>
                </html>
                """.formatted(title, content, baseUrl, baseUrl);
    }
}
