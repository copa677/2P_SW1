package back_1erP.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record TokenResponseDTO(
    @JsonProperty("access_token")
    String accessToken,
    
    UserDTO user
) {}
