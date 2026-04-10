package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.HoneyEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface HoneyEventRepository extends JpaRepository<HoneyEvent, Long> {

    List<HoneyEvent> findByTokenIdOrderByTimestampDesc(Long tokenId);

    long countByTokenId(Long tokenId);
}
