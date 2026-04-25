package back_1erP.controller;

import back_1erP.model.Project;
import back_1erP.model.User;
import back_1erP.service.ProjectService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/api/projects")
@RequiredArgsConstructor
public class ProjectController {

    private final ProjectService projectService;

    // Obtener todos los proyectos del sistema (Solo Admin)
    @GetMapping("/all")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<Project>> listAllProjects() {
        return ResponseEntity.ok(projectService.getAllProjects());
    }

    // Asignar un proyecto a un funcionario (Solo Admin)
    @PatchMapping("/{id}/assign")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Project> assignProject(
            @PathVariable String id,
            @RequestParam String userId,
            @RequestParam String username) {
        return ResponseEntity.ok(projectService.assignToOfficial(id, userId, username));
    }

    // Obtener todos los proyectos del usuario (dueño o colaborador)
    @GetMapping
    public ResponseEntity<List<Project>> listProjects(@AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(projectService.getProjectsForUser(currentUser.getId()));
    }

    // Crear un nuevo proyecto
    @PostMapping
    public ResponseEntity<Project> createProject(@RequestBody Project request,
            @AuthenticationPrincipal User currentUser) {
        return ResponseEntity
                .ok(projectService.createProject(request.getName(), request.getDescription(), currentUser.getId()));
    }

    // Unirse a un proyecto existente mediante su ID
    @PostMapping("/{id}/join")
    public ResponseEntity<Project> joinProject(@PathVariable String id, @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(projectService.joinProject(id, currentUser.getId()));
    }

    // Obtener un proyecto específico (debe ser dueño o colaborador)
    @GetMapping("/{id}")
    public ResponseEntity<Project> getProjectById(
            @PathVariable String id,
            @AuthenticationPrincipal User currentUser) {
        return projectService.getProjectById(id)
                .filter(p -> p.getOwnerId().equals(currentUser.getId()) ||
                        (p.getCollaboratorIds() != null && p.getCollaboratorIds().contains(currentUser.getId())) ||
                        (p.getAssignedOfficialId() != null && p.getAssignedOfficialId().equals(currentUser.getId())))
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.status(403).build());
    }

    // Actualizar un proyecto
    @PutMapping("/{id}")
    public ResponseEntity<Project> updateProject(
            @PathVariable String id,
            @RequestBody Project updatedData,
            @AuthenticationPrincipal User currentUser) {
        try {
            Project project = projectService.updateProject(id, updatedData, currentUser.getId());
            return ResponseEntity.ok(project);
        } catch (RuntimeException e) {
            return ResponseEntity.status(403).build();
        }
    }

    // Eliminar un proyecto (solo permitido para el dueño)
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteProject(
            @PathVariable String id,
            @AuthenticationPrincipal User currentUser) {
        try {
            projectService.deleteProject(id, currentUser.getId());
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.status(403).build();
        }
    }
}
