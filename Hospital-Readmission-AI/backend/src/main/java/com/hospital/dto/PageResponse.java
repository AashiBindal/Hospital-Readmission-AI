package com.hospital.dto;

import java.util.List;

/** Spring-style page envelope expected by the frontend: { content, totalElements, totalPages, page, size }. */
public record PageResponse<T>(List<T> content, long totalElements, int totalPages, int page, int size) {

    public static <T> PageResponse<T> of(List<T> content, long total, int page, int size) {
        int pages = size <= 0 ? 0 : (int) Math.ceil((double) total / size);
        return new PageResponse<>(content, total, pages, page, size);
    }
}
