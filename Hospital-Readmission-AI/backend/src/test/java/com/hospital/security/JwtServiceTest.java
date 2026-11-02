package com.hospital.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hospital.config.AppProperties;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

class JwtServiceTest {

    private static AppProperties props(String secret, int minutes) {
        return new AppProperties(new AppProperties.Jwt(secret, minutes), null, null, null, null, null);
    }

    @Test
    void issuesAndVerifiesTokens() {
        JwtService jwt = new JwtService(props("0123456789abcdef0123456789abcdef", 60), new ObjectMapper());
        String token = jwt.issue(new AuthenticatedUser(42, "a@b.org", Role.NURSE)).token();
        AuthenticatedUser user = jwt.verify(token);
        assertNotNull(user);
        assertEquals(42, user.id());
        assertEquals(Role.NURSE, user.role());
    }

    @Test
    void rejectsTamperedTokensAndOtherSecrets() {
        JwtService jwt = new JwtService(props("0123456789abcdef0123456789abcdef", 60), new ObjectMapper());
        JwtService other = new JwtService(props("ffffffffffffffffffffffffffffffff", 60), new ObjectMapper());
        String token = jwt.issue(new AuthenticatedUser(1, "a@b.org", Role.DOCTOR)).token();
        String[] p = token.split("\\.");
        assertNull(jwt.verify(p[0] + "." + p[1] + "x." + p[2]));
        assertNull(other.verify(token));
        assertNull(jwt.verify("not-a-token"));
    }

    @Test
    void refusesShortSecrets() {
        assertThrows(IllegalStateException.class, () -> new JwtService(props("short", 60), new ObjectMapper()));
        assertThrows(IllegalStateException.class, () -> new JwtService(props(null, 60), new ObjectMapper()));
    }
}
