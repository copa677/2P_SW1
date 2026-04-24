package back_1erP.dto;

import back_1erP.model.Role;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserDTO {
    private String id;
    private String nombres;
    private String apellidos;
    private String correo;
    private Role rol;
}
