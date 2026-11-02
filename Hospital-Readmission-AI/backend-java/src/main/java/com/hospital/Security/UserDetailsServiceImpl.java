package com.hospital.Security;

import com.hospital.entity.User;
import com.hospital.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class UserDetailsServiceImpl implements UserDetailsService {

    private final UserRepository userRepository;

    // No @Transactional needed: role is a plain enum column and department is EAGER.
    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        if (email == null || email.isBlank()) {
            throw new UsernameNotFoundException("Email must not be empty");
        }

        String normalized = email.trim();

        User user = userRepository.findByEmailIgnoreCase(normalized)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + normalized));

        if (user.getPassword() == null || user.getPassword().isBlank()) {
            throw new UsernameNotFoundException("User has no credentials configured: " + normalized);
        }

        return new CustomUserDetails(user);
    }
}