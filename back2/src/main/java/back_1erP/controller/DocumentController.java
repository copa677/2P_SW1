package back_1erP.controller;

import back_1erP.service.DocumentStorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.net.URI;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/documents")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class DocumentController {

    private final DocumentStorageService documentStorageService;

    @PostMapping("/upload")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> uploadFile(
            @RequestParam("file") MultipartFile file,
            @RequestParam("userId") String userId,
            @RequestParam("projectId") String projectId,
            @RequestParam("instanceId") String instanceId) {
        try {
            Map<String, Object> response = documentStorageService.uploadDocument(file, userId, projectId, instanceId);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/download")
    public ResponseEntity<Void> downloadFile(@RequestParam("key") String key) {
        try {
            String presignedUrl = documentStorageService.generatePreSignedUrl(key);
            HttpHeaders headers = new HttpHeaders();
            headers.setLocation(URI.create(presignedUrl));
            return new ResponseEntity<>(headers, HttpStatus.FOUND); // Redirección 302
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/list")
    @PreAuthorize("hasAuthority('documentos:leer') or hasRole('ADMIN')")
    public ResponseEntity<List<DocumentStorageService.TreeNode>> listFiles() {
        try {
            List<DocumentStorageService.TreeNode> tree = documentStorageService.listDocuments();
            return ResponseEntity.ok(tree);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PutMapping("/update")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> updateFile(
            @RequestParam("key") String key,
            @RequestParam("file") MultipartFile file) {
        try {
            Map<String, Object> response = documentStorageService.updateDocument(key, file);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/content")
    public ResponseEntity<byte[]> getFileContent(@RequestParam("key") String key) {
        try {
            byte[] content = documentStorageService.getDocumentContent(key);
            String contentType = "application/octet-stream";
            String lowerKey = key.toLowerCase();
            if (lowerKey.endsWith(".txt")) contentType = "text/plain";
            else if (lowerKey.endsWith(".html")) contentType = "text/html";
            else if (lowerKey.endsWith(".xlsx")) contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            else if (lowerKey.endsWith(".csv")) contentType = "text/csv";

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_TYPE, contentType)
                    .body(content);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @DeleteMapping
    @PreAuthorize("hasAuthority('documentos:eliminar') or hasRole('ADMIN')")
    public ResponseEntity<Void> deleteFile(@RequestParam("key") String key) {
        try {
            documentStorageService.deleteDocument(key);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}
