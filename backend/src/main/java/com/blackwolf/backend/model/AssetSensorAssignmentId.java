package com.blackwolf.backend.model;

import lombok.Data;
import java.io.Serializable;

@Data
public class AssetSensorAssignmentId implements Serializable {
    private String assetId;
    private String sensorId;
}
