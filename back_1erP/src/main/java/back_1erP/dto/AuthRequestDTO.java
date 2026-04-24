package back_1erP.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record AuthRequestDTO(
    @NotBlank(message = "El correo es obligatorio")
    @Email(message = "Formato de correo inválido")
    String correo,

    @NotBlank(message = "La contraseña es obligatoria")
    String password
) {}
