package back_1erP.controller;

import back_1erP.dto.AuthRequestDTO;
import back_1erP.dto.TokenResponseDTO;
import back_1erP.dto.UserRegisterDTO;
import back_1erP.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    public ResponseEntity<TokenResponseDTO> register(
            @Valid @RequestBody UserRegisterDTO request
    ) {
        return ResponseEntity.ok(authService.register(request));
    }

    @PostMapping("/login")
    public ResponseEntity<TokenResponseDTO> login(
            @Valid @RequestBody AuthRequestDTO request
    ) {
        return ResponseEntity.ok(authService.login(request));
    }
}
