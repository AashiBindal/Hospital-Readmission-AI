//package com.hospital.controller;
//
//import com.hospital.dto.Request.UserRegistrationDto;
//import com.hospital.service.RegistrationService;
//import jakarta.validation.Valid;
//import lombok.RequiredArgsConstructor;
//import org.springframework.http.HttpStatus;
//import org.springframework.http.ResponseEntity;
//import org.springframework.web.bind.annotation.*;
//
//@RestController
//@RequestMapping("/api/auth")
//@RequiredArgsConstructor
//public class RegistrationController {
//
//    private final RegistrationService registrationService;
//
//    @PostMapping("/register")
//    public ResponseEntity<String> registerUser(@Valid @RequestBody UserRegistrationDto registrationDto) {
//        try {
//            String responseMessage = registrationService.registerUser(registrationDto);
//            return ResponseEntity.status(HttpStatus.CREATED).body(responseMessage);
//        } catch (IllegalArgumentException e) {
//            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
//        } catch (Exception e) {
//            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("An error occurred during registration.");
//        }
//    }
//}