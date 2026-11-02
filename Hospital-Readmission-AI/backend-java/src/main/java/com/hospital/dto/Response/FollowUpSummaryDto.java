package com.hospital.dto.Response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class FollowUpSummaryDto {
    private long pendingCount;
    private long completedCount;
    private long overdueCount;
    private long highPriorityPendingCount;
}