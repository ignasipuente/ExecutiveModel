import * as XLSX from 'xlsx';

const REQUIRED_SHEETS = ['INPUTS', 'OUTPUTS'];

/**
 * Reads every non-empty value from the `variable_name` column of a sheet.
 * @param {XLSX.WorkSheet} sheet
 * @returns {string[]}
 */
function readVariableNames(sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  return rows
    .map((row) => String(row['variable_name'] ?? '').trim())
    .filter(Boolean);
}

/**
 * Parses an .xlsx / .xls file and extracts variable names from the
 * INPUTS and OUTPUTS sheets.
 *
 * Always resolves (never rejects). On any failure the returned `error`
 * field is populated and inputs/outputs are empty arrays.
 *
 * @param {File} file
 * @returns {Promise<{
 *   filename: string,
 *   inputs:   string[],
 *   outputs:  string[],
 *   error:    string | null,
 * }>}
 */
export function parseExcelFile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(new Uint8Array(e.target.result), {
          type: 'array',
        });

        const found = workbook.SheetNames;
        const missing = REQUIRED_SHEETS.filter((s) => !found.includes(s));

        if (missing.length > 0) {
          const missingList = missing.join(' and ');
          const foundList = found.length
            ? found.join(', ')
            : '(no sheets found)';
          resolve({
            filename: file.name,
            inputs: [],
            outputs: [],
            error:
              `Required sheet${missing.length > 1 ? 's' : ''} not found: ${missingList}. ` +
              `Sheets in this file: ${foundList}.`,
          });
          return;
        }

        // TODO: remove these debug logs once column names are confirmed
        const rawInputs = XLSX.utils.sheet_to_json(workbook.Sheets['INPUTS'], { defval: '' });
        const rawOutputs = XLSX.utils.sheet_to_json(workbook.Sheets['OUTPUTS'], { defval: '' });
        console.log('[parseExcel] INPUTS raw rows:', rawInputs);
        console.log('[parseExcel] OUTPUTS raw rows:', rawOutputs);

        resolve({
          filename: file.name,
          inputs: readVariableNames(workbook.Sheets['INPUTS']),
          outputs: readVariableNames(workbook.Sheets['OUTPUTS']),
          error: null,
        });
      } catch (err) {
        resolve({
          filename: file.name,
          inputs: [],
          outputs: [],
          error: `Could not parse file: ${err.message}`,
        });
      }
    };

    reader.onerror = () =>
      resolve({
        filename: file.name,
        inputs: [],
        outputs: [],
        error: 'Failed to read the file from disk.',
      });

    reader.readAsArrayBuffer(file);
  });
}
