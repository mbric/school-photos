export function ProcessFlowDiagram() {
  return (
    <svg viewBox="0 0 720 1020" xmlns="http://www.w3.org/2000/svg" role="img" className="w-full h-auto">
      <title>ShutterDay End-to-End Process Flow</title>
      <desc>Process diagram showing how school data flows into the platform, through picture day, to parent proof selection and delivery, with unique identifiers tracked throughout.</desc>
      <style>{`
        .pf-text { font-family: system-ui, -apple-system, sans-serif; }
        .pf-title { font-size: 15px; font-weight: 700; fill: #1a1a1a; }
        .pf-phase-label { font-size: 11px; font-weight: 700; fill: white; }
        .pf-step-box { fill: #fff; stroke: #d1d5db; stroke-width: 1.2; }
        .pf-step-title { font-size: 11px; font-weight: 600; fill: #1a1a1a; }
        .pf-step-detail { font-size: 9.5px; fill: #6b7280; }
        .pf-id-tag { font-size: 8.5px; font-weight: 600; fill: #7c3aed; }
        .pf-id-bg { fill: #f5f3ff; stroke: #c4b5fd; stroke-width: 0.8; }
        .pf-arrow { stroke: #9ca3af; stroke-width: 1.5; fill: none; marker-end: url(#pf-arw); }
        .pf-or-label { font-size: 9px; fill: #9ca3af; font-style: italic; }
      `}</style>
      <defs>
        <marker id="pf-arw" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#9ca3af"/>
        </marker>
      </defs>

      <text x="20" y="24" className="pf-text pf-title">ShutterDay — End-to-End Process Flow</text>
      <text x="20" y="40" className="pf-text pf-step-detail">Unique identifiers shown in purple track each student from intake through delivery</text>

      {/* ONBOARDING phase */}
      <rect x="10" y="56" width="96" height="22" rx="4" fill="#2563eb"/>
      <text x="58" y="71" className="pf-text pf-phase-label" textAnchor="middle">ONBOARDING</text>
      <rect x="130" y="52" width="240" height="44" rx="6" className="pf-step-box"/>
      <text x="250" y="70" className="pf-text pf-step-title" textAnchor="middle">School signs contract</text>
      <text x="250" y="82" className="pf-text pf-step-detail" textAnchor="middle">School admin created in platform</text>
      <rect x="390" y="56" width="80" height="16" rx="3" className="pf-id-bg"/>
      <text x="430" y="67" className="pf-text pf-id-tag" textAnchor="middle">school_id</text>

      <line x1="250" y1="96" x2="250" y2="114" className="pf-arrow"/>

      <rect x="40" y="114" width="155" height="44" rx="6" className="pf-step-box"/>
      <text x="117" y="132" className="pf-text pf-step-title" textAnchor="middle">School sends roster</text>
      <text x="117" y="144" className="pf-text pf-step-detail" textAnchor="middle">CSV: name, grade, classroom</text>

      <rect x="210" y="114" width="155" height="44" rx="6" className="pf-step-box"/>
      <text x="287" y="132" className="pf-text pf-step-title" textAnchor="middle">Manual entry</text>
      <text x="287" y="144" className="pf-text pf-step-detail" textAnchor="middle">Megan keys in student list</text>

      <rect x="380" y="114" width="155" height="44" rx="6" className="pf-step-box"/>
      <text x="457" y="132" className="pf-text pf-step-title" textAnchor="middle">Parent self-registers</text>
      <text x="457" y="144" className="pf-text pf-step-detail" textAnchor="middle">Parent adds child via link</text>

      <text x="185" y="128" className="pf-text pf-or-label">or</text>
      <text x="355" y="128" className="pf-text pf-or-label">or</text>

      <line x1="117" y1="158" x2="117" y2="172" className="pf-arrow"/>
      <line x1="287" y1="158" x2="287" y2="172" className="pf-arrow"/>
      <line x1="457" y1="158" x2="457" y2="172" className="pf-arrow"/>
      <line x1="117" y1="172" x2="457" y2="172" stroke="#9ca3af" strokeWidth="1.5"/>
      <line x1="287" y1="172" x2="287" y2="186" className="pf-arrow"/>

      <rect x="150" y="186" width="280" height="44" rx="6" fill="#fff" stroke="#7c3aed" strokeWidth="1.5"/>
      <text x="290" y="204" className="pf-text pf-step-title" textAnchor="middle">Student record created</text>
      <text x="290" y="216" className="pf-text pf-step-detail" textAnchor="middle">Unique token generated, linked to school + classroom</text>
      <rect x="450" y="190" width="110" height="16" rx="3" className="pf-id-bg"/>
      <text x="505" y="201" className="pf-text pf-id-tag" textAnchor="middle">student_token</text>
      <rect x="450" y="210" width="110" height="16" rx="3" className="pf-id-bg"/>
      <text x="505" y="221" className="pf-text pf-id-tag" textAnchor="middle">school_id + grade</text>

      <line x1="290" y1="230" x2="290" y2="250" className="pf-arrow"/>

      {/* PRE-SHOOT phase */}
      <rect x="10" y="250" width="96" height="22" rx="4" fill="#0d9488"/>
      <text x="58" y="265" className="pf-text pf-phase-label" textAnchor="middle">PRE-SHOOT</text>

      <rect x="150" y="246" width="280" height="52" rx="6" className="pf-step-box"/>
      <text x="290" y="264" className="pf-text pf-step-title" textAnchor="middle">Generate take-home flyers</text>
      <text x="290" y="276" className="pf-text pf-step-detail" textAnchor="middle">Each flyer has unique QR code encoding student_token</text>
      <text x="290" y="288" className="pf-text pf-step-detail" textAnchor="middle">QR links to: shutterday.com/p/{"{student_token}"}</text>
      <rect x="450" y="252" width="110" height="16" rx="3" className="pf-id-bg"/>
      <text x="505" y="263" className="pf-text pf-id-tag" textAnchor="middle">student_token</text>

      <line x1="290" y1="298" x2="290" y2="316" className="pf-arrow"/>

      <rect x="150" y="316" width="280" height="44" rx="6" className="pf-step-box"/>
      <text x="290" y="334" className="pf-text pf-step-title" textAnchor="middle">Flyers distributed to students</text>
      <text x="290" y="346" className="pf-text pf-step-detail" textAnchor="middle">Bundled by classroom, sent home in backpacks</text>

      <line x1="290" y1="360" x2="290" y2="378" className="pf-arrow"/>

      <rect x="150" y="378" width="280" height="52" rx="6" className="pf-step-box"/>
      <text x="290" y="396" className="pf-text pf-step-title" textAnchor="middle">Parent scans QR code</text>
      <text x="290" y="408" className="pf-text pf-step-detail" textAnchor="middle">Creates parent account (or logs in)</text>
      <text x="290" y="420" className="pf-text pf-step-detail" textAnchor="middle">Auto-linked to their child&apos;s record</text>
      <rect x="450" y="382" width="110" height="16" rx="3" className="pf-id-bg"/>
      <text x="505" y="393" className="pf-text pf-id-tag" textAnchor="middle">parent_id</text>
      <rect x="450" y="402" width="110" height="16" rx="3" className="pf-id-bg"/>
      <text x="505" y="413" className="pf-text pf-id-tag" textAnchor="middle">student_token</text>

      <line x1="290" y1="430" x2="290" y2="452" className="pf-arrow"/>

      {/* PICTURE DAY phase */}
      <rect x="10" y="452" width="96" height="22" rx="4" fill="#ea580c"/>
      <text x="58" y="467" className="pf-text pf-phase-label" textAnchor="middle">PICTURE DAY</text>

      <rect x="150" y="448" width="280" height="52" rx="6" className="pf-step-box"/>
      <text x="290" y="466" className="pf-text pf-step-title" textAnchor="middle">Photograph students</text>
      <text x="290" y="478" className="pf-text pf-step-detail" textAnchor="middle">Scan student QR card or match by class roster</text>
      <text x="290" y="490" className="pf-text pf-step-detail" textAnchor="middle">Each photo file tagged with student_token</text>
      <rect x="450" y="454" width="110" height="16" rx="3" className="pf-id-bg"/>
      <text x="505" y="465" className="pf-text pf-id-tag" textAnchor="middle">student_token</text>
      <rect x="450" y="474" width="110" height="16" rx="3" className="pf-id-bg"/>
      <text x="505" y="485" className="pf-text pf-id-tag" textAnchor="middle">photo_id</text>

      <line x1="290" y1="500" x2="290" y2="518" className="pf-arrow"/>

      <rect x="150" y="518" width="280" height="44" rx="6" className="pf-step-box"/>
      <text x="290" y="536" className="pf-text pf-step-title" textAnchor="middle">Upload &amp; process photos</text>
      <text x="290" y="548" className="pf-text pf-step-detail" textAnchor="middle">Batch upload, auto-match to students, generate proofs</text>
      <rect x="450" y="522" width="130" height="16" rx="3" className="pf-id-bg"/>
      <text x="515" y="533" className="pf-text pf-id-tag" textAnchor="middle">photo_id → student_token</text>

      <line x1="290" y1="562" x2="290" y2="580" className="pf-arrow"/>

      {/* SELECTION phase */}
      <rect x="10" y="580" width="96" height="22" rx="4" fill="#7c3aed"/>
      <text x="58" y="595" className="pf-text pf-phase-label" textAnchor="middle">SELECTION</text>

      <rect x="150" y="576" width="280" height="44" rx="6" className="pf-step-box"/>
      <text x="290" y="594" className="pf-text pf-step-title" textAnchor="middle">Notify parent: proofs ready</text>
      <text x="290" y="606" className="pf-text pf-step-detail" textAnchor="middle">Email/SMS with direct link to child&apos;s proof gallery</text>
      <rect x="450" y="580" width="110" height="16" rx="3" className="pf-id-bg"/>
      <text x="505" y="591" className="pf-text pf-id-tag" textAnchor="middle">parent_id</text>

      <line x1="290" y1="620" x2="290" y2="638" className="pf-arrow"/>

      <rect x="150" y="638" width="280" height="44" rx="6" className="pf-step-box"/>
      <text x="290" y="656" className="pf-text pf-step-title" textAnchor="middle">Parent views proof gallery</text>
      <text x="290" y="668" className="pf-text pf-step-detail" textAnchor="middle">Watermarked previews, select favorites</text>

      <line x1="290" y1="682" x2="290" y2="700" className="pf-arrow"/>

      <rect x="150" y="700" width="280" height="44" rx="6" className="pf-step-box"/>
      <text x="290" y="718" className="pf-text pf-step-title" textAnchor="middle">Select package + photos</text>
      <text x="290" y="730" className="pf-text pf-step-detail" textAnchor="middle">Choose poses, sizes, add-ons (class composite, etc.)</text>
      <rect x="450" y="704" width="110" height="16" rx="3" className="pf-id-bg"/>
      <text x="505" y="715" className="pf-text pf-id-tag" textAnchor="middle">order_id</text>

      <line x1="290" y1="744" x2="290" y2="762" className="pf-arrow"/>

      <rect x="150" y="762" width="280" height="44" rx="6" className="pf-step-box"/>
      <text x="290" y="780" className="pf-text pf-step-title" textAnchor="middle">Payment (Stripe / Venmo / Zelle)</text>
      <text x="290" y="792" className="pf-text pf-step-detail" textAnchor="middle">Order confirmed, receipt sent to parent</text>
      <rect x="450" y="766" width="110" height="16" rx="3" className="pf-id-bg"/>
      <text x="505" y="777" className="pf-text pf-id-tag" textAnchor="middle">payment_id</text>

      <line x1="290" y1="806" x2="290" y2="824" className="pf-arrow"/>

      {/* FULFILLMENT phase */}
      <rect x="10" y="824" width="96" height="22" rx="4" fill="#dc2626"/>
      <text x="58" y="839" className="pf-text pf-phase-label" textAnchor="middle">FULFILLMENT</text>

      <rect x="150" y="820" width="280" height="44" rx="6" className="pf-step-box"/>
      <text x="290" y="838" className="pf-text pf-step-title" textAnchor="middle">Process &amp; fulfill orders</text>
      <text x="290" y="850" className="pf-text pf-step-detail" textAnchor="middle">Print, package by classroom, or digital download</text>
      <rect x="450" y="824" width="145" height="16" rx="3" className="pf-id-bg"/>
      <text x="522" y="835" className="pf-text pf-id-tag" textAnchor="middle">order_id → student_token</text>

      <line x1="290" y1="864" x2="290" y2="882" className="pf-arrow"/>

      <rect x="150" y="882" width="280" height="44" rx="6" className="pf-step-box"/>
      <text x="290" y="900" className="pf-text pf-step-title" textAnchor="middle">Deliver to school or ship home</text>
      <text x="290" y="912" className="pf-text pf-step-detail" textAnchor="middle">Bundled by classroom, labeled with student name</text>

      {/* Identifier chain footer */}
      <rect x="40" y="950" width="640" height="52" rx="6" fill="#f5f5f5" stroke="#7c3aed" strokeWidth="1.5"/>
      <text x="60" y="968" className="pf-text pf-step-title" fill="#7c3aed">Identifier chain:</text>
      <text x="60" y="984" className="pf-text pf-step-detail" fontSize="10px">school_id → student_token (the spine) → parent_id → photo_id → order_id → payment_id</text>
      <text x="60" y="996" className="pf-text pf-step-detail" fontSize="10px">The student_token is the universal key — printed on the QR flyer, scanned at shoot, linked to proofs, traced through to delivery.</text>
    </svg>
  );
}
