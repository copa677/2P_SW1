package back_1erP.service;

import back_1erP.model.Project;
import back_1erP.repository.ProjectRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ProjectService {

    private final ProjectRepository projectRepository;

    public List<Project> getProjectsForUser(String userId) {
        // Buscamos proyectos donde sea dueño O colaborador O funcionario asignado
        return projectRepository.findByOwnerIdOrCollaboratorIdsContainingOrAssignedOfficialId(userId, userId, userId);
    }

    public List<Project> getAllProjects() {
        return projectRepository.findAll();
    }

    public Optional<Project> getProjectById(String id) {
        return projectRepository.findById(id);
    }

    public Project createProject(String name, String description, String ownerId) {
        Project project = Project.builder()
                .name(name)
                .description(description)
                .ownerId(ownerId)
                .collaboratorIds(new ArrayList<>())
                .elementCount(0)
                .build();
        return projectRepository.save(project);
    }

    public Project updateProject(String id, Project updatedData, String userId) {
        Project existingProject = projectRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Proyecto no encontrado"));

        // Verificación de seguridad: dueño o colaborador pueden editar
        boolean isOwner = existingProject.getOwnerId().equals(userId);
        boolean isCollaborator = existingProject.getCollaboratorIds() != null &&
                existingProject.getCollaboratorIds().contains(userId);

        if (!isOwner && !isCollaborator) {
            throw new RuntimeException("No tienes permisos para editar este proyecto");
        }

        existingProject.setName(updatedData.getName());
        existingProject.setDescription(updatedData.getDescription());
        existingProject.setData(updatedData.getData());
        existingProject.setElementCount(updatedData.getElementCount());

        return projectRepository.save(existingProject);
    }

    public void deleteProject(String id, String ownerId) {
        Project existingProject = projectRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Proyecto no encontrado"));

        // Solo el dueño puede eliminar el proyecto
        if (!existingProject.getOwnerId().equals(ownerId)) {
            throw new RuntimeException("Solo el propietario puede eliminar este proyecto");
        }

        projectRepository.delete(existingProject);
    }

    public Project joinProject(String projectId, String userId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Proyecto no encontrado. Verifica el ID."));

        // Si ya es el dueño, no hace falta unirse
        if (project.getOwnerId().equals(userId)) {
            throw new RuntimeException("Ya eres el dueño de este proyecto");
        }

        // Si ya es colaborador, no hacer nada o avisar
        if (project.getCollaboratorIds() != null && project.getCollaboratorIds().contains(userId)) {
            throw new RuntimeException("Ya eres colaborador de este proyecto");
        }

        // Añadir a la lista
        if (project.getCollaboratorIds() == null) {
            project.setCollaboratorIds(new ArrayList<>());
        }
        project.getCollaboratorIds().add(userId);

        return projectRepository.save(project);
    }

    public Project assignToOfficial(String projectId, String userId, String username) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Proyecto no encontrado"));

        project.setAssignedOfficialId(userId);
        project.setAssignedOfficialName(username);

        return projectRepository.save(project);
    }
}
