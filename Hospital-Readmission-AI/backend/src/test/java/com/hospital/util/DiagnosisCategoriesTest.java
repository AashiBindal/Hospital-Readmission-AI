package com.hospital.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class DiagnosisCategoriesTest {

    @Test
    void groupsIcd9CodesLikeStrackEtAl() {
        assertEquals("Circulatory", DiagnosisCategories.categorize("428"));
        assertEquals("Circulatory", DiagnosisCategories.categorize("785"));
        assertEquals("Respiratory", DiagnosisCategories.categorize("486"));
        assertEquals("Respiratory", DiagnosisCategories.categorize("786"));
        assertEquals("Digestive", DiagnosisCategories.categorize("578"));
        assertEquals("Diabetes", DiagnosisCategories.categorize("250.83"));
        assertEquals("Diabetes", DiagnosisCategories.categorize("250"));
        assertEquals("Injury", DiagnosisCategories.categorize("996"));
        assertEquals("Musculoskeletal", DiagnosisCategories.categorize("715"));
        assertEquals("Genitourinary", DiagnosisCategories.categorize("599"));
        assertEquals("Genitourinary", DiagnosisCategories.categorize("788"));
        assertEquals("Neoplasms", DiagnosisCategories.categorize("174"));
        assertEquals("Other", DiagnosisCategories.categorize("V57"));
        assertEquals("Other", DiagnosisCategories.categorize("E909"));
        assertEquals("Other", DiagnosisCategories.categorize("008"));
        assertEquals("Not recorded", DiagnosisCategories.categorize(null));
        assertEquals("Not recorded", DiagnosisCategories.categorize("  "));
    }

    @Test
    void describeKeepsTheCode() {
        assertEquals("428 · Circulatory", DiagnosisCategories.describe("428"));
        assertEquals("Not recorded", DiagnosisCategories.describe(null));
    }
}
