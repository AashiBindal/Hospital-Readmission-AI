package com.hospital.security;

/** Principal placed in the SecurityContext by {@link JwtAuthenticationFilter}. */
public record AuthenticatedUser(int id, String email, Role role) {
}
