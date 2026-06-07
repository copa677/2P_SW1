package back_1erP.config;

import back_1erP.model.User;
import back_1erP.model.Role;
import back_1erP.repository.UserRepository;
import back_1erP.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.ZoneId;
import java.time.ZonedDateTime;

@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) throws Exception {
        // Inicializar Admin
        initUser("admin@politicas.com", "admin", "admin", "Alejandro", "Valenzuela", Role.ADMIN);

        // Inicializar Diagramador
        initUser("beatriz.m@politicas.com", "diagramador", "diagramador", "Beatriz", "Mendoza", Role.DIAGRAMADOR);

        // Inicializar Funcionario
        initUser("carlos.f@politicas.com", "funcionario", "funcionario", "Carlos", "Flores", Role.FUNCIONARIO);

        // Inicializar Cliente (Solicitante)
        initUser("doris.g@gmail.com", "cliente", "cliente", "Doris", "Guevara", Role.CLIENTE);
    }

    private void initUser(String email, String username, String rawPassword, String nombres, String apellidos, Role role) {
        if (userRepository.findByCorreo(email).isEmpty()) {
            User user = User.builder()
                    .correo(email)
                    .password(passwordEncoder.encode(rawPassword))
                    .nombres(nombres)
                    .apellidos(apellidos)
                    .rol(role)
                    .permisos(AuthService.getDefaultPermissionsForRole(role))
                    .createdAt(ZonedDateTime.now(ZoneId.of("America/La_Paz")).toLocalDateTime())
                    .activo(true)
                    .build();
            userRepository.save(user);
            System.out.println("Usuario de prueba creado: " + email + " con rol " + role);
        }
    }
}
