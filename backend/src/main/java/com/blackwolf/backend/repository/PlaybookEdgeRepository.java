package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.PlaybookEdge;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface PlaybookEdgeRepository extends JpaRepository<PlaybookEdge, String> {
    List<PlaybookEdge> findByPlaybookId(String playbookId);
    void deleteByPlaybookId(String playbookId);
}
