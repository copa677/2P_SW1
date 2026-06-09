package back_1erP.service;

import back_1erP.model.ProcessInstance;
import back_1erP.model.Project;
import back_1erP.model.User;
import back_1erP.repository.ProcessRepository;
import back_1erP.repository.ProjectRepository;
import back_1erP.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Response;
import software.amazon.awssdk.services.s3.model.S3Object;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest;

import java.io.IOException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DocumentStorageService {

    private final S3Client s3Client;
    private final S3Presigner s3Presigner;

    private final UserRepository userRepository;
    private final ProjectRepository projectRepository;
    private final ProcessRepository processRepository;

    @Value("${aws.s3.bucket-name}")
    private String bucketName;

    public static class TreeNode {
        public String id;
        public String name;
        public String type; // "folder" or "file"
        public String s3Key; // only for file
        public Long size; // only for file
        public String lastModified; // only for file
        public List<TreeNode> children = new ArrayList<>();

        public TreeNode(String id, String name, String type) {
            this.id = id;
            this.name = name;
            this.type = type;
        }
    }

    /**
     * Uploads a file to AWS S3 using Option B folder structure:
     * id_user / id_project / id_process_instance / filename
     */
    public Map<String, Object> uploadDocument(MultipartFile file, String userId, String projectId, String instanceId) throws IOException {
        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null) {
            originalFilename = "archivo_" + System.currentTimeMillis();
        }

        // Option B path formatting: userId/projectId/instanceId/filename
        String s3Key = String.format("%s/%s/%s/%s", userId, projectId, instanceId, originalFilename);

        PutObjectRequest putOb = PutObjectRequest.builder()
                .bucket(bucketName)
                .key(s3Key)
                .contentType(file.getContentType())
                .build();

        s3Client.putObject(putOb, RequestBody.fromInputStream(file.getInputStream(), file.getSize()));

        Map<String, Object> result = new HashMap<>();
        result.put("name", originalFilename);
        result.put("type", file.getContentType());
        result.put("size", file.getSize());
        result.put("s3Key", s3Key);
        return result;
    }

    /**
     * Generates a pre-signed URL for temporary secure download access.
     */
    public String generatePreSignedUrl(String s3Key) {
        GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                .bucket(bucketName)
                .key(s3Key)
                .build();

        GetObjectPresignRequest getObjectPresignRequest = GetObjectPresignRequest.builder()
                .signatureDuration(Duration.ofMinutes(10))
                .getObjectRequest(getObjectRequest)
                .build();

        PresignedGetObjectRequest presignedRequest = s3Presigner.presignGetObject(getObjectPresignRequest);
        return presignedRequest.url().toString();
    }

    /**
     * Deletes a document from AWS S3.
     */
    public void deleteDocument(String s3Key) {
        DeleteObjectRequest deleteRequest = DeleteObjectRequest.builder()
                .bucket(bucketName)
                .key(s3Key)
                .build();
        s3Client.deleteObject(deleteRequest);
    }

    /**
     * Lists S3 objects and resolves keys into a user-friendly nested folder structure:
     * User Nombres -> Project Name -> Process Instance Tracking Code -> Files
     */
    public List<TreeNode> listDocuments() {
        // 1. Obtener listado de objetos S3
        ListObjectsV2Request listReq = ListObjectsV2Request.builder()
                .bucket(bucketName)
                .build();
        ListObjectsV2Response listRes = s3Client.listObjectsV2(listReq);

        // 2. Pre-cargar mapeos de nombres para optimizar consultas en BD
        Map<String, String> userNames = userRepository.findAll().stream()
                .collect(Collectors.toMap(User::getId, u -> u.getNombres() + " " + u.getApellidos(), (a, b) -> a));
        Map<String, String> projectNames = projectRepository.findAll().stream()
                .collect(Collectors.toMap(Project::getId, Project::getName, (a, b) -> a));
        Map<String, String> instanceCodes = processRepository.findAll().stream()
                .collect(Collectors.toMap(ProcessInstance::getId, 
                        p -> String.format("Trámite: %s (%s)", p.getTrackingCode(), p.getStatus()), (a, b) -> a));

        TreeNode root = new TreeNode("root", "Root", "folder");

        // 3. Agrupar en árbol jerárquico
        for (S3Object obj : listRes.contents()) {
            String key = obj.key();
            String[] parts = key.split("/");

            if (parts.length == 4) {
                String userId = parts[0];
                String projectId = parts[1];
                String instanceId = parts[2];
                String filename = parts[3];

                // Resolver carpetas jerárquicas
                String userName = userNames.getOrDefault(userId, "Usuario: " + userId);
                TreeNode userNode = findOrCreateChild(root, userId, userName);

                String projectName = projectNames.getOrDefault(projectId, "Proyecto: " + projectId);
                TreeNode projectNode = findOrCreateChild(userNode, projectId, projectName);

                String instanceName = instanceCodes.getOrDefault(instanceId, "Trámite: " + instanceId);
                TreeNode instanceNode = findOrCreateChild(projectNode, instanceId, instanceName);

                // Agregar archivo
                TreeNode fileNode = new TreeNode(key, filename, "file");
                fileNode.s3Key = key;
                fileNode.size = obj.size();
                fileNode.lastModified = obj.lastModified().toString();
                instanceNode.children.add(fileNode);
            } else {
                // Caso fallback: si no cumple el formato Nivel 4, se anida según los niveles que tenga
                TreeNode current = root;
                for (int i = 0; i < parts.length; i++) {
                    String part = parts[i];
                    if (i == parts.length - 1) {
                        TreeNode fileNode = new TreeNode(key, part, "file");
                        fileNode.s3Key = key;
                        fileNode.size = obj.size();
                        fileNode.lastModified = obj.lastModified().toString();
                        current.children.add(fileNode);
                    } else {
                        String name = part;
                        if (i == 0) name = userNames.getOrDefault(part, "Usuario: " + part);
                        else if (i == 1) name = projectNames.getOrDefault(part, "Proyecto: " + part);
                        else if (i == 2) name = instanceCodes.getOrDefault(part, "Trámite: " + part);
                        current = findOrCreateChild(current, part, name);
                    }
                }
            }
        }

        return root.children;
    }

    private TreeNode findOrCreateChild(TreeNode parent, String id, String name) {
        for (TreeNode child : parent.children) {
            if (child.id.equals(id) && "folder".equals(child.type)) {
                return child;
            }
        }
        TreeNode newFolder = new TreeNode(id, name, "folder");
        parent.children.add(newFolder);
        return newFolder;
    }
}
