package com.hospital.controller;

import com.hospital.dto.UserDto;
import com.hospital.security.CurrentUser;
import com.hospital.service.UserService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/users")
public class UserController {

    private final UserService users;

    public UserController(UserService users) {
        this.users = users;
    }

    /** Admin: all accounts with contact details. Doctor/Nurse: active staff list for assigning follow-ups. */
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','DOCTOR','NURSE')")
    public List<UserDto> list() {
        return users.list(CurrentUser.get());
    }
}
