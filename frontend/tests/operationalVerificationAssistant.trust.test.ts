import { describe, it, expect } from 'vitest';
import { generateOperationalReport, generateAuditSummary, formatHumanReport, EvidenceEntry } from '../src/lib/operationalVerificationAssistant';

// Helper sample evidence
const sampleEvidence: EvidenceEntry[] = [
  { id: 'e1', anpr: { plate: 'TN-22-AB-4821', confidence: 0.96 }, weighbridge: { weight: 16.4, unit: 'T', confidence: 0.98 }, invoice: { id: 'INV-204', declaredWeight: 18, unit: 'T', trusted: 0.95 } },
];

const bannedPhrases = [
  'confirmed fraud',
  'fraud detected',
  'theft occurred',
  'manipulation confirmed',
  'violation proven',
  'immediate fraud action required'
];

describe('Operational Verification Assistant - Trustworthy outputs', () => {
  it('does not use absolute-claim phrases in summaries', () => {
    const r = generateOperationalReport(sampleEvidence as any);
    const audit = generateAuditSummary(r);
    const human = formatHumanReport(r);
    const text = (audit + '\n' + human).toLowerCase();
    for (const p of bannedPhrases) {
      expect(text).not.toContain(p);
    }
  });

  it('includes confidence breakdown with rationale', () => {
    const r = generateOperationalReport(sampleEvidence as any);
    const audit = generateAuditSummary(r).toLowerCase();
    expect(audit).toContain('confidence breakdown');
    expect(audit).toMatch(/anpr:\s*\d+%/i);
    expect(audit).toMatch(/weighbridge:\s*\d+%/i);
    expect(audit).toMatch(/invoice:\s*\d+%/i);
    // rationale words
    expect(audit).toMatch(/confidence|trust|unavailable|scale|ocr|plate/);
  });

  it('reports evidence gaps when evidence is missing', () => {
    const r = generateOperationalReport([] as any);
    const audit = generateAuditSummary(r).toLowerCase();
    // must explicitly list missing items
    expect(audit).toMatch(/evidence gaps|evidence gaps \(explicit\)/i);
    // common missing indicators
    expect(audit).toSatisfy((s: string) => {
      return s.includes('no anpr') || s.includes('no weighbridge') || s.includes('no invoice') || s.includes('no unloading');
    });
  });

  it('recommends cautious actions and avoids absolute escalation text', () => {
    const r = generateOperationalReport(sampleEvidence as any);
    const audit = generateAuditSummary(r).toLowerCase();
    // recommended actions section exists
    expect(audit).toContain('recommended actions');
    // should not demand immediate fraud action
    expect(audit).not.toContain('immediate fraud');
    // escalation decision must be one of allowed tokens when present
    const allowed = ['monitor', 'review', 'escalate', 'open_incident'];
    if ((r as any).escalationDecision && (r as any).escalationDecision.decision) {
      expect(allowed).toContain((r as any).escalationDecision.decision);
    }
  });
});
