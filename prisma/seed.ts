import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const prisma = new PrismaClient();

async function main() {
  // Create photographer user
  const passwordHash = await bcrypt.hash("password123", 12);

  const photographer = await prisma.user.upsert({
    where: { email: "demo@schoolphotos.com" },
    update: {},
    create: {
      email: "demo@schoolphotos.com",
      name: "Demo Photographer",
      passwordHash,
      role: "photographer",
    },
  });

  console.log(`Created user: ${photographer.email}`);

  // Create sample schools
  const lincoln = await prisma.school.upsert({
    where: { id: "school-lincoln" },
    update: {},
    create: {
      id: "school-lincoln",
      name: "Lincoln Elementary",
      address: "123 Main St, Springfield, IL 62701",
      contactName: "Ms. Johnson",
      contactEmail: "johnson@lincoln.edu",
      contactPhone: "(555) 123-4567",
      photographerId: photographer.id,
    },
  });

  const washington = await prisma.school.upsert({
    where: { id: "school-washington" },
    update: {},
    create: {
      id: "school-washington",
      name: "Washington Middle School",
      address: "456 Oak Ave, Springfield, IL 62702",
      contactName: "Mr. Davis",
      contactEmail: "davis@washington.edu",
      contactPhone: "(555) 987-6543",
      photographerId: photographer.id,
    },
  });

  console.log(`Created schools: ${lincoln.name}, ${washington.name}`);

  // Create students for Lincoln Elementary
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

  for (const student of lincolnStudents) {
    await prisma.student.create({
      data: { ...student, schoolId: lincoln.id },
    });
  }

  console.log(`Created ${lincolnStudents.length} students at Lincoln Elementary`);

  // Create an upcoming event
  const event = await prisma.event.create({
    data: {
      type: "initial",
      date: new Date("2026-04-15"),
      startTime: "08:30",
      notes: "Spring picture day. Setup in the gym by 8:00 AM.",
      classOrder: JSON.stringify([
        { grade: "K", teacher: "Mrs. Adams" },
        { grade: "1", teacher: "Ms. Clark" },
        { grade: "2", teacher: "Mr. Brown" },
        { grade: "3", teacher: "Mrs. Davis" },
      ]),
      status: "scheduled",
      schoolId: lincoln.id,
      photographerId: photographer.id,
    },
  });

  console.log(`Created event: Picture Day at Lincoln on ${event.date.toLocaleDateString()}`);

  // Mark event as in-progress and create check-ins for all students
  await prisma.event.update({
    where: { id: event.id },
    data: { status: "in_progress" },
  });

  const allStudents = await prisma.student.findMany({
    where: { schoolId: lincoln.id },
    orderBy: [{ grade: "asc" }, { lastName: "asc" }],
  });

  let seq = 1;
  for (const student of allStudents) {
    await prisma.checkIn.create({
      data: {
        studentId: student.id,
        eventId: event.id,
        status: "photographed",
        sequence: seq++,
        checkedInAt: new Date(),
      },
    });
  }
  console.log(`Created ${allStudents.length} check-ins`);

  // Create matched photos (2-3 poses per student)
  let photoCount = 0;
  for (let i = 0; i < allStudents.length; i++) {
    const student = allStudents[i];
    const sid = lincolnStudents[i].studentId;
    const poses = i < 3 ? 3 : 2;
    for (let p = 1; p <= poses; p++) {
      const filename = `${sid}_pose${p}.bmp`;
      await prisma.photo.create({
        data: {
          filename,
          storagePath: `seed-photos/${filename}`,
          mimeType: "image/bmp",
          sequence: p,
          matched: true,
          eventId: event.id,
          studentId: student.id,
        },
      });
      photoCount++;
    }
  }
  console.log(`Created ${photoCount} matched photos`);

  // Generate proof links with family grouping
  const families = new Map<string, typeof allStudents>();
  const singles: typeof allStudents = [];

  for (const s of allStudents) {
    if (s.familyId) {
      if (!families.has(s.familyId)) families.set(s.familyId, []);
      families.get(s.familyId)!.push(s);
    } else {
      singles.push(s);
    }
  }

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  let linkCount = 0;

  for (const [familyId, members] of Array.from(families.entries())) {
    const token = crypto.randomBytes(16).toString("hex");
    await prisma.proofLink.create({
      data: {
        token,
        familyId,
        expiresAt,
        eventId: event.id,
        studentId: members[0].id,
        viewCount: Math.floor(Math.random() * 5),
      },
    });
    linkCount++;
    console.log(`  Family link: /proof/${token} (${members.map(m => m.firstName).join(", ")} ${members[0].lastName})`);
  }

  for (const s of singles) {
    const token = crypto.randomBytes(16).toString("hex");
    await prisma.proofLink.create({
      data: {
        token,
        expiresAt,
        eventId: event.id,
        studentId: s.id,
        viewCount: Math.floor(Math.random() * 3),
      },
    });
    linkCount++;
    console.log(`  Individual link: /proof/${token} (${s.firstName} ${s.lastName})`);
  }

  console.log(`Created ${linkCount} proof links`);

  // ─── Packages ──────────────────────────────────────
  const basicPkg = await prisma.package.create({
    data: {
      name: "Basic Package",
      description: "1 8x10, 2 5x7, 8 wallets",
      price: 2500, // $25.00
      contents: JSON.stringify([
        { type: "print", size: "8x10", qty: 1 },
        { type: "print", size: "5x7", qty: 2 },
        { type: "print", size: "wallet", qty: 8 },
      ]),
      digital: false,
      sortOrder: 1,
      schoolId: lincoln.id,
    },
  });

  const premiumPkg = await prisma.package.create({
    data: {
      name: "Premium Package",
      description: "2 8x10, 4 5x7, 16 wallets + digital download",
      price: 4500, // $45.00
      contents: JSON.stringify([
        { type: "print", size: "8x10", qty: 2 },
        { type: "print", size: "5x7", qty: 4 },
        { type: "print", size: "wallet", qty: 16 },
        { type: "digital", size: "full-res", qty: 1 },
      ]),
      digital: true,
      sortOrder: 2,
      schoolId: lincoln.id,
    },
  });

  const digitalPkg = await prisma.package.create({
    data: {
      name: "Digital Only",
      description: "High-resolution digital download of all poses",
      price: 1500, // $15.00
      contents: JSON.stringify([
        { type: "digital", size: "full-res", qty: 1 },
      ]),
      digital: true,
      sortOrder: 3,
      schoolId: lincoln.id,
    },
  });

  console.log(`Created 3 packages for Lincoln Elementary`);

  // Add payment instructions
  await prisma.school.update({
    where: { id: lincoln.id },
    data: { paymentInstructions: "Venmo: @DemoPhotographer\nZelle: demo@schoolphotos.com\nPlease include student name in memo." },
  });

  // ─── Sample Orders ─────────────────────────────────
  // Paid card order
  const order1 = await prisma.order.create({
    data: {
      orderNumber: "SP-2026-0001",
      status: "paid",
      source: "online",
      totalAmount: 4500,
      parentName: "Sarah Smith",
      parentEmail: "smith.family@email.com",
      stripePaymentId: "pi_demo_001",
      eventId: event.id,
      items: {
        create: [
          { packageId: premiumPkg.id, studentId: allStudents[0].id, quantity: 1, unitPrice: 4500 },
        ],
      },
    },
  });

  // Paid card order for sibling
  const order2 = await prisma.order.create({
    data: {
      orderNumber: "SP-2026-0002",
      status: "paid",
      source: "online",
      totalAmount: 2500,
      parentName: "Sarah Smith",
      parentEmail: "smith.family@email.com",
      stripePaymentId: "pi_demo_002",
      eventId: event.id,
      items: {
        create: [
          { packageId: basicPkg.id, studentId: allStudents[1].id, quantity: 1, unitPrice: 2500 },
        ],
      },
    },
  });

  // Venmo order awaiting payment
  const order3 = await prisma.order.create({
    data: {
      orderNumber: "SP-2026-0003",
      status: "awaiting_payment",
      source: "online",
      totalAmount: 2500,
      parentName: "Maria Garcia",
      parentEmail: "garcia@email.com",
      eventId: event.id,
      items: {
        create: [
          { packageId: basicPkg.id, studentId: allStudents[6].id, quantity: 1, unitPrice: 2500 },
        ],
      },
    },
  });

  // Paper order entered by photographer
  const order4 = await prisma.order.create({
    data: {
      orderNumber: "SP-2026-0004",
      status: "paid",
      source: "paper",
      totalAmount: 4000,
      parentName: "Tom Williams",
      parentEmail: "williams@email.com",
      notes: "Paid by check #1234",
      eventId: event.id,
      items: {
        create: [
          { packageId: basicPkg.id, studentId: allStudents[3].id, quantity: 1, unitPrice: 2500 },
          { packageId: digitalPkg.id, studentId: allStudents[3].id, quantity: 1, unitPrice: 1500 },
        ],
      },
    },
  });

  // Sent to lab
  const order5 = await prisma.order.create({
    data: {
      orderNumber: "SP-2026-0005",
      status: "sent_to_lab",
      source: "online",
      totalAmount: 4500,
      parentName: "Jennifer Davis",
      parentEmail: "davis.family@email.com",
      stripePaymentId: "pi_demo_005",
      eventId: event.id,
      items: {
        create: [
          { packageId: premiumPkg.id, studentId: allStudents[8].id, quantity: 1, unitPrice: 4500 },
        ],
      },
    },
  });

  console.log(`Created 5 sample orders (total: $${((4500+2500+2500+4000+4500)/100).toFixed(2)})`);

  // ─── Washington School (minimal data) ──────────────
  const washStudents = [
    { firstName: "Mason", lastName: "Anderson", grade: "6", teacher: "Mr. Harris", studentId: "WS-001", parentEmail: "anderson@email.com" },
    { firstName: "Charlotte", lastName: "Thomas", grade: "6", teacher: "Mr. Harris", studentId: "WS-002", parentEmail: "thomas@email.com" },
    { firstName: "Ethan", lastName: "Jackson", grade: "7", teacher: "Ms. White", studentId: "WS-003", parentEmail: "jackson@email.com" },
    { firstName: "Amelia", lastName: "White", grade: "7", teacher: "Ms. White", studentId: "WS-004", parentEmail: "white@email.com" },
    { firstName: "Alexander", lastName: "Harris", grade: "8", teacher: "Mr. Lee", studentId: "WS-005", parentEmail: "harris@email.com" },
  ];

  for (const student of washStudents) {
    await prisma.student.create({
      data: { ...student, schoolId: washington.id },
    });
  }

  // Future event for Washington
  await prisma.event.create({
    data: {
      type: "initial",
      date: new Date("2026-05-01"),
      startTime: "09:00",
      notes: "Spring pictures in the cafeteria",
      status: "scheduled",
      schoolId: washington.id,
      photographerId: photographer.id,
    },
  });

  console.log(`Created ${washStudents.length} students and 1 event for Washington Middle School`);

  console.log("\n--- Seed complete ---");
  console.log("Login: demo@schoolphotos.com / password123");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
