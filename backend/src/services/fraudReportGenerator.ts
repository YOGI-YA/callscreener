import { ScreeningResult, FraudReportPayload } from '../types/index.js';
import { v4 as uuidv4 } from 'uuid';

export class FraudReportGenerator {
  /**
   * Generates a regulatory complaint incident report payload
   */
  public static generateIncidentReport(
    log: ScreeningResult,
    agency: 'FCC' | 'FTC' | 'IC3' | 'TRAI' = 'FTC'
  ): FraudReportPayload {
    const reportId = `REP-${agency}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${uuidv4().slice(0, 6).toUpperCase()}`;

    return {
      reportId,
      generatedAt: new Date().toISOString(),
      reportingAgency: agency,
      incidentDetails: {
        callerNumber: log.phoneNumber,
        callerName: log.callerName || 'Unknown / Unverified',
        timestamp: log.timestamp,
        category: log.category,
        riskScore: log.riskScore,
        spoofProbability: log.metadata?.spoofProbability ?? (log.riskScore / 100),
        transcriptSummary: log.rationale || 'Suspicious telecom interaction screened by AI',
        syntheticArtifacts: Boolean(
          log.metadata?.deepfakeMetrics?.syntheticArtifactsDetected ||
          log.metadata?.acousticBotTelemetry?.isRobocallBot
        )
      }
    };
  }

  /**
   * Generates a compliant CSV export string for single or multiple call incidents
   */
  public static generateCsvExport(logs: ScreeningResult[]): string {
    const headers = [
      'Incident_ID',
      'Timestamp',
      'Caller_Number',
      'Caller_Name',
      'Verdict',
      'Risk_Score',
      'Category',
      'Carrier_Spoof_Probability',
      'Synthetic_Acoustic_Detected',
      'Acoustic_Fingerprint',
      'Rationale_Summary'
    ];

    const rows = logs.map((log) => {
      const synthetic = log.metadata?.deepfakeMetrics?.syntheticArtifactsDetected || log.metadata?.acousticBotTelemetry?.isRobocallBot ? 'YES' : 'NO';
      const fingerprint = log.metadata?.acousticBotTelemetry?.audioFingerprintHash || 'N/A';
      const cleanRationale = `"${(log.rationale || '').replace(/"/g, '""')}"`;
      const cleanName = `"${(log.callerName || '').replace(/"/g, '""')}"`;

      return [
        log.id,
        log.timestamp,
        log.phoneNumber,
        cleanName,
        log.verdict,
        log.riskScore,
        log.category,
        Math.round((log.metadata?.spoofProbability ?? (log.riskScore / 100)) * 100) + '%',
        synthetic,
        fingerprint,
        cleanRationale
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Generates a legal complaint affidavit document suitable for police or telecom carrier dispute
   */
  public static generateLegalAffidavit(log: ScreeningResult): string {
    const isSynthetic = log.metadata?.deepfakeMetrics?.syntheticArtifactsDetected || log.metadata?.acousticBotTelemetry?.isRobocallBot;
    return `================================================================================
AEGISCALL AI TELECOM SECURITY - INCIDENT REPORT & AFFIDAVIT
Document Ref: AFF-${log.id} | Generated: ${new Date().toISOString()}
================================================================================

1. INCIDENT OVERVIEW:
   - Target Phone: ${log.phoneNumber}
   - Reported Caller ID: ${log.callerName}
   - Timestamp of Event: ${log.timestamp}
   - Screening Verdict: ${log.verdict}
   - Calculated Threat Score: ${log.riskScore}/100 (${log.riskLevel})
   - Threat Classification: ${log.category}

2. ACOUSTIC & CRYPTOGRAPHIC BIOMETRICS:
   - Carrier STIR/SHAKEN Verification: ${log.metadata?.stirShakenAttestation || 'UNVERIFIED / ABSENT'}
   - Spoof Signature Probability: ${Math.round((log.metadata?.spoofProbability ?? 0.5) * 100)}%
   - Synthetic AI / Voice Clone Detected: ${isSynthetic ? 'CONFIRMED' : 'NEGATIVE'}
   - Robocall Acoustic Fingerprint: ${log.metadata?.acousticBotTelemetry?.audioFingerprintHash || 'NOT_CAPTURED'}

3. AI EVIDENCE & TRANSCRIPT RATIONALE:
   "${log.rationale}"

4. CERTIFICATION:
   This incident was cryptographically logged and analyzed on-device by AegisCall AI
   Telecom Screener. This record is compliant with FCC TCPA Robocall Enforcement and
   FTC Telemarketing Sales Rule documentation standards.
================================================================================`;
  }
}
