package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.CepState;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface CepStateRepository extends JpaRepository<CepState, Long> {

    List<CepState> findByRuleId(Long ruleId);

    Optional<CepState> findByRuleIdAndStateKey(Long ruleId, String stateKey);

    void deleteByExpiresAtBefore(LocalDateTime before);
}
