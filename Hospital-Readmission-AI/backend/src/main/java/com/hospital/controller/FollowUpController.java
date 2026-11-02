package com.hospital.controller;

import com.hospital.dto.FollowUpDtos.CreateFollowUpRequest;
import com.hospital.dto.FollowUpDtos.FollowUpDto;
import com.hospital.dto.FollowUpDtos.UpdateStatusRequest;
import com.hospital.security.CurrentUser;
import com.hospital.service.FollowUpService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/follow-ups")
@PreAuthorize("hasAnyRole('ADMIN','DOCTOR','NURSE')")
public class FollowUpController {

    private final FollowUpService followUps;

    public FollowUpController(FollowUpService followUps) {
        this.followUps = followUps;
    }

    @GetMapping
    public List<FollowUpDto> list(@RequestParam(required = false) String status,
                                  @RequestParam(required = false) String priority) {
        return followUps.list(status, priority);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public FollowUpDto create(@Valid @RequestBody CreateFollowUpRequest request) {
        return followUps.create(request, CurrentUser.get());
    }

    @PatchMapping("/{id}/status")
    public FollowUpDto updateStatus(@PathVariable long id, @Valid @RequestBody UpdateStatusRequest request) {
        return followUps.updateStatus(id, request.status());
    }
}
