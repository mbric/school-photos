const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Password123", 12);
  const photographer = await prisma.user.upsert({
    where: { email: "megan@shutterday.com" },
    update: {},
    create: { email: "megan@shutterday.com", name: "Megan Brickner", passwordHash, role: "photographer" },
  });
  console.log("Created user:", photographer.email);

  const lincoln = await prisma.school.upsert({
    where: { id: "school-lincoln" },
    update: {},
    create: { id: "school-lincoln", name: "Lincoln Elementary", address: "123 Main St, Springfield, IL 62701", contactName: "Ms. Johnson", contactEmail: "johnson@lincoln.edu", contactPhone: "(555) 123-4567", paymentInstructions: "Venmo: @DemoPhotographer\nZelle: demo@schoolphotos.com\nPlease include student name in memo.", photographerId: photographer.id },
  });
  const washington = await prisma.school.upsert({
    where: { id: "school-washington" },
    update: {},
    create: { id: "school-washington", name: "Washington Middle School", address: "456 Oak Ave, Springfield, IL 62702", contactName: "Mr. Davis", contactEmail: "davis@washington.edu", contactPhone: "(555) 987-6543", photographerId: photographer.id },
  });
  console.log("Created schools");

  const lincolnStudents = [
    { firstName: "Emma", lastName: "Smith", grade: "K", teacher: "Mrs. Adams", studentId: "LS-001", parentEmail: "smith.family@email.com", familyId: "fam-smith" },
    { firstName: "Liam", lastName: "Smith", grade: "2", teacher: "Mr. Brown", studentId: "LS-002", parentEmail: "smith.family@email.com", familyId: "fam-smith" },
    { firstName: "Olivia", lastName: "Johnson", grade: "K", teacher: "Mrs. Adams", studentId: "LS-003", parentEmail: "olivia.parent@email.com" },
    { firstName: "Noah", lastName: "Williams", grade: "1", teacher: "Ms. Clark", studentId: "LS-004", parentEmail: "williams@email.com" },
    { firstName: "Ava", lastName: "Brown", grade: "1", teacher: "Ms. Clark", studentId: "LS-005", parentEmail: "brown.family@email.com" },
    { firstName: "Elijah", lastName: "Jones", grade: "2", teacher: "Mr. Brown", studentId: "LS-006", parentEmail: "jones@email.com" },
    { firstName: "Sophia", lastName: "Garcia", grade: "2", teacher: "Mr. Brown", studentId: "LS-007", parentEmail: "garcia@email.com" },
    { firstName: "James", lastName: "Miller", grade: "3", teacher: "Mrs. Davis", studentId: "LS-008", parentEmail: "miller@email.com" },
    { firstName: "Isabella", lastName: "Davis", grade: "3", teacher: "Mrs. Davis", studentId: "LS-009", parentEmail: "davis.family@email.com" },
    { firstName: "Lucas", lastName: "Martinez", grade: "3", teacher: "Mrs. Davis", studentId: "LS-010", parentEmail: "martinez@email.com" },
  ];
  for (const s of lincolnStudents) { await prisma.student.create({ data: { ...s, schoolId: lincoln.id } }); }
  console.log("Created 10 Lincoln students");

  const event = await prisma.event.create({ data: { type: "initial", date: new Date("2026-04-15"), startTime: "08:30", notes: "Spring picture day. Setup in the gym by 8:00 AM.", classOrder: JSON.stringify([{grade:"K",teacher:"Mrs. Adams"},{grade:"1",teacher:"Ms. Clark"},{grade:"2",teacher:"Mr. Brown"},{grade:"3",teacher:"Mrs. Davis"}]), status: "in_progress", schoolId: lincoln.id, photographerId: photographer.id } });
  console.log("Created event");

  const allStudents = await prisma.student.findMany({ where: { schoolId: lincoln.id }, orderBy: [{ grade: "asc" }, { lastName: "asc" }] });
  let seq = 1;
  for (const s of allStudents) { await prisma.checkIn.create({ data: { studentId: s.id, eventId: event.id, status: "photographed", sequence: seq++, checkedInAt: new Date() } }); }
  console.log("Created check-ins");

  let photoCount = 0;
  for (let i = 0; i < allStudents.length; i++) {
    const poses = i < 3 ? 3 : 2;
    for (let p = 1; p <= poses; p++) {
      const fn = lincolnStudents[i].studentId + "_pose" + p + ".bmp";
      await prisma.photo.create({ data: { filename: fn, storagePath: "seed-photos/" + fn, mimeType: "image/bmp", sequence: p, matched: true, eventId: event.id, studentId: allStudents[i].id } });
      photoCount++;
    }
  }
  console.log("Created " + photoCount + " photos");

  const families = new Map();
  const singles = [];
  for (const s of allStudents) { if (s.familyId) { if (!families.has(s.familyId)) families.set(s.familyId, []); families.get(s.familyId).push(s); } else singles.push(s); }
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  for (const [familyId, members] of families.entries()) { const token = crypto.randomBytes(16).toString("hex"); await prisma.proofLink.create({ data: { token, familyId, expiresAt, eventId: event.id, studentId: members[0].id } }); console.log("Family link: /proof/" + token); }
  for (const s of singles) { const token = crypto.randomBytes(16).toString("hex"); await prisma.proofLink.create({ data: { token, expiresAt, eventId: event.id, studentId: s.id } }); console.log("Link: /proof/" + token + " (" + s.firstName + " " + s.lastName + ")"); }

  const basicPkg = await prisma.package.create({ data: { name: "Basic Package", description: "1 8x10, 2 5x7, 8 wallets", price: 2500, contents: JSON.stringify([{type:"print",size:"8x10",qty:1},{type:"print",size:"5x7",qty:2},{type:"print",size:"wallet",qty:8}]), sortOrder: 1, schoolId: lincoln.id } });
  const premiumPkg = await prisma.package.create({ data: { name: "Premium Package", description: "2 8x10, 4 5x7, 16 wallets + digital", price: 4500, contents: JSON.stringify([{type:"print",size:"8x10",qty:2},{type:"print",size:"5x7",qty:4},{type:"print",size:"wallet",qty:16},{type:"digital",size:"full-res",qty:1}]), digital: true, sortOrder: 2, schoolId: lincoln.id } });
  const digitalPkg = await prisma.package.create({ data: { name: "Digital Only", description: "High-res digital download", price: 1500, contents: JSON.stringify([{type:"digital",size:"full-res",qty:1}]), digital: true, sortOrder: 3, schoolId: lincoln.id } });
  console.log("Created 3 packages");

  await prisma.order.create({ data: { orderNumber: "SP-2026-0001", status: "paid", source: "online", totalAmount: 4500, parentName: "Sarah Smith", parentEmail: "smith.family@email.com", stripePaymentId: "pi_demo_001", eventId: event.id, items: { create: [{ packageId: premiumPkg.id, studentId: allStudents[0].id, quantity: 1, unitPrice: 4500 }] } } });
  await prisma.order.create({ data: { orderNumber: "SP-2026-0002", status: "paid", source: "online", totalAmount: 2500, parentName: "Sarah Smith", parentEmail: "smith.family@email.com", stripePaymentId: "pi_demo_002", eventId: event.id, items: { create: [{ packageId: basicPkg.id, studentId: allStudents[1].id, quantity: 1, unitPrice: 2500 }] } } });
  await prisma.order.create({ data: { orderNumber: "SP-2026-0003", status: "awaiting_payment", source: "online", totalAmount: 2500, parentName: "Maria Garcia", parentEmail: "garcia@email.com", eventId: event.id, items: { create: [{ packageId: basicPkg.id, studentId: allStudents[6].id, quantity: 1, unitPrice: 2500 }] } } });
  await prisma.order.create({ data: { orderNumber: "SP-2026-0004", status: "paid", source: "paper", totalAmount: 4000, parentName: "Tom Williams", parentEmail: "williams@email.com", notes: "Paid by check #1234", eventId: event.id, items: { create: [{ packageId: basicPkg.id, studentId: allStudents[3].id, quantity: 1, unitPrice: 2500 }, { packageId: digitalPkg.id, studentId: allStudents[3].id, quantity: 1, unitPrice: 1500 }] } } });
  await prisma.order.create({ data: { orderNumber: "SP-2026-0005", status: "sent_to_lab", source: "online", totalAmount: 4500, parentName: "Jennifer Davis", parentEmail: "davis.family@email.com", stripePaymentId: "pi_demo_005", eventId: event.id, items: { create: [{ packageId: premiumPkg.id, studentId: allStudents[8].id, quantity: 1, unitPrice: 4500 }] } } });
  console.log("Created 5 orders");

  const washStudents = [
    { firstName: "Mason", lastName: "Anderson", grade: "6", teacher: "Mr. Harris", studentId: "WS-001", parentEmail: "anderson@email.com" },
    { firstName: "Charlotte", lastName: "Thomas", grade: "6", teacher: "Mr. Harris", studentId: "WS-002", parentEmail: "thomas@email.com" },
    { firstName: "Ethan", lastName: "Jackson", grade: "7", teacher: "Ms. White", studentId: "WS-003", parentEmail: "jackson@email.com" },
    { firstName: "Amelia", lastName: "White", grade: "7", teacher: "Ms. White", studentId: "WS-004", parentEmail: "white@email.com" },
    { firstName: "Alexander", lastName: "Harris", grade: "8", teacher: "Mr. Lee", studentId: "WS-005", parentEmail: "harris@email.com" },
  ];
  for (const s of washStudents) { await prisma.student.create({ data: { ...s, schoolId: washington.id } }); }
  await prisma.event.create({ data: { type: "initial", date: new Date("2026-05-01"), startTime: "09:00", notes: "Spring pictures in the cafeteria", status: "scheduled", schoolId: washington.id, photographerId: photographer.id } });
  console.log("Created Washington data");

  console.log("\n--- Seed complete ---");
  console.log("Login: demo@schoolphotos.com / password123");
}
main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
