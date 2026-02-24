package com.blackwolf.backend.controller;

import com.blackwolf.backend.service.EmailTemplateService;
import jakarta.mail.internet.MimeMessage;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/soc-info")
public class SocInfoController {

    @Value("${info.app.version:2.0.0}")
    private String appVersion;

    @Value("${alerts.from-email:soc@blackwolf.io}")
    private String fromEmail;

    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Autowired
    private EmailTemplateService emailTemplateService;

    @GetMapping
    public ResponseEntity<Map<String, String>> getSocInfo() {
        return ResponseEntity.ok(Map.of(
                "app", "blackwolf-soc",
                "version", appVersion
        ));
    }

    @PostMapping("/test-email")
    public ResponseEntity<Map<String, String>> testEmail(@RequestParam String to) {
        if (mailSender == null) {
            return ResponseEntity.status(500).body(Map.of("error", "Mail sender not configured"));
        }
        try {
            String html = emailTemplateService.renderWeeklyReport("BlackWolf Demo", 147, 12, 38);
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom("BlackWolf SOC <" + fromEmail + ">");
            helper.setTo(to);
            helper.setSubject("[BlackWolf SOC] Test Email - System Operational");
            helper.setText(html, true);
            mailSender.send(message);
            return ResponseEntity.ok(Map.of("status", "sent", "to", to));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }
}
