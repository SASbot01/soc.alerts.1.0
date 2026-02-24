package com.blackwolf.backend.service;

import com.blackwolf.backend.elasticsearch.ThreatEventDocument;
import com.blackwolf.backend.elasticsearch.ThreatEventDocumentRepository;
import com.blackwolf.backend.model.ThreatEvent;
import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.elasticsearch._types.SortOrder;
import co.elastic.clients.elasticsearch._types.query_dsl.*;
import co.elastic.clients.elasticsearch.core.SearchRequest;
import co.elastic.clients.elasticsearch.core.SearchResponse;
import co.elastic.clients.elasticsearch.core.search.Hit;
import co.elastic.clients.json.JsonData;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ThreatIndexService {

    private static final Logger log = LoggerFactory.getLogger(ThreatIndexService.class);
    private static final String INDEX_NAME = "threat-events";

    @Autowired(required = false)
    private ThreatEventDocumentRepository documentRepository;

    @Autowired(required = false)
    private ElasticsearchClient elasticsearchClient;

    @Async
    public void indexThreatEvent(ThreatEvent event) {
        if (documentRepository == null) return;
        try {
            ThreatEventDocument doc = new ThreatEventDocument();
            doc.setId(event.getId());
            doc.setCompanyId(event.getCompanyId());
            doc.setSensorId(event.getSensorId());
            doc.setThreatType(event.getThreatType());
            doc.setSeverity(event.getSeverity());
            doc.setSrcIp(event.getSrcIp());
            doc.setDstIp(event.getDstIp());
            doc.setDstPort(event.getDstPort());
            doc.setDescription(event.getDescription());
            doc.setStatus(event.getStatus());
            doc.setTimestamp(event.getTimestamp());
            documentRepository.save(doc);
        } catch (Exception e) {
            log.warn("Failed to index threat event {}: {}", event.getId(), e.getMessage());
        }
    }

    public Map<String, Object> search(String companyId, Map<String, Object> query) {
        if (elasticsearchClient == null) {
            return Map.of("hits", List.of(), "total", 0, "error", "Elasticsearch not available");
        }

        try {
            BoolQuery.Builder boolBuilder = new BoolQuery.Builder();

            // Always filter by company
            boolBuilder.filter(TermQuery.of(t -> t.field("companyId").value(companyId))._toQuery());

            // Optional filters
            if (query.containsKey("srcIp") && query.get("srcIp") != null) {
                boolBuilder.filter(TermQuery.of(t -> t.field("srcIp").value((String) query.get("srcIp")))._toQuery());
            }
            if (query.containsKey("dstIp") && query.get("dstIp") != null) {
                boolBuilder.filter(TermQuery.of(t -> t.field("dstIp").value((String) query.get("dstIp")))._toQuery());
            }
            if (query.containsKey("threatType") && query.get("threatType") != null) {
                boolBuilder.filter(TermQuery.of(t -> t.field("threatType").value((String) query.get("threatType")))._toQuery());
            }
            if (query.containsKey("sensorId") && query.get("sensorId") != null) {
                boolBuilder.filter(TermQuery.of(t -> t.field("sensorId").value((String) query.get("sensorId")))._toQuery());
            }
            if (query.containsKey("status") && query.get("status") != null) {
                boolBuilder.filter(TermQuery.of(t -> t.field("status").value((String) query.get("status")))._toQuery());
            }

            // Severity range
            if (query.containsKey("minSeverity")) {
                int min = ((Number) query.get("minSeverity")).intValue();
                boolBuilder.filter(RangeQuery.of(r -> r.field("severity").gte(JsonData.of(min)))._toQuery());
            }
            if (query.containsKey("maxSeverity")) {
                int max = ((Number) query.get("maxSeverity")).intValue();
                boolBuilder.filter(RangeQuery.of(r -> r.field("severity").lte(JsonData.of(max)))._toQuery());
            }

            // Time range
            if (query.containsKey("from") && query.get("from") != null) {
                String fromVal = (String) query.get("from");
                boolBuilder.filter(RangeQuery.of(r -> r.field("timestamp").gte(JsonData.of(fromVal)))._toQuery());
            }
            if (query.containsKey("to") && query.get("to") != null) {
                String toVal = (String) query.get("to");
                boolBuilder.filter(RangeQuery.of(r -> r.field("timestamp").lte(JsonData.of(toVal)))._toQuery());
            }

            // Free text search
            if (query.containsKey("q") && query.get("q") != null) {
                String q = (String) query.get("q");
                boolBuilder.must(QueryStringQuery.of(qs -> qs.query(q).defaultField("description"))._toQuery());
            }

            int size = query.containsKey("size") ? ((Number) query.get("size")).intValue() : 50;
            int from = query.containsKey("page") ? ((Number) query.get("page")).intValue() * size : 0;

            SearchRequest searchRequest = SearchRequest.of(s -> s
                    .index(INDEX_NAME)
                    .query(boolBuilder.build()._toQuery())
                    .from(from)
                    .size(size)
                    .sort(so -> so.field(f -> f.field("timestamp").order(SortOrder.Desc)))
            );

            SearchResponse<ThreatEventDocument> response = elasticsearchClient.search(searchRequest, ThreatEventDocument.class);

            List<ThreatEventDocument> hits = response.hits().hits().stream()
                    .map(Hit::source)
                    .filter(Objects::nonNull)
                    .collect(Collectors.toList());

            long total = response.hits().total() != null ? response.hits().total().value() : 0;

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("hits", hits);
            result.put("total", total);
            result.put("page", from / size);
            result.put("size", size);
            return result;

        } catch (Exception e) {
            log.error("Elasticsearch search failed: {}", e.getMessage());
            return Map.of("hits", List.of(), "total", 0, "error", e.getMessage());
        }
    }

    public Map<String, Object> aggregate(String companyId, String field, String timeRange) {
        if (elasticsearchClient == null) {
            return Map.of("buckets", List.of(), "error", "Elasticsearch not available");
        }

        try {
            BoolQuery.Builder boolBuilder = new BoolQuery.Builder();
            boolBuilder.filter(TermQuery.of(t -> t.field("companyId").value(companyId))._toQuery());

            if (timeRange != null) {
                String fromVal = "now-" + timeRange;
                boolBuilder.filter(RangeQuery.of(r -> r.field("timestamp").gte(JsonData.of(fromVal)))._toQuery());
            }

            SearchRequest searchRequest = SearchRequest.of(s -> s
                    .index(INDEX_NAME)
                    .query(boolBuilder.build()._toQuery())
                    .size(0)
                    .aggregations("field_agg", a -> a.terms(t -> t.field(field).size(50)))
            );

            SearchResponse<Void> response = elasticsearchClient.search(searchRequest, Void.class);

            List<Map<String, Object>> buckets = new ArrayList<>();
            if (response.aggregations().containsKey("field_agg")) {
                response.aggregations().get("field_agg").sterms().buckets().array().forEach(b -> {
                    Map<String, Object> bucket = new LinkedHashMap<>();
                    bucket.put("key", b.key().stringValue());
                    bucket.put("count", b.docCount());
                    buckets.add(bucket);
                });
            }

            return Map.of("buckets", buckets);

        } catch (Exception e) {
            log.error("Elasticsearch aggregation failed: {}", e.getMessage());
            return Map.of("buckets", List.of(), "error", e.getMessage());
        }
    }
}
