package com.hospital.service;

import com.hospital.dto.Request.FollowUpRequestDto;
import com.hospital.dto.Response.FollowUpResponseDto;
import com.hospital.entity.FollowUp;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.util.UUID;

public interface FollowUpService {
    FollowUpResponseDto createFollowUp(FollowUpRequestDto requestDto);
    Page<FollowUpResponseDto> getFollowUps(FollowUp.Status status, FollowUp.Priority priority, UUID assignedToId, Pageable pageable);
    FollowUpResponseDto getFollowUpById(UUID id);
    FollowUpResponseDto updateFollowUp(UUID id, FollowUpRequestDto requestDto);
    FollowUpResponseDto markCompleted(UUID id);
}