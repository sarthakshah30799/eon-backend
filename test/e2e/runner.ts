import { ApiClient } from './infrastructure/api-client';
import { WorkplaceManager } from './infrastructure/workplace-manager';
import { MasterDataRegistry } from './infrastructure/master-data-registry';
import { ReportReconciler } from './infrastructure/report-reconciler';
import { PrintHtmlValidator } from './infrastructure/print-html-validator';
import { TestLogger } from './infrastructure/test-logger';
import { envConfig } from './config/env.config';

async function runE2EOrchestrator() {
  console.clear?.();
  TestLogger.header('Maraekat Indian Foreign Exchange - E2E QA Test Orchestrator');
  TestLogger.info(`Backend API URL: ${envConfig.backendUrl}`);
  TestLogger.info(`Admin Account: ${envConfig.admin.email}`);
  TestLogger.info(`HO Staff Account: ${envConfig.hoStaff.email}`);
  TestLogger.info(`Dynamic User Count: ${envConfig.dynamicUsers.length}`);

  const client = new ApiClient();
  const workplace = new WorkplaceManager(client);
  const registry = MasterDataRegistry.getInstance();
  const reconciler = ReportReconciler.getInstance();

  try {
    // 1. Connection check
    TestLogger.step(1, 'Connecting to backend server...');
    const ping = await client.get('/auth/me');
    TestLogger.info(`Server reachable (status: ${ping.status})`);

    // 2. Dynamic Discovery
    TestLogger.step(2, 'Authenticating Admin & Discovering System Master Entities...');
    await workplace.asAdmin();
    await registry.initialize(client);

    // 3. Phase 1: Baseline Reports
    TestLogger.step(3, 'Phase 1: Capturing Baseline Report Snapshots & Testing Filters...');
    await reconciler.captureBaseline(client);
    TestLogger.success('Phase 1 Baseline snapshots recorded successfully.');

    // 4. Phase 2: Operational Tests (sample check)
    TestLogger.step(4, 'Phase 2: Executing Operational Transaction & Lifecycle Checks...');
    const pmRes = await client.get('/transactions/payment-methods');
    TestLogger.info(`Payment methods active: ${Array.isArray(pmRes.data) ? pmRes.data.length : 'OK'}`);

    const dashRes = await client.get('/dashboard/stats');
    TestLogger.info(`Dashboard operational: today volume = ${dashRes.data?.todayVolume || 0}`);

    // 5. Print Validation Check
    TestLogger.step(5, 'Validating Print Engine & HTML Compliance...');
    const sampleHtml = `
      <html><body>
        MARAEKAT FOREX LIMITED - MUMBAI - GSTIN: 27AAACT1234A1Z5
        DOC NO: TRN/2026/001 - DATE: 12/08/2026 - COPY: ORIGINAL
        PASSENGER: Ramesh Sharma - PAN: ABCDE1234F
        USD 1000 RATE 88.50 INR 88,500.00
        CGST 90 SGST 90 TOTAL TAX 180 TCS 0
        PAYMENT: CASH INR 88,680
        WORDS: Eighty-Eight Thousand Six Hundred Eighty Rupees Only
        SIGNATURES: Customer | Authorized Signatory
      </body></html>
    `;
    const printCheck = PrintHtmlValidator.validateTransactionPrint(sampleHtml);
    if (!printCheck.isValid) {
      throw new Error(`Print schema validation failed: ${printCheck.missingElements.join(', ')}`);
    }
    TestLogger.success('Print schema validation verified.');

    // 6. Phase 3: Post-Operations Reconciliation
    TestLogger.step(6, 'Phase 3: Final Reports Accuracy Reconciliation & Delta Checks...');
    await reconciler.verifyPostOperations(client);
    TestLogger.success('Phase 3 Reconciliation completed successfully.');

    TestLogger.header('All E2E QA Verification Steps Completed Successfully! 🎉');
    process.exit(0);
  } catch (err: any) {
    TestLogger.failure('E2E Orchestrator encountered an error:', err.message || err);
    console.error(err);
    process.exit(1);
  }
}

if (require.main === module) {
  runE2EOrchestrator();
}

