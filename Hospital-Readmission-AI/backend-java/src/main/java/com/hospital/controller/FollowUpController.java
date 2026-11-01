package com.hospital.controller;

import com.hospital.dto.Request.FollowUpRequestDto;
import com.hospital.dto.Response.FollowUpResponseDto;
import com.hospital.entity.FollowUp;
import com.hospital.service.FollowUpService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/follow-ups")
@RequiredArgsConstructor
public class FollowUpController {

    private final FollowUpService followUpService;

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'DOCTOR', 'NURSE')")
    public ResponseEntity<FollowUpResponseDto> createFollowUp(@Valid @RequestBody FollowUpRequestDto requestDto) {
        return ResponseEntity.ok(followUpService.createFollowUp(requestDto));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'DOCTOR', 'NURSE')")
    public ResponseEntity<Page<FollowUpResponseDto>> getFollowUps(
            @RequestParam(required = false) FollowUp.Status status,
            @RequestParam(required = false) FollowUp.Priority priority,
            @RequestParam(required = false) UUID assignedToId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "dueDate") String sortBy,
            @RequestParam(defaultValue = "ASC") String direction) {

        Sort sort = Sort.by(Sort.Direction.fromString(direction), sortBy);
        Pageable pageable = PageRequest.of(page, size, sort);
        Page<FollowUpResponseDto> result = followUpService.getFollowUps(status, priority, assignedToId, pageable);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'DOCTOR', 'NURSE')")
    public ResponseEntity<FollowUpResponseDto> getFollowUpById(@PathVariable UUID id) {
        return ResponseEntity.ok(followUpService.getFollowUpById(id));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'DOCTOR', 'NURSE')")
    public ResponseEntity<FollowUpResponseDto> updateFollowUp(
            @PathVariable UUID id,
            @Valid @RequestBody FollowUpRequestDto requestDto) {
        return ResponseEntity.ok(followUpService.updateFollowUp(id, requestDto));
    }

    @PutMapping("/{id}/complete")
    @PreAuthorize("hasAnyRole('ADMIN', 'DOCTOR', 'NURSE')")
    public ResponseEntity<FollowUpResponseDto> markCompleted(@PathVariable UUID id) {
        return ResponseEntity.ok(followUpService.markCompleted(id));
    }
}