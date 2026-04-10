package com.blackwolf.backend.repository;

import com.blackwolf.backend.model.IocEntry;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface IocEntryRepository extends JpaRepository<IocEntry, Long> {

    List<IocEntry> findByCompanyIdAndActive(String companyId, Boolean active);

    Optional<IocEntry> findByValueAndIocType(String value, String iocType);

    Page<IocEntry> findByCompanyIdOrderByLastSeenDesc(String companyId, Pageable pageable);
}
