
interface QueryResult {
    type: 'ResultSet' | 'Success';
    data: any;
}

export function formatQueryResultToTable(result: QueryResult): string {
    if (result.type === 'Success') {
        return `\r\n\x1b[32m${result.data}\x1b[0m\r\n`;
    }

    const { columns, rows } = result.data as { columns: string[], rows: string[][] };

    if (!columns || columns.length === 0) return '\r\nEmpty Result\r\n';

    // Calculate column widths
    const widths = columns.map((col, i) => {
        let max = col.length;
        rows.forEach(row => {
            const cell = row[i] ? String(row[i]) : 'NULL';
            if (cell.length > max) max = cell.length;
        });
        return Math.min(max, 50); // Cap width at 50 chars for terminal readability
    });

    const separator = '+' + widths.map(w => '-'.repeat(w + 2)).join('+') + '+';

    let output = '\r\n' + separator + '\r\n';

    // Header
    output += '|' + columns.map((col, i) => {
        return ' ' + col.padEnd(widths[i]) + ' ';
    }).join('|') + '|\r\n';

    output += separator + '\r\n';

    // Rows (Limit to 50 for terminal display to avoid flooding)
    const displayRows = rows.slice(0, 50);
    displayRows.forEach(row => {
        output += '|' + row.map((cell, i) => {
            const val = cell ? String(cell) : 'NULL';
            // Truncate if too long
            const displayVal = val.length > widths[i] ? val.substring(0, widths[i] - 3) + '...' : val;
            return ' ' + displayVal.padEnd(widths[i]) + ' ';
        }).join('|') + '|\r\n';
    });

    output += separator + '\r\n';

    if (rows.length > 50) {
        output += `\x1b[90m... and ${rows.length - 50} more rows (view in Preview Panel)\x1b[0m\r\n`;
    }
    output += `\x1b[90m${rows.length} rows in set\x1b[0m\r\n`;

    return output;
}
