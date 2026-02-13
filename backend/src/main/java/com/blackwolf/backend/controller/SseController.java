package com.blackwolf.backend.controller;

import com.blackwolf.backend.service.SseService;
import com.blackwolf.backend.util.AuthUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/v1/sse")
public class SseController {

    @Autowired
    private SseService sseService;

    @Autowired
    private AuthUtils authUtils;

    @GetMapping(value = "/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter subscribe(
            @RequestParam(required = false) String companyId,
            @RequestParam(required = false) String token) {

        // For SSE, auth can come via query param since EventSource doesn't support headers
        // The companyId param is used for unauthenticated SSE; authenticated users get their company
        if (companyId != null && !companyId.isBlank()) {
            return sseService.subscribe(companyId);
        }

        // Fallback: global stream
        return sseService.subscribeGlobal();
    }

    @GetMapping(value = "/global", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter subscribeGlobal() {
        return sseService.subscribeGlobal();
    }
}
