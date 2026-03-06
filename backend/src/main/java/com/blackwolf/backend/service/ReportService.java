package com.blackwolf.backend.service;

import com.blackwolf.backend.dto.MitreDTOs.MitreMappingResponse;
import com.blackwolf.backend.model.*;
import com.blackwolf.backend.repository.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lowagie.text.*;
import com.lowagie.text.Font;
import com.lowagie.text.pdf.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
public class ReportService {

    @Autowired private CompanyRepository companyRepository;
    @Autowired private ThreatEventRepository threatEventRepository;
    @Autowired private SensorRepository sensorRepository;
    @Autowired private IncidentRepository incidentRepository;
    @Autowired private BlockedIPRepository blockedIPRepository;
    @Autowired private IncidentTimelineRepository incidentTimelineRepository;
    @Autowired private CorrelationEventRepository correlationEventRepository;
    @Autowired private MitreService mitreService;
    @Autowired private AiIncidentStudyRepository aiStudyRepository;
    @Autowired private AiEvolutionSnapshotRepository aiSnapshotRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final Font TITLE_FONT = new Font(Font.HELVETICA, 22, Font.BOLD, new Color(30, 41, 59));
    private static final Font SUBTITLE_FONT = new Font(Font.HELVETICA, 14, Font.BOLD, new Color(71, 85, 105));
    private static final Font HEADER_FONT = new Font(Font.HELVETICA, 10, Font.BOLD, Color.WHITE);
    private static final Font BODY_FONT = new Font(Font.HELVETICA, 9, Font.NORMAL, new Color(51, 65, 85));
    private static final Font SMALL_FONT = new Font(Font.HELVETICA, 8, Font.NORMAL, new Color(100, 116, 139));
    private static final Color PRIMARY = new Color(14, 165, 233);
    private static final Color DARK_BG = new Color(30, 41, 59);

    public byte[] generateExecutiveReport(String companyId) throws Exception {
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new RuntimeException("Company not found"));

        List<ThreatEvent> threats = threatEventRepository.findByCompanyId(companyId);
        List<Sensor> sensors = sensorRepository.findByCompanyId(companyId);
        List<Incident> incidents = incidentRepository.findByCompanyId(companyId);
        List<BlockedIP> blockedIPs = blockedIPRepository.findByCompanyId(companyId);

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document doc = new Document(PageSize.A4, 40, 40, 50, 40);
        PdfWriter.getInstance(doc, out);
        doc.open();

        // Header
        Paragraph title = new Paragraph("BlackWolf SOC", TITLE_FONT);
        title.setAlignment(Element.ALIGN_CENTER);
        doc.add(title);

        Paragraph sub = new Paragraph("Executive Security Report", SUBTITLE_FONT);
        sub.setAlignment(Element.ALIGN_CENTER);
        sub.setSpacingAfter(5);
        doc.add(sub);

        Paragraph companyLine = new Paragraph(company.getCompanyName() + " (" + company.getDomain() + ")", BODY_FONT);
        companyLine.setAlignment(Element.ALIGN_CENTER);
        doc.add(companyLine);

        Paragraph dateLine = new Paragraph("Generated: " + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")), SMALL_FONT);
        dateLine.setAlignment(Element.ALIGN_CENTER);
        dateLine.setSpacingAfter(20);
        doc.add(dateLine);

        doc.add(new Paragraph("\n"));

        // Summary Stats
        long threatsToday = threats.stream()
                .filter(t -> t.getTimestamp() != null && t.getTimestamp().isAfter(LocalDateTime.now().toLocalDate().atStartOfDay()))
                .count();
        long activeSensors = sensors.stream().filter(s -> "online".equals(s.getStatus())).count();
        long openIncidents = incidents.stream().filter(i -> !"resolved".equals(i.getStatus()) && !"closed".equals(i.getStatus())).count();

        PdfPTable statsTable = new PdfPTable(4);
        statsTable.setWidthPercentage(100);
        addStatCell(statsTable, "Total Threats", String.valueOf(threats.size()));
        addStatCell(statsTable, "Threats Today", String.valueOf(threatsToday));
        addStatCell(statsTable, "Active Sensors", activeSensors + "/" + sensors.size());
        addStatCell(statsTable, "Blocked IPs", String.valueOf(blockedIPs.size()));
        statsTable.setSpacingAfter(10);
        doc.add(statsTable);

        PdfPTable statsTable2 = new PdfPTable(4);
        statsTable2.setWidthPercentage(100);
        addStatCell(statsTable2, "Total Incidents", String.valueOf(incidents.size()));
        addStatCell(statsTable2, "Open Incidents", String.valueOf(openIncidents));
        long criticalThreats = threats.stream().filter(t -> t.getSeverity() != null && t.getSeverity() >= 8).count();
        addStatCell(statsTable2, "Critical Threats", String.valueOf(criticalThreats));
        long resolved = threats.stream().filter(t -> "resolved".equals(t.getStatus())).count();
        addStatCell(statsTable2, "Resolved", String.valueOf(resolved));
        statsTable2.setSpacingAfter(20);
        doc.add(statsTable2);

        // Threats Table
        doc.add(new Paragraph("Recent Threats", SUBTITLE_FONT));
        doc.add(new Paragraph("\n"));

        PdfPTable threatTable = new PdfPTable(new float[]{2f, 1f, 1.5f, 1.5f, 1f, 1.5f});
        threatTable.setWidthPercentage(100);
        addHeaderCell(threatTable, "Type");
        addHeaderCell(threatTable, "Severity");
        addHeaderCell(threatTable, "Source IP");
        addHeaderCell(threatTable, "Target IP");
        addHeaderCell(threatTable, "Status");
        addHeaderCell(threatTable, "Time");

        int count = 0;
        for (ThreatEvent t : threats) {
            if (count++ >= 30) break;
            addBodyCell(threatTable, t.getThreatType());
            addBodyCell(threatTable, t.getSeverity() != null ? t.getSeverity().toString() : "-");
            addBodyCell(threatTable, t.getSrcIp());
            addBodyCell(threatTable, t.getDstIp());
            addBodyCell(threatTable, t.getStatus());
            addBodyCell(threatTable, t.getTimestamp() != null ? t.getTimestamp().format(DateTimeFormatter.ofPattern("MM-dd HH:mm")) : "-");
        }
        doc.add(threatTable);

        // Incidents
        if (!incidents.isEmpty()) {
            doc.add(new Paragraph("\n"));
            doc.add(new Paragraph("Incidents", SUBTITLE_FONT));
            doc.add(new Paragraph("\n"));

            PdfPTable incTable = new PdfPTable(new float[]{3f, 1f, 1f, 1.5f, 1.5f});
            incTable.setWidthPercentage(100);
            addHeaderCell(incTable, "Title");
            addHeaderCell(incTable, "Severity");
            addHeaderCell(incTable, "Status");
            addHeaderCell(incTable, "Created");
            addHeaderCell(incTable, "SLA Deadline");

            for (Incident inc : incidents) {
                addBodyCell(incTable, inc.getTitle());
                addBodyCell(incTable, inc.getSeverity());
                addBodyCell(incTable, inc.getStatus());
                addBodyCell(incTable, inc.getCreatedAt() != null ? inc.getCreatedAt().format(DateTimeFormatter.ofPattern("MM-dd HH:mm")) : "-");
                addBodyCell(incTable, inc.getSlaDeadline() != null ? inc.getSlaDeadline().format(DateTimeFormatter.ofPattern("MM-dd HH:mm")) : "-");
            }
            doc.add(incTable);
        }

        // Footer
        doc.add(new Paragraph("\n\n"));
        Paragraph footer = new Paragraph("CONFIDENTIAL - BlackWolf Defense SOC Platform", SMALL_FONT);
        footer.setAlignment(Element.ALIGN_CENTER);
        doc.add(footer);

        doc.close();
        return out.toByteArray();
    }

    public byte[] generateIncidentReport(String incidentId) throws Exception {
        Incident incident = incidentRepository.findById(incidentId)
                .orElseThrow(() -> new RuntimeException("Incident not found"));

        List<IncidentTimeline> timeline = incidentTimelineRepository.findByIncidentIdOrderByCreatedAtDesc(incidentId);
        List<MitreMappingResponse> mitreMappings = mitreService.getMappingsForIncident(incidentId);
        List<CorrelationEvent> correlationEvents = correlationEventRepository.findByIncidentId(incidentId);

        ThreatEvent sourceThreat = null;
        if (incident.getSourceThreatId() != null) {
            sourceThreat = threatEventRepository.findById(incident.getSourceThreatId()).orElse(null);
        }

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document doc = new Document(PageSize.A4, 40, 40, 50, 40);
        PdfWriter.getInstance(doc, out);
        doc.open();

        // 1. Header
        Paragraph title = new Paragraph("Incident Report", TITLE_FONT);
        title.setAlignment(Element.ALIGN_CENTER);
        doc.add(title);

        Paragraph incTitle = new Paragraph(incident.getTitle(), SUBTITLE_FONT);
        incTitle.setAlignment(Element.ALIGN_CENTER);
        incTitle.setSpacingAfter(5);
        doc.add(incTitle);

        Paragraph dateLine = new Paragraph("Generated: " + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")), SMALL_FONT);
        dateLine.setAlignment(Element.ALIGN_CENTER);
        dateLine.setSpacingAfter(15);
        doc.add(dateLine);

        // 2. Summary
        doc.add(new Paragraph("Summary", SUBTITLE_FONT));
        doc.add(new Paragraph("\n"));

        PdfPTable summaryTable = new PdfPTable(new float[]{1.5f, 3f});
        summaryTable.setWidthPercentage(100);
        addSummaryRow(summaryTable, "Incident ID", incident.getId());
        addSummaryRow(summaryTable, "Company ID", incident.getCompanyId());
        addSummaryRow(summaryTable, "Severity", incident.getSeverity() != null ? incident.getSeverity().toUpperCase() : "-");
        addSummaryRow(summaryTable, "Status", incident.getStatus() != null ? incident.getStatus().toUpperCase() : "-");
        addSummaryRow(summaryTable, "Assigned To", incident.getAssignedTo() != null ? incident.getAssignedTo() : "Unassigned");
        addSummaryRow(summaryTable, "SLA Deadline", incident.getSlaDeadline() != null ? incident.getSlaDeadline().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")) : "-");
        addSummaryRow(summaryTable, "Created", incident.getCreatedAt() != null ? incident.getCreatedAt().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")) : "-");
        addSummaryRow(summaryTable, "Resolved", incident.getResolvedAt() != null ? incident.getResolvedAt().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")) : "-");
        summaryTable.setSpacingAfter(10);
        doc.add(summaryTable);

        if (incident.getDescription() != null && !incident.getDescription().isBlank()) {
            doc.add(new Paragraph("Description", new Font(Font.HELVETICA, 10, Font.BOLD, new Color(51, 65, 85))));
            Paragraph desc = new Paragraph(incident.getDescription(), BODY_FONT);
            desc.setSpacingAfter(15);
            doc.add(desc);
        }

        // Source Threat info
        if (sourceThreat != null) {
            doc.add(new Paragraph("\n"));
            doc.add(new Paragraph("Source Threat", SUBTITLE_FONT));
            doc.add(new Paragraph("\n"));

            PdfPTable threatInfo = new PdfPTable(new float[]{1.5f, 3f});
            threatInfo.setWidthPercentage(100);
            addSummaryRow(threatInfo, "Threat ID", sourceThreat.getId());
            addSummaryRow(threatInfo, "Type", sourceThreat.getThreatType());
            addSummaryRow(threatInfo, "Severity", sourceThreat.getSeverity() != null ? sourceThreat.getSeverity().toString() : "-");
            addSummaryRow(threatInfo, "Source IP", sourceThreat.getSrcIp());
            addSummaryRow(threatInfo, "Target IP", sourceThreat.getDstIp());
            addSummaryRow(threatInfo, "Status", sourceThreat.getStatus());
            threatInfo.setSpacingAfter(15);
            doc.add(threatInfo);
        }

        // 3. Timeline
        if (!timeline.isEmpty()) {
            doc.add(new Paragraph("\n"));
            doc.add(new Paragraph("Timeline", SUBTITLE_FONT));
            doc.add(new Paragraph("\n"));

            PdfPTable timelineTable = new PdfPTable(new float[]{1.5f, 1.5f, 3f, 1.5f});
            timelineTable.setWidthPercentage(100);
            addHeaderCell(timelineTable, "Timestamp");
            addHeaderCell(timelineTable, "Action");
            addHeaderCell(timelineTable, "Description");
            addHeaderCell(timelineTable, "Performed By");

            for (IncidentTimeline entry : timeline) {
                addBodyCell(timelineTable, entry.getCreatedAt() != null ? entry.getCreatedAt().format(DateTimeFormatter.ofPattern("MM-dd HH:mm")) : "-");
                addBodyCell(timelineTable, entry.getAction());
                addBodyCell(timelineTable, entry.getDescription());
                addBodyCell(timelineTable, entry.getPerformedBy());
            }
            timelineTable.setSpacingAfter(15);
            doc.add(timelineTable);
        }

        // 4. MITRE Techniques
        if (!mitreMappings.isEmpty()) {
            doc.add(new Paragraph("\n"));
            doc.add(new Paragraph("MITRE ATT&CK Techniques", SUBTITLE_FONT));
            doc.add(new Paragraph("\n"));

            PdfPTable mitreTable = new PdfPTable(new float[]{1.5f, 2.5f, 2f, 1f});
            mitreTable.setWidthPercentage(100);
            addHeaderCell(mitreTable, "Technique ID");
            addHeaderCell(mitreTable, "Name");
            addHeaderCell(mitreTable, "Tactic");
            addHeaderCell(mitreTable, "Confidence");

            for (MitreMappingResponse m : mitreMappings) {
                addBodyCell(mitreTable, m.getTechniqueId());
                addBodyCell(mitreTable, m.getTechniqueName());
                addBodyCell(mitreTable, m.getTactic());
                addBodyCell(mitreTable, m.getConfidence() != null ? m.getConfidence() + "%" : "-");
            }
            mitreTable.setSpacingAfter(15);
            doc.add(mitreTable);
        }

        // 5. Correlated Threats
        if (!correlationEvents.isEmpty()) {
            doc.add(new Paragraph("\n"));
            doc.add(new Paragraph("Correlated Threats", SUBTITLE_FONT));
            doc.add(new Paragraph("\n"));

            PdfPTable corrTable = new PdfPTable(new float[]{2f, 2f, 2f, 2f});
            corrTable.setWidthPercentage(100);
            addHeaderCell(corrTable, "Rule ID");
            addHeaderCell(corrTable, "Threat Event ID");
            addHeaderCell(corrTable, "Matched At");
            addHeaderCell(corrTable, "Details");

            for (CorrelationEvent ce : correlationEvents) {
                addBodyCell(corrTable, ce.getRuleId());
                addBodyCell(corrTable, ce.getThreatEventId());
                addBodyCell(corrTable, ce.getMatchedAt() != null ? ce.getMatchedAt().format(DateTimeFormatter.ofPattern("MM-dd HH:mm")) : "-");
                addBodyCell(corrTable, ce.getDetails());
            }
            corrTable.setSpacingAfter(15);
            doc.add(corrTable);
        }

        // 6. Footer
        doc.add(new Paragraph("\n\n"));
        Paragraph footer = new Paragraph("Generated by BlackWolf SOC Platform", SMALL_FONT);
        footer.setAlignment(Element.ALIGN_CENTER);
        doc.add(footer);

        doc.close();
        return out.toByteArray();
    }

    public byte[] generateAiEvolutionReport(String companyId, int days) throws Exception {
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new RuntimeException("Company not found"));

        java.time.LocalDate from = java.time.LocalDate.now().minusDays(days);
        java.time.LocalDate to = java.time.LocalDate.now();

        List<AiEvolutionSnapshot> snapshots = aiSnapshotRepository
                .findByCompanyIdAndSnapshotDateBetweenOrderBySnapshotDateAsc(companyId, from, to);

        java.time.LocalDateTime since = LocalDateTime.now().minusDays(days);
        List<AiIncidentStudy> studies = aiStudyRepository.findRecentCompleted(companyId, since);

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document doc = new Document(PageSize.A4, 40, 40, 50, 40);
        PdfWriter.getInstance(doc, out);
        doc.open();

        // Header
        Paragraph title = new Paragraph("BlackWolf SOC", TITLE_FONT);
        title.setAlignment(Element.ALIGN_CENTER);
        doc.add(title);

        Paragraph sub = new Paragraph("AI Agent Evolution Report", SUBTITLE_FONT);
        sub.setAlignment(Element.ALIGN_CENTER);
        sub.setSpacingAfter(5);
        doc.add(sub);

        Paragraph companyLine = new Paragraph(company.getCompanyName() + " (" + company.getDomain() + ")", BODY_FONT);
        companyLine.setAlignment(Element.ALIGN_CENTER);
        doc.add(companyLine);

        Paragraph dateLine = new Paragraph("Period: " + from + " to " + to + " | Generated: " +
                LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")), SMALL_FONT);
        dateLine.setAlignment(Element.ALIGN_CENTER);
        dateLine.setSpacingAfter(20);
        doc.add(dateLine);

        doc.add(new Paragraph("\n"));

        // Stats Grid
        long totalStudies = studies.size();
        double avgAccuracy = snapshots.stream()
                .filter(s -> s.getAccuracyScore() != null)
                .mapToDouble(AiEvolutionSnapshot::getAccuracyScore)
                .average().orElse(0);
        long totalPatterns = studies.stream()
                .filter(s -> s.getNewPatternsDiscovered() != null && !"[]".equals(s.getNewPatternsDiscovered()))
                .count();
        long totalDefenses = studies.stream()
                .filter(s -> s.getDefenseRecommendations() != null && !"[]".equals(s.getDefenseRecommendations()))
                .count();

        PdfPTable statsTable = new PdfPTable(4);
        statsTable.setWidthPercentage(100);
        addStatCell(statsTable, "Total Studies", String.valueOf(totalStudies));
        addStatCell(statsTable, "Avg Accuracy", String.format("%.1f%%", avgAccuracy));
        addStatCell(statsTable, "Patterns Found", String.valueOf(totalPatterns));
        addStatCell(statsTable, "Defense Proposals", String.valueOf(totalDefenses));
        statsTable.setSpacingAfter(20);
        doc.add(statsTable);

        // Evolution Timeline Table
        if (!snapshots.isEmpty()) {
            doc.add(new Paragraph("Evolution Timeline", SUBTITLE_FONT));
            doc.add(new Paragraph("\n"));

            PdfPTable evoTable = new PdfPTable(new float[]{1.5f, 1f, 1f, 1.2f, 1f, 1f});
            evoTable.setWidthPercentage(100);
            addHeaderCell(evoTable, "Date");
            addHeaderCell(evoTable, "Accuracy");
            addHeaderCell(evoTable, "Confidence");
            addHeaderCell(evoTable, "FP Reduction");
            addHeaderCell(evoTable, "Patterns");
            addHeaderCell(evoTable, "Studies");

            for (AiEvolutionSnapshot s : snapshots) {
                addBodyCell(evoTable, s.getSnapshotDate().toString());
                addBodyCell(evoTable, s.getAccuracyScore() != null ? String.format("%.1f%%", s.getAccuracyScore()) : "-");
                addBodyCell(evoTable, s.getMeanConfidenceScore() != null ? String.format("%.1f%%", s.getMeanConfidenceScore()) : "-");
                addBodyCell(evoTable, s.getFalsePositiveReductionPct() != null ? String.format("%.1f%%", s.getFalsePositiveReductionPct()) : "-");
                addBodyCell(evoTable, s.getNewPatternsCount() != null ? String.valueOf(s.getNewPatternsCount()) : "0");
                addBodyCell(evoTable, s.getTotalIncidentsStudied() != null ? String.valueOf(s.getTotalIncidentsStudied()) : "0");
            }
            evoTable.setSpacingAfter(15);
            doc.add(evoTable);
        }

        // Recent Studies Table
        if (!studies.isEmpty()) {
            doc.add(new Paragraph("\n"));
            doc.add(new Paragraph("Recent Deep Studies", SUBTITLE_FONT));
            doc.add(new Paragraph("\n"));

            PdfPTable studyTable = new PdfPTable(new float[]{1.5f, 1f, 3f, 2f});
            studyTable.setWidthPercentage(100);
            addHeaderCell(studyTable, "Incident");
            addHeaderCell(studyTable, "Sophistication");
            addHeaderCell(studyTable, "Root Cause");
            addHeaderCell(studyTable, "Key Defenses");

            int count = 0;
            for (AiIncidentStudy s : studies) {
                if (count++ >= 20) break;
                addBodyCell(studyTable, s.getIncidentId() != null ? s.getIncidentId().substring(0, Math.min(8, s.getIncidentId().length())) : "-");
                addBodyCell(studyTable, s.getAttackSophistication() != null ? s.getAttackSophistication() + "/10" : "-");
                addBodyCell(studyTable, s.getRootCause() != null ? s.getRootCause().substring(0, Math.min(s.getRootCause().length(), 100)) : "-");

                String defenses = "-";
                if (s.getDefenseRecommendations() != null) {
                    try {
                        JsonNode arr = objectMapper.readTree(s.getDefenseRecommendations());
                        if (arr.isArray() && arr.size() > 0) {
                            defenses = arr.get(0).asText();
                            if (defenses.length() > 60) defenses = defenses.substring(0, 60) + "...";
                        }
                    } catch (Exception ignored) {}
                }
                addBodyCell(studyTable, defenses);
            }
            studyTable.setSpacingAfter(15);
            doc.add(studyTable);
        }

        // AI Evolution Narrative (from latest snapshot)
        if (!snapshots.isEmpty()) {
            AiEvolutionSnapshot latest = snapshots.get(snapshots.size() - 1);
            if (latest.getEvolutionSummary() != null && !latest.getEvolutionSummary().isBlank()) {
                doc.add(new Paragraph("\n"));
                doc.add(new Paragraph("AI Evolution Narrative", SUBTITLE_FONT));
                Paragraph narrative = new Paragraph(latest.getEvolutionSummary(), BODY_FONT);
                narrative.setSpacingBefore(5);
                narrative.setSpacingAfter(15);
                doc.add(narrative);
            }

            if (latest.getAreasNeedingAttention() != null && !latest.getAreasNeedingAttention().isBlank()) {
                doc.add(new Paragraph("Areas Needing Attention", new Font(Font.HELVETICA, 10, Font.BOLD, new Color(220, 38, 38))));
                Paragraph attention = new Paragraph(latest.getAreasNeedingAttention(), BODY_FONT);
                attention.setSpacingBefore(5);
                attention.setSpacingAfter(15);
                doc.add(attention);
            }
        }

        // Footer
        doc.add(new Paragraph("\n\n"));
        Paragraph footer = new Paragraph("Generated by BlackWolf SOC Platform", SMALL_FONT);
        footer.setAlignment(Element.ALIGN_CENTER);
        doc.add(footer);

        doc.close();
        return out.toByteArray();
    }

    private void addSummaryRow(PdfPTable table, String label, String value) {
        PdfPCell labelCell = new PdfPCell(new Phrase(label, new Font(Font.HELVETICA, 9, Font.BOLD, new Color(71, 85, 105))));
        labelCell.setPadding(5);
        labelCell.setBorderColor(new Color(226, 232, 240));
        labelCell.setBackgroundColor(new Color(241, 245, 249));
        table.addCell(labelCell);

        PdfPCell valueCell = new PdfPCell(new Phrase(value != null ? value : "-", BODY_FONT));
        valueCell.setPadding(5);
        valueCell.setBorderColor(new Color(226, 232, 240));
        table.addCell(valueCell);
    }

    // CSV exports
    public String exportThreatsCSV(String companyId) {
        List<ThreatEvent> threats = threatEventRepository.findByCompanyId(companyId);
        StringBuilder csv = new StringBuilder();
        csv.append("ID,Type,Severity,SourceIP,TargetIP,Port,Status,Timestamp,Description\n");
        for (ThreatEvent t : threats) {
            csv.append(String.format("%s,%s,%s,%s,%s,%s,%s,%s,\"%s\"\n",
                    t.getId(), t.getThreatType(), t.getSeverity(), t.getSrcIp(),
                    t.getDstIp(), t.getDstPort(), t.getStatus(), t.getTimestamp(),
                    t.getDescription() != null ? t.getDescription().replace("\"", "\"\"") : ""));
        }
        return csv.toString();
    }

    public String exportIncidentsCSV(String companyId) {
        List<Incident> incidents = incidentRepository.findByCompanyId(companyId);
        StringBuilder csv = new StringBuilder();
        csv.append("ID,Title,Severity,Status,AssignedTo,Created,SLA Deadline,Resolved\n");
        for (Incident i : incidents) {
            csv.append(String.format("%s,\"%s\",%s,%s,%s,%s,%s,%s\n",
                    i.getId(), i.getTitle(), i.getSeverity(), i.getStatus(),
                    i.getAssignedTo() != null ? i.getAssignedTo() : "",
                    i.getCreatedAt(), i.getSlaDeadline(),
                    i.getResolvedAt() != null ? i.getResolvedAt() : ""));
        }
        return csv.toString();
    }

    private void addStatCell(PdfPTable table, String label, String value) {
        PdfPCell cell = new PdfPCell();
        cell.setBorderColor(new Color(51, 65, 85));
        cell.setBackgroundColor(DARK_BG);
        cell.setPadding(10);
        cell.addElement(new Paragraph(value, new Font(Font.HELVETICA, 18, Font.BOLD, PRIMARY)));
        cell.addElement(new Paragraph(label, SMALL_FONT));
        table.addCell(cell);
    }

    private void addHeaderCell(PdfPTable table, String text) {
        PdfPCell cell = new PdfPCell(new Phrase(text, HEADER_FONT));
        cell.setBackgroundColor(DARK_BG);
        cell.setPadding(6);
        table.addCell(cell);
    }

    private void addBodyCell(PdfPTable table, String text) {
        PdfPCell cell = new PdfPCell(new Phrase(text != null ? text : "-", BODY_FONT));
        cell.setPadding(5);
        cell.setBorderColor(new Color(226, 232, 240));
        table.addCell(cell);
    }
}
