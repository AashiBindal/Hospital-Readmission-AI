package com.hospital.util;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class RiskLevelsTest {

    @Test
    void convertsDatabaseValuesToApiValues() {
        assertEquals("High", RiskLevels.label("HIGH"));
        assertEquals("Medium", RiskLevels.label("medium"));
        assertEquals("Low", RiskLevels.label("LOW"));
        assertNull(RiskLevels.label("SEVERE"));
        assertNull(RiskLevels.label(null));
        assertEquals("HIGH", RiskLevels.dbValue("High"));
        assertNull(RiskLevels.dbValue("Unscored"));
    }

    @Test
    void scoresAreShownAsWholePercent() {
        assertEquals(76, RiskLevels.percent(new BigDecimal("0.7634")));
        assertEquals(0, RiskLevels.percent(new BigDecimal("0.0000")));
        assertEquals(100, RiskLevels.percent(new BigDecimal("1.0000")));
        assertEquals(12, RiskLevels.percent(new BigDecimal("0.1150")));
        assertNull(RiskLevels.percent(null));
    }

    @Test
    void ratesAndLikeEscaping() {
        assertEquals(11.2, SqlText.rate(1116, 10000));
        assertNull(SqlText.rate(5, 0));
        assertEquals("50\\%\\_\\[x", SqlText.likeEscape("50%_[x"));
        assertNull(SqlText.blankToNull("   "));
    }
}
