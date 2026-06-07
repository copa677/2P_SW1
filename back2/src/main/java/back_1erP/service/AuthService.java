package back_1erP.service;

import back_1erP.dto.AuthRequestDTO;
import back_1erP.dto.TokenResponseDTO;
import back_1erP.dto.UserDTO;
import back_1erP.dto.UserRegisterDTO;
import back_1erP.model.User;
import back_1erP.model.Role;
import back_1erP.repository.UserRepository;
import back_1erP.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final UserDetailsService userDetailsService;

    public static List<String> getDefaultPermissionsForRole(Role role) {
        if (role == null) return List.of();
        switch (role) {
            case ADMIN:
                return List.of("usuarios:*", "roles:*", "diagramas:*", "procesos:*");
            case DIAGRAMADOR:
                return List.of("diagramas:leer", "diagramas:crear", "diagramas:editar", "diagramas:eliminar", "procesos:leer");
            case FUNCIONARIO:
                return List.of("diagramas:leer", "procesos:leer", "procesos:ejecutar", "procesos:avanzar");
            case CLIENTE:
                return List.of("procesos:leer", "procesos:iniciar");
            default:
                return List.of();
        }
    }

    public TokenResponseDTO register(UserRegisterDTO request) {
        List<String> initialPermissions = request.permisos();
        if (initialPermissions == null || initialPermissions.isEmpty()) {
            initialPermissions = getDefaultPermissionsForRole(request.rol());
        }

        var user = User.builder()
                .nombres(request.nombres())
                .apellidos(request.apellidos())
                .correo(request.correo())
                .password(passwordEncoder.encode(request.password()))
                .rol(request.rol())
                .permisos(initialPermissions)
                .createdAt(ZonedDateTime.now(ZoneId.of("America/La_Paz")).toLocalDateTime())
                .activo(true)
                .build();
        
        User savedUser = userRepository.save(user);
        
        var userDetails = userDetailsService.loadUserByUsername(savedUser.getCorreo());
        var jwtToken = jwtService.generateToken(userDetails);
        
        UserDTO userDTO = mapToUserDTO(savedUser);
        return new TokenResponseDTO(jwtToken, userDTO);
    }

    public TokenResponseDTO login(AuthRequestDTO request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        request.correo(),
                        request.password()
                )
        );
        
        var user = userRepository.findByCorreo(request.correo())
                .orElseThrow(() -> new RuntimeException("Usuario no encontrado"));
        
        var userDetails = userDetailsService.loadUserByUsername(request.correo());
        var jwtToken = jwtService.generateToken(userDetails);
        
        UserDTO userDTO = mapToUserDTO(user);
        return new TokenResponseDTO(jwtToken, userDTO);
    }

    private UserDTO mapToUserDTO(User user) {
        return UserDTO.builder()
                .id(user.getId())
                .nombres(user.getNombres())
                .apellidos(user.getApellidos())
                .correo(user.getCorreo())
                .rol(user.getRol())
                .permisos(user.getPermisos())
                .build();
    }
}
