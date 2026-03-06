package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.AiIncidentStudy;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface AiIncidentStudyRepository extends JpaRepository<AiIncidentStudy, String> {

    List<AiIncidentStudy> findByCompanyIdOrderByCreatedAtDesc(String companyId);

    List<AiIncidentStudy> findByCompanyIdAndStudyTypeOrderByCreatedAtDesc(
            String companyId, AiIncidentStudy.StudyType studyType);

    Optional<AiIncidentStudy> findByIncidentIdAndStudyType(String incidentId, AiIncidentStudy.StudyType studyType);

    @Query("SELECT i.id FROM Incident i WHERE i.companyId = :companyId " +
           "AND i.createdAt > :since " +
           "AND i.id NOT IN (SELECT s.incidentId FROM AiIncidentStudy s WHERE s.studyType = 'DEEP_ANALYSIS') " +
           "ORDER BY i.createdAt DESC")
    List<String> findUnstudiedIncidentIds(@Param("companyId") String companyId, @Param("since") LocalDateTime since);

    @Query("SELECT s FROM AiIncidentStudy s WHERE s.companyId = :companyId " +
           "AND s.status = 'COMPLETED' AND s.createdAt > :since ORDER BY s.createdAt DESC")
    List<AiIncidentStudy> findRecentCompleted(@Param("companyId") String companyId, @Param("since") LocalDateTime since);

    long countByCompanyIdAndStatus(String companyId, AiIncidentStudy.StudyStatus status);

    @Query("SELECT COUNT(s) FROM AiIncidentStudy s WHERE s.companyId = :companyId " +
           "AND s.newPatternsDiscovered IS NOT NULL AND s.newPatternsDiscovered != '[]'")
    long countWithNewPatterns(@Param("companyId") String companyId);

    @Query("SELECT COALESCE(SUM(s.tokensUsed), 0) FROM AiIncidentStudy s WHERE s.companyId = :companyId")
    long sumTokensByCompanyId(@Param("companyId") String companyId);
}
