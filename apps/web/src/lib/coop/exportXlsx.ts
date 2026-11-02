/**
 * Downloads a table as an Excel file, built in the browser from the figures already on the screen, so what is exported is exactly what the
 * member sees. `exceljs` is loaded only when someone presses Export, so it never weighs down the page itself.
 * Money columns are written as numbers with a naira format (₦#,##0.00), not as text, so they add up in a spreadsheet.
 */
export interface SheetColumn {
  header: string;
  width?: number;
  /** A money column is stored as a number and formatted as naira. */
  money?: boolean;
}

export async function downloadXlsx(filename: string, sheetName: string, columns: SheetColumn[], rows: Array<Array<string | number | null>>): Promise<void> {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName.slice(0, 31));
  sheet.columns = columns.map((c) => ({ header: c.header, width: c.width ?? 18 }));
  sheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    sheet.addRow(row.map((cell, i) => (columns[i]?.money && cell !== null && cell !== '' ? Number(cell) : cell)));
  }
  columns.forEach((c, i) => {
    if (c.money) sheet.getColumn(i + 1).numFmt = '"₦"#,##0.00';
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}
