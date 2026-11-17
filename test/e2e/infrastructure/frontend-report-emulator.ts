export interface RenderedTableColumn {
  key: string;
  label: string;
  isNumeric: boolean;
}

export interface RenderedTableCell {
  columnKey: string;
  columnLabel: string;
  rawValue: unknown;
  renderedText: string;
  isFallbackDash: boolean;
  isNumeric: boolean;
}

export interface RenderedTableRow {
  rowIndex: number;
  rowType: 'GROUP' | 'ITEM' | 'SUBTOTAL';
  cells: Record<string, RenderedTableCell>;
  groupLabel?: string;
  rawRow: Record<string, any>;
}

export interface RenderedReportView {
  reportName: string;
  columns: RenderedTableColumn[];
  rows: RenderedTableRow[];
  itemRows: RenderedTableRow[];
  subtotalRows: RenderedTableRow[];
  groupRows: RenderedTableRow[];
  visibleItemCount: number;
  visibleSubtotalCount: number;
  visibleGroupCount: number;
}

export class FrontendReportEmulator {
  /**
   * Emulates React table rendering (matching SalePurchaseReportTable, etc.)
   */
  public static render(reportName: string, responseData: any): RenderedReportView {
    const rawColumns: Array<{ key: string; label: string }> = Array.isArray(responseData?.columns)
      ? responseData.columns
      : [];

    const rawRows: any[] = Array.isArray(responseData?.rows)
      ? responseData.rows
      : Array.isArray(responseData?.data)
        ? responseData.data
        : Array.isArray(responseData?.items)
          ? responseData.items
          : Array.isArray(responseData)
            ? responseData
            : [];

    const columns: RenderedTableColumn[] = rawColumns.map(col => ({
      key: col.key,
      label: col.label || col.key,
      isNumeric: FrontendReportEmulator.isNumericColumn(col.key),
    }));

    const rows: RenderedTableRow[] = rawRows.map((row, index) => {
      const rowType: 'GROUP' | 'ITEM' | 'SUBTOTAL' = row.rowType || 'ITEM';
      const cells: Record<string, RenderedTableCell> = {};

      for (const col of columns) {
        const rawVal = row[col.key];
        const hasValue = rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== '';
        const renderedText = hasValue ? String(rawVal).trim() : '-';

        cells[col.key] = {
          columnKey: col.key,
          columnLabel: col.label,
          rawValue: rawVal,
          renderedText,
          isFallbackDash: !hasValue,
          isNumeric: col.isNumeric,
        };
      }

      return {
        rowIndex: index,
        rowType,
        groupLabel: row.groupLabel || row.partyProfileName || row.name,
        cells,
        rawRow: row,
      };
    });

    const itemRows = rows.filter(r => r.rowType === 'ITEM');
    const subtotalRows = rows.filter(r => r.rowType === 'SUBTOTAL');
    const groupRows = rows.filter(r => r.rowType === 'GROUP');

    return {
      reportName,
      columns,
      rows,
      itemRows,
      subtotalRows,
      groupRows,
      visibleItemCount: itemRows.length,
      visibleSubtotalCount: subtotalRows.length,
      visibleGroupCount: groupRows.length,
    };
  }

  public static isNumericColumn(key: string): boolean {
    const numericKeywords = [
      'quantity', 'rate', 'amount', 'taxamount', 'netamount', 'debit', 'credit',
      'profit', 'cost', 'opening', 'closing', 'purchasebulk', 'purchaseretail',
      'sellbulk', 'sellretail', 'receipt', 'payment', 'balance', 'grossprofit',
      'netprofit', 'runningbalance', 'runningtotal', 'advanceamount', 'adjustedamount',
      'outstanding'
    ];
    const lowerKey = key.toLowerCase();
    return numericKeywords.some(keyword => lowerKey.includes(keyword));
  }
}
