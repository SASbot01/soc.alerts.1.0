package com.blackwolf.backend.controller;

import com.blackwolf.backend.dto.ChatDTOs.*;
import com.blackwolf.backend.service.AiChatService;
import com.blackwolf.backend.util.AuthUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/chat")
public class AiChatController {

    @Autowired
    private AiChatService aiChatService;

    @Autowired
    private AuthUtils authUtils;

    @PostMapping("/send")
    public ResponseEntity<ChatResponse> sendMessage(
            @RequestBody SendMessageRequest request, Authentication auth) {
        String companyId = authUtils.getCompanyId(auth);
        String userId = authUtils.getUserId(auth);
        return ResponseEntity.ok(aiChatService.sendMessage(companyId, userId, request));
    }

    @GetMapping("/sessions")
    public ResponseEntity<List<ChatSessionSummary>> listSessions(Authentication auth) {
        String companyId = authUtils.getCompanyId(auth);
        String userId = authUtils.getUserId(auth);
        return ResponseEntity.ok(aiChatService.listSessions(companyId, userId));
    }

    @GetMapping("/sessions/{id}")
    public ResponseEntity<ChatHistoryResponse> getSessionHistory(
            @PathVariable String id, Authentication auth) {
        String companyId = authUtils.getCompanyId(auth);
        return ResponseEntity.ok(aiChatService.getSessionHistory(id, companyId));
    }

    @DeleteMapping("/sessions/{id}")
    public ResponseEntity<Void> deleteSession(
            @PathVariable String id, Authentication auth) {
        String companyId = authUtils.getCompanyId(auth);
        aiChatService.deleteSession(id, companyId);
        return ResponseEntity.ok().build();
    }
}
