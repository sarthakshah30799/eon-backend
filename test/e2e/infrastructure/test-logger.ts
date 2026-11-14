export class TestLogger {
  private static indentLevel = 0;

  static header(title: string) {
    console.log('\n' + '='.repeat(90));
    console.log(`  📌 ${title.toUpperCase()}`);
    console.log('='.repeat(90));
  }

  static subHeader(title: string) {
    console.log('\n' + '-'.repeat(70));
    console.log(`  🔹 ${title}`);
    console.log('-'.repeat(70));
  }

  static step(stepNo: string | number, desc: string) {
    console.log(`\n▶ [STEP ${stepNo}] ${desc}`);
  }

  static success(desc: string, details?: any) {
    console.log(`  ✅ SUCCESS: ${desc}`);
    if (details) {
      console.log('     ', typeof details === 'object' ? JSON.stringify(details, null, 2).split('\n').join('\n      ') : details);
    }
  }

  static failure(desc: string, error?: any) {
    console.log(`  ❌ FAILURE: ${desc}`);
    if (error) {
      console.log('     Error:', typeof error === 'object' ? JSON.stringify(error, null, 2).split('\n').join('\n      ') : error);
    }
  }

  static info(msg: string, data?: any) {
    console.log(`  ℹ️  ${msg}`);
    if (data !== undefined) {
      console.log('     ', typeof data === 'object' ? JSON.stringify(data, null, 2).split('\n').join('\n      ') : data);
    }
  }

  static warn(msg: string) {
    console.log(`  ⚠️  ${msg}`);
  }
}

