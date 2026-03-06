package com.blackwolf.backend.model;

import lombok.Data;
import java.io.Serializable;

@Data
public class BlockedSubnetId implements Serializable {
    private String cidr;
    private String companyId;
}
