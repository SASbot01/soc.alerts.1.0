package com.blackwolf.backend.model;

import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "permissions")
public class Permission {
    @Id
    private String id;

    private String resource;
    private String action;
    private String description;
}
