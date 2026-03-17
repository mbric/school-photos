# School Photo Management System — Requirements & User Stories

## Overview

A web-based tool to manage the end-to-end process of school photography: from importing student rosters and running an efficient photo shoot, to organizing photos, sharing proofs with parents, and tracking orders.

---

## Roles

| Role | Description |
|------|-------------|
| **Photographer** | Primary user. Manages schools, runs shoots, uploads photos, fulfills orders. |
| **Helper** | On-site assistant during a shoot. Can check in students and mark attendance. |
| **Parent** | Views their child's proofs and places orders via a private link. |
| **Admin** | (Future) Studio owner or manager overseeing multiple photographers. |

---

## Epic 1: School & Roster Management

### User Stories

- As a **photographer**, I want to create a new school with basic info (name, address, contact person) so I can organize my work by school.
- As a **photographer**, I want to import a student roster from a CSV file so I don't have to enter students manually.
- As a **photographer**, I want the roster import to support columns for student name, grade, teacher/class, and student ID so each student is properly categorized.
- As a **photographer**, I want to view and edit the roster after import so I can fix errors or add missing students.
- As a **photographer**, I want to add individual students manually so I can handle late enrollments or walk-ups.
- As a **photographer**, I want to organize students by grade and class/teacher so I can plan the shoot order.

### Requirements

- Support CSV import with flexible column mapping
- Validate imported data and surface errors (missing names, duplicate IDs)
- Each student record: first name, last name, grade, teacher/class, student ID, parent email (optional)
- Students belong to a school and are grouped by grade/class
- Support sibling linking: students sharing a parent email or last name can be grouped into a family

---

## Epic 2: Picture Day Scheduling

### User Stories

- As a **photographer**, I want to schedule a picture day for a school with a date and time so everyone knows when to expect me.
- As a **photographer**, I want to set the class shooting order so I can coordinate with the school's schedule.
- As a **photographer**, I want to print or display a shot list for the day showing students in order so the shoot runs smoothly.
- As a **photographer**, I want to schedule a retake day so absent or flagged students get a second chance.

### Requirements

- Picture day linked to a school with date, start time, and notes
- Class/grade shooting order is configurable
- Shot list can be printed or viewed on a tablet
- Support for multiple picture day types: initial, retake

---

## Epic 3: Shoot Day Workflow

### User Stories

- As a **photographer**, I want to see a live checklist of students in the current class so I know who's been photographed and who's remaining.
- As a **photographer**, I want to scan a student's barcode or QR code to mark them as photographed so I can move quickly.
- As a **photographer**, I want to manually check off a student if scanning isn't working so the shoot isn't held up.
- As a **photographer**, I want to mark a student as absent so I know who needs a retake.
- As a **photographer**, I want to flag a student for retake (e.g., eyes closed, bad expression) so I can reshoot them later.
- As a **photographer**, I want to add a walk-up student on the spot so no one is missed.
- As a **photographer**, I want to see a real-time progress dashboard showing how many students are done vs. remaining across all classes so I can pace the day.
- As a **helper**, I want to check students in from my own device so I can assist the photographer without sharing one screen.

### Requirements

- Mobile-friendly shoot day interface
- Barcode/QR code scanning via device camera
- Student statuses: pending, photographed, absent, retake
- Real-time sync between photographer and helper devices
- Support adding unrostered students on the fly
- Progress view: per-class and whole-school completion

---

## Epic 4: Photo Organization & Matching

### User Stories

- As a **photographer**, I want to upload photos in bulk after the shoot so I can process them efficiently.
- As a **photographer**, I want photos to be automatically matched to students based on the shoot sequence so I don't have to tag each one manually.
- As a **photographer**, I want to manually match or reassign photos to students when automatic matching fails so every student has the right photo.
- As a **photographer**, I want to see a review screen showing each student alongside their matched photo so I can verify correctness.
- As a **photographer**, I want to flag unmatched or problematic photos for review so nothing slips through the cracks.

### Requirements

- Bulk photo upload (drag-and-drop or folder select)
- Matching by filename convention, sequence order, or manual assignment
- Review interface: student info alongside photo thumbnail
- Support multiple poses per student
- Unmatched photo queue for manual resolution

---

## Epic 5: Parent Proof Sharing

### User Stories

- As a **photographer**, I want to generate unique private proof links for each student/family so parents can view only their child's photos.
- As a **photographer**, I want to send proof links to parents via email so they can easily access their child's photos.
- As a **photographer**, I want proof links to be secured with an access code so only the intended family can view them.
- As a **parent**, I want to view my child's proofs without creating an account so the process is simple.
- As a **parent**, I want to see my child's photos in a clean gallery so I can decide what to order.
- As a **parent**, I want to select my favorite pose so the photographer knows my preference.
- As a **parent** with multiple children at the school, I want to see all my children's proofs in one place so I can review and order together.

### Requirements

- Unique, unguessable proof URLs per family (siblings grouped together)
- Optional access code for additional security
- No account creation required for parents
- Mobile-friendly proof gallery
- Parents can mark a preferred pose per child
- Proof links can be sent in bulk via email
- Links expire after a configurable period

---

## Epic 6: Order Management

### User Stories

- As a **photographer**, I want to define photo packages (e.g., "Basic: 1 8x10 + 2 5x7s") with prices so parents know what's available.
- As a **parent**, I want to select a package and place an order from the proof page so it's a seamless experience.
- As a **parent**, I want to pay online so I don't have to send cash or checks to school.
- As a **photographer**, I want to see all orders for a school in one place so I can prepare them for fulfillment.
- As a **photographer**, I want to export an order summary for my print lab so I can submit a batch print job.
- As a **photographer**, I want to track order status (ordered, printed, delivered) so I know what's been fulfilled.
- As a **parent**, I want to purchase digital downloads of my child's photos so I can print or share them myself.
- As a **photographer**, I want to support paper order forms for families who prefer not to order online so no one is left out.

### Requirements

- Configurable packages and pricing per school/event
- Packages can include prints, digital downloads, or both
- Digital download delivery via secure, time-limited download links
- Online payment integration (Stripe or Square; Venmo-compatible if possible)
- Order dashboard with filtering and search
- Export orders to CSV or print-lab-specific format
- Order statuses: pending, paid, sent to lab, printed, delivered
- Paper order form entry by photographer

---

## Epic 7: Reporting & Admin

### User Stories

- As a **photographer**, I want to see a dashboard of all my upcoming and past picture days so I can manage my schedule.
- As a **photographer**, I want to see a report of missing students (absent, no photo matched) so I can plan retakes.
- As a **photographer**, I want to see an order summary report with revenue totals so I can track my business.
- As a **photographer**, I want to export reports to CSV so I can use them in other tools.

### Requirements

- Home dashboard: upcoming events, recent activity, alerts
- Missing student report per school/event
- Order and revenue summary per school/event and overall
- CSV export for all reports

---

## Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| **Platform** | Web application, mobile-responsive |
| **Performance** | Shoot day interface must work reliably on mobile with intermittent connectivity |
| **Security** | Parent proof links must be private and unguessable; payment data handled by third-party processor (never stored) |
| **Data** | Student PII must be handled carefully; data retention policies needed |
| **Offline Support** | Shoot day check-in should work offline and sync when reconnected |
| **Scalability** | Support a solo photographer managing 10-20 schools per season |
| **Accessibility** | Parent-facing pages should meet basic accessibility standards |

---

## Decisions

- **Group/class photos**: Individual portraits only for now. Architecture should allow adding group photos later.
- **Sibling linking**: Yes — families with multiple students should receive one proof link with all their children's photos and be able to order together.
- **Print lab**: TBD — need to confirm which lab(s) and their format requirements.
- **Payment processor**: No strong preference. Stripe or Square are both options. She has Venmo — consider Venmo-compatible payment flow if possible.
- **Digital downloads**: Yes — parents should be able to purchase digital files in addition to (or instead of) prints.
- **Scope**: School portrait days only (no sports, events, or dance recitals).

## Open Questions

- [ ] Which print lab(s) does she use, and what are their file/order format requirements?
- [ ] What resolution and format should digital downloads be delivered in?
- [ ] Should sibling linking be automatic (by last name / parent email) or manual?
- [ ] Are there pricing differences between schools, or is pricing consistent across all events?
