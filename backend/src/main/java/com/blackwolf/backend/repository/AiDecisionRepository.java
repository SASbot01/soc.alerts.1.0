package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.AiDecision;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface AiDecisionRepository extends JpaRepository<AiDecision, String> {

    List<AiDecision> findByCompanyIdOrderByCreatedAtDesc(String companyId);

    List<AiDecision> findByCompanyIdAndVerdictOrderByCreatedAtDesc(String companyId, AiDecision.Verdict verdict);

    List<AiDecision> findByBatchId(String batchId);

    long countByCompanyId(String companyId);

    long countByCompanyIdAndVerdict(String companyId, AiDecision.Verdict verdict);

    long countByCompanyIdAndCreatedAtAfter(String companyId, LocalDateTime after);

    @Query("SELECT d FROM AiDecision d WHERE d.companyId = :companyId AND d.createdAt > :since ORDER BY d.createdAt DESC")
    List<AiDecision> findRecentByCompany(@Param("companyId") String companyId, @Param("since") LocalDateTime since);

    @Query("SELECT d.verdict, COUNT(d) FROM AiDecision d WHERE d.companyId = :companyId AND d.createdAt > :since GROUP BY d.verdict")
    List<Object[]> countByVerdictSince(@Param("companyId") String companyId, @Param("since") LocalDateTime since);

    List<AiDecision> findByThreatEventId(String threatEventId);

    @Query("SELECT COALESCE(SUM(d.tokensUsed), 0) FROM AiDecision d WHERE d.companyId = :companyId")
    long sumTokensByCompanyId(@Param("companyId") String companyId);

    @Query("SELECT COALESCE(SUM(d.tokensUsed), 0) FROM AiDecision d WHERE d.companyId = :companyId AND d.createdAt > :since")
    long sumTokensSince(@Param("companyId") String companyId, @Param("since") LocalDateTime since);

    @Query("SELECT COALESCE(AVG(d.tokensUsed), 0) FROM AiDecision d WHERE d.companyId = :companyId AND d.tokensUsed > 0")
    double avgTokensPerDecision(@Param("companyId") String companyId);

    @Query("SELECT d.verdict, COALESCE(SUM(d.tokensUsed), 0), COUNT(d) FROM AiDecision d WHERE d.companyId = :companyId GROUP BY d.verdict")
    List<Object[]> tokenBreakdownByVerdict(@Param("companyId") String companyId);
}
