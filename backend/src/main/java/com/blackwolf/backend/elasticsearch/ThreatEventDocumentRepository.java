package com.blackwolf.backend.elasticsearch;

import org.springframework.data.elasticsearch.repository.ElasticsearchRepository;

import java.util.List;

public interface ThreatEventDocumentRepository extends ElasticsearchRepository<ThreatEventDocument, String> {

    List<ThreatEventDocument> findByCompanyId(String companyId);

    List<ThreatEventDocument> findByCompanyIdAndSrcIp(String companyId, String srcIp);

    List<ThreatEventDocument> findByCompanyIdAndThreatType(String companyId, String threatType);
}
