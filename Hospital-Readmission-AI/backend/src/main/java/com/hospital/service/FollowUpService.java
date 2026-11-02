package com.hospital.service;

import com.hospital.dto.FollowUpDtos.CreateFollowUpRequest;
import com.hospital.dto.FollowUpDtos.FollowUpDto;
import com.hospital.exception.ApiException;
import com.hospital.repository.FollowUpRepository;
import com.hospital.repository.FollowUpRepository.Group;
import com.hospital.repository.PatientRepository;
import com.hospital.repository.PredictionRepository;
import com.hospital.repository.UserRepository;
import com.hospital.security.AuthenticatedUser;
import com.hospital.security.Role;
import com.hospital.util.SqlText;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Locale;

@Service
public class FollowUpService {

    private final FollowUpRepository followUps;
    private final PatientRepository patients;
    private final PredictionRepository predictions;
    private final UserRepository users;
    private final NotificationService notifications;

    public FollowUpService(FollowUpRepository followUps, PatientRepository patients, PredictionRepository predictions,
                           UserRepository users, NotificationService notifications) {
        this.followUps = followUps;
        this.patients = patients;
        this.predictions = predictions;
        this.users = users;
        this.notifications = notifications;
    }

    /** status: All | Pending | Overdue | Done. priority: All | Urgent | High | Medium | Low | Routine. */
    public List<FollowUpDto> list(String status, String priority) {
        Group group = null;
        String s = SqlText.blankToNull(status);
        if (s != null && !"All".equalsIgnoreCase(s)) {
            try {
                group = Group.valueOf(s.toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException ex) {
                throw ApiException.badRequest("status must be All, Pending, Overdue or Done.");
            }
        }
        String p = SqlText.blankToNull(priority);
        if (p != null && "All".equalsIgnoreCase(p)) p = null;
        if (p != null && !p.matches("Urgent|High|Medium|Low|Routine")) {
            throw ApiException.badRequest("priority must be Urgent, High, Medium, Low or Routine.");
        }
        return followUps.find(group, p, LocalDate.now());
    }

    @Transactional
    public FollowUpDto create(CreateFollowUpRequest req, AuthenticatedUser caller) {
        long patientId = Long.parseLong(req.patientId());
        if (!patients.exists(patientId)) throw ApiException.notFound("Patient " + patientId);
        if (req.dueDate().isBefore(LocalDate.now())) throw ApiException.badRequest("Due date cannot be in the past.");
        if (req.predictionId() != null) {
            Long owner = predictions.findPatientId(req.predictionId())
                    .orElseThrow(() -> ApiException.notFound("Prediction " + req.predictionId()));
            if (owner != patientId) throw ApiException.badRequest("The prediction belongs to a different patient.");
        }
        int assignee = req.assignedToUserId() != null ? req.assignedToUserId() : caller.id();
        var assigneeUser = users.findById(assignee).filter(u -> u.active())
                .orElseThrow(() -> ApiException.badRequest("The assigned clinician does not exist or is inactive."));
        if (assigneeUser.role() == Role.ANALYST) {
            throw ApiException.badRequest("Follow-ups can only be assigned to Admin, Doctor or Nurse accounts.");
        }
        String notes = SqlText.blankToNull(req.notes());
        long id = followUps.insert(patientId, req.predictionId(), assignee, req.channel().trim(), req.dueDate(),
                req.priority(), notes);
        FollowUpDto created = followUps.findById(id).orElseThrow();
        if (assignee != caller.id()) {
            notifications.notifyUser(assignee, patientId, NotificationService.FOLLOWUP_ASSIGNED,
                    "Follow-up #" + id + " for " + created.patientName() + " (" + created.channel() + ", "
                            + created.priority() + ") is due " + created.dueDate() + ".");
        }
        return created;
    }

    /** Done/Completed -> COMPLETED, Scheduled -> SCHEDULED, Missed -> MISSED, Cancelled -> CANCELLED. */
    @Transactional
    public FollowUpDto updateStatus(long id, String status) {
        String db = switch (status) {
            case "Done", "Completed" -> "COMPLETED";
            case "Scheduled" -> "SCHEDULED";
            case "Missed" -> "MISSED";
            case "Cancelled" -> "CANCELLED";
            default -> throw ApiException.badRequest("Unknown status " + status + ".");
        };
        if (followUps.updateStatus(id, db) == 0) throw ApiException.notFound("Follow-up " + id);
        return followUps.findById(id).orElseThrow();
    }
}
