package com.hospital.security;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hospital.config.AppProperties;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Minimal, standards-compliant JWT (RFC 7519) with HS256 signatures, implemented
 * with the JDK's javax.crypto so no extra dependency is needed.
 * Claims: sub (user id), email, role, iat, exp.
 */
@Service
public class JwtService {

    public static final int MIN_SECRET_LENGTH = 32;
    private static final Base64.Encoder B64 = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder B64D = Base64.getUrlDecoder();
    private static final String HEADER_JSON = "{\"alg\":\"HS256\",\"typ\":\"JWT\"}";

    private final byte[] secret;
    private final long expirationSeconds;
    private final ObjectMapper mapper;

    public JwtService(AppProperties props, ObjectMapper mapper) {
        String configured = props.jwt().secret();
        if (configured == null || configured.length() < MIN_SECRET_LENGTH) {
            throw new IllegalStateException(
                    "JWT_SECRET is missing or shorter than " + MIN_SECRET_LENGTH
                            + " characters. Set it in the environment or backend/.env (see .env.example).");
        }
        this.secret = configured.getBytes(StandardCharsets.UTF_8);
        this.expirationSeconds = props.jwt().expirationMinutes() * 60L;
        this.mapper = mapper;
    }

    public record IssuedToken(String token, Instant expiresAt) {
    }

    public IssuedToken issue(AuthenticatedUser user) {
        Instant now = Instant.now();
        Instant exp = now.plusSeconds(expirationSeconds);
        Map<String, Object> claims = new LinkedHashMap<>();
        claims.put("sub", String.valueOf(user.id()));
        claims.put("email", user.email());
        claims.put("role", user.role().name());
        claims.put("iat", now.getEpochSecond());
        claims.put("exp", exp.getEpochSecond());
        try {
            String header = B64.encodeToString(HEADER_JSON.getBytes(StandardCharsets.UTF_8));
            String payload = B64.encodeToString(mapper.writeValueAsBytes(claims));
            String signingInput = header + "." + payload;
            return new IssuedToken(signingInput + "." + B64.encodeToString(sign(signingInput)), exp);
        } catch (Exception ex) {
            throw new IllegalStateException("Could not create JWT", ex);
        }
    }

    /** Returns the user encoded in a valid, unexpired token, or null when the token is invalid. */
    public AuthenticatedUser verify(String token) {
        if (token == null) return null;
        String[] parts = token.split("\\.");
        if (parts.length != 3) return null;
        try {
            Map<String, Object> header = mapper.readValue(B64D.decode(parts[0]), new TypeReference<>() {});
            if (!"HS256".equals(header.get("alg"))) return null;
            byte[] expected = sign(parts[0] + "." + parts[1]);
            if (!MessageDigest.isEqual(expected, B64D.decode(parts[2]))) return null;
            Map<String, Object> claims = mapper.readValue(B64D.decode(parts[1]), new TypeReference<>() {});
            Object exp = claims.get("exp");
            if (!(exp instanceof Number n) || Instant.now().getEpochSecond() >= n.longValue()) return null;
            Role role = Role.parse(String.valueOf(claims.get("role")));
            if (role == null) return null;
            int userId = Integer.parseInt(String.valueOf(claims.get("sub")));
            return new AuthenticatedUser(userId, String.valueOf(claims.get("email")), role);
        } catch (Exception ex) {
            return null;
        }
    }

    private byte[] sign(String input) throws GeneralSecurityException {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret, "HmacSHA256"));
        return mac.doFinal(input.getBytes(StandardCharsets.UTF_8));
    }
}
