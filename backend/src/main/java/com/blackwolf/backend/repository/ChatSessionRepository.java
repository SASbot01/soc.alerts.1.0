package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.ChatSession;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ChatSessionRepository extends JpaRepository<ChatSession, String> {
    List<ChatSession> findByCompanyIdAndUserIdOrderByUpdatedAtDesc(String companyId, String userId);
}
