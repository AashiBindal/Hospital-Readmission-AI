package com.hospital.service;

import com.hospital.dto.UserDto;
import com.hospital.repository.UserRepository;
import com.hospital.repository.UserRepository.UserRecord;
import com.hospital.security.AuthenticatedUser;
import com.hospital.security.Role;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class UserService {

    private final UserRepository users;

    public UserService(UserRepository users) {
        this.users = users;
    }

    /**
     * Admins see every account with contact details. Other roles get the active staff list
     * (name, role, department) needed to assign follow-ups - without e-mail, phone or licence.
     */
    public List<UserDto> list(AuthenticatedUser caller) {
        boolean admin = caller.role() == Role.ADMIN;
        return users.findAll(!admin).stream()
                .filter(u -> u.role() != null)
                .map(UserRecord::toDto)
                .map(u -> admin ? u : new UserDto(u.id(), u.name(), null, u.role(), u.department(), null, null,
                        u.active(), u.avatarInitials(), null, null))
                .toList();
    }
}
