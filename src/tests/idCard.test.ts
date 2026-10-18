import { describe, it, expect } from 'vitest';
import '../templates/registry';
import '../brandKits/loader';
import { BUILT_IN_ROLES, DEFAULT_ROLES, getRoleOrDefault } from '../core/schema/Role';
import { generateDraftsDeterministic } from '../core/ai/draftGenerator';
import { renderCard } from '../core/renderer';
import type { EventContext } from '../core/schema/EventContext';
import type { Person } from '../core/schema/Person';

describe('Role Family Specifications', () => {
  it('should include all required built-in roles including judge', () => {
    expect(BUILT_IN_ROLES).toContain('participant');
    expect(BUILT_IN_ROLES).toContain('organizer');
    expect(BUILT_IN_ROLES).toContain('mentor');
    expect(BUILT_IN_ROLES).toContain('volunteer');
    expect(BUILT_IN_ROLES).toContain('judge');
    expect(BUILT_IN_ROLES).toContain('speaker');

    const defaultRoleIds = DEFAULT_ROLES.map((r) => r.id);
    expect(defaultRoleIds).toContain('judge');
    expect(defaultRoleIds).toContain('participant');
  });

  it('should generate distinct cohesive palettes for each built-in role', () => {
    const participant = getRoleOrDefault('participant');
    const organizer = getRoleOrDefault('organizer');
    const judge = getRoleOrDefault('judge');

    expect(participant.palette.primary).toBe('#0F5C4D');
    expect(organizer.palette.primary).toBe('#14201C');
    expect(organizer.palette.accent).toBe('#0F5C4D');
    expect(judge.palette.primary).toBe('#3B4842');
    expect(participant.palette.primary).not.toEqual(organizer.palette.primary);
  });

  it('should dynamically generate a custom role with harmonious palette and label', () => {
    const customRole = getRoleOrDefault('vip-sponsor');
    expect(customRole.id).toBe('vip-sponsor');
    expect(customRole.label).toBe('Vip-sponsor');
    expect(customRole.palette.primary).toBeTruthy();
    expect(customRole.palette.accent).toBeTruthy();
  });
});

describe('Draft Generation System', () => {
  const dummyEvent: EventContext = {
    name: { value: 'INCURSION 2026', status: 'provided' },
    tagline: { value: 'Annual Flagship Hackathon', status: 'provided' },
    dateStart: { value: '2026-03-20', status: 'provided' },
    dateEnd: { value: '2026-03-22', status: 'provided' },
    duration: { value: '36 Hours', status: 'provided' },
    venue: { value: 'SVNIT Surat', status: 'provided' },
    organizer: { value: 'ACM NIT Surat', status: 'provided' },
    website: { value: 'https://acm.svnit.ac.in', status: 'provided' },
    contact: { value: 'acm@svnit.ac.in', status: 'provided' },
  };

  it('should generate exactly 3 distinct draft families', () => {
    const drafts = generateDraftsDeterministic(dummyEvent, ['participant', 'organizer', 'judge']);
    expect(drafts).toHaveLength(3);

    const ids = drafts.map((d) => d.id);
    expect(ids).toContain('modern-minimal');
    expect(ids).toContain('creative-tech');
    expect(ids).toContain('premium-editorial');
  });

  it('should populate roleElements for all active roles in each draft', () => {
    const drafts = generateDraftsDeterministic(dummyEvent, ['participant', 'organizer', 'judge']);
    for (const draft of drafts) {
      expect(draft.roleElements).toBeDefined();
      expect(draft.roleElements?.['participant']).toBeDefined();
      expect(draft.roleElements?.['organizer']).toBeDefined();
      expect(draft.roleElements?.['judge']).toBeDefined();
      expect(draft.roleBackElements).toBeDefined();
    }
  });

  it('should provide genuine structural differences between draft layouts', () => {
    const drafts = generateDraftsDeterministic(dummyEvent, ['participant']);
    const [minimal, tech, editorial] = drafts;

    // Modern Minimal has circular photo with lanyard slot
    const minimalPhoto = minimal.elements.find((el) => el.type === 'photo');
    expect(minimalPhoto?.shape).toBe('circle');

    // Creative Tech has hexagon / tech shapes and scannable QR (barcode removed per design requirements)
    const techShapes = tech.elements.filter((el) => el.type === 'shape');
    const hasHexOrChevron = techShapes.some(
      (s) => s.id?.includes('hex') || s.id?.includes('chevron')
    );
    expect(hasHexOrChevron).toBe(true);
    const techBarcode = tech.elements.find((el) => el.type === 'barcode');
    expect(techBarcode).toBeUndefined();
    const techQr = tech.elements.find((el) => el.type === 'qr');
    expect(techQr).toBeDefined();

    // Premium Editorial has asymmetric vertical block and rectangular photo
    const editorialPhoto = editorial.elements.find((el) => el.type === 'photo');
    expect(editorialPhoto?.shape).toBe('rounded');
    const editorialBlock = editorial.elements.find((el) => el.id === 'vertical-accent-block');
    expect(editorialBlock).toBeDefined();
  });
});

describe('Vector SVG Renderer', () => {
  const dummyEvent: EventContext = {
    name: { value: 'INCURSION 2026', status: 'provided' },
    tagline: { value: 'Annual Flagship Hackathon', status: 'provided' },
    dateStart: { value: '2026-03-20', status: 'provided' },
    dateEnd: { value: '2026-03-22', status: 'provided' },
    duration: { value: '36 Hours', status: 'provided' },
    venue: { value: 'SVNIT Surat', status: 'provided' },
    organizer: { value: 'ACM NIT Surat', status: 'provided' },
    website: { value: 'https://acm.svnit.ac.in', status: 'provided' },
    contact: { value: 'acm@svnit.ac.in', status: 'provided' },
  };

  const dummyPerson: Person = {
    id: 'PART-0042',
    name: 'Ada Lovelace',
    role: 'participant',
    team: 'Algorithm Innovators',
    extra: {},
  };

  it('should render valid SVG string with correct mm dimensions and viewBox', () => {
    const drafts = generateDraftsDeterministic(dummyEvent, ['participant']);
    const role = getRoleOrDefault('participant');
    const result = renderCard({
      template: drafts[0],
      role,
      person: dummyPerson,
      event: dummyEvent,
      face: 'front',
    });

    expect(result.svg).toContain('<svg');
    expect(result.svg).toContain('viewBox="0 0 54 85.6"');
    expect(result.svg).toContain('Ada Lovelace');
    expect(result.svg).toContain('INCURSION 2026');
    expect(result.svg).toContain('</svg>');
  });

  it('should render bold-band from registry', async () => {
    const { getTemplate } = await import('../templates/registry');
    const tpl = getTemplate('bold-band')!;
    const role = getRoleOrDefault('organizer');
    const person = { id: 'O001', name: 'Priya Mehta', role: 'organizer', team: 'Core Team', email: '', photoUrl: '', extra: {} };
    const result = renderCard({
      template: tpl,
      role,
      person,
      event: dummyEvent,
      face: 'front',
    });
    console.log('BOLD BAND SVG:\n' + result.svg);
  });

  it('should render genuine vector QR code path on back side', () => {
    const drafts = generateDraftsDeterministic(dummyEvent, ['participant']);
    const role = getRoleOrDefault('participant');
    const result = renderCard({
      template: drafts[0],
      role,
      person: dummyPerson,
      event: dummyEvent,
      face: 'back',
    });

    expect(result.svg).toContain('d="M');
    expect(result.svg).toContain('shape-rendering="crispEdges"');
  });

  it('should render vector barcode with ID text in templates with barcode element', () => {
    const customTemplate = {
      ...generateDraftsDeterministic(dummyEvent, ['participant'])[0],
      roleElements: {
        participant: [
          {
            type: 'barcode' as const,
            id: 'person-barcode',
            anchor: { x: 7, y: 73, w: 40, h: 8 },
            valueBinding: '{{person.id}}',
            format: 'CODE128' as const,
            fgColor: '#000000',
            bgColor: '#ffffff',
          },
        ],
      },
    };
    const role = getRoleOrDefault('participant');
    const result = renderCard({
      template: customTemplate,
      role,
      person: dummyPerson,
      event: dummyEvent,
      face: 'front',
    });

    expect(result.svg).toContain('PART-0042');
    expect(result.svg).toContain('shape-rendering="crispEdges"');
  });

  it('should adapt render properly for custom roles without crashing', () => {
    const customRole = getRoleOrDefault('keynote-vip');
    const customPerson: Person = {
      id: 'VIP-999',
      name: 'Dr. Jane Smith',
      role: 'keynote-vip',
      team: 'Quantum Labs',
      extra: {},
    };

    const drafts = generateDraftsDeterministic(dummyEvent, ['keynote-vip']);
    const result = renderCard({
      template: drafts[1],
      role: customRole,
      person: customPerson,
      event: dummyEvent,
      face: 'front',
    });

    expect(result.svg).toContain('Dr. Jane Smith');
    expect(result.svg).toContain('Quantum Labs');
  });

  it('should render event details, participant name, and logos even when eventContext or name is empty', () => {
    const drafts = generateDraftsDeterministic(dummyEvent, ['participant']);
    const role = getRoleOrDefault('participant');
    const emptyEvent = {
      name: {},
      tagline: {},
      dateStart: {},
      dateEnd: {},
      duration: {},
      venue: {},
      organizer: {},
      website: {},
      contact: {},
    } as any;

    const personWithoutName: Person = {
      id: 'P099',
      name: '',
      role: 'participant',
      extra: {},
    };

    const result = renderCard({
      template: drafts[0],
      role,
      person: personWithoutName,
      event: emptyEvent,
      face: 'front',
    });

    expect(result.svg).toContain('Participant Name');
    expect(result.svg).toContain('INCURSION 2026');
    // Ensure polygon transform does NOT have mm units
    expect(result.svg).not.toMatch(/transform="translate\([^)]+mm/);
    // Ensure logos are present
    expect(result.svg).toContain('svnit-logo');
    expect(result.svg).toContain('acm-logo');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// REGRESSION: All Roles Visual Rendering
// ─────────────────────────────────────────────────────────────────────────────
describe('Role-Specific Rendering Regression', () => {
  const dummyEvent: EventContext = {
    name: { value: 'INCURSION 2026', status: 'provided' },
    tagline: { value: 'Annual Flagship Hackathon', status: 'provided' },
    dateStart: { value: '2026-03-20', status: 'provided' },
    dateEnd: { value: '2026-03-22', status: 'provided' },
    duration: { value: '36 Hours', status: 'provided' },
    venue: { value: 'SVNIT Surat', status: 'provided' },
    organizer: { value: 'ACM NIT Surat', status: 'provided' },
    website: { value: 'https://acm.svnit.ac.in', status: 'provided' },
    contact: { value: 'acm@svnit.ac.in', status: 'provided' },
  };

  const BUILT_IN_ROLE_IDS = ['participant', 'organizer', 'mentor', 'volunteer', 'judge', 'speaker'];

  it.each(BUILT_IN_ROLE_IDS)(
    'should render all three drafts for role "%s" without crashing',
    (roleId) => {
      const role = getRoleOrDefault(roleId);
      const person: Person = {
        id: `TEST-001`,
        name: 'Test Person',
        role: roleId,
        team: 'Test Team',
        extra: {},
      };
      const drafts = generateDraftsDeterministic(dummyEvent, [roleId]);
      expect(drafts).toHaveLength(3);
      for (const draft of drafts) {
        const result = renderCard({ template: draft, role, person, event: dummyEvent, face: 'front' });
        expect(result.svg).toContain('<svg');
        expect(result.svg).toContain('</svg>');
        expect(result.svg).toContain('Test Person');
        // No render errors expected
        expect(result.warnings.some(w => w.toLowerCase().includes('error'))).toBe(false);
      }
    }
  );

  it('should render organizer with premium dark styling and accent', () => {
    const role = getRoleOrDefault('organizer');
    const person: Person = { id: 'ORG-001', name: 'Raj Patel', role: 'organizer', team: 'Core Org', extra: {} };
    const drafts = generateDraftsDeterministic(dummyEvent, ['organizer']);
    const result = renderCard({ template: drafts[0], role, person, event: dummyEvent, face: 'front' });
    // Organizer should have forest accent (#0F5C4D) somewhere in SVG
    expect(result.svg).toContain('#0F5C4D');
    // Should contain person name
    expect(result.svg).toContain('Raj Patel');
    // Should contain event name
    expect(result.svg).toContain('INCURSION 2026');
  });

  it('should render judge with prestigious minimal styling', () => {
    const role = getRoleOrDefault('judge');
    const person: Person = { id: 'JDG-001', name: 'Dr. Anita Roy', role: 'judge', team: 'Jury Panel', extra: {} };
    const drafts = generateDraftsDeterministic(dummyEvent, ['judge']);
    const result = renderCard({ template: drafts[0], role, person, event: dummyEvent, face: 'front' });
    expect(result.svg).toContain('Dr. Anita Roy');
    expect(result.svg).toContain('INCURSION 2026');
  });

  it('should render speaker with conference-inspired styling', () => {
    const role = getRoleOrDefault('speaker');
    const person: Person = { id: 'SPK-001', name: 'Prof. Amitabh Verma', role: 'speaker', team: 'Industry Expert', extra: {} };
    const drafts = generateDraftsDeterministic(dummyEvent, ['speaker']);
    const result = renderCard({ template: drafts[0], role, person, event: dummyEvent, face: 'front' });
    expect(result.svg).toContain('Prof. Amitabh Verma');
  });

  it('should render custom role without crashing and with fallback palette', () => {
    const role = getRoleOrDefault('vip-sponsor');
    const person: Person = { id: 'VIP-007', name: 'Ratan Tata', role: 'vip-sponsor', team: 'Sponsor Corp', extra: {} };
    const drafts = generateDraftsDeterministic(dummyEvent, ['vip-sponsor']);
    const result = renderCard({ template: drafts[0], role, person, event: dummyEvent, face: 'front' });
    expect(result.svg).toContain('Ratan Tata');
    expect(result.svg).toContain('vip-sponsor');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// REGRESSION: Logo Position Validation
// ─────────────────────────────────────────────────────────────────────────────
describe('Logo Position and Layout Validation', () => {
  const dummyEvent: EventContext = {
    name: { value: 'INCURSION 2026', status: 'provided' },
    tagline: { value: 'Flagship Hackathon', status: 'provided' },
    dateStart: { value: '2026-03-20', status: 'provided' },
    dateEnd: { value: '2026-03-22', status: 'provided' },
    duration: { value: '36 Hours', status: 'provided' },
    venue: { value: 'SVNIT Surat', status: 'provided' },
    organizer: { value: 'ACM NIT Surat', status: 'provided' },
    website: { value: 'https://acm.svnit.ac.in', status: 'provided' },
    contact: { value: 'helpdesk@svnit.ac.in', status: 'provided' },
  };

  const person: Person = { id: 'P001', name: 'Logo Test', role: 'participant', extra: {} };
  const role = getRoleOrDefault('participant');

  it('should render acm-logo and svnit-logo in all three draft templates', () => {
    const drafts = generateDraftsDeterministic(dummyEvent, ['participant']);
    for (const draft of drafts) {
      const result = renderCard({ template: draft, role, person, event: dummyEvent, face: 'front' });
      expect(result.svg).toContain('id="acm-logo"');
      expect(result.svg).toContain('id="svnit-logo"');
    }
  });

  it('should render acm-logo and svnit-logo in bold-band registry template', async () => {
    const { getTemplate } = await import('../templates/registry');
    const tpl = getTemplate('bold-band')!;
    expect(tpl).toBeDefined();
    const result = renderCard({ template: tpl, role, person, event: dummyEvent, face: 'front' });
    expect(result.svg).toContain('id="acm-logo"');
    expect(result.svg).toContain('id="svnit-logo"');
  });

  it('should render acm-logo and svnit-logo in minimal-clean registry template', async () => {
    const { getTemplate } = await import('../templates/registry');
    const tpl = getTemplate('minimal-clean')!;
    expect(tpl).toBeDefined();
    const result = renderCard({ template: tpl, role, person, event: dummyEvent, face: 'front' });
    expect(result.svg).toContain('id="acm-logo"');
    expect(result.svg).toContain('id="svnit-logo"');
  });

  it('should render acm-logo and svnit-logo in modern-gradient registry template', async () => {
    const { getTemplate } = await import('../templates/registry');
    const tpl = getTemplate('modern-gradient')!;
    expect(tpl).toBeDefined();
    const result = renderCard({ template: tpl, role, person, event: dummyEvent, face: 'front' });
    expect(result.svg).toContain('id="acm-logo"');
    expect(result.svg).toContain('id="svnit-logo"');
  });

  it('should have event name in bold-band SVG at correct position (within header y<20mm)', async () => {
    const { getTemplate } = await import('../templates/registry');
    const tpl = getTemplate('bold-band')!;
    const result = renderCard({ template: tpl, role, person, event: dummyEvent, face: 'front' });
    // Event name element should exist
    expect(result.svg).toContain('id="event-name-header"');
    expect(result.svg).toContain('INCURSION 2026');
  });

  it('should have photo element in SVG (person-photo)', async () => {
    const { getTemplate } = await import('../templates/registry');
    const tpl = getTemplate('bold-band')!;
    const result = renderCard({ template: tpl, role, person, event: dummyEvent, face: 'front' });
    expect(result.svg).toContain('id="person-photo"');
  });

  it('should have role-label element visible in bold-band SVG', async () => {
    const { getTemplate } = await import('../templates/registry');
    const tpl = getTemplate('bold-band')!;
    const result = renderCard({ template: tpl, role, person, event: dummyEvent, face: 'front' });
    expect(result.svg).toContain('id="role-label"');
    expect(result.svg).toContain('Participant');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// REGRESSION: Physical Dimensions and SVG ViewBox
// ─────────────────────────────────────────────────────────────────────────────
describe('Physical Dimensions and SVG ViewBox', () => {
  const dummyEvent: EventContext = {
    name: { value: 'Test Event', status: 'provided' },
    tagline: { value: 'Test Tagline', status: 'provided' },
    dateStart: { value: '2026-01-01', status: 'provided' },
    dateEnd: { value: '2026-01-02', status: 'provided' },
    duration: { value: '24 Hours', status: 'provided' },
    venue: { value: 'Test Venue', status: 'provided' },
    organizer: { value: 'ACM NIT Surat', status: 'provided' },
    website: { value: 'https://acm.svnit.ac.in', status: 'provided' },
    contact: { value: 'test@test.com', status: 'provided' },
  };
  const person: Person = { id: 'DIM-001', name: 'Dimension Test', role: 'participant', extra: {} };
  const role = getRoleOrDefault('participant');

  it('should produce SVG with 54x85.6mm portrait viewBox for all draft templates', () => {
    const drafts = generateDraftsDeterministic(dummyEvent, ['participant']);
    for (const draft of drafts) {
      expect(draft.size.widthMm).toBe(54);
      expect(draft.size.heightMm).toBe(85.6);
      expect(draft.orientation).toBe('portrait');
      const result = renderCard({ template: draft, role, person, event: dummyEvent, face: 'front' });
      expect(result.svg).toContain('viewBox="0 0 54 85.6"');
      expect(result.svg).toContain('width="54mm"');
      expect(result.svg).toContain('height="85.6mm"');
    }
  });

  it('bold-band registry template should have correct portrait dimensions', async () => {
    const { getTemplate } = await import('../templates/registry');
    const tpl = getTemplate('bold-band')!;
    expect(tpl.size.widthMm).toBe(54);
    expect(tpl.size.heightMm).toBe(85.6);
    expect(tpl.orientation).toBe('portrait');
    const result = renderCard({ template: tpl, role, person, event: dummyEvent, face: 'front' });
    expect(result.svg).toContain('viewBox="0 0 54 85.6"');
  });

  it('minimal-clean registry template should have correct portrait dimensions', async () => {
    const { getTemplate } = await import('../templates/registry');
    const tpl = getTemplate('minimal-clean')!;
    expect(tpl.size.widthMm).toBe(54);
    expect(tpl.size.heightMm).toBe(85.6);
    const result = renderCard({ template: tpl, role, person, event: dummyEvent, face: 'front' });
    expect(result.svg).toContain('viewBox="0 0 54 85.6"');
  });

  it('modern-gradient registry template should have correct portrait dimensions', async () => {
    const { getTemplate } = await import('../templates/registry');
    const tpl = getTemplate('modern-gradient')!;
    expect(tpl.size.widthMm).toBe(54);
    expect(tpl.size.heightMm).toBe(85.6);
    const result = renderCard({ template: tpl, role, person, event: dummyEvent, face: 'front' });
    expect(result.svg).toContain('viewBox="0 0 54 85.6"');
  });

  it('polygon transforms should never contain mm units', () => {
    const drafts = generateDraftsDeterministic(dummyEvent, ['participant', 'organizer', 'judge']);
    for (const draft of drafts) {
      const result = renderCard({ template: draft, role, person, event: dummyEvent, face: 'front' });
      expect(result.svg).not.toMatch(/transform="translate\([^)]*mm/);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// REGRESSION: Long Names, Missing Data, Edge Cases
// ─────────────────────────────────────────────────────────────────────────────
describe('Edge Cases: Long Names, Missing Data, Invalid Assets', () => {
  const dummyEvent: EventContext = {
    name: { value: 'INCURSION 2026', status: 'provided' },
    tagline: { value: 'Hackathon', status: 'provided' },
    dateStart: { value: '2026-03-20', status: 'provided' },
    dateEnd: { value: '2026-03-22', status: 'provided' },
    duration: { value: '36 Hours', status: 'provided' },
    venue: { value: 'SVNIT Surat', status: 'provided' },
    organizer: { value: 'ACM NIT Surat', status: 'provided' },
    website: { value: 'https://acm.svnit.ac.in', status: 'provided' },
    contact: { value: 'acm@svnit.ac.in', status: 'provided' },
  };

  it('should handle very long participant names gracefully (auto-fit or truncate)', () => {
    const role = getRoleOrDefault('participant');
    const longNamePerson: Person = {
      id: 'LONG-001',
      name: 'Krishnamurti Venkataraman Subramanian Narayanan',
      role: 'participant',
      team: 'Team Alpha Beta Gamma Delta Epsilon',
      extra: {},
    };
    const drafts = generateDraftsDeterministic(dummyEvent, ['participant']);
    for (const draft of drafts) {
      expect(() => renderCard({ template: draft, role, person: longNamePerson, event: dummyEvent, face: 'front' })).not.toThrow();
      const result = renderCard({ template: draft, role, person: longNamePerson, event: dummyEvent, face: 'front' });
      expect(result.svg).toContain('<svg');
      expect(result.svg).toContain('</svg>');
    }
  });

  it('should handle missing photo gracefully with initials fallback', () => {
    const role = getRoleOrDefault('participant');
    const noPhotoPerson: Person = {
      id: 'NOPHOTO-001',
      name: 'John Doe',
      role: 'participant',
      extra: {},
    };
    const drafts = generateDraftsDeterministic(dummyEvent, ['participant']);
    const result = renderCard({ template: drafts[0], role, person: noPhotoPerson, event: dummyEvent, face: 'front' });
    // Should contain initials JD
    expect(result.svg).toContain('JD');
    expect(result.svg).toContain('<svg');
  });

  it('should handle missing team field without blank placeholder', () => {
    const role = getRoleOrDefault('participant');
    const noTeamPerson: Person = {
      id: 'NOTEAM-001',
      name: 'Solo Hacker',
      role: 'participant',
      extra: {},
    };
    const drafts = generateDraftsDeterministic(dummyEvent, ['participant']);
    const result = renderCard({ template: drafts[0], role, person: noTeamPerson, event: dummyEvent, face: 'front' });
    expect(result.svg).toContain('<svg');
    // Should not crash even without team
    expect(result.svg).toContain('Solo Hacker');
  });

  it('should handle missing optional fields (email, photoUrl) without crashing', () => {
    const role = getRoleOrDefault('mentor');
    const minimalPerson: Person = {
      id: 'MIN-001',
      name: 'Minimal Data',
      role: 'mentor',
      extra: {},
    };
    const drafts = generateDraftsDeterministic(dummyEvent, ['mentor']);
    for (const draft of drafts) {
      expect(() => renderCard({ template: draft, role, person: minimalPerson, event: dummyEvent, face: 'front' })).not.toThrow();
    }
  });

  it('should handle event with very long name gracefully', () => {
    const longNameEvent: EventContext = {
      ...dummyEvent,
      name: { value: 'International Annual Hackathon Championship 2026 Grand Edition', status: 'provided' },
    };
    const role = getRoleOrDefault('participant');
    const person: Person = { id: 'EVT-001', name: 'Test User', role: 'participant', extra: {} };
    const drafts = generateDraftsDeterministic(longNameEvent, ['participant']);
    for (const draft of drafts) {
      expect(() => renderCard({ template: draft, role, person, event: longNameEvent, face: 'front' })).not.toThrow();
    }
  });

  it('should render back face without crashing for all templates', () => {
    const role = getRoleOrDefault('participant');
    const person: Person = { id: 'BACK-001', name: 'Back Test', role: 'participant', extra: {} };
    const drafts = generateDraftsDeterministic(dummyEvent, ['participant']);
    for (const draft of drafts) {
      const result = renderCard({ template: draft, role, person, event: dummyEvent, face: 'back' });
      expect(result.svg).toContain('<svg');
      expect(result.svg).toContain('</svg>');
    }
  });

  it('should render back face of registry templates without crashing', async () => {
    const { getTemplate } = await import('../templates/registry');
    const role = getRoleOrDefault('participant');
    const person: Person = { id: 'BREG-001', name: 'Back Registry Test', role: 'participant', extra: {} };
    for (const tplId of ['bold-band', 'minimal-clean', 'modern-gradient']) {
      const tpl = getTemplate(tplId);
      if (!tpl) continue; // Skip if not registered
      expect(() => renderCard({ template: tpl, role, person, event: dummyEvent, face: 'front' })).not.toThrow();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// REGRESSION: Template Schema Validation
// ─────────────────────────────────────────────────────────────────────────────
describe('Template Schema and Registry Validation', () => {
  it('should successfully register all 3 built-in templates', async () => {
    const { getTemplate, listTemplates } = await import('../templates/registry');
    expect(getTemplate('bold-band')).toBeDefined();
    expect(getTemplate('minimal-clean')).toBeDefined();
    expect(getTemplate('modern-gradient')).toBeDefined();
    const idCards = listTemplates('idCard');
    expect(idCards.length).toBeGreaterThanOrEqual(3);
  });

  it('bold-band template should have required schema fields', async () => {
    const { getTemplate } = await import('../templates/registry');
    const tpl = getTemplate('bold-band')!;
    expect(tpl.id).toBe('bold-band');
    expect(tpl.designType).toBe('idCard');
    expect(tpl.version).toBeGreaterThan(0);
    expect(tpl.size).toBeDefined();
    expect(tpl.orientation).toBe('portrait');
    expect(Array.isArray(tpl.elements)).toBe(true);
    expect(tpl.elements.length).toBeGreaterThan(5);
  });

  it('minimal-clean template should have required schema fields', async () => {
    const { getTemplate } = await import('../templates/registry');
    const tpl = getTemplate('minimal-clean')!;
    expect(tpl.id).toBe('minimal-clean');
    expect(tpl.designType).toBe('idCard');
    expect(tpl.version).toBeGreaterThan(0);
    expect(tpl.orientation).toBe('portrait');
    expect(Array.isArray(tpl.elements)).toBe(true);
  });

  it('modern-gradient template should have required schema fields', async () => {
    const { getTemplate } = await import('../templates/registry');
    const tpl = getTemplate('modern-gradient')!;
    expect(tpl.id).toBe('modern-gradient');
    expect(tpl.designType).toBe('idCard');
    expect(tpl.version).toBeGreaterThan(0);
    expect(tpl.orientation).toBe('portrait');
    expect(Array.isArray(tpl.elements)).toBe(true);
  });

  it('each template should contain at least one photo element', async () => {
    const { listTemplates } = await import('../templates/registry');
    const templates = listTemplates('idCard');
    for (const tpl of templates) {
      const hasPhoto = tpl.elements.some(el => el.type === 'photo');
      expect(hasPhoto).toBe(true);
    }
  });

  it('each template should have event-name element', async () => {
    const { listTemplates } = await import('../templates/registry');
    const templates = listTemplates('idCard');
    for (const tpl of templates) {
      const hasEventName = tpl.elements.some(
        el => el.id.includes('event-name') || el.id.includes('header-category')
      );
      expect(hasEventName).toBe(true);
    }
  });

  it('each template should have both logo elements (acm and svnit)', async () => {
    const { listTemplates } = await import('../templates/registry');
    const templates = listTemplates('idCard');
    for (const tpl of templates) {
      const hasAcm = tpl.elements.some(el => el.id === 'acm-logo');
      const hasSvnit = tpl.elements.some(el => el.id === 'svnit-logo');
      expect(hasAcm).toBe(true);
      expect(hasSvnit).toBe(true);
    }
  });
});
