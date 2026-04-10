package com.blackwolf.backend.controller;

import com.blackwolf.backend.util.AuthUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@RestController
@RequestMapping("/api/v1/agent")
public class AgentDownloadController {

    @Autowired
    private AuthUtils authUtils;

    @GetMapping("/info")
    @PreAuthorize("@perm.has(authentication, 'sensors:read')")
    public ResponseEntity<Map<String, Object>> getAgentInfo() {
        return ResponseEntity.ok(Map.of(
                "name", "BlackWolf SOC Agent",
                "version", "1.0.0",
                "platform", "Linux, Windows, macOS",
                "capabilities", new String[]{
                        "File Integrity Monitoring (FIM)",
                        "Auth log monitoring (SSH brute force, privilege escalation, Windows Event Log)",
                        "Process monitoring (reverse shells, malware, PowerShell attacks)",
                        "Network connection monitoring (C2 beacons)",
                        "System resource anomalies"
                },
                "requirements", Map.of(
                        "os", "Linux (Ubuntu 20.04+, Debian 11+, RHEL 8+), Windows 10/11/Server 2016+, macOS 12+",
                        "python", "3.8+",
                        "privileges", "root/Administrator (for FIM and log access)"
                ),
                "installCommands", Map.of(
                        "linux", "sudo ./install.sh --url <SOC_URL> --key <API_KEY> --company <COMPANY_ID>",
                        "macos", "sudo ./install-mac.sh --url <SOC_URL> --key <API_KEY> --company <COMPANY_ID>",
                        "windows", ".\\install.ps1 -SocUrl <SOC_URL> -ApiKey <API_KEY> -CompanyId <COMPANY_ID>"
                )
        ));
    }

    @GetMapping("/download")
    @PreAuthorize("@perm.has(authentication, 'sensors:read')")
    public ResponseEntity<byte[]> downloadAgent(Authentication auth) throws IOException {
        String companyId = authUtils.getCompanyId(auth);

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (ZipOutputStream zos = new ZipOutputStream(baos)) {
            // Add the agent Python script
            addFileToZip(zos, "blackwolf-agent/blackwolf-agent.py", readAgentFile("blackwolf-agent.py"));
            // Linux
            addFileToZip(zos, "blackwolf-agent/install.sh", readAgentFile("install.sh"));
            addFileToZip(zos, "blackwolf-agent/uninstall.sh", readAgentFile("uninstall.sh"));
            // macOS
            addFileToZip(zos, "blackwolf-agent/install-mac.sh", readAgentFile("install-mac.sh"));
            addFileToZip(zos, "blackwolf-agent/uninstall-mac.sh", readAgentFile("uninstall-mac.sh"));
            // Windows
            addFileToZip(zos, "blackwolf-agent/install.ps1", readAgentFile("install.ps1"));
            addFileToZip(zos, "blackwolf-agent/uninstall.ps1", readAgentFile("uninstall.ps1"));

            // Add a README
            String readme = """
                    BlackWolf SOC Agent
                    ====================

                    Cross-platform EDR agent for Linux, Windows, and macOS.

                    Installation:

                      Linux:
                        sudo ./install.sh --url <SOC_URL> --key <API_KEY> --company <COMPANY_ID>

                      macOS:
                        sudo ./install-mac.sh --url <SOC_URL> --key <API_KEY> --company <COMPANY_ID>

                      Windows (PowerShell as Administrator):
                        .\\install.ps1 -SocUrl <SOC_URL> -ApiKey <API_KEY> -CompanyId <COMPANY_ID>

                    Management:

                      Linux:
                        Status : systemctl status blackwolf-agent
                        Logs   : journalctl -u blackwolf-agent -f
                        Remove : sudo ./uninstall.sh

                      macOS:
                        Status : launchctl list | grep blackwolf
                        Logs   : tail -f /var/log/blackwolf-agent.log
                        Remove : sudo ./uninstall-mac.sh

                      Windows:
                        Status : Get-ScheduledTask -TaskName BlackWolfAgent
                        Remove : .\\uninstall.ps1

                    Company ID: %s
                    """.formatted(companyId);
            addFileToZip(zos, "blackwolf-agent/README.txt", readme.getBytes(StandardCharsets.UTF_8));
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
        headers.set(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=blackwolf-agent.zip");

        return ResponseEntity.ok()
                .headers(headers)
                .body(baos.toByteArray());
    }

    private byte[] readAgentFile(String filename) throws IOException {
        // Try classpath first (packaged), then filesystem (dev)
        try {
            Resource resource = new ClassPathResource("agent/" + filename);
            return resource.getInputStream().readAllBytes();
        } catch (Exception e) {
            // Fallback: read from deploy directory (development mode)
            File file = new File("../deploy/blackwolf-agent/" + filename);
            if (!file.exists()) {
                file = new File("deploy/blackwolf-agent/" + filename);
            }
            if (file.exists()) {
                return java.nio.file.Files.readAllBytes(file.toPath());
            }
            throw new FileNotFoundException("Agent file not found: " + filename);
        }
    }

    private void addFileToZip(ZipOutputStream zos, String entryName, byte[] content) throws IOException {
        ZipEntry entry = new ZipEntry(entryName);
        zos.putNextEntry(entry);
        zos.write(content);
        zos.closeEntry();
    }
}
