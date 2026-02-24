package com.blackwolf.backend.elasticsearch;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.elasticsearch.annotations.*;

import java.time.LocalDateTime;

@Data
@Document(indexName = "threat-events")
@Setting(shards = 1, replicas = 0)
public class ThreatEventDocument {

    @Id
    private String id;

    @Field(type = FieldType.Keyword)
    private String companyId;

    @Field(type = FieldType.Keyword)
    private String sensorId;

    @Field(type = FieldType.Keyword)
    private String threatType;

    @Field(type = FieldType.Integer)
    private Integer severity;

    @Field(type = FieldType.Ip)
    private String srcIp;

    @Field(type = FieldType.Ip)
    private String dstIp;

    @Field(type = FieldType.Integer)
    private Integer dstPort;

    @Field(type = FieldType.Text, analyzer = "standard")
    private String description;

    @Field(type = FieldType.Keyword)
    private String status;

    @Field(type = FieldType.Date, format = DateFormat.date_hour_minute_second_millis)
    private LocalDateTime timestamp;

    @Field(type = FieldType.Keyword)
    private String mitreTactic;

    @Field(type = FieldType.Keyword)
    private String mitreTechnique;
}
