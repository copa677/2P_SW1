package back_1erP.dto;

import back_1erP.model.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UserRegisterDTO(
    @NotBlank(message = "Los nombres son obligatorios")
    String nombres,

    @NotBlank(message = "Los apellidos son obligatorios")
    String apellidos,

    @NotBlank(message = "El correo es obligatorio")
    @Email(message = "Formato de correo inválido")
    String correo,

    @NotBlank(message = "La contraseña es obligatoria")
    @Size(min = 6, message = "La contraseña debe tener al menos 6 caracteres")
    String password,

    @NotNull(message = "El rol es obligatorio")
    Role rol
) {}
